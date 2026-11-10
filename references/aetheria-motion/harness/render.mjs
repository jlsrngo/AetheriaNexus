#!/usr/bin/env node
// Aetheria Motion Engine: Cross-Platform Deterministic HTML -> MP4 Renderer.
//
// Each film page must define, before setting window.__ready = true:
//   window.AETHERIA_FILM = { width, height, fps, duration, title, scenes } (or window.DEMO)
//   window.renderAt = async (t) => { ... } // draw the frame for time t (seconds)

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import events from 'node:events';
events.defaultMaxListeners = 100;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKSPACE_ROOT = path.resolve(ROOT, '../..');

function resolveBrowserExecutable() {
  if (process.env.AETHERIA_CHROME || process.env.MG_CHROME) {
    return process.env.AETHERIA_CHROME || process.env.MG_CHROME;
  }
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  return candidates.find((p) => fs.existsSync(p)) || candidates[0];
}

function resolveFfmpegExecutable() {
  const candidates = [
    path.resolve(WORKSPACE_ROOT, 'node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe'),
    path.resolve(WORKSPACE_ROOT, 'node_modules/@remotion/compositor-linux-x64-gnu/ffmpeg'),
    path.resolve(WORKSPACE_ROOT, 'node_modules/@remotion/compositor-darwin-arm64/ffmpeg'),
  ];
  return candidates.find((p) => fs.existsSync(p)) || 'ffmpeg';
}

const CHROME = resolveBrowserExecutable();
const FFMPEG_BIN = resolveFfmpegExecutable();
const GPU_ARGS = process.env.AETHERIA_GPU_ARGS
  ? process.env.AETHERIA_GPU_ARGS.split(' ').filter(Boolean)
  : process.platform === 'darwin'
    ? ['--use-angle=metal']
    : process.platform === 'win32'
      ? ['--use-gl=angle', '--no-sandbox']
      : ['--use-gl=angle', '--use-angle=gl-egl', '--no-sandbox', '--disable-gpu-watchdog', '--disable-gpu-process-crash-limit'];

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k.startsWith('--')) {
      const key = k.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) a[key] = true;
      else { a[key] = next; i++; }
    } else a._.push(k);
  }
  return a;
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.wasm': 'application/wasm', '.glsl': 'text/plain', '.frag': 'text/plain', '.vert': 'text/plain',
  '.hdr': 'application/octet-stream', '.exr': 'application/octet-stream', '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.mp4': 'video/mp4', '.wav': 'audio/wav',
  '.ktx2': 'application/octet-stream',
};

function startServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      try {
        const u = new URL(req.url, 'http://x');
        let p = path.join(ROOT, decodeURIComponent(u.pathname));
        if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
        if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
        if (!fs.existsSync(p)) { res.writeHead(404); return res.end('404 ' + u.pathname); }
        res.writeHead(200, {
          'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream',
          'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*',
        });
        fs.createReadStream(p).pipe(res);
      } catch (e) { res.writeHead(500); res.end(String(e)); }
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

let SCALE = 1;
async function openPage(browser, url, w, h, logPrefix) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: SCALE });
  page.on('console', (m) => {
    const t = m.type();
    if (t === 'error' || t === 'warn' || process.env.VERBOSE) console.log(`${logPrefix}[page ${t}] ${m.text()}`);
  });
  page.on('pageerror', (e) => console.log(`${logPrefix}[page error] ${e.message}`));
  page.on('requestfailed', (r) => console.log(`${logPrefix}[request failed] ${r.url()} ${r.failure()?.errorText}`));
  await page.goto(url, { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction('window.__ready === true', { timeout: 300000, polling: 100 });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  return page;
}

async function seek(page, t) {
  await page.evaluate(async (t) => {
    for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = t * 1000; } catch {} }
    if (typeof window.renderAt === 'function') await window.renderAt(t);
  }, t);
}

async function linkAt(page, t) {
  return page.evaluate((t) => (typeof window.linkAt === 'function' ? window.linkAt(t) : null), t);
}

async function shot(page, w, h) {
  return page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: w, height: h }, optimizeForSpeed: true, captureBeyondViewport: false });
}

function ffmpeg(args, opts = {}) {
  const p = spawn(FFMPEG_BIN, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['pipe', 'inherit', 'inherit'], ...opts });
  const done = new Promise((res, rej) => p.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))));
  return { p, done };
}

function writeAsync(stream, buf) {
  return new Promise((res, rej) => { if (!stream.write(buf)) stream.once('drain', res); else res(); stream.once('error', rej); });
}

const SLOTS = +(process.env.AETHERIA_RENDER_SLOTS || 3);
const LOCKDIR = path.join(os.tmpdir(), 'aetheria-render-slots');
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
async function acquireSlot() {
  fs.mkdirSync(LOCKDIR, { recursive: true });
  for (let waited = 0; ; waited += 2) {
    for (let i = 0; i < SLOTS; i++) {
      const d = path.join(LOCKDIR, 'slot' + i);
      try { fs.mkdirSync(d); fs.writeFileSync(path.join(d, 'pid'), String(process.pid)); return d; } catch {}
      try {
        const pidFile = path.join(d, 'pid');
        const stale = fs.existsSync(pidFile) ? !alive(+fs.readFileSync(pidFile, 'utf8')) : Date.now() - fs.statSync(d).mtimeMs > 30000;
        if (stale) fs.rmSync(d, { recursive: true, force: true });
      } catch {}
    }
    if (waited % 30 === 0) console.log(`waiting for a render slot (${SLOTS} full renders machine-wide)...`);
    await new Promise((r) => setTimeout(r, 2000));
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.stills) {
    const slot = await acquireSlot();
    const freeSlot = () => { try { fs.rmSync(slot, { recursive: true, force: true }); } catch {} };
    process.on('exit', freeSlot);
    for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { freeSlot(); process.exit(1); });
  }
  const demoDir = path.resolve(args._[0] || '.');
  const rel = path.relative(ROOT, demoDir).replace(/\\/g, '/');
  const srv = await startServer();
  const port = srv.address().port;
  const url = `http://127.0.0.1:${port}/${rel}/${args.page || 'index.html'}${args.query ? '?' + args.query : ''}`;

  const launch = () => puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    protocolTimeout: 600000,
    args: [...GPU_ARGS, '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu',
      '--font-render-hinting=none', '--disable-lcd-text', '--force-color-profile=srgb',
      '--disable-background-timer-throttling', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
      '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars', '--mute-audio'],
  });
  const browser = await launch();
  const extra = [];

  try {
    const probe = await browser.newPage();
    await probe.setViewport({ width: 1920, height: 1080 });
    probe.on('pageerror', (e) => console.log(`[page error] ${e.message}`));
    await probe.goto(url, { waitUntil: 'load', timeout: 180000 });
    await probe.waitForFunction('window.__ready === true', { timeout: 300000, polling: 100 });
    const cfg = await probe.evaluate(() => window.AETHERIA_FILM || window.DEMO || {});
    await probe.close();

    const W = +(args.w || cfg.width || 1920), H = +(args.h || cfg.height || 1080);
    const FPS = +(args.fps || cfg.fps || 30), DUR = +(args.duration || cfg.duration || 10);
    const MB = Math.max(1, +(args.mb || cfg.motionBlur?.samples || 1));
    const SHUTTER = +(args.shutter ?? cfg.motionBlur?.shutter ?? 0.5);
    const outDir = path.join(demoDir, 'out');
    fs.mkdirSync(outDir, { recursive: true });
    SCALE = +(args.scale || 1);

    if (args.stills) {
      const ts = String(args.stills).split(',').map(Number);
      const page = await openPage(browser, url, W, H, '');
      const sd = path.join(outDir, 'stills');
      fs.mkdirSync(sd, { recursive: true });
      const lk = {};
      for (const t of ts) {
        await seek(page, t);
        const buf = await shot(page, W, H);
        const f = path.join(sd, `t${t.toFixed(2).padStart(5, '0')}.png`);
        fs.writeFileSync(f, buf);
        console.log(f);
        if (args.links) lk[t.toFixed(3)] = await linkAt(page, t);
      }
      if (args.links) fs.writeFileSync(path.join(sd, 'links.json'), JSON.stringify(lk, null, 1));
      return;
    }

    const totalFrames = Math.round(DUR * FPS);
    const f0 = Math.round(+(args.from || 0) * FPS), f1 = Math.min(totalFrames, Math.round(+(args.to || DUR) * FPS));
    const WORKERS = Math.max(1, Math.min(+(args.workers || cfg.workers || 1), f1 - f0));
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aetheria-render-'));
    const out = path.resolve(args.out || path.join(outDir, 'video.mp4'));
    const t0 = performance.now();
    console.log(`render ${rel}: ${W}x${H} @${FPS}fps frames ${f0}-${f1} mb=${MB} shutter=${SHUTTER} workers=${WORKERS}`);

    const chunk = Math.ceil((f1 - f0) / WORKERS);
    let doneFrames = 0;
    const segs = [];
    await Promise.all(Array.from({ length: WORKERS }, async (_, w) => {
      const a = f0 + w * chunk, b = Math.min(f1, a + chunk);
      if (a >= b) return;
      const seg = path.join(tmp, `seg${String(w).padStart(2, '0')}.mkv`);
      segs[w] = seg;
      const br = w === 0 ? browser : await launch();
      if (w) extra.push(br);
      const page = await openPage(br, url, W, H, `[w${w}] `);
      const vf = MB > 1
        ? `tmix=frames=${MB},select='eq(mod(n\\,${MB})\\,${MB - 1})',setpts=N/(${FPS}*TB)`
        : 'null';
      const ff = ffmpeg(['-f', 'image2pipe', '-framerate', String(FPS * MB), '-c:v', 'png', '-i', '-',
        '-vf', vf, '-r', String(FPS), '-c:v', 'ffv1', '-level', '3', '-threads', '2', '-pix_fmt', 'bgr0', seg]);
      for (let f = a; f < b; f++) {
        for (let s = 0; s < MB; s++) {
          const t = MB > 1 ? Math.max(0, (f + SHUTTER * ((s + 0.5) / MB - 0.5)) / FPS) : f / FPS;
          await seek(page, t);
          await writeAsync(ff.p.stdin, await shot(page, W, H));
        }
        doneFrames++;
        if (doneFrames % 30 === 0) {
          const el = (performance.now() - t0) / 1000;
          console.log(`  ${doneFrames}/${f1 - f0} frames  ${el.toFixed(1)}s  (${(el / doneFrames).toFixed(2)}s/frame)`);
        }
      }
      ff.p.stdin.end();
      await ff.done;
      await page.close();
    }));

    const list = path.join(tmp, 'list.txt');
    fs.writeFileSync(list, segs.filter(Boolean).map((s) => `file '${s.replace(/\\/g, '/')}'`).join('\n'));
    const audio = args.audio ? path.resolve(args.audio) : (fs.existsSync(path.join(demoDir, 'out', 'audio.wav')) ? path.join(demoDir, 'out', 'audio.wav') : null);
    const enc = ['-f', 'concat', '-safe', '0', '-i', list];
    if (audio && !args.noaudio) enc.push('-i', audio);
    enc.push('-map', '0:v:0');
    if (audio && !args.noaudio) enc.push('-map', '1:a:0', '-af', 'apad', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-shortest');
    enc.push('-vf', 'scale=out_color_matrix=bt709:out_range=tv:flags=lanczos+accurate_rnd+full_chroma_int,format=yuv420p',
      '-c:v', 'libx264', '-threads', '4', '-preset', 'veryfast', '-crf', String(args.crf || 16), '-profile:v', 'high',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
      '-r', String(FPS), '-movflags', '+faststart', out);
    await ffmpeg(enc).done;
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log(`done -> ${out}  (${((performance.now() - t0) / 1000).toFixed(1)}s)`);
  } finally {
    for (const b of extra) await b.close().catch(() => {});
    await browser.close();
    srv.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

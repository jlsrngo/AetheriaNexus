import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { execFileSync, spawn } from "node:child_process";
import puppeteer from "puppeteer-core";
import { bundle } from "@remotion/bundler";
import { getCompositions, openBrowser, renderMedia } from "@remotion/renderer";

function resolveBundledFfmpeg() {
  const candidates = [
    path.resolve(process.cwd(), "node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe"),
    path.resolve(process.cwd(), "node_modules/@remotion/compositor-linux-x64-gnu/ffmpeg"),
    path.resolve(process.cwd(), "node_modules/@remotion/compositor-linux-arm64-gnu/ffmpeg"),
    path.resolve(process.cwd(), "node_modules/@remotion/compositor-darwin-arm64/ffmpeg"),
    path.resolve(process.cwd(), "node_modules/@remotion/compositor-darwin-x64/ffmpeg"),
  ];
  return candidates.find((p) => fs.existsSync(p)) || "ffmpeg";
}

const emit = (payload) => console.log(JSON.stringify(payload));

function parseArgs(argv) {
  const parsed = {
    props: "{}",
    output: "",
    composition: "",
    entry: "",
    html: "",
    bundleDir: "",
    bundleStamp: "",
    concurrency: "4",
    codec: "h264",
    frames: "",
    browser: "",
    shards: "",
    forceRemotion: false,
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--force-remotion") {
      parsed.forceRemotion = true;
      continue;
    }
    const value = argv[i + 1];
    if (value === undefined) break;
    if (argv[i] === "--props") parsed.props = value;
    else if (argv[i] === "--output") parsed.output = value;
    else if (argv[i] === "--composition") parsed.composition = value;
    else if (argv[i] === "--entry") parsed.entry = value;
    else if (argv[i] === "--html") parsed.html = value;
    else if (argv[i] === "--bundle-dir") parsed.bundleDir = value;
    else if (argv[i] === "--bundle-stamp") parsed.bundleStamp = value;
    else if (argv[i] === "--concurrency") parsed.concurrency = value;
    else if (argv[i] === "--shards") parsed.shards = value;
    else if (argv[i] === "--codec") parsed.codec = value;
    else if (argv[i] === "--frames") parsed.frames = value;
    else if (argv[i] === "--browser-executable") parsed.browser = value;
    else continue;
    i++;
  }
  return parsed;
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

function startHtmlFilmServer(htmlFilePath) {
  const rootDir = process.cwd();
  const searchDirs = [
    path.dirname(htmlFilePath),
    path.resolve(rootDir, "workspace"),
    path.resolve(rootDir, "workspace/script"),
    path.resolve(rootDir, "workspace/audio"),
    path.resolve(rootDir, "workspace/img"),
    path.resolve(rootDir, "apps/public"),
    path.resolve(rootDir, "public"),
  ];

  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      try {
        const u = new URL(req.url, "http://127.0.0.1");
        const pathname = decodeURIComponent(u.pathname);

        if (pathname === "/" || pathname === "/index.html" || pathname === "/workspace-film.html") {
          let html = fs.readFileSync(htmlFilePath, "utf8");
          if (!html.includes("aetheria-motion.js")) {
            const scriptTag = '<script src="/script/aetheria-motion.js"></script>\n';
            html = html.includes("</head>")
              ? html.replace("</head>", `${scriptTag}</head>`)
              : `${scriptTag}${html}`;
          }
          res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
            "Access-Control-Allow-Origin": "*",
          });
          res.end(html);
          return;
        }

        const relPath = pathname.replace(/^\/+/, "");
        const resolved = searchDirs
          .map((d) => path.resolve(d, relPath))
          .find((p) => fs.existsSync(p) && fs.statSync(p).isFile());

        if (!resolved) {
          res.writeHead(404);
          res.end(`Not found: ${pathname}`);
          return;
        }

        const ext = path.extname(resolved).toLowerCase();
        res.writeHead(200, {
          "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
          "Cache-Control": "no-store",
          "Access-Control-Allow-Origin": "*",
        });
        fs.createReadStream(resolved).pipe(res);
      } catch (err) {
        res.writeHead(500);
        res.end(String(err));
      }
    });
    srv.listen(0, "127.0.0.1", () => resolve(srv));
  });
}

function writePipeChunk(stream, buffer) {
  return new Promise((resolve, reject) => {
    const onError = (err) => {
      stream.removeListener("drain", onDrain);
      reject(err);
    };
    const onDrain = () => {
      stream.removeListener("error", onError);
      resolve();
    };
    stream.once("error", onError);
    if (!stream.write(buffer)) {
      stream.once("drain", onDrain);
    } else {
      stream.removeListener("error", onError);
      resolve();
    }
  });
}

function resolveSceneAudioFiles(scenes) {
  const rootDir = process.cwd();
  const candidates = [
    path.resolve(rootDir, "workspace"),
    path.resolve(rootDir, "workspace/audio"),
    path.resolve(rootDir, "apps/public"),
    path.resolve(rootDir, "public"),
  ];
  const resolved = [];
  if (!Array.isArray(scenes)) return resolved;

  let cursorSec = 0;
  for (const scene of scenes) {
    const startSec = typeof scene.start === "number" ? scene.start : cursorSec;
    const durSec = typeof scene.duration === "number" ? scene.duration : 0;
    cursorSec = startSec + durSec;
    if (!scene.audio) continue;
    const rel = String(scene.audio).replace(/^\/+/, "");
    const file = candidates.map((d) => path.resolve(d, rel)).find((p) => fs.existsSync(p));
    if (file) {
      resolved.push({ file, startMs: Math.max(0, Math.round(startSec * 1000)) });
    }
  }
  return resolved;
}

async function renderHtmlFilm({
  htmlPath,
  outputLocation,
  browserExecutable,
  frameRange,
  compositionId,
}) {
  if (!browserExecutable) {
    throw new Error("No local Chrome/Edge browser executable found for HTML film rendering.");
  }

  const srv = await startHtmlFilmServer(htmlPath);
  const port = srv.address().port;
  const pageUrl = `http://127.0.0.1:${port}/workspace-film.html`;

  const browser = await puppeteer.launch({
    executablePath: browserExecutable,
    headless: true,
    protocolTimeout: 600000,
    args: [
      "--use-gl=angle",
      "--enable-gpu",
      "--ignore-gpu-blocklist",
      "--disable-gpu-vsync",
      "--disable-frame-rate-limit",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--force-color-profile=srgb",
      "--autoplay-policy=no-user-gesture-required",
      "--hide-scrollbars",
      "--mute-audio",
      "--no-sandbox",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
    await page.goto(pageUrl, { waitUntil: "load", timeout: 120000 });
    await page
      .waitForFunction("window.__ready === true || typeof window.renderAt === 'function'", {
        timeout: 30000,
        polling: 50,
      })
      .catch(() => {});
    await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve()));

    const meta = await page.evaluate(() => {
      const m = window.AETHERIA_FILM || window.DEMO || {};
      return {
        title: m.title || document.title || "Aetheria Motion Film",
        width: Number(m.width) || 1080,
        height: Number(m.height) || 1920,
        fps: Number(m.fps) || 30,
        duration: Number(m.duration) || 120.53,
        scenes: Array.isArray(m.scenes) ? m.scenes : [],
      };
    });

    await page.setViewport({
      width: meta.width,
      height: meta.height,
      deviceScaleFactor: 1,
    });

    const totalFilmFrames = Math.max(1, Math.round(meta.duration * meta.fps));
    const startFrame = frameRange ? frameRange[0] : 0;
    const endFrame = frameRange ? Math.min(totalFilmFrames - 1, frameRange[1]) : totalFilmFrames - 1;
    const targetFrames = Math.max(1, endFrame - startFrame + 1);
    const compId = compositionId || "SejarahLahirnyaListrik";

    emit({
      type: "status",
      message: `Rendering Aetheria HTML Film "${meta.title}" (${meta.width}x${meta.height} @ ${meta.fps}fps)...`,
      compositionId: compId,
      totalFrames: targetFrames,
      fps: meta.fps,
    });

    const ffmpegBin = resolveBundledFfmpeg();
    const audioTracks = startFrame === 0 ? resolveSceneAudioFiles(meta.scenes) : [];

    const ffArgs = [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "image2pipe",
      "-framerate",
      String(meta.fps),
      "-c:v",
      "mjpeg",
      "-i",
      "-",
    ];

    for (const track of audioTracks) {
      ffArgs.push("-i", track.file);
    }

    if (audioTracks.length > 0) {
      const filterParts = [];
      const mixInputs = [];
      audioTracks.forEach((track, idx) => {
        const inputIdx = idx + 1;
        const label = `a${idx}`;
        filterParts.push(`[${inputIdx}:a]adelay=${track.startMs}|${track.startMs}[${label}]`);
        mixInputs.push(`[${label}]`);
      });
      filterParts.push(
        `${mixInputs.join("")}amix=inputs=${audioTracks.length}:normalize=0,apad[aout]`,
      );
      ffArgs.push(
        "-filter_complex",
        filterParts.join(";"),
        "-map",
        "0:v:0",
        "-map",
        "[aout]",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
      );
    }

    ffArgs.push(
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "18",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      path.resolve(outputLocation),
    );

    const ffProc = spawn(ffmpegBin, ffArgs, {
      stdio: ["pipe", "ignore", "pipe"],
    });

    let ffStderr = "";
    ffProc.stderr.on("data", (chunk) => {
      ffStderr += chunk.toString();
    });

    const ffDone = new Promise((resolve, reject) => {
      ffProc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg exited with code ${code}: ${ffStderr.trim()}`));
      });
    });

    for (let f = startFrame; f <= endFrame; f++) {
      const t = f / meta.fps;
      await page.evaluate(async (timeSec) => {
        for (const anim of document.getAnimations()) {
          try {
            anim.pause();
            anim.currentTime = timeSec * 1000;
          } catch {}
        }
        if (typeof window.renderAt === "function") {
          await window.renderAt(timeSec);
        }
      }, t);

      const frameBuf = await page.screenshot({
        type: "jpeg",
        quality: 90,
        clip: { x: 0, y: 0, width: meta.width, height: meta.height },
        optimizeForSpeed: true,
        captureBeyondViewport: false,
      });

      await writePipeChunk(ffProc.stdin, frameBuf);

      const renderedFrames = f - startFrame + 1;
      if (renderedFrames === 1 || renderedFrames % 5 === 0 || renderedFrames === targetFrames) {
        const percent = Math.min(100, Math.round((renderedFrames / targetFrames) * 100));
        emit({
          type: "progress",
          percent,
          renderedFrames,
          totalFrames: targetFrames,
        });
      }
    }

    ffProc.stdin.end();
    await ffDone;

    emit({
      type: "done",
      compositionId: compId,
      outputPath: outputLocation,
    });
  } finally {
    await browser.close().catch(() => {});
    srv.close();
  }
}

async function resolveServeUrl(entryPoint, bundleDir, rustStamp) {
  const publicDirCandidates = [
    path.resolve(process.cwd(), "workspace/public"),
    path.resolve(process.cwd(), "apps/public"),
    path.resolve(process.cwd(), "public"),
  ];
  const publicDir = publicDirCandidates.find((p) => fs.existsSync(p));

  if (!bundleDir) {
    emit({ type: "status", message: `Bundling ${path.basename(entryPoint)}...` });
    return await bundle({ entryPoint, ...(publicDir ? { publicDir } : {}) });
  }

  const stampFile = path.join(bundleDir, ".stamp");
  const stamp = rustStamp || String(fs.statSync(entryPoint).mtimeMs);
  const cached =
    fs.existsSync(path.join(bundleDir, "index.html")) &&
    fs.existsSync(stampFile) &&
    fs.readFileSync(stampFile, "utf8") === stamp &&
    (!publicDir || fs.existsSync(path.join(bundleDir, "public")));

  if (cached) {
    emit({ type: "status", message: "Reusing Rust-verified cached bundle..." });
    return bundleDir;
  }

  emit({ type: "status", message: `Bundling ${path.basename(entryPoint)}...` });
  const serveUrl = await bundle({ entryPoint, outDir: bundleDir, ...(publicDir ? { publicDir } : {}) });
  fs.writeFileSync(stampFile, stamp);
  return serveUrl;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  let outputLocation = args.output;
  if (!outputLocation) {
    const outputDir = path.resolve(process.cwd(), "output");
    fs.mkdirSync(outputDir, { recursive: true });
    outputLocation = path.join(outputDir, `nexus-${Date.now()}.mp4`);
  } else {
    fs.mkdirSync(path.dirname(path.resolve(outputLocation)), { recursive: true });
  }

  const detectedBrowser = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].find((p) => fs.existsSync(p));

  const browserExecutable = args.browser || detectedBrowser || null;

  let frameRange = undefined;
  if (args.frames && args.frames.includes("-")) {
    const [s, e] = args.frames.split("-").map((n) => Number.parseInt(n, 10));
    if (!Number.isNaN(s) && !Number.isNaN(e) && e >= s) {
      frameRange = [s, e];
    }
  }

  // Prefer Aetheria Single-File HTML Engine when workspace/index.html exists
  const htmlCandidate = args.html
    ? path.resolve(args.html)
    : path.resolve(process.cwd(), "workspace/index.html");

  if (!args.forceRemotion && fs.existsSync(htmlCandidate)) {
    await renderHtmlFilm({
      htmlPath: htmlCandidate,
      outputLocation,
      browserExecutable,
      frameRange,
      compositionId: args.composition || "SejarahLahirnyaListrik",
    });
    return;
  }

  let inputProps = {};
  try {
    inputProps = JSON.parse(args.props);
  } catch (err) {
    emit({ type: "status", message: `Invalid props JSON (${err.message}), falling back to defaultProps` });
  }

  const workspaceEntryCandidates = [
    path.resolve(process.cwd(), "workspace/src/entry.tsx"),
    path.resolve(process.cwd(), "workspace/src/entry.ts"),
    path.resolve(process.cwd(), "workspace/src/index.tsx"),
    path.resolve(process.cwd(), "workspace/src/index.ts"),
    path.resolve(process.cwd(), "workspace/entry.tsx"),
    path.resolve(process.cwd(), "workspace/entry.ts"),
  ];
  const detectedWorkspaceEntry = workspaceEntryCandidates.find((p) => fs.existsSync(p));
  const entryPoint = args.entry
    ? path.resolve(args.entry)
    : detectedWorkspaceEntry || path.resolve(process.cwd(), "apps/src/remotion/entry.ts");

  if (!fs.existsSync(entryPoint)) {
    throw new Error(`Remotion entry point not found: ${entryPoint}`);
  }

  const concurrency = Math.max(1, Math.min(16, Number.parseInt(args.concurrency, 10) || 4));
  const validCodecs = ["h264", "h265", "vp8", "vp9", "gif", "prores"];
  const codec = validCodecs.includes(args.codec) ? args.codec : "h264";

  emit({
    type: "status",
    message: browserExecutable
      ? `Browser: ${path.basename(browserExecutable)} (${concurrency} threads, ${codec})`
      : "No local browser found, Remotion may download one",
  });

  const serveUrl = await resolveServeUrl(
    entryPoint,
    args.bundleDir ? path.resolve(args.bundleDir) : "",
    args.bundleStamp,
  );

  const puppeteerInstance = await openBrowser("chrome", {
    browserExecutable,
    chromiumOptions: {
      gl: "angle",
    },
  });

  try {
    const compositions = await getCompositions(serveUrl, {
      inputProps,
      browserExecutable,
      puppeteerInstance,
    });
    const composition = args.composition
      ? compositions.find((c) => c.id === args.composition)
      : compositions[0];

    if (!composition) {
      const available = compositions.map((c) => c.id).join(", ") || "(none)";
      throw new Error(`Composition "${args.composition}" not found in Root.tsx. Available compositions: [${available}]`);
    }

    const startFrame = frameRange ? frameRange[0] : 0;
    const endFrame = frameRange ? frameRange[1] : composition.durationInFrames - 1;
    const targetFrames = endFrame - startFrame + 1;
    const ffmpegBin = resolveBundledFfmpeg();
    const explicitShards = args.shards ? Number.parseInt(args.shards, 10) : null;
    const shardCount =
      explicitShards && explicitShards >= 1
        ? explicitShards
        : ffmpegBin && codec === "h264" && targetFrames >= 120
          ? Math.min(4, Math.max(2, Math.floor(concurrency / 2)))
          : 1;

    emit({
      type: "status",
      message: `Rendering ${composition.id} (${shardCount} parallel browser shards)...`,
      compositionId: composition.id,
      totalFrames: targetFrames,
      fps: composition.fps,
    });

    if (shardCount > 1) {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-shards-"));
      const extraBrowsers = [];
      try {
        for (let i = 1; i < shardCount; i++) {
          extraBrowsers.push(
            await openBrowser("chrome", {
              browserExecutable,
              chromiumOptions: { gl: "angle" },
            }),
          );
        }
        const allBrowsers = [puppeteerInstance, ...extraBrowsers];
        const perShard = Math.ceil(targetFrames / shardCount);
        const shardProgress = new Array(shardCount).fill(0);
        const shardFiles = new Array(shardCount);

        await Promise.all(
          allBrowsers.map(async (browserInst, idx) => {
            const s = startFrame + idx * perShard;
            const e = Math.min(endFrame, startFrame + (idx + 1) * perShard - 1);
            const shardOut = path.join(tmpDir, `shard-${idx}.mp4`);
            shardFiles[idx] = shardOut;

            await renderMedia({
              composition,
              serveUrl,
              puppeteerInstance: browserInst,
              codec,
              concurrency: 1,
              frameRange: [s, e],
              outputLocation: shardOut,
              inputProps,
              browserExecutable,
              timeoutInMilliseconds: 120000,
              imageFormat: "jpeg",
              jpegQuality: 82,
              x264Preset: "veryfast",
              chromiumOptions: {
                gl: "angle",
              },
              onProgress: ({ renderedFrames }) => {
                shardProgress[idx] = renderedFrames;
                const totalRendered = shardProgress.reduce((a, b) => a + b, 0);
                const percent = Math.min(100, Math.round((totalRendered / targetFrames) * 100));
                emit({
                  type: "progress",
                  percent,
                  renderedFrames: totalRendered,
                  totalFrames: targetFrames,
                });
              },
            });
          }),
        );

        const listPath = path.join(tmpDir, "concat.txt");
        fs.writeFileSync(
          listPath,
          shardFiles.map((f) => `file '${f.replace(/\\/g, "/")}'`).join("\n"),
          "utf8",
        );
        execFileSync(ffmpegBin, [
          "-y",
          "-hide_banner",
          "-loglevel",
          "error",
          "-f",
          "concat",
          "-safe",
          "0",
          "-i",
          listPath,
          "-c",
          "copy",
          path.resolve(outputLocation),
        ]);
      } finally {
        await Promise.all(
          extraBrowsers.map((b) => b.close({ silent: true }).catch(() => {})),
        );
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    } else {
      await renderMedia({
        composition,
        serveUrl,
        puppeteerInstance,
        codec,
        concurrency: Math.min(2, concurrency),
        frameRange,
        outputLocation,
        inputProps,
        browserExecutable,
        timeoutInMilliseconds: 120000,
        imageFormat: "jpeg",
        jpegQuality: 80,
        x264Preset: "ultrafast",
        chromiumOptions: {
          gl: "angle",
        },
        onProgress: ({ renderedFrames }) => {
          const percent = Math.min(100, Math.round((renderedFrames / targetFrames) * 100));
          emit({ type: "progress", percent, renderedFrames, totalFrames: targetFrames });
        },
      });
    }

    emit({ type: "done", compositionId: composition.id, outputPath: outputLocation });
  } finally {
    await puppeteerInstance.close({ silent: true }).catch(() => {});
  }
}

main().catch((err) => {
  emit({ type: "error", error: err.message || String(err) });
  process.exit(1);
});

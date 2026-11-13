const { spawn, execSync } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');

const LAUNCH_START_MS = Date.now();
function formatElapsed(fromMs = LAUNCH_START_MS) {
  const elapsedMs = Date.now() - fromMs;
  const totalSec = (elapsedMs / 1000).toFixed(2);
  const mins = Math.floor(elapsedMs / 60000);
  const remSec = ((elapsedMs % 60000) / 1000).toFixed(2);
  return mins > 0
    ? `${totalSec}s (${mins}m ${remSec}s)`
    : `${totalSec}s (${(elapsedMs / 60000).toFixed(2)} menit)`;
}

// This file is skip-worktree (machine-local launcher tuning), so the security it wires up lives in a
// tracked module instead - see scripts/server-auth.cjs for why that matters.
const serverAuth = require('./server-auth.cjs');
const auth = serverAuth.create();

const processes = [];
const bun = 'bun';

const crashCounts = new Map();
const MAX_CONSECUTIVE_CRASHES = 3;
const STABLE_RUN_THRESHOLD_MS = 15000;

// Default to pure Local Bundle + Electron IPC mode (no Vite HTTP :5173 overhead).
// Pass `--hmr` or set `AETHERIA_USE_VITE=1` only if live Vite HMR server is explicitly desired.
const useViteHttp = process.argv.includes('--hmr') || process.env.AETHERIA_USE_VITE === '1';

function sleepSync(ms) {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch {
    const end = Date.now() + ms;
    while (Date.now() < end) {}
  }
}

function cleanStaleEngineProcesses(repoDir) {
  const isWin = process.platform === 'win32';
  const normalizedRepo = (repoDir || process.cwd()).replace(/\\/g, '/').toLowerCase();

  if (isWin) {
    try {
      // Fast check via WMIC/CIM without slow startup
      const script = "Get-CimInstance Win32_Process -Filter \"Name = 'bun.exe'\" | Select-Object ProcessId, CommandLine | ConvertTo-Json -Compress";
      const stdout = execSync(`powershell -NoProfile -NonInteractive -Command "${script}"`, {
        stdio: ['pipe', 'pipe', 'ignore'],
        windowsHide: true,
        encoding: 'utf8',
        timeout: 6000,
      }).trim();
      if (!stdout) return;
      const parsed = JSON.parse(stdout);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      let killedAny = false;
      for (const item of list) {
        if (!item || !item.ProcessId || !item.CommandLine) continue;
        const pid = Number(item.ProcessId);
        if (pid === process.pid) continue;
        const cmd = item.CommandLine.replace(/\\/g, '/').toLowerCase();
        if (cmd.includes(normalizedRepo) || cmd.includes('serve-only.ts')) {
          console.log(`[dev-app] Cleaning stale Aetheria engine process (PID ${pid})...`);
          try {
            execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore', windowsHide: true });
            killedAny = true;
          } catch {}
        }
      }
      if (killedAny) sleepSync(400);
    } catch {}
  } else {
    try {
      const stdout = execSync('ps -eo pid,command', { stdio: ['pipe', 'pipe', 'ignore'], encoding: 'utf8', timeout: 5000 });
      for (const line of stdout.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const parts = trimmed.split(/\s+/);
        const pid = parseInt(parts[0], 10);
        if (pid === process.pid) continue;
        const cmd = parts.slice(1).join(' ').toLowerCase();
        if (cmd.includes('bun') && (cmd.includes(normalizedRepo) || cmd.includes('serve-only.ts'))) {
          console.log(`[dev-app] Cleaning stale Aetheria engine process (PID ${pid})...`);
          try { process.kill(pid, 'SIGKILL'); } catch {}
        }
      }
    } catch {}
  }
}

function freePorts(ports) {
  try {
    if (process.platform === 'win32') {
      const stdout = execSync('netstat -ano', { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true }).toString();
      const lines = stdout.split('\n');
      const pidsToKill = new Set();
      const portSet = new Set(ports.map(p => `:${p}`));

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5 && parts[3] === 'LISTENING') {
          const addr = parts[1];
          for (const p of portSet) {
            if (addr.endsWith(p)) {
              const pid = parts[4];
              if (pid && pid !== '0' && pid !== String(process.pid)) {
                pidsToKill.add(pid);
              }
            }
          }
        }
      }

      for (const pid of pidsToKill) {
        console.log(`[dev-app] Cleaning zombie process PID ${pid}...`);
        try { execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore', windowsHide: true }); } catch {}
      }
      if (pidsToKill.size > 0) sleepSync(400);
    }
  } catch {}
}

function freePort(port) {
  freePorts([port]);
}

function start(name, command, args = [], options = {}) {
  const isWin = process.platform === 'win32';
  let child;
  // Node 24 on Windows: passing array args with shell: true triggers DEP0190 warning.
  // bun.exe is a standalone binary and can run with shell: false.
  // npm requires shell on Windows, so we format as a single string to avoid DEP0190.
  if (isWin && command === 'npm') {
    const fullCmd = [command, ...args].join(' ');
    child = spawn(fullCmd, {
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...options.env },
      stdio: 'inherit',
      windowsHide: options.windowsHide ?? true,
      shell: true,
    });
  } else {
    child = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...options.env },
      stdio: 'inherit',
      windowsHide: options.windowsHide ?? true,
      shell: false,
    });
  }
  processes.push(child);

  // If the process survives STABLE_RUN_THRESHOLD_MS without crashing, reset its crash counter
  const stableTimer = setTimeout(() => {
    crashCounts.set(name, 0);
  }, STABLE_RUN_THRESHOLD_MS);

  child.on('exit', (code, signal) => {
    clearTimeout(stableTimer);
    if (code !== 0 && signal !== 'SIGTERM' && signal !== 'SIGKILL') {
      const crashes = (crashCounts.get(name) || 0) + 1;
      crashCounts.set(name, crashes);
      console.error(`[dev-app] ${name} exited unexpectedly (${code ?? signal}) [crash ${crashes}/${MAX_CONSECUTIVE_CRASHES}]`);

      if (crashes >= MAX_CONSECUTIVE_CRASHES) {
        console.error(`\n[dev-app] ========================================================`);
        console.error(`[dev-app] FATAL: ${name} crashed ${crashes} times consecutively.`);
        console.error(`[dev-app] Giving up auto-restart to prevent cascading resource lock.`);
        console.error(`[dev-app] Please inspect the error messages above.`);
        console.error(`[dev-app] ========================================================\n`);
        stopAll();
        process.exit(1);
      }

      if (options.restartOnCrash) {
        console.log(`[dev-app] Auto-restarting ${name} (attempt ${crashes}/${MAX_CONSECUTIVE_CRASHES}) in 2s...`);
        setTimeout(() => {
          if (options.port) freePort(options.port);
          if (name === 'Engine') cleanStaleEngineProcesses(process.cwd());
          const newChild = start(name, command, args, options);
          if (options.onRestart) options.onRestart(newChild);
        }, 2000);
      }
    }
  });
  return child;
}

function stopAll() {
  for (const child of processes) {
    if (child && child.pid && !child.killed) {
      if (process.platform === 'win32') {
        try { execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: 'ignore', windowsHide: true }); } catch {}
      } else {
        child.kill('SIGKILL');
      }
    }
  }
  cleanStaleEngineProcesses(process.cwd());
}

function waitForPort(url, timeoutMs = 30000, intervalMs = 300) {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(res.statusCode && res.statusCode < 500);
      });
      req.on('error', () => retry());
      req.setTimeout(2000, () => { req.destroy(); retry(); });
    };
    const retry = () => {
      if (Date.now() - start >= timeoutMs) { resolve(false); return; }
      setTimeout(check, intervalMs);
    };
    check();
  });
}

process.on('SIGINT', () => { stopAll(); process.exit(0); });
process.on('SIGTERM', () => { stopAll(); process.exit(0); });

(async () => {
  const rootDir = process.cwd();
  console.log(`\n================================================================`);
  console.log(`[⏱️ 0.00s] [dev-app] Memulai perhitungan waktu launch Aetheria (Mode IPC + Local Bundle)...`);
  console.log(`================================================================`);

  // 0. Clean zombie processes & stale repo bun instances
  const cleanStartMs = Date.now();
  try { if (process.platform === 'win32') execSync('taskkill /F /IM electron.exe', { stdio: 'ignore', windowsHide: true }); } catch {}
  cleanStaleEngineProcesses(rootDir);
  freePorts(useViteHttp ? [4096, 5173, 3000, 20188] : [4096, 20188]);
  console.log(`[⏱️ +${formatElapsed()}] [dev-app] Pembersihan proses & port selesai (durasi tahap: ${formatElapsed(cleanStartMs)})`);

  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    const agyBin = path.join(process.env.LOCALAPPDATA, 'agy', 'bin');
    if (!process.env.PATH.includes(agyBin)) {
      process.env.PATH = `${agyBin};${process.env.PATH}`;
    }
  }

  // Ensure apps/desktop/web has the built bundle if running in pure IPC bundle mode
  const webDistIndex = path.join(rootDir, 'apps', 'web', 'dist', 'index.html');
  const desktopWebIndex = path.join(rootDir, 'apps', 'desktop', 'web', 'index.html');
  if (!useViteHttp && !fs.existsSync(desktopWebIndex) && fs.existsSync(webDistIndex)) {
    fs.cpSync(path.join(rootDir, 'apps', 'web', 'dist'), path.join(rootDir, 'apps', 'desktop', 'web'), { recursive: true });
  }

  // 1. Start Engine (Native Rust by default, Bun as fallback)
  const servicesStartMs = Date.now();
  const useBunFallback = process.env.AETHERIA_USE_BUN_ENGINE === '1';
  const exeExt = process.platform === 'win32' ? '.exe' : '';
  const pickNewestExisting = (paths) => {
    const existing = paths.filter((p) => fs.existsSync(p));
    existing.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    return existing[0] || null;
  };
  const rustCandidates = [
    path.join(rootDir, 'target', 'debug', `aetheria-engine${exeExt}`),
    path.join(rootDir, 'target', 'release', `aetheria-engine${exeExt}`),
    path.join(rootDir, 'apps', 'desktop', 'resources', `engine${exeExt}`),
    path.join(rootDir, 'target', 'release', `aetheria${exeExt}`),
  ];
  const rustBin = !useBunFallback ? pickNewestExisting(rustCandidates) : null;

  let engineChild = null;
  if (rustBin) {
    console.log(`[⏱️ +${formatElapsed()}] [dev-app] Menjalankan Native Rust Aetheria Engine (${path.basename(rustBin)}) pada :4096...`);
    engineChild = start('Engine', rustBin, ['serve', '--port', '4096'], {
      restartOnCrash: true,
      port: 4096,
      env: auth.engineEnv,
      onRestart: (c) => { engineChild = c; },
    });
  } else {
    console.log(`[⏱️ +${formatElapsed()}] [dev-app] aetheria-engine belum di-compile, melakukan cargo build (debug)...`);
    execSync('cargo build -p aetheria-engine --bin aetheria-engine', { cwd: rootDir, stdio: 'inherit' });
    const compiledBin = path.join(rootDir, 'target', 'debug', `aetheria-engine${exeExt}`);
    engineChild = start('Engine', compiledBin, ['serve', '--port', '4096'], {
      restartOnCrash: true,
      port: 4096,
      env: auth.engineEnv,
      onRestart: (c) => { engineChild = c; },
    });
  }

  if (useViteHttp) {
    console.log(`[⏱️ +${formatElapsed()}] [dev-app] Menjalankan Vite HMR Server (:5173)...`);
    const viteBin = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');
    if (fs.existsSync(viteBin)) {
      start('Web', process.execPath, [viteBin], {
        cwd: path.join(rootDir, 'apps', 'web'),
        restartOnCrash: true,
        port: 5173,
        env: auth.clientEnv,
      });
    } else {
      start('Web', 'npm', ['run', 'dev'], {
        cwd: path.join(rootDir, 'apps', 'web'),
        restartOnCrash: true,
        port: 5173,
        env: auth.clientEnv,
      });
    }
  }

  // Wait for Engine (and Vite only if --hmr was requested)
  const [engineReady, webReady] = await Promise.all([
    waitForPort('http://127.0.0.1:4096/api/health', 90000, 250).then((ok) => {
      if (ok) {
        console.log(`[⏱️ +${formatElapsed()}] [dev-app] ✅ Engine siap! (durasi tahap: ${formatElapsed(servicesStartMs)})`);
      }
      return ok;
    }),
    useViteHttp
      ? waitForPort('http://127.0.0.1:5173', 45000, 250).then((ok) => {
          if (ok) {
            console.log(`[⏱️ +${formatElapsed()}] [dev-app] ✅ Vite Web (:5173) siap! (durasi tahap: ${formatElapsed(servicesStartMs)})`);
          }
          return ok;
        })
      : Promise.resolve(true),
  ]);

  if (!engineReady) {
    console.error(`[⏱️ +${formatElapsed()}] [dev-app] FAILED: Engine not ready after timeout. Aborting.`);
    stopAll();
    process.exit(1);
  }
  if (!webReady) {
    console.error(`[⏱️ +${formatElapsed()}] [dev-app] FAILED: Vite not ready after timeout. Aborting.`);
    stopAll();
    process.exit(1);
  }

  // Start Native Rust Desktop (WebView2)
  console.log(`[⏱️ +${formatElapsed()}] [dev-app] Menjalankan Native Rust Desktop (WebView2)... (0 Electron / Pure Native)`);
  const rustDesktopCandidates = [
    path.join(rootDir, 'target', 'debug', 'aetheria-desktop' + exeExt),
    path.join(rootDir, 'target', 'debug', 'aetheria' + exeExt),
    path.join(rootDir, 'target', 'release', 'aetheria' + exeExt),
    path.join(rootDir, 'target', 'release', 'aetheria-engine' + exeExt),
  ];
  const desktopBin = pickNewestExisting(rustDesktopCandidates);
  const desktopEnv = {
    ...auth.engineEnv,
    AETHERIA_ENGINE_URL: 'http://127.0.0.1:4096',
    AETHERIA_LAUNCH_START_MS: String(LAUNCH_START_MS),
    AETHERIA_ENGINE_VERIFIED: '1',
    ...(useViteHttp ? { AETHERIA_WEB_URL: 'http://127.0.0.1:5173' } : {}),
  };

  if (desktopBin) {
    const desktopChild = start('Desktop', desktopBin, [], {
      cwd: rootDir,
      restartOnCrash: false,
      windowsHide: false,
      env: desktopEnv,
    });
    desktopChild.on('exit', () => {
      stopAll();
      process.exit(0);
    });
  } else {
    console.error('Binary native desktop tidak ditemukan. Silakan jalankan: npm run tauri:dev atau cargo build --bin aetheria-engine');
  }

  // Keep parent alive so child processes aren't killed
  console.log(`[⏱️ +${formatElapsed()}] [dev-app] Menunggu jendela WebView2 menampilkan UI... (Tekan Ctrl+C untuk berhenti)`);
  await new Promise(() => {}); // hang forever
})();

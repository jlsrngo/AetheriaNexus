// Driver helpers to configure, start, restart, and drive live OpenCode instances
// for recording canonical golden parity NDJSON fixtures.
import fs from "node:fs";
import path from "node:path";
import { execSync, spawn } from "node:child_process";

export function buildOpenCodeConfig(providerUrl, { backgroundCompaction = false, extra = {} } = {}) {
  return {
    "$schema": "https://opencode.ai/config.json",
    ...(backgroundCompaction ? { experimental: { background_compaction: true } } : {}),
    agent: {
      subGen: { mode: "subagent", description: "General subagent" },
      agentB: { mode: "subagent", description: "Agent B", model: "parity/model-b" },
      capped3: { mode: "all", description: "Max 3 steps agent", steps: 3 },
      roParent: {
        mode: "all",
        description: "Read-only parent",
        permission: { "*": "allow", write: "deny", edit: "deny" },
      },
    },
    providers: {
      parity: {
        name: "Parity Fake Provider",
        package: "@opencode/ai/providers/openai-compatible",
        settings: { baseURL: providerUrl, apiKey: "parity" },
        models: {
          "parity-model": {
            name: "parity-model",
            limit: { context: 128000, output: 16000 },
            cost: [
              { input: 1, output: 2, cache: { read: 0.1, write: 0.2 } },
              { tier: { type: "context", size: 200000 }, input: 2, output: 4, cache: { read: 0.2, write: 0.4 } },
            ],
          },
          "clip-model": { name: "clip-model", limit: { context: 25000, output: 2000 } },
          "model-b": { name: "model-b", limit: { context: 128000, output: 16000 } },
          "model-c": { name: "model-c", limit: { context: 128000, output: 16000 } },
        },
      },
      "parity-timeout": {
        name: "Parity Timeout Provider",
        package: "@opencode/ai/providers/openai-compatible",
        settings: { baseURL: providerUrl, apiKey: "parity", timeout: 350, headerTimeout: 350 },
        models: { "parity-model": { name: "parity-model", limit: { context: 128000, output: 16000 } } },
      },
      "parity-unreachable": {
        name: "Parity Unreachable Provider",
        package: "@opencode/ai/providers/openai-compatible",
        settings: { baseURL: "http://no-such-host-parity.invalid/v1", apiKey: "parity" },
        models: { "parity-model": { name: "parity-model", limit: { context: 128000, output: 16000 } } },
      },
      "parity-p1": {
        name: "Parity Parallel 1",
        package: "@opencode/ai/providers/openai-compatible",
        settings: { baseURL: providerUrl, apiKey: "parity" },
        models: { m1: { name: "m1", limit: { context: 128000, output: 16000 } } },
      },
      "parity-p2": {
        name: "Parity Parallel 2",
        package: "@opencode/ai/providers/openai-compatible",
        settings: { baseURL: providerUrl, apiKey: "parity" },
        models: { m2: { name: "m2", limit: { context: 128000, output: 16000 } } },
      },
      "parity-p3": {
        name: "Parity Parallel 3",
        package: "@opencode/ai/providers/openai-compatible",
        settings: { baseURL: providerUrl, apiKey: "parity" },
        models: { m3: { name: "m3", limit: { context: 128000, output: 16000 } } },
      },
    },
    ...extra,
  };
}

export async function startOpenCodeServer({
  opencodeDir,
  home,
  password,
  config,
  service = false,
  flags = [],
  startupTimeoutMs = 30_000,
}) {
  if (!fs.existsSync(path.join(opencodeDir, "package.json"))) {
    throw new Error(`OpenCode directory not found: ${opencodeDir}`);
  }
  const configDir = path.join(home, "opencode-cfg");
  fs.mkdirSync(configDir, { recursive: true });
  if (service) {
    for (const file of ["service.json", "service-local.json"]) {
      fs.writeFileSync(path.join(configDir, file), JSON.stringify({ hostname: "127.0.0.1", password }));
    }
  }
  const serveArgs = ["run", "--cwd", "packages/cli", "src/index.ts", "serve"];
  if (service) serveArgs.push("--service");
  serveArgs.push("--hostname", "127.0.0.1", "--port", "0");

  const child = spawn("bun", serveArgs, {
    cwd: opencodeDir,
    env: {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      APPDATA: path.join(home, "AppData", "Roaming"),
      LOCALAPPDATA: path.join(home, "AppData", "Local"),
      XDG_CONFIG_HOME: path.join(home, ".config"),
      XDG_STATE_HOME: path.join(home, ".local", "state"),
      XDG_DATA_HOME: path.join(home, ".local", "share"),
      OPENCODE_CONFIG_DIR: configDir,
      OPENCODE_PASSWORD: password,
      OPENCODE_CONFIG_CONTENT: JSON.stringify(config),
      OPENCODE_DISABLE_MODELS_FETCH: "1",
      OPENCODE_PRINT_LOGS: "1",
      ...(flags.length ? { OPENCODE_FLAGS: flags.join(",") } : {}),
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  let output = "";
  const collect = (chunk) => {
    output += chunk.toString();
    if (output.length > 40_000) output = output.slice(-40_000);
  };
  child.stdout.on("data", collect);
  child.stderr.on("data", collect);

  const deadline = Date.now() + startupTimeoutMs;
  while (Date.now() < deadline) {
    const match = output.match(/server listening on (https?:\/\/[^\s\r\n]+)/);
    if (match) return { process: child, url: match[1].replace(/\/$/, ""), output: () => output };
    if (child.exitCode !== null) break;
    await sleep(100);
  }
  await stopProcess(child, true);
  throw new Error(`OpenCode server did not start.\n${output}`);
}

export async function stopProcess(child, force = false) {
  if (!child || child.exitCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  if (process.platform === "win32" && child.pid) {
    try {
      execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: "ignore", windowsHide: true });
    } catch {
      try { child.kill("SIGKILL"); } catch {}
    }
    await Promise.race([exited, sleep(2_000)]);
    return;
  }
  child.kill(force ? "SIGKILL" : "SIGTERM");
  await Promise.race([exited, sleep(3_000)]);
  if (child.exitCode === null) {
    const exitedForce = new Promise((resolve) => child.once("exit", resolve));
    child.kill("SIGKILL");
    await Promise.race([exitedForce, sleep(2_000)]);
  }
}

export function subscribeEvents(baseURL, auth, workspace, sink, sessionFilter = null) {
  const controller = new AbortController();
  let resolveReady;
  const ready = new Promise((resolve) => { resolveReady = resolve; });
  (async () => {
    const response = await fetch(`${baseURL}/api/event?directory=${encodeURIComponent(workspace)}`, {
      headers: { authorization: auth, accept: "text/event-stream" },
      signal: controller.signal,
    }).catch(() => null);
    if (!response?.body) {
      resolveReady();
      return;
    }
    resolveReady();
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read().catch(() => ({ done: true }));
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      let boundary;
      while ((boundary = buffer.indexOf("\n\n")) >= 0) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = frame.split(/\r?\n/).find((line) => line.startsWith("data:"));
        if (!data) continue;
        try {
          const event = JSON.parse(data.slice(5).trim());
          const owner = event.data?.sessionID ?? event.properties?.sessionID;
          if (sessionFilter && owner && !sessionFilter(owner)) continue;
          sink.push(event);
        } catch {
          // Ignore comments and malformed frames; server event stream remains live.
        }
      }
    }
  })();
  return { ready, abort: () => controller.abort() };
}

export const TERMINAL_TYPES = new Set([
  "session.execution.succeeded",
  "session.execution.failed",
  "session.execution.interrupted",
]);

export async function waitForTerminalCount(events, sessionID, count, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const n = events.filter((e) => {
      const data = e.data ?? e.properties ?? {};
      return data.sessionID === sessionID && TERMINAL_TYPES.has(e.type);
    }).length;
    if (n >= count) return true;
    await sleep(40);
  }
  return false;
}

export async function waitForCondition(predicate, timeoutMs, intervalMs = 40) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await sleep(intervalMs);
  }
  return false;
}

export function rmDirRetry(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  } catch {
    // Best effort temp dir cleanup on Windows.
  }
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


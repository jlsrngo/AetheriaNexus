import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawn, execSync } from "node:child_process";

function repoRootDir() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

function resolveEngineBinary(repoRoot) {
  const exe = process.platform === "win32" ? "aetheria-engine.exe" : "aetheria-engine";
  const candidates = [
    path.join(repoRoot, "target", "debug", exe),
    path.join(repoRoot, "target", "release", exe),
  ].filter((p) => fs.existsSync(p));

  if (candidates.length === 0) {
    throw new Error(
      `aetheria-engine binary not found under target/debug or target/release. Run "cargo build --bin aetheria-engine" first.`,
    );
  }
  // Pick the most recently compiled binary so tests always hit fresh changes.
  candidates.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return candidates[0];
}

function killProcessTree(child) {
  if (!child || child.pid === undefined) return;
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: "ignore", windowsHide: true });
    } else {
      child.kill("SIGKILL");
    }
  } catch {
    // Process may have already exited.
  }
}

async function waitForHttpOk(url, check, headers = {}, timeoutMs = 30_000, onCheckFail) {
  const deadline = Date.now() + timeoutMs;
  let lastErr = "no response";
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(2000) });
      const txt = await res.text();
      if (check(res, txt)) return;
      lastErr = `status=${res.status} body=${txt.slice(0, 120)}`;
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  const extra = onCheckFail ? `\nLogs:\n${onCheckFail()}` : "";
  throw new Error(`Timed out waiting for ${url}: ${lastErr}${extra}`);
}

async function startMockLlmServer() {
  let failMessage = null;
  let exploreDelayMs = 2000;
  const counts = {
    parentInitial: 0,
    parentWake: 0,
    subagentExplore: 0,
    subagentAudio: 0,
  };

  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", async () => {
      if (req.url?.endsWith("/models")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ data: [{ id: "e2e-fast", object: "model" }] }));
        return;
      }

      let payload = {};
      try {
        payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: { message: "Invalid JSON payload" } }));
        return;
      }

      if (failMessage) {
        const msg = failMessage;
        failMessage = null;
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: { message: msg } }));
        return;
      }

      const msgs = Array.isArray(payload.messages) ? payload.messages : [];
      const tools = Array.isArray(payload.tools) ? payload.tools : [];
      const hasTaskTool = tools.some((t) => (t.function?.name || t.name) === "task");
      const hasToolOutput = msgs.some((m) => m.role === "tool");
      const lastMsg = msgs[msgs.length - 1];
      const lastText =
        typeof lastMsg?.content === "string"
          ? lastMsg.content
          : JSON.stringify(lastMsg?.content ?? "");
      const joinedMsgs = JSON.stringify(msgs);

      if (hasTaskTool) {
        if (lastText.includes("<subagent-notification")) {
          counts.parentWake += 1;
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              choices: [
                {
                  finish_reason: "stop",
                  message: {
                    role: "assistant",
                    content: `Laporan wakeup (#${counts.parentWake}): Semua tugas subagent selesai dengan aman.`,
                  },
                },
              ],
            }),
          );
          return;
        }

        if (hasToolOutput) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              choices: [
                {
                  finish_reason: "stop",
                  message: {
                    role: "assistant",
                    content:
                      "Dua subagent latar belakang telah dimulai secara paralel. Silakan tunggu atau lanjutkan instruksi lain.",
                  },
                },
              ],
            }),
          );
          return;
        }

        counts.parentInitial += 1;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            choices: [
              {
                finish_reason: "tool_calls",
                message: {
                  role: "assistant",
                  content: "",
                  tool_calls: [
                    {
                      id: "call_task_explore",
                      type: "function",
                      function: {
                        name: "task",
                        arguments: JSON.stringify({
                          subagent_type: "explore",
                          description: "Riset kode motion",
                          prompt: "Inspect workspace motion setup for scene 1.",
                        }),
                      },
                    },
                    {
                      id: "call_task_audio",
                      type: "function",
                      function: {
                        name: "task",
                        arguments: JSON.stringify({
                          subagent_type: "audio-director",
                          description: "Generate audio scene 1",
                          prompt: "Prepare voiceover track for scene 1.",
                        }),
                      },
                    },
                  ],
                },
              },
            ],
          }),
        );
        return;
      }

      // Child subagent turn
      if (joinedMsgs.includes("Prepare voiceover track for scene 1")) {
        counts.subagentAudio += 1;
        await new Promise((r) => setTimeout(r, 250));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            choices: [
              {
                finish_reason: "stop",
                message: {
                  role: "assistant",
                  content: "Audio scene 1 selesai diproduksi.",
                },
              },
            ],
          }),
        );
        return;
      }

      counts.subagentExplore += 1;
      await new Promise((r) => setTimeout(r, exploreDelayMs));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          choices: [
            {
              finish_reason: "stop",
              message: {
                role: "assistant",
                content: "Riset workspace scene 1 selesai.",
              },
            },
          ],
        }),
      );
    });
  });

  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const addr = server.address();
  if (!addr || typeof addr === "string") {
    throw new Error("Mock LLM server did not bind a TCP port");
  }
  const url = `http://127.0.0.1:${addr.port}/v1`;
  return {
    server,
    controller: {
      url,
      setFailNext: (m) => {
        failMessage = m;
      },
      setExploreDelayMs: (ms) => {
        exploreDelayMs = ms;
      },
      getCallCounts: () => ({ ...counts }),
    },
  };
}

export async function startLiveStack() {
  const repoRoot = repoRootDir();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "aetheria-e2e-"));
  const homeDir = path.join(tempRoot, "home");
  const configDir = path.join(homeDir, ".config", "aetheria-nexus");
  const dataDir = path.join(homeDir, ".local", "share", "aetheria-nexus");
  const appDataLocal = path.join(homeDir, "AppData", "Local");
  const workspaceDir = path.join(tempRoot, "workspace");
  fs.mkdirSync(configDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(appDataLocal, { recursive: true });
  fs.mkdirSync(workspaceDir, { recursive: true });
  fs.writeFileSync(path.join(workspaceDir, "README.md"), "# E2E Workspace\n", "utf8");

  const { server: llmServer, controller: mockLlm } = await startMockLlmServer();

  const aetheriaCfg = {
    provider: {
      "e2e-mock": {
        name: "E2E Mock OpenAI",
        type: "openai",
        options: {
          baseURL: mockLlm.url,
          apiKey: "e2e-test-key",
        },
        models: {
          "e2e-fast": { name: "E2E Fast Model" },
        },
      },
    },
  };
  fs.writeFileSync(path.join(configDir, "aetheria.json"), JSON.stringify(aetheriaCfg, null, 2), "utf8");

  const authUser = "e2e";
  const authPass = crypto.randomBytes(12).toString("base64url");
  const authHeader = `Basic ${Buffer.from(`${authUser}:${authPass}`).toString("base64")}`;

  const dotDir = path.join(homeDir, ".aetheria");
  fs.mkdirSync(dotDir, { recursive: true });
  fs.writeFileSync(path.join(dotDir, "dev-server-password"), `${authUser}:${authPass}`, "utf8");

  const engineBin = resolveEngineBinary(repoRoot);
  let engineLogBuf = "";
  const engineChild = spawn(engineBin, ["serve", "--port", "4196"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      USERPROFILE: homeDir,
      HOME: homeDir,
      XDG_CONFIG_HOME: path.join(homeDir, ".config"),
      XDG_DATA_HOME: path.join(homeDir, ".local", "share"),
      LOCALAPPDATA: appDataLocal,
      AETHERIA_ROOT: repoRoot,
      AETHERIA_HEADLESS: "1",
      Aetheria_SERVER_USERNAME: authUser,
      AETHERIA_SERVER_USERNAME: authUser,
      Aetheria_SERVER_PASSWORD: authPass,
      AETHERIA_SERVER_PASSWORD: authPass,
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    shell: false,
  });
  engineChild.stdout?.on("data", (d) => {
    engineLogBuf += d.toString("utf8");
  });
  engineChild.stderr?.on("data", (d) => {
    engineLogBuf += d.toString("utf8");
  });

  const engineUrl = "http://127.0.0.1:4196";
  await waitForHttpOk(
    `${engineUrl}/api/health`,
    (res, txt) => res.ok && txt.includes(`"healthy":true`),
    { Authorization: authHeader },
    30_000,
    () => engineLogBuf,
  );

  const webUrl = "http://127.0.0.1:5173";
  let webLogBuf = "";
  const webChild =
    process.platform === "win32"
      ? spawn("cmd.exe", ["/d", "/s", "/c", "npm run dev:web"], {
          cwd: repoRoot,
          env: {
            ...process.env,
            VITE_AETHERIA_SERVER_USER: authUser,
            VITE_AETHERIA_SERVER_PASSWORD: authPass,
          },
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
          shell: false,
        })
      : spawn("npm", ["run", "dev:web"], {
          cwd: repoRoot,
          env: {
            ...process.env,
            VITE_AETHERIA_SERVER_USER: authUser,
            VITE_AETHERIA_SERVER_PASSWORD: authPass,
          },
          stdio: ["ignore", "pipe", "pipe"],
          shell: false,
        });
  webChild.stdout?.on("data", (d) => {
    webLogBuf += d.toString("utf8");
  });
  webChild.stderr?.on("data", (d) => {
    webLogBuf += d.toString("utf8");
  });

  await waitForHttpOk(webUrl, (res) => res.ok, {}, 30_000, () => webLogBuf);

  const screenshotDir = process.env.AETHERIA_E2E_SCREENSHOT_DIR || null;
  if (screenshotDir) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  return {
    repoRoot,
    tempRoot,
    homeDir,
    workspaceDir,
    engineUrl,
    webUrl,
    authHeader,
    screenshotDir,
    mockLlm,
    engineLogs: () => engineLogBuf,
    stop: async () => {
      killProcessTree(webChild);
      killProcessTree(engineChild);
      await new Promise((resolve) => llmServer.close(() => resolve()));
      await new Promise((r) => setTimeout(r, 300));
      fs.rmSync(tempRoot, { recursive: true, force: true });
    },
  };
}


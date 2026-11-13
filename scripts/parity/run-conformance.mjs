// E2E conformance runner: drives a live Aetheria engine against the fake provider,
// writes actual/<ID>.ndjson for all 58 scenarios, and compares against golden or spec expectations.
// Usage: node scripts/parity/run-conformance.mjs [--golden scripts/parity/golden] [--only K01,K02] [--shuffle 42] [--report-dir scripts/parity/report]
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { execSync, spawn } from "node:child_process";
import { startFakeProvider } from "./fake-provider.mjs";
import { resolveEngineBinary, startLiveStack } from "../../e2e/live-stack.mjs";
import { normalizeEvents, stripVolatile } from "./normalize.mjs";
import { matchSequence, describe } from "./lib/assert.mjs";
import {
  compareScenarioNdjson,
  readGoldenOracleLabel,
  seededShuffle,
  writeParityReport,
} from "./diff-report.mjs";
import { scenarios } from "./lib/scenarios.mjs";

const args = parseArgs(process.argv.slice(2));
const providerId = String(args["provider-id"] ?? "parity");
const model = String(args.model ?? "parity-model");
const only = args.only ? new Set(String(args.only).split(",")) : null;
const defaultTimeoutMs = Number(args.timeout ?? 25_000);
const goldenDir = args.golden ? path.resolve(String(args.golden)) : null;
const actualDir = path.resolve(String(args.actual ?? path.join(process.cwd(), "scripts", "parity", "actual")));
const reportDir = path.resolve(String(args["report-dir"] ?? path.join(process.cwd(), "scripts", "parity", "report")));

const provider = await startFakeProvider();
const aetheriaConfig = buildAetheriaConfig(provider.url, providerId, model);

let engine;
let workspace;
let authHeader;
let stack = null;
let ownWorkspace = null;

if (args.engine) {
  engine = String(args.engine).replace(/\/$/, "");
  const auth = resolveAuth();
  if (!auth) {
    console.error(`No credentials for ${engine}. Set AETHERIA_SERVER_USERNAME/PASSWORD or create ~/.aetheria/dev-server-password.`);
    await provider.close();
    process.exit(2);
  }
  authHeader = "Basic " + Buffer.from(`${auth.user}:${auth.pass}`).toString("base64");
  workspace = args.dir ?? (ownWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "parity-ws-")));
} else {
  try {
    stack = await startLiveStack({ aetheriaConfig, startWeb: false });
  } catch (err) {
    await provider.close();
    console.error(`Cannot start isolated engine: ${err.message}`);
    process.exit(2);
  }
  engine = stack.engineUrl;
  workspace = args.dir ?? stack.workspaceDir;
  authHeader = stack.authHeader;
}

fs.mkdirSync(actualDir, { recursive: true });
let orderedList = scenarios.filter((s) => !only || only.has(s.id));
if (args.shuffle !== undefined) {
  const seed = args.shuffle === true ? 1 : Number(args.shuffle);
  orderedList = seededShuffle(orderedList, seed);
}

console.log(`fake provider  ${provider.url}`);
console.log(`engine         ${engine}`);
console.log(`workspace      ${workspace}`);
console.log(`provider/model ${providerId}/${model}${args.shuffle !== undefined ? ` (shuffle=${args.shuffle})` : ""}`);
console.log("");

const results = [];
const runtimeErrors = {};
let priorEngineLogs = "";

try {
  await assertEngineHealthy(engine, authHeader);
  for (const scenario of orderedList) {
    if (stack) {
      const h = await api(engine, authHeader, "/api/health", { signal: AbortSignal.timeout(3_000) }).catch(() => ({ status: 0 }));
      if (h.status !== 200 || h.body?.healthy === false) {
        priorEngineLogs += `${stack.engineLogs()}\n--- [harness] restarting unresponsive engine before ${scenario.id} ---\n`;
        await stack.stop();
        stack = await startLiveStack({ aetheriaConfig, startWeb: false });
        engine = stack.engineUrl;
        workspace = args.dir ?? stack.workspaceDir;
        authHeader = stack.authHeader;
        await assertEngineHealthy(engine, authHeader);
      }
    }
    const res = await runScenario(scenario);
    if (res.runtimeError) runtimeErrors[scenario.id] = res.runtimeError;
    results.push(res.result);
  }
  fs.writeFileSync(path.join(actualDir, "_runtime_checks.json"), JSON.stringify(runtimeErrors, null, 2) + "\n");
} finally {
  const extraFiles = stack ? { "engine.log": `${priorEngineLogs}${stack.engineLogs()}` } : {};
  await provider.close();
  if (stack) await stack.stop();
  if (ownWorkspace) rmDirRetry(ownWorkspace);

  const oracleLabel = goldenDir
    ? readGoldenOracleLabel(goldenDir)
    : "ORACLE spec-derived (pass --golden scripts/parity/golden for canonical parity score)";
  const { passed, total } = writeParityReport(results, { reportDir, oracleLabel, extraFiles });
  process.exit(passed === total ? 0 : 1);
}

function buildAetheriaConfig(baseURL, id, defaultModel, extraPatch = null) {
  const base = {
    agent: {
      subGen: { mode: "subagent", description: "General subagent" },
      agentB: { mode: "subagent", description: "Agent B", model: `${id}/model-b` },
      capped3: { mode: "all", description: "Max 3 steps agent", steps: 3 },
      roParent: {
        mode: "all",
        description: "Read-only parent",
        permission: { "*": "allow", write: "deny", edit: "deny" },
      },
    },
    provider: {
      [id]: {
        npm: "@ai-sdk/openai-compatible",
        name: "Parity Fake Provider",
        options: { baseURL, apiKey: "parity" },
        models: {
          [defaultModel]: {
            name: defaultModel,
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
        npm: "@ai-sdk/openai-compatible",
        name: "Parity Timeout Provider",
        options: { baseURL, apiKey: "parity", timeout: 350 },
        models: { [defaultModel]: { name: defaultModel, limit: { context: 128000, output: 16000 } } },
      },
      "parity-unreachable": {
        npm: "@ai-sdk/openai-compatible",
        name: "Parity Unreachable Provider",
        options: { baseURL: "http://no-such-host-parity.invalid/v1", apiKey: "parity" },
        models: { [defaultModel]: { name: defaultModel, limit: { context: 128000, output: 16000 } } },
      },
      "parity-p1": { npm: "@ai-sdk/openai-compatible", options: { baseURL, apiKey: "parity" }, models: { m1: { name: "m1", limit: { context: 128000, output: 16000 } } } },
      "parity-p2": { npm: "@ai-sdk/openai-compatible", options: { baseURL, apiKey: "parity" }, models: { m2: { name: "m2", limit: { context: 128000, output: 16000 } } } },
      "parity-p3": { npm: "@ai-sdk/openai-compatible", options: { baseURL, apiKey: "parity" }, models: { m3: { name: "m3", limit: { context: 128000, output: 16000 } } } },
    },
  };
  return extraPatch ? { ...base, ...extraPatch } : base;
}

async function runScenario(scenario) {
  const base = { id: scenario.id, ws: scenario.ws, title: scenario.title };
  const scenarioWs = path.join(workspace, scenario.id);
  fs.mkdirSync(scenarioWs, { recursive: true });
  for (const [relPath, text] of Object.entries(scenario.setupFiles ?? {})) {
    const abs = path.join(scenarioWs, relPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  }

  if (scenario.expect?.inboxOrder) {
    const out = await runInboxOrder(scenario, scenarioWs);
    return {
      runtimeError: null,
      result: { ...base, ...out },
    };
  }

  if (scenario.restartScenario && !stack) {
    writeActual(scenario.id, [], [], "restart scenarios require isolated runner (omit --engine)");
    return {
      runtimeError: null,
      result: { ...base, ok: false, status: "FAIL", detail: "restart requires isolated engine mode" },
    };
  }

  if (scenario.restartScenario) {
    return runIsolatedRestartScenario(scenario, scenarioWs, base);
  }

  provider.setScript(scenario.script ?? []);
  const timeoutMs = Math.min(scenario.timeoutMs ?? defaultTimeoutMs, 25_000);
  const targetProvider = scenario.providerId ?? providerId;
  const targetModel = scenario.modelId ?? model;

  let isoStack = null;
  let activeEngine = engine;
  let activeAuth = authHeader;
  let activeWs = scenarioWs;
  let sessionID = null;
  const events = [];
  let abortLatency = null;
  let runnerError = null;

  try {
    if (stack && (scenario.configPatch || scenario.configFlags?.length)) {
      const patch = {
        ...(scenario.configFlags?.includes("background_compaction")
          ? { experimental: { background_compaction: true } }
          : {}),
        ...(scenario.configPatch ?? {}),
      };
      const isoCfg = buildAetheriaConfig(provider.url, providerId, model, patch);
      const isoPort = await getFreePort();
      isoStack = await startLiveStack({ aetheriaConfig: isoCfg, startWeb: false, enginePort: isoPort });
      activeEngine = isoStack.engineUrl;
      activeAuth = isoStack.authHeader;
      activeWs = isoStack.workspaceDir;
      for (const [relPath, text] of Object.entries(scenario.setupFiles ?? {})) {
        const abs = path.join(activeWs, relPath);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, text);
      }
      await assertEngineHealthy(activeEngine, activeAuth);
    }

    sessionID = await createSession(
      activeEngine,
      activeAuth,
      activeWs,
      targetProvider,
      targetModel,
      scenario.agentId,
      scenario.permissions,
    );
    const sse = openEventStream(activeEngine, activeAuth, activeWs, events, sessionID);
    await sleep(30);

    try {
      const prompts = scenario.prompts ?? [scenario.prompt ?? "parity"];
      const expectedTurns = scenario.expectedTurns ?? prompts.length;

      if (scenario.abortAfterMs) {
        setTimeout(() => {
          sse.noteAbortSent();
          api(activeEngine, activeAuth, `/api/session/${sessionID}/abort`, { method: "POST", body: "{}" }).catch(() => {});
        }, scenario.abortAfterMs);
      }
      if (scenario.steer) {
        setTimeout(() => {
          api(activeEngine, activeAuth, `/api/session/${sessionID}/inbox`, {
            method: "POST",
            body: JSON.stringify({ text: scenario.steer.text, delivery: scenario.steer.delivery }),
          }).catch(() => {});
        }, scenario.steer.afterMs ?? 100);
      }

      if (prompts.length > 1) {
        for (let idx = 0; idx < prompts.length; idx++) {
          const prompt = await api(activeEngine, activeAuth, `/api/session/${sessionID}/message`, {
            method: "POST",
            body: JSON.stringify({ text: prompts[idx] }),
          });
          if (prompt.status >= 400) {
            runnerError = `prompt[${idx}] HTTP ${prompt.status}: ${describe(prompt.body)}`;
            break;
          }
          const idled = await waitForIdleCount(events, idx + 1, timeoutMs);
          if (!idled) {
            await api(activeEngine, activeAuth, `/api/session/${sessionID}/abort`, { method: "POST", body: "{}" }).catch(() => {});
            runnerError = `no turn ${idx + 1} idle within ${timeoutMs}ms`;
            break;
          }
        }
      } else {
        const prompt = await api(activeEngine, activeAuth, `/api/session/${sessionID}/message`, {
          method: "POST",
          body: JSON.stringify({ text: prompts[0] }),
        });
        if (prompt.status >= 400) {
          runnerError = `prompt HTTP ${prompt.status}: ${describe(prompt.body)}`;
        } else {
          if (scenario.abortOnTool) {
            const started = await waitForCondition(
              () => events.some((e) => e.type === "session.tool.called" || e.type === "session.next.tool.called" || e.type === "tool.call"),
              Math.min(timeoutMs, 10_000),
            );
            if (started) {
              await sleep(100);
              sse.noteAbortSent();
              await api(activeEngine, activeAuth, `/api/session/${sessionID}/abort`, { method: "POST", body: "{}" }).catch(() => {});
            }
          }
          if (scenario.interruptOnRetry) {
            const seenRetry = await waitForCondition(
              () => events.some((e) => e.type === "session.retry.scheduled" || e.type === "session.retry"),
              Math.min(timeoutMs, 10_000),
            );
            if (seenRetry) {
              await api(activeEngine, activeAuth, `/api/session/${sessionID}/abort`, { method: "POST", body: "{}" }).catch(() => {});
            }
          }
          const idled = await waitForIdleCount(events, expectedTurns, timeoutMs);
          abortLatency = sse.abortLatency();
          if (!idled) {
            await api(activeEngine, activeAuth, `/api/session/${sessionID}/abort`, { method: "POST", body: "{}" }).catch(() => {});
            await sleep(150);
            runnerError = `expected ${expectedTurns} terminal idle event(s) within ${timeoutMs}ms`;
          }
        }
      }
    } finally {
      sse.close();
    }
  } catch (err) {
    runnerError = err instanceof Error ? err.message : String(err);
  } finally {
    if (isoStack) await isoStack.stop();
  }

  const normalized = normalizeEvents(events);
  const requests = provider.requests();
  writeActual(scenario.id, normalized, requests, runnerError);

  return evaluateScenario(scenario, base, { normalized, requests, events, abortLatency, scenarioWs: activeWs, runnerError });
}

async function runIsolatedRestartScenario(scenario, scenarioWs, base) {
  provider.setScript(scenario.script ?? []);
  const isoRoot = fs.mkdtempSync(path.join(os.tmpdir(), `parity-restart-${scenario.id}-`));
  const isoHome = path.join(isoRoot, "home");
  const cfgDir = path.join(isoHome, ".config", "aetheria-nexus");
  fs.mkdirSync(cfgDir, { recursive: true });
  fs.mkdirSync(path.join(isoHome, ".local", "share", "aetheria-nexus"), { recursive: true });
  fs.mkdirSync(path.join(isoHome, "AppData", "Local"), { recursive: true });
  fs.writeFileSync(path.join(cfgDir, "aetheria.json"), JSON.stringify(aetheriaConfig, null, 2));

  const user = "e2e";
  const pass = crypto.randomBytes(12).toString("base64url");
  const isoAuth = "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
  let isoUrl = "";
  const events = [];
  const children = new Set();
  let child = null;
  let runnerError = null;
  let sse = null;

  const boot = async () => {
    const bootPort = await getFreePort();
    isoUrl = `http://127.0.0.1:${bootPort}`;
    child = spawnEngine(isoHome, bootPort, user, pass);
    children.add(child);
    await assertEngineHealthy(isoUrl, isoAuth, 15_000);
  };
  const halt = async (force) => {
    if (sse) sse.close();
    sse = null;
    if (child) {
      const target = child;
      child = null;
      killEngine(target, force);
      const exited = await waitForCondition(() => target.exitCode !== null, 1_500);
      if (!exited) killEngine(target, true);
      children.delete(target);
    }
    await sleep(200);
  };

  try {
    await boot();
    const sessionID = await createSession(isoUrl, isoAuth, scenarioWs, providerId, model);
    sse = openEventStream(isoUrl, isoAuth, scenarioWs, events, sessionID);
    await sleep(30);

    const pRes = await api(isoUrl, isoAuth, `/api/session/${sessionID}/message`, {
      method: "POST",
      body: JSON.stringify({ text: scenario.prompt ?? "parity" }),
    });
    if (pRes.status >= 400) {
      runnerError = `prompt HTTP ${pRes.status}: ${describe(pRes.body)}`;
    } else {
      await waitForCondition(() => provider.requests().length >= 1, 8_000);
      if (scenario.restartScenario.type === "inbox-restart") {
        for (const qText of scenario.restartScenario.queueTexts) {
          await api(isoUrl, isoAuth, `/api/session/${sessionID}/inbox`, {
            method: "POST",
            body: JSON.stringify({ text: qText, delivery: "queue" }),
          });
        }
      }
      const restarts = scenario.restartScenario.restarts ?? 1;
      for (let cycle = 1; cycle <= restarts; cycle++) {
        await sleep(150);
        await halt(scenario.restartScenario.type !== "shutdown-during-tool");
        await boot();
        sse = openEventStream(isoUrl, isoAuth, scenarioWs, events, sessionID);
        if (cycle < restarts) {
          await waitForCondition(() => provider.requests().length >= cycle + 1, 8_000);
        }
      }
      const settled = await waitForCondition(
        () => events.some((e) => e.type === "session.idle" || e.type === "session.execution.succeeded"),
        10_000,
      );
      if (!settled) runnerError = "restart scenario did not settle cleanly within 10000ms";
    }
  } catch (err) {
    runnerError = err instanceof Error ? err.message : String(err);
  } finally {
    if (sse) sse.close();
    for (const target of children) killEngine(target, true);
    rmDirRetry(isoRoot);
  }

  const normalized = normalizeEvents(events);
  const requests = provider.requests();
  writeActual(scenario.id, normalized, requests, runnerError);
  return evaluateScenario(scenario, base, { normalized, requests, events, abortLatency: null, scenarioWs, runnerError });
}

function evaluateScenario(scenario, base, ctx) {
  const { normalized, requests, events, abortLatency, scenarioWs, runnerError } = ctx;
  const gaps = requests.slice(1).map((r, i) => r.at - requests[i].at);
  let runtimeError = null;
  if (scenario.check) runtimeError = scenario.check(normalized, requests, events);
  if (!runtimeError && scenario.expectNoFile && fs.existsSync(path.join(scenarioWs, scenario.expectNoFile))) {
    runtimeError = `forbidden file created: ${scenario.expectNoFile}`;
  }

  const failures = goldenDir
    ? compareScenarioNdjson(scenario.id, goldenDir, actualDir, runtimeError)
    : [...(runnerError ? [runnerError] : []), ...checkExpectations(scenario.expect, { normalized, requests, gaps, abortLatency }), ...(runtimeError ? [runtimeError] : [])];

  return {
    runtimeError,
    result: {
      ...base,
      ok: failures.length === 0,
      status: failures.length === 0 ? "PASS" : "FAIL",
      detail: failures.join("; "),
    },
  };
}

async function runInboxOrder(scenario, scenarioWs) {
  try {
    const sessionID = await createSession(engine, authHeader, scenarioWs, providerId, model);
    for (const text of scenario.expect.inboxOrder) {
      await api(engine, authHeader, `/api/session/${sessionID}/inbox`, { method: "POST", body: JSON.stringify({ text, delivery: "queue" }) });
    }
    const { body } = await api(engine, authHeader, `/api/session/${sessionID}/inbox`);
    const rawItems = body?.data ?? [];
    const items = rawItems.map((it, idx) => stripVolatile({ order: idx + 1, text: it.text ?? it.prompt?.text ?? "" }));
    fs.writeFileSync(path.join(actualDir, `${scenario.id}.ndjson`), JSON.stringify(items) + "\n");
    if (goldenDir) {
      const failures = compareScenarioNdjson(scenario.id, goldenDir, actualDir);
      return { ok: failures.length === 0, status: failures.length === 0 ? "PASS" : "FAIL", detail: failures.join("; ") };
    }
    const ok = JSON.stringify(items.map((x) => x.text)) === JSON.stringify(scenario.expect.inboxOrder);
    return { ok, status: ok ? "PASS" : "FAIL", detail: ok ? "" : `order=${JSON.stringify(items)}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    writeActual(scenario.id, [], [], msg);
    return { ok: false, status: "FAIL", detail: msg };
  }
}

function checkExpectations(expect, { normalized, requests, gaps, abortLatency }) {
  const failures = [];
  if (expect.calls !== undefined && requests.length !== expect.calls) failures.push(`calls=${requests.length}, expected ${expect.calls}`);
  if (expect.callsAtLeast !== undefined && requests.length < expect.callsAtLeast) failures.push(`calls=${requests.length} < ${expect.callsAtLeast}`);
  if (expect.callsAtMost !== undefined && requests.length > expect.callsAtMost) failures.push(`calls=${requests.length} > ${expect.callsAtMost}`);
  if (expect.stream === true && requests.some((r) => !r.stream)) failures.push("some requests sent stream:false");
  if (expect.minGaps) {
    expect.minGaps.forEach((min, i) => {
      if ((gaps[i] ?? 0) < min * 0.8) failures.push(`gap[${i}]=${gaps[i] ?? 0}ms < ${Math.floor(min * 0.8)}ms`);
    });
  }
  if (expect.maxCount) {
    for (const { kind, max } of expect.maxCount) {
      const n = normalized.filter((e) => e.kind === kind).length;
      if (n > max) failures.push(`${kind}=${n} > ${max}`);
    }
  }
  if (expect.noEvents) {
    for (const kind of expect.noEvents) {
      if (normalized.some((e) => e.kind === kind)) failures.push(`unexpected ${kind}`);
    }
  }
  if (expect.events) {
    const match = matchSequence(normalized, expect.events);
    if (!match.ok) failures.push(`missing event ${describe(match.missing)}`);
  }
  if (expect.maxAbortLatencyMs !== undefined && abortLatency !== null && abortLatency > expect.maxAbortLatencyMs) {
    failures.push(`abort latency ${abortLatency}ms > ${expect.maxAbortLatencyMs}ms`);
  }
  return failures;
}

function writeActual(id, normalized, requests, runnerError = null) {
  const lines = [
    ...normalized.map((e, i) => JSON.stringify({ i, ...e })),
    ...requests.map((r, i) => JSON.stringify({ i: `req-${i}`, kind: "provider.request", stream: r.stream, model: r.model })),
    ...(runnerError ? [JSON.stringify({ i: "err", kind: "runner.error", detail: runnerError })] : []),
  ];
  fs.writeFileSync(path.join(actualDir, `${id}.ndjson`), lines.join("\n") + "\n");
}

function spawnEngine(homeDir, port, user, pass) {
  const bin = resolveEngineBinary(process.cwd());
  return spawn(bin, ["serve", "--port", String(port)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOME: homeDir,
      USERPROFILE: homeDir,
      XDG_CONFIG_HOME: path.join(homeDir, ".config"),
      XDG_DATA_HOME: path.join(homeDir, ".local", "share"),
      LOCALAPPDATA: path.join(homeDir, "AppData", "Local"),
      AETHERIA_ROOT: process.cwd(),
      AETHERIA_HEADLESS: "1",
      AETHERIA_SERVER_USERNAME: user,
      Aetheria_SERVER_USERNAME: user,
      AETHERIA_SERVER_PASSWORD: pass,
      Aetheria_SERVER_PASSWORD: pass,
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
}

function killEngine(child, force) {
  if (!child || child.pid === undefined) return;
  try {
    if (process.platform === "win32") execSync(`taskkill ${force ? "/F " : ""}/T /PID ${child.pid}`, { stdio: "ignore", windowsHide: true });
    else child.kill(force ? "SIGKILL" : "SIGTERM");
  } catch {}
}

async function createSession(base, auth, dir, pId, mId, agentId, permissions) {
  const res = await api(base, auth, "/api/session", {
    method: "POST",
    body: JSON.stringify({
      model: { providerID: pId, id: mId },
      location: { directory: dir },
      ...(agentId ? { agent: agentId } : {}),
      ...(permissions ? { permissions } : {}),
    }),
  });
  const s = res.body?.data ?? res.body?.session ?? res.body;
  if (!s?.id) throw new Error(`Session create failed (HTTP ${res.status}): ${describe(res.body)}`);
  return s.id;
}

function openEventStream(base, auth, dir, sink, sessionID) {
  const controller = new AbortController();
  let abortedAt = null;
  let abortAt = null;
  (async () => {
    const res = await fetch(`${base}/api/event?directory=${encodeURIComponent(dir)}`, {
      headers: { authorization: auth, accept: "text/event-stream" },
      signal: controller.signal,
    }).catch(() => null);
    if (!res?.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read().catch(() => ({ done: true }));
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const line = frame.split(/\r?\n/).find((l) => l.startsWith("data:"));
        if (!line) continue;
        try {
          const evt = JSON.parse(line.slice(5).trim());
          const owner = evt.properties?.sessionID ?? evt.data?.sessionID;
          if (owner && owner !== sessionID) continue;
          sink.push(evt);
          if (abortAt && (evt.type === "session.idle" || evt.type === "session.execution.interrupted") && abortedAt === null) {
            abortedAt = Date.now() - abortAt;
          }
        } catch {}
      }
    }
  })();
  return { close: () => controller.abort(), abortLatency: () => abortedAt, noteAbortSent: () => { abortAt = Date.now(); } };
}

async function waitForIdleCount(events, count, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const n = events.filter(
      (e) =>
        e.type === "session.idle" ||
        e.type === "session.execution.succeeded" ||
        e.type === "session.execution.failed" ||
        e.type === "session.execution.interrupted",
    ).length;
    if (n >= count) return true;
    await sleep(60);
  }
  return false;
}

async function waitForCondition(predicate, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await sleep(50);
  }
  return false;
}

async function assertEngineHealthy(base, auth, timeout = 10_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const { status, body } = await api(base, auth, "/api/health").catch(() => ({ status: 0 }));
    if (status === 200 && body?.healthy !== false) return;
    await sleep(150);
  }
  throw new Error(`Engine not healthy at ${base}`);
}

async function api(base, auth, pathname, init = {}) {
  const res = await fetch(`${base}${pathname}`, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(10_000),
    headers: { authorization: auth, "content-type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}

function resolveAuth() {
  const user = process.env.AETHERIA_SERVER_USERNAME ?? process.env.Aetheria_SERVER_USERNAME;
  const pass = process.env.AETHERIA_SERVER_PASSWORD ?? process.env.Aetheria_SERVER_PASSWORD;
  if (user && pass) return { user, pass };
  try {
    const [u, p] = fs.readFileSync(path.join(os.homedir(), ".aetheria", "dev-server-password"), "utf8").trim().split(":");
    if (u && p) return { user: u, pass: p };
  } catch {}
  return null;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    out[key] = next && !next.startsWith("--") ? argv[++i] : true;
  }
  return out;
}

function rmDirRetry(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); } catch {}
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      srv.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

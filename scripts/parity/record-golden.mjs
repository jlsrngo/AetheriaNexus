// Record OpenCode as parity oracle.
// Usage: node scripts/parity/record-golden.mjs [--opencode E:\\JS\\opencode-study] [--timeout 30000] [--only K01,K02]
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { startFakeProvider } from "./fake-provider.mjs";
import { normalizeEvents, stripVolatile } from "./normalize-opencode.mjs";
import {
  buildOpenCodeConfig,
  rmDirRetry,
  sleep,
  startOpenCodeServer,
  stopProcess,
  subscribeEvents,
  TERMINAL_TYPES,
  waitForCondition,
  waitForTerminalCount,
} from "./lib/opencode-driver.mjs";
import { scenarios } from "./lib/scenarios.mjs";

const args = parseArgs(process.argv.slice(2));
const opencodeDir = path.resolve(args.opencode ?? process.env.OPENCODE_DIR ?? "E:/JS/opencode-study");
const defaultTimeoutMs = Number(args.timeout ?? 30_000);
const goldenDir = path.resolve(args.out ?? path.join(process.cwd(), "scripts", "parity", "golden"));
const providerId = String(args["provider-id"] ?? "parity");
const modelId = String(args.model ?? "parity-model");
const selected = args.only ? new Set(String(args.only).split(",")) : null;

const rootWs = fs.mkdtempSync(path.join(os.tmpdir(), "opencode-parity-ws-"));
const sharedHome = fs.mkdtempSync(path.join(os.tmpdir(), "opencode-parity-home-"));
const provider = await startFakeProvider();
const password = `parity-${crypto.randomBytes(18).toString("base64url")}`;
const auth = "Basic " + Buffer.from(`opencode:${password}`).toString("base64");
const sharedConfig = buildOpenCodeConfig(`${provider.url}/v1`);

let sharedServer = null;
const results = [];

try {
  sharedServer = await startOpenCodeServer({
    opencodeDir,
    home: sharedHome,
    password,
    config: sharedConfig,
    startupTimeoutMs: Number(args["startup-timeout"] ?? 30_000),
  });
  await waitForHealth(sharedServer.url);
  fs.mkdirSync(goldenDir, { recursive: true });

  for (const scenario of scenarios) {
    if (selected && !selected.has(scenario.id)) continue;
    const result = await recordScenario(scenario);
    results.push(result);
    console.log(`${scenario.id} ${result.status}${result.detail ? ` ${result.detail}` : ""}`);
  }
} finally {
  if (sharedServer) await stopProcess(sharedServer.process, true);
  await provider.close();
  rmDirRetry(rootWs);
  rmDirRetry(sharedHome);
  if (results.length === 0) process.exitCode = 2;
}

const manifestPath = path.join(goldenDir, "manifest.json");
const prevManifest = selected && fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  : { scenarios: {}, files: {} };
const manifest = {
  format: 1,
  opencodeDir,
  opencodeCommit: gitCommit(opencodeDir),
  provider: { id: providerId, model: modelId },
  scenarios: {
    ...(prevManifest.scenarios ?? {}),
    ...Object.fromEntries(results.map((r) => [r.id, r])),
  },
  files: {
    ...(prevManifest.files ?? {}),
    ...Object.fromEntries(
      results
        .filter((r) => r.file)
        .map((r) => [r.id, { file: r.file, sha256: r.sha256, events: r.events }]),
    ),
  },
};
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`Golden written: ${goldenDir}`);
console.log(`Recorded ${results.filter((r) => r.status === "RECORDED").length}/${results.length} selected scenarios`);
const exitCode = results.some((r) => r.status === "ERROR") ? 1 : results.length === 0 ? 2 : 0;
process.exit(exitCode);

async function recordScenario(scenario) {
  const file = `${scenario.id}.ndjson`;
  const timeoutMs = scenario.timeoutMs ?? defaultTimeoutMs;
  const scenarioWs = path.join(rootWs, scenario.id);
  fs.mkdirSync(scenarioWs, { recursive: true });
  for (const [relPath, text] of Object.entries(scenario.setupFiles ?? {})) {
    const abs = path.join(scenarioWs, relPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  }

  let isolatedHome = null;
  let activeServer = sharedServer;
  const needsIsolated = Boolean(scenario.serviceMode || scenario.configFlags?.length || scenario.configPatch);

  try {
    if (needsIsolated) {
      isolatedHome = fs.mkdtempSync(path.join(os.tmpdir(), `opencode-iso-${scenario.id}-`));
      const config = buildOpenCodeConfig(`${provider.url}/v1`, {
        backgroundCompaction: scenario.configFlags?.includes("background_compaction"),
      });
      activeServer = await startOpenCodeServer({
        opencodeDir,
        home: isolatedHome,
        password,
        config,
        service: Boolean(scenario.serviceMode),
        flags: scenario.configFlags ?? [],
      });
      await waitForHealth(activeServer.url);
    }

    await fetch(`${provider.url}/__script`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ script: scenario.script ?? [] }),
    });

    const session = await createSession(activeServer.url, {
      providerID: scenario.providerId ?? providerId,
      modelID: scenario.modelId ?? modelId,
      workspace: scenarioWs,
      agent: scenario.agentId,
      permissions: scenario.permissions,
    });

    if (scenario.expect?.inboxOrder) {
      for (const text of scenario.expect.inboxOrder) {
        const res = await api(activeServer.url, `/api/session/${session}/prompt`, {
          method: "POST",
          body: JSON.stringify({ text, delivery: "queue", resume: false }),
        });
        if (!res.ok) throw new Error(`inbox HTTP ${res.status}`);
      }
      const inbox = await api(activeServer.url, `/api/session/${session}/inbox`);
      const body = await inbox.json().catch(() => null);
      const rawItems = body?.data ?? body ?? [];
      const items = Array.isArray(rawItems)
        ? rawItems.map((it, idx) => stripVolatile({ order: idx + 1, text: it.text ?? it.payload?.text ?? "" }))
        : stripVolatile(rawItems);
      const content = JSON.stringify(items) + "\n";
      fs.writeFileSync(path.join(goldenDir, file), content);
      return { id: scenario.id, status: "RECORDED", file, sha256: sha256(content), events: 0 };
    }

    const events = [];
    let stream = subscribeEvents(activeServer.url, auth, scenarioWs, events, (owner) => owner === session);
    await stream.ready;
    await sleep(40);

    try {
      if (scenario.restartScenario) {
        activeServer = await runRestartFlow({
          scenario,
          server: activeServer,
          isolatedHome,
          session,
          events,
          scenarioWs,
          streamRef: { get: () => stream, set: (s) => { stream = s; } },
          timeoutMs,
        });
      } else {
        const prompts = scenario.prompts ?? [scenario.prompt ?? "parity"];
        const expectedTurns = scenario.expectedTurns ?? prompts.length;

        if (scenario.abortAfterMs) {
          setTimeout(() => {
            api(activeServer.url, `/api/session/${session}/interrupt`, { method: "POST", body: "{}" }).catch(() => {});
          }, scenario.abortAfterMs);
        }
        if (scenario.steer) {
          setTimeout(() => {
            api(activeServer.url, `/api/session/${session}/prompt`, {
              method: "POST",
              body: JSON.stringify({ text: scenario.steer.text, delivery: scenario.steer.delivery }),
            }).catch(() => {});
          }, scenario.steer.afterMs ?? 100);
        }

        if (prompts.length > 1) {
          for (let idx = 0; idx < prompts.length; idx++) {
            const pRes = await api(activeServer.url, `/api/session/${session}/prompt`, {
              method: "POST",
              body: JSON.stringify({ text: prompts[idx], ...(scenario.agentId ? { agent: scenario.agentId } : {}) }),
            });
            if (!pRes.ok) throw new Error(`prompt[${idx}] HTTP ${pRes.status}: ${(await pRes.text()).slice(0, 300)}`);
            const okTurn = await waitForTerminalCount(events, session, idx + 1, timeoutMs);
            if (!okTurn) {
              await api(activeServer.url, `/api/session/${session}/interrupt`, { method: "POST", body: "{}" }).catch(() => {});
              throw new Error(`no terminal event for turn ${idx + 1} within ${timeoutMs}ms`);
            }
          }
        } else {
          const pRes = await api(activeServer.url, `/api/session/${session}/prompt`, {
            method: "POST",
            body: JSON.stringify({ text: prompts[0], ...(scenario.agentId ? { agent: scenario.agentId } : {}) }),
          });
          if (!pRes.ok) throw new Error(`prompt HTTP ${pRes.status}: ${(await pRes.text()).slice(0, 300)}`);

          if (scenario.abortOnTool) {
            const started = await waitForCondition(
              () => events.some((e) => e.type === "session.tool.called"),
              timeoutMs,
            );
            if (!started) throw new Error(`no session.tool.called within ${timeoutMs}ms`);
            await sleep(100);
            await api(activeServer.url, `/api/session/${session}/interrupt`, { method: "POST", body: "{}" });
          }

          if (scenario.interruptOnRetry) {
            const retried = await waitForCondition(
              () => events.some((e) => e.type === "session.retry.scheduled"),
              timeoutMs,
            );
            if (!retried) throw new Error(`no session.retry.scheduled within ${timeoutMs}ms`);
            await api(activeServer.url, `/api/session/${session}/interrupt`, { method: "POST", body: "{}" });
          }

          const ok = await waitForTerminalCount(events, session, expectedTurns, timeoutMs);
          if (!ok) {
            await api(activeServer.url, `/api/session/${session}/interrupt`, { method: "POST", body: "{}" }).catch(() => {});
            await sleep(200);
            throw new Error(`expected ${expectedTurns} terminal event(s) within ${timeoutMs}ms`);
          }
        }
      }
    } finally {
      stream.abort();
    }

    const requests = await providerState();
    const normalized = normalizeEvents(events);
    if (scenario.check) {
      const checkErr = scenario.check(normalized, requests, events);
      if (checkErr) throw new Error(`scenario self-check failed: ${checkErr}`);
    }
    if (scenario.expectNoFile && fs.existsSync(path.join(scenarioWs, scenario.expectNoFile))) {
      throw new Error(`forbidden file created: ${scenario.expectNoFile}`);
    }

    const lines = [
      ...normalized.map((event, i) => JSON.stringify({ i, ...event })),
      ...requests.map((request, i) => JSON.stringify({
        i: `req-${i}`,
        kind: "provider.request",
        stream: request.stream,
        model: request.model,
      })),
    ];
    const content = lines.join("\n") + "\n";
    fs.writeFileSync(path.join(goldenDir, file), content);
    return { id: scenario.id, status: "RECORDED", file, sha256: sha256(content), events: normalized.length };
  } catch (error) {
    return { id: scenario.id, status: "ERROR", detail: error instanceof Error ? error.message : String(error) };
  } finally {
    if (needsIsolated) {
      if (activeServer && activeServer !== sharedServer) await stopProcess(activeServer.process, true);
      if (isolatedHome) rmDirRetry(isolatedHome);
    }
  }
}

async function runRestartFlow({ scenario, server, isolatedHome, session, events, scenarioWs, streamRef, timeoutMs }) {
  let srv = server;
  const spec = scenario.restartScenario;
  const config = buildOpenCodeConfig(`${provider.url}/v1`, {
    backgroundCompaction: scenario.configFlags?.includes("background_compaction"),
  });
  const restart = async (forceKill) => {
    streamRef.get().abort();
    await stopProcess(srv.process, forceKill);
    srv = await startOpenCodeServer({
      opencodeDir,
      home: isolatedHome,
      password,
      config,
      service: true,
      flags: scenario.configFlags ?? [],
    });
    await waitForHealth(srv.url);
    const nextStream = subscribeEvents(srv.url, auth, scenarioWs, events, (owner) => owner === session);
    await nextStream.ready;
    streamRef.set(nextStream);
  };

  const pRes = await api(srv.url, `/api/session/${session}/prompt`, {
    method: "POST",
    body: JSON.stringify({ text: scenario.prompt }),
  });
  if (!pRes.ok) throw new Error(`prompt HTTP ${pRes.status}`);

  if (spec.type === "inbox-restart") {
    await waitForCondition(async () => (await providerState()).length >= 1, timeoutMs);
    await sleep(150);
    for (const qText of spec.queueTexts) {
      await api(srv.url, `/api/session/${session}/prompt`, {
        method: "POST",
        body: JSON.stringify({ text: qText, delivery: "queue" }),
      });
    }
    await restart(true);
    const done = await waitForCondition(async () => {
      const reqs = await providerState();
      const serialized = JSON.stringify(reqs.map((r) => r.body?.messages ?? []));
      if (!spec.queueTexts.every((t) => serialized.includes(t))) return false;
      const inboxRes = await api(srv.url, `/api/session/${session}/inbox`);
      const inboxBody = await inboxRes.json().catch(() => null);
      const items = inboxBody?.data ?? inboxBody ?? [];
      return Array.isArray(items) && items.length === 0;
    }, timeoutMs);
    if (!done) throw new Error("inbox restart did not drain queued prompts");
    await sleep(200);
    return srv;
  }

  if (spec.type === "shutdown-during-tool" || spec.type === "tool-crash") {
    await waitForCondition(() => events.some((e) => e.type === "session.tool.called"), timeoutMs);
    await sleep(150);
    await restart(spec.type === "tool-crash");
    const ok = await waitForCondition(
      () => events.some((e) => (e.data ?? e.properties ?? {}).sessionID === session && TERMINAL_TYPES.has(e.type)),
      timeoutMs,
    );
    if (!ok) throw new Error(`${spec.type} did not recover to terminal state`);
    return srv;
  }

  if (spec.type === "subagent-crash") {
    const marker = scenario.id === "K52" ? "CHILD_CRASH_K52" : "CHILD_CRASH_K53";
    for (let cycle = 1; cycle <= spec.restarts; cycle++) {
      const seen = await waitForCondition(
        async () => (await providerState()).filter((r) =>
          (r.body?.messages ?? []).some((m) => m.role === "user" && JSON.stringify(m.content).includes(marker)),
        ).length >= cycle,
        timeoutMs,
      );
      if (!seen) throw new Error(`child marker ${marker} cycle ${cycle} never reached provider`);
      await sleep(100);
      await restart(true);
    }
    const ok = await waitForCondition(
      () => events.some((e) => (e.data ?? e.properties ?? {}).sessionID === session && e.type === "session.execution.succeeded"),
      timeoutMs,
    );
    if (!ok) throw new Error("subagent crash did not resume to execution succeeded");
    return srv;
  }

  if (spec.type === "compaction-crash") {
    const started = await waitForCondition(() => events.some((e) => e.type === "session.compaction.started"), timeoutMs);
    if (!started) throw new Error("compaction never started before crash");
    await restart(true);
    const ok = await waitForCondition(
      () => events.some((e) => (e.data ?? e.properties ?? {}).sessionID === session && e.type === "session.execution.succeeded"),
      timeoutMs,
    );
    if (!ok) throw new Error("compaction crash did not resume to execution succeeded");
    return srv;
  }

  throw new Error(`Unknown restartScenario type: ${spec.type}`);
}

async function waitForHealth(baseURL) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const response = await api(baseURL, "/api/info").catch(() => null);
    if (response?.status === 200) return;
    await sleep(100);
  }
  throw new Error("OpenCode server did not become healthy");
}

async function api(baseURL, route, init = {}) {
  return fetch(`${baseURL}${route}`, {
    ...init,
    headers: { authorization: auth, "content-type": "application/json", ...(init.headers ?? {}) },
  });
}

async function createSession(baseURL, { providerID, modelID, workspace, agent, permissions }) {
  const response = await api(baseURL, "/api/session", {
    method: "POST",
    body: JSON.stringify({
      title: "Parity",
      model: { providerID, id: modelID },
      location: { directory: workspace },
      ...(agent ? { agent } : {}),
      ...(permissions ? { permissions } : {}),
    }),
  });
  const body = await response.json().catch(() => null);
  const session = body?.data ?? body?.session ?? body;
  if (!response.ok || !session?.id) throw new Error(`session HTTP ${response.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return session.id;
}

async function providerState() {
  const response = await fetch(`${provider.url}/__state`);
  return response.json();
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function gitCommit(directory) {
  try {
    return execFileSync("git", ["-C", directory, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
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

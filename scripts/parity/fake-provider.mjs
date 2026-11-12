// OpenAI-compatible fake provider. Plays a scripted list of responses or conditional
// match rules so retry/streaming/usage/compaction/subagent behaviour is deterministic.
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

const VALID_SUMMARY = `## Objective
- Complete the parity test task

## Requirements
- (none)

## Decisions
- (none)

## Work State
### Completed
- Initial step

### Active
- Continuing workflow

### Blocked
- (none)

## Next Move
1. Proceed to final answer

## Relevant Files
- (none)

## Important Context
- (none)`;

const json = (res, status, body, headers = {}) => {
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(JSON.stringify(body));
};

function isCompactionRequest(body) {
  const text = JSON.stringify(body?.messages ?? []);
  return (
    text.includes("You MUST summarize the conversation above") ||
    text.includes("Your response MUST follow this structure") ||
    text.includes("Provide a detailed summary")
  );
}

function wireFinish(finish) {
  if (finish === "tool-calls") return "tool_calls";
  if (finish === "content-filter") return "content_filter";
  return finish ?? "stop";
}

function extractSpawnedSessionIds(body) {
  const ids = [];
  for (const msg of body?.messages ?? []) {
    if (msg?.role !== "tool") continue;
    const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content ?? "");
    for (const m of content.matchAll(/"(?:sessionID|session_id|childSessionId)"\s*:\s*"([^"]+)"/g)) {
      ids.push(m[1]);
    }
    for (const m of content.matchAll(/\b(ses_[A-Za-z0-9]+)\b/g)) {
      if (!ids.includes(m[1])) ids.push(m[1]);
    }
  }
  return ids;
}

function matchesRule(rule, body, entry) {
  const m = rule.match;
  if (!m) return false;
  if ((rule.once || m.once) && rule._hits > 0) return false;
  if (m.maxHits !== undefined && rule._hits >= m.maxHits) return false;
  if (m.model !== undefined && body.model !== m.model) return false;
  if (m.isCompaction !== undefined && entry.summary.isCompaction !== m.isCompaction) return false;
  const serialized = JSON.stringify(body?.messages ?? []);
  const userSerialized = JSON.stringify((body?.messages ?? []).filter((msg) => msg?.role === "user"));
  if (m.bodyContains !== undefined) {
    const needles = Array.isArray(m.bodyContains) ? m.bodyContains : [m.bodyContains];
    if (!needles.every((needle) => serialized.includes(needle))) return false;
  }
  if (m.bodyNotContains !== undefined) {
    const needles = Array.isArray(m.bodyNotContains) ? m.bodyNotContains : [m.bodyNotContains];
    if (needles.some((needle) => serialized.includes(needle))) return false;
  }
  if (m.userContains !== undefined) {
    const needles = Array.isArray(m.userContains) ? m.userContains : [m.userContains];
    if (!needles.every((needle) => userSerialized.includes(needle))) return false;
  }
  if (m.userNotContains !== undefined) {
    const needles = Array.isArray(m.userNotContains) ? m.userNotContains : [m.userNotContains];
    if (needles.some((needle) => userSerialized.includes(needle))) return false;
  }
  return true;
}

function interpolateStep(step, vars) {
  if (!step || !vars.lastSubagentSessionId) return step;
  const raw = JSON.stringify(step);
  if (!raw.includes("{{LAST_SUBAGENT_SESSION_ID}}")) return step;
  return JSON.parse(raw.replaceAll("{{LAST_SUBAGENT_SESSION_ID}}", vars.lastSubagentSessionId));
}

/** @typedef {{kind:"sse"|"json"|"error"|"abort"|"hang"}} Step */

export function startFakeProvider({ port = 0, host = "127.0.0.1" } = {}) {
  /** @type {{script: any[], rules: any[], index: number, requests: any[], lastSubagentSessionId: string | null}} */
  const state = { script: [], rules: [], index: 0, requests: [], lastSubagentSessionId: null };

  const loadScript = (items = []) => {
    state.script = items.filter((s) => !s?.match);
    state.rules = items.filter((s) => Boolean(s?.match)).map((s) => ({ ...s, _hits: 0 }));
    state.index = 0;
    state.requests = [];
    state.lastSubagentSessionId = null;
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === "/__state") return json(res, 200, state.requests);
    if (url.pathname === "/__reset") {
      loadScript([]);
      return json(res, 200, { ok: true });
    }
    if (url.pathname === "/__script") {
      let raw = "";
      for await (const chunk of req) raw += chunk;
      loadScript(JSON.parse(raw || "{}").script ?? []);
      return json(res, 200, { ok: true, steps: state.script.length, rules: state.rules.length });
    }
    if (url.pathname.endsWith("/models") && req.method === "GET") {
      return json(res, 200, {
        object: "list",
        data: [
          { id: "parity-model", object: "model", owned_by: "parity" },
          { id: "clip-model", object: "model", owned_by: "parity" },
          { id: "model-b", object: "model", owned_by: "parity" },
          { id: "model-c", object: "model", owned_by: "parity" },
        ],
      });
    }
    if (!url.pathname.endsWith("/chat/completions") || req.method !== "POST") {
      return json(res, 404, { error: { message: `Unhandled ${req.method} ${url.pathname}` } });
    }

    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw || "{}");
    const serialized = JSON.stringify(body?.messages ?? []);
    const spawnedIds = extractSpawnedSessionIds(body);
    if (spawnedIds.length > 0) {
      state.lastSubagentSessionId = spawnedIds[spawnedIds.length - 1];
    }

    const entry = {
      at: Date.now(),
      stream: body.stream === true,
      model: body.model,
      summary: {
        model: body.model ?? null,
        toolChoice: body.tool_choice ?? null,
        messageCount: Array.isArray(body.messages) ? body.messages.length : 0,
        isCompaction: isCompactionRequest(body),
        hasMaxStepsPrompt: serialized.includes("MAXIMUM STEPS REACHED"),
        hasTranscriptClip: serialized.includes("characters omitted"),
        charLen: raw.length,
      },
      body,
    };
    state.requests.push(entry);

    let step = null;
    for (const rule of state.rules) {
      if (matchesRule(rule, body, entry)) {
        rule._hits += 1;
        step = rule;
        break;
      }
    }
    if (!step) {
      const next = state.script[state.index++];
      if (next) {
        step = next;
      } else {
        const fallbackText = entry.summary.isCompaction ? VALID_SUMMARY : "ok";
        step = body.stream === true
          ? { kind: "sse", chunks: [{ delta: fallbackText }], finish: "stop" }
          : { kind: "json", body: completion(body, fallbackText) };
      }
    }

    const resolvedStep = interpolateStep(step, state);
    await respond(req, res, resolvedStep, body, entry);
  });

  return new Promise((resolve) => {
    server.listen(port, host, () => {
      const actualPort = server.address().port;
      resolve({
        url: `http://${host}:${actualPort}`,
        state,
        setScript(script) {
          loadScript(script);
        },
        requests: () => state.requests,
        close: () =>
          new Promise((r) => {
            server.closeAllConnections?.();
            server.close(r);
          }),
      });
    });
  });
}

function completion(body, text = "ok", finish = "stop", usage = null, toolCalls = null) {
  return {
    id: "chatcmpl-parity",
    object: "chat.completion",
    model: body.model ?? "parity-model",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: text,
          ...(toolCalls?.length ? { tool_calls: toolCalls } : {}),
        },
        finish_reason: wireFinish(finish),
      },
    ],
    ...(usage ? { usage } : {}),
  };
}

/** Real providers return one message with complete tool calls; merge the scripted fragments. */
function collapseChunks(chunks) {
  const text = chunks.map((c) => c.delta ?? c.content ?? "").join("");
  const calls = new Map();
  for (const chunk of chunks) {
    const raw = chunk.toolCall;
    if (!raw) continue;
    const index = raw.index ?? 0;
    const cur = calls.get(index) ?? { id: raw.id, type: raw.type ?? "function", function: { name: raw.function?.name, arguments: "" } };
    if (raw.id) cur.id = raw.id;
    if (raw.function?.name) cur.function.name = raw.function.name;
    cur.function.arguments += raw.function?.arguments ?? "";
    calls.set(index, cur);
  }
  return { text, toolCalls: [...calls.values()] };
}

async function respond(req, res, step, body, entry) {
  switch (step.kind) {
    case "error":
      return json(res, step.status ?? 500, step.body ?? { error: { message: "scripted error" } }, step.headers ?? {});
    case "hang":
      return; // never respond; caller times out
    case "json":
      return json(res, step.status ?? 200, step.body ?? completion(body));
    case "sse":
      if (!entry.stream) {
        const collapsed = collapseChunks(step.chunks ?? []);
        return json(
          res,
          200,
          completion(body, collapsed.text, step.finish ?? "stop", step.usage ?? null, collapsed.toolCalls),
        );
      }
      return sse(res, step, body);
    case "abort":
      if (!entry.stream) return json(res, 200, completion(body, "", "stop"));
      return abortMidStream(res, step, body);
    default:
      return json(res, 500, { error: { message: `Unknown step kind ${step.kind}` } });
  }
}

function sseHeaders(res) {
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sse(res, step, body) {
  sseHeaders(res);
  const id = "chatcmpl-parity";
  const model = body?.model ?? "parity-model";
  for (const chunk of step.chunks ?? []) {
    if (chunk.delay) await sleep(chunk.delay);
    if (chunk.delta !== undefined) {
      send(res, id, model, { content: chunk.delta }, null);
    }
    if (chunk.reasoning !== undefined) {
      send(res, id, model, { reasoning_content: chunk.reasoning }, null);
    }
    if (chunk.toolCall) {
      send(res, id, model, { tool_calls: [chunk.toolCall] }, null);
    }
  }
  send(res, id, model, {}, wireFinish(step.finish), step.usage);
  res.write("data: [DONE]\n\n");
  res.end();
}

async function abortMidStream(res, step, body) {
  sseHeaders(res);
  const id = "chatcmpl-parity";
  const model = body?.model ?? "parity-model";
  const chunks = step.chunks ?? [];
  for (let i = 0; i < (step.after ?? 1); i++) {
    const chunk = chunks[i];
    if (!chunk) break;
    if (chunk.delay) await sleep(chunk.delay);
    if (chunk.delta !== undefined) send(res, id, model, { content: chunk.delta }, null);
  }
  // Simulate a dropped connection: no [DONE], socket destroyed.
  res.destroy();
}

function send(res, id, model, delta, finish, usage) {
  const payload = {
    id,
    object: "chat.completion.chunk",
    model,
    choices: [{ index: 0, delta, finish_reason: finish }],
    ...(usage ? { usage } : {}),
  };
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

// Standalone mode: node fake-provider.mjs --port 4180
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const portArg = process.argv.indexOf("--port");
  const port = portArg > -1 ? Number(process.argv[portArg + 1]) : 4180;
  const provider = await startFakeProvider({ port });
  console.log(`fake provider listening on ${provider.url}`);
}

// Self-check for the parity harness itself. Runs without an engine: proves the fake
// provider frames SSE correctly, normalizers remove volatile fields symmetrically, and assertions work.
// usage: node scripts/parity/self-test.mjs
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { compareScenarioNdjson } from "./diff-report.mjs";
import { startFakeProvider } from "./fake-provider.mjs";
import { normalizeEvent as normalizeAetheria, normalizeEvents, stripVolatile } from "./normalize.mjs";
import { normalizeEvent as normalizeOpenCode } from "./normalize-opencode.mjs";
import { matchSequence, subsetMatch } from "./lib/assert.mjs";
import { scenarios, TOTAL } from "./lib/scenarios.mjs";

let failures = 0;
function check(name, condition, detail = "") {
  if (condition) {
    console.log(`PASS  ${name}`);
  } else {
    failures++;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

// ---- scenario data ----
const ids = scenarios.map((s) => s.id);
const expectedIds = Array.from({ length: 58 }, (_, i) => `K${String(i + 1).padStart(2, "0")}`);
check("58 scenario", TOTAL === 58 && ids.length === 58, `got ${ids.length}`);
check("id unik dan berurutan", JSON.stringify(ids) === JSON.stringify(expectedIds));
check(
  "semua scenario terimplementasi dan punya expect/script",
  scenarios.every((s) => s.implemented === true && s.expect !== undefined && (s.script !== undefined || s.expect.inboxOrder)),
);

// ---- fake provider ----
const provider = await startFakeProvider();

async function chat(stream, script, extra = {}) {
  provider.setScript(script);
  const res = await fetch(`${provider.url}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: "parity-model", stream, messages: extra.messages ?? [] }),
  });
  return { res, text: await res.text() };
}

{
  const script = [
    { kind: "sse", chunks: [{ delta: "a" }, { delta: "b", delay: 20 }, { delta: "c" }], finish: "stop", usage: { prompt_tokens: 3, completion_tokens: 2 } },
  ];
  const r1 = await chat(true, script);
  const r2 = await chat(true, script);
  const hash1 = crypto.createHash("sha256").update(r1.text).digest("hex");
  const hash2 = crypto.createHash("sha256").update(r2.text).digest("hex");
  check("F0-2 fake provider deterministik", hash1 === hash2);

  const frames = r1.text.split("\n\n").filter((f) => f.startsWith("data:"));
  const deltas = frames
    .map((f) => f.slice(5).trim())
    .filter((v) => v !== "[DONE]")
    .map((v) => JSON.parse(v))
    .filter((p) => p.choices?.[0]?.delta?.content);
  check("SSE: 3 delta terkirim", deltas.length === 3, `got ${deltas.length}`);
  check("SSE: urutan fragmen", deltas.map((d) => d.choices[0].delta.content).join("") === "abc");
  check("SSE: ada [DONE]", r1.text.includes("data: [DONE]"));
  check("SSE: content-type", r1.res.headers.get("content-type")?.includes("text/event-stream"));
  const reqs = provider.requests();
  check("provider mencatat stream:true", reqs.length === 1 && reqs[0].stream === true);
}

{
  const { text } = await chat(false, [
    { kind: "sse", chunks: [{ delta: "a" }, { delta: "b" }], finish: "stop", usage: { prompt_tokens: 1, completion_tokens: 1 } },
  ]);
  const body = JSON.parse(text);
  check("non-stream: konten digabung", body.choices?.[0]?.message?.content === "ab", text.slice(0, 120));
  check("non-stream: usage diteruskan", body.usage?.prompt_tokens === 1);
}

{
  const { text } = await chat(false, [
    {
      kind: "sse",
      chunks: [
        { toolCall: { index: 0, id: "call_1", type: "function", function: { name: "read", arguments: '{"pa' } } },
        { toolCall: { index: 0, function: { arguments: 'th":"a"}' } } },
      ],
      finish: "tool-calls",
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    },
  ]);
  const choice = JSON.parse(text).choices?.[0];
  const tc = choice?.message?.tool_calls?.[0];
  check(
    "non-stream: tool_calls digabung utuh",
    tc?.function?.name === "read" && tc?.function?.arguments === '{"path":"a"}',
    JSON.stringify(tc),
  );
  check("non-stream: finish_reason wire tool_calls", choice?.finish_reason === "tool_calls", choice?.finish_reason);
}

{
  // Match rule & template interpolation for subagent follow-ups
  provider.setScript([
    {
      match: { bodyContains: "follow" },
      kind: "sse",
      chunks: [{ delta: "join:{{LAST_SUBAGENT_SESSION_ID}}" }],
      finish: "stop",
    },
  ]);
  const res = await fetch(`${provider.url}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: "parity-model",
      stream: false,
      messages: [
        { role: "tool", content: JSON.stringify({ sessionID: "ses_abc123", status: "running" }) },
        { role: "user", content: "follow" },
      ],
    }),
  });
  const body = await res.json();
  check("fake provider: template subagent sessionID", body.choices?.[0]?.message?.content === "join:ses_abc123");
}

{
  const { res } = await chat(true, [
    { kind: "error", status: 429, headers: { "retry-after": "37" }, body: { error: { message: "slow" } } },
  ]);
  check("error: status 429", res.status === 429);
  check("error: retry-after terbaca", res.headers.get("retry-after") === "37");
}

{
  let aborted = false;
  try {
    const { text } = await chat(true, [{ kind: "abort", after: 2, chunks: [{ delta: "a" }, { delta: "b" }, { delta: "c" }] }]);
    aborted = !text.includes("[DONE]");
  } catch {
    aborted = true;
  }
  check("abort: stream berhenti tanpa [DONE]", aborted);
}

await provider.close();

// ---- normalizer ----
{
  const finish = normalizeAetheria({
    type: "session.next.step.ended",
    properties: { sessionID: "ses_1", finish: "length", tokens: { input: 5 }, cost: 0 },
  });
  check("normalizer: step.ended -> llm.finish", finish?.kind === "llm.finish" && finish.reason === "length");
  check("normalizer: token ikut", finish?.tokens?.input === 5);

  const ocInterrupt = normalizeOpenCode({
    type: "session.execution.interrupted",
    data: { sessionID: "ses_abc", reason: "user" },
  });
  check("normalizer: OpenCode interrupted -> turn.interrupted", ocInterrupt?.kind === "turn.interrupted");
  check("normalizer: teks delta", normalizeAetheria({ type: "session.next.text.delta", properties: { delta: "x" } })?.frag === "x");
  check("normalizer: reasoning", normalizeAetheria({ type: "session.next.reasoning.delta", properties: { delta: "r" } })?.kind === "llm.reasoning");
  check("normalizer: event asing dibuang", normalizeAetheria({ type: "session.created" }) === null);
  check("normalizer: list menyaring", normalizeEvents([{ type: "session.created" }, { type: "session.idle" }]).length === 1);
  check("normalizer: volatile + ses_ dibuang", JSON.stringify(stripVolatile({ id: "x", time: 1, v: "ses_abc 2026-11-12" })) === JSON.stringify({ v: "<session> <timestamp>" }));
}

// ---- assertion helpers ----
{
  const actual = [
    { kind: "llm.text.delta", frag: "a" },
    { kind: "llm.reasoning", frag: "r" },
    { kind: "llm.finish", reason: "stop" },
  ];
  check("match: urutan benar", matchSequence(actual, [{ kind: "llm.text.delta" }, { kind: "llm.finish" }]).ok);
  check("match: urutan salah ditolak", !matchSequence(actual, [{ kind: "llm.finish" }, { kind: "llm.text.delta" }]).ok);
  check("match: event hilang dilaporkan", matchSequence(actual, [{ kind: "llm.tool.call" }]).ok === false);
  check("subset: field parsial cocok", subsetMatch({ a: 1, b: 2 }, { a: 1 }));
  check("subset: nilai beda ditolak", !subsetMatch({ a: 1 }, { a: 2 }));
}

// ---- diff comparator contracts (K01, K04, K49) & strict fallback ----
{
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "parity-diff-test-"));
  const gDir = path.join(tmpDir, "golden");
  const aDir = path.join(tmpDir, "actual");
  fs.mkdirSync(gDir);
  fs.mkdirSync(aDir);
  const writeNdjson = (dir, id, rows) =>
    fs.writeFileSync(path.join(dir, `${id}.ndjson`), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");

  const mkTextRows = (deltas, fullText) => [
    { i: 0, kind: "llm.text.start" },
    ...deltas.map((frag, idx) => ({ i: idx + 1, kind: "llm.text.delta", frag })),
    { i: deltas.length + 1, kind: "llm.text.end", text: fullText },
    { i: deltas.length + 2, kind: "llm.finish", reason: "stop", tokens: { input: 10, output: 5 }, cost: 0 },
    { i: deltas.length + 3, kind: "turn.idle" },
    { i: "req-0", kind: "provider.request", stream: true, model: "parity-model" },
  ];

  writeNdjson(gDir, "K01", mkTextRows(["Hello ", "world", "!", " ok"], "Hello world! ok"));
  writeNdjson(aDir, "K01", mkTextRows(["Hello", " ", "world", "!", " ok"], "Hello world! ok"));
  check("diff K01: split batas flush diterima", compareScenarioNdjson("K01", gDir, aDir).length === 0);

  writeNdjson(aDir, "K01", mkTextRows(["Hello world! ok"], "Hello world! ok"));
  check("diff K01: 1 delta (non-streaming) ditolak", compareScenarioNdjson("K01", gDir, aDir).length > 0);

  const forty = "ba".repeat(20);
  writeNdjson(gDir, "K04", mkTextRows(["babababababa", "bababababab", "ababababa", "babababa"], forty));
  writeNdjson(aDir, "K04", mkTextRows(["bababababab", "abababa", "bababababa", "babababab", "aba"], forty));
  check("diff K04: batching range diterima", compareScenarioNdjson("K04", gDir, aDir).length === 0);

  writeNdjson(aDir, "K04", mkTextRows(Array.from(forty), forty));
  check("diff K04: 40 delta tanpa batching ditolak", compareScenarioNdjson("K04", gDir, aDir).length > 0);

  const k49Events = [{ i: 0, kind: "turn.idle" }];
  writeNdjson(gDir, "K49", [
    ...k49Events,
    { i: "req-0", kind: "provider.request", stream: true, model: "parity-model" },
    { i: "req-1", kind: "provider.request", stream: true, model: "m2" },
    { i: "req-2", kind: "provider.request", stream: true, model: "m1" },
    { i: "req-3", kind: "provider.request", stream: true, model: "parity-model" },
    { i: "req-4", kind: "provider.request", stream: true, model: "m3" },
    { i: "req-5", kind: "provider.request", stream: true, model: "parity-model" },
  ]);
  writeNdjson(aDir, "K49", [
    ...k49Events,
    { i: "req-0", kind: "provider.request", stream: true, model: "parity-model" },
    { i: "req-1", kind: "provider.request", stream: true, model: "m1" },
    { i: "req-2", kind: "provider.request", stream: true, model: "parity-model" },
    { i: "req-3", kind: "provider.request", stream: true, model: "m3" },
    { i: "req-4", kind: "provider.request", stream: true, model: "m2" },
    { i: "req-5", kind: "provider.request", stream: true, model: "parity-model" },
  ]);
  check("diff K49: urutan paralel sebagai multiset diterima", compareScenarioNdjson("K49", gDir, aDir).length === 0);

  writeNdjson(aDir, "K49", [
    ...k49Events,
    { i: "req-0", kind: "provider.request", stream: true, model: "parity-model" },
    { i: "req-1", kind: "provider.request", stream: true, model: "m1" },
    { i: "req-2", kind: "provider.request", stream: true, model: "parity-model" },
    { i: "req-3", kind: "provider.request", stream: true, model: "m1" },
    { i: "req-4", kind: "provider.request", stream: true, model: "m2" },
    { i: "req-5", kind: "provider.request", stream: true, model: "parity-model" },
  ]);
  check("diff K49: model paralel duplikat/hilang ditolak", compareScenarioNdjson("K49", gDir, aDir).length > 0);

  writeNdjson(gDir, "K02", mkTextRows(["a", "b"], "ab"));
  writeNdjson(aDir, "K02", mkTextRows(["ab"], "ab"));
  check("diff K02: skenario ketat tetap gagal bila delta beda", compareScenarioNdjson("K02", gDir, aDir).length > 0);

  const k46Prefix = Array.from({ length: 18 }, (_, i) => ({ i, kind: i === 13 ? "turn.idle" : "llm.text.delta", frag: `p${i}` }));
  const k46Mid = [
    { i: 18, kind: "llm.text.start" },
    { i: 19, kind: "llm.text.delta", frag: "ok" },
    { i: 20, kind: "llm.text.end", text: "ok" },
    { i: 21, kind: "llm.finish", reason: "stop", tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } }, cost: 0 },
  ];
  const k46Tail = [{ i: 22, kind: "turn.idle" }];
  writeNdjson(gDir, "K46", [
    ...k46Prefix, ...k46Mid, ...k46Tail,
    { i: "req-0", kind: "provider.request", stream: true, model: "parity-model" },
    { i: "req-1", kind: "provider.request", stream: true, model: "parity-model" },
    { i: "req-2", kind: "provider.request", stream: true, model: "model-c" },
    { i: "req-3", kind: "provider.request", stream: true, model: "model-b" },
    { i: "req-4", kind: "provider.request", stream: true, model: "parity-model" },
    { i: "req-5", kind: "provider.request", stream: true, model: "parity-model" },
  ]);
  writeNdjson(aDir, "K46", [
    ...k46Prefix, { i: 18, kind: "turn.idle" },
    { i: "req-0", kind: "provider.request", stream: true, model: "parity-model" },
    { i: "req-1", kind: "provider.request", stream: true, model: "parity-model" },
    { i: "req-2", kind: "provider.request", stream: true, model: "model-b" },
    { i: "req-3", kind: "provider.request", stream: true, model: "model-c" },
    { i: "req-4", kind: "provider.request", stream: true, model: "parity-model" },
  ]);
  check("diff K46: 19 event + multiset model-b/model-c diterima", compareScenarioNdjson("K46", gDir, aDir).length === 0);

  writeNdjson(aDir, "K46", [
    ...k46Prefix, ...k46Mid.slice(0, 3),
    { i: 21, kind: "llm.finish", reason: "stop", tokens: null, cost: null },
    ...k46Tail,
    { i: "req-0", kind: "provider.request", stream: true, model: "parity-model" },
    { i: "req-1", kind: "provider.request", stream: true, model: "parity-model" },
    { i: "req-2", kind: "provider.request", stream: true, model: "model-c" },
    { i: "req-3", kind: "provider.request", stream: true, model: "model-b" },
    { i: "req-4", kind: "provider.request", stream: true, model: "parity-model" },
    { i: "req-5", kind: "provider.request", stream: true, model: "parity-model" },
  ]);
  check("diff K46: token null pada langkah ok tetap ditolak", compareScenarioNdjson("K46", gDir, aDir).length > 0);

  fs.rmSync(tmpDir, { recursive: true, force: true });
}

console.log("");
console.log(failures === 0 ? "SELF-TEST OK" : `SELF-TEST FAILED (${failures})`);
process.exitCode = failures === 0 ? 0 : 1;

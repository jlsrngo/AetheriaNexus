// Self-check for the parity harness itself. Runs without an engine: proves the fake
// provider frames SSE correctly, normalizers remove volatile fields symmetrically, and assertions work.
// usage: node scripts/parity/self-test.mjs
import crypto from "node:crypto";
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

console.log("");
console.log(failures === 0 ? "SELF-TEST OK" : `SELF-TEST FAILED (${failures})`);
process.exitCode = failures === 0 ? 0 : 1;

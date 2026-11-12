// Conformance scenarios K01–K28 (W1–W5) plus K58 (F0-7 5xx).
export const usage = { prompt_tokens: 812, completion_tokens: 140, total_tokens: 952 };

export const tool = (frag, first = false, index = 0, id = "call_1", name = "read") => ({
  index,
  ...(first ? { id, type: "function" } : {}),
  function: { name: first ? name : undefined, arguments: frag },
});

export const text = (t, delay = 0) => ({ delta: t, delay });

export const VALID_SUMMARY = `## Objective
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

export const scenariosW1toW5 = [
  // ---------- W1 streaming ----------
  {
    id: "K01", ws: "W1", implemented: true, title: "5 fragmen teks, urutan sama",
    prompt: "halo",
    script: [{ kind: "sse", chunks: [text("Hello", 120), text(" ", 120), text("world", 120), text("!", 120), text(" ok", 120)], finish: "stop", usage }],
    expect: { calls: 1, stream: true, events: [{ kind: "llm.text.delta", frag: "Hello" }, { kind: "llm.text.delta", frag: " " }, { kind: "llm.text.delta", frag: "world" }, { kind: "llm.text.delta", frag: "!" }, { kind: "llm.text.delta", frag: " ok" }] },
  },
  {
    id: "K02", ws: "W1", implemented: true, title: "reasoning di-flush sebelum teks",
    prompt: "berpikir dulu",
    script: [{ kind: "sse", chunks: [{ reasoning: "let me think" }, text("jawaban")], finish: "stop", usage }],
    expect: { calls: 1, stream: true, events: [{ kind: "llm.reasoning" }, { kind: "llm.text.delta", frag: "jawaban" }] },
  },
  {
    id: "K03", ws: "W1", implemented: true, title: "tool input dirakit per fragmen",
    prompt: "baca file",
    setupFiles: { "a.txt": "hello parity\n" },
    script: [
      { kind: "sse", chunks: [{ toolCall: tool('{"pa', true) }, { toolCall: tool('th":"a.txt"') }, { toolCall: tool("}") }], finish: "tool-calls", usage },
      { kind: "sse", chunks: [text("selesai")], finish: "stop", usage },
    ],
    expect: { callsAtLeast: 2, stream: true, events: [{ kind: "llm.tool.call", tool: "read" }, { kind: "llm.tool.success" }] },
  },
  {
    id: "K04", ws: "W1", implemented: true, title: "batching 100 ms",
    prompt: "banyak token",
    script: [{ kind: "sse", chunks: Array.from({ length: 40 }, (_, i) => text(i % 2 ? "a" : "b", 1)), finish: "stop", usage }],
    expect: { calls: 1, stream: true, maxCount: [{ kind: "llm.text.delta", max: 6 }] },
  },
  {
    id: "K05", ws: "W1", implemented: true, title: "delta tertahan sebelum blok baru",
    prompt: "transisi blok",
    script: [{ kind: "sse", chunks: [text("satu"), { reasoning: "r" }, text("dua")], finish: "stop", usage }],
    expect: { calls: 1, stream: true, events: [{ kind: "llm.text.delta", frag: "satu" }, { kind: "llm.reasoning" }, { kind: "llm.text.delta", frag: "dua" }] },
  },
  {
    id: "K06", ws: "W1", implemented: true, title: "stream mati tengah jalan",
    prompt: "putus",
    script: [
      { kind: "abort", after: 2, chunks: [text("par"), text("tial"), text("lanjut")] },
      { kind: "sse", chunks: [text("par"), text("tial"), text("lanjut")], finish: "stop", usage },
    ],
    expect: { callsAtLeast: 2, events: [{ kind: "llm.text.delta" }] },
  },
  {
    id: "K07", ws: "W1", implemented: true, title: "abort tidak meninggalkan part menggantung",
    prompt: "berhenti",
    abortAfterMs: 150,
    script: [{ kind: "sse", chunks: [text("a", 200), text("b", 200), text("c", 200)], finish: "stop", usage }],
    expect: { events: [{ kind: "turn.interrupted" }] },
  },

  // ---------- W2 usage & cost ----------
  {
    id: "K08", ws: "W2", implemented: true, title: "usage diteruskan apa adanya",
    prompt: "usage",
    script: [{ kind: "sse", chunks: [text("ok")], finish: "stop", usage }],
    expect: { calls: 1, events: [{ kind: "llm.finish", tokens: { input: 812, output: 140 } }] },
  },
  {
    id: "K09", ws: "W2", implemented: true, title: "nol dari provider otoritatif",
    prompt: "usage nol",
    script: [{ kind: "sse", chunks: [text("ok")], finish: "stop", usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } }],
    expect: { calls: 1, events: [{ kind: "llm.finish", tokens: { input: 0, output: 0 } }] },
  },
  {
    id: "K10", ws: "W2", implemented: true, title: "biaya bertingkat >200k dari katalog",
    prompt: "biaya",
    script: [{ kind: "sse", chunks: [text("ok")], finish: "stop", usage: { prompt_tokens: 210000, completion_tokens: 1000, total_tokens: 211000 } }],
    expect: { calls: 1, events: [{ kind: "llm.finish", tokens: { input: 210000, output: 1000 }, cost: 0.424 }] },
  },
  {
    id: "K11", ws: "W2", implemented: true, title: "agregasi 3 langkah",
    prompt: "tiga langkah",
    setupFiles: { "a.txt": "line1\n" },
    script: [
      { kind: "sse", chunks: [{ toolCall: tool('{"path":"a.txt"}', true, 0, "c1") }], finish: "tool-calls", usage },
      { kind: "sse", chunks: [{ toolCall: tool('{"path":"a.txt"}', true, 0, "c2") }], finish: "tool-calls", usage },
      { kind: "sse", chunks: [text("3")], finish: "stop", usage },
    ],
    expect: { calls: 3, events: [{ kind: "llm.finish", tokens: { input: 812 } }, { kind: "llm.finish", tokens: { input: 812 } }, { kind: "llm.finish", tokens: { input: 812 } }] },
  },

  // ---------- W3 finish reason ----------
  {
    id: "K12", ws: "W3", implemented: true, title: "stop + tool call jadi tool-calls",
    prompt: "panggil tool",
    setupFiles: { "a.txt": "hello\n" },
    script: [
      { kind: "sse", chunks: [{ toolCall: tool('{"path":"a.txt"}', true) }], finish: "stop", usage },
      { kind: "sse", chunks: [text("selesai")], finish: "stop", usage },
    ],
    expect: { callsAtLeast: 2, events: [{ kind: "llm.finish", reason: "tool-calls" }] },
  },
  {
    id: "K13", ws: "W3", implemented: true, title: "length sekali -> satu continuation",
    prompt: "panjang",
    script: [
      { kind: "sse", chunks: [text("terpotong")], finish: "length", usage },
      { kind: "sse", chunks: [text(" lanjutan")], finish: "stop", usage },
    ],
    expect: { callsAtLeast: 2, events: [{ kind: "llm.finish", reason: "length" }] },
  },
  {
    id: "K14", ws: "W3", implemented: true, title: "length tiga kali -> error",
    prompt: "terus terpotong",
    script: [
      { kind: "sse", chunks: [text("a")], finish: "length", usage },
      { kind: "sse", chunks: [text("b")], finish: "length", usage },
      { kind: "sse", chunks: [text("c")], finish: "length", usage },
      { kind: "sse", chunks: [text("d")], finish: "length", usage },
    ],
    expect: { callsAtLeast: 3, events: [{ kind: "session.error" }] },
  },
  {
    id: "K15", ws: "W3", implemented: true, title: "content-filter ditandai gagal",
    prompt: "diblokir",
    script: [{ kind: "sse", chunks: [text("")], finish: "content-filter", usage }],
    expect: { calls: 1, events: [{ kind: "session.error", category: "provider.content-filter" }] },
  },
  {
    id: "K16", ws: "W3", implemented: true, title: "finish tak dikenal retryable",
    prompt: "unknown",
    script: [
      { kind: "sse", chunks: [text("x")], finish: "weird-reason", usage },
      { kind: "sse", chunks: [text("y")], finish: "stop", usage },
    ],
    expect: { callsAtLeast: 2 },
  },

  // ---------- W4 retry ----------
  {
    id: "K17", ws: "W4", implemented: true, title: "429 backoff 2/4/8 s",
    prompt: "rate limit",
    script: [
      { kind: "error", status: 429, body: { error: { message: "rate limited" } } },
      { kind: "error", status: 429, body: { error: { message: "rate limited" } } },
      { kind: "sse", chunks: [text("akhirnya")], finish: "stop", usage },
    ],
    expect: { calls: 3, minGaps: [1500, 3000] },
  },
  {
    id: "K18", ws: "W4", implemented: true, title: "retry-after 3600 dipotong ke 900 s",
    prompt: "retry after",
    interruptOnRetry: true,
    script: [{ kind: "error", status: 429, headers: { "retry-after": "3600" }, body: { error: { message: "rate limited" } } }],
    expect: {
      calls: 1,
      events: [{ kind: "session.retry", attempt: 2 }, { kind: "turn.interrupted" }],
    },
  },
  {
    id: "K19", ws: "W4", implemented: true, title: "ENOTFOUND unreachable tetap retry terisolasi",
    prompt: "dns gagal",
    providerId: "parity-unreachable",
    interruptOnRetry: true,
    script: [],
    expect: {
      calls: 0,
      events: [{ kind: "session.retry", attempt: 2 }, { kind: "turn.interrupted" }],
    },
  },
  {
    id: "K20", ws: "W4", implemented: true, title: "timeout 4x berhenti setelah 3 retry",
    prompt: "timeout",
    providerId: "parity-timeout",
    script: [{ kind: "hang" }, { kind: "hang" }, { kind: "hang" }, { kind: "hang" }],
    expect: { calls: 4, events: [{ kind: "session.retry", attempt: 2 }, { kind: "session.error", category: "provider.transport" }] },
  },
  {
    id: "K21", ws: "W4", implemented: true, title: "auth/quota tidak diulang",
    prompt: "auth",
    script: [{ kind: "error", status: 401, body: { error: { message: "invalid api key" } } }],
    expect: { calls: 1, events: [{ kind: "session.error" }] },
  },
  {
    id: "K22", ws: "W4", implemented: true, title: "x-should-retry menimpa keputusan",
    prompt: "header override",
    script: [{ kind: "error", status: 429, headers: { "x-should-retry": "false" }, body: { error: { message: "nope" } } }],
    expect: { calls: 1, events: [{ kind: "session.error" }] },
  },

  // ---------- W5 klasifikasi error ----------
  {
    id: "K23", ws: "W5", implemented: true, title: "pesan overflow dikenali dan dikompak",
    prompt: "overflow",
    script: [
      { kind: "error", status: 400, body: { error: { message: "This model's maximum context length is 128000 tokens" } } },
      { match: { isCompaction: true }, kind: "sse", chunks: [{ delta: VALID_SUMMARY }], finish: "stop", usage },
      { kind: "sse", chunks: [text("pulih")], finish: "stop", usage },
    ],
    expect: { events: [{ kind: "session.compaction.start" }, { kind: "session.compacted" }] },
  },
  {
    id: "K24", ws: "W5", implemented: true, title: "429 bukan overflow",
    prompt: "429 context",
    script: [
      { kind: "error", status: 429, body: { error: { message: "context length exceeded, slow down" } } },
      { kind: "sse", chunks: [text("ok")], finish: "stop", usage },
    ],
    expect: { calls: 2, noEvents: ["session.compaction.start", "session.overflow_healed"] },
  },
  {
    id: "K25", ws: "W5", implemented: true, title: "too many tokens, please wait",
    prompt: "tunggu",
    script: [{ kind: "error", status: 400, body: { error: { message: "too many tokens, please wait" } } }],
    expect: { noEvents: ["session.compaction.start", "session.overflow_healed"], events: [{ kind: "session.error" }] },
  },
  {
    id: "K26", ws: "W5", implemented: true, title: "413 payload terlalu besar",
    prompt: "payload",
    script: [{ kind: "error", status: 413, body: { error: { message: "request entity too large" } } }],
    expect: { events: [{ kind: "session.error" }] },
  },
  {
    id: "K27", ws: "W5", implemented: true, title: "content policy",
    prompt: "policy",
    script: [{ kind: "error", status: 400, body: { error: { message: "Your request was rejected for violating our usage policy" } } }],
    expect: { events: [{ kind: "session.error", category: "provider.content-filter" }] },
  },
  {
    id: "K28", ws: "W5", implemented: true, title: "pesan ambigu -> error",
    prompt: "ambigu",
    script: [{ kind: "error", status: 400, body: { error: { message: "something odd happened" } } }],
    expect: { events: [{ kind: "session.error" }] },
  },
];


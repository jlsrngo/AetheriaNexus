// Conformance scenarios K29–K58 (W6–W12 plus K58 5xx retry).
import { VALID_SUMMARY, text, tool, usage } from "./scenarios-w1-w5.mjs";

export const scenariosW6toW12 = [
  // ---------- W6 compaction ----------
  {
    id: "K29", ws: "W6", implemented: true, title: "konteks 128k terisi 90% -> kompak sebelum langkah",
    prompts: ["mulai K29", "lanjut K29"],
    script: [
      { match: { isCompaction: true }, kind: "sse", chunks: [{ delta: VALID_SUMMARY }], finish: "stop", usage },
      { kind: "sse", chunks: [text("s1")], finish: "stop", usage: { prompt_tokens: 115000, completion_tokens: 100, total_tokens: 115100 } },
      { kind: "sse", chunks: [text("s2")], finish: "stop", usage },
    ],
    expect: { callsAtLeast: 3, events: [{ kind: "session.compaction.start" }, { kind: "session.compacted" }] },
  },
  {
    id: "K30", ws: "W6", implemented: true, title: "kompak memakai 1 panggilan LLM bertemplate",
    prompts: ["mulai K30", "lanjut K30"],
    script: [
      { match: { isCompaction: true }, kind: "sse", chunks: [{ delta: VALID_SUMMARY }], finish: "stop", usage },
      { kind: "sse", chunks: [text("s1")], finish: "stop", usage: { prompt_tokens: 115000, completion_tokens: 100, total_tokens: 115100 } },
      { kind: "sse", chunks: [text("s2")], finish: "stop", usage },
    ],
    check: (_events, requests) => {
      const comps = requests.filter((r) => r.summary?.isCompaction);
      if (comps.length !== 1) return `expected 1 compaction call, got ${comps.length}`;
      return null;
    },
    expect: { calls: 3, events: [{ kind: "session.compacted" }] },
  },
  {
    id: "K31", ws: "W6", implemented: true, title: "shrink ladder saat ringkasan 400",
    prompts: ["mulai K31", "lanjut K31"],
    script: [
      {
        match: { isCompaction: true, maxHits: 1 },
        kind: "error",
        status: 400,
        body: { error: { message: "This model's maximum context length exceeded" } },
      },
      { match: { isCompaction: true }, kind: "sse", chunks: [{ delta: VALID_SUMMARY }], finish: "stop", usage },
      { kind: "sse", chunks: [text("s1 " + "Q".repeat(6000))], finish: "stop", usage: { prompt_tokens: 115000, completion_tokens: 100, total_tokens: 115100 } },
      { kind: "sse", chunks: [text("s2")], finish: "stop", usage },
    ],
    check: (_events, requests) => {
      const comps = requests.filter((r) => r.summary?.isCompaction);
      if (comps.length < 2) return `expected >=2 compaction calls, got ${comps.length}`;
      if (comps[1].summary.charLen >= comps[0].summary.charLen) return "expected second compaction request to shrink";
      return null;
    },
    expect: { callsAtLeast: 4, events: [{ kind: "session.compacted" }] },
  },
  {
    id: "K32", ws: "W6", implemented: true, title: "precompute berjalan sebelum melewati ceiling",
    prompts: ["awal K32", "tengah K32", "akhir K32"],
    configFlags: ["background_compaction"],
    configPatch: { experimental: { background_compaction: true } },
    script: [
      { match: { isCompaction: true }, kind: "sse", chunks: [{ delta: VALID_SUMMARY }], finish: "stop", usage },
      { kind: "sse", chunks: [text("step1")], finish: "stop", usage: { prompt_tokens: 1000, completion_tokens: 50 } },
      { kind: "sse", chunks: [text("step2")], finish: "stop", usage: { prompt_tokens: 75000, completion_tokens: 50 } },
      { kind: "sse", chunks: [text("step3")], finish: "stop", usage: { prompt_tokens: 500, completion_tokens: 50 } },
    ],
    check: (_events, requests) => {
      const comps = requests.filter((r) => r.summary?.isCompaction);
      if (comps.length !== 1) return `expected 1 background compaction call, got ${comps.length}`;
      return null;
    },
    expect: { calls: 4 },
  },
  {
    id: "K33", ws: "W6", implemented: true, title: "replay transkrip memotong output >2000 char",
    modelId: "clip-model",
    prompt: "kompak clip K33",
    setupFiles: Object.fromEntries(
      ["f1.txt", "f2.txt", "f3.txt", "f4.txt"].map((name) => [
        name,
        Array.from({ length: 180 }, (_, idx) => `${name}-${idx}:${"Z".repeat(140)}`).join("\n") + "\n",
      ]),
    ),
    script: [
      { match: { isCompaction: true }, kind: "sse", chunks: [{ delta: VALID_SUMMARY }], finish: "stop", usage },
      {
        kind: "sse",
        chunks: [
          { toolCall: tool('{"path":"f1.txt"}', true, 0, "c_clip_1", "read") },
          { toolCall: tool('{"path":"f2.txt"}', true, 1, "c_clip_2", "read") },
          { toolCall: tool('{"path":"f3.txt"}', true, 2, "c_clip_3", "read") },
          { toolCall: tool('{"path":"f4.txt"}', true, 3, "c_clip_4", "read") },
        ],
        finish: "tool-calls",
        usage: { prompt_tokens: 24000, completion_tokens: 20 },
      },
      { kind: "sse", chunks: [text("done K33")], finish: "stop", usage: { prompt_tokens: 500, completion_tokens: 20 } },
    ],
    check: (_events, requests) => {
      if (!requests.some((r) => r.summary?.hasTranscriptClip)) return "expected transcript output clipping in compaction";
      return null;
    },
    expect: { callsAtLeast: 3, events: [{ kind: "session.compacted" }] },
  },
  {
    id: "K34", ws: "W6", implemented: true, title: "kompak di tengah turn melanjutkan langkah berikutnya",
    prompt: "multi langkah K34",
    setupFiles: { "a.txt": "isi K34\n" },
    script: [
      { match: { isCompaction: true }, kind: "sse", chunks: [{ delta: VALID_SUMMARY }], finish: "stop", usage },
      { kind: "sse", chunks: [{ toolCall: tool('{"path":"a.txt"}', true) }], finish: "tool-calls", usage: { prompt_tokens: 115000, completion_tokens: 50 } },
      { kind: "sse", chunks: [text("lanjut setelah kompak")], finish: "stop", usage },
    ],
    expect: { calls: 3, events: [{ kind: "llm.tool.success" }, { kind: "session.compacted" }, { kind: "llm.text.delta", frag: "lanjut setelah kompak" }] },
  },

  // ---------- W7 inbox ----------
  {
    id: "K35", ws: "W7", implemented: true, title: "steer masuk di tengah langkah",
    prompt: "kerja steer",
    steer: { text: "tambahan", delivery: "steer", afterMs: 100 },
    script: [
      { kind: "sse", chunks: [{ toolCall: tool(JSON.stringify({ command: "node -e \"setTimeout(()=>{},300)\"" }), true, 0, "c_k35", "shell") }], finish: "tool-calls", usage },
      { kind: "sse", chunks: [text("selesai steer")], finish: "stop", usage },
    ],
    expect: { callsAtLeast: 2 },
  },
  {
    id: "K36", ws: "W7", implemented: true, title: "queue tidak diambil saat turn aktif",
    prompt: "kerja queue",
    steer: { text: "antre saja", delivery: "queue", afterMs: 100 },
    script: [
      { kind: "sse", chunks: [{ toolCall: tool(JSON.stringify({ command: "node -e \"setTimeout(()=>{},300)\"" }), true, 0, "c_k36", "shell") }], finish: "tool-calls", usage },
      { kind: "sse", chunks: [text("turn 1 selesai")], finish: "stop", usage },
      { kind: "sse", chunks: [text("turn 2 selesai")], finish: "stop", usage },
    ],
    check: (_events, requests) => {
      if (requests.length !== 3) return `expected 3 requests, got ${requests.length}`;
      if (JSON.stringify(requests[1]?.body?.messages ?? []).includes("antre saja")) {
        return "queued item delivered mid-turn before step finished";
      }
      if (!JSON.stringify(requests[2]?.body?.messages ?? []).includes("antre saja")) {
        return "queued item never delivered on follow-up boundary";
      }
      return null;
    },
    expect: { calls: 3 },
  },
  {
    id: "K37", ws: "W7", implemented: true, title: "restart engine dengan 2 item inbox tetap terjaga",
    prompt: "mulai K37",
    serviceMode: true,
    restartScenario: {
      type: "inbox-restart",
      queueTexts: ["satu", "dua"],
    },
    script: [
      {
        match: { bodyContains: "mulai K37", once: true },
        kind: "sse",
        chunks: [{ toolCall: tool(JSON.stringify({ command: "node -e \"setTimeout(()=>{},1500)\"" }), true, 0, "c_k37", "shell") }],
        finish: "tool-calls",
        usage,
      },
      { match: { bodyContains: "\"satu\"" }, kind: "sse", chunks: [text("jawab satu")], finish: "stop", usage },
      { match: { bodyContains: "\"dua\"" }, kind: "sse", chunks: [text("jawab dua")], finish: "stop", usage },
    ],
    expect: { callsAtLeast: 3 },
  },
  {
    id: "K38", ws: "W7", implemented: true, title: "urutan enqueued_seq",
    prompt: "kerja",
    expect: { inboxOrder: ["satu", "dua", "tiga"] },
  },

  // ---------- W8 interrupt & shutdown ----------
  {
    id: "K39", ws: "W8", implemented: true, title: "interrupt menghentikan request < 1 s",
    prompt: "lama",
    abortAfterMs: 150,
    script: [{ kind: "sse", chunks: [text("a", 300), text("b", 300)], finish: "stop", usage }],
    expect: { events: [{ kind: "turn.interrupted" }], maxAbortLatencyMs: 1500 },
  },
  {
    id: "K40", ws: "W8", implemented: true, title: "interrupt saat tool berjalan",
    prompt: "tool lama K40",
    abortOnTool: true,
    script: [
      { kind: "sse", chunks: [{ toolCall: tool(JSON.stringify({ command: "node -e \"setTimeout(()=>{},5000)\"" }), true, 0, "c_k40", "shell") }], finish: "tool-calls", usage },
      { kind: "sse", chunks: [text("tidak tercapai")], finish: "stop", usage },
    ],
    expect: { events: [{ kind: "llm.tool.failed" }, { kind: "turn.interrupted" }], maxAbortLatencyMs: 1500 },
  },
  {
    id: "K41", ws: "W8", implemented: true, title: "shutdown saat tool berjalan ditandai recovery",
    prompt: "shutdown tool K41",
    serviceMode: true,
    restartScenario: { type: "shutdown-during-tool" },
    script: [
      {
        match: { bodyContains: "shutdown tool K41", once: true },
        kind: "sse",
        chunks: [{ toolCall: tool(JSON.stringify({ command: "node -e \"setTimeout(()=>{},3000)\"" }), true, 0, "c_k41", "shell") }],
        finish: "tool-calls",
        usage,
      },
      { kind: "sse", chunks: [text("pulih K41")], finish: "stop", usage },
    ],
    expect: { callsAtLeast: 1, events: [{ kind: "turn.idle" }] },
  },

  // ---------- W9 max steps ----------
  {
    id: "K42", ws: "W9", implemented: true, title: "tanpa konfigurasi batas -> 50 langkah berjalan",
    prompt: "loop 50",
    setupFiles: { "a.txt": "x\n" },
    timeoutMs: 45000,
    script: [
      ...Array.from({ length: 50 }, (_, i) => ({
        kind: "sse",
        chunks: [{ toolCall: tool('{"path":"a.txt"}', true, 0, `c_${i}`) }],
        finish: "tool-calls",
        usage,
      })),
      { kind: "sse", chunks: [text("stop_51")], finish: "stop", usage },
    ],
    expect: { calls: 51, events: [{ kind: "llm.text.delta", frag: "stop_51" }, { kind: "turn.idle" }] },
  },
  {
    id: "K43", ws: "W9", implemented: true, title: "batas 3 mengirim toolChoice none dan prompt batas",
    prompt: "batas 3 K43",
    agentId: "capped3",
    setupFiles: { "a.txt": "x\n" },
    script: [
      { kind: "sse", chunks: [{ toolCall: tool('{"path":"a.txt"}', true, 0, "c1") }], finish: "tool-calls", usage },
      { kind: "sse", chunks: [{ toolCall: tool('{"path":"a.txt"}', true, 0, "c2") }], finish: "tool-calls", usage },
      { kind: "sse", chunks: [text("ringkasan akhir")], finish: "stop", usage },
    ],
    check: (_events, requests) => {
      if (requests.length !== 3) return `expected 3 requests, got ${requests.length}`;
      if (requests[2].summary?.toolChoice !== "none") return `expected step 3 toolChoice none, got ${requests[2].summary?.toolChoice}`;
      if (!requests[2].summary?.hasMaxStepsPrompt) return "expected MAXIMUM STEPS REACHED prompt on step 3";
      return null;
    },
    expect: { calls: 3, events: [{ kind: "turn.idle" }] },
  },
  {
    id: "K44", ws: "W9", implemented: true, title: "tool call pada langkah terbatas ditolak",
    prompt: "paksa tool batas 3",
    agentId: "capped3",
    setupFiles: { "a.txt": "x\n" },
    script: [
      { kind: "sse", chunks: [{ toolCall: tool('{"path":"a.txt"}', true, 0, "c1") }], finish: "tool-calls", usage },
      { kind: "sse", chunks: [{ toolCall: tool('{"path":"a.txt"}', true, 0, "c2") }], finish: "tool-calls", usage },
      { kind: "sse", chunks: [{ toolCall: tool('{"path":"a.txt"}', true, 0, "c3") }], finish: "tool-calls", usage },
    ],
    check: (_events, _requests, rawEvents) => {
      if (!JSON.stringify(rawEvents).includes("Tools are disabled after the maximum agent steps")) {
        return "expected max-steps disabled-tools failure event";
      }
      return null;
    },
    expect: { calls: 3, events: [{ kind: "llm.tool.failed" }] },
  },

  // ---------- W10 subagent ----------
  {
    id: "K45", ws: "W10", implemented: true, title: "spawn subagent konteks bersih + balasan sessionID",
    prompt: "RAHASIA_PARENT_K45 spawn subagent",
    expectedTurns: 2,
    script: [
      {
        match: { userContains: "CHILD_TASK_K45" },
        kind: "sse",
        chunks: [{ delay: 250, delta: "anak selesai" }],
        finish: "stop",
        usage,
      },
      {
        kind: "sse",
        chunks: [{
          toolCall: tool(JSON.stringify({ agent: "subGen", description: "child k45", prompt: "CHILD_TASK_K45" }), true, 0, "sub_1", "subagent"),
        }],
        finish: "tool-calls",
        usage,
      },
      { kind: "sse", chunks: [text("induk tunggu")], finish: "stop", usage },
      { kind: "sse", chunks: [text("induk selesai K45")], finish: "stop", usage },
    ],
    check: (_events, requests) => {
      const childReq = requests.find((r) =>
        (r.body.messages ?? []).some((m) => m.role === "user" && JSON.stringify(m.content).includes("CHILD_TASK_K45")),
      );
      if (!childReq) return "missing child request";
      if (JSON.stringify(childReq.body.messages).includes("RAHASIA_PARENT_K45")) return "parent context leaked into child";
      return null;
    },
    expect: { callsAtLeast: 3, events: [{ kind: "llm.tool.call", tool: "subagent" }, { kind: "llm.tool.success" }] },
  },
  {
    id: "K46", ws: "W10", implemented: true, title: "urutan model override C -> agent B -> parent A",
    prompt: "cek prioritas model K46",
    expectedTurns: 2,
    script: [
      { match: { userContains: "USE_OVERRIDE_C" }, kind: "sse", chunks: [{ delay: 250, delta: "ok C" }], finish: "stop", usage },
      { match: { userContains: "USE_AGENT_B" }, kind: "sse", chunks: [{ delay: 250, delta: "ok B" }], finish: "stop", usage },
      {
        kind: "sse",
        chunks: [
          {
            toolCall: tool(
              JSON.stringify({ agent: "agentB", model: "parity/model-c", description: "use C", prompt: "USE_OVERRIDE_C" }),
              true,
              0,
              "c_c",
              "subagent",
            ),
          },
          {
            toolCall: tool(
              JSON.stringify({ agent: "agentB", description: "use B", prompt: "USE_AGENT_B" }),
              true,
              1,
              "c_b",
              "subagent",
            ),
          },
        ],
        finish: "tool-calls",
        usage,
      },
      { kind: "sse", chunks: [text("induk tunggu K46")], finish: "stop", usage },
      { kind: "sse", chunks: [text("induk selesai K46")], finish: "stop", usage },
    ],
    check: (_events, requests) => {
      const hasUser = (r, txt) => (r.body.messages ?? []).some((m) => m.role === "user" && JSON.stringify(m.content).includes(txt));
      const cReq = requests.find((r) => hasUser(r, "USE_OVERRIDE_C"));
      const bReq = requests.find((r) => hasUser(r, "USE_AGENT_B"));
      const aReq = requests.find((r) => hasUser(r, "cek prioritas model K46"));
      if (cReq?.model !== "model-c") return `expected override model-c, got ${cReq?.model}`;
      if (bReq?.model !== "model-b") return `expected agent model-b, got ${bReq?.model}`;
      if (aReq?.model !== "parity-model") return `expected parent parity-model, got ${aReq?.model}`;
      return null;
    },
    expect: { callsAtLeast: 4 },
  },
  {
    id: "K47", ws: "W10", implemented: true, title: "depth default menolak cucu subagent",
    prompt: "uji depth K47",
    expectedTurns: 2,
    script: [
      {
        match: { userContains: "GRANDCHILD_ATTEMPT" },
        kind: "sse",
        chunks: [text("tidak akan dipanggil")],
        finish: "stop",
        usage,
      },
      {
        match: { userContains: "CHILD_SPAWN_GRANDCHILD", once: true },
        kind: "sse",
        chunks: [{
          toolCall: tool(
            JSON.stringify({ agent: "subGen", description: "grand", prompt: "GRANDCHILD_ATTEMPT" }),
            true,
            0,
            "c_gc",
            "subagent",
          ),
        }],
        finish: "tool-calls",
        usage,
      },
      { match: { userContains: "CHILD_SPAWN_GRANDCHILD" }, kind: "sse", chunks: [{ delay: 100, delta: "cucu ditolak" }], finish: "stop", usage },
      {
        kind: "sse",
        chunks: [{
          toolCall: tool(
            JSON.stringify({ agent: "subGen", description: "child", prompt: "CHILD_SPAWN_GRANDCHILD" }),
            true,
            0,
            "c_ch",
            "subagent",
          ),
        }],
        finish: "tool-calls",
        usage,
      },
      { kind: "sse", chunks: [text("induk tunggu K47")], finish: "stop", usage },
      { kind: "sse", chunks: [text("induk selesai K47")], finish: "stop", usage },
    ],
    check: (_events, requests) => {
      const childFollow = requests
        .filter((r) => (r.body.messages ?? []).some((m) => m.role === "user" && JSON.stringify(m.content).includes("CHILD_SPAWN_GRANDCHILD")))
        .at(-1);
      if (!JSON.stringify(childFollow?.body?.messages ?? []).includes("depth limit")) {
        return "expected child to observe depth limit rejection error";
      }
      return null;
    },
    expect: { callsAtLeast: 4 },
  },
  {
    id: "K48", ws: "W10", implemented: true, title: "parent read-only mewariskan blokir write ke anak",
    prompt: "uji ro K48",
    agentId: "roParent",
    permissions: [
      { action: "edit", resource: "*", effect: "deny" },
      { action: "write", resource: "*", effect: "deny" },
    ],
    expectedTurns: 2,
    script: [
      {
        match: { userContains: "CHILD_WRITE_K48", once: true },
        kind: "sse",
        chunks: [{
          toolCall: tool(JSON.stringify({ path: "blocked.txt", content: "forbidden" }), true, 0, "c_w", "write"),
        }],
        finish: "tool-calls",
        usage,
      },
      { match: { userContains: "CHILD_WRITE_K48" }, kind: "sse", chunks: [{ delay: 100, delta: "write blocked" }], finish: "stop", usage },
      {
        kind: "sse",
        chunks: [{
          toolCall: tool(JSON.stringify({ agent: "subGen", description: "ro child", prompt: "CHILD_WRITE_K48" }), true, 0, "c_sub", "subagent"),
        }],
        finish: "tool-calls",
        usage,
      },
      { kind: "sse", chunks: [text("induk tunggu K48")], finish: "stop", usage },
      { kind: "sse", chunks: [text("induk selesai K48")], finish: "stop", usage },
    ],
    expectNoFile: "blocked.txt",
    expect: { callsAtLeast: 4 },
  },
  {
    id: "K49", ws: "W10", implemented: true, title: "3 subagent beda provider berjalan paralel",
    prompt: "paralel 3 anak K49",
    expectedTurns: 2,
    script: [
      { match: { userContains: "PAR_TASK_1" }, kind: "sse", chunks: [{ delay: 600, delta: "p1" }], finish: "stop", usage },
      { match: { userContains: "PAR_TASK_2" }, kind: "sse", chunks: [{ delay: 600, delta: "p2" }], finish: "stop", usage },
      { match: { userContains: "PAR_TASK_3" }, kind: "sse", chunks: [{ delay: 600, delta: "p3" }], finish: "stop", usage },
      {
        kind: "sse",
        chunks: [
          { toolCall: tool(JSON.stringify({ agent: "subGen", model: "parity-p1/m1", description: "p1", prompt: "PAR_TASK_1" }), true, 0, "p1", "subagent") },
          { toolCall: tool(JSON.stringify({ agent: "subGen", model: "parity-p2/m2", description: "p2", prompt: "PAR_TASK_2" }), true, 1, "p2", "subagent") },
          { toolCall: tool(JSON.stringify({ agent: "subGen", model: "parity-p3/m3", description: "p3", prompt: "PAR_TASK_3" }), true, 2, "p3", "subagent") },
        ],
        finish: "tool-calls",
        usage,
      },
      { kind: "sse", chunks: [text("tunggu paralel")], finish: "stop", usage },
      { kind: "sse", chunks: [text("selesai paralel")], finish: "stop", usage },
    ],
    check: (_events, requests) => {
      const children = requests.filter((r) => ["m1", "m2", "m3"].includes(r.model));
      if (children.length !== 3) return `expected 3 parallel child requests, got ${children.length}`;
      const spreadMs = Math.max(...children.map((r) => r.at)) - Math.min(...children.map((r) => r.at));
      if (spreadMs >= 500) return `children did not launch concurrently (spread=${spreadMs}ms)`;
      return null;
    },
    expect: { callsAtLeast: 5 },
  },
  {
    id: "K50", ws: "W10", implemented: true, title: "anak idle 2 ronde -> 2 notifikasi ke parent",
    prompt: "dua ronde K50",
    expectedTurns: 3,
    script: [
      { match: { userContains: "ROUND_2_K50", once: true }, kind: "sse", chunks: [{ delay: 250, delta: "child_r2" }], finish: "stop", usage },
      { match: { userContains: "ROUND_1_K50", userNotContains: "ROUND_2_K50", once: true }, kind: "sse", chunks: [{ delay: 250, delta: "child_r1" }], finish: "stop", usage },
      {
        match: { userContains: "child_r1", bodyNotContains: "ROUND_2_K50", once: true },
        kind: "sse",
        chunks: [{
          toolCall: tool(
            JSON.stringify({ agent: "subGen", sessionID: "{{LAST_SUBAGENT_SESSION_ID}}", description: "r2", prompt: "ROUND_2_K50" }),
            true,
            0,
            "c_r2",
            "subagent",
          ),
        }],
        finish: "tool-calls",
        usage,
      },
      {
        match: { userContains: "dua ronde K50", bodyNotContains: "The subagent is working", once: true },
        kind: "sse",
        chunks: [{
          toolCall: tool(JSON.stringify({ agent: "subGen", description: "r1", prompt: "ROUND_1_K50" }), true, 0, "c_r1", "subagent"),
        }],
        finish: "tool-calls",
        usage,
      },
      { kind: "sse", chunks: [text("parent wait r1")], finish: "stop", usage },
      { kind: "sse", chunks: [text("parent wait r2")], finish: "stop", usage },
      { kind: "sse", chunks: [text("parent all done K50")], finish: "stop", usage },
    ],
    check: (_events, requests) => {
      const hasUser = (r, txt) => (r.body.messages ?? []).some((m) => m.role === "user" && JSON.stringify(m.content).includes(txt));
      const r1 = requests.filter((r) => hasUser(r, "ROUND_1_K50"));
      const r2 = requests.filter((r) => hasUser(r, "ROUND_2_K50"));
      if (r1.length === 0 || r2.length === 0) return "missing round 1 or round 2 child execution";
      return null;
    },
    expect: { callsAtLeast: 5 },
  },
  {
    id: "K51", ws: "W10", implemented: true, title: "follow-up ke anak berjalan masuk sesi yang sama",
    prompt: "followup anak berjalan K51",
    expectedTurns: 2,
    script: [
      { match: { userContains: "SLOW_R1_K51", userNotContains: "FOLLOW_R2_K51", once: true }, kind: "sse", chunks: [{ delay: 600, delta: "r1 done" }], finish: "stop", usage },
      { match: { userContains: "FOLLOW_R2_K51", once: true }, kind: "sse", chunks: [{ delay: 100, delta: "r2 done" }], finish: "stop", usage },
      {
        match: { userContains: "followup anak berjalan K51", bodyNotContains: "The subagent is working", once: true },
        kind: "sse",
        chunks: [{
          toolCall: tool(JSON.stringify({ agent: "subGen", description: "slow child", prompt: "SLOW_R1_K51" }), true, 0, "c_51_1", "subagent"),
        }],
        finish: "tool-calls",
        usage,
      },
      {
        match: { userContains: "followup anak berjalan K51", bodyContains: "The subagent is working", bodyNotContains: "FOLLOW_R2_K51", once: true },
        kind: "sse",
        chunks: [{
          toolCall: tool(
            JSON.stringify({ agent: "subGen", sessionID: "{{LAST_SUBAGENT_SESSION_ID}}", description: "follow running", prompt: "FOLLOW_R2_K51" }),
            true,
            0,
            "c_51_2",
            "subagent",
          ),
        }],
        finish: "tool-calls",
        usage,
      },
      { kind: "sse", chunks: [text("parent K51 tunggu")], finish: "stop", usage },
      { kind: "sse", chunks: [text("parent K51 selesai")], finish: "stop", usage },
    ],
    check: (_events, requests) => {
      const followReq = requests.find((r) =>
        (r.body.messages ?? []).some((m) => m.role === "user" && JSON.stringify(m.content).includes("FOLLOW_R2_K51")),
      );
      if (!followReq) return "follow-up request never reached child";
      if (!JSON.stringify(followReq.body.messages).includes("SLOW_R1_K51")) return "follow-up opened new session instead of joining existing child";
      return null;
    },
    expect: { callsAtLeast: 5 },
  },

  // ---------- W11 crash recovery ----------
  {
    id: "K52", ws: "W11", implemented: true, title: "crash saat subagent berjalan dilanjutkan saat restart",
    prompt: "crash subagent K52",
    serviceMode: true,
    restartScenario: { type: "subagent-crash", restarts: 1 },
    script: [
      { match: { userContains: "CHILD_CRASH_K52", maxHits: 1 }, kind: "sse", chunks: [{ delay: 3000, delta: "before crash" }], finish: "stop", usage },
      { match: { userContains: "CHILD_CRASH_K52" }, kind: "sse", chunks: [text("child pulih K52")], finish: "stop", usage },
      {
        match: { userContains: "crash subagent K52", bodyNotContains: "The subagent is working", once: true },
        kind: "sse",
        chunks: [{
          toolCall: tool(JSON.stringify({ agent: "subGen", description: "crash child", prompt: "CHILD_CRASH_K52" }), true, 0, "c_52", "subagent"),
        }],
        finish: "tool-calls",
        usage,
      },
      { kind: "sse", chunks: [text("parent pulih K52")], finish: "stop", usage },
    ],
    expect: { callsAtLeast: 4, events: [{ kind: "turn.idle" }] },
  },
  {
    id: "K53", ws: "W11", implemented: true, title: "restart 2x berturut tidak membuat job ganda",
    prompt: "double crash K53",
    serviceMode: true,
    restartScenario: { type: "subagent-crash", restarts: 2 },
    script: [
      { match: { userContains: "CHILD_CRASH_K53", maxHits: 2 }, kind: "sse", chunks: [{ delay: 3000, delta: "hang" }], finish: "stop", usage },
      { match: { userContains: "CHILD_CRASH_K53" }, kind: "sse", chunks: [text("child pulih K53")], finish: "stop", usage },
      {
        match: { userContains: "double crash K53", bodyNotContains: "The subagent is working", once: true },
        kind: "sse",
        chunks: [{
          toolCall: tool(JSON.stringify({ agent: "subGen", description: "double crash child", prompt: "CHILD_CRASH_K53" }), true, 0, "c_53", "subagent"),
        }],
        finish: "tool-calls",
        usage,
      },
      { kind: "sse", chunks: [text("parent pulih K53")], finish: "stop", usage },
    ],
    check: (_events, requests) => {
      const spawns = requests.filter((r) => JSON.stringify(r.body.messages).includes("double crash K53") && !JSON.stringify(r.body.messages).includes("The subagent is working"));
      if (spawns.length > 2) return `possible duplicate spawn (${spawns.length})`;
      return null;
    },
    expect: { callsAtLeast: 4, events: [{ kind: "turn.idle" }] },
  },
  {
    id: "K54", ws: "W11", implemented: true, title: "restart saat kompak menandai compaction.interrupted lalu pulih",
    prompt: "mulai K54",
    serviceMode: true,
    restartScenario: { type: "compaction-crash" },
    script: [
      { match: { isCompaction: true, maxHits: 1 }, kind: "sse", chunks: [{ delay: 5000, delta: VALID_SUMMARY }], finish: "stop", usage },
      { match: { isCompaction: true }, kind: "sse", chunks: [{ delta: VALID_SUMMARY }], finish: "stop", usage },
      {
        match: { bodyContains: "mulai K54", bodyNotContains: "s1 K54", once: true },
        kind: "sse",
        chunks: [{ toolCall: tool(JSON.stringify({ command: "echo s1_k54" }), true, 0, "c_54", "shell") }],
        finish: "tool-calls",
        usage: { prompt_tokens: 115000, completion_tokens: 100, total_tokens: 115100 },
      },
      { kind: "sse", chunks: [text("selesai K54")], finish: "stop", usage },
    ],
    expect: { callsAtLeast: 3, events: [{ kind: "session.error", category: "compaction.interrupted" }, { kind: "session.compacted" }, { kind: "turn.idle" }] },
  },
  {
    id: "K55", ws: "W11", implemented: true, title: "tool setengah jalan saat restart settle dan pulih",
    prompt: "tool crash K55",
    serviceMode: true,
    restartScenario: { type: "tool-crash" },
    script: [
      {
        match: { bodyContains: "tool crash K55", once: true },
        kind: "sse",
        chunks: [{
          toolCall: tool(JSON.stringify({ command: "node -e \"setTimeout(()=>{},5000)\"" }), true, 0, "c_55", "shell"),
        }],
        finish: "tool-calls",
        usage,
      },
      { kind: "sse", chunks: [text("pulih K55")], finish: "stop", usage },
    ],
    expect: { callsAtLeast: 2, events: [{ kind: "turn.idle" }] },
  },

  // ---------- W12 event schema ----------
  {
    id: "K56", ws: "W12", implemented: true, title: "satu turn penuh memetakan semua event",
    prompt: "turn penuh",
    script: [{ kind: "sse", chunks: [{ reasoning: "r" }, text("teks", 120)], finish: "stop", usage }],
    expect: { events: [{ kind: "llm.reasoning" }, { kind: "llm.text.delta", frag: "teks" }, { kind: "llm.finish" }, { kind: "turn.idle" }] },
  },
  {
    id: "K57", ws: "W12", implemented: true, title: "penanda paralel konsisten",
    prompt: "dua tool",
    setupFiles: { "a.txt": "A\n", "b.txt": "B\n" },
    script: [
      {
        kind: "sse",
        chunks: [
          { toolCall: tool('{"path":"a.txt"}', true, 0, "call_1") },
          { toolCall: tool('{"path":"b.txt"}', true, 1, "call_2") },
        ],
        finish: "tool-calls",
        usage,
      },
      { kind: "sse", chunks: [text("done")], finish: "stop", usage },
    ],
    expect: { events: [{ kind: "llm.tool.call" }, { kind: "llm.tool.call" }, { kind: "turn.idle" }] },
  },

  // ---------- W4 5xx (F0-7 category coverage) ----------
  {
    id: "K58", ws: "W4", implemented: true, title: "503 diulang lalu pulih",
    prompt: "5xx retry",
    script: [
      { kind: "error", status: 503, body: { error: { message: "service unavailable" } } },
      { kind: "error", status: 503, body: { error: { message: "service unavailable" } } },
      { kind: "sse", chunks: [text("pulih 503")], finish: "stop", usage },
    ],
    expect: { calls: 3, events: [{ kind: "session.retry", attempt: 2 }, { kind: "llm.text.delta", frag: "pulih 503" }, { kind: "turn.idle" }] },
  },
];

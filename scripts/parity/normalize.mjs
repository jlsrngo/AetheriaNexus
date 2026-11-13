// Engine event -> canonical parity event. Anything not mapped is dropped, so the
// comparison only covers the contract we claim to match (see doc §11.2).
const str = (v) => (typeof v === "string" ? v : undefined);

const VOLATILE_KEYS = new Set([
  "id",
  "time",
  "sessionID",
  "messageID",
  "assistantMessageID",
  "inboxID",
  "callID",
  "directory",
  "created",
  "completed",
  "started",
  "slug",
  "projectID",
]);

export function scrubString(value) {
  if (typeof value !== "string") return value;
  return value
    .replace(/\b(?:ses|sub)_[A-Za-z0-9]+\b/g, "<session>")
    .replace(/\bmsg_[A-Za-z0-9]+\b/g, "<message>")
    .replace(/\b20\d{2}-\d{2}-\d{2}(?:[T ][0-9:.+-]+Z?)?\b/g, "<timestamp>");
}

/** Remove values that legitimately differ between two runs (ids, timestamps). */
export function stripVolatile(value) {
  if (typeof value === "string") return scrubString(value);
  if (Array.isArray(value)) return value.map(stripVolatile);
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (VOLATILE_KEYS.has(k)) continue;
    out[k] = stripVolatile(v);
  }
  return out;
}

export function normalizeEvent(raw) {
  const type = str(raw?.type);
  if (!type) return null;
  // Properties live in different places depending on the emit path.
  const p = raw.properties ?? raw.data ?? raw.payload ?? {};

  let out;
  switch (type) {
    case "session.next.text.delta":
      out = { kind: "llm.text.delta", frag: str(p.delta) ?? str(p.text) ?? "" };
      break;
    case "session.next.text.started":
      out = { kind: "llm.text.start" };
      break;
    case "session.next.text.ended":
      out = { kind: "llm.text.end", text: str(p.text) ?? "" };
      break;
    case "session.next.reasoning.started":
      out = { kind: "llm.reasoning.start" };
      break;
    case "session.next.reasoning.delta":
      out = { kind: "llm.reasoning", frag: str(p.delta) ?? str(p.text) ?? "" };
      break;
    case "session.next.reasoning.ended":
      out = { kind: "llm.reasoning.end", text: str(p.text) ?? "" };
      break;
    case "session.next.tool.input.started":
      out = { kind: "llm.tool.input.start", tool: str(p.name) ?? str(p.tool) ?? "" };
      break;
    case "session.next.tool.input.delta":
      out = { kind: "llm.tool.input.delta", frag: str(p.delta) ?? "" };
      break;
    case "session.next.tool.input.ended":
      out = { kind: "llm.tool.input.end", text: str(p.text) ?? "" };
      break;
    case "session.next.tool.called":
      out = { kind: "llm.tool.call", tool: str(p.tool) ?? str(p.name) ?? "" };
      break;
    case "session.next.tool.success":
      out = { kind: "llm.tool.success" };
      break;
    case "session.next.tool.failed":
      out = { kind: "llm.tool.failed" };
      break;
    case "session.next.step.ended":
      out = {
        kind: "llm.finish",
        reason: str(p.finish) ?? "stop",
        tokens: p.tokens ?? null,
        cost: p.cost ?? null,
      };
      break;
    case "session.retry.scheduled":
    case "session.retry":
      out = { kind: "session.retry", attempt: p.attempt ?? null };
      break;
    case "session.compaction.started":
      out = { kind: "session.compaction.start" };
      break;
    case "session.compaction.delta":
      out = { kind: "session.compaction.delta", frag: str(p.text) ?? str(p.delta) ?? "" };
      break;
    case "session.compaction.ended":
    case "session.compacted":
      out = { kind: "session.compacted" };
      break;
    case "session.compaction.failed":
      out = { kind: "session.error", category: str(p.error?.type) ?? str(p.category) ?? "compaction" };
      break;
    case "session.overflow_healed":
      out = { kind: "session.overflow_healed" };
      break;
    case "session.failover":
      out = { kind: "session.failover", to: str(p.model) ?? str(p.to) ?? "" };
      break;
    case "session.error":
    case "session.step.failed":
    case "session.execution.failed":
    case "error":
      out = {
        kind: "session.error",
        category: str(p.category) ?? str(p.error?.type) ?? str(p.type) ?? str(p.message) ?? "unknown",
      };
      break;
    case "session.execution.interrupted":
    case "session.interrupted":
    case "session.aborted":
      out = { kind: "turn.interrupted" };
      break;
    case "session.execution.succeeded":
    case "session.idle":
      out = { kind: "turn.idle" };
      break;
    default:
      return null;
  }
  return stripVolatile(out);
}

export function normalizeEvents(list) {
  const out = [];
  for (const raw of list) {
    const n = normalizeEvent(raw);
    if (n) out.push(n);
  }
  return out;
}

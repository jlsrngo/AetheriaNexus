// OpenCode event -> same canonical parity event used by Aetheria.
// Volatile IDs, timestamps, and envelopes are intentionally excluded.
import { stripVolatile } from "./normalize.mjs";

const str = (v) => (typeof v === "string" ? v : undefined);

export function normalizeEvent(raw) {
  const type = str(raw?.type);
  if (!type) return null;
  const p = raw?.data ?? raw?.properties ?? raw?.payload ?? {};

  let out;
  switch (type) {
    case "session.text.started":
      out = { kind: "llm.text.start" };
      break;
    case "session.text.delta":
      out = { kind: "llm.text.delta", frag: str(p.delta) ?? "" };
      break;
    case "session.text.ended":
      out = { kind: "llm.text.end", text: str(p.text) ?? "" };
      break;
    case "session.reasoning.started":
      out = { kind: "llm.reasoning.start" };
      break;
    case "session.reasoning.delta":
      out = { kind: "llm.reasoning", frag: str(p.delta) ?? "" };
      break;
    case "session.reasoning.ended":
      out = { kind: "llm.reasoning.end", text: str(p.text) ?? "" };
      break;
    case "session.tool.input.started":
      out = { kind: "llm.tool.input.start", tool: str(p.name) ?? "" };
      break;
    case "session.tool.input.delta":
      out = { kind: "llm.tool.input.delta", frag: str(p.delta) ?? "" };
      break;
    case "session.tool.input.ended":
      out = { kind: "llm.tool.input.end", text: str(p.text) ?? "" };
      break;
    case "session.tool.called":
      out = { kind: "llm.tool.call", tool: str(p.name) ?? "" };
      break;
    case "session.tool.success":
      out = { kind: "llm.tool.success" };
      break;
    case "session.tool.failed":
      out = { kind: "llm.tool.failed" };
      break;
    case "session.step.ended":
      out = {
        kind: "llm.finish",
        reason: str(p.finish) ?? "unknown",
        tokens: p.tokens ?? null,
        cost: p.cost ?? null,
      };
      break;
    case "session.step.failed":
      out = {
        kind: "session.error",
        category: str(p.error?.type) ?? str(p.error?.name) ?? "unknown",
      };
      break;
    case "session.retry.scheduled":
      out = { kind: "session.retry", attempt: p.attempt ?? null };
      break;
    case "session.compaction.started":
      out = { kind: "session.compaction.start" };
      break;
    case "session.compaction.delta":
      out = { kind: "session.compaction.delta", frag: str(p.text) ?? "" };
      break;
    case "session.compaction.ended":
      out = { kind: "session.compacted" };
      break;
    case "session.compaction.failed":
      out = { kind: "session.error", category: str(p.error?.type) ?? "compaction" };
      break;
    case "session.execution.failed":
      out = { kind: "session.error", category: str(p.error?.type) ?? "execution" };
      break;
    case "session.execution.interrupted":
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
    const normalized = normalizeEvent(raw);
    if (normalized) out.push(normalized);
  }
  return out;
}

export { stripVolatile };

import { Bot, FileSearch, Film, Image as ImageIcon, Mic, type LucideIcon } from "lucide-react";

export interface SubagentBadgeMeta {
  name: string;
  Icon: LucideIcon;
  color: string;
}

/**
 * Returns icon and label metadata ONLY for subagent turns.
 * Main/default agent turns return null so ordinary assistant replies render without a role header.
 */
export function getSubagentMeta(agent?: string): SubagentBadgeMeta | null {
  const normalized = (agent || "").trim();
  const lower = normalized.toLowerCase();
  if (!lower || lower === "default" || lower === "main") {
    return null;
  }
  if (lower.includes("audio") || lower.includes("sound") || lower.includes("voice")) {
    return { name: "Audio Producer", Icon: Mic, color: "text-amber-400" };
  }
  if (lower.includes("motion") || lower.includes("video")) {
    return { name: "Motion Engineer", Icon: Film, color: "text-indigo-400" };
  }
  if (lower.includes("asset") || lower.includes("image") || lower.includes("curator")) {
    return { name: "Asset Curator", Icon: ImageIcon, color: "text-[var(--text-primary)]" };
  }
  if (lower.includes("research") || lower.includes("analyst")) {
    return { name: "Research Assistant", Icon: FileSearch, color: "text-sky-400" };
  }
  return { name: normalized, Icon: Bot, color: "text-[var(--text-secondary)]" };
}


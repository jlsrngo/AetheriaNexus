import type { StepItem } from "../LiveExecutionBadge";
import type { StudioColumnRole, SubagentTrackState, SubagentTrackStep } from "./types";

export interface StudioColumnEntry {
  id: string;
  label: string;
  status: "running" | "completed" | "failed";
  source: "subagent" | "main";
}

export interface StudioColumnData {
  role: StudioColumnRole;
  title: string;
  subtitle: string;
  status: "idle" | "running" | "completed" | "failed";
  sourceLabel: string;
  activeLabel: string;
  entries: StudioColumnEntry[];
}

/** Resolves human-readable specialist title matching backend Rust `tool_label_formatter.rs`. */
export function resolveSubagentDisplayTitle(subagentType?: string): string {
  const normalized = (subagentType || "").trim().toLowerCase();
  if (normalized === "audio-director" || normalized.includes("audio")) return "Audio Producer";
  if (normalized === "motion-designer" || normalized.includes("motion")) return "Motion Engineer";
  if (normalized === "qa-verifier" || normalized.includes("qa") || normalized.includes("verif")) {
    return "QA Verifier";
  }
  if (normalized === "explore" || normalized.includes("research")) return "Research Assistant";
  return subagentType?.trim() || "Specialist";
}

/** Classifies a subagent type or tool step into one of the 3 studio production columns. */
export function classifyStudioColumn(hint: string, label = ""): StudioColumnRole {
  const combined = `${hint} ${label}`.toLowerCase();
  if (
    combined.includes("audio-director") ||
    combined.includes("audio producer") ||
    combined.includes("voicebox") ||
    combined.includes("generate_speech") ||
    combined.includes("voiceover") ||
    combined.includes(".wav") ||
    combined.includes(".words.json")
  ) {
    return "audio";
  }
  if (
    combined.includes("motion-designer") ||
    combined.includes("motion engineer") ||
    combined.includes("qa-verifier") ||
    combined.includes("qa verifier") ||
    combined.includes("scene") ||
    combined.includes("aetheria-motion") ||
    combined.includes("index.html") ||
    combined.includes(".js") ||
    combined.includes("storyboard")
  ) {
    return "script";
  }
  return "director";
}

/** Applies a real-time SSE `subagent_*` event immutably to the live track list. */
export function applySubagentEventToTracks(
  prev: SubagentTrackState[],
  event: { type: string; data?: Record<string, unknown> },
): SubagentTrackState[] {
  const d = event.data ?? {};
  const sessionId =
    typeof d.subagentSessionId === "string"
      ? d.subagentSessionId
      : typeof d.sessionID === "string"
      ? d.sessionID
      : "";
  const subagentType =
    typeof d.subagentType === "string" ? d.subagentType : "general";
  const role = classifyStudioColumn(subagentType);
  const title = resolveSubagentDisplayTitle(subagentType);

  if (event.type === "subagent_started") {
    const description = typeof d.description === "string" ? d.description : undefined;
    const timestamp = typeof d.timestamp === "number" ? d.timestamp : Date.now();
    const nextTrack: SubagentTrackState = {
      sessionId: sessionId || `sub-${Date.now()}-${prev.length}`,
      subagentType,
      role,
      title,
      description,
      status: "running",
      tools: [],
      startedAt: timestamp,
    };
    const existingIdx = prev.findIndex((t) => t.sessionId === nextTrack.sessionId);
    if (existingIdx >= 0) {
      return prev.map((t, i) => (i === existingIdx ? { ...t, ...nextTrack } : t));
    }
    return [...prev, nextTrack];
  }

  if (event.type === "subagent_tool_called" || event.type === "subagent_tool_completed") {
    const callId =
      typeof d.callID === "string" ? d.callID : `call-${Date.now()}`;
    const toolName = typeof d.tool === "string" ? d.tool : "tool";
    const label =
      typeof d.label === "string" && d.label.trim() ? d.label : toolName;
    const isCompleted = event.type === "subagent_tool_completed";
    const isOk = d.ok !== false && !d.error;
    const stepStatus: SubagentTrackStep["status"] = isCompleted
      ? isOk
        ? "completed"
        : "failed"
      : "running";

    const targetIdx = sessionId
      ? prev.findIndex((t) => t.sessionId === sessionId)
      : prev.findIndex((t) => t.subagentType === subagentType && t.status === "running");

    const upsertTools = (tools: SubagentTrackStep[]): SubagentTrackStep[] => {
      const idx = tools.findIndex((s) => s.id === callId);
      const nextStep: SubagentTrackStep = { id: callId, label, status: stepStatus, toolName };
      if (idx >= 0) {
        return tools.map((s, i) => (i === idx ? nextStep : s));
      }
      return [...tools, nextStep];
    };

    if (targetIdx >= 0) {
      return prev.map((t, i) =>
        i === targetIdx ? { ...t, tools: upsertTools(t.tools) } : t,
      );
    }

    return [
      ...prev,
      {
        sessionId: sessionId || `sub-${subagentType}-${prev.length}`,
        subagentType,
        role,
        title,
        status: "running",
        tools: [{ id: callId, label, status: stepStatus, toolName }],
      },
    ];
  }

  if (event.type === "subagent_completed") {
    const timestamp = typeof d.timestamp === "number" ? d.timestamp : Date.now();
    const isOk = d.ok !== false && !d.error;
    const targetIdx = sessionId
      ? prev.findIndex((t) => t.sessionId === sessionId)
      : prev.findIndex((t) => t.subagentType === subagentType && t.status === "running");
    if (targetIdx < 0) return prev;
    return prev.map((t, i) =>
      i === targetIdx
        ? {
            ...t,
            status: isOk ? "completed" : "failed",
            completedAt: timestamp,
            tools: t.tools.map((tool) =>
              tool.status === "running"
                ? { ...tool, status: isOk ? "completed" : "failed" }
                : tool,
            ),
          }
        : t,
    );
  }

  return prev;
}

/** Determines whether a turn has studio production tasks/subagents worth showing as 3 columns. */
export function shouldShowStudioColumns(
  steps: StepItem[] | undefined,
  tracks: SubagentTrackState[] | undefined,
): boolean {
  if (tracks && tracks.length > 0) return true;
  if (!steps || steps.length === 0) return false;
  return steps.some((step) => {
    const t = (step.toolName || "").toLowerCase();
    const l = (step.label || "").toLowerCase();
    return (
      t === "task" ||
      t.includes("voicebox") ||
      t === "todowrite" ||
      t.includes("render") ||
      t.includes("storyboard") ||
      l.includes("audio producer") ||
      l.includes("motion engineer") ||
      l.includes(".wav") ||
      l.includes("scene") ||
      l.includes("index.html")
    );
  });
}

function summarizeColumnStatus(
  entries: StudioColumnEntry[],
  trackStatuses: Array<"running" | "completed" | "failed">,
): StudioColumnData["status"] {
  if (
    trackStatuses.includes("running") ||
    entries.some((e) => e.status === "running")
  ) {
    return "running";
  }
  if (
    trackStatuses.includes("failed") ||
    entries.some((e) => e.status === "failed")
  ) {
    return "failed";
  }
  if (trackStatuses.length > 0 || entries.length > 0) {
    return "completed";
  }
  return "idle";
}

function mapStepStatus(s: StepItem["status"]): "running" | "completed" | "failed" {
  if (s === "running") return "running";
  if (s === "failed" || s === "error" || s === "blocked") return "failed";
  return "completed";
}

/** Builds the 3 parallel studio columns: 1. Director, 2. Audio, 3. Script & Visual. */
export function deriveStudioColumns(
  steps: StepItem[] | undefined,
  tracks: SubagentTrackState[] | undefined,
): StudioColumnData[] {
  const safeTracks = tracks ?? [];
  const safeSteps = (steps ?? []).filter((s) => s.iconType === "tool");

  const trackByRole: Record<StudioColumnRole, SubagentTrackState[]> = {
    director: [],
    audio: [],
    script: [],
  };
  for (const track of safeTracks) {
    trackByRole[track.role].push(track);
  }

  const entriesByRole: Record<StudioColumnRole, StudioColumnEntry[]> = {
    director: [],
    audio: [],
    script: [],
  };

  // Add real spawned subagent steps to their respective columns first.
  for (const track of safeTracks) {
    if (track.tools.length === 0) {
      entriesByRole[track.role].push({
        id: `${track.sessionId}-init`,
        label: track.description || `${track.title} started`,
        status: track.status,
        source: "subagent",
      });
    } else {
      for (const tool of track.tools) {
        entriesByRole[track.role].push({
          id: `${track.sessionId}-${tool.id}`,
          label: tool.label,
          status: tool.status,
          source: "subagent",
        });
      }
    }
  }

  // Classify main coordinator steps cleanly so Col 1 shows planning/delegation/render
  // and direct audio/script steps still slot visibly into Col 2 / Col 3 if run inline.
  for (const step of safeSteps) {
    const tName = (step.toolName || "").toLowerCase();
    const stepRole =
      tName === "task"
        ? classifyStudioColumn("", step.label)
        : classifyStudioColumn(step.toolName || "", step.label);

    if (tName === "task") {
      // Keep coordination dispatch record in Col 1 AND mirror summary into Col 2/3 if no track exists yet.
      entriesByRole.director.push({
        id: `dir-${step.id}`,
        label: step.label,
        status: mapStepStatus(step.status),
        source: "main",
      });
      if (stepRole !== "director" && trackByRole[stepRole].length === 0) {
        entriesByRole[stepRole].push({
          id: `delegated-${step.id}`,
          label: step.label,
          status: mapStepStatus(step.status),
          source: "subagent",
        });
      }
      continue;
    }

    entriesByRole[stepRole].push({
      id: `main-${step.id}`,
      label: step.label,
      status: mapStepStatus(step.status),
      source: "main",
    });
  }

  const configs: Array<{ role: StudioColumnRole; title: string; subtitle: string; emptyText: string }> = [
    {
      role: "director",
      title: "1. Director",
      subtitle: "Plan, Sync & Render",
      emptyText: "Coordinating production",
    },
    {
      role: "audio",
      title: "2. Audio",
      subtitle: "Voice & Word Sync",
      emptyText: "Awaiting audio track",
    },
    {
      role: "script",
      title: "3. Script",
      subtitle: "Scenes & Motion JS",
      emptyText: "Awaiting scene scripts",
    },
  ];

  return configs.map((cfg) => {
    const entries = entriesByRole[cfg.role];
    const roleTracks = trackByRole[cfg.role];
    const trackStatuses = roleTracks.map((t) => t.status);
    const status = summarizeColumnStatus(entries, trackStatuses);
    const hasSubagent =
      roleTracks.length > 0 || entries.some((e) => e.source === "subagent");
    const activeEntry =
      entries.find((e) => e.status === "running") ?? entries[entries.length - 1];

    return {
      role: cfg.role,
      title: cfg.title,
      subtitle: cfg.subtitle,
      status,
      sourceLabel:
        cfg.role === "director"
          ? "Main"
          : hasSubagent
          ? "Subagent"
          : entries.length > 0
          ? "Direct"
          : "Standby",
      activeLabel: activeEntry?.label ?? cfg.emptyText,
      entries,
    };
  });
}


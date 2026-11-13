import type { StepItem } from "../LiveExecutionBadge";
import type { SessionJobRecord, StudioColumnRole, SubagentTrackState, SubagentTrackStep } from "./types";

export interface StudioColumnEntry {
  id: string;
  label: string;
  status: "standby" | "running" | "completed" | "failed";
  source: "subagent" | "main";
}

export interface StudioColumnData {
  role: StudioColumnRole;
  title: string;
  subtitle: string;
  status: "idle" | "standby" | "running" | "completed" | "failed";
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
      return prev.map((t, i) =>
        i === existingIdx
          ? { ...t, ...nextTrack, standbyLabel: undefined, tools: t.tools }
          : t,
      );
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
    const isStandbyTool = toolName.trim().toLowerCase() === "standby";
    const stepStatus: SubagentTrackStep["status"] = isStandbyTool
      ? isCompleted
        ? isOk
          ? "completed"
          : "failed"
        : "standby"
      : isCompleted
      ? isOk
        ? "completed"
        : "failed"
      : "running";

    const targetIdx = sessionId
      ? prev.findIndex((t) => t.sessionId === sessionId)
      : prev.findIndex(
          (t) =>
            t.subagentType === subagentType &&
            (t.status === "running" || t.status === "standby"),
        );

    const upsertTools = (tools: SubagentTrackStep[]): SubagentTrackStep[] => {
      const idx = tools.findIndex((s) => s.id === callId);
      const nextStep: SubagentTrackStep = { id: callId, label, status: stepStatus, toolName };
      if (idx >= 0) {
        return tools.map((s, i) => (i === idx ? nextStep : s));
      }
      return [...tools, nextStep];
    };

    const resolveTrackStatus = (current: SubagentTrackState["status"]): SubagentTrackState["status"] => {
      if (isStandbyTool && !isCompleted) return "standby";
      if (isStandbyTool && isCompleted) return isOk ? "running" : "failed";
      if (!isCompleted) return "running";
      return current === "standby" ? "running" : current;
    };

    if (targetIdx >= 0) {
      return prev.map((t, i) =>
        i === targetIdx
          ? {
              ...t,
              status: resolveTrackStatus(t.status),
              standbyLabel:
                isStandbyTool && !isCompleted
                  ? label
                  : undefined,
              tools: upsertTools(t.tools),
            }
          : t,
      );
    }

    return [
      ...prev,
      {
        sessionId: sessionId || `sub-${subagentType}-${prev.length}`,
        subagentType,
        role,
        title,
        status: isStandbyTool && !isCompleted ? "standby" : "running",
        standbyLabel: isStandbyTool && !isCompleted ? label : undefined,
        tools: [{ id: callId, label, status: stepStatus, toolName }],
      },
    ];
  }

  if (event.type === "subagent_completed") {
    const timestamp = typeof d.timestamp === "number" ? d.timestamp : Date.now();
    const isOk = d.ok !== false && !d.error;
    const targetIdx = sessionId
      ? prev.findIndex((t) => t.sessionId === sessionId)
      : prev.findIndex(
          (t) =>
            t.subagentType === subagentType &&
            (t.status === "running" || t.status === "standby"),
        );
    if (targetIdx < 0) return prev;
    return prev.map((t, i) =>
      i === targetIdx
        ? {
            ...t,
            status: isOk ? "completed" : "failed",
            standbyLabel: undefined,
            completedAt: timestamp,
            tools: t.tools.map((tool) =>
              tool.status === "running" || tool.status === "standby"
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
  trackStatuses: Array<SubagentTrackState["status"]>,
): StudioColumnData["status"] {
  if (
    trackStatuses.includes("running") ||
    entries.some((e) => e.status === "running")
  ) {
    return "running";
  }
  if (
    trackStatuses.includes("standby") ||
    entries.some((e) => e.status === "standby")
  ) {
    return "standby";
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
      title: "delegating",
      subtitle: "Plan, Sync & Render",
      emptyText: "Coordinating production",
    },
    {
      role: "audio",
      title: "audio",
      subtitle: "Voice & Word Sync",
      emptyText: "Awaiting audio track",
    },
    {
      role: "script",
      title: "script",
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
      entries.find((e) => e.status === "running") ??
      entries.find((e) => e.status === "standby") ??
      entries[entries.length - 1];

    return {
      role: cfg.role,
      title: cfg.title,
      subtitle: cfg.subtitle,
      status,
      sourceLabel:
        cfg.role === "director"
          ? "Main"
          : status === "standby"
          ? "Standby"
          : hasSubagent
          ? "Subagent"
          : entries.length > 0
          ? "Direct"
          : "Idle",
      activeLabel: activeEntry?.label ?? cfg.emptyText,
      entries,
    };
  });
}

function mapJobStatusToTrackStatus(
  jobStatus: SessionJobRecord["status"],
  standby?: boolean,
): SubagentTrackState["status"] {
  if (standby && jobStatus === "running") return "standby";
  if (jobStatus === "queued" || jobStatus === "standby") return "standby";
  if (jobStatus === "running") return "running";
  if (jobStatus === "failed" || jobStatus === "error" || jobStatus === "cancelled") return "failed";
  return "completed";
}

function hasResolvedStandbyStep(track: SubagentTrackState): boolean {
  return track.tools.some(
    (step) => step.toolName.trim().toLowerCase() === "standby" && step.status !== "standby",
  );
}

/** Merges persisted `/api/session/:id/jobs` records with live SSE subagent tracks without dropping live tool steps. */
export function reconcileTracksWithJobs(
  prev: SubagentTrackState[],
  jobs: SessionJobRecord[],
): SubagentTrackState[] {
  if (!jobs || jobs.length === 0) return prev;
  const bySessionId = new Map<string, SubagentTrackState>();
  for (const track of prev) {
    bySessionId.set(track.sessionId, track);
  }

  for (const job of jobs) {
    const childId = job.childSessionId ?? job.child_session_id;
    if (!childId) continue;
    const existing = bySessionId.get(childId);
    const jobTrackStatus = mapJobStatusToTrackStatus(job.status, job.standby);
    const subagentType = job.subagentType ?? job.subagent_type ?? existing?.subagentType ?? "general";
    const createdAt = job.createdAt ?? job.created_at;
    const updatedAt = job.updatedAt ?? job.updated_at;
    const title = resolveSubagentDisplayTitle(subagentType);
    const role = classifyStudioColumn(subagentType);

    if (existing) {
      const sseAlreadyLeftStandby =
        jobTrackStatus === "standby" && hasResolvedStandbyStep(existing);
      const nextStatus = sseAlreadyLeftStandby ? existing.status : jobTrackStatus;
      const nextStandbyLabel =
        nextStatus === "standby"
          ? existing.standbyLabel || "Standby — menunggu slot provider"
          : undefined;
      bySessionId.set(childId, {
        ...existing,
        subagentType,
        title,
        role,
        status: nextStatus,
        standbyLabel: nextStandbyLabel,
        description: existing.description || job.description,
        startedAt: existing.startedAt ?? createdAt,
        completedAt:
          nextStatus === "completed" || nextStatus === "failed"
            ? existing.completedAt ?? updatedAt
            : existing.completedAt,
      });
    } else {
      bySessionId.set(childId, {
        sessionId: childId,
        subagentType,
        role,
        title,
        description: job.description,
        status: jobTrackStatus,
        standbyLabel:
          jobTrackStatus === "standby"
            ? "Standby — menunggu slot provider"
            : undefined,
        tools: [],
        startedAt: createdAt,
        completedAt:
          jobTrackStatus === "completed" || jobTrackStatus === "failed"
            ? updatedAt
            : undefined,
      });
    }
  }

  return Array.from(bySessionId.values()).sort(
    (a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0),
  );
}

/** Groups tracks for compact composer pill summary (`running`, `standby`, `completed`, `failed`). */
export function partitionSubagentTracks(tracks: SubagentTrackState[]) {
  const active: SubagentTrackState[] = [];
  const standby: SubagentTrackState[] = [];
  const completed: SubagentTrackState[] = [];
  const failed: SubagentTrackState[] = [];

  for (const t of tracks) {
    if (t.status === "running") active.push(t);
    else if (t.status === "standby") standby.push(t);
    else if (t.status === "failed") failed.push(t);
    else completed.push(t);
  }

  return {
    active,
    standby,
    completed,
    failed,
    liveCount: active.length + standby.length,
  };
}


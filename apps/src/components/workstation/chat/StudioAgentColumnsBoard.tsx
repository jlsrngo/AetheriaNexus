import React, { useState } from "react";
import { Check, ChevronDown, ChevronUp, Clapperboard, Clock, Code2, Loader2, Mic, X } from "lucide-react";
import { cn } from "../../../lib/utils";
import type { StepItem } from "../LiveExecutionBadge";
import type { StudioColumnRole, SubagentTrackState } from "./types";
import { deriveStudioColumns, shouldShowStudioColumns } from "./studioTrackUtils";

interface StudioAgentColumnsBoardProps {
  steps?: StepItem[];
  subagentTracks?: SubagentTrackState[];
  isStreaming?: boolean;
}

function ColumnIcon({ role }: { role: StudioColumnRole }) {
  if (role === "audio") return <Mic className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
  if (role === "script") return <Code2 className="w-3.5 h-3.5 text-[var(--text-primary)] shrink-0" />;
  return <Clapperboard className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
}

/** Vertical stacked accordion bars for parallel studio tracks: delegating, audio, and script. */
export const StudioAgentColumnsBoard: React.FC<StudioAgentColumnsBoardProps> = ({
  steps,
  subagentTracks,
  isStreaming = false,
}) => {
  const [openMap, setOpenMap] = useState<Partial<Record<StudioColumnRole, boolean>>>({});

  if (!shouldShowStudioColumns(steps, subagentTracks)) {
    return null;
  }

  const columns = deriveStudioColumns(steps, subagentTracks);
  const toggleRole = (role: StudioColumnRole) => {
    setOpenMap((prev) => ({ ...prev, [role]: !prev[role] }));
  };

  return (
    <div className="mb-2 w-full min-w-0 flex flex-col gap-1.5 select-none">
      {columns.map((col) => {
        const isRunning = col.status === "running" && isStreaming;
        const isActiveRunning = col.status === "running";
        const isStandby = col.status === "standby";
        const isFailed = col.status === "failed";
        const isDone = col.status === "completed";
        const isOpen = Boolean(openMap[col.role]);

        return (
          <div
            key={col.role}
            className={cn(
              "w-full min-w-0 rounded-[var(--radius-pill)] border overflow-hidden transition-colors",
              isOpen && "rounded-[var(--radius-card)]",
              isActiveRunning
                ? "bg-[var(--bg-card)] border-emerald-500/45"
                : isStandby
                ? "bg-[var(--bg-card)] border-amber-500/40"
                : isFailed
                ? "bg-rose-500/8 border-rose-500/35"
                : "bg-[var(--bg-card)] border-[var(--border-color)]",
            )}
          >
            <button
              type="button"
              onClick={() => toggleRole(col.role)}
              className="w-full px-3 py-1.5 flex items-center justify-between gap-2 text-left hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400/60 transition-colors cursor-pointer min-w-0"
              title={col.activeLabel}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {isRunning || isActiveRunning ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400 shrink-0" />
                ) : isStandby ? (
                  <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                ) : isFailed ? (
                  <X className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                ) : isDone ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]/60 mx-1 shrink-0" />
                )}

                <ColumnIcon role={col.role} />

                <span className="text-xs font-medium text-[var(--text-primary)] shrink-0">
                  {col.title}
                </span>

                <span className="text-[11px] text-[var(--text-muted)] truncate min-w-0">
                  {col.activeLabel}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="px-1.5 py-0.5 rounded-[var(--radius-pill)] bg-[var(--bg-panel)] border border-[var(--border-color)] font-mono text-[9px] text-[var(--text-muted)]">
                  {col.sourceLabel} · {col.entries.length}
                </span>
                <span className="text-[var(--text-muted)]">
                  {isOpen ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </span>
              </div>
            </button>

            {isOpen && (
              <div className="px-3 pb-2 pt-1.5 bg-[var(--bg-panel)] border-t border-[var(--border-color)] space-y-1 max-h-40 overflow-y-auto">
                {col.entries.length === 0 ? (
                  <div className="text-[11px] text-[var(--text-muted)] py-0.5">
                    {col.activeLabel}
                  </div>
                ) : (
                  col.entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between gap-2 text-[11px] py-0.5"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span
                          className={cn(
                            "w-1.5 h-1.5 rounded-full shrink-0",
                            entry.status === "running"
                              ? "bg-emerald-400 animate-pulse"
                              : entry.status === "standby"
                              ? "bg-amber-500"
                              : entry.status === "failed"
                              ? "bg-rose-400"
                              : "bg-emerald-500/70",
                          )}
                        />
                        <span
                          className={cn(
                            "truncate",
                            entry.status === "running"
                              ? "text-[var(--text-primary)] font-medium"
                              : entry.status === "standby"
                              ? "text-[var(--text-primary)]"
                              : entry.status === "failed"
                              ? "text-rose-500"
                              : "text-[var(--text-secondary)]",
                          )}
                        >
                          {entry.label}
                        </span>
                      </div>
                      <span className="font-mono text-[9px] text-[var(--text-muted)] shrink-0">
                        {entry.status === "running"
                          ? "running"
                          : entry.status === "standby"
                          ? "standby"
                          : entry.status === "failed"
                          ? "failed"
                          : "done"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

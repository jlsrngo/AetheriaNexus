import React, { useState } from "react";
import { Check, ChevronDown, ChevronUp, Clapperboard, Code2, Loader2, Mic, X } from "lucide-react";
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
  if (role === "audio") return <Mic className="w-3 h-3 text-emerald-400 shrink-0" />;
  if (role === "script") return <Code2 className="w-3 h-3 text-emerald-400 shrink-0" />;
  return <Clapperboard className="w-3 h-3 text-amber-400 shrink-0" />;
}

/** Three-column parallel production board: Col 1 Director | Col 2 Audio | Col 3 Script & Motion. */
export const StudioAgentColumnsBoard: React.FC<StudioAgentColumnsBoardProps> = ({
  steps,
  subagentTracks,
  isStreaming = false,
}) => {
  const [expanded, setExpanded] = useState(false);

  if (!shouldShowStudioColumns(steps, subagentTracks)) {
    return null;
  }

  const columns = deriveStudioColumns(steps, subagentTracks);
  const runningCount = columns.filter((c) => c.status === "running").length;

  return (
    <div className="mb-2 w-full min-w-0 rounded-[var(--radius-panel)] bg-[var(--bg-panel)] border border-[var(--border-color)] overflow-hidden select-none">
      {/* Compact Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-2.5 py-1.5 bg-[var(--bg-card)] border-b border-[var(--border-color)] flex items-center justify-between gap-2 text-left hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          {isStreaming && runningCount > 0 ? (
            <Loader2 className="w-3 h-3 animate-spin text-emerald-400 shrink-0" />
          ) : (
            <Check className="w-3 h-3 text-emerald-400 shrink-0" />
          )}
          <span className="text-[11px] font-semibold text-[var(--text-primary)] truncate">
            Studio Production Tracks
          </span>
          <span className="px-1.5 py-0.5 rounded-[var(--radius-pill)] bg-[var(--bg-panel)] border border-[var(--border-color)] font-mono text-[9px] text-[var(--text-secondary)] shrink-0">
            {runningCount > 0 ? `${runningCount} active` : "3 tracks"}
          </span>
        </div>
        <span className="text-[var(--text-muted)] shrink-0">
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </span>
      </button>

      {/* 3 Parallel Specialist Columns: Col 1 Director | Col 2 Audio | Col 3 Script */}
      <div className="p-2 grid grid-cols-3 gap-1.5">
        {columns.map((col) => {
          const isRunning = col.status === "running";
          const isFailed = col.status === "failed";
          const isDone = col.status === "completed";

          return (
            <div
              key={col.role}
              className={cn(
                "min-w-0 rounded-[var(--radius-card)] border p-2 flex flex-col gap-1 transition-colors",
                isRunning
                  ? "bg-emerald-500/8 border-emerald-500/35"
                  : isFailed
                  ? "bg-rose-500/8 border-rose-500/35"
                  : "bg-[var(--bg-card)] border-[var(--border-color)]",
              )}
            >
              <div className="flex items-center justify-between gap-1 min-w-0">
                <div className="flex items-center gap-1 min-w-0">
                  <ColumnIcon role={col.role} />
                  <span className="text-[10px] font-semibold text-[var(--text-primary)] truncate">
                    {col.title}
                  </span>
                </div>
                {isRunning ? (
                  <Loader2 className="w-2.5 h-2.5 animate-spin text-emerald-400 shrink-0" />
                ) : isFailed ? (
                  <X className="w-2.5 h-2.5 text-rose-400 shrink-0" />
                ) : isDone ? (
                  <Check className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-1 text-[9px]">
                <span className="text-[var(--text-muted)] truncate">{col.sourceLabel}</span>
                <span className="font-mono text-[var(--text-muted)] shrink-0">
                  {col.entries.length}
                </span>
              </div>

              <p
                title={col.activeLabel}
                className={cn(
                  "text-[10px] leading-snug truncate",
                  isRunning
                    ? "text-[var(--text-primary)] font-medium"
                    : "text-[var(--text-secondary)]",
                )}
              >
                {col.activeLabel}
              </p>

              {expanded && col.entries.length > 0 && (
                <div className="mt-1 pt-1 border-t border-[var(--border-color)] space-y-1 max-h-28 overflow-y-auto">
                  {col.entries.map((entry) => (
                    <div
                      key={entry.id}
                      title={entry.label}
                      className="flex items-center gap-1 text-[9px] font-mono text-[var(--text-muted)]"
                    >
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full shrink-0",
                          entry.status === "running"
                            ? "bg-emerald-400 animate-pulse"
                            : entry.status === "failed"
                            ? "bg-rose-400"
                            : "bg-emerald-500/70",
                        )}
                      />
                      <span className="truncate">{entry.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};


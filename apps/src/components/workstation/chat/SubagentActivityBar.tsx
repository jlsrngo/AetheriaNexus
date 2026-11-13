import React, { useState } from "react";
import { Check, ChevronDown, ChevronUp, Clock, Loader2, X } from "lucide-react";
import { cn } from "../../../lib/utils";
import type { SubagentTrackState } from "./types";
import { partitionSubagentTracks } from "./studioTrackUtils";

interface SubagentActivityBarProps {
  tracks?: SubagentTrackState[];
}

function getLatestActivityText(track: SubagentTrackState): string {
  if (track.status === "standby") {
    return track.standbyLabel || "Standby — menunggu slot provider";
  }
  const activeTool = [...track.tools]
    .reverse()
    .find((step) => step.status === "running");
  if (activeTool) return activeTool.label;
  const lastTool = track.tools[track.tools.length - 1];
  if (lastTool) return lastTool.label;
  return track.description || "Menjalankan tugas latar belakang...";
}

function TrackStatusBadge({ status }: { status: SubagentTrackState["status"] }) {
  if (status === "running") {
    return (
      <span className="px-1.5 py-0.5 rounded-[var(--radius-pill)] bg-[var(--bg-panel)] border border-[var(--border-strong)] font-mono text-[9px] text-[var(--text-primary)] shrink-0">
        aktif
      </span>
    );
  }
  if (status === "standby") {
    return (
      <span className="px-1.5 py-0.5 rounded-[var(--radius-pill)] bg-amber-500/12 border border-amber-500/35 font-mono text-[9px] text-amber-500 shrink-0">
        standby
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="px-1.5 py-0.5 rounded-[var(--radius-pill)] bg-rose-500/12 border border-rose-500/35 font-mono text-[9px] text-rose-500 shrink-0">
        gagal
      </span>
    );
  }
  return (
    <span className="px-1.5 py-0.5 rounded-[var(--radius-pill)] bg-[var(--bg-panel)] border border-[var(--border-color)] font-mono text-[9px] text-[var(--text-secondary)] shrink-0">
      selesai
    </span>
  );
}

/**
 * Floating composer pill displaying background and standby subagents
 * even while the parent orchestrator turn is idle.
 */
export const SubagentActivityBar: React.FC<SubagentActivityBarProps> = ({ tracks = [] }) => {
  const [expanded, setExpanded] = useState(false);

  const { active, standby, completed, failed, liveCount } = partitionSubagentTracks(tracks);
  if (liveCount === 0) return null;

  const summaryParts: string[] = [];
  if (active.length > 0) summaryParts.push(`${active.length} aktif`);
  if (standby.length > 0) summaryParts.push(`${standby.length} standby`);
  if (completed.length > 0) summaryParts.push(`${completed.length} selesai`);
  if (failed.length > 0) summaryParts.push(`${failed.length} gagal`);

  const primaryTrack = active[0] ?? standby[0];
  const primaryText = primaryTrack
    ? `${primaryTrack.title}: ${getLatestActivityText(primaryTrack)}`
    : "Menjalankan subagent latar belakang";

  const hasRunning = active.length > 0;

  return (
    <div
      data-testid="subagent-activity-bar"
      className={cn(
        "mb-2 w-full min-w-0 border transition-colors overflow-hidden bg-[var(--bg-card)]",
        expanded ? "rounded-[var(--radius-card)]" : "rounded-[var(--radius-pill)]",
        hasRunning ? "border-[var(--border-strong)]" : "border-amber-500/40",
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full px-3 py-1.5 flex items-center justify-between gap-2 text-left hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--border-strong)] transition-colors cursor-pointer min-w-0"
        title={primaryText}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {hasRunning ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400 shrink-0" />
          ) : (
            <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          )}
          <span className="text-[11px] font-medium text-[var(--text-primary)] truncate">
            {primaryText}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="px-2 py-0.5 rounded-[var(--radius-pill)] bg-[var(--bg-panel)] border border-[var(--border-color)] font-mono text-[10px] text-[var(--text-secondary)]">
            {summaryParts.join(" · ")}
          </span>
          <span className="text-[var(--text-muted)]">
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-2 pt-1.5 bg-[var(--bg-panel)] border-t border-[var(--border-color)] space-y-1.5 max-h-44 overflow-y-auto">
          {tracks.map((track) => (
            <div
              key={track.sessionId}
              className="flex items-center justify-between gap-2 text-[11px] py-0.5 min-w-0"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {track.status === "running" ? (
                  <Loader2 className="w-3 h-3 animate-spin text-amber-400 shrink-0" />
                ) : track.status === "standby" ? (
                  <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                ) : track.status === "failed" ? (
                  <X className="w-3 h-3 text-rose-500 shrink-0" />
                ) : (
                  <Check className="w-3 h-3 text-[var(--text-primary)] shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-medium text-[var(--text-primary)] truncate">
                      {track.title}
                    </span>
                    {track.description && (
                      <span className="text-[var(--text-muted)] truncate">
                        · {track.description}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-[var(--text-secondary)] truncate">
                    {getLatestActivityText(track)}
                  </div>
                </div>
              </div>
              <TrackStatusBadge status={track.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

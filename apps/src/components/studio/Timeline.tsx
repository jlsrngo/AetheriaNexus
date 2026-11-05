import { useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, SkipBack } from "lucide-react";
import { cn } from "../../lib/utils";
import { useStudioStore } from "../../hooks/useStudioStore";

interface TimelineProps {
  compositionId: string;
  durationInFrames: number;
  fps: number;
  currentFrame: number;
  isPlaying: boolean;
  onSeek: (frame: number) => void;
  onTogglePlay: () => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  compositionId,
  durationInFrames,
  fps,
  currentFrame,
  isPlaying,
  onSeek,
  onTogglePlay,
}) => {
  const { canvas, subtitleCues, actions } = useStudioStore();
  const updateCanvas = actions.updateCanvas;
  const subtitles = subtitleCues;
  const trackRef = useRef<HTMLDivElement>(null);
  const lastFrame = Math.max(0, durationInFrames - 1);
  const progress = lastFrame === 0 ? 0 : currentFrame / lastFrame;
  const totalSeconds = Math.ceil(durationInFrames / fps);

  const seekFromPointer = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      onSeek(Math.round(ratio * lastFrame));
    },
    [lastFrame, onSeek]
  );

  const step = (delta: number) => onSeek(Math.min(lastFrame, Math.max(0, currentFrame + delta)));

  const inPercent = canvas.inFrame !== null && lastFrame > 0 ? (canvas.inFrame / lastFrame) * 100 : null;
  const outPercent = canvas.outFrame !== null && lastFrame > 0 ? (canvas.outFrame / lastFrame) * 100 : null;

  return (
    <section className="shrink-0 border-t border-[var(--border-color)] bg-[var(--bg-app)] select-none">
      {/* 1. Transport + telemetry */}
      <div className="h-8 px-3 flex items-center justify-between border-b border-[var(--border-color)]">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-[var(--text-secondary)] mr-1.5 tracking-tight">Timeline</span>
          <button
            type="button"
            onClick={() => onSeek(canvas.inFrame ?? 0)}
            title="Go to start / In point"
            className="w-6 h-6 flex items-center justify-center border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors cursor-pointer"
          >
            <SkipBack className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => step(-1)}
            title="Previous frame"
            className="w-6 h-6 flex items-center justify-center border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            title={isPlaying ? "Pause (Space)" : "Play (Space)"}
            className={cn(
              "w-6 h-6 flex items-center justify-center border rounded-md transition-colors cursor-pointer",
              isPlaying
                ? "bg-rose-500/20 border-rose-500/40 text-rose-400 hover:bg-rose-500/30"
                : "bg-[var(--bg-card)] border-[var(--border-color)] text-emerald-400 hover:bg-[var(--bg-hover)]"
            )}
          >
            {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            title="Next frame"
            className="w-6 h-6 flex items-center justify-center border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors cursor-pointer"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* In / Out Point Markers (Remotion Studio I / O) */}
          <div className="flex items-center gap-1 ml-1.5 pl-1.5 border-l border-[var(--border-color)]">
            <button
              type="button"
              onClick={() => updateCanvas({ inFrame: canvas.inFrame === currentFrame ? null : currentFrame })}
              title="Set In Point (I)"
              className={cn(
                "px-1.5 h-5 rounded text-[10px] font-mono border transition-colors cursor-pointer",
                canvas.inFrame !== null
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                  : "bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
            >
              [I{canvas.inFrame !== null ? `:${canvas.inFrame}` : ""}
            </button>
            <button
              type="button"
              onClick={() => updateCanvas({ outFrame: canvas.outFrame === currentFrame ? null : currentFrame })}
              title="Set Out Point (O)"
              className={cn(
                "px-1.5 h-5 rounded text-[10px] font-mono border transition-colors cursor-pointer",
                canvas.outFrame !== null
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                  : "bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
            >
              {canvas.outFrame !== null ? `${canvas.outFrame}:` : ""}O]
            </button>
            {(canvas.inFrame !== null || canvas.outFrame !== null) && (
              <button
                type="button"
                onClick={() => updateCanvas({ inFrame: null, outFrame: null })}
                title="Clear In/Out Points"
                className="px-1 h-5 rounded text-[10px] text-[var(--text-muted)] hover:text-rose-400 transition-colors cursor-pointer"
              >
                ×
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono text-[var(--text-muted)]">
          {/* Speed selector */}
          <select
            value={canvas.playbackRate}
            onChange={(e) => updateCanvas({ playbackRate: Number(e.target.value) as 0.5 | 1 | 1.5 | 2 })}
            className="h-5 px-1 rounded bg-[var(--bg-card)] border border-[var(--border-color)] text-[10px] font-mono text-[var(--text-secondary)] outline-none cursor-pointer"
            title="Playback Speed"
          >
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={1.5}>1.5x</option>
            <option value={2}>2x</option>
          </select>
          <span className="text-[var(--border-strong)]">|</span>
          <span>
            FRAME <span className="text-[var(--text-primary)] font-semibold">{String(currentFrame).padStart(3, "0")}</span> / {durationInFrames}
          </span>
          <span className="text-[var(--border-strong)]">|</span>
          <span>{(currentFrame / fps).toFixed(2)}s</span>
          <span className="text-[var(--border-strong)]">|</span>
          <span>{fps} FPS</span>
        </div>
      </div>

      {/* 2. Ruler + track + playhead */}
      <div
        ref={trackRef}
        className={cn(
          "relative mx-3 my-2 cursor-col-resize",
          subtitles.length > 0 ? "h-[98px]" : "h-[74px]"
        )}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          seekFromPointer(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) seekFromPointer(e.clientX);
        }}
        onPointerUp={(e) => e.currentTarget.releasePointerCapture(e.pointerId)}
      >
        {/* In/Out Highlight Region */}
        {(inPercent !== null || outPercent !== null) && (
          <div
            className="absolute top-0 bottom-0 bg-emerald-500/10 border-x border-emerald-500/40 pointer-events-none z-0"
            style={{
              left: `${inPercent ?? 0}%`,
              width: `${Math.max(0, (outPercent ?? 100) - (inPercent ?? 0))}%`,
            }}
          />
        )}

        <div className="absolute inset-x-0 top-0 h-4">
          {Array.from({ length: totalSeconds + 1 }, (_, second) => {
            const left = Math.min(100, ((second * fps) / Math.max(1, lastFrame)) * 100);
            return (
              <div
                key={second}
                className={cn(
                  "absolute top-0 h-4 border-l border-[var(--border-color)] font-mono text-[9px] leading-4 text-[var(--text-muted)]",
                  left >= 100 ? "-translate-x-full pr-1 text-right" : "pl-1"
                )}
                style={{ left: `${left}%` }}
              >
                {second}s
              </div>
            );
          })}
        </div>

        {/* Main Video Sequence Track */}
        <div className="absolute inset-x-0 top-5 h-8 flex items-center gap-2 border border-[var(--border-color)] bg-[var(--bg-card)] rounded-md px-2.5 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
          <span className="text-xs text-[var(--text-primary)] font-medium truncate">{compositionId}</span>
          <span className="text-[10px] text-[var(--text-muted)] truncate font-mono">Sequence (0–{durationInFrames}f)</span>
        </div>

        {/* Subtitle / Captions Sequence Track */}
        {subtitles.length > 0 && (
          <div className="absolute inset-x-0 top-14 h-6 flex items-center border border-[var(--border-color)] bg-[var(--bg-panel)] rounded-md overflow-hidden">
            {subtitles.map((cue, idx) => {
              const startPct = Math.min(100, (cue.startFrame / Math.max(1, lastFrame)) * 100);
              const widthPct = Math.max(1.5, ((cue.endFrame - cue.startFrame) / Math.max(1, lastFrame)) * 100);
              return (
                <div
                  key={`${cue.startFrame}-${idx}`}
                  style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                  className="absolute top-0.5 bottom-0.5 bg-cyan-500/20 border border-cyan-500/40 rounded px-1 flex items-center overflow-hidden"
                  title={`${cue.text} (${cue.startFrame}f - ${cue.endFrame}f)`}
                >
                  <span className="text-[9px] font-mono text-cyan-300 truncate">{cue.text}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-px bg-rose-500 pointer-events-none z-10"
          style={{ left: `${progress * 100}%` }}
        >
          <div className="absolute -top-1 -left-[3.5px] w-2 h-2 rounded-full bg-rose-500 ring-2 ring-rose-950" />
        </div>
      </div>
    </section>
  );
};

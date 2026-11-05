import { useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, SkipBack } from "lucide-react";
import { cn } from "../../lib/utils";

interface TimelineProps {
  compositionId: string;
  durationInFrames: number;
  fps: number;
  currentFrame: number;
  isPlaying: boolean;
  onSeek: (frame: number) => void;
  onTogglePlay: () => void;
}

/**
 * Single-track timeline for the active Remotion composition.
 * The composition is one AbsoluteFill (no <Sequence> yet), so one track is the honest shape.
 */
export const Timeline: React.FC<TimelineProps> = ({
  compositionId,
  durationInFrames,
  fps,
  currentFrame,
  isPlaying,
  onSeek,
  onTogglePlay,
}) => {
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

  return (
    <section className="shrink-0 border-t border-neutral-800/80 bg-neutral-950 select-none">
      {/* 1. Transport + telemetry */}
      <div className="h-8 px-3 flex items-center justify-between border-b border-neutral-800/80">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-neutral-300 mr-2 tracking-tight">Timeline</span>
          <button
            type="button"
            onClick={() => onSeek(0)}
            title="Go to start"
            className="w-6 h-6 flex items-center justify-center border border-neutral-800 bg-neutral-900/80 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-md transition-colors cursor-pointer"
          >
            <SkipBack className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => step(-1)}
            title="Previous frame"
            className="w-6 h-6 flex items-center justify-center border border-neutral-800 bg-neutral-900/80 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-md transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            title={isPlaying ? "Pause" : "Play"}
            className={cn(
              "w-6 h-6 flex items-center justify-center border rounded-md transition-colors cursor-pointer",
              isPlaying
                ? "bg-rose-500/20 border-rose-500/40 text-rose-400 hover:bg-rose-500/30"
                : "bg-neutral-900/80 border-neutral-800 text-emerald-400 hover:bg-neutral-800"
            )}
          >
            {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            title="Next frame"
            className="w-6 h-6 flex items-center justify-center border border-neutral-800 bg-neutral-900/80 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-md transition-colors cursor-pointer"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono text-neutral-400">
          <span>
            FRAME <span className="text-white font-semibold">{String(currentFrame).padStart(3, "0")}</span> / {durationInFrames}
          </span>
          <span className="text-neutral-700">|</span>
          <span>{(currentFrame / fps).toFixed(2)}s</span>
          <span className="text-neutral-700">|</span>
          <span>{fps} FPS</span>
        </div>
      </div>

      {/* 2. Ruler + track + playhead */}
      <div
        ref={trackRef}
        className="relative mx-3 my-2 h-[74px] cursor-col-resize"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          seekFromPointer(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) seekFromPointer(e.clientX);
        }}
        onPointerUp={(e) => e.currentTarget.releasePointerCapture(e.pointerId)}
      >
        <div className="absolute inset-x-0 top-0 h-4">
          {Array.from({ length: totalSeconds + 1 }, (_, second) => {
            const left = Math.min(100, ((second * fps) / Math.max(1, lastFrame)) * 100);
            return (
              <div
                key={second}
                className={cn(
                  "absolute top-0 h-4 border-l border-neutral-800 font-mono text-[9px] leading-4 text-neutral-500",
                  left >= 100 ? "-translate-x-full pr-1 text-right" : "pl-1"
                )}
                style={{ left: `${left}%` }}
              >
                {second}s
              </div>
            );
          })}
        </div>

        <div className="absolute inset-x-0 top-5 h-9 flex items-center gap-2 border border-neutral-800/80 bg-neutral-900/90 rounded-md px-2.5 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
          <span className="text-xs text-neutral-200 font-medium truncate">{compositionId}</span>
          <span className="text-[10px] text-neutral-500 truncate">NexusVideoComposition</span>
        </div>

        <div
          className="absolute top-0 bottom-0 w-px bg-rose-500 pointer-events-none"
          style={{ left: `${progress * 100}%` }}
        >
          <div className="absolute -top-1 -left-[3.5px] w-2 h-2 rounded-full bg-rose-500 ring-2 ring-rose-950" />
        </div>
      </div>
    </section>
  );
};

import type { RefObject } from "react";
import { cn } from "../../../lib/utils";

interface TimelineRulerTicksProps {
  rulerRef: RefObject<HTMLDivElement | null>;
  durationInFrames: number;
  lastFrame: number;
  fps: number;
  rulerWidth: number;
  onSeekFromClientX: (clientX: number) => void;
}

const MIN_LABEL_GAP_PX = 80;
const CANDIDATE_FRAME_STEPS = [1, 2, 5, 10, 15, 30, 60];
const CANDIDATE_SECONDS = [
  0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 20, 30, 60, 120, 300, 600, 1200, 1800, 3600,
];

function formatTickSec(sec: number, isSubSec: boolean): string {
  if (isSubSec) return `${sec.toFixed(1)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m > 0 ? `${m}:${s.toString().padStart(2, "0")}` : `${s}s`;
}

export const TimelineRulerTicks: React.FC<TimelineRulerTicksProps> = ({
  rulerRef,
  durationInFrames,
  lastFrame,
  fps,
  rulerWidth,
  onSeekFromClientX,
}) => {
  const renderTicks = () => {
    const totalDurationSec = durationInFrames / fps;
    if (totalDurationSec <= 0 || lastFrame <= 0) return null;

    const totalWidthPx = Math.max(200, rulerWidth);
    const pxPerSec = (fps / lastFrame) * totalWidthPx;
    const pxPerFrame = totalWidthPx / lastFrame;

    // 1. Extreme zoom: frame-based ticks
    if (pxPerFrame >= 25) {
      const frameStep =
        CANDIDATE_FRAME_STEPS.find((s) => s * pxPerFrame >= MIN_LABEL_GAP_PX) ??
        Math.ceil(MIN_LABEL_GAP_PX / pxPerFrame);
      const totalMajor = Math.floor(durationInFrames / frameStep);

      const ticks: React.ReactNode[] = [];
      for (let i = 0; i <= totalMajor; i++) {
        const f = i * frameStep;
        if (f > durationInFrames) break;
        const left = Math.min(100, (f / lastFrame) * 100);
        ticks.push(
          <div
            key={`f-${f}`}
            className={cn(
              "absolute top-0 bottom-0 border-l font-mono text-[9px] leading-6 whitespace-nowrap pointer-events-none select-none",
              "border-[var(--border-strong)] text-[var(--text-secondary)]",
              left >= 98 ? "-translate-x-full pr-1 text-right" : "pl-1"
            )}
            style={{ left: `${left}%` }}
          >
            {f}f
          </div>
        );
      }
      return ticks;
    }

    // 2. Standard time-based ticks
    const majorStepSec =
      CANDIDATE_SECONDS.find((s) => s * pxPerSec >= MIN_LABEL_GAP_PX) ??
      Math.ceil(MIN_LABEL_GAP_PX / Math.max(0.001, pxPerSec));

    const minorDiv = majorStepSec >= 10 ? 5 : majorStepSec >= 2 ? 2 : 1;
    const minorStepSec = majorStepSec / minorDiv;

    const ticks: React.ReactNode[] = [];
    const totalMinorSteps = Math.floor(totalDurationSec / minorStepSec);

    for (let i = 0; i <= totalMinorSteps; i++) {
      const sec = i * minorStepSec;
      if (sec > totalDurationSec + 0.001) break;
      const isMajor = i % minorDiv === 0;
      const frameVal = Math.min(durationInFrames, Math.round(sec * fps));
      const left = Math.min(100, (frameVal / lastFrame) * 100);

      if (isMajor) {
        ticks.push(
          <div
            key={`maj-${i}`}
            className={cn(
              "absolute top-0 bottom-0 border-l font-mono text-[9px] leading-6 whitespace-nowrap pointer-events-none select-none",
              "border-[var(--border-strong)] text-[var(--text-secondary)]",
              left >= 98 ? "-translate-x-full pr-1 text-right" : "pl-1"
            )}
            style={{ left: `${left}%` }}
          >
            {formatTickSec(sec, majorStepSec < 1)}
          </div>
        );
      } else {
        ticks.push(
          <div
            key={`min-${i}`}
            className="absolute bottom-0 h-1.5 border-l border-[var(--border-color)]/60 pointer-events-none"
            style={{ left: `${left}%` }}
          />
        );
      }
    }

    return ticks;
  };

  return (
    <div
      ref={rulerRef}
      className="h-6 border-b border-[var(--border-color)] bg-[var(--bg-panel)] relative shrink-0 cursor-col-resize overflow-hidden"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        onSeekFromClientX(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.buttons === 1) onSeekFromClientX(e.clientX);
      }}
      onPointerUp={(e) => e.currentTarget.releasePointerCapture(e.pointerId)}
    >
      {renderTicks()}
    </div>
  );
};


import React from "react";
import { cn } from "../../../lib/utils";

interface RulerTick {
  val: number;
  screenPos: number;
  isMajor: boolean;
  isOrigin: boolean;
}

const CANDIDATE_RULER_STEPS = [
  1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000,
];

function computeRulerTicks(
  axisSpanPx: number,
  originPx: number,
  effectiveScale: number
): RulerTick[] {
  if (axisSpanPx <= 0) return [];
  const safeScale = Math.max(0.0001, effectiveScale);
  const minStepDocUnits = 65 / safeScale;
  const step = CANDIDATE_RULER_STEPS.find((s) => s >= minStepDocUnits) || 1000;
  const minorStep = step <= 5 ? 1 : step / 5;

  const startDoc = (0 - originPx) / safeScale;
  const endDoc = (axisSpanPx - originPx) / safeScale;
  const firstDoc = Math.floor(startDoc / minorStep) * minorStep;
  const lastDoc = Math.ceil(endDoc / minorStep) * minorStep;

  const ticks: RulerTick[] = [];
  const maxTicks = 600;
  let count = 0;
  for (let doc = firstDoc; doc <= lastDoc && count < maxTicks; doc += minorStep, count++) {
    const screenPos = Math.round(originPx + doc * safeScale);
    if (screenPos >= -1 && screenPos <= axisSpanPx + 1) {
      const isMajor = Math.abs(doc % step) < 0.001 || Math.abs(doc) < 0.001;
      const isOrigin = Math.abs(doc) < 0.001;
      ticks.push({ val: Math.round(doc), screenPos, isMajor, isOrigin });
    }
  }
  return ticks;
}

function buildGridLines(
  viewportSpan: number,
  originPx: number,
  renderedSpan: number,
  segments: number
): Array<{ pos: number; isCompositionEdge: boolean }> {
  const step = Math.max(8, renderedSpan / segments);
  let start = originPx % step;
  while (start > 0) start -= step;

  const lines: Array<{ pos: number; isCompositionEdge: boolean }> = [];
  const maxLines = 150;
  let count = 0;
  for (let p = start; p <= viewportSpan && count < maxLines; p += step, count++) {
    const rounded = Math.round(p);
    const isCompositionEdge =
      Math.abs(rounded - Math.round(originPx)) <= 1 ||
      Math.abs(rounded - Math.round(originPx + renderedSpan)) <= 1;
    lines.push({ pos: rounded, isCompositionEdge });
  }
  return lines;
}

export const CanvasGridOverlay: React.FC<{
  visible: boolean;
  viewportW: number;
  viewportH: number;
  renderedW: number;
  renderedH: number;
  originX: number;
  originY: number;
  gridCols: number;
  gridRows: number;
}> = ({
  visible,
  viewportW,
  viewportH,
  renderedW,
  renderedH,
  originX,
  originY,
  gridCols,
  gridRows,
}) => {
  if (!visible || viewportW <= 0 || viewportH <= 0) return null;
  const vLines = buildGridLines(viewportW, originX, renderedW, gridCols);
  const hLines = buildGridLines(viewportH, originY, renderedH, gridRows);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden select-none">
      {vLines.map(({ pos, isCompositionEdge }) => (
        <div
          key={`v-${pos}`}
          className={cn(
            "absolute top-0 bottom-0 w-px",
            isCompositionEdge ? "bg-amber-400/70 z-10" : "bg-amber-400/35"
          )}
          style={{ left: `${pos}px` }}
        />
      ))}
      {hLines.map(({ pos, isCompositionEdge }) => (
        <div
          key={`h-${pos}`}
          className={cn(
            "absolute left-0 right-0 h-px",
            isCompositionEdge ? "bg-amber-400/70 z-10" : "bg-amber-400/35"
          )}
          style={{ top: `${pos}px` }}
        />
      ))}
      <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-[var(--bg-panel)]/90 border border-[var(--border-strong)] font-mono text-[9px] text-amber-400 shadow">
        GRID {gridCols}×{gridRows}
      </span>
    </div>
  );
};

export const HorizontalRuler: React.FC<{
  position: "top" | "bottom";
  width: number;
  originX: number;
  effectiveScale: number;
  cursorX: number | null;
}> = ({ position, width, originX, effectiveScale, cursorX }) => {
  if (width <= 0) return null;
  const ticks = computeRulerTicks(width, originX, effectiveScale);

  return (
    <div
      className={cn(
        "h-5 bg-[var(--bg-panel)] relative select-none shrink-0 overflow-hidden font-mono",
        position === "top"
          ? "border-b border-[var(--border-color)]"
          : "border-t border-[var(--border-color)]"
      )}
    >
      <div className="relative w-full h-full">
        {ticks.map(({ val, screenPos, isMajor, isOrigin }) => (
          <div
            key={`${val}-${screenPos}`}
            className="absolute top-0 bottom-0 pointer-events-none flex flex-col justify-between"
            style={{ left: `${screenPos}px` }}
          >
            <div
              className={cn(
                "w-px",
                position === "top" ? "mt-auto" : "mb-auto",
                isOrigin
                  ? "h-full bg-amber-400 z-10"
                  : isMajor
                  ? "h-2 bg-[var(--text-secondary)]"
                  : "h-1 bg-[var(--border-strong)]"
              )}
            />
            {isMajor && (
              <span
                className={cn(
                  "absolute text-[8px] whitespace-nowrap",
                  isOrigin ? "text-amber-400 font-bold" : "text-[var(--text-muted)]",
                  position === "top" ? "top-0.5" : "bottom-0.5",
                  val === 0 ? "left-1" : "-translate-x-1/2"
                )}
              >
                {val}
              </span>
            )}
          </div>
        ))}
        {cursorX !== null && (
          <div
            className="absolute top-0 bottom-0 w-px bg-amber-400/80 pointer-events-none z-20"
            style={{ left: `${cursorX}px` }}
          />
        )}
      </div>
    </div>
  );
};

export const VerticalRuler: React.FC<{
  position: "left" | "right";
  height: number;
  originY: number;
  effectiveScale: number;
  cursorY: number | null;
}> = ({ position, height, originY, effectiveScale, cursorY }) => {
  if (height <= 0) return null;
  const ticks = computeRulerTicks(height, originY, effectiveScale);

  return (
    <div
      className={cn(
        "w-7 bg-[var(--bg-panel)] relative select-none shrink-0 overflow-hidden font-mono",
        position === "left"
          ? "border-r border-[var(--border-color)]"
          : "border-l border-[var(--border-color)]"
      )}
    >
      <div className="relative w-full h-full">
        {ticks.map(({ val, screenPos, isMajor, isOrigin }) => (
          <div
            key={`${val}-${screenPos}`}
            className="absolute left-0 right-0 pointer-events-none flex items-center justify-between"
            style={{ top: `${screenPos}px` }}
          >
            <div
              className={cn(
                "h-px",
                position === "left" ? "ml-auto" : "mr-auto",
                isOrigin
                  ? "w-full bg-amber-400 z-10"
                  : isMajor
                  ? "w-2 bg-[var(--text-secondary)]"
                  : "w-1 bg-[var(--border-strong)]"
              )}
            />
            {isMajor && (
              <span
                className={cn(
                  "absolute text-[7px] whitespace-nowrap",
                  isOrigin ? "text-amber-400 font-bold" : "text-[var(--text-muted)]",
                  position === "left" ? "left-0.5" : "right-0.5",
                  val === 0 ? "top-1" : "-translate-y-1/2"
                )}
              >
                {val}
              </span>
            )}
          </div>
        ))}
        {cursorY !== null && (
          <div
            className="absolute left-0 right-0 h-px bg-amber-400/80 pointer-events-none z-20"
            style={{ top: `${cursorY}px` }}
          />
        )}
      </div>
    </div>
  );
};

export const SafeZoneGuideOverlay: React.FC<{
  visible: boolean;
  originX: number;
  originY: number;
  renderedW: number;
  renderedH: number;
  ratio: string;
}> = ({ visible, originX, originY, renderedW, renderedH, ratio }) => {
  if (!visible) return null;
  return (
    <div
      className="pointer-events-none absolute border border-dashed border-cyan-400 rounded-lg flex flex-col justify-between p-2 z-10"
      style={{
        left: `${originX + renderedW * 0.05}px`,
        top: `${originY + renderedH * 0.05}px`,
        width: `${renderedW * 0.9}px`,
        height: `${renderedH * 0.9}px`,
      }}
    >
      <div className="flex justify-between text-[9px] font-mono text-cyan-300 uppercase">
        <span className="px-1.5 py-0.5 rounded bg-[var(--bg-panel)] border border-[var(--border-color)]">
          Safe Zone Top
        </span>
        <span className="px-1.5 py-0.5 rounded bg-[var(--bg-panel)] border border-[var(--border-color)]">
          {ratio}
        </span>
      </div>
      <div className="flex justify-between items-end">
        <span className="px-1.5 py-0.5 rounded bg-[var(--bg-panel)] border border-[var(--border-color)] text-[9px] font-mono text-cyan-300">
          Caption Safe Area
        </span>
        <div className="w-12 h-28 bg-[var(--bg-panel)]/90 border border-dashed border-rose-400 rounded flex items-center justify-center text-[8px] font-mono text-rose-300 text-center p-1">
          UI Icons
        </div>
      </div>
    </div>
  );
};


import { useCallback, useRef } from "react";
import { Compass, Maximize2, RotateCcw, X } from "lucide-react";
import { cn } from "../../lib/utils";

interface CanvasMinimapProps {
  compositionWidth: number;
  compositionHeight: number;
  ratio: string;
  zoom: "fit" | number;
  panX: number;
  panY: number;
  viewportWidth: number;
  viewportHeight: number;
  effectiveScale: number;
  onPanChange: (panX: number, panY: number) => void;
  onResetZoom: () => void;
  onClose: () => void;
}

export const CanvasMinimap: React.FC<CanvasMinimapProps> = ({
  compositionWidth,
  compositionHeight,
  ratio,
  zoom,
  panX,
  panY,
  viewportWidth,
  viewportHeight,
  effectiveScale,
  onPanChange,
  onResetZoom,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const numericZoom = zoom === "fit" ? 1 : Math.max(0.25, zoom);
  const isZoomed = zoom !== "fit" && numericZoom > 1.05;

  // Aspect-ratio aware thumbnail sizing
  const maxW = 110;
  const maxH = 130;
  const aspect = compositionWidth / Math.max(1, compositionHeight);

  let thumbW = maxW;
  let thumbH = Math.round(maxW / aspect);
  if (thumbH > maxH) {
    thumbH = maxH;
    thumbW = Math.round(maxH * aspect);
  }

  // Exact rendered dimensions of the composition in viewport space
  const renderedW = Math.max(1, compositionWidth * effectiveScale);
  const renderedH = Math.max(1, compositionHeight * effectiveScale);

  // Viewport box dimensions in percent of the thumbnail
  const boxWidthPct = Math.min(100, Math.max(12, (viewportWidth / renderedW) * 100));
  const boxHeightPct = Math.min(100, Math.max(12, (viewportHeight / renderedH) * 100));

  // Viewport center relative to composition center
  // panX shifts composition to the right, meaning the viewport looks at the left of the composition (-panX)
  const normCenterX = 0.5 - panX / renderedW;
  const normCenterY = 0.5 - panY / renderedH;

  const boxLeftPct = Math.max(
    0,
    Math.min(100 - boxWidthPct, normCenterX * 100 - boxWidthPct / 2)
  );
  const boxTopPct = Math.max(
    0,
    Math.min(100 - boxHeightPct, normCenterY * 100 - boxHeightPct / 2)
  );

  const handlePointerSeek = useCallback(
    (clientX: number, clientY: number) => {
      const el = containerRef.current;
      if (!el || !isZoomed) return;
      const rect = el.getBoundingClientRect();
      const clickXPct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const clickYPct = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));

      // Click location in composition normalized space (0..1), center is 0.5
      const targetNormCenterX = clickXPct;
      const targetNormCenterY = clickYPct;

      const newPanX = -Math.round((targetNormCenterX - 0.5) * renderedW);
      const newPanY = -Math.round((targetNormCenterY - 0.5) * renderedH);

      onPanChange(newPanX, newPanY);
    },
    [isZoomed, onPanChange, renderedH, renderedW]
  );

  return (
    <div className="absolute bottom-3 right-3 z-30 bg-[#121215]/95 border border-[var(--border-strong)] rounded-xl shadow-2xl p-2.5 backdrop-blur-md flex flex-col gap-2 select-none w-auto pointer-events-auto transition-all animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-1 border-b border-[var(--border-color)] text-[10px]">
        <div className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
          <Compass className="w-3.5 h-3.5 text-[#f97316]" />
          <span>Minimap</span>
          <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)]">
            {ratio}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onResetZoom}
            className="p-1 rounded text-[var(--text-muted)] hover:text-amber-400 hover:bg-[var(--bg-card)] transition-colors cursor-pointer"
            title="Reset Pan & Zoom to Fit"
          >
            <RotateCcw className="w-2.5 h-2.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors cursor-pointer"
            title="Close Minimap"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>

      {/* Thumbnail Frame */}
      <div className="flex justify-center items-center py-1">
        <div
          ref={containerRef}
          style={{ width: `${thumbW}px`, height: `${thumbH}px` }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            handlePointerSeek(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (e.buttons === 1) handlePointerSeek(e.clientX, e.clientY);
          }}
          onPointerUp={(e) => {
            try {
              e.currentTarget.releasePointerCapture(e.pointerId);
            } catch {
              // Ignore if already released
            }
          }}
          className={cn(
            "relative rounded border border-[var(--border-strong)] bg-[#0A0A0C] overflow-hidden flex flex-col items-center justify-between p-1.5 shadow-inner",
            isZoomed ? "cursor-crosshair" : "cursor-default"
          )}
          title={
            isZoomed
              ? "Click or drag inside minimap to pan canvas view"
              : "Zoom in on canvas to enable viewport panning"
          }
        >
          {/* Mock Composition Layer Artifacts */}
          <div className="w-full h-1.5 rounded-sm bg-[#cf6613]/50 border border-[#e07b27]/40" />
          <div className="w-4/5 h-2 rounded-sm bg-[#3B1D6E]/70 border border-[#7C3AED]/40" />
          <div className="w-full flex flex-col gap-1">
            <div className="w-full h-1 rounded-sm bg-[#134E63]/60" />
            <div className="w-3/4 h-1 rounded-sm bg-[#5C2D0C]/60" />
          </div>
          <div className="w-1/2 h-1 rounded-sm bg-[var(--text-muted)]/30 self-center" />

          {/* Viewport Indicator Rectangle */}
          <div
            style={{
              width: `${boxWidthPct}%`,
              height: `${boxHeightPct}%`,
              left: `${boxLeftPct}%`,
              top: `${boxTopPct}%`,
            }}
            className={cn(
              "absolute pointer-events-none rounded transition-all duration-75",
              isZoomed
                ? "border-2 border-amber-400 bg-amber-400/20 shadow-[0_0_12px_rgba(245,158,11,0.5)]"
                : "border border-amber-400/50 bg-amber-400/10"
            )}
          />
        </div>
      </div>

      {/* Footer Info & Quick Actions */}
      <div className="flex items-center justify-between gap-1 text-[9px] font-mono text-[var(--text-muted)] pt-1 border-t border-[var(--border-color)]">
        <span>
          {zoom === "fit" ? "FIT" : `${Math.round(numericZoom * 100)}%`}
        </span>
        <button
          type="button"
          onClick={onResetZoom}
          className="hover:text-amber-400 cursor-pointer flex items-center gap-0.5"
          title="Fit to Window"
        >
          <Maximize2 className="w-2.5 h-2.5" />
          <span>Fit</span>
        </button>
      </div>
    </div>
  );
};

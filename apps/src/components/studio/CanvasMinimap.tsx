import { useCallback, useRef } from "react";
import { Compass, RotateCcw, X } from "lucide-react";
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

  // Compact aspect-ratio aware thumbnail sizing inside square box
  const maxDim = 54;
  const aspect = compositionWidth / Math.max(1, compositionHeight);

  let thumbW = maxDim;
  let thumbH = Math.round(maxDim / aspect);
  if (thumbH > maxDim) {
    thumbH = maxDim;
    thumbW = Math.round(maxDim * aspect);
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
      const newPanX = -Math.round((clickXPct - 0.5) * renderedW);
      const newPanY = -Math.round((clickYPct - 0.5) * renderedH);

      onPanChange(newPanX, newPanY);
    },
    [isZoomed, onPanChange, renderedH, renderedW]
  );

  return (
    <div
      className="absolute bottom-2.5 right-2.5 z-30 w-[92px] h-[92px] bg-[#121215]/95 border border-[#26262C] rounded-[10px] shadow-xl p-1.5 backdrop-blur-md flex flex-col select-none pointer-events-auto transition-all animate-in fade-in duration-150"
      title={`Minimap (${ratio})`}
    >
      {/* Compact Header */}
      <div className="h-4 flex items-center justify-between gap-1 pb-0.5 border-b border-[#26262C] shrink-0">
        <button
          type="button"
          onClick={onResetZoom}
          className="flex items-center gap-1 font-mono text-[9px] text-[#8E8E98] hover:text-amber-400 transition-colors cursor-pointer truncate"
          title={`Zoom ${zoom === "fit" ? "FIT" : `${Math.round(numericZoom * 100)}%`} (${ratio}) — Click to Fit`}
        >
          <Compass className="w-2.5 h-2.5 text-[#f97316] shrink-0" />
          <span>{zoom === "fit" ? "FIT" : `${Math.round(numericZoom * 100)}%`}</span>
        </button>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={onResetZoom}
            className="p-0.5 rounded text-[#8E8E98] hover:text-amber-400 transition-colors cursor-pointer"
            title="Fit to Window"
          >
            <RotateCcw className="w-2.5 h-2.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-0.5 rounded text-[#8E8E98] hover:text-[#FAFAFA] transition-colors cursor-pointer"
            title="Close Minimap"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>

      {/* Centered Proportional Canvas Box */}
      <div className="flex-1 min-h-0 flex items-center justify-center pt-1">
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
            "relative rounded-[4px] border border-[#26262C] bg-[#0A0A0C] overflow-hidden flex flex-col items-center justify-between p-1 shadow-inner",
            isZoomed ? "cursor-crosshair" : "cursor-default"
          )}
          title={
            isZoomed
              ? "Click or drag inside minimap to pan canvas view"
              : "Zoom in on canvas to enable viewport panning"
          }
        >
          <div className="w-full h-1 rounded-[1px] bg-[#cf6613]/50" />
          <div className="w-4/5 h-1 rounded-[1px] bg-[#7C3AED]/55" />
          <div className="w-3/4 h-0.5 rounded-[1px] bg-[#06B6D4]/50" />

          {/* Viewport Indicator Rectangle */}
          <div
            style={{
              width: `${boxWidthPct}%`,
              height: `${boxHeightPct}%`,
              left: `${boxLeftPct}%`,
              top: `${boxTopPct}%`,
            }}
            className={cn(
              "absolute pointer-events-none rounded-[2px] transition-all duration-75",
              isZoomed
                ? "border border-amber-400 bg-amber-400/20 shadow-[0_0_8px_rgba(245,158,11,0.45)]"
                : "border border-amber-400/50 bg-amber-400/10"
            )}
          />
        </div>
      </div>
    </div>
  );
};

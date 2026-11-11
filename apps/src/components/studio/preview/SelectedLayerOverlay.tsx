import React from "react";
import { RotateCcw, X } from "lucide-react";
import type { SelectedLayerBox } from "../../../hooks/useStudioCanvasInteractions";

export interface SelectedLayerOverlayProps {
  box: SelectedLayerBox | null;
  selectedLayerId: string | null;
  offsetX: number;
  offsetY: number;
  onDoubleClickLayer: () => void;
  onResetOffset: () => void;
  onDeselect: () => void;
}

export const SelectedLayerOverlay: React.FC<SelectedLayerOverlayProps> = ({
  box,
  selectedLayerId,
  offsetX,
  offsetY,
  onDoubleClickLayer,
  onResetOffset,
  onDeselect,
}) => {
  if (!box || !selectedLayerId) return null;

  return (
    <div
      data-nexus-bounding-box="true"
      style={{
        left: `${box.left}px`,
        top: `${box.top}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClickLayer();
      }}
      className="absolute pointer-events-auto border border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.35)] select-none z-30 cursor-move"
      title="Drag to move, double-click to edit, arrow keys to nudge, Esc to deselect"
    >
      <div className="absolute -top-1 -left-1 w-2 h-2 bg-black border border-white rounded-[1px] pointer-events-none shadow" />
      <div className="absolute -top-1 -right-1 w-2 h-2 bg-black border border-white rounded-[1px] pointer-events-none shadow" />
      <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-black border border-white rounded-[1px] pointer-events-none shadow" />
      <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-black border border-white rounded-[1px] pointer-events-none shadow" />

      {box.width >= 70 && box.height >= 36 && (
        <>
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-black border border-white rounded-[1px] pointer-events-none shadow" />
          <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-black border border-white rounded-[1px] pointer-events-none shadow" />
          <div className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-2 bg-black border border-white rounded-[1px] pointer-events-none shadow" />
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-black border border-white rounded-[1px] pointer-events-none shadow" />
        </>
      )}

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/70 text-[10px] font-mono pointer-events-none leading-none">
        +
      </div>

      <div
        className="absolute -top-7 left-0 flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#0A0A0C]/95 border border-amber-400 text-[10px] font-mono text-white shadow-xl whitespace-nowrap z-40 select-none cursor-move"
        title="Drag to reposition layer"
      >
        <span className="text-amber-400 font-bold">{box.layerName}</span>
        <span className="text-[var(--text-muted)]">•</span>
        <span>X: {offsetX}px</span>
        <span>Y: {offsetY}px</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onResetOffset();
          }}
          className="ml-0.5 p-0.5 text-amber-400 hover:text-white cursor-pointer transition-colors"
          title="Reset Position (0, 0)"
        >
          <RotateCcw className="w-2.5 h-2.5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDeselect();
          }}
          className="p-0.5 text-[var(--text-muted)] hover:text-rose-400 cursor-pointer transition-colors"
          title="Deselect (Esc)"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      </div>
    </div>
  );
};


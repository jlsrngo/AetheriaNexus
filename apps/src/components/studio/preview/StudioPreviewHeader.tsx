import React from "react";
import {
  Compass,
  Film,
  Grid,
  Maximize2,
  Repeat,
  Ruler,
  ShieldAlert,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import type { StudioCanvasSettings, StudioComposition } from "../../../types/studio";

const GRID_PRESETS = [
  { label: "2×2", cols: 2, rows: 2 },
  { label: "3×3", cols: 3, rows: 3 },
  { label: "4×4", cols: 4, rows: 4 },
  { label: "6×6", cols: 6, rows: 6 },
  { label: "8×8", cols: 8, rows: 8 },
  { label: "12×12", cols: 12, rows: 12 },
  { label: "16×16", cols: 16, rows: 16 },
  { label: "24×24", cols: 24, rows: 24 },
  { label: "9×16", cols: 9, rows: 16 },
  { label: "16×9", cols: 16, rows: 9 },
];

export interface StudioPreviewHeaderProps {
  activeComposition: StudioComposition;
  canvas: StudioCanvasSettings;
  numericZoom: number;
  gridCols: number;
  gridRows: number;
  onUpdateCanvas: (partial: Partial<StudioCanvasSettings>) => void;
  onRequestFullscreen: () => void;
}

export const StudioPreviewHeader: React.FC<StudioPreviewHeaderProps> = ({
  activeComposition,
  canvas,
  numericZoom,
  gridCols,
  gridRows,
  onUpdateCanvas,
  onRequestFullscreen,
}) => (
  <div className="border-b border-[var(--border-color)] bg-[var(--bg-panel)] flex flex-col text-[11px] shrink-0">
    {/* Row 1: Active composition title and resolution */}
    <div className="h-8 px-3 border-b border-[var(--border-color)] flex items-center justify-between gap-2 min-w-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)] shrink-0">
          <Film className="w-3.5 h-3.5 text-[#f97316] shrink-0" />
          <span>Nexus Canvas</span>
        </span>
        <span className="text-[var(--text-muted)] shrink-0">•</span>
        <span className="font-medium text-[var(--text-secondary)] truncate">
          {activeComposition.name.replace(/\s*\(\d+:\d+\)/g, "")}
        </span>
      </div>
      <span className="px-1.5 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-color)] font-mono text-[10px] text-amber-400 font-semibold shrink-0 whitespace-nowrap">
        {activeComposition.width}×{activeComposition.height} ({activeComposition.ratio})
      </span>
    </div>

    {/* Row 2: Canvas viewport & grid controls */}
    <div className="h-8 px-3 bg-[var(--bg-panel-sub)] flex items-center justify-between gap-1.5 overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-1.5 shrink-0">
      <div className="flex items-center gap-1 px-1.5 h-6 rounded-md bg-[var(--bg-card)] border border-[var(--border-strong)]">
        <button
          type="button"
          onClick={() =>
            onUpdateCanvas({ zoom: canvas.zoom === "fit" ? 1 : "fit", panX: 0, panY: 0 })
          }
          className={cn(
            "px-1 h-4 rounded text-[9px] font-mono cursor-pointer transition-colors",
            canvas.zoom === "fit"
              ? "bg-[#cf6613] text-white font-bold"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          )}
          title="Toggle Fit to Screen"
        >
          Fit
        </button>

        <button
          type="button"
          onClick={() =>
            onUpdateCanvas({
              zoom: Math.max(0.25, Number((numericZoom * 0.8).toFixed(2))),
            })
          }
          className="text-[var(--text-muted)] hover:text-amber-400 cursor-pointer p-0.5"
          title="Zoom Out Canvas"
        >
          <ZoomOut className="w-3 h-3" />
        </button>

        <input
          type="range"
          min={0.25}
          max={10.0}
          step={0.05}
          value={numericZoom}
          onChange={(e) => onUpdateCanvas({ zoom: Number(e.target.value) })}
          className="w-16 sm:w-24 h-1 accent-[#cf6613] bg-[var(--bg-input)] rounded-lg cursor-ew-resize outline-none"
          title={`Canvas Zoom: ${Math.round(numericZoom * 100)}% (Scroll canvas to zoom freely)`}
        />

        <button
          type="button"
          onClick={() =>
            onUpdateCanvas({
              zoom: Math.min(10.0, Number((numericZoom * 1.25).toFixed(2))),
            })
          }
          className="text-[var(--text-muted)] hover:text-amber-400 cursor-pointer p-0.5"
          title="Zoom In Canvas"
        >
          <ZoomIn className="w-3 h-3" />
        </button>

        <span
          onClick={() => onUpdateCanvas({ zoom: "fit", panX: 0, panY: 0 })}
          className="font-mono text-[9px] text-amber-400 font-semibold cursor-pointer shrink-0 pl-0.5"
          title="Click to reset to Fit"
        >
          {canvas.zoom === "fit" ? "Fit" : `${Math.round(numericZoom * 100)}%`}
        </span>
      </div>

      <button
        type="button"
        onClick={() => onUpdateCanvas({ showMinimap: !canvas.showMinimap })}
        title="Toggle Canvas Viewport Minimap"
        className={cn(
          "h-6 px-1.5 rounded-md border flex items-center justify-center cursor-pointer transition-colors",
          canvas.showMinimap !== false
            ? "bg-[#cf6613] text-white border-[#e07b27]"
            : "bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-strong)] hover:text-[var(--text-primary)]"
        )}
      >
        <Compass className="w-3.5 h-3.5 shrink-0" />
      </button>

      <button
        type="button"
        onClick={() => onUpdateCanvas({ showRulers: !canvas.showRulers })}
        title="Toggle Dynamic Photoshop/Corel Style Rulers"
        className={cn(
          "h-6 px-1.5 rounded-md border flex items-center justify-center cursor-pointer transition-colors",
          canvas.showRulers
            ? "bg-[#cf6613] text-white border-[#e07b27]"
            : "bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-strong)] hover:text-[var(--text-primary)]"
        )}
      >
        <Ruler className="w-3.5 h-3.5 shrink-0" />
      </button>

      <button
        type="button"
        onClick={() => onUpdateCanvas({ showGuides: !canvas.showGuides })}
        title="Toggle TikTok Safe Zone Guides"
        className={cn(
          "h-6 px-1.5 rounded-md border flex items-center justify-center cursor-pointer transition-colors",
          canvas.showGuides
            ? "bg-[#cf6613] text-white border-[#e07b27]"
            : "bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-strong)] hover:text-[var(--text-primary)]"
        )}
      >
        <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
      </button>

      <div className="flex items-center rounded-md bg-[var(--bg-card)] border border-[var(--border-strong)] overflow-hidden">
        <button
          type="button"
          onClick={() => onUpdateCanvas({ showGrid: !canvas.showGrid })}
          title="Toggle Custom Grid Lines"
          className={cn(
            "h-6 px-1.5 flex items-center justify-center cursor-pointer transition-colors",
            canvas.showGrid
              ? "bg-[#cf6613] text-white"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          )}
        >
          <Grid className="w-3.5 h-3.5 shrink-0" />
        </button>

        <div className="flex items-center gap-0.5 px-1 bg-[var(--bg-panel)] border-l border-[var(--border-strong)] text-[10px] font-mono">
          <input
            type="number"
            min={1}
            max={64}
            value={gridCols}
            onChange={(e) => {
              const val = Math.max(1, Math.min(64, Number(e.target.value) || 1));
              onUpdateCanvas({ showGrid: true, gridCols: val });
            }}
            className="w-6 text-center bg-[var(--bg-card)] border border-[var(--border-color)] rounded text-[9px] text-[var(--text-primary)] outline-none focus:border-amber-400"
            title="Grid Columns (Vertical Lines)"
          />
          <span className="text-[var(--text-muted)] text-[9px]">×</span>
          <input
            type="number"
            min={1}
            max={64}
            value={gridRows}
            onChange={(e) => {
              const val = Math.max(1, Math.min(64, Number(e.target.value) || 1));
              onUpdateCanvas({ showGrid: true, gridRows: val });
            }}
            className="w-6 text-center bg-[var(--bg-card)] border border-[var(--border-color)] rounded text-[9px] text-[var(--text-primary)] outline-none focus:border-amber-400"
            title="Grid Rows (Horizontal Lines)"
          />
        </div>

        <select
          value={`${gridCols}x${gridRows}`}
          onChange={(e) => {
            const [c, r] = e.target.value.split("x").map(Number);
            if (c && r) {
              onUpdateCanvas({ showGrid: true, gridCols: c, gridRows: r });
            }
          }}
          className="h-6 px-1 bg-[var(--bg-panel)] border-l border-[var(--border-color)] text-[10px] font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] outline-none cursor-pointer"
          title="Select Grid Preset"
        >
          {GRID_PRESETS.map((p) => (
            <option key={p.label} value={`${p.cols}x${p.rows}`}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={() => onUpdateCanvas({ loop: !canvas.loop })}
        title="Toggle Playback Loop"
        className={cn(
          "h-6 px-1.5 rounded-md border flex items-center justify-center text-[10px] cursor-pointer transition-colors",
          canvas.loop
            ? "bg-[#cf6613] text-white border-[#e07b27]"
            : "bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-strong)] hover:text-[var(--text-primary)]"
        )}
      >
        <Repeat className="w-3 h-3" />
      </button>

      <button
        type="button"
        onClick={onRequestFullscreen}
        title="Fullscreen Preview"
        className="h-6 px-1.5 rounded-md bg-[var(--bg-card)] border border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer transition-colors"
      >
        <Maximize2 className="w-3 h-3" />
      </button>
      </div>
    </div>
  </div>
);


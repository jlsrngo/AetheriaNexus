import { useCallback, useEffect, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import {
  Compass,
  Film,
  Grid,
  Maximize2,
  Repeat,
  RotateCcw,
  Ruler,
  ShieldAlert,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useStudioStore } from "../../hooks/useStudioStore";
import { cn } from "../../lib/utils";
import { NexusVideoComposition } from "../../remotion/NexusVideoComposition";
import { ErrorBoundary } from "../common/ErrorBoundary";
import { CanvasMinimap } from "./CanvasMinimap";
import { Timeline } from "./Timeline";

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

export const StudioPreview: React.FC = () => {
  const playerRef = useRef<PlayerRef>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportDim, setViewportDim] = useState<{ w: number; h: number }>({ w: 800, h: 600 });
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  // Canvas Viewport Pan State
  const [isPanning, setIsPanning] = useState(false);

  // Selected Layer & Interactive Canvas Drag State (Corel / Photoshop style)
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [selectedLayerBox, setSelectedLayerBox] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
    layerName: string;
  } | null>(null);

  const {
    activeComposition,
    durationInFrames,
    currentFrame,
    isPlaying,
    canvas,
    actions,
  } = useStudioStore();

  useEffect(() => {
    void actions.syncFromBackend();
  }, [actions]);

  // Keep track of viewport container dimensions for 1:1 ruler tracking
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setViewportDim({
          w: entry.contentRect.width,
          h: entry.contentRect.height,
        });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const handleFrame = (event: { detail: { frame: number } }) =>
      actions.setCurrentFrame(event.detail.frame);
    const handlePlay = () => actions.setIsPlaying(true);
    const handlePause = () => actions.setIsPlaying(false);

    player.addEventListener("frameupdate", handleFrame);
    player.addEventListener("play", handlePlay);
    player.addEventListener("pause", handlePause);

    return () => {
      player.removeEventListener("frameupdate", handleFrame);
      player.removeEventListener("play", handlePlay);
      player.removeEventListener("pause", handlePause);
    };
  }, [actions, activeComposition.id]);

  useEffect(() => {
    const onToggleTimeline = () =>
      actions.updateCanvas({ showTimeline: !canvas.showTimeline });
    const onResetZoom = () => actions.updateCanvas({ zoom: "fit", panX: 0, panY: 0 });

    window.addEventListener("arunaki-toggle-timeline", onToggleTimeline);
    window.addEventListener("arunaki-reset-zoom", onResetZoom);
    return () => {
      window.removeEventListener("arunaki-toggle-timeline", onToggleTimeline);
      window.removeEventListener("arunaki-reset-zoom", onResetZoom);
    };
  }, [actions, canvas.showTimeline]);

  const handleSeek = useCallback(
    (frame: number) => {
      playerRef.current?.seekTo(frame);
      actions.setCurrentFrame(frame);
    },
    [actions]
  );

  const handleTogglePlay = useCallback(() => {
    playerRef.current?.toggle();
  }, []);

  const numericZoom =
    canvas.zoom === "fit" ? 1 : Math.max(0.25, Math.min(10, canvas.zoom));
  const isZoomed = canvas.zoom !== "fit" && numericZoom > 1.05;
  const panX = canvas.panX ?? 0;
  const panY = canvas.panY ?? 0;

  // Compute exact canvas coordinate space relative to viewport
  const compW = activeComposition.width;
  const compH = activeComposition.height;
  const fitRatio = Math.min(
    Math.max(1, viewportDim.w - 32) / compW,
    Math.max(1, viewportDim.h - 32) / compH
  );
  const effectiveScale = canvas.zoom === "fit" ? fitRatio : fitRatio * numericZoom;
  const renderedW = compW * effectiveScale;
  const renderedH = compH * effectiveScale;
  const canvasOriginX = (viewportDim.w - renderedW) / 2 + (canvas.zoom === "fit" ? 0 : panX);
  const canvasOriginY = (viewportDim.h - renderedH) / 2 + (canvas.zoom === "fit" ? 0 : panY);

  // Direct Mouse Wheel Zoom (Photoshop/Corel/Figma style, no Ctrl/Alt key required)
  const handleCanvasWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    const currentZoomVal = canvas.zoom === "fit" ? 1 : canvas.zoom;
    const nextZoom = Math.max(
      0.25,
      Math.min(10.0, Number((currentZoomVal * factor).toFixed(2)))
    );
    actions.updateCanvas({ zoom: nextZoom });
  };

  // Synchronize Bounding Box with selected layer's DOM element
  const updateBoundingBox = useCallback(() => {
    if (!selectedLayerId || !viewportRef.current) {
      setSelectedLayerBox(null);
      return;
    }
    const el = viewportRef.current.querySelector(
      `[data-nexus-layer-id="${selectedLayerId}"]`
    ) as HTMLElement | null;
    if (!el) {
      setSelectedLayerBox(null);
      return;
    }
    const elRect = el.getBoundingClientRect();
    const vpRect = viewportRef.current.getBoundingClientRect();
    setSelectedLayerBox({
      left: elRect.left - vpRect.left,
      top: elRect.top - vpRect.top,
      width: elRect.width,
      height: elRect.height,
      layerName: el.getAttribute("data-nexus-layer-name") || selectedLayerId,
    });
  }, [selectedLayerId]);

  useEffect(() => {
    updateBoundingBox();
    const frameId = requestAnimationFrame(updateBoundingBox);
    return () => cancelAnimationFrame(frameId);
  }, [updateBoundingBox, numericZoom, panX, panY, currentFrame, activeComposition.props]);

  // Keyboard Nudge (Pixel-by-pixel micro alignment with arrow keys)
  useEffect(() => {
    if (!selectedLayerId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === "Escape") {
        setSelectedLayerId(null);
        return;
      }

      const step = e.shiftKey ? 10 : 1;
      let dx = 0;
      let dy = 0;

      if (e.key === "ArrowLeft") dx = -step;
      else if (e.key === "ArrowRight") dx = step;
      else if (e.key === "ArrowUp") dy = -step;
      else if (e.key === "ArrowDown") dy = step;
      else return;

      e.preventDefault();
      const currentOffsets = activeComposition.props.layerOffsets || {};
      const cur = currentOffsets[selectedLayerId] || { x: 0, y: 0 };
      actions.updateActiveProps({
        layerOffsets: {
          ...currentOffsets,
          [selectedLayerId]: {
            x: cur.x + dx,
            y: cur.y + dy,
          },
        },
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [actions, activeComposition.props.layerOffsets, selectedLayerId]);

  // Interactive Layer Dragging or Viewport Panning on Canvas
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    const isMiddle = e.button === 1;
    const clickedLayerEl = (e.target as HTMLElement).closest(
      "[data-nexus-layer-id]"
    ) as HTMLElement | null;

    // A. User clicked an interactive component layer on the canvas -> Start layer translation
    if (clickedLayerEl && e.button === 0 && !e.altKey && !isMiddle) {
      e.preventDefault();
      e.stopPropagation();
      const layerId = clickedLayerEl.getAttribute("data-nexus-layer-id");
      if (!layerId) return;

      setSelectedLayerId(layerId);
      const startX = e.clientX;
      const startY = e.clientY;
      const currentOffsets = activeComposition.props.layerOffsets || {};
      const orig = currentOffsets[layerId] || { x: 0, y: 0 };
      const startOffX = orig.x;
      const startOffY = orig.y;

      let rafId: number | null = null;
      let latestX = startOffX;
      let latestY = startOffY;

      const onMove = (moveEvent: MouseEvent) => {
        const dx = (moveEvent.clientX - startX) / effectiveScale;
        const dy = (moveEvent.clientY - startY) / effectiveScale;
        latestX = Math.round(startOffX + dx);
        latestY = Math.round(startOffY + dy);

        if (rafId === null) {
          rafId = requestAnimationFrame(() => {
            rafId = null;
            actions.updateActiveProps({
              layerOffsets: {
                ...activeComposition.props.layerOffsets,
                [layerId]: { x: latestX, y: latestY },
              },
            });
          });
        }
      };

      const onUp = () => {
        if (rafId !== null) cancelAnimationFrame(rafId);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        actions.updateActiveProps({
          layerOffsets: {
            ...activeComposition.props.layerOffsets,
            [layerId]: { x: latestX, y: latestY },
          },
        });
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      return;
    }

    // B. User clicked outside components -> Deselect or Pan Canvas Viewport
    if (e.target === e.currentTarget || isMiddle || e.altKey) {
      if (!isMiddle && !e.altKey) {
        setSelectedLayerId(null);
      }

      e.preventDefault();
      setIsPanning(true);
      const startX = e.clientX;
      const startY = e.clientY;
      const origPanX = panX;
      const origPanY = panY;

      const onMove = (moveEvent: MouseEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        actions.updateCanvas({
          panX: Math.round(origPanX + dx),
          panY: Math.round(origPanY + dy),
        });
      };

      const onUp = () => {
        setIsPanning(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    }
  };

  const handleResetLayerOffset = (layerId: string) => {
    const currentOffsets = { ...(activeComposition.props.layerOffsets || {}) };
    delete currentOffsets[layerId];
    actions.updateActiveProps({ layerOffsets: currentOffsets });
  };

  const scaleStyle: React.CSSProperties =
    canvas.zoom === "fit"
      ? { width: "100%", height: "100%" }
      : {
          width: "100%",
          height: "100%",
          transform: `scale(${numericZoom}) translate(${panX}px, ${panY}px)`,
          transformOrigin: "center center",
          transition: isPanning ? "none" : "transform 0.08s ease-out",
        };

  const gridCols = Math.max(1, Math.min(64, canvas.gridCols || 3));
  const gridRows = Math.max(1, Math.min(64, canvas.gridRows || 3));

  // Dynamic Photoshop / CorelDRAW Style Horizontal Ruler (Follows Pan & Zoom Precision)
  const renderHorizontalRuler = (position: "top" | "bottom") => {
    const width = viewportDim.w;
    if (width <= 0) return null;

    const minStepDocUnits = 65 / Math.max(0.001, effectiveScale);
    const CANDIDATE_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
    const step = CANDIDATE_STEPS.find((s) => s >= minStepDocUnits) || 1000;
    const minorStep = step <= 5 ? 1 : step / 5;

    const startDocX = Math.floor((0 - canvasOriginX) / (step / 5)) * (step / 5);
    const endDocX = Math.ceil((width - canvasOriginX) / (step / 5)) * (step / 5);

    const ticks: Array<{
      val: number;
      screenX: number;
      isMajor: boolean;
      isOrigin: boolean;
    }> = [];

    const maxTicks = 140;
    let count = 0;
    for (
      let docX = startDocX;
      docX <= endDocX && count < maxTicks;
      docX += minorStep, count++
    ) {
      const screenX = Math.round(canvasOriginX + docX * effectiveScale);
      if (screenX >= 0 && screenX <= width) {
        const isMajor = Math.abs(docX % step) < 0.001 || Math.abs(docX) < 0.001;
        const isOrigin = Math.abs(docX) < 0.001;
        ticks.push({ val: Math.round(docX), screenX, isMajor, isOrigin });
      }
    }

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
          {ticks.map(({ val, screenX, isMajor, isOrigin }) => (
            <div
              key={`${val}-${screenX}`}
              className="absolute top-0 bottom-0 pointer-events-none flex flex-col justify-between"
              style={{ left: `${screenX}px` }}
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
                    isOrigin
                      ? "text-amber-400 font-bold"
                      : "text-[var(--text-muted)]",
                    position === "top" ? "top-0.5" : "bottom-0.5",
                    val === 0 ? "left-1" : "-translate-x-1/2"
                  )}
                >
                  {val}
                </span>
              )}
            </div>
          ))}

          {cursorPos && (
            <div
              className="absolute top-0 bottom-0 w-px bg-amber-400/80 pointer-events-none z-20"
              style={{ left: `${cursorPos.x}px` }}
            />
          )}
        </div>
      </div>
    );
  };

  // Dynamic Photoshop / CorelDRAW Style Vertical Ruler (Follows Pan & Zoom Precision)
  const renderVerticalRuler = (position: "left" | "right") => {
    const height = viewportDim.h;
    if (height <= 0) return null;

    const minStepDocUnits = 65 / Math.max(0.001, effectiveScale);
    const CANDIDATE_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
    const step = CANDIDATE_STEPS.find((s) => s >= minStepDocUnits) || 1000;
    const minorStep = step <= 5 ? 1 : step / 5;

    const startDocY = Math.floor((0 - canvasOriginY) / (step / 5)) * (step / 5);
    const endDocY = Math.ceil((height - canvasOriginY) / (step / 5)) * (step / 5);

    const ticks: Array<{
      val: number;
      screenY: number;
      isMajor: boolean;
      isOrigin: boolean;
    }> = [];

    const maxTicks = 140;
    let count = 0;
    for (
      let docY = startDocY;
      docY <= endDocY && count < maxTicks;
      docY += minorStep, count++
    ) {
      const screenY = Math.round(canvasOriginY + docY * effectiveScale);
      if (screenY >= 0 && screenY <= height) {
        const isMajor = Math.abs(docY % step) < 0.001 || Math.abs(docY) < 0.001;
        const isOrigin = Math.abs(docY) < 0.001;
        ticks.push({ val: Math.round(docY), screenY, isMajor, isOrigin });
      }
    }

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
          {ticks.map(({ val, screenY, isMajor, isOrigin }) => (
            <div
              key={`${val}-${screenY}`}
              className="absolute left-0 right-0 pointer-events-none flex items-center justify-between"
              style={{ top: `${screenY}px` }}
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
                    isOrigin
                      ? "text-amber-400 font-bold"
                      : "text-[var(--text-muted)]",
                    position === "left" ? "left-0.5" : "right-0.5",
                    val === 0 ? "top-1" : "-translate-y-1/2"
                  )}
                >
                  {val}
                </span>
              )}
            </div>
          ))}

          {cursorPos && (
            <div
              className="absolute left-0 right-0 h-px bg-amber-400/80 pointer-events-none z-20"
              style={{ top: `${cursorPos.y}px` }}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg-app)]">
      {/* Unified Nexus Canvas Header */}
      <div className="h-9 px-3 border-b border-[var(--border-color)] bg-[var(--bg-panel)] flex items-center justify-between gap-2 text-[11px] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)] shrink-0">
            <Film className="w-3.5 h-3.5 text-[#f97316] shrink-0" />
            <span>Nexus Canvas</span>
          </span>
          <span className="text-[var(--text-muted)] shrink-0">•</span>
          <span className="font-medium text-[var(--text-secondary)] truncate">
            {activeComposition.name}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-color)] font-mono text-[10px] text-[var(--text-muted)] shrink-0 whitespace-nowrap">
            {activeComposition.width}×{activeComposition.height} ({activeComposition.ratio})
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Canvas Zoom Slider Bar (From 0.25x up to 10.0x for Ultra-Deep Precision) */}
          <div className="flex items-center gap-1 px-1.5 h-6 rounded-md bg-[var(--bg-card)] border border-[var(--border-strong)]">
            <button
              type="button"
              onClick={() => {
                if (canvas.zoom === "fit") {
                  actions.updateCanvas({ zoom: 1, panX: 0, panY: 0 });
                } else {
                  actions.updateCanvas({ zoom: "fit", panX: 0, panY: 0 });
                }
              }}
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
              onClick={() => {
                const next = Math.max(0.25, Number((numericZoom * 0.8).toFixed(2)));
                actions.updateCanvas({ zoom: next });
              }}
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
              onChange={(e) =>
                actions.updateCanvas({ zoom: Number(e.target.value) })
              }
              className="w-16 sm:w-24 h-1 accent-[#cf6613] bg-[var(--bg-input)] rounded-lg cursor-ew-resize outline-none"
              title={`Canvas Zoom: ${Math.round(numericZoom * 100)}% (Up to 1000% Zoom)`}
            />

            <button
              type="button"
              onClick={() => {
                const next = Math.min(10.0, Number((numericZoom * 1.25).toFixed(2)));
                actions.updateCanvas({ zoom: next });
              }}
              className="text-[var(--text-muted)] hover:text-amber-400 cursor-pointer p-0.5"
              title="Zoom In Canvas"
            >
              <ZoomIn className="w-3 h-3" />
            </button>

            <span
              onClick={() => actions.updateCanvas({ zoom: "fit", panX: 0, panY: 0 })}
              className="font-mono text-[9px] text-amber-400 font-semibold cursor-pointer shrink-0 pl-0.5"
              title="Click to reset to Fit"
            >
              {canvas.zoom === "fit" ? "Fit" : `${Math.round(numericZoom * 100)}%`}
            </span>
          </div>

          {/* Canvas Minimap Toggle (Icon-only) */}
          <button
            type="button"
            onClick={() => actions.updateCanvas({ showMinimap: !canvas.showMinimap })}
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

          {/* 4-Sided Rulers Toggle (Icon-only) */}
          <button
            type="button"
            onClick={() => actions.updateCanvas({ showRulers: !canvas.showRulers })}
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

          {/* Safe Zone Guides Toggle (Icon-only) */}
          <button
            type="button"
            onClick={() => actions.updateCanvas({ showGuides: !canvas.showGuides })}
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

          {/* Full-Canvas Custom Grid (Mau Berapa Kali Berapa Bisa) */}
          <div className="flex items-center rounded-md bg-[var(--bg-card)] border border-[var(--border-strong)] overflow-hidden">
            <button
              type="button"
              onClick={() => actions.updateCanvas({ showGrid: !canvas.showGrid })}
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

            {/* Direct Editable Columns × Rows (Berapa kali berapa bisa) */}
            <div className="flex items-center gap-0.5 px-1 bg-[var(--bg-panel)] border-l border-[var(--border-strong)] text-[10px] font-mono">
              <input
                type="number"
                min={1}
                max={64}
                value={gridCols}
                onChange={(e) => {
                  const val = Math.max(1, Math.min(64, Number(e.target.value) || 1));
                  actions.updateCanvas({ showGrid: true, gridCols: val });
                }}
                className="w-6 text-center bg-[var(--bg-card)] border border-[var(--border-color)] rounded text-[9px] text-[var(--text-primary)] outline-none focus:border-amber-400"
                title="Grid Columns (Vertical Lines) - Enter any number"
              />
              <span className="text-[var(--text-muted)] text-[9px]">×</span>
              <input
                type="number"
                min={1}
                max={64}
                value={gridRows}
                onChange={(e) => {
                  const val = Math.max(1, Math.min(64, Number(e.target.value) || 1));
                  actions.updateCanvas({ showGrid: true, gridRows: val });
                }}
                className="w-6 text-center bg-[var(--bg-card)] border border-[var(--border-color)] rounded text-[9px] text-[var(--text-primary)] outline-none focus:border-amber-400"
                title="Grid Rows (Horizontal Lines) - Enter any number"
              />
            </div>

            {/* Presets Quick Selector */}
            <select
              value={`${gridCols}x${gridRows}`}
              onChange={(e) => {
                const [c, r] = e.target.value.split("x").map(Number);
                if (c && r) {
                  actions.updateCanvas({
                    showGrid: true,
                    gridCols: c,
                    gridRows: r,
                  });
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

          {/* Loop Toggle */}
          <button
            type="button"
            onClick={() => actions.updateCanvas({ loop: !canvas.loop })}
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

          {/* Fullscreen */}
          <button
            type="button"
            onClick={() => playerRef.current?.requestFullscreen()}
            title="Fullscreen Preview"
            className="h-6 px-1.5 rounded-md bg-[var(--bg-card)] border border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer transition-colors"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Top Dynamic Horizontal Ruler */}
      {canvas.showRulers && renderHorizontalRuler("top")}

      {/* Middle Row: Left Dynamic Vertical Ruler | Canvas Viewport & Minimap | Right Ruler */}
      <div className="flex-1 min-h-0 flex flex-row overflow-hidden relative">
        {canvas.showRulers && renderVerticalRuler("left")}

        {/* Main Video Canvas Viewport */}
        <div
          ref={viewportRef}
          onWheel={handleCanvasWheel}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          }}
          onMouseLeave={() => setCursorPos(null)}
          className={cn(
            "flex-1 min-h-0 flex items-center justify-center p-3 relative overflow-hidden bg-[#0A0A0C]",
            isPanning ? "cursor-grabbing" : isZoomed ? "cursor-grab" : "cursor-default"
          )}
        >
          {/* Full-Canvas Custom N×M Grid Overlay across the entire composition */}
          {canvas.showGrid && (
            <div
              className="pointer-events-none absolute z-20"
              style={{
                left: `${canvasOriginX}px`,
                top: `${canvasOriginY}px`,
                width: `${renderedW}px`,
                height: `${renderedH}px`,
              }}
            >
              {Array.from({ length: gridCols - 1 }, (_, i) => {
                const leftPct = ((i + 1) / gridCols) * 100;
                return (
                  <div
                    key={`v-${i}`}
                    className="absolute top-0 bottom-0 w-px bg-amber-400/40"
                    style={{ left: `${leftPct}%` }}
                  />
                );
              })}
              {Array.from({ length: gridRows - 1 }, (_, i) => {
                const topPct = ((i + 1) / gridRows) * 100;
                return (
                  <div
                    key={`h-${i}`}
                    className="absolute left-0 right-0 h-px bg-amber-400/40"
                    style={{ top: `${topPct}%` }}
                  />
                );
              })}
              <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-[var(--bg-panel)] border border-[var(--border-strong)] font-mono text-[9px] text-amber-400">
                GRID {gridCols}×{gridRows}
              </span>
            </div>
          )}

          <ErrorBoundary
            fullScreen={false}
            fallbackTitle="Preview renderer failed"
            onReset={() => {}}
          >
            <div className="w-full h-full flex items-center justify-center relative select-none">
              <Player
                key={`${activeComposition.id}-${activeComposition.width}x${activeComposition.height}-${activeComposition.fps}`}
                ref={playerRef}
                component={NexusVideoComposition}
                inputProps={activeComposition.props}
                durationInFrames={durationInFrames}
                fps={activeComposition.fps}
                compositionWidth={activeComposition.width}
                compositionHeight={activeComposition.height}
                playbackRate={canvas.playbackRate}
                inFrame={canvas.inFrame}
                outFrame={canvas.outFrame}
                controls={false}
                loop={canvas.loop}
                doubleClickToFullscreen
                acknowledgeRemotionLicense
                style={scaleStyle}
              />

              {/* TikTok / Reels Safe Zone Guide Overlay */}
              {canvas.showGuides && (
                <div
                  className="pointer-events-none absolute border border-dashed border-cyan-400 rounded-lg flex flex-col justify-between p-2 z-10"
                  style={{
                    left: `${canvasOriginX + renderedW * 0.05}px`,
                    top: `${canvasOriginY + renderedH * 0.05}px`,
                    width: `${renderedW * 0.9}px`,
                    height: `${renderedH * 0.9}px`,
                  }}
                >
                  <div className="flex justify-between text-[9px] font-mono text-cyan-300 uppercase">
                    <span className="px-1.5 py-0.5 rounded bg-[var(--bg-panel)] border border-[var(--border-color)]">
                      Safe Zone Top
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-[var(--bg-panel)] border border-[var(--border-color)]">
                      {activeComposition.ratio}
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
              )}
            </div>
          </ErrorBoundary>

          {/* CorelDRAW / Photoshop 8-Handle Bounding Box Overlay on Selected Element */}
          {selectedLayerBox && selectedLayerId && (
            <div
              style={{
                left: `${selectedLayerBox.left}px`,
                top: `${selectedLayerBox.top}px`,
                width: `${selectedLayerBox.width}px`,
                height: `${selectedLayerBox.height}px`,
              }}
              onMouseDown={(e) => handleCanvasMouseDown(e)}
              className="absolute pointer-events-auto border-2 border-amber-400 select-none z-30 cursor-move"
              title="Click and drag to reposition, or use keyboard arrow keys to nudge by 1px"
            >
              {/* 8 Corel / Photoshop Square Handles (Black square with crisp white outline) */}
              <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-black border-2 border-white pointer-events-none shadow" />
              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-black border-2 border-white pointer-events-none shadow" />
              <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-black border-2 border-white pointer-events-none shadow" />
              <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 bg-black border-2 border-white pointer-events-none shadow" />
              <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-black border-2 border-white pointer-events-none shadow" />
              <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-black border-2 border-white pointer-events-none shadow" />
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-black border-2 border-white pointer-events-none shadow" />
              <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-black border-2 border-white pointer-events-none shadow" />

              {/* Center Crosshair × */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/90 text-xs font-mono font-bold pointer-events-none">
                ×
              </div>

              {/* Floating Position Pill */}
              <div className="absolute -top-8 left-0 flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/95 border border-amber-400 text-[10px] font-mono text-white shadow-xl whitespace-nowrap z-40">
                <span className="text-amber-400 font-bold">{selectedLayerBox.layerName}</span>
                <span className="text-[var(--text-muted)]">•</span>
                <span>
                  X: {activeComposition.props.layerOffsets?.[selectedLayerId]?.x ?? 0}px
                </span>
                <span>
                  Y: {activeComposition.props.layerOffsets?.[selectedLayerId]?.y ?? 0}px
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleResetLayerOffset(selectedLayerId);
                  }}
                  className="ml-1 p-0.5 text-amber-400 hover:text-white cursor-pointer"
                  title="Reset Position (0, 0)"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          )}

          {/* Floating Canvas Viewport Minimap */}
          {canvas.showMinimap !== false && (
            <CanvasMinimap
              compositionWidth={activeComposition.width}
              compositionHeight={activeComposition.height}
              ratio={activeComposition.ratio}
              zoom={canvas.zoom}
              panX={panX}
              panY={panY}
              onPanChange={(px, py) => actions.updateCanvas({ panX: px, panY: py })}
              onResetZoom={() => actions.updateCanvas({ zoom: "fit", panX: 0, panY: 0 })}
              onClose={() => actions.updateCanvas({ showMinimap: false })}
            />
          )}
        </div>

        {canvas.showRulers && renderVerticalRuler("right")}
      </div>

      {/* Bottom Dynamic Horizontal Ruler */}
      {canvas.showRulers && renderHorizontalRuler("bottom")}

      {canvas.showTimeline && (
        <Timeline
          compositionId={activeComposition.id}
          durationInFrames={durationInFrames}
          fps={activeComposition.fps}
          currentFrame={currentFrame}
          isPlaying={isPlaying}
          onSeek={handleSeek}
          onTogglePlay={handleTogglePlay}
        />
      )}
    </div>
  );
};

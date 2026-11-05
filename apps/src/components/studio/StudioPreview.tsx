import { useCallback, useEffect, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
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
  { label: "9×16", cols: 9, rows: 16 },
  { label: "16×9", cols: 16, rows: 9 },
];

export const StudioPreview: React.FC = () => {
  const playerRef = useRef<PlayerRef>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);

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
    canvas.zoom === "fit" ? 1 : Math.max(0.25, Math.min(3, canvas.zoom));
  const isZoomed = canvas.zoom !== "fit" && numericZoom > 1.05;
  const panX = canvas.panX ?? 0;
  const panY = canvas.panY ?? 0;

  const handleCanvasWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.altKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.15 : -0.15;
      const nextZoom = Math.max(0.25, Math.min(3, Number((numericZoom + delta).toFixed(2))));
      actions.updateCanvas({ zoom: nextZoom });
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    const isMiddle = e.button === 1;
    const isLeftOnBg = e.button === 0 && (e.target === e.currentTarget || e.altKey);
    if (!isMiddle && !isLeftOnBg) return;

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

  const gridCols = Math.max(1, Math.min(32, canvas.gridCols || 3));
  const gridRows = Math.max(1, Math.min(32, canvas.gridRows || 3));
  const rulerSteps = [0, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100];

  const renderHorizontalRuler = (position: "top" | "bottom") => (
    <div
      className={cn(
        "h-5 bg-[var(--bg-panel)] px-3 relative select-none shrink-0 overflow-hidden",
        position === "top"
          ? "border-b border-[var(--border-color)]"
          : "border-t border-[var(--border-color)]"
      )}
    >
      <div className="relative w-full h-full">
        {Array.from({ length: 41 }, (_, idx) => {
          const pct = idx * 2.5;
          const isMajor = idx % 4 === 0;
          const isMid = idx % 2 === 0 && !isMajor;
          const pxVal = Math.round((pct / 100) * activeComposition.width);
          return (
            <div
              key={idx}
              className="absolute top-0 bottom-0 flex flex-col justify-between pointer-events-none"
              style={{ left: `${pct}%` }}
            >
              <div
                className={cn(
                  "w-px bg-[var(--border-strong)]",
                  position === "top" ? "mt-auto" : "mb-auto",
                  isMajor ? "h-2.5 bg-amber-400/80" : isMid ? "h-1.5" : "h-1"
                )}
              />
              {rulerSteps.includes(pct) && isMajor && (
                <span
                  className={cn(
                    "absolute text-[8px] font-mono text-[var(--text-muted)] whitespace-nowrap",
                    position === "top" ? "top-0.5" : "bottom-0.5",
                    pct >= 100
                      ? "-translate-x-full pr-1"
                      : pct === 0
                      ? "pl-1"
                      : "-translate-x-1/2"
                  )}
                >
                  {pxVal}px
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderVerticalRuler = (position: "left" | "right") => (
    <div
      className={cn(
        "w-7 bg-[var(--bg-panel)] py-3 relative select-none shrink-0 overflow-hidden",
        position === "left"
          ? "border-r border-[var(--border-color)]"
          : "border-l border-[var(--border-color)]"
      )}
    >
      <div className="relative w-full h-full">
        {Array.from({ length: 41 }, (_, idx) => {
          const pct = idx * 2.5;
          const isMajor = idx % 4 === 0;
          const isMid = idx % 2 === 0 && !isMajor;
          const pxVal = Math.round((pct / 100) * activeComposition.height);
          return (
            <div
              key={idx}
              className="absolute left-0 right-0 flex items-center pointer-events-none"
              style={{ top: `${pct}%` }}
            >
              <div
                className={cn(
                  "h-px bg-[var(--border-strong)]",
                  position === "left" ? "ml-auto" : "mr-auto",
                  isMajor ? "w-2.5 bg-amber-400/80" : isMid ? "w-1.5" : "w-1"
                )}
              />
              {isMajor && (
                <span
                  className={cn(
                    "absolute text-[7px] font-mono text-[var(--text-muted)] whitespace-nowrap",
                    position === "left" ? "left-0.5" : "right-0.5",
                    pct >= 100
                      ? "-translate-y-full pb-0.5"
                      : pct === 0
                      ? "pt-0.5"
                      : "-translate-y-1/2"
                  )}
                >
                  {pxVal}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

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
          {/* Canvas Zoom Slider Bar */}
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
                const next = Math.max(0.25, Number((numericZoom - 0.25).toFixed(2)));
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
              max={3}
              step={0.05}
              value={numericZoom}
              onChange={(e) =>
                actions.updateCanvas({ zoom: Number(e.target.value) })
              }
              className="w-16 sm:w-20 h-1 accent-[#cf6613] bg-[var(--bg-input)] rounded-lg cursor-ew-resize outline-none"
              title={`Canvas Zoom: ${Math.round(numericZoom * 100)}%`}
            />

            <button
              type="button"
              onClick={() => {
                const next = Math.min(3, Number((numericZoom + 0.25).toFixed(2)));
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
            title="Toggle 4-Sided Canvas Rulers (Top, Bottom, Left & Right)"
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

          {/* Full-Canvas Grid Toggle (Icon-only) + N×M Selector */}
          <div className="flex items-center rounded-md bg-[var(--bg-card)] border border-[var(--border-strong)] overflow-hidden">
            <button
              type="button"
              onClick={() => actions.updateCanvas({ showGrid: !canvas.showGrid })}
              title="Toggle Full-Canvas Grid Lines"
              className={cn(
                "h-6 px-1.5 flex items-center justify-center cursor-pointer transition-colors",
                canvas.showGrid
                  ? "bg-[#cf6613] text-white"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              <Grid className="w-3.5 h-3.5 shrink-0" />
            </button>
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
              className="h-6 px-1.5 bg-[var(--bg-panel)] border-l border-[var(--border-strong)] text-[10px] font-mono text-[var(--text-primary)] outline-none cursor-pointer"
              title="Select Grid Columns × Rows"
            >
              {GRID_PRESETS.map((p) => (
                <option key={p.label} value={`${p.cols}x${p.rows}`}>
                  {p.label}
                </option>
              ))}
            </select>
            {canvas.showGrid && (
              <div className="flex items-center gap-0.5 px-1 bg-[var(--bg-panel)] border-l border-[var(--border-color)] text-[10px] font-mono">
                <input
                  type="number"
                  min={1}
                  max={32}
                  value={gridCols}
                  onChange={(e) =>
                    actions.updateCanvas({
                      gridCols: Math.max(1, Math.min(32, Number(e.target.value) || 1)),
                    })
                  }
                  className="w-6 text-center bg-[var(--bg-card)] border border-[var(--border-color)] rounded text-[9px] text-[var(--text-primary)] outline-none"
                  title="Grid Columns"
                />
                <span className="text-[var(--text-muted)] text-[9px]">×</span>
                <input
                  type="number"
                  min={1}
                  max={32}
                  value={gridRows}
                  onChange={(e) =>
                    actions.updateCanvas({
                      gridRows: Math.max(1, Math.min(32, Number(e.target.value) || 1)),
                    })
                  }
                  className="w-6 text-center bg-[var(--bg-card)] border border-[var(--border-color)] rounded text-[9px] text-[var(--text-primary)] outline-none"
                  title="Grid Rows"
                />
              </div>
            )}
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

      {/* Top Horizontal Ruler */}
      {canvas.showRulers && renderHorizontalRuler("top")}

      {/* Middle Row: Left Vertical Ruler | Canvas Viewport & Minimap | Right Vertical Ruler */}
      <div className="flex-1 min-h-0 flex flex-row overflow-hidden relative">
        {canvas.showRulers && renderVerticalRuler("left")}

        {/* Main Video Canvas Viewport */}
        <div
          ref={viewportRef}
          onWheel={handleCanvasWheel}
          onMouseDown={handleCanvasMouseDown}
          className={cn(
            "flex-1 min-h-0 flex items-center justify-center p-3 relative overflow-hidden bg-[#0A0A0C]",
            isPanning ? "cursor-grabbing" : isZoomed ? "cursor-grab" : "cursor-default"
          )}
        >
          {/* Full-Canvas N×M Grid Overlay across the entire canvas area */}
          {canvas.showGrid && (
            <div className="pointer-events-none absolute inset-0 z-20">
              {Array.from({ length: gridCols - 1 }, (_, i) => {
                const leftPct = ((i + 1) / gridCols) * 100;
                return (
                  <div
                    key={`v-${i}`}
                    className="absolute top-0 bottom-0 w-px bg-amber-400/35"
                    style={{ left: `${leftPct}%` }}
                  />
                );
              })}
              {Array.from({ length: gridRows - 1 }, (_, i) => {
                const topPct = ((i + 1) / gridRows) * 100;
                return (
                  <div
                    key={`h-${i}`}
                    className="absolute left-0 right-0 h-px bg-amber-400/35"
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
            <div className="w-full h-full flex items-center justify-center relative">
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
                clickToPlay
                doubleClickToFullscreen
                acknowledgeRemotionLicense
                style={scaleStyle}
              />

              {/* TikTok / Reels Safe Zone Guide Overlay */}
              {canvas.showGuides && (
                <div className="pointer-events-none absolute inset-6 border border-dashed border-cyan-400 rounded-lg flex flex-col justify-between p-2 z-10">
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

      {/* Bottom Horizontal Ruler */}
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

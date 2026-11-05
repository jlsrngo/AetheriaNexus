import { useCallback, useEffect, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import {
  Film,
  Grid,
  Maximize2,
  Repeat,
  Ruler,
  ShieldAlert,
} from "lucide-react";
import { useStudioStore } from "../../hooks/useStudioStore";
import { cn } from "../../lib/utils";
import { NexusVideoComposition } from "../../remotion/NexusVideoComposition";
import { ErrorBoundary } from "../common/ErrorBoundary";
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
    const onResetZoom = () => actions.updateCanvas({ zoom: "fit" });

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

  const scaleStyle =
    canvas.zoom === "fit"
      ? { width: "100%", height: "100%" }
      : {
          width: "100%",
          height: "100%",
          transform: `scale(${canvas.zoom})`,
          transformOrigin: "center center",
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
          {/* Zoom selector */}
          <select
            value={String(canvas.zoom)}
            onChange={(e) => {
              const v = e.target.value;
              actions.updateCanvas({
                zoom: v === "fit" ? "fit" : (Number(v) as 0.5 | 0.75 | 1 | 1.5),
              });
            }}
            className="h-6 px-1.5 rounded-md bg-[var(--bg-card)] border border-[var(--border-strong)] text-[10px] font-mono text-[var(--text-primary)] outline-none cursor-pointer"
            title="Preview Zoom"
          >
            <option value="fit">Fit</option>
            <option value="0.5">50%</option>
            <option value="0.75">75%</option>
            <option value="1">100%</option>
            <option value="1.5">150%</option>
          </select>

          {/* Top & Bottom Rulers Toggle */}
          <button
            type="button"
            onClick={() => actions.updateCanvas({ showRulers: !canvas.showRulers })}
            title="Toggle Top & Bottom Canvas Rulers"
            className={cn(
              "h-6 px-2 rounded-md border flex items-center gap-1 text-[10px] cursor-pointer transition-colors whitespace-nowrap",
              canvas.showRulers
                ? "bg-[#cf6613] text-white border-[#e07b27] font-semibold"
                : "bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-strong)] hover:text-[var(--text-primary)]"
            )}
          >
            <Ruler className="w-3 h-3 shrink-0" />
            <span>Ruler</span>
          </button>

          {/* Safe Zone Guides Toggle */}
          <button
            type="button"
            onClick={() => actions.updateCanvas({ showGuides: !canvas.showGuides })}
            title="Toggle TikTok Safe Zone Guides"
            className={cn(
              "h-6 px-2 rounded-md border flex items-center gap-1 text-[10px] cursor-pointer transition-colors whitespace-nowrap",
              canvas.showGuides
                ? "bg-[#cf6613] text-white border-[#e07b27] font-semibold"
                : "bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-strong)] hover:text-[var(--text-primary)]"
            )}
          >
            <ShieldAlert className="w-3 h-3 shrink-0" />
            <span>Safe Zone</span>
          </button>

          {/* Full-Canvas Grid Toggle + N×M Selector */}
          <div className="flex items-center rounded-md bg-[var(--bg-card)] border border-[var(--border-strong)] overflow-hidden">
            <button
              type="button"
              onClick={() => actions.updateCanvas({ showGrid: !canvas.showGrid })}
              title="Toggle Full-Canvas Grid Lines"
              className={cn(
                "h-6 px-2 flex items-center gap-1 text-[10px] cursor-pointer transition-colors whitespace-nowrap",
                canvas.showGrid
                  ? "bg-[#cf6613] text-white font-semibold"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              <Grid className="w-3 h-3 shrink-0" />
              <span>Grid</span>
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
              <div className="flex items-center gap-0.5 px-1.5 bg-[var(--bg-panel)] border-l border-[var(--border-color)] text-[10px] font-mono">
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
                  className="w-7 text-center bg-[var(--bg-card)] border border-[var(--border-color)] rounded text-[10px] text-[var(--text-primary)] outline-none"
                  title="Grid Columns"
                />
                <span className="text-[var(--text-muted)]">×</span>
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
                  className="w-7 text-center bg-[var(--bg-card)] border border-[var(--border-color)] rounded text-[10px] text-[var(--text-primary)] outline-none"
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
              "h-6 px-2 rounded-md border flex items-center gap-1 text-[10px] cursor-pointer transition-colors",
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
            className="h-6 px-2 rounded-md bg-[var(--bg-card)] border border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center cursor-pointer transition-colors"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Top Ruler */}
      {canvas.showRulers && renderHorizontalRuler("top")}

      {/* Main Video Canvas Viewport */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-3 relative overflow-hidden">
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
      </div>

      {/* Bottom Ruler */}
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

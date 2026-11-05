import { useCallback, useEffect, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { Grid, Maximize2, Repeat, ShieldAlert } from "lucide-react";
import { useStudioStore } from "../../hooks/useStudioStore";
import { cn } from "../../lib/utils";
import { NexusVideoComposition } from "../../remotion/NexusVideoComposition";
import { ErrorBoundary } from "../common/ErrorBoundary";
import { Timeline } from "./Timeline";

/**
 * In-app preview surface. Remotion's runtime draws the composition inside the WebView,
 * driven by our centralized useStudioStore so Compositions, Inspector, Elements, and
 * Render Queue all stay in real-time sync.
 */
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

  // Listen to global View menu events
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

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg-app)]">
      {/* Stage Canvas Toolbar (Remotion PreviewToolbar parity) */}
      <div className="h-8 px-3 border-b border-[var(--border-color)] bg-[var(--bg-panel)]/60 flex items-center justify-between text-[11px] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-[var(--text-primary)] truncate">
            {activeComposition.name}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-color)] font-mono text-[10px] text-[var(--text-muted)]">
            {activeComposition.width}×{activeComposition.height} ({activeComposition.ratio})
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Zoom selector */}
          <select
            value={String(canvas.zoom)}
            onChange={(e) => {
              const v = e.target.value;
              actions.updateCanvas({
                zoom: v === "fit" ? "fit" : (Number(v) as 0.5 | 0.75 | 1 | 1.5),
              });
            }}
            className="h-6 px-1.5 rounded-md bg-[var(--bg-card)] border border-[var(--border-color)] text-[10px] font-mono text-[var(--text-secondary)] outline-none cursor-pointer"
            title="Preview Zoom"
          >
            <option value="fit">Fit</option>
            <option value="0.5">50%</option>
            <option value="0.75">75%</option>
            <option value="1">100%</option>
            <option value="1.5">150%</option>
          </select>

          {/* Safe Zone Guides Toggle */}
          <button
            type="button"
            onClick={() => actions.updateCanvas({ showGuides: !canvas.showGuides })}
            title="Toggle TikTok Safe Zone Guides"
            className={cn(
              "h-6 px-2 rounded-md border flex items-center gap-1 text-[10px] cursor-pointer transition-colors",
              canvas.showGuides
                ? "bg-[var(--bg-hover)] text-[var(--text-primary)] border-[var(--border-strong)]"
                : "bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-color)] hover:text-[var(--text-primary)]"
            )}
          >
            <ShieldAlert className="w-3 h-3" />
            <span>Safe Zone</span>
          </button>

          {/* Checkerboard Toggle */}
          <button
            type="button"
            onClick={() =>
              actions.updateCanvas({ showCheckerboard: !canvas.showCheckerboard })
            }
            title="Toggle Checkerboard Transparency"
            className={cn(
              "h-6 px-2 rounded-md border flex items-center gap-1 text-[10px] cursor-pointer transition-colors",
              canvas.showCheckerboard
                ? "bg-[var(--bg-hover)] text-[var(--text-primary)] border-[var(--border-strong)]"
                : "bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-color)] hover:text-[var(--text-primary)]"
            )}
          >
            <Grid className="w-3 h-3" />
          </button>

          {/* Loop Toggle */}
          <button
            type="button"
            onClick={() => actions.updateCanvas({ loop: !canvas.loop })}
            title="Toggle Playback Loop"
            className={cn(
              "h-6 px-2 rounded-md border flex items-center gap-1 text-[10px] cursor-pointer transition-colors",
              canvas.loop
                ? "bg-[var(--bg-hover)] text-emerald-400 border-[var(--border-strong)]"
                : "bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-color)] hover:text-[var(--text-primary)]"
            )}
          >
            <Repeat className="w-3 h-3" />
          </button>

          {/* Fullscreen */}
          <button
            type="button"
            onClick={() => playerRef.current?.requestFullscreen()}
            title="Fullscreen Preview"
            className="h-6 px-2 rounded-md bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center cursor-pointer transition-colors"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Main Video Canvas Viewport */}
      <div
        className="flex-1 min-h-0 flex items-center justify-center p-3 relative overflow-hidden"
        style={
          canvas.showCheckerboard
            ? {
                backgroundImage:
                  "linear-gradient(45deg, #16161c 25%, transparent 25%), linear-gradient(-45deg, #16161c 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #16161c 75%), linear-gradient(-45deg, transparent 75%, #16161c 75%)",
                backgroundSize: "16px 16px",
                backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
              }
            : undefined
        }
      >
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
              <div className="pointer-events-none absolute inset-6 border border-dashed border-cyan-400/50 rounded-lg flex flex-col justify-between p-2">
                <div className="flex justify-between text-[9px] font-mono text-cyan-300/80 uppercase">
                  <span>Safe Zone Top</span>
                  <span>{activeComposition.ratio}</span>
                </div>
                <div className="flex justify-between items-end">
                  <span className="text-[9px] font-mono text-cyan-300/80">
                    Caption Safe Area
                  </span>
                  <div className="w-10 h-28 border border-dashed border-rose-400/50 rounded flex items-center justify-center text-[8px] font-mono text-rose-300/80 text-center">
                    UI Icons
                  </div>
                </div>
              </div>
            )}
          </div>
        </ErrorBoundary>
      </div>

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

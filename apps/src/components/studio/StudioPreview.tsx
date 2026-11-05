import { useCallback, useEffect, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { NexusVideoComposition } from "../../remotion/NexusVideoComposition";
import { defaultNexusVideoProps, nexusVideoSpec } from "../../remotion/types";
import { ErrorBoundary } from "../common/ErrorBoundary";
import { Timeline } from "./Timeline";

/**
 * In-app preview surface. Remotion's runtime draws the composition inside the WebView,
 * so there is no Studio server, no port, and no iframe. The surrounding UI is ours.
 */
export const StudioPreview: React.FC = () => {
  const playerRef = useRef<PlayerRef>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const handleFrame = (event: { detail: { frame: number } }) => setCurrentFrame(event.detail.frame);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    player.addEventListener("frameupdate", handleFrame);
    player.addEventListener("play", handlePlay);
    player.addEventListener("pause", handlePause);

    return () => {
      player.removeEventListener("frameupdate", handleFrame);
      player.removeEventListener("play", handlePlay);
      player.removeEventListener("pause", handlePause);
    };
  }, []);

  const handleSeek = useCallback((frame: number) => {
    playerRef.current?.seekTo(frame);
    setCurrentFrame(frame);
  }, []);

  const handleTogglePlay = useCallback(() => {
    playerRef.current?.toggle();
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-neutral-950">
      <div className="flex-1 min-h-0 flex items-center justify-center p-3">
        {/* Boundary is around the Player only, so a renderer crash never takes the shell or timeline with it.
            onReset is a no-op because the default one reloads the whole window. */}
        <ErrorBoundary fullScreen={false} fallbackTitle="Preview renderer failed" onReset={() => {}}>
          <Player
            ref={playerRef}
            component={NexusVideoComposition}
            inputProps={defaultNexusVideoProps}
            durationInFrames={nexusVideoSpec.durationInFrames}
            fps={nexusVideoSpec.fps}
            compositionWidth={nexusVideoSpec.width}
            compositionHeight={nexusVideoSpec.height}
            controls={false}
            loop
            clickToPlay
            doubleClickToFullscreen
            acknowledgeRemotionLicense
            style={{ width: "100%", height: "100%" }}
          />
        </ErrorBoundary>
      </div>

      <Timeline
        compositionId={nexusVideoSpec.id}
        durationInFrames={nexusVideoSpec.durationInFrames}
        fps={nexusVideoSpec.fps}
        currentFrame={currentFrame}
        isPlaying={isPlaying}
        onSeek={handleSeek}
        onTogglePlay={handleTogglePlay}
      />
    </div>
  );
};

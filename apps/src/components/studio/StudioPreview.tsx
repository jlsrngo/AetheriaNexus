import { useCallback, useEffect, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { NexusVideoComposition } from "../../remotion/NexusVideoComposition";
import { defaultNexusVideoProps } from "../../remotion/types";
import { Timeline } from "./Timeline";

// Mirrors the Composition registered in apps/src/remotion/Root.tsx.
const COMPOSITION_ID = "NexusEditorialVideo";
const DURATION_IN_FRAMES = 150;
const FPS = 30;
const WIDTH = 1080;
const HEIGHT = 1920;

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
        <Player
          ref={playerRef}
          component={NexusVideoComposition}
          inputProps={defaultNexusVideoProps}
          durationInFrames={DURATION_IN_FRAMES}
          fps={FPS}
          compositionWidth={WIDTH}
          compositionHeight={HEIGHT}
          controls={false}
          loop
          clickToPlay
          doubleClickToFullscreen
          acknowledgeRemotionLicense
          style={{ width: "100%", height: "100%" }}
        />
      </div>

      <Timeline
        compositionId={COMPOSITION_ID}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        currentFrame={currentFrame}
        isPlaying={isPlaying}
        onSeek={handleSeek}
        onTogglePlay={handleTogglePlay}
      />
    </div>
  );
};

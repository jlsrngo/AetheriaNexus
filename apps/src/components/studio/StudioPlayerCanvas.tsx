import React, { useState, useRef, useEffect } from "react";
import { Player, PlayerRef } from "@remotion/player";
import { NexusVideoComposition } from "../../remotion/NexusVideoComposition";
import {
  NexusVideoProps,
  defaultNexusVideoProps,
} from "../../remotion/types";
import {
  StudioPlayerHeader,
  CanvasRatio,
  CanvasFps,
  CanvasDuration,
} from "./StudioPlayerHeader";
import { StudioTimeline } from "./StudioTimeline";
import { CornerCrosses } from "../ui/CornerCrosses";
import { renderNexusVideo } from "../../lib/api";
import { toast } from "sonner";

interface StudioPlayerCanvasProps {
  props?: NexusVideoProps;
  onRender?: () => void;
  isRendering?: boolean;
  renderProgress?: number;
}

export const StudioPlayerCanvas: React.FC<StudioPlayerCanvasProps> = ({
  props = defaultNexusVideoProps,
  onRender,
  isRendering = false,
  renderProgress = 0,
}) => {
  const [ratio, setRatio] = useState<CanvasRatio>("9:16");
  const [fps, setFps] = useState<CanvasFps>(30);
  const [duration, setDuration] = useState<CanvasDuration>(5);
  const [internalRendering, setInternalRendering] = useState(false);
  const [internalProgress, setInternalProgress] = useState(0);

  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  const playerRef = useRef<PlayerRef>(null);

  const activeRendering = isRendering || internalRendering;
  const activeProgress = renderProgress || internalProgress;

  const durationInFrames = duration * fps;

  // Real-time synchronization between Remotion Player and Timeline Scrubber
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const onFrameUpdate = (e: { detail: { frame: number } }) => {
      setCurrentFrame(e.detail.frame);
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onSeeked = (e: { detail: { frame: number } }) => {
      setCurrentFrame(e.detail.frame);
    };

    player.addEventListener("frameupdate", onFrameUpdate as any);
    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    player.addEventListener("seeked", onSeeked as any);

    return () => {
      player.removeEventListener("frameupdate", onFrameUpdate as any);
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
      player.removeEventListener("seeked", onSeeked as any);
    };
  }, [playerRef.current]);

  const handleRender = async () => {
    if (onRender) {
      onRender();
      return;
    }

    setInternalRendering(true);
    setInternalProgress(15);
    toast.info("Starting Local Remotion Render Engine...", {
      description: "Bundling composition & rendering MP4 via hardware acceleration...",
    });

    try {
      setInternalProgress(45);
      const res = await renderNexusVideo(JSON.stringify(props));
      setInternalProgress(100);
      toast.success("MP4 Video Rendered Successfully!", {
        description: res.outputPath || "Export saved to output/ folder.",
      });
    } catch (err: any) {
      console.error("Render error:", err);
      toast.error("Render Failed", {
        description: err?.message || String(err),
      });
    } finally {
      setInternalRendering(false);
      setInternalProgress(0);
    }
  };

  const getDimensions = () => {
    switch (ratio) {
      case "16:9":
        return {
          width: 1920,
          height: 1080,
          containerClass: "w-full max-w-[540px] aspect-[16/9]",
          label: "16:9 // 1920x1080 PX",
        };
      case "1:1":
        return {
          width: 1080,
          height: 1080,
          containerClass: "w-full max-w-[360px] aspect-square",
          label: "1:1 // 1080x1080 PX",
        };
      case "9:16":
      default:
        return {
          width: 1080,
          height: 1920,
          containerClass: "w-full max-w-[280px] aspect-[9/16]",
          label: "9:16 // 1080x1920 PX",
        };
    }
  };

  const dim = getDimensions();

  return (
    <div className="flex-1 flex flex-col h-full w-full bg-neutral-950 overflow-hidden select-none">
      {/* 1. Technical HUD Header with Ratio, FPS, Duration & Render Button */}
      <StudioPlayerHeader
        ratio={ratio}
        onRatioChange={setRatio}
        fps={fps}
        onFpsChange={setFps}
        duration={duration}
        onDurationChange={setDuration}
        onRender={handleRender}
        isRendering={activeRendering}
        renderProgress={activeProgress}
      />

      {/* 2. Main Player Viewport Stage */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 relative overflow-hidden bg-[radial-gradient(#1f1f1f_1px,transparent_1px)] [background-size:16px_16px]">
        {/* Viewport Frame with Swiss Brutalism Sharp Borders & Corner Crosses */}
        <div
          className={`${dim.containerClass} relative bg-black border border-neutral-700 shadow-2xl flex items-center justify-center overflow-hidden transition-all duration-300 rounded-none`}
        >
          <CornerCrosses className="text-white" size="md" />

          <Player
            ref={playerRef}
            component={NexusVideoComposition}
            inputProps={props}
            durationInFrames={durationInFrames}
            fps={fps}
            compositionWidth={dim.width}
            compositionHeight={dim.height}
            style={{
              width: "100%",
              height: "100%",
            }}
            controls
            alwaysShowControls
            spaceKeyToPlayOrPause
            clickToPlay
            doubleClickToFullscreen
            loop
            autoPlay
          />
        </div>

        {/* Telemetry Stage Info */}
        <div className="mt-2 flex items-center gap-4 font-mono text-[10px] text-neutral-400 tracking-wider">
          <span>// STAGE: {dim.label}</span>
          <span className="text-neutral-700">|</span>
          <span>FPS: {fps}</span>
          <span className="text-neutral-700">|</span>
          <span>FRAMES: {durationInFrames}</span>
          <span className="text-neutral-700">|</span>
          <span>CODEC: H.264 / AAC</span>
        </div>
      </div>

      {/* 3. Bottom Multi-Track Remotion Timeline HUD */}
      <StudioTimeline
        currentFrame={currentFrame}
        durationInFrames={durationInFrames}
        fps={fps}
        isPlaying={isPlaying}
        onPlayPause={() => {
          if (playerRef.current) {
            playerRef.current.toggle();
          }
        }}
        onSeek={(frame) => {
          if (playerRef.current) {
            playerRef.current.seekTo(frame);
            setCurrentFrame(frame);
          }
        }}
      />
    </div>
  );
};

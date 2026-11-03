import React, { useState } from "react";
import { Player } from "@remotion/player";
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
import { CornerCrosses } from "../ui/CornerCrosses";

interface StudioPlayerCanvasProps {
  props?: NexusVideoProps;
  onRender?: () => void;
  isRendering?: boolean;
  renderProgress?: number;
}

export const StudioPlayerCanvas: React.FC<StudioPlayerCanvasProps> = ({
  props = defaultNexusVideoProps,
  onRender = () => {},
  isRendering = false,
  renderProgress = 0,
}) => {
  const [ratio, setRatio] = useState<CanvasRatio>("9:16");
  const [fps, setFps] = useState<CanvasFps>(30);
  const [duration, setDuration] = useState<CanvasDuration>(5);

  const getDimensions = () => {
    switch (ratio) {
      case "16:9":
        return {
          width: 1920,
          height: 1080,
          containerClass: "w-full max-w-[640px] aspect-[16/9]",
          label: "16:9 // 1920x1080 PX",
        };
      case "1:1":
        return {
          width: 1080,
          height: 1080,
          containerClass: "w-full max-w-[420px] aspect-square",
          label: "1:1 // 1080x1080 PX",
        };
      case "9:16":
      default:
        return {
          width: 1080,
          height: 1920,
          containerClass: "w-full max-w-[340px] aspect-[9/16]",
          label: "9:16 // 1080x1920 PX",
        };
    }
  };

  const dim = getDimensions();
  const durationInFrames = duration * fps;

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
        onRender={onRender}
        isRendering={isRendering}
        renderProgress={renderProgress}
      />

      {/* 2. Main Player Viewport Stage */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-y-auto bg-[radial-gradient(#1f1f1f_1px,transparent_1px)] [background-size:16px_16px]">
        {/* Viewport Frame with Swiss Brutalism Sharp Borders & Corner Crosses */}
        <div
          className={`${dim.containerClass} relative bg-black border border-neutral-700 shadow-2xl flex items-center justify-center overflow-hidden transition-all duration-300 rounded-none`}
        >
          <CornerCrosses className="text-white" size="md" />

          <Player
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
            loop
            autoPlay
          />
        </div>

        {/* 3. Bottom Telemetry Bar */}
        <div className="mt-4 flex items-center gap-4 font-mono text-[10px] text-neutral-400 tracking-wider">
          <span>// STAGE: {dim.label}</span>
          <span className="text-neutral-700">|</span>
          <span>FPS: {fps}</span>
          <span className="text-neutral-700">|</span>
          <span>FRAMES: {durationInFrames}</span>
          <span className="text-neutral-700">|</span>
          <span>CODEC: H.264 / AAC</span>
        </div>
      </div>
    </div>
  );
};

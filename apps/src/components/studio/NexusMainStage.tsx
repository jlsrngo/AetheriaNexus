import React, { useState } from "react";
import { Player, PlayerRef } from "@remotion/player";
import { NexusVideoComposition } from "../../remotion/NexusVideoComposition";
import { NexusVideoProps } from "../../remotion/types";


interface NexusMainStageProps {
  videoProps: NexusVideoProps;
  playerRef: React.RefObject<PlayerRef | null>;
  fps?: number;
  durationInSeconds?: number;
  ratio?: "9:16" | "16:9" | "1:1";
  onChangeRatio?: (ratio: "9:16" | "16:9" | "1:1") => void;
}

export const NexusMainStage: React.FC<NexusMainStageProps> = ({
  videoProps,
  playerRef,
  fps = 30,
  durationInSeconds = 5,
  ratio = "9:16",
  onChangeRatio,
}) => {
  const [zoom, setZoom] = useState<"fit" | "50%" | "100%">("fit");
  const durationInFrames = Math.max(30, Math.round(durationInSeconds * fps));

  const aspectStyles = {
    "9:16": { aspectRatio: "9 / 16", width: zoom === "100%" ? "420px" : "auto", height: zoom === "100%" ? "auto" : "90%" },
    "16:9": { aspectRatio: "16 / 9", width: "90%", height: "auto" },
    "1:1": { aspectRatio: "1 / 1", width: "auto", height: "85%" },
  }[ratio];

  const resolutionText = {
    "9:16": "1080x1920 (9:16)",
    "16:9": "1920x1080 (16:9)",
    "1:1": "1080x1080 (1:1)",
  }[ratio];

  return (
    <div className="flex-1 flex flex-col bg-[#07090E] relative overflow-hidden select-none font-mono">
      {/* CAD Technical Grid Background Pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.04) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.04) 1px, transparent 1px)
          `,
          backgroundSize: "32px 32px",
        }}
      />

      {/* Main Stage Top Telemetry & Monitor Controls */}
      <div className="h-8 px-3 border-b border-neutral-800 bg-neutral-950 flex items-center justify-between text-xs z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-extrabold text-[11px] tracking-wider text-white uppercase">
            <span className="w-2 h-2 bg-orange-500 rounded-none inline-block" />
            <span>PREVIEW MONITOR</span>
          </div>

          <span className="text-neutral-700">|</span>

          {/* Aspect Ratio Switcher */}
          <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 p-0.5 text-[10px]">
            {(["9:16", "1:1", "16:9"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onChangeRatio?.(r)}
                className={`px-1.5 py-0.5 transition-none cursor-pointer ${
                  ratio === r
                    ? "bg-neutral-800 text-white font-bold"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Right Monitor Metadata & Zoom */}
        <div className="flex items-center gap-3 text-[11px] text-neutral-400">
          <span className="font-mono text-neutral-300">{resolutionText}</span>
          <span className="text-neutral-700">|</span>
          <span className="font-mono text-neutral-300">{fps} FPS</span>
          <span className="text-neutral-700">|</span>

          {/* Zoom Level */}
          <div className="flex items-center gap-1 text-[10px]">
            {(["fit", "50%", "100%"] as const).map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => setZoom(z)}
                className={`px-1.5 py-0.5 border transition-none cursor-pointer uppercase ${
                  zoom === z
                    ? "border-orange-500 text-orange-400 bg-neutral-900 font-bold"
                    : "border-neutral-800 text-neutral-400 hover:text-white"
                }`}
              >
                {z}
              </button>
            ))}
          </div>

          <span className="text-neutral-700">|</span>
          <div className="flex items-center gap-1.5 text-orange-400 font-bold text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
            <span>LIVE PREVIEW</span>
          </div>
        </div>
      </div>

      {/* Stage Canvas Area - Sharp, Professional Video Editing Canvas */}
      <div className="flex-1 flex items-center justify-center p-4 relative z-10 overflow-hidden">
        {/* Standard Video Editing Monitor (Sharp 90-degree corners, Swiss Brutalism) */}
        <div
          className="relative bg-black border border-neutral-700 shadow-2xl flex flex-col justify-center items-center overflow-hidden"
          style={{
            ...aspectStyles,
            maxHeight: "92%",
            maxWidth: "92%",
          }}
        >
          {/* Technical Corner Crosses (+) ala Blueprint */}
          <div className="absolute top-1 left-1.5 text-[11px] font-mono text-neutral-600 pointer-events-none z-20">+</div>
          <div className="absolute top-1 right-1.5 text-[11px] font-mono text-neutral-600 pointer-events-none z-20">+</div>
          <div className="absolute bottom-1 left-1.5 text-[11px] font-mono text-neutral-600 pointer-events-none z-20">+</div>
          <div className="absolute bottom-1 right-1.5 text-[11px] font-mono text-neutral-600 pointer-events-none z-20">+</div>

          {/* Actual Remotion Player Engine Rendering Live Video */}
          <div className="w-full h-full relative overflow-hidden bg-black flex items-center justify-center">
            <Player
              ref={playerRef}
              component={NexusVideoComposition}
              inputProps={videoProps}
              durationInFrames={durationInFrames}
              fps={fps}
              compositionWidth={ratio === "16:9" ? 1920 : ratio === "1:1" ? 1080 : 1080}
              compositionHeight={ratio === "16:9" ? 1080 : ratio === "1:1" ? 1080 : 1920}
              style={{
                width: "100%",
                height: "100%",
              }}
              controls={false}
              autoPlay={false}
              loop
              spaceKeyToPlayOrPause
            />
          </div>
        </div>
      </div>
    </div>
  );
};

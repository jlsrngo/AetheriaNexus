import React from "react";
import { Player, PlayerRef } from "@remotion/player";
import { NexusVideoComposition } from "../../remotion/NexusVideoComposition";
import { NexusVideoProps } from "../../remotion/types";

interface NexusMainStageProps {
  videoProps: NexusVideoProps;
  playerRef: React.RefObject<PlayerRef | null>;
  fps?: number;
  durationInSeconds?: number;
}

export const NexusMainStage: React.FC<NexusMainStageProps> = ({
  videoProps,
  playerRef,
  fps = 30,
  durationInSeconds = 5,
}) => {
  const durationInFrames = Math.max(30, Math.round(durationInSeconds * fps));

  return (
    <div className="flex-1 flex flex-col bg-[#050B14] relative overflow-hidden select-none font-mono">
      {/* Blueprint Grid Background Pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(0, 229, 255, 0.08) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0, 229, 255, 0.08) 1px, transparent 1px)
          `,
          backgroundSize: "28px 28px",
        }}
      />

      {/* Main Stage Top Telemetry Bar */}
      <div className="h-8 px-3 border-b border-neutral-800/80 bg-neutral-950/80 flex items-center justify-between text-xs z-10 shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-[11px] tracking-wider text-white uppercase">
            MAIN STAGE
          </span>
          <span className="text-neutral-600">//</span>
          <span className="text-neutral-400 text-[10px]">PREVIEW VIEWPORT</span>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-neutral-400">
          <span className="font-mono text-neutral-300">1080x1920</span>
          <span className="text-neutral-700">|</span>
          <span className="font-mono text-neutral-300">{fps} FPS</span>
          <span className="text-neutral-700">|</span>
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>REC READY</span>
          </div>
        </div>
      </div>

      {/* Stage Canvas Area with Center Phone Bezel Mockup */}
      <div className="flex-1 flex items-center justify-center p-3 relative z-10 overflow-hidden">
        {/* Smartphone Bezel Mockup Frame */}
        <div
          className="relative bg-black border-[3px] border-neutral-700 shadow-2xl flex flex-col justify-between overflow-hidden"
          style={{
            height: "94%",
            aspectRatio: "9 / 16",
            borderRadius: "32px",
            boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 40px rgba(0, 229, 255, 0.06)",
          }}
        >
          {/* Dynamic Island / Camera Notch */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-4 bg-neutral-900 border border-neutral-800 rounded-full z-30 pointer-events-none flex items-center justify-end px-2">
            <div className="w-2 h-2 rounded-full bg-neutral-950 border border-neutral-800" />
          </div>

          {/* Actual Remotion Player Engine Rendering Live Video */}
          <div className="w-full h-full relative overflow-hidden bg-black flex items-center justify-center">
            <Player
              ref={playerRef}
              component={NexusVideoComposition}
              inputProps={videoProps}
              durationInFrames={durationInFrames}
              fps={fps}
              compositionWidth={1080}
              compositionHeight={1920}
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

          {/* Subtle Phone Screen Bottom Bar */}
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-28 h-1 bg-white/40 rounded-full z-30 pointer-events-none" />
        </div>
      </div>
    </div>
  );
};

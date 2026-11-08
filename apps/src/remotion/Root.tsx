import React from "react";
import { Composition } from "remotion";
import { NexusVideoComposition } from "./NexusVideoComposition";
import { defaultNexusVideoProps, nexusVideoSpec } from "./types";
import { AetheriaLaunchComposition } from "./aetheria-launch/AetheriaLaunchComposition";
import { TOTAL_FRAMES, FPS, WIDTH, HEIGHT } from "./aetheria-launch/types";

export const NexusVideoRoot: React.FC = () => {
  return (
    <>
      <Composition
        id={nexusVideoSpec.id}
        component={NexusVideoComposition}
        durationInFrames={nexusVideoSpec.durationInFrames}
        fps={nexusVideoSpec.fps}
        width={nexusVideoSpec.width}
        height={nexusVideoSpec.height}
        defaultProps={defaultNexusVideoProps}
      />
      {/* Compatibility Composition alias */}
      <Composition
        id="TikTokVideo"
        component={NexusVideoComposition}
        durationInFrames={nexusVideoSpec.durationInFrames}
        fps={nexusVideoSpec.fps}
        width={nexusVideoSpec.width}
        height={nexusVideoSpec.height}
        defaultProps={defaultNexusVideoProps}
      />
      {/* Aetheria Launch Composition */}
      <Composition
        id="AetheriaLaunch"
        component={AetheriaLaunchComposition}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};

export const RemotionRoot = NexusVideoRoot;

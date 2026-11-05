import React from "react";
import { Composition } from "remotion";
import { NexusVideoComposition } from "./NexusVideoComposition";
import { defaultNexusVideoProps, nexusVideoSpec } from "./types";

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
    </>
  );
};

export const RemotionRoot = NexusVideoRoot;

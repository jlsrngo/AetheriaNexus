import React from "react";
import { Composition } from "remotion";
import { NexusVideoComposition } from "./NexusVideoComposition";
import { defaultNexusVideoProps } from "./types";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="NexusEditorialVideo"
        component={NexusVideoComposition}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={defaultNexusVideoProps}
      />
      {/* Compatibility Composition alias */}
      <Composition
        id="TikTokVideo"
        component={NexusVideoComposition}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={defaultNexusVideoProps}
      />
    </>
  );
};

import React from "react";
import { Composition } from "remotion";
import { TikTokVideo } from "./TikTokVideo";
import { defaultTikTokProps } from "./types";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="TikTokVideo"
      component={TikTokVideo}
      durationInFrames={150} // 5 seconds at 30fps
      fps={30}
      width={1080}
      height={1920}
      defaultProps={defaultTikTokProps}
    />
  );
};


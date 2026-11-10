import React from "react";
import { Composition, Sequence } from "remotion";
import { Scene1 } from "./scenes/Scene1";
import { Scene2 } from "./scenes/Scene2";
import { Scene3 } from "./scenes/Scene3";
import { Scene4 } from "./scenes/Scene4";
import { Scene5 } from "./scenes/Scene5";
import { Scene6 } from "./scenes/Scene6";
import { Scene7 } from "./scenes/Scene7";
import { SCENE_DURATIONS, START_FRAMES, TOTAL_FRAMES } from "./types";

export const TuringVideo: React.FC = () => {
  return (
    <>
      <Sequence from={START_FRAMES[0]} durationInFrames={SCENE_DURATIONS[0]}>
        <Scene1 />
      </Sequence>
      <Sequence from={START_FRAMES[1]} durationInFrames={SCENE_DURATIONS[1]}>
        <Scene2 />
      </Sequence>
      <Sequence from={START_FRAMES[2]} durationInFrames={SCENE_DURATIONS[2]}>
        <Scene3 />
      </Sequence>
      <Sequence from={START_FRAMES[3]} durationInFrames={SCENE_DURATIONS[3]}>
        <Scene4 />
      </Sequence>
      <Sequence from={START_FRAMES[4]} durationInFrames={SCENE_DURATIONS[4]}>
        <Scene5 />
      </Sequence>
      <Sequence from={START_FRAMES[5]} durationInFrames={SCENE_DURATIONS[5]}>
        <Scene6 />
      </Sequence>
      <Sequence from={START_FRAMES[6]} durationInFrames={SCENE_DURATIONS[6]}>
        <Scene7 />
      </Sequence>
    </>
  );
};

export const NexusEditorialVideo = TuringVideo;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="TuringVideo"
        component={TuringVideo}
        durationInFrames={TOTAL_FRAMES}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{}}
      />
      <Composition
        id="NexusEditorialVideo"
        component={TuringVideo}
        durationInFrames={TOTAL_FRAMES}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{}}
      />
    </>
  );
};

export default TuringVideo;

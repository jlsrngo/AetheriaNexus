import { FC } from "react";
import { Composition, Sequence, Audio, staticFile, useCurrentFrame } from "remotion";
import { VIDEO_CONFIG, SCENE_DURATIONS, SCENE_OFFSETS, AUDIO_PATHS } from "./types";
import { Scene1 } from "./scenes/Scene1";
import { Scene2 } from "./scenes/Scene2";
import { Scene3 } from "./scenes/Scene3";
import { Scene4 } from "./scenes/Scene4";
import { Scene5 } from "./scenes/Scene5";
import { Scene6 } from "./scenes/Scene6";

// Narration word timings
import words1 from "../public/audio/scene1_hook.words.json";
import words2 from "../public/audio/scene2_rahasia_alam.words.json";
import words3 from "../public/audio/scene3_langit_laboratorium.words.json";
import words4 from "../public/audio/scene4_volta_baterai.words.json";
import words5 from "../public/audio/scene5_faraday_generator.words.json";
import words6 from "../public/audio/scene6_twist_penutup.words.json";

function SceneWrapper({ Component, words }: { Component: any; words: any }) {
  const frame = useCurrentFrame();
  return (
    <div style={{ width: "100%", height: "100%", position: "relative", backgroundColor: "#0D0D1A" }}>
      <svg
        viewBox="0 0 1080 1920"
        style={{
          width: "100%",
          height: "100%",
          position: "absolute",
          top: 0,
          left: 0,
          display: "block",
        }}
      >
        <Component frame={frame} words={words} />
      </svg>
    </div>
  );
}

export const ElectricityHistoryVideo: FC = () => {
  return (
    <div style={{ width: "100%", height: "100%", backgroundColor: "#0D0D1A", overflow: "hidden" }}>
      {/* Scene 1: Hook Kota Gelap */}
      <Sequence from={SCENE_OFFSETS.scene1} durationInFrames={SCENE_DURATIONS.scene1}>
        <SceneWrapper Component={Scene1} words={words1} />
        <Audio src={staticFile(AUDIO_PATHS.scene1)} />
      </Sequence>

      {/* Scene 2: Batu Ambar & Kertas */}
      <Sequence from={SCENE_OFFSETS.scene2} durationInFrames={SCENE_DURATIONS.scene2}>
        <SceneWrapper Component={Scene2} words={words2} />
        <Audio src={staticFile(AUDIO_PATHS.scene2)} />
      </Sequence>

      {/* Scene 3: Badai Petir Franklin 1752 */}
      <Sequence from={SCENE_OFFSETS.scene3} durationInFrames={SCENE_DURATIONS.scene3}>
        <SceneWrapper Component={Scene3} words={words3} />
        <Audio src={staticFile(AUDIO_PATHS.scene3)} />
      </Sequence>

      {/* Scene 4: Baterai Volta 1800 */}
      <Sequence from={SCENE_OFFSETS.scene4} durationInFrames={SCENE_DURATIONS.scene4}>
        <SceneWrapper Component={Scene4} words={words4} />
        <Audio src={staticFile(AUDIO_PATHS.scene4)} />
      </Sequence>

      {/* Scene 5: Generator Faraday 1831 */}
      <Sequence from={SCENE_OFFSETS.scene5} durationInFrames={SCENE_DURATIONS.scene5}>
        <SceneWrapper Component={Scene5} words={words5} />
        <Audio src={staticFile(AUDIO_PATHS.scene5)} />
      </Sequence>

      {/* Scene 6: Twist Kota Modern Penuh Cahaya */}
      <Sequence from={SCENE_OFFSETS.scene6} durationInFrames={SCENE_DURATIONS.scene6}>
        <SceneWrapper Component={Scene6} words={words6} />
        <Audio src={staticFile(AUDIO_PATHS.scene6)} />
      </Sequence>
    </div>
  );
};

export const Root: FC = () => {
  return (
    <Composition
      id="NexusEditorialVideo"
      component={ElectricityHistoryVideo}
      width={VIDEO_CONFIG.width}
      height={VIDEO_CONFIG.height}
      fps={VIDEO_CONFIG.fps}
      durationInFrames={VIDEO_CONFIG.durationInFrames}
      defaultProps={{}}
    />
  );
};

export { VIDEO_CONFIG, SCENE_DURATIONS, SCENE_OFFSETS };
export { ElectricityHistoryVideo as NexusEditorialVideo };
export default ElectricityHistoryVideo;

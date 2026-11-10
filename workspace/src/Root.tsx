import React from 'react';
import { Composition, Sequence } from 'remotion';
import { Scene1Hook } from './scenes/Scene1';
import { Scene2Stat } from './scenes/Scene2';
import { Scene3Proof } from './scenes/Scene3';
import { Scene4Cta } from './scenes/Scene4';
import { Scene5Act } from './scenes/Scene5';
import { Scene6Act } from './scenes/Scene6';
import { Scene7Act } from './scenes/Scene7';
import { Scene8Cta } from './scenes/Scene8';

// ─── Scene durations @ 30fps (audio duration + 0.6s buffer) ────────────────
// S1: 4.135 + 0.6 = 4.735s → 143 frames
// S2: 3.815 + 0.6 = 4.415s → 133 frames
// S3: 4.295 + 0.6 = 4.895s → 147 frames
// S4: 3.775 + 0.6 = 4.375s → 132 frames
// S5: 3.635 + 0.6 = 4.235s → 127 frames
// S6: 3.895 + 0.6 = 4.495s → 135 frames
// S7: 4.075 + 0.6 = 4.675s → 140 frames
// S8: 3.155 + 0.6 = 3.755s → 113 frames
// Total: 1070 frames

const SCENE_DURATIONS = [143, 133, 147, 132, 127, 135, 140, 113] as const;
const TOTAL_FRAMES = SCENE_DURATIONS.reduce((a, b) => a + b, 0);

// Compute cumulative start frames
const startFrames: number[] = [];
let acc = 0;
for (const dur of SCENE_DURATIONS) {
  startFrames.push(acc);
  acc += dur;
}

const AlFatihVideo: React.FC = () => {
  return (
    <>
      <Sequence from={startFrames[0]} durationInFrames={SCENE_DURATIONS[0]}>
        <Scene1Hook />
      </Sequence>
      <Sequence from={startFrames[1]} durationInFrames={SCENE_DURATIONS[1]}>
        <Scene2Stat />
      </Sequence>
      <Sequence from={startFrames[2]} durationInFrames={SCENE_DURATIONS[2]}>
        <Scene3Proof />
      </Sequence>
      <Sequence from={startFrames[3]} durationInFrames={SCENE_DURATIONS[3]}>
        <Scene4Cta />
      </Sequence>
      <Sequence from={startFrames[4]} durationInFrames={SCENE_DURATIONS[4]}>
        <Scene5Act />
      </Sequence>
      <Sequence from={startFrames[5]} durationInFrames={SCENE_DURATIONS[5]}>
        <Scene6Act />
      </Sequence>
      <Sequence from={startFrames[6]} durationInFrames={SCENE_DURATIONS[6]}>
        <Scene7Act />
      </Sequence>
      <Sequence from={startFrames[7]} durationInFrames={SCENE_DURATIONS[7]}>
        <Scene8Cta />
      </Sequence>
    </>
  );
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="NexusEditorialVideo"
      component={AlFatihVideo}
      durationInFrames={TOTAL_FRAMES}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{}}
    />
  );
};

export default RemotionRoot;

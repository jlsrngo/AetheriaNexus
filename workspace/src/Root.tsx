import React from 'react';
import { AbsoluteFill, Composition, Sequence, useVideoConfig } from 'remotion';
import { SCENE_TIMINGS, TOTAL_DURATION, FPS } from './types';
import { Scene1 } from './scenes/Scene1';
import { Scene2 } from './scenes/Scene2';
import { Scene3 } from './scenes/Scene3';
import { Scene4 } from './scenes/Scene4';
import { Scene5 } from './scenes/Scene5';
import { Scene6 } from './scenes/Scene6';

const f = (seconds: number) => Math.round(seconds * FPS);

export const TuringVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: '#0A0A0A' }}>

      {/* ── SCENE 1 · The Weird Hook (0 – 7.515s) ── */}
      <Sequence
        from={f(SCENE_TIMINGS.s1.start)}
        durationInFrames={f(SCENE_TIMINGS.s1.duration)}
        name="S1-WeirdHook"
      >
        <AbsoluteFill>
          <Scene1 />
        </AbsoluteFill>
      </Sequence>

      {/* ── SCENE 2 · Gas Mask Cyclist (7.515 – 23.39s) ── */}
      <Sequence
        from={f(SCENE_TIMINGS.s2.start)}
        durationInFrames={f(SCENE_TIMINGS.s2.duration)}
        name="S2-GasMaskCyclist"
      >
        <AbsoluteFill>
          <Scene2 />
        </AbsoluteFill>
      </Sequence>

      {/* ── SCENE 3 · Sunflower Obsession (23.39 – 30.505s) ── */}
      <Sequence
        from={f(SCENE_TIMINGS.s3.start)}
        durationInFrames={f(SCENE_TIMINGS.s3.duration)}
        name="S3-SunflowerObsession"
      >
        <AbsoluteFill>
          <Scene3 />
        </AbsoluteFill>
      </Sequence>

      {/* ── SCENE 4 · The Reveal – Bombe Machine (30.505 – 46.96s) ── */}
      <Sequence
        from={f(SCENE_TIMINGS.s4.start)}
        durationInFrames={f(SCENE_TIMINGS.s4.duration)}
        name="S4-BombeReveal"
      >
        <AbsoluteFill>
          <Scene4 />
        </AbsoluteFill>
      </Sequence>

      {/* ── SCENE 5 · Tragic Contrast (46.96 – 62.475s) ── */}
      <Sequence
        from={f(SCENE_TIMINGS.s5.start)}
        durationInFrames={f(SCENE_TIMINGS.s5.duration)}
        name="S5-TragicContrast"
      >
        <AbsoluteFill>
          <Scene5 />
        </AbsoluteFill>
      </Sequence>

      {/* ── SCENE 6 · Climax & Modern Twist (62.475 – 76.85s) ── */}
      <Sequence
        from={f(SCENE_TIMINGS.s6.start)}
        durationInFrames={f(SCENE_TIMINGS.s6.duration)}
        name="S6-ClimaxTwist"
      >
        <AbsoluteFill>
          <Scene6 />
        </AbsoluteFill>
      </Sequence>

    </AbsoluteFill>
  );
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="TuringVideo"
        component={TuringVideo}
        durationInFrames={Math.ceil(76.850 * 30)}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};

export default RemotionRoot;

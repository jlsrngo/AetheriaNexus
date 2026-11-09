import React from "react";
import { Composition } from "remotion";
import {
  AlanTuringVHS,
  ALAN_TURING_FPS,
  ALAN_TURING_WIDTH,
  ALAN_TURING_HEIGHT,
  ALAN_TURING_TOTAL_FRAMES,
} from "./alan-turing-vhs/AlanTuringVHS";
import { PocketMythAlfatihComposition } from "./pocketmyth-alfatih/PocketMythAlfatihComposition";
import { TOTAL_FRAMES, FPS, WIDTH, HEIGHT } from "./pocketmyth-alfatih/types";
import {
  Ariane5Composition,
  ARIANE5_TOTAL_FRAMES,
  ARIANE5_FPS,
  ARIANE5_WIDTH,
  ARIANE5_HEIGHT,
} from "./ariane5-bug/Ariane5Composition";
import {
  ReferenceComposition,
  REFERENCE_TOTAL_FRAMES,
  REFERENCE_FPS,
  REFERENCE_WIDTH,
  REFERENCE_HEIGHT,
} from "./reference/ReferenceComposition";
import {
  AIShiftEditorialComposition,
  AISHIFT_TOTAL_FRAMES,
  AISHIFT_FPS,
  AISHIFT_WIDTH,
  AISHIFT_HEIGHT,
} from "./aishift-editorial/AIShiftEditorialComposition";
import { ArchivalDocComposition } from "./archival-doc/ArchivalDocComposition";
import {
  ARCHIVAL_FPS,
  ARCHIVAL_HEIGHT,
  ARCHIVAL_WIDTH,
  TOTAL_DURATION_FRAMES,
} from "./archival-doc/types";
import {
  ConspiracyCrimeBoardComposition,
  CONSPIRACY_FPS,
  CONSPIRACY_WIDTH,
  CONSPIRACY_HEIGHT,
  TOTAL_CONSPIRACY_FRAMES,
} from "./conspiracy-crime-board";
import {
  HeavyMotion2s,
  HEAVY_MOTION_FPS,
  HEAVY_MOTION_WIDTH,
  HEAVY_MOTION_HEIGHT,
  HEAVY_MOTION_FRAMES,
} from "./motion-bench/HeavyMotion2s";
import {
  HeavyMotion30s,
  HEAVY_30S_FPS,
  HEAVY_30S_WIDTH,
  HEAVY_30S_HEIGHT,
  HEAVY_30S_FRAMES,
} from "./motion-bench/HeavyMotion30s";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="AlanTuringVHS"
        component={AlanTuringVHS}
        durationInFrames={ALAN_TURING_TOTAL_FRAMES}
        fps={ALAN_TURING_FPS}
        width={ALAN_TURING_WIDTH}
        height={ALAN_TURING_HEIGHT}
      />
      <Composition
        id="HeavyMotion30s"
        component={HeavyMotion30s}
        durationInFrames={HEAVY_30S_FRAMES}
        fps={HEAVY_30S_FPS}
        width={HEAVY_30S_WIDTH}
        height={HEAVY_30S_HEIGHT}
      />
      <Composition
        id="HeavyMotion2s"
        component={HeavyMotion2s}
        durationInFrames={HEAVY_MOTION_FRAMES}
        fps={HEAVY_MOTION_FPS}
        width={HEAVY_MOTION_WIDTH}
        height={HEAVY_MOTION_HEIGHT}
      />
      <Composition
        id="PocketMythAlfatihComposition"
        component={PocketMythAlfatihComposition}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="Ariane5Composition"
        component={Ariane5Composition}
        durationInFrames={ARIANE5_TOTAL_FRAMES}
        fps={ARIANE5_FPS}
        width={ARIANE5_WIDTH}
        height={ARIANE5_HEIGHT}
      />
      <Composition
        id="ReferenceComposition"
        component={ReferenceComposition}
        durationInFrames={REFERENCE_TOTAL_FRAMES}
        fps={REFERENCE_FPS}
        width={REFERENCE_WIDTH}
        height={REFERENCE_HEIGHT}
      />
      <Composition
        id="AIShiftEditorialComposition"
        component={AIShiftEditorialComposition}
        durationInFrames={AISHIFT_TOTAL_FRAMES}
        fps={AISHIFT_FPS}
        width={AISHIFT_WIDTH}
        height={AISHIFT_HEIGHT}
      />
      <Composition
        id="ArchivalDoc2Min"
        component={ArchivalDocComposition}
        durationInFrames={TOTAL_DURATION_FRAMES}
        fps={ARCHIVAL_FPS}
        width={ARCHIVAL_WIDTH}
        height={ARCHIVAL_HEIGHT}
      />
      <Composition
        id="ConspiracyCrimeBoard"
        component={ConspiracyCrimeBoardComposition}
        durationInFrames={TOTAL_CONSPIRACY_FRAMES}
        fps={CONSPIRACY_FPS}
        width={CONSPIRACY_WIDTH}
        height={CONSPIRACY_HEIGHT}
      />
    </>
  );
};


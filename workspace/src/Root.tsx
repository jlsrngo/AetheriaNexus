/**
 * Root.tsx — /mg-cutout-collage Documentary
 * "Dia Menyelamatkan Dunia, Tapi Dunia Tidak Menyelamatkannya"
 * 7 scenes · 1080×1920 · 30fps · vertical 9:16
 *
 * Scene durations (from actual voicebox_speak synthesis + 0.6s breathing buffer):
 *   Scene 1: turing_s1.wav  7.935s + 0.6 =  8.535s =  256 frames
 *   Scene 2: turing_s2.wav 14.195s + 0.6 = 14.795s =  444 frames
 *   Scene 3: turing_s3.wav 13.975s + 0.6 = 14.575s =  437 frames
 *   Scene 4: turing_s4.wav 13.355s + 0.6 = 13.955s =  419 frames
 *   Scene 5: turing_s5.wav 18.795s + 0.6 = 19.395s =  582 frames
 *   Scene 6: turing_s6.wav  8.835s + 0.6 =  9.435s =  283 frames
 *   Scene 7: turing_s7.wav 18.175s + 0.6 = 18.775s =  563 frames
 *
 * Total: 256 + 444 + 437 + 419 + 582 + 283 + 563 = 2984 frames (~99.5s)
 */

import { Composition, Sequence, AbsoluteFill } from "remotion";
import { Scene1 } from "./scenes/Scene1";
import { Scene2 } from "./scenes/Scene2";
import { Scene3 } from "./scenes/Scene3";
import { Scene4 } from "./scenes/Scene4";
import { Scene5 } from "./scenes/Scene5";
import { Scene6 } from "./scenes/Scene6";
import { Scene7 } from "./scenes/Scene7";

// Scene timing constants (frames at 30fps) — derived from actual audio durations
const S1_FRAMES = 256;  //  8.535s — Hook / "Negaranya membutuhkan otaknya..."
const S2_FRAMES = 444;  // 14.795s — Who is Turing / "Namanya Alan Turing..."
const S3_FRAMES = 437;  // 14.575s — Enigma / "Enigma bukan sekadar mesin biasa..."
const S4_FRAMES = 419;  // 13.955s — The Bombe / "Turing mengembangkan mesin Bombe..."
const S5_FRAMES = 582;  // 19.395s — Betrayal / "Tapi setelah perang, kisahnya berubah..."
const S6_FRAMES = 283;  //  9.435s — Death / "Pada 7 Juni 1954, Alan Turing meninggal..."
const S7_FRAMES = 563;  // 18.775s — Legacy / "Hari ini, dunia komputasi..."

const S1_START = 0;
const S2_START = S1_START + S1_FRAMES;   //  256
const S3_START = S2_START + S2_FRAMES;   //  700
const S4_START = S3_START + S3_FRAMES;   // 1137
const S5_START = S4_START + S4_FRAMES;   // 1556
const S6_START = S5_START + S5_FRAMES;   // 2138
const S7_START = S6_START + S6_FRAMES;   // 2421
const TOTAL_FRAMES = S7_START + S7_FRAMES; // 2984

export const AlanTuringDocumentary: React.FC = () => (
  <AbsoluteFill style={{ background: "#1A1512" }}>
    <Sequence from={S1_START} durationInFrames={S1_FRAMES} name="Scene1-Hook">
      <Scene1 />
    </Sequence>

    <Sequence from={S2_START} durationInFrames={S2_FRAMES} name="Scene2-WhoIsHe">
      <Scene2 />
    </Sequence>

    <Sequence from={S3_START} durationInFrames={S3_FRAMES} name="Scene3-Enigma">
      <Scene3 />
    </Sequence>

    <Sequence from={S4_START} durationInFrames={S4_FRAMES} name="Scene4-Bombe">
      <Scene4 />
    </Sequence>

    <Sequence from={S5_START} durationInFrames={S5_FRAMES} name="Scene5-Betrayal">
      <Scene5 />
    </Sequence>

    <Sequence from={S6_START} durationInFrames={S6_FRAMES} name="Scene6-Death">
      <Scene6 />
    </Sequence>

    <Sequence from={S7_START} durationInFrames={S7_FRAMES} name="Scene7-Legacy">
      <Scene7 />
    </Sequence>
  </AbsoluteFill>
);

// Aliases for studio compositions
export const TuringVideo = AlanTuringDocumentary;
export const NexusEditorialVideo = AlanTuringDocumentary;

// Remotion composition registration
export const RemotionRoot: React.FC = () => (
  <Composition
    id="AlanTuringDocumentary"
    component={AlanTuringDocumentary}
    durationInFrames={TOTAL_FRAMES}
    fps={30}
    width={1080}
    height={1920}
    defaultProps={{}}
  />
);

import React from "react";
export default RemotionRoot;

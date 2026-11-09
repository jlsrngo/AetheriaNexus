import React from "react";
import { Series, Audio, staticFile } from "remotion";
import { Scene1Hook } from "./scenes/Scene1Hook";
import { Scene2PetaPerang } from "./scenes/Scene2PetaPerang";
import { Scene3BletchleyPark } from "./scenes/Scene3BletchleyPark";
import { Scene4MesinBombe } from "./scenes/Scene4MesinBombe";
import { Scene5PesanTerpecahkan } from "./scenes/Scene5PesanTerpecahkan";
import { Scene6FutureComputers } from "./scenes/Scene6FutureComputers";
import { Scene7TrialTragedy } from "./scenes/Scene7TrialTragedy";
import { Scene8LegacyPardon } from "./scenes/Scene8LegacyPardon";
import {
  CONSPIRACY_FPS,
  CONSPIRACY_WIDTH,
  CONSPIRACY_HEIGHT,
  SCENE_1_DURATION_FRAMES,
  SCENE_2_DURATION_FRAMES,
  SCENE_3_DURATION_FRAMES,
  SCENE_4_DURATION_FRAMES,
  SCENE_5_DURATION_FRAMES,
  SCENE_6_DURATION_FRAMES,
  SCENE_7_DURATION_FRAMES,
  SCENE_8_DURATION_FRAMES,
} from "./types";

/**
 * ConspiracyCrimeBoardComposition — Alan Turing: The Man Who Cracked the Impossible Code
 * 
 * 8-scene documentary using conspiracy-crime-board visual style:
 * - Vintage archival paper background + polaroid evidence cards
 * - Red thread connections + pushpin pins
 * - Spray stencil typography (Anton) + handwritten notes (Caveat)
 * - Monospace metadata (Courier Prime)
 * - Synced voiceover with 'aetheria' crime_conspiracy audio preset
 */
export const ConspiracyCrimeBoardComposition: React.FC = () => {
  return (
    <Series>
      {/* SCENE 1: Hook — Tahukah Kamu? Alan Turing */}
      <Series.Sequence durationInFrames={SCENE_1_DURATION_FRAMES}>
        <Audio src={staticFile("voiceover_scene1.wav")} />
        <Scene1Hook />
      </Series.Sequence>

      {/* SCENE 2: Peta perang 1940 & U-Boat Jerman */}
      <Series.Sequence durationInFrames={SCENE_2_DURATION_FRAMES}>
        <Audio src={staticFile("voiceover_scene2.wav")} />
        <Scene2PetaPerang />
      </Series.Sequence>

      {/* SCENE 3: Bletchley Park & potret Alan Turing */}
      <Series.Sequence durationInFrames={SCENE_3_DURATION_FRAMES}>
        <Audio src={staticFile("voiceover_scene3.wav")} />
        <Scene3BletchleyPark />
      </Series.Sequence>

      {/* SCENE 4: Mesin Bombe melawan Enigma */}
      <Series.Sequence durationInFrames={SCENE_4_DURATION_FRAMES}>
        <Audio src={staticFile("voiceover_scene4.wav")} />
        <Scene4MesinBombe />
      </Series.Sequence>

      {/* SCENE 5: Pesan terpecahkan & ribuan nyawa terselamatkan */}
      <Series.Sequence durationInFrames={SCENE_5_DURATION_FRAMES}>
        <Audio src={staticFile("voiceover_scene5.wav")} />
        <Scene5PesanTerpecahkan />
      </Series.Sequence>

      {/* SCENE 6: Masa depan komputer & Turing Test 1950 */}
      <Series.Sequence durationInFrames={SCENE_6_DURATION_FRAMES}>
        <Audio src={staticFile("voiceover_scene6.wav")} />
        <Scene6FutureComputers />
      </Series.Sequence>

      {/* SCENE 7: Tragedi pengadilan 1952 */}
      <Series.Sequence durationInFrames={SCENE_7_DURATION_FRAMES}>
        <Audio src={staticFile("voiceover_scene7.wav")} />
        <Scene7TrialTragedy />
      </Series.Sequence>

      {/* SCENE 8: Warisan abadi & Royal Pardon 2013 */}
      <Series.Sequence durationInFrames={SCENE_8_DURATION_FRAMES}>
        <Audio src={staticFile("voiceover_scene8.wav")} />
        <Scene8LegacyPardon />
      </Series.Sequence>
    </Series>
  );
};

export {
  CONSPIRACY_FPS,
  CONSPIRACY_WIDTH,
  CONSPIRACY_HEIGHT,
  TOTAL_CONSPIRACY_FRAMES,
} from "./types";


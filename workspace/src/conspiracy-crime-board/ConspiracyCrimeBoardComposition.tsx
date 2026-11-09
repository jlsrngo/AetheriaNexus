import React from "react";
import { Series } from "remotion";
import { Scene1Hook } from "./scenes/Scene1Hook";
import { Scene1TahukahKamu } from "./scenes/Scene1TahukahKamu";
import { ConspiracyCrimeBoardProps, SCENE_1_DURATION_FRAMES } from "./types";

/**
 * ConspiracyCrimeBoardComposition
 * 
 * Template Video Remotion: Papan Investigasi / Kejahatan / Konspirasi
 * Mendukung variasi Scene 1:
 * - "tahukah_kamu": Foto muka blur + tanda tanya '?' + tangan memegang kaca pembesar memeriksa wajah
 * - "pinboard": Jaring papan investigasi kriminal foto berjatuhan + benang merah + pin
 */
export const ConspiracyCrimeBoardComposition: React.FC<ConspiracyCrimeBoardProps> = ({
  scene1Props,
  sceneType = "tahukah_kamu",
}) => {
  return (
    <Series>
      {/* SCENE 1: Hook Pembuka */}
      <Series.Sequence durationInFrames={SCENE_1_DURATION_FRAMES}>
        {sceneType === "tahukah_kamu" ? (
          <Scene1TahukahKamu {...scene1Props} />
        ) : (
          <Scene1Hook {...scene1Props} />
        )}
      </Series.Sequence>

      {/* 
        Untuk adegan berikutnya (Scene 2, Scene 3, dst.):
        <Series.Sequence durationInFrames={180}>
          <Scene2EvidenceZoom />
        </Series.Sequence>
      */}
    </Series>
  );
};


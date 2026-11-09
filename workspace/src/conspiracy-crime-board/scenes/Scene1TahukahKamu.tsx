import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { ArchivalBackground } from "../components/ArchivalBackground";
import { QuestionBadgeHeader } from "../components/QuestionBadgeHeader";
import { MagnifyingGlassInvestigator } from "../components/MagnifyingGlassInvestigator";
import { BottomArchivalTitle } from "../components/BottomArchivalTitle";
import { ConspiracySceneProps } from "../types";

export interface Scene1TahukahKamuProps extends ConspiracySceneProps {
  hookHeadline?: string;
  hookSubtitle?: string;
  mysteryName?: string;
  caseFileCode?: string;
}

/**
 * Scene1TahukahKamu
 * 
 * Scene 1: Hook Misteri "Tahukah Kamu?"
 * - Background permanen torn paper + newspaper + megaphone yang sama.
 * - Header besar "TAHUKAH KAMU?" bertema investigasi kepolisian/arsip misteri.
 * - Foto polaroid dengan muka blur tebal + tanda tanya '?' besar berdenyut.
 * - Tangan detektif memegang kaca pembesar kuno bergerak-gerak memeriksa wajah.
 * - Bottom archival card dengan judul dan subtitle kasus misteri.
 */
export const Scene1TahukahKamu: React.FC<Scene1TahukahKamuProps> = ({
  hookHeadline = "TAHUKAH KAMU?",
  hookSubtitle = "KASUS MISTERIUS // SIAPA SOSOK INI?",
  title = "TARGET MISTERIUS",
  dateMarker = "2024",
  subnote = "Catatan Investigasi // Berkas Rahasia #01",
  backgroundImage,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        position: "relative",
        width: 1080,
        height: 1920,
        overflow: "hidden",
        backgroundColor: "#070709",
      }}
    >
      {/* 1. Background Permanen (Torn Paper + Koran + Megafon yang Sama) */}
      <ArchivalBackground customImage={backgroundImage} spotlightGlow={true} />

      {/* 2. Header Besar "TAHUKAH KAMU?" + Tanda Tanya Misteri */}
      <QuestionBadgeHeader
        frame={frame}
        fps={fps}
        mainText={hookHeadline}
        subText={hookSubtitle}
      />

      {/* 3. Foto Muka Blur + Tanda Tanya + Tangan Bergerak Memegang Kaca Pembesar */}
      <MagnifyingGlassInvestigator frame={frame} fps={fps} />

      {/* 4. Bottom Archival Card "TARGET MISTERIUS" dengan Klip Kertas & Tanggal */}
      <BottomArchivalTitle
        frame={frame}
        fps={fps}
        title={title}
        dateMarker={dateMarker}
        subnote={subnote}
        startFrame={36}
      />
    </div>
  );
};


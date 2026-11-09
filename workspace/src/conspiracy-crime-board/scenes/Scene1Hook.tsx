import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { spring, interpolate, Easing } from "remotion";
import { ArchivalBackground } from "../components/ArchivalBackground";
import { QuestionBadgeHeader } from "../components/QuestionBadgeHeader";
import { MagnifyingGlassInvestigator } from "../components/MagnifyingGlassInvestigator";
import { BottomArchivalTitle } from "../components/BottomArchivalTitle";
import { staticFile, Img } from "remotion";

export const Scene1Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Word-level timing for kinetic typography
  const wordTimes = [0, 0.74, 1.34, 1.54, 2.14, 2.34, 2.7, 3.12, 3.38] as number[];

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
      {/* Layer 1: Permanent torn paper archival background */}
      <ArchivalBackground spotlightGlow={true} />

      {/* Layer 2: Header badge */}
      <QuestionBadgeHeader
        frame={frame}
        fps={fps}
        mainText="TAHUKAH KAMU?"
        subText="KASUS ENIGMA // BLETCHLEY PARK 1940"
      />

      {/* Layer 3: Polaroid foto Alan Turing dengan blur wajah + magnifying glass */}
      <MagnifyingGlassInvestigator
        frame={frame}
        fps={fps}
        personPhotoUrl={staticFile("img_alan_turing.jpg")}
      />

      {/* Layer 4: Bottom archival card */}
      <BottomArchivalTitle
        frame={frame}
        fps={fps}
        title="ALAN TURING"
        dateMarker="1940"
        subnote="Kode Mustahil Mesin Enigma Nazi — Berkas Rahasia #ET-001"
        startFrame={30}
      />

      {/* Layer 5: Kinetic subtitle text synced to voiceover words */}
      <KineticSubtitle frame={frame} fps={fps} words={[
        { text: "Tahukah", start: 0 },
        { text: "kamu?", start: 0.74 },
        { text: "Kode", start: 1.34 },
        { text: "mustahil", start: 1.54 },
        { text: "dari", start: 2.14 },
        { text: "mesin", start: 2.34 },
        { text: "Enigma", start: 2.7 },
        { text: "Nazi", start: 3.12 },
        { text: "Jerman...", start: 3.38 },
      ]} />
    </div>
  );
};

interface KineticWordProps {
  text: string;
  start: number;
  frame: number;
  fps: number;
}

const KineticWord: React.FC<KineticWordProps> = ({ text, start, frame, fps }) => {
  const wordFrame = Math.max(0, frame - Math.round(start * fps));
  const spr = spring({
    frame: wordFrame,
    fps,
    config: { damping: 12, stiffness: 100, mass: 0.8 },
  });
  const scale = interpolate(spr, [0, 0.5, 1], [0.3, 1.15, 1]);
  const translateY = interpolate(spr, [0, 1], [30, 0]);
  const opacity = interpolate(spr, [0, 0.3, 1], [0, 1, 1]);

  return (
    <span
      style={{
        fontFamily: "'Anton', sans-serif",
        fontSize: 42,
        color: "#F5F0E4",
        letterSpacing: 2,
        transform: `scale(${scale}) translateY(${translateY}px)`,
        opacity,
        display: "inline-block",
        textShadow: "0 2px 8px rgba(0,0,0,0.8)",
      }}
    >
      {text}{" "}
    </span>
  );
};

const KineticSubtitle: React.FC<{
  frame: number;
  fps: number;
  words: { text: string; start: number }[];
}> = ({ frame, fps, words }) => {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 200,
        left: 60,
        right: 60,
        zIndex: 80,
        display: "flex",
        flexWrap: "wrap",
        gap: "0px 12px",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      {words.map((w, i) => (
        <KineticWord key={i} text={w.text} start={w.start} frame={frame} fps={fps} />
      ))}
    </div>
  );
};

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { ArchivalBackground } from "../components/ArchivalBackground";
import { ConspiracyPinboard } from "../components/ConspiracyPinboard";
import { BottomArchivalTitle } from "../components/BottomArchivalTitle";
import { ConspiracySceneProps } from "../types";

export const Scene1Hook: React.FC<ConspiracySceneProps> = ({
  cards,
  title = "YOUR TEXT",
  dateMarker = "2024",
  subnote = "Subtitle Catatan Penyelidikan // Case File #01",
  backgroundImage,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        backgroundColor: "#070709",
      }}
    >
      {/* Layer 1: Permanent Torn Paper + Grid + Megaphone Background */}
      <ArchivalBackground customImage={backgroundImage} spotlightGlow={true} />

      {/* Layer 2: 7 Symmetrical Polaroid Slots + Red Strings (Z-60) + Pushpins (Z-70) */}
      <ConspiracyPinboard frame={frame} fps={fps} cards={cards} />

      {/* Layer 3: Bottom Archival Card with Stencil "YOUR TEXT" Title */}
      <BottomArchivalTitle
        frame={frame}
        fps={fps}
        title={title}
        dateMarker={dateMarker}
        subnote={subnote}
        startFrame={72}
      />
    </div>
  );
};


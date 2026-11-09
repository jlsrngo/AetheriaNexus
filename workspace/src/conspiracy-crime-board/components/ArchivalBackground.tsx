import React from "react";
import { staticFile, Img } from "remotion";
import defaultBgAsset from "../assets/background_torn_paper.jpg";

export interface ArchivalBackgroundProps {
  customImage?: string;
  spotlightGlow?: boolean;
}

export const ArchivalBackground: React.FC<ArchivalBackgroundProps> = ({
  customImage,
  spotlightGlow = true,
}) => {
  const bgSrc = customImage || defaultBgAsset || staticFile("background_torn_paper.jpg");

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 1,
        overflow: "hidden",
        backgroundColor: "#181410",
      }}
    >
      {/* Permanent Archival Background: Torn Grid Paper + Megaphone & Newspaper Border */}
      <div
        style={{
          position: "absolute",
          inset: -10,
          overflow: "hidden",
        }}
      >
        <Img
          src={bgSrc}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "blur(2.2px) brightness(0.82) contrast(1.08) sepia(15%)",
            transform: "scale(1.03)",
          }}
          alt="Archival Background"
        />
      </div>

      {/* Subtle Warm Spotlight Glow from top-left */}
      {spotlightGlow && (
        <div
          style={{
            position: "absolute",
            top: -100,
            left: -100,
            width: 1100,
            height: 1100,
            background:
              "radial-gradient(circle at 35% 35%, rgba(255, 230, 160, 0.35) 0%, rgba(212, 175, 55, 0.15) 38%, transparent 70%)",
            mixBlendMode: "screen",
            pointerEvents: "none",
            zIndex: 3,
          }}
        />
      )}

      {/* Soft Vignette around edges to frame the pinboard */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(10, 8, 7, 0.55) 100%)",
          zIndex: 4,
          pointerEvents: "none",
        }}
      />
    </div>
  );
};

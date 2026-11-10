/**
 * ArchivalBackground — mg-cutout-collage ground layer.
 * Kraft paper / dark noir / newsprint / blueprint archive ground with:
 *  - Torn paper texture photo underneath
 *  - Film grain overlay (SVG feTurbulence noise)
 *  - Vignette (inset box-shadow)
 *  - Warm sepia spotlight from top-left
 *  - Slow push-in camera drift (scale 1.0 → 1.06 over scene)
 */
import React from "react";
import { AbsoluteFill, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

export type ArchivalVariant = "kraft" | "dark" | "newsprint" | "blueprint";

export interface ArchivalBackgroundProps {
  durationInFrames?: number;
  /** 'kraft' = warm tan newsprint, 'dark' = noir archive black, 'newsprint' = offwhite paper, 'blueprint' = cyan dark */
  variant?: ArchivalVariant;
  groundVariant?: ArchivalVariant;
}

export const ArchivalBackground: React.FC<ArchivalBackgroundProps> = ({
  durationInFrames: propDuration,
  variant,
  groundVariant,
}) => {
  const frame = useCurrentFrame();
  
  let fallbackDuration = 300;
  try {
    const vc = useVideoConfig();
    if (vc && typeof vc.durationInFrames === "number" && vc.durationInFrames > 0) {
      fallbackDuration = vc.durationInFrames;
    }
  } catch {
    // Fallback if rendered outside active sequence
  }
  const totalFrames = propDuration ?? fallbackDuration;

  const activeVariant: ArchivalVariant = variant ?? groundVariant ?? "dark";

  // Slow suspenseful camera push-in
  const cameraScale = interpolate(frame, [0, totalFrames], [1.0, 1.06], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Handheld parallax micro-drift
  const driftX = Math.sin(frame * 0.035) * 3;
  const driftY = Math.cos(frame * 0.030) * 2.5;

  // Ground colors and filter configurations based on variant
  let bgBase = "#1A1512";
  let tintAlpha = 0.75;
  let imgFilter = "blur(0.8px) brightness(0.52) contrast(1.18) sepia(25%)";
  let imgOpacity = 0.90;
  let spotGradient = `radial-gradient(ellipse at 25% 20%, rgba(245,230,200,0.22) 0%, rgba(26,21,18,0.75) 65%, rgba(10,8,4,0.95) 100%)`;

  if (activeVariant === "kraft") {
    bgBase = "#C8A97A";
    tintAlpha = 0.22;
    imgFilter = "brightness(1.05) contrast(1.08) sepia(40%) saturate(0.8)";
    imgOpacity = 0.78;
    spotGradient = `radial-gradient(ellipse at 30% 15%, rgba(245,220,160,0.28) 0%, rgba(200,169,122,0.12) 50%, transparent 80%)`;
  } else if (activeVariant === "newsprint") {
    bgBase = "#DDD5C4";
    tintAlpha = 0.18;
    imgFilter = "brightness(1.02) contrast(1.12) sepia(30%) grayscale(20%)";
    imgOpacity = 0.82;
    spotGradient = `radial-gradient(ellipse at 30% 20%, rgba(255,248,230,0.35) 0%, rgba(215,205,190,0.15) 60%, transparent 85%)`;
  } else if (activeVariant === "blueprint") {
    bgBase = "#101D2C";
    tintAlpha = 0.65;
    imgFilter = "brightness(0.65) contrast(1.25) hue-rotate(180deg) saturate(1.4)";
    imgOpacity = 0.88;
    spotGradient = `radial-gradient(ellipse at 25% 20%, rgba(140,200,255,0.25) 0%, rgba(16,29,44,0.75) 65%, rgba(6,12,20,0.95) 100%)`;
  }

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgBase,
        overflow: "hidden",
        transform: `scale(${cameraScale}) translate(${driftX}px, ${driftY}px)`,
        transformOrigin: "center center",
      }}
    >
      {/* Base torn paper texture */}
      <img
        src={staticFile("mg-styles/06-collage/assets/gen/page_kraft.jpg")}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: imgFilter,
          opacity: imgOpacity,
          mixBlendMode: "multiply",
        }}
      />

      {/* SVG film grain / halftone noise overlay */}
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0.18,
          pointerEvents: "none",
          mixBlendMode: "overlay",
        }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <filter id="grain-bg">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.72"
            numOctaves="4"
            seed={12}
            result="noise"
          />
          <feColorMatrix type="saturate" values="0" in="noise" result="grey" />
          <feBlend in="SourceGraphic" in2="grey" mode="overlay" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain-bg)" />
      </svg>

      {/* Warm top-left spotlight */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: spotGradient,
          mixBlendMode: "multiply",
          pointerEvents: "none",
        }}
      />

      {/* Dark vignette corners */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          boxShadow: "inset 0 0 160px rgba(0, 0, 0, 0.88)",
          pointerEvents: "none",
        }}
      />

      {/* Very subtle horizontal scan-line bands (archival photo feel) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent 0px, transparent 3px, rgba(0,0,0,0.04) 3px, rgba(0,0,0,0.04) 4px)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

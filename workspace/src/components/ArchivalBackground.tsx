/**
 * ArchivalBackground — mg-cutout-collage ground layer.
 * Kraft paper / dark noir archive ground with:
 *  - Torn paper texture photo underneath
 *  - Film grain overlay (SVG feTurbulence noise)
 *  - Vignette (inset box-shadow)
 *  - Warm sepia spotlight from top-left
 *  - Slow push-in camera drift (scale 1.0 → 1.06 over scene)
 */
import React from "react";
import { AbsoluteFill, interpolate, staticFile, useCurrentFrame } from "remotion";

interface ArchivalBackgroundProps {
  durationInFrames: number;
  /** 'kraft' = warm tan newsprint, 'dark' = noir archive black */
  groundVariant?: "kraft" | "dark";
}

export const ArchivalBackground: React.FC<ArchivalBackgroundProps> = ({
  durationInFrames,
  groundVariant = "dark",
}) => {
  const frame = useCurrentFrame();

  // Slow suspenseful camera push-in
  const cameraScale = interpolate(frame, [0, durationInFrames], [1.0, 1.06], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Handheld parallax micro-drift
  const driftX = Math.sin(frame * 0.035) * 3;
  const driftY = Math.cos(frame * 0.030) * 2.5;

  // Ground color: kraft = #C8A97A, dark = #1A1512
  const bgBase = groundVariant === "kraft" ? "#C8A97A" : "#1A1512";
  // Overlay tint shifts from warm amber to cold noir
  const tintAlpha = groundVariant === "kraft" ? 0.22 : 0.75;

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
        src={staticFile("background_torn_paper.jpg")}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          // Halftone-adjacent: desaturate + slight sepia + multiply mode
          filter: groundVariant === "kraft"
            ? "brightness(1.05) contrast(1.08) sepia(40%) saturate(0.8)"
            : "blur(0.8px) brightness(0.52) contrast(1.18) sepia(25%)",
          opacity: groundVariant === "kraft" ? 0.78 : 0.90,
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

      {/* Warm top-left spotlight (spotlight source = archival lamp) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: groundVariant === "kraft"
            ? `radial-gradient(ellipse at 30% 15%, rgba(245,220,160,0.28) 0%, rgba(200,169,122,0.12) 50%, transparent 80%)`
            : `radial-gradient(ellipse at 25% 20%, rgba(245,230,200,0.22) 0%, rgba(26,21,18,${tintAlpha}) 65%, rgba(10,8,4,0.95) 100%)`,
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

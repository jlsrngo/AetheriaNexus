import React from "react";
import { AbsoluteFill, interpolate, staticFile, useCurrentFrame } from "remotion";

interface ArchivalBackgroundProps {
  durationInFrames: number;
}

export const ArchivalBackground: React.FC<ArchivalBackgroundProps> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();

  // Slow suspenseful camera push-in
  const cameraScale = interpolate(frame, [0, durationInFrames], [1, 1.06], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Handheld parallax micro-drift
  const driftX = Math.sin(frame * 0.035) * 3;
  const driftY = Math.cos(frame * 0.03) * 2.5;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#070709",
        overflow: "hidden",
        transform: `scale(${cameraScale}) translate(${driftX}px, ${driftY}px)`,
        transformOrigin: "center center",
      }}
    >
      {/* Base torn paper texture */}
      <img
        src={staticFile("background_torn_paper.jpg")}
        alt="Archival Paper"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "blur(1.5px) brightness(0.68) contrast(1.15) sepia(20%)",
          opacity: 0.85,
        }}
      />

      {/* Warm spotlight from top-left */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(circle at 25% 20%, rgba(245, 230, 200, 0.22) 0%, rgba(7, 7, 9, 0.75) 70%, rgba(5, 5, 7, 0.95) 100%)",
          mixBlendMode: "multiply",
          pointerEvents: "none",
        }}
      />

      {/* Dark vignette corners */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          boxShadow: "inset 0 0 120px rgba(0, 0, 0, 0.9)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};


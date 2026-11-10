import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

interface SceneTransitionProps {
  type: "flash" | "fade-black";
  durationInFrames?: number;
  /** For flash: how many frames the flash lasts (default 6) */
  flashFrames?: number;
}

/**
 * SceneTransition:
 * - type="flash"     → white exposure spike on frame 0 (like a camera cut flash).
 * - type="fade-black"→ progressive fade-to-black from halfway through the scene.
 */
export const SceneTransition: React.FC<SceneTransitionProps> = ({
  type,
  durationInFrames = 300,
  flashFrames = 6,
}) => {
  const frame = useCurrentFrame();

  if (type === "flash") {
    // Flash: fast white spike that decays in `flashFrames`
    const opacity = interpolate(frame, [0, flashFrames], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    if (opacity <= 0) return null;
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#FFFFFF",
          opacity,
          zIndex: 999,
          pointerEvents: "none",
        }}
      />
    );
  }

  // fade-black: starts fading at 85% through the scene
  const fadeStart = Math.round(durationInFrames * 0.82);
  const opacity = interpolate(frame, [fadeStart, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (opacity <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "#000000",
        opacity,
        zIndex: 998,
        pointerEvents: "none",
      }}
    />
  );
};

import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

interface SceneTransitionProps {
  type: "flash" | "fade-black" | "fade";
  durationInFrames?: number;
  totalFrames?: number;
  frame?: number;
  /** For flash: how many frames the flash lasts (default 6) */
  flashFrames?: number;
}

/**
 * SceneTransition:
 * - type="flash"     → white exposure spike on frame 0 (like a camera cut flash).
 * - type="fade-black" / "fade" → progressive fade-to-black from halfway through the scene.
 */
export const SceneTransition: React.FC<SceneTransitionProps> = ({
  type,
  durationInFrames,
  totalFrames,
  flashFrames = 6,
}) => {
  const currentFrame = useCurrentFrame();
  const effectiveDuration = durationInFrames ?? totalFrames ?? 300;

  if (type === "flash") {
    // Brief 3-frame exposure spike during transition, but never blind frame 0 so poster/paused frame is crisp
    if (currentFrame <= 0) return null;
    const opacity = interpolate(currentFrame, [1, Math.min(flashFrames, 4)], [0.65, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    if (opacity <= 0.01) return null;
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

  // fade-black / fade: starts fading at 82% through the scene
  const fadeStart = Math.round(effectiveDuration * 0.82);
  const opacity = interpolate(currentFrame, [fadeStart, effectiveDuration], [0, 1], {
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

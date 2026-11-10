import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

interface RainDrop {
  x: number;
  speed: number;
  length: number;
  opacity: number;
  delay: number;
}

// Deterministic raindrop positions
function makeDrops(count: number): RainDrop[] {
  return Array.from({ length: count }, (_, i) => ({
    x: ((i * 137.508 + 23) % 1080),
    speed: 8 + ((i * 73) % 15),
    length: 40 + ((i * 41) % 80),
    opacity: 0.15 + ((i * 29) % 50) / 100,
    delay: (i * 7) % 90,
  }));
}

const DROPS = makeDrops(60);

interface RainWindowOverlayProps {
  durationInFrames?: number;
}

/**
 * RainWindowOverlay — streaking rain lines on a dark frosted glass window.
 * Atmospheric candlelight warmth increases as rain intensifies.
 */
export const RainWindowOverlay: React.FC<RainWindowOverlayProps> = ({
  durationInFrames = 300,
}) => {
  const frame = useCurrentFrame();

  // Intensity ramps up over the first 3 seconds
  const intensity = interpolate(frame, [0, 90, durationInFrames], [0.4, 1, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Warm candlelight amber overlay, flickers slightly
  const flicker = 0.06 + 0.04 * Math.sin(frame * 0.37) + 0.03 * Math.sin(frame * 0.71);
  const candleAlpha = 0.14 * intensity + flicker * intensity;

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none" }}>
      {/* Raindrop streaks */}
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        viewBox="0 0 1080 1920"
        xmlns="http://www.w3.org/2000/svg"
      >
        {DROPS.map((drop, i) => {
          const startFrame = drop.delay;
          if (frame < startFrame) return null;
          const elapsed = frame - startFrame;
          const cycleLen = Math.round(1920 / drop.speed) + 10;
          const y = ((elapsed * drop.speed) % 1920);
          return (
            <line
              key={i}
              x1={drop.x}
              y1={y}
              x2={drop.x + 2}
              y2={y + drop.length}
              stroke="rgba(160,180,220,0.9)"
              strokeWidth={1.2}
              opacity={drop.opacity * intensity}
            />
          );
        })}
      </svg>

      {/* Window pane grid */}
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.08 * intensity }}
        viewBox="0 0 1080 1920"
        xmlns="http://www.w3.org/2000/svg"
      >
        <line x1={540} y1={0} x2={540} y2={1920} stroke="#AAC" strokeWidth={6} />
        <line x1={0} y1={960} x2={1080} y2={960} stroke="#AAC" strokeWidth={6} />
      </svg>

      {/* Candlelight warmth */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 50% 75%, rgba(240,160,30,${candleAlpha}) 0%, transparent 65%)`,
        }}
      />
    </div>
  );
};

import React from "react";
import { interpolate, spring, useCurrentFrame } from "remotion";

interface RedThreadProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  startFrame?: number;
  sag?: number;
}

export const RedThread: React.FC<RedThreadProps> = ({
  x1,
  y1,
  x2,
  y2,
  startFrame = 15,
  sag = 40,
}) => {
  const frame = useCurrentFrame();

  const spr = spring({
    frame: Math.max(0, frame - startFrame),
    fps: 30,
    config: { damping: 16, stiffness: 70 },
  });

  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2 + sag;

  // Approximate curve length
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy) + sag * 0.8;

  const strokeDashoffset = interpolate(spr, [0, 1], [length, 0]);

  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        width: 1080,
        height: 1920,
        zIndex: 60,
        pointerEvents: "none",
      }}
      viewBox="0 0 1080 1920"
    >
      <path
        d={`M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`}
        stroke="#DC2626"
        strokeWidth={4.5}
        fill="none"
        strokeDasharray={length}
        strokeDashoffset={strokeDashoffset}
        style={{
          filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.85))",
        }}
      />
    </svg>
  );
};


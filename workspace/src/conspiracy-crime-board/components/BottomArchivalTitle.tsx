import React from "react";
import { spring, interpolate } from "remotion";

export interface BottomArchivalTitleProps {
  frame: number;
  fps: number;
  title?: string;
  dateMarker?: string;
  subnote?: string;
  startFrame?: number;
}

export const BottomArchivalTitle: React.FC<BottomArchivalTitleProps> = ({
  frame,
  fps,
  title = "YOUR TEXT",
  dateMarker = "2024",
  subnote = "Subtitle Catatan Penyelidikan // Case File #01",
  startFrame = 72,
}) => {
  if (frame < startFrame) return null;

  const spr = spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.8 },
  });

  const translateY = interpolate(spr, [0, 1], [60, 0]);
  const opacity = interpolate(spr, [0, 0.4, 1], [0, 1, 1]);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 40,
        left: 40,
        right: 40,
        backgroundColor: "rgba(238, 230, 214, 0.94)",
        border: "1px solid rgba(168, 152, 128, 0.9)",
        borderRadius: 14,
        padding: "24px 28px",
        boxShadow:
          "0 24px 60px rgba(0,0,0,0.85), inset 0 0 25px rgba(120,90,50,0.18)",
        transform: `translateY(${translateY}px) rotate(-0.8deg)`,
        opacity,
        zIndex: 55,
        pointerEvents: "none",
      }}
    >
      {/* Metal Paper Clip at Left Corner */}
      <div
        style={{
          position: "absolute",
          top: -20,
          left: 28,
          width: 22,
          height: 60,
          border: "3px solid #8c7b64",
          borderRadius: 20,
          transform: "rotate(-18deg)",
          boxShadow: "0 4px 10px rgba(0,0,0,0.5)",
        }}
      />

      {/* Red Handwritten Marker Date: e.g. "2024 00:00" */}
      <div
        style={{
          fontFamily: "'Caveat', cursive, sans-serif",
          fontSize: 34,
          fontWeight: 700,
          color: "#dc2626",
          marginLeft: 42,
          marginBottom: -4,
          transform: "rotate(-3deg)",
          textShadow: "0 0 8px rgba(220, 20, 20, 0.35)",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span
          style={{
            border: "2px solid #dc2626",
            borderRadius: 999,
            padding: "2px 14px",
          }}
        >
          {dateMarker}
        </span>
        <span style={{ fontSize: 28 }}>00:00</span>
      </div>

      {/* Heavy Spray-Stenciled Headline: e.g. "YOUR TEXT" */}
      <div
        style={{
          fontFamily: "'Anton', sans-serif",
          fontSize: 96,
          fontWeight: 900,
          color: "#14110e",
          textTransform: "uppercase",
          letterSpacing: 4,
          lineHeight: 0.95,
          marginTop: 6,
          textShadow:
            "0 0 2px #000, 0 0 12px rgba(0,0,0,0.65), 1px 1px 0 rgba(255,255,255,0.25)",
          filter: "contrast(1.4) drop-shadow(0 4px 10px rgba(0,0,0,0.85))",
        }}
      >
        {title}
      </div>

      {/* Red Cursive Subnote underneath */}
      <div
        style={{
          fontFamily: "'Caveat', cursive, sans-serif",
          fontSize: 26,
          fontWeight: 700,
          color: "#991b1b",
          marginLeft: 46,
          marginTop: -2,
          letterSpacing: 1.2,
        }}
      >
        {subnote}
      </div>
    </div>
  );
};


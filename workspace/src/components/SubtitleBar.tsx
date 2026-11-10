import React from "react";
import { interpolate, spring, useCurrentFrame } from "remotion";

interface SubtitleBarProps {
  text: string;
  highlightWords?: string[];
  startFrame?: number;
}

export const SubtitleBar: React.FC<SubtitleBarProps> = ({
  text,
  highlightWords = [],
  startFrame = 5,
}) => {
  const frame = useCurrentFrame();

  const spr = spring({
    frame: Math.max(0, frame - startFrame),
    fps: 30,
    config: { damping: 14, stiffness: 80 },
  });

  const translateY = interpolate(spr, [0, 1], [30, 0]);
  const opacity = interpolate(spr, [0, 1], [0, 1]);

  // Clean words and split for highlight rendering
  const words = text.split(" ");

  return (
    <div
      style={{
        position: "absolute",
        bottom: 300, // Safe Zone: Above TikTok caption / audio pill
        left: 60,
        right: 60,
        display: "flex",
        justifyContent: "center",
        zIndex: 95,
        transform: `translateY(${translateY}px)`,
        opacity,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          maxWidth: 960,
          padding: "20px 32px",
          backgroundColor: "rgba(10, 10, 12, 0.88)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderLeft: "4px solid #DC2626",
          borderRadius: 8,
          boxShadow: "0 12px 36px rgba(0, 0, 0, 0.85)",
          textAlign: "center",
        }}
      >
        <p
          style={{
            margin: 0,
            color: "#F5F0E4",
            fontFamily: "'Inter', sans-serif",
            fontSize: 32,
            fontWeight: 700,
            lineHeight: 1.35,
            letterSpacing: "-0.5px",
          }}
        >
          {words.map((w, idx) => {
            const cleanWord = w.toLowerCase().replace(/[^a-z0-9]/g, "");
            const isHighlighted = highlightWords.some(
              (hw) => hw.toLowerCase().replace(/[^a-z0-9]/g, "") === cleanWord
            );

            return (
              <span
                key={idx}
                style={{
                  color: isHighlighted ? "#F59E0B" : "#F5F0E4",
                  fontWeight: isHighlighted ? 900 : 700,
                  textDecoration: isHighlighted ? "underline" : "none",
                  textDecorationColor: isHighlighted ? "#DC2626" : "transparent",
                  marginRight: 6,
                }}
              >
                {w}
              </span>
            );
          })}
        </p>
      </div>
    </div>
  );
};


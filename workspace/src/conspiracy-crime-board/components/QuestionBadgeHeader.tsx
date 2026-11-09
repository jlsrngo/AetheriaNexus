import React from "react";
import { spring, interpolate } from "remotion";

export interface QuestionBadgeHeaderProps {
  frame: number;
  fps: number;
  mainText?: string;
  subText?: string;
}

export const QuestionBadgeHeader: React.FC<QuestionBadgeHeaderProps> = ({
  frame,
  fps,
  mainText = "TAHUKAH KAMU?",
  subText = "KASUS MISTERIUS // SIAPA SOSOK INI?",
}) => {
  const spr = spring({
    frame: Math.max(0, frame - 4),
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.8 },
  });

  const translateY = interpolate(spr, [0, 1], [-80, 0]);
  const opacity = interpolate(spr, [0, 0.4, 1], [0, 1, 1]);

  return (
    <div
      style={{
        position: "absolute",
        top: 85,
        left: 45,
        right: 45,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        zIndex: 50,
        transform: `translateY(${translateY}px)`,
        opacity,
        pointerEvents: "none",
      }}
    >
      {/* Badge Kuning Khas Kasus Misteri / Police Line Style */}
      <div
        style={{
          backgroundColor: "#f59e0b",
          backgroundImage:
            "repeating-linear-gradient(45deg, #f59e0b, #f59e0b 20px, #d97706 20px, #d97706 40px)",
          padding: "4px 28px",
          borderRadius: 6,
          boxShadow: "0 8px 24px rgba(0,0,0,0.85)",
          border: "2px solid #1c1815",
          transform: "rotate(-1.5deg)",
        }}
      >
        <span
          style={{
            fontFamily: "'Courier Prime', monospace",
            fontWeight: 900,
            fontSize: 16,
            color: "#181410",
            letterSpacing: 3,
            textTransform: "uppercase",
          }}
        >
          ★ INVESTIGATION DOSSIER ★
        </span>
      </div>

      {/* Headline Besar: "TAHUKAH KAMU?" */}
      <h1
        style={{
          margin: "12px 0 0 0",
          fontFamily: "'Anton', sans-serif",
          fontSize: 82,
          fontWeight: 900,
          color: "#faf8f5",
          letterSpacing: 4,
          lineHeight: 1,
          textTransform: "uppercase",
          textShadow:
            "0 0 20px rgba(0,0,0,0.9), 0 4px 10px rgba(0,0,0,0.85), 2px 2px 0 #b91c1c",
          transform: "rotate(-0.8deg)",
          textAlign: "center",
        }}
      >
        {mainText}
      </h1>

      {/* Subjudul Cursive Tinta Merah */}
      <div
        style={{
          fontFamily: "'Caveat', cursive, sans-serif",
          fontSize: 32,
          fontWeight: 700,
          color: "#ef4444",
          marginTop: -2,
          letterSpacing: 1.5,
          textShadow: "0 0 10px rgba(239, 68, 68, 0.4)",
          transform: "rotate(1deg)",
        }}
      >
        {subText}
      </div>
    </div>
  );
};


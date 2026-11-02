import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TikTokVideoProps } from "./types";

const THEME_GRADIENTS: Record<TikTokVideoProps["themeColor"], { bg: string; accent: string; glow: string }> = {
  emerald: {
    bg: "radial-gradient(circle at 50% 20%, #064e3b 0%, #022c22 45%, #050b14 100%)",
    accent: "#10b981",
    glow: "rgba(16, 185, 129, 0.4)",
  },
  violet: {
    bg: "radial-gradient(circle at 50% 20%, #581c87 0%, #3b0764 45%, #050b14 100%)",
    accent: "#a855f7",
    glow: "rgba(168, 85, 247, 0.4)",
  },
  rose: {
    bg: "radial-gradient(circle at 50% 20%, #881337 0%, #4c0519 45%, #050b14 100%)",
    accent: "#f43f5e",
    glow: "rgba(244, 63, 94, 0.4)",
  },
  amber: {
    bg: "radial-gradient(circle at 50% 20%, #78350f 0%, #451a03 45%, #050b14 100%)",
    accent: "#f59e0b",
    glow: "rgba(245, 158, 11, 0.4)",
  },
  cyan: {
    bg: "radial-gradient(circle at 50% 20%, #164e63 0%, #083344 45%, #050b14 100%)",
    accent: "#06b6d4",
    glow: "rgba(6, 182, 212, 0.4)",
  },
};

export const TikTokVideo: React.FC<TikTokVideoProps> = ({
  hookText,
  bodyText,
  authorHandle,
  themeColor,
  category,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance spring animation for hook
  const hookSpring = spring({
    frame,
    fps,
    config: {
      damping: 12,
      stiffness: 100,
    },
  });

  const hookOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Body text fade & slide up
  const bodyOpacity = interpolate(frame, [25, 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const bodyTranslateY = interpolate(frame, [25, 45], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Floating background particle animation
  const bgShift = Math.sin(frame / 20) * 15;

  const currentTheme = THEME_GRADIENTS[themeColor] || THEME_GRADIENTS.emerald;

  const bodyLines = bodyText.split("\n").filter((l) => l.trim().length > 0);

  return (
    <AbsoluteFill
      style={{
        background: currentTheme.bg,
        fontFamily: "'Segoe UI', Roboto, sans-serif",
        color: "#ffffff",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "120px 80px",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* Dynamic ambient orb */}
      <div
        style={{
          position: "absolute",
          top: "15%",
          left: "50%",
          transform: `translateX(-50%) translateY(${bgShift}px)`,
          width: "600px",
          height: "600px",
          background: currentTheme.glow,
          filter: "blur(140px)",
          borderRadius: "50%",
          pointerEvents: "none",
        }}
      />

      {/* Header: Category Badge */}
      <div style={{ zIndex: 10 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "12px",
            background: "rgba(255, 255, 255, 0.08)",
            border: `1.5px solid ${currentTheme.accent}`,
            padding: "12px 28px",
            borderRadius: "999px",
            backdropFilter: "blur(20px)",
            boxShadow: `0 0 25px ${currentTheme.glow}`,
          }}
        >
          <span
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              background: currentTheme.accent,
            }}
          />
          <span
            style={{
              fontSize: "28px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "2px",
              color: "#f8fafc",
            }}
          >
            {category}
          </span>
        </div>
      </div>

      {/* Center: Main Hook & Body */}
      <div
        style={{
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          gap: "50px",
        }}
      >
        {/* Hook */}
        <h1
          style={{
            fontSize: "64px",
            lineHeight: 1.25,
            fontWeight: 900,
            letterSpacing: "-1px",
            margin: 0,
            textShadow: "0 4px 30px rgba(0,0,0,0.8)",
            transform: `scale(${hookSpring})`,
            opacity: hookOpacity,
            background: "linear-gradient(180deg, #ffffff 0%, #cbd5e1 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {hookText}
        </h1>

        {/* Dynamic Body Points */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "24px",
            opacity: bodyOpacity,
            transform: `translateY(${bodyTranslateY}px)`,
          }}
        >
          {bodyLines.map((line, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "20px",
                background: "rgba(15, 23, 42, 0.65)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                padding: "24px 32px",
                borderRadius: "24px",
                backdropFilter: "blur(16px)",
              }}
            >
              <span
                style={{
                  fontSize: "36px",
                  fontWeight: 800,
                  color: currentTheme.accent,
                  lineHeight: 1.3,
                }}
              >
                ✓
              </span>
              <p
                style={{
                  fontSize: "34px",
                  lineHeight: 1.4,
                  fontWeight: 600,
                  color: "#f1f5f9",
                  margin: 0,
                }}
              >
                {line}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer: Handle & Brand */}
      <div
        style={{
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: "1px solid rgba(255, 255, 255, 0.1)",
          paddingTop: "40px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${currentTheme.accent}, #000)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
              fontWeight: 800,
              border: "2px solid rgba(255, 255, 255, 0.2)",
            }}
          >
            ⚡
          </div>
          <div>
            <div style={{ fontSize: "28px", fontWeight: 700, color: "#ffffff" }}>
              {authorHandle}
            </div>
            <div style={{ fontSize: "20px", color: "#94a3b8" }}>Follow for daily tips</div>
          </div>
        </div>

        <div
          style={{
            fontSize: "22px",
            fontWeight: 700,
            color: currentTheme.accent,
            background: "rgba(255,255,255,0.06)",
            padding: "10px 24px",
            borderRadius: "16px",
          }}
        >
          TIKTOK SHORTS
        </div>
      </div>
    </AbsoluteFill>
  );
};


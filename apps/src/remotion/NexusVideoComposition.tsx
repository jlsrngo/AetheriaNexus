import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { NexusVideoProps } from "./types";

const THEME_GRADIENTS: Record<
  NexusVideoProps["themeColor"],
  { bg: string; accent: string; glow: string; border: string }
> = {
  orange: {
    bg: "radial-gradient(circle at 50% 20%, #7c2d12 0%, #431407 45%, #050b14 100%)",
    accent: "#f97316",
    glow: "rgba(249, 115, 22, 0.4)",
    border: "rgba(249, 115, 22, 0.6)",
  },
  emerald: {
    bg: "radial-gradient(circle at 50% 20%, #064e3b 0%, #022c22 45%, #050b14 100%)",
    accent: "#10b981",
    glow: "rgba(16, 185, 129, 0.4)",
    border: "rgba(16, 185, 129, 0.6)",
  },
  violet: {
    bg: "radial-gradient(circle at 50% 20%, #581c87 0%, #3b0764 45%, #050b14 100%)",
    accent: "#a855f7",
    glow: "rgba(168, 85, 247, 0.4)",
    border: "rgba(168, 85, 247, 0.6)",
  },
  rose: {
    bg: "radial-gradient(circle at 50% 20%, #881337 0%, #4c0519 45%, #050b14 100%)",
    accent: "#f43f5e",
    glow: "rgba(244, 63, 94, 0.4)",
    border: "rgba(244, 63, 94, 0.6)",
  },
  amber: {
    bg: "radial-gradient(circle at 50% 20%, #78350f 0%, #451a03 45%, #050b14 100%)",
    accent: "#f59e0b",
    glow: "rgba(245, 158, 11, 0.4)",
    border: "rgba(245, 158, 11, 0.6)",
  },
  cyan: {
    bg: "radial-gradient(circle at 50% 20%, #164e63 0%, #083344 45%, #050b14 100%)",
    accent: "#06b6d4",
    glow: "rgba(6, 182, 212, 0.4)",
    border: "rgba(6, 182, 212, 0.6)",
  },
};

export const NexusVideoComposition: React.FC<NexusVideoProps> = ({
  hookText,
  bodyText,
  authorHandle,
  themeColor = "emerald",
  category = "PRODUCTIVITY",
  subCategory = "EXECUTIVE HABITS",
  showText = true,
  showBackground = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Smooth entrance dynamics
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

  const bodyOpacity = interpolate(frame, [25, 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const bodyTranslateY = interpolate(frame, [25, 45], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const bgShift = Math.sin(frame / 20) * 15;
  const currentTheme = THEME_GRADIENTS[themeColor] || THEME_GRADIENTS.emerald;
  const bodyLines = (bodyText || "").split("\n").filter((l) => l.trim().length > 0);

  return (
    <AbsoluteFill
      style={{
        background: showBackground ? currentTheme.bg : "#050b14",
        fontFamily: "Inter, 'Segoe UI', Roboto, sans-serif",
        color: "#f30000",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "120px 80px 200px 80px",
        boxSizing: "border-box",
        overflow: "hidden"
      }}
    >
      {/* Background ambient lighting orb & Blueprint Grid */}
      {showBackground && (
        <>
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
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
              pointerEvents: "none",
            }}
          />
        </>
      )}

      {/* TOP HEADER HUD TELEMETRY */}
      {showText && (
        <div style={{ zIndex: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "12px",
              background: "rgba(10, 10, 10, 0.75)",
              border: `1.5px solid ${currentTheme.border}`,
              padding: "10px 24px",
              borderRadius: "0px",
              backdropFilter: "blur(20px)",
              boxShadow: `0 0 25px ${currentTheme.glow}`,
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                background: currentTheme.accent,
              }}
            />
            <span
              style={{
                fontSize: "22px",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "3px",
                color: "#f8fafc",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              // {category}
            </span>
          </div>

          {subCategory && (
            <div
              style={{
                fontSize: "18px",
                fontWeight: 600,
                color: "rgba(255, 255, 255, 0.5)",
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: "2px",
                textTransform: "uppercase",
              }}
            >
              [ {subCategory} ]
            </div>
          )}
        </div>
      )}

      {/* MAIN BODY: HOOK + BULLET POINTS */}
      {showText && (
        <div
          style={{
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            gap: "40px",
          }}
        >
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

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "20px",
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
                  background: "rgba(10, 10, 10, 0.88)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  padding: "24px 32px",
                  borderRadius: "0px",
                  backdropFilter: "blur(16px)",
                }}
              >
                <span
                  style={{
                    fontSize: "30px",
                    fontWeight: 800,
                    color: currentTheme.accent,
                    lineHeight: 1.3,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  //
                </span>
                <p
                  style={{
                    fontSize: "30px",
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
      )}

      {/* FOOTER: AUTHOR + HIGH-END TELEMETRY BADGE */}
      {showText && (
        <div
          style={{
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid rgba(255, 255, 255, 0.12)",
            paddingTop: "32px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                width: "52px",
                height: "52px",
                background: currentTheme.accent,
                color: "#000000",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "26px",
                fontWeight: 900,
                borderRadius: "0px",
              }}
            >
              ⚡
            </div>
            <div>
              <div
                style={{
                  fontSize: "26px",
                  fontWeight: 800,
                  color: "#ffffff",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {authorHandle}
              </div>
              <div style={{ fontSize: "17px", color: "#94a3b8", fontFamily: "'JetBrains Mono', monospace" }}>
                Nexus Studio // Automated Production
              </div>
            </div>
          </div>

          <div
            style={{
              fontSize: "18px",
              fontWeight: 800,
              color: currentTheme.accent,
              border: `1px solid ${currentTheme.border}`,
              background: "rgba(10, 10, 10, 0.6)",
              padding: "8px 20px",
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "2px",
              borderRadius: "0px",
            }}
          >
            NEXUS // EDITORIAL SHORT
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

/**
 * Backward compatibility alias
 */
export const TikTokVideo = NexusVideoComposition;


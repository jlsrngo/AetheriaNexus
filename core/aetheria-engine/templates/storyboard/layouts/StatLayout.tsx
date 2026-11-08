import React from "react";
import { ResolvedScene, ThemePalette } from "../types";
import {
  Beat,
  HighlightedHeadline,
  easeOutBack,
  easeOutExpo,
  progress,
} from "../motion";

export const StatLayout: React.FC<{
  scene: ResolvedScene;
  t: number;
  palette: ThemePalette;
}> = ({ scene, t, palette }) => {
  const isDark = Boolean(scene.dark);
  const textColor = isDark ? palette.textDark : palette.textLight;

  const cardP = easeOutBack(progress(t, 0.0, 0.75));
  const floatAngle = t * 3.0;
  const barProgress = easeOutExpo(progress(t, 0.25, 1.35));
  const bars = [0.35, 0.5, 0.65, 0.82, 1.0];

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "56px 22px",
        gap: 18,
        perspective: 900,
      }}
    >
      {/* 3D Tilted Analytics Card */}
      <div
        style={{
          width: "92%",
          borderRadius: 16,
          backgroundColor: "rgba(18,19,24,0.96)",
          border: "1px solid rgba(255,255,255,0.16)",
          padding: 18,
          boxShadow: `0 25px 65px ${palette.accentGlow}`,
          color: "#FFFFFF",
          transform: `rotateY(${(-15 + cardP * 11 + floatAngle).toFixed(
            2
          )}deg) rotateX(${(11 - cardP * 7).toFixed(2)}deg) scale(${(
            0.76 +
            cardP * 0.24
          ).toFixed(3)})`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                backgroundColor: palette.accent,
              }}
            />
            <span style={{ fontWeight: 800, fontSize: 15 }}>METRICS</span>
          </div>
          <span
            style={{
              padding: "2px 9px",
              fontSize: 9,
              fontFamily: "monospace",
              backgroundColor: palette.accentSoft,
              color: palette.accent,
              borderRadius: 999,
              fontWeight: 800,
            }}
          >
            {scene.tag || "BENCHMARK"}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: "50%",
              border: `2.5px solid ${palette.accent}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "monospace",
              fontWeight: 900,
              fontSize: 18,
              color: palette.accent,
              flexShrink: 0,
            }}
          >
            #1
          </div>
          <div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 900,
                fontFamily: "monospace",
                lineHeight: 1.05,
              }}
            >
              {scene.statValue || "100%"}
            </div>
            {scene.statLabel && (
              <div style={{ fontSize: 11, color: "#A1A1AA", marginTop: 2 }}>
                {scene.statLabel}
              </div>
            )}
          </div>
        </div>

        {/* Animated Bar Chart */}
        <div
          style={{
            backgroundColor: "rgba(24,24,27,0.92)",
            padding: 12,
            borderRadius: 12,
            border: "1px solid #27272A",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              height: 62,
              gap: 8,
            }}
          >
            {bars.map((h, i) => {
              const isLast = i === bars.length - 1;
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: `${Math.max(14, h * barProgress * 100)}%`,
                    backgroundColor: isLast
                      ? palette.accent
                      : i >= 3
                      ? "#991B1B"
                      : "#3F3F46",
                    borderRadius: "4px 4px 0 0",
                    boxShadow: isLast
                      ? `0 0 14px ${palette.accent}`
                      : "none",
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Kinetic Headlines */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          width: "100%",
        }}
      >
        {scene.beats.map((b) => (
          <Beat key={b.id} t={t} startSec={b.startSec} endSec={b.endSec}>
            <HighlightedHeadline
              t={t}
              startSec={b.startSec}
              text={b.text}
              accent={b.accent || (b.type === "punch" ? b.text : undefined)}
              accentColor={palette.accent}
              textColor={textColor}
              fontSize={b.type === "punch" ? 31 : 27}
            />
          </Beat>
        ))}
      </div>
    </div>
  );
};

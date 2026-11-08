import React from "react";
import { ResolvedScene, ThemePalette } from "../types";
import { Beat, HighlightedHeadline } from "../motion";

export const ListLayout: React.FC<{
  scene: ResolvedScene;
  t: number;
  palette: ThemePalette;
}> = ({ scene, t, palette }) => {
  const isDark = Boolean(scene.dark);
  const textColor = isDark ? palette.textDark : palette.textLight;
  const mutedColor = isDark ? palette.mutedDark : palette.mutedLight;
  const cardBg = isDark ? palette.cardDark : palette.cardLight;
  const borderCol = isDark ? palette.borderDark : palette.borderLight;

  const cardBeats = scene.beats.filter((b) => b.type === "card" || b.type === "badge");
  const headlineBeats = scene.beats.filter(
    (b) => b.type !== "card" && b.type !== "badge"
  );

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
        gap: 16,
      }}
    >
      {/* Top Header Banner */}
      <Beat
        t={t}
        startSec={0.05}
        style={{
          width: "100%",
          backgroundColor: palette.bgDark,
          color: palette.textDark,
          padding: "14px 16px",
          borderRadius: 16,
          border: `1.5px solid ${palette.borderDark}`,
          boxShadow: "0 18px 40px rgba(0,0,0,0.18)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 9,
            fontFamily: "monospace",
            color: palette.accent,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontWeight: 800,
          }}
        >
          {scene.tag || "ECOSYSTEM MATRIX"}
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 900,
            letterSpacing: "-0.03em",
            marginTop: 3,
          }}
        >
          {scene.statValue || "PRODUCTION READY"}
        </div>
        {scene.statLabel && (
          <div
            style={{
              fontSize: 11,
              fontFamily: "monospace",
              color: palette.mutedDark,
              marginTop: 2,
            }}
          >
            {scene.statLabel}
          </div>
        )}
      </Beat>

      {/* 2-Column Bento Grid for Card Beats */}
      {cardBeats.length > 0 && (
        <div
          style={{
            width: "100%",
            display: "grid",
            gridTemplateColumns: cardBeats.length === 1 ? "1fr" : "1fr 1fr",
            gap: 10,
          }}
        >
          {cardBeats.map((b, idx) => (
            <Beat
              key={b.id}
              t={t}
              startSec={b.startSec}
              endSec={b.endSec}
              style={{
                backgroundColor: cardBg,
                border: `1.5px solid ${borderCol}`,
                borderRadius: 14,
                padding: "10px 12px",
                boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  fontFamily: "monospace",
                  fontSize: 12,
                  fontWeight: 800,
                  color: textColor,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor:
                      idx % 2 === 0 ? palette.accent : "#10B981",
                    flexShrink: 0,
                  }}
                />
                <span>{b.text}</span>
              </div>
              {b.subtext && (
                <div
                  style={{
                    fontSize: 10,
                    fontFamily: "monospace",
                    color: mutedColor,
                    paddingLeft: 15,
                  }}
                >
                  {b.subtext}
                </div>
              )}
            </Beat>
          ))}
        </div>
      )}

      {/* Bottom Summary Beats */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          width: "100%",
          marginTop: 4,
        }}
      >
        {headlineBeats.map((b) => (
          <Beat key={b.id} t={t} startSec={b.startSec} endSec={b.endSec}>
            <HighlightedHeadline
              t={t}
              startSec={b.startSec}
              text={b.text}
              accent={b.accent || (b.type === "punch" ? b.text : undefined)}
              accentColor={palette.accent}
              textColor={textColor}
              fontSize={b.type === "punch" ? 29 : 25}
            />
          </Beat>
        ))}
      </div>
    </div>
  );
};


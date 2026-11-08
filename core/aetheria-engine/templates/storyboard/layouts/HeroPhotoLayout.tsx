import React from "react";
import { staticFile } from "remotion";
import { ResolvedScene, ThemePalette } from "../types";
import { Beat, HighlightedHeadline, easeOutBack, progress } from "../motion";

export const HeroPhotoLayout: React.FC<{
  scene: ResolvedScene;
  t: number;
  palette: ThemePalette;
}> = ({ scene, t, palette }) => {
  const isDark = Boolean(scene.dark);
  const textColor = isDark ? palette.textDark : palette.textLight;
  const cardBg = isDark ? palette.cardDark : palette.cardLight;
  const borderCol = isDark ? palette.borderDark : palette.borderLight;

  const badgeBeat = scene.beats.find((b) => b.type === "badge");
  const headlineBeats = scene.beats.filter(
    (b) => b.type === "headline" || b.type === "subheadline" || b.type === "punch"
  );

  const photoPop = easeOutBack(progress(t, 0.0, 0.7));
  const floatY = Math.sin(t * 2.8) * 5;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "56px 20px 40px",
        gap: 16,
      }}
    >
      {/* Hero Photo Frame */}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          transform: `translate3d(0, ${floatY.toFixed(1)}px, 0) scale(${(
            0.86 +
            photoPop * 0.14
          ).toFixed(3)})`,
        }}
      >
        <div
          style={{
            width: 242,
            height: 315,
            borderRadius: 24,
            overflow: "hidden",
            border: `3px solid ${cardBg}`,
            backgroundColor: cardBg,
            boxShadow: `0 20px 48px rgba(0,0,0,0.28), 0 0 36px ${palette.accentGlow}`,
            position: "relative",
          }}
        >
          {scene.image ? (
            <img
              src={staticFile(scene.image)}
              alt={scene.tag || "Hero"}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                background: `radial-gradient(circle at 50% 35%, ${palette.accent}, ${palette.bgDark})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 64,
              }}
            >
              🦀
            </div>
          )}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0) 62%, rgba(0,0,0,0.48) 100%)",
            }}
          />
        </div>

        {scene.tag && (
          <Beat
            t={t}
            startSec={0.55}
            style={{
              marginTop: -16,
              backgroundColor: palette.bgDark,
              color: palette.textDark,
              fontFamily: "monospace",
              fontSize: 11,
              fontWeight: 800,
              padding: "4px 12px",
              borderRadius: 999,
              border: `1.5px solid ${palette.accent}`,
              boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
            }}
          >
            {scene.tag}
          </Beat>
        )}
      </div>

      {/* Bottom Kinetic Card */}
      <div
        style={{
          width: "100%",
          backgroundColor: isDark
            ? "rgba(24, 24, 27, 0.94)"
            : "rgba(244, 241, 234, 0.95)",
          padding: "12px 18px",
          borderRadius: 20,
          border: `1px solid ${borderCol}`,
          boxShadow: "0 12px 34px rgba(0,0,0,0.14)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
        }}
      >
        {badgeBeat && (
          <Beat
            t={t}
            startSec={badgeBeat.startSec}
            endSec={badgeBeat.endSec}
            style={{
              fontSize: 11,
              fontFamily: "monospace",
              fontWeight: 900,
              backgroundColor: palette.accent,
              color: "#FFFFFF",
              padding: "3px 12px",
              borderRadius: 999,
              letterSpacing: "0.1em",
            }}
          >
            {badgeBeat.text}
          </Beat>
        )}

        {headlineBeats.map((b) => (
          <Beat key={b.id} t={t} startSec={b.startSec} endSec={b.endSec}>
            <HighlightedHeadline
              t={t}
              startSec={b.startSec}
              text={b.text}
              accent={b.accent || (b.type === "punch" ? b.text : undefined)}
              accentColor={palette.accent}
              textColor={textColor}
              fontSize={b.type === "punch" ? 30 : 28}
            />
          </Beat>
        ))}
      </div>
    </div>
  );
};


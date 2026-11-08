import React from "react";
import { ResolvedScene, ThemePalette } from "../types";
import { Beat, HighlightedHeadline, easeOutExpo, progress } from "../motion";

export const CtaLayout: React.FC<{
  scene: ResolvedScene;
  t: number;
  palette: ThemePalette;
}> = ({ scene, t, palette }) => {
  const isDark = Boolean(scene.dark);
  const textColor = isDark ? palette.textDark : palette.textLight;

  const ctaBeat = scene.beats.find((b) => b.type === "cta" || b.type === "code");
  const headlineBeats = scene.beats.filter(
    (b) => b.type !== "cta" && b.type !== "code"
  );
  const kbSlide = easeOutExpo(progress(t, 0.0, 0.75));

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "56px 24px 110px",
        gap: 18,
        position: "relative",
      }}
    >
      {scene.tag && (
        <Beat
          t={t}
          startSec={0.05}
          style={{
            fontFamily: "monospace",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            padding: "4px 12px",
            borderRadius: 999,
            backgroundColor: palette.accent,
            color: "#FFFFFF",
          }}
        >
          {scene.tag}
        </Beat>
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          width: "100%",
          zIndex: 20,
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
              fontSize={b.type === "punch" ? 34 : 30}
            />
          </Beat>
        ))}
      </div>

      {ctaBeat && (
        <Beat
          t={t}
          startSec={ctaBeat.startSec}
          endSec={ctaBeat.endSec}
          style={{
            marginTop: 6,
            padding: "10px 20px",
            borderRadius: 14,
            backgroundColor: "#18181B",
            border: `1.5px solid ${palette.accent}`,
            fontFamily: "monospace",
            fontSize: 17,
            color: "#FFFFFF",
            fontWeight: 800,
            boxShadow: `0 0 32px ${palette.accentGlow}`,
            zIndex: 20,
          }}
        >
          {ctaBeat.text}
        </Beat>
      )}

      {/* Angled 3D Mechanical Keyboard Deck at Bottom */}
      <div
        style={{
          position: "absolute",
          bottom: -36,
          width: "112%",
          backgroundColor: "#18181C",
          padding: 12,
          borderRadius: 16,
          boxShadow: "0 -15px 40px rgba(0,0,0,0.4)",
          borderTop: "2px solid #3F3F46",
          transform: `rotate(-10deg) translate3d(0, ${(
            (1 - kbSlide) *
            130
          ).toFixed(1)}px, 0)`,
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(8, 1fr)",
            gap: 5,
            fontFamily: "monospace",
            fontSize: 10,
            color: "#D4D4D8",
          }}
        >
          <div
            style={{
              backgroundColor: "#27272A",
              padding: 7,
              borderRadius: 4,
              color: palette.accent,
              fontWeight: 800,
              textAlign: "center",
            }}
          >
            ESC
          </div>
          {(scene.statValue && scene.statValue.length === 5
            ? scene.statValue.toUpperCase().split("")
            : ["S", "T", "A", "R", "T"]
          ).map((k, idx) => (
            <div
              key={idx}
              style={{
                backgroundColor: palette.accent,
                color: "#FFF",
                fontWeight: 900,
                padding: 7,
                borderRadius: 4,
                boxShadow: `0 0 10px ${palette.accent}`,
                textAlign: "center",
              }}
            >
              {k}
            </div>
          ))}
          <div
            style={{
              backgroundColor: "#27272A",
              padding: 7,
              borderRadius: 4,
              gridColumn: "span 2",
              textAlign: "center",
            }}
          >
            RUN ↵
          </div>
        </div>
      </div>
    </div>
  );
};

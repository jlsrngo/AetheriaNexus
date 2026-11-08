import React from "react";
import { ResolvedScene, ThemePalette } from "../types";
import { Beat, HighlightedHeadline, easeOutBack, progress } from "../motion";

export const TerminalLayout: React.FC<{
  scene: ResolvedScene;
  t: number;
  palette: ThemePalette;
}> = ({ scene, t, palette }) => {
  const isDark = Boolean(scene.dark);
  const textColor = isDark ? palette.textDark : palette.textLight;

  const termPop = easeOutBack(progress(t, 0.0, 0.7));
  const codeLines =
    scene.codeLines && scene.codeLines.length > 0
      ? scene.codeLines
      : [
          "$ cargo build --release",
          "✓ borrow_checker::verify(&mut mem)",
          "✓ zero_cost_abstraction: enabled",
        ];

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
        gap: 20,
      }}
    >
      {/* Terminal Window */}
      <div
        style={{
          width: "100%",
          borderRadius: 14,
          backgroundColor: "#141418",
          border: "1px solid rgba(255,255,255,0.18)",
          padding: 16,
          boxShadow: `0 24px 56px rgba(0,0,0,0.45), 0 0 32px ${palette.accentGlow}`,
          transform: `scale(${(0.82 + termPop * 0.18).toFixed(3)})`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #27272A",
            paddingBottom: 10,
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", gap: 6 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                backgroundColor: "#EF4444",
              }}
            />
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                backgroundColor: "#F59E0B",
              }}
            />
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                backgroundColor: "#10B981",
              }}
            />
          </div>
          <span
            style={{
              fontSize: 10,
              fontFamily: "monospace",
              color: "#A1A1AA",
            }}
          >
            {scene.tag || "rustc // compiler"}
          </span>
          <span
            style={{
              fontSize: 9,
              fontFamily: "monospace",
              padding: "2px 7px",
              borderRadius: 4,
              backgroundColor: palette.accentSoft,
              color: palette.accent,
              fontWeight: 800,
            }}
          >
            {scene.statValue || "SAFE"}
          </span>
        </div>

        <div
          style={{
            fontFamily: "monospace",
            fontSize: 12,
            display: "flex",
            flexDirection: "column",
            gap: 7,
            color: "#E4E4E7",
          }}
        >
          {codeLines.map((line, idx) => (
            <Beat key={idx} t={t} startSec={0.18 + idx * 0.22}>
              <div style={{ lineHeight: 1.35 }}>
                {line.startsWith("$") ? (
                  <>
                    <span style={{ color: palette.accent, fontWeight: 800 }}>
                      ${" "}
                    </span>
                    <span style={{ color: "#FFFFFF", fontWeight: 700 }}>
                      {line.slice(1).trim()}
                    </span>
                  </>
                ) : line.startsWith("✓") ? (
                  <>
                    <span style={{ color: "#34D399", fontWeight: 800 }}>
                      ✓{" "}
                    </span>
                    <span>{line.slice(1).trim()}</span>
                  </>
                ) : (
                  <span style={{ color: "#A1A1AA" }}>{line}</span>
                )}
              </div>
            </Beat>
          ))}
        </div>
      </div>

      {/* Headline Beats */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
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
              fontSize={b.type === "punch" ? 32 : 28}
            />
          </Beat>
        ))}
      </div>
    </div>
  );
};


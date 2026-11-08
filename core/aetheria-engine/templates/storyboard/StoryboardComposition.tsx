import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { RESOLVED_STORYBOARD } from "./resolvedData";
import { THEMES } from "./themes";
import { ResolvedScene, ThemePalette } from "./types";
import { HeroPhotoLayout } from "./layouts/HeroPhotoLayout";
import { HeadlineLayout } from "./layouts/HeadlineLayout";
import { StatLayout } from "./layouts/StatLayout";
import { ListLayout } from "./layouts/ListLayout";
import { TerminalLayout } from "./layouts/TerminalLayout";
import { CtaLayout } from "./layouts/CtaLayout";

const SceneRenderer: React.FC<{
  scene: ResolvedScene;
  totalScenes: number;
  palette: ThemePalette;
}> = ({ scene, totalScenes, palette }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localT = frame / fps;

  // Hard-cut camera flash at scene entrance (0.0s -> 0.09s)
  const flashAlpha = localT < 0.09 ? (1 - localT / 0.09) * 0.26 : 0;

  // Continuous camera push so no frame is ever static
  const camScale = 1 + (localT / Math.max(1, scene.durationSec)) * 0.04;
  const isDark = Boolean(scene.dark);
  const bg = isDark ? palette.bgDark : palette.bgLight;
  const hudColor = isDark ? "#F4F1EA" : "#18181B";

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bg,
        overflow: "hidden",
      }}
    >
      {/* Scaled 410x728.88 Mobile Poster Stage -> 1080x1920 */}
      <div
        style={{
          width: 410,
          height: 728.88,
          position: "absolute",
          left: 0,
          top: 0,
          transform: "scale(2.634146)",
          transformOrigin: "top left",
          overflow: "hidden",
          backgroundColor: bg,
        }}
      >
        {/* Architectural Tech Grid */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: isDark
              ? "linear-gradient(to right, rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.045) 1px, transparent 1px)"
              : "linear-gradient(to right, rgba(0,0,0,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.045) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            pointerEvents: "none",
          }}
        />

        {/* Subtle Film Grain Overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 50,
            opacity: 0.05,
            mixBlendMode: "overlay",
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Radial Editorial Vignette */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 40,
            background:
              "radial-gradient(circle at center, transparent 55%, rgba(0,0,0,0.22) 100%)",
          }}
        />

        {/* Hard-Cut Flash Overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 45,
            backgroundColor: "#FFFFFF",
            opacity: flashAlpha,
          }}
        />

        {/* Top Editorial HUD & Barcode */}
        <div
          style={{
            position: "absolute",
            top: 14,
            left: 16,
            right: 16,
            zIndex: 48,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            pointerEvents: "none",
            color: hudColor,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: palette.accent,
                boxShadow: `0 0 8px ${palette.accent}`,
              }}
            />
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 9,
                letterSpacing: "0.14em",
                fontWeight: 700,
                opacity: 0.8,
              }}
            >
              SCENE {String(scene.index).padStart(2, "0")}/
              {String(totalScenes).padStart(2, "0")}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
            }}
          >
            <svg width="70" height="18" viewBox="0 0 80 22" fill="currentColor">
              <rect x="0" y="0" width="3" height="22" />
              <rect x="5" y="0" width="1.5" height="22" />
              <rect x="9" y="0" width="4" height="22" />
              <rect x="16" y="0" width="2" height="22" />
              <rect x="20" y="0" width="1" height="22" />
              <rect x="24" y="0" width="5" height="22" />
              <rect x="31" y="0" width="2" height="22" />
              <rect x="36" y="0" width="3" height="22" />
              <rect x="41" y="0" width="1.5" height="22" />
              <rect x="45" y="0" width="4" height="22" />
              <rect x="52" y="0" width="2" height="22" />
              <rect x="56" y="0" width="4" height="22" />
              <rect x="63" y="0" width="1.5" height="22" />
              <rect x="67" y="0" width="3" height="22" />
              <rect x="73" y="0" width="2" height="22" />
              <rect x="77" y="0" width="3" height="22" />
            </svg>
            <span
              style={{
                fontSize: 7,
                fontFamily: "monospace",
                letterSpacing: "0.16em",
                marginTop: 2,
                opacity: 0.75,
              }}
            >
              {scene.tag || "AETHERIA-60FPS"}
            </span>
          </div>
        </div>

        {/* Camera-Drifted Scene Stage */}
        <div
          style={{
            width: "100%",
            height: "100%",
            transform: `scale(${camScale.toFixed(4)})`,
            transformOrigin: "center center",
          }}
        >
          {scene.layout === "hero-photo" && (
            <HeroPhotoLayout scene={scene} t={localT} palette={palette} />
          )}
          {scene.layout === "headline" && (
            <HeadlineLayout scene={scene} t={localT} palette={palette} />
          )}
          {scene.layout === "stat" && (
            <StatLayout scene={scene} t={localT} palette={palette} />
          )}
          {scene.layout === "list" && (
            <ListLayout scene={scene} t={localT} palette={palette} />
          )}
          {scene.layout === "terminal" && (
            <TerminalLayout scene={scene} t={localT} palette={palette} />
          )}
          {scene.layout === "cta" && (
            <CtaLayout scene={scene} t={localT} palette={palette} />
          )}
        </div>

        {/* Bottom Editorial Telemetry Bar */}
        <div
          style={{
            position: "absolute",
            bottom: 14,
            left: 16,
            right: 16,
            zIndex: 48,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            pointerEvents: "none",
            fontFamily: "monospace",
            fontSize: 8,
            color: hudColor,
            opacity: 0.85,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                border: "1px solid currentColor",
                padding: "1px 4px",
                borderRadius: 2,
                fontWeight: 700,
              }}
            >
              HD
            </span>
            <span
              style={{
                border: "1px solid currentColor",
                padding: "1px 4px",
                borderRadius: 2,
                fontWeight: 700,
              }}
            >
              60FPS
            </span>
            <span style={{ opacity: 0.75, lineHeight: 1.15 }}>
              AETHERIA MOTION ENGINE
              <br />
              WORD-LOCKED CHOREOGRAPHY
            </span>
          </div>
          <span
            style={{
              border: "1px solid currentColor",
              borderRadius: 999,
              padding: "1px 6px",
              fontWeight: 700,
            }}
          >
            4K
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const StoryboardComposition: React.FC = () => {
  const palette = THEMES[RESOLVED_STORYBOARD.style] || THEMES.editorial;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: palette.bgDark,
        fontFamily: palette.fontDisplay || "'Inter', system-ui, sans-serif",
      }}
    >
      {RESOLVED_STORYBOARD.audioFile && (
        <Audio src={staticFile(RESOLVED_STORYBOARD.audioFile)} />
      )}

      {RESOLVED_STORYBOARD.scenes.map((scene) => (
        <Sequence
          key={scene.id}
          from={scene.startFrame}
          durationInFrames={scene.durationInFrames}
        >
          <SceneRenderer
            scene={scene}
            totalScenes={RESOLVED_STORYBOARD.scenes.length}
            palette={palette}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

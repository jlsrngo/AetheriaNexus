import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { NexusVideoProps, buildCompositionLayers } from "./types";

const THEME_GRADIENTS: Record<
  string,
  { bg: string; accent: string; glow: string; border: string }
> = {
  orange: {
    bg: "radial-gradient(circle at 50% 20%, #7c2d12 0%, #431407 45%, #050b14 100%)",
    accent: "#f97316",
    glow: "rgba(249, 115, 22, 0.4)",
    border: "rgba(249, 115, 22, 0.6)",
  },
  indigo: {
    bg: "radial-gradient(circle at 50% 20%, #312e81 0%, #1e1b4b 45%, #050b14 100%)",
    accent: "#6366f1",
    glow: "rgba(99, 102, 241, 0.4)",
    border: "rgba(99, 102, 241, 0.6)",
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

function resolveThemePalette(themeColor?: string) {
  if (!themeColor) return THEME_GRADIENTS.orange;
  const key = themeColor.trim().toLowerCase();
  if (THEME_GRADIENTS[key]) return THEME_GRADIENTS[key];

  const hexMatch = key.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    const raw = hexMatch[1];
    const fullHex =
      raw.length === 3
        ? raw
            .split("")
            .map((ch) => ch + ch)
            .join("")
        : raw;
    const r = parseInt(fullHex.slice(0, 2), 16);
    const g = parseInt(fullHex.slice(2, 4), 16);
    const b = parseInt(fullHex.slice(4, 6), 16);
    const rMid = Math.round(r * 0.46);
    const gMid = Math.round(g * 0.46);
    const bMid = Math.round(b * 0.46);
    const rDark = Math.round(r * 0.22);
    const gDark = Math.round(g * 0.22);
    const bDark = Math.round(b * 0.22);
    return {
      bg: `radial-gradient(circle at 50% 20%, rgb(${rMid}, ${gMid}, ${bMid}) 0%, rgb(${rDark}, ${gDark}, ${bDark}) 45%, #050b14 100%)`,
      accent: `#${fullHex}`,
      glow: `rgba(${r}, ${g}, ${b}, 0.42)`,
      border: `rgba(${r}, ${g}, ${b}, 0.65)`,
    };
  }

  return THEME_GRADIENTS.orange;
}

const HookTitleAnimated: React.FC<{ hookText: string }> = ({ hookText }) => {
  const localFrame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const hookSpring = spring({
    frame: localFrame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });
  const hookOpacity = interpolate(localFrame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <h1
      style={{
        fontSize: "64px",
        lineHeight: 1.22,
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
  );
};

const BulletCardAnimated: React.FC<{
  line: string;
  accent: string;
}> = ({ line, accent }) => {
  const localFrame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardSpring = spring({
    frame: localFrame,
    fps,
    config: { damping: 14, stiffness: 120 },
  });
  const opacity = interpolate(localFrame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(cardSpring, [0, 1], [28, 0]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "20px",
        background: "rgba(10, 10, 10, 0.88)",
        border: "1px solid rgba(255, 255, 255, 0.15)",
        padding: "24px 32px",
        borderRadius: "0px",
        backdropFilter: "blur(16px)",
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <span
        style={{
          fontSize: "30px",
          fontWeight: 800,
          color: accent,
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
  );
};

export const NexusVideoComposition: React.FC<NexusVideoProps> = (props) => {
  const {
    hookText,
    bodyText,
    authorHandle,
    themeColor = "orange",
    category = "PRODUCTIVITY",
    subCategory = "EXECUTIVE HABITS",
    editorialTag = "NEXUS // EDITORIAL SHORT",
  } = props;

  const frame = useCurrentFrame();
  const { durationInFrames, height } = useVideoConfig();

  const layers = buildCompositionLayers(props, durationInFrames);
  const layerMap = new Map(layers.map((l) => [l.id, l]));

  const currentTheme = resolveThemePalette(themeColor);
  const bodyLines = (bodyText || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const bgShift = Math.sin(frame / 20) * 15;
  const isCompactHeight = height <= 1150;

  const bgBase = layerMap.get("bg-base");
  const bgOrb = layerMap.get("bg-orb-pattern");
  const bgGrid = layerMap.get("bg-grid-pattern");
  const hudCategory = layerMap.get("hud-category");
  const hudSubcategory = layerMap.get("hud-subcategory");
  const textHook = layerMap.get("text-hook");
  const footerIcon = layerMap.get("footer-icon");
  const footerAuthor = layerMap.get("footer-author");
  const footerTag = layerMap.get("footer-tag");

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#050b14",
        fontFamily: "Inter, 'Segoe UI', Roboto, sans-serif",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: isCompactHeight ? "72px 80px 72px 80px" : "120px 80px 180px 80px",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* LAYER: Background Radial Gradient Base */}
      {bgBase?.visible && (
        <Sequence
          from={bgBase.from}
          durationInFrames={bgBase.durationInFrames}
          name={bgBase.label}
        >
          <AbsoluteFill style={{ background: currentTheme.bg, zIndex: 0 }} />
        </Sequence>
      )}

      {/* LAYER: Corak Ambient Glow Orb */}
      {bgOrb?.visible && (
        <Sequence
          from={bgOrb.from}
          durationInFrames={bgOrb.durationInFrames}
          name={bgOrb.label}
        >
          <AbsoluteFill style={{ pointerEvents: "none", zIndex: 1 }}>
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
              }}
            />
          </AbsoluteFill>
        </Sequence>
      )}

      {/* LAYER: Corak Blueprint Grid */}
      {bgGrid?.visible && (
        <Sequence
          from={bgGrid.from}
          durationInFrames={bgGrid.durationInFrames}
          name={bgGrid.label}
        >
          <AbsoluteFill
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
              pointerEvents: "none",
              zIndex: 2,
            }}
          />
        </Sequence>
      )}

      {/* TOP ROW: Left Category Badge + Right SubCategory Label */}
      <div
        style={{
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: "52px",
        }}
      >
        <div>
          {hudCategory?.visible && (
            <Sequence
              layout="none"
              from={hudCategory.from}
              durationInFrames={hudCategory.durationInFrames}
              name={hudCategory.label}
            >
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
            </Sequence>
          )}
        </div>

        <div>
          {subCategory && hudSubcategory?.visible && (
            <Sequence
              layout="none"
              from={hudSubcategory.from}
              durationInFrames={hudSubcategory.durationInFrames}
              name={hudSubcategory.label}
            >
              <div
                style={{
                  fontSize: "18px",
                  fontWeight: 600,
                  color: "rgba(255, 255, 255, 0.55)",
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                }}
              >
                [ {subCategory} ]
              </div>
            </Sequence>
          )}
        </div>
      </div>

      {/* CENTER BODY: Hook Title Layer + Individual Bullet Point Layers */}
      <div
        style={{
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          gap: isCompactHeight ? "28px" : "40px",
        }}
      >
        {textHook?.visible && (
          <Sequence
            layout="none"
            from={textHook.from}
            durationInFrames={textHook.durationInFrames}
            name={textHook.label}
          >
            <HookTitleAnimated hookText={hookText} />
          </Sequence>
        )}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: isCompactHeight ? "16px" : "20px",
          }}
        >
          {bodyLines.map((line, idx) => {
            const bulletLayer = layerMap.get(`text-bullet-${idx}`);
            if (!bulletLayer || !bulletLayer.visible) return null;
            return (
              <Sequence
                key={bulletLayer.id}
                layout="none"
                from={bulletLayer.from}
                durationInFrames={bulletLayer.durationInFrames}
                name={bulletLayer.label}
              >
                <BulletCardAnimated line={line} accent={currentTheme.accent} />
              </Sequence>
            );
          })}

          {layers
            .filter((l) => l.isCustom && l.visible)
            .map((customLayer) => (
              <Sequence
                key={customLayer.id}
                layout="none"
                from={customLayer.from}
                durationInFrames={customLayer.durationInFrames}
                name={customLayer.label}
              >
                <BulletCardAnimated
                  line={customLayer.content || customLayer.label}
                  accent={currentTheme.accent}
                />
              </Sequence>
            ))}
        </div>
      </div>

      {/* BOTTOM ROW: Footer Icon Layer + Author Handle Layer + Editorial Tag Layer */}
      <div
        style={{
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: "1px solid rgba(255, 255, 255, 0.12)",
          paddingTop: "28px",
          minHeight: "82px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {footerIcon?.visible && (
            <Sequence
              layout="none"
              from={footerIcon.from}
              durationInFrames={footerIcon.durationInFrames}
              name={footerIcon.label}
            >
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
            </Sequence>
          )}

          {footerAuthor?.visible && (
            <Sequence
              layout="none"
              from={footerAuthor.from}
              durationInFrames={footerAuthor.durationInFrames}
              name={footerAuthor.label}
            >
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
                <div
                  style={{
                    fontSize: "17px",
                    color: "#94a3b8",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  Nexus Studio // Automated Production
                </div>
              </div>
            </Sequence>
          )}
        </div>

        <div>
          {footerTag?.visible && (
            <Sequence
              layout="none"
              from={footerTag.from}
              durationInFrames={footerTag.durationInFrames}
              name={footerTag.label}
            >
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
                {editorialTag}
              </div>
            </Sequence>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const TikTokVideo = NexusVideoComposition;

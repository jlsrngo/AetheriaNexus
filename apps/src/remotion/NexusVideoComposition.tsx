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

const BulletSequenceCard: React.FC<{
  line: string;
  accent: string;
  index: number;
  totalBullets: number;
}> = ({ line, accent, index }) => {
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
  const translateY = interpolate(cardSpring, [0, 1], [32, 0]);

  return (
    <div
      style={{
        position: "absolute",
        left: 80,
        right: 80,
        top: 660 + index * 165,
        display: "flex",
        alignItems: "flex-start",
        gap: "20px",
        background: "rgba(10, 10, 10, 0.88)",
        border: "1px solid rgba(255, 255, 255, 0.15)",
        padding: "24px 32px",
        backdropFilter: "blur(16px)",
        opacity,
        transform: `translateY(${translateY}px)`,
        zIndex: 12 + index,
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
  } = props;

  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const layers = buildCompositionLayers(props, durationInFrames);
  const layerMap = new Map(layers.map((l) => [l.id, l]));

  const currentTheme = THEME_GRADIENTS[themeColor] || THEME_GRADIENTS.orange;
  const bodyLines = (bodyText || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const bgShift = Math.sin(frame / 20) * 15;

  const bgBase = layerMap.get("bg-base");
  const bgOrb = layerMap.get("bg-orb-pattern");
  const bgGrid = layerMap.get("bg-grid-pattern");
  const hudCategory = layerMap.get("hud-category");
  const textHook = layerMap.get("text-hook");
  const footerIcon = layerMap.get("footer-icon");
  const footerAuthor = layerMap.get("footer-author");

  const hookLocalFrame = Math.max(0, frame - (textHook?.from ?? 5));
  const hookSpring = spring({
    frame: hookLocalFrame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });
  const hookOpacity = interpolate(hookLocalFrame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#050b14",
        fontFamily: "Inter, 'Segoe UI', Roboto, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* LAYER 1: Background Radial Base */}
      {bgBase?.visible && (
        <Sequence
          from={bgBase.from}
          durationInFrames={bgBase.durationInFrames}
          name={bgBase.label}
        >
          <AbsoluteFill style={{ background: currentTheme.bg }} />
        </Sequence>
      )}

      {/* LAYER 2: Corak Ambient Glow Orb */}
      {bgOrb?.visible && (
        <Sequence
          from={bgOrb.from}
          durationInFrames={bgOrb.durationInFrames}
          name={bgOrb.label}
        >
          <AbsoluteFill style={{ pointerEvents: "none" }}>
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

      {/* LAYER 3: Corak Blueprint Grid Pattern */}
      {bgGrid?.visible && (
        <Sequence
          from={bgGrid.from}
          durationInFrames={bgGrid.durationInFrames}
          name={bgGrid.label}
        >
          <AbsoluteFill
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.035) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
              pointerEvents: "none",
            }}
          />
        </Sequence>
      )}

      {/* LAYER 4: Top Header HUD Category Badge */}
      {hudCategory?.visible && (
        <Sequence
          from={hudCategory.from}
          durationInFrames={hudCategory.durationInFrames}
          name={hudCategory.label}
        >
          <div
            style={{
              position: "absolute",
              top: 120,
              left: 80,
              right: 80,
              zIndex: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "12px",
                background: "rgba(10, 10, 10, 0.75)",
                border: `1.5px solid ${currentTheme.border}`,
                padding: "10px 24px",
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
        </Sequence>
      )}

      {/* LAYER 5: Hook Title Text */}
      {textHook?.visible && (
        <Sequence
          from={textHook.from}
          durationInFrames={textHook.durationInFrames}
          name={textHook.label}
        >
          <div
            style={{
              position: "absolute",
              top: 390,
              left: 80,
              right: 80,
              zIndex: 11,
            }}
          >
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
          </div>
        </Sequence>
      )}

      {/* LAYERS 6..N: Individual Bullet Point Text Layers (1/1) */}
      {bodyLines.map((line, idx) => {
        const bulletLayer = layerMap.get(`text-bullet-${idx}`);
        if (!bulletLayer || !bulletLayer.visible) return null;
        return (
          <Sequence
            key={bulletLayer.id}
            from={bulletLayer.from}
            durationInFrames={bulletLayer.durationInFrames}
            name={bulletLayer.label}
          >
            <BulletSequenceCard
              line={line}
              accent={currentTheme.accent}
              index={idx}
              totalBullets={bodyLines.length}
            />
          </Sequence>
        );
      })}

      {/* LAYER N+1: Footer Icon (Bolt Badge) */}
      {footerIcon?.visible && (
        <Sequence
          from={footerIcon.from}
          durationInFrames={footerIcon.durationInFrames}
          name={footerIcon.label}
        >
          <div
            style={{
              position: "absolute",
              bottom: 180,
              left: 80,
              zIndex: 15,
              width: "52px",
              height: "52px",
              background: currentTheme.accent,
              color: "#000000",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "26px",
              fontWeight: 900,
            }}
          >
            ⚡
          </div>
        </Sequence>
      )}

      {/* LAYER N+2: Footer Author Handle & Editorial Tag */}
      {footerAuthor?.visible && (
        <Sequence
          from={footerAuthor.from}
          durationInFrames={footerAuthor.durationInFrames}
          name={footerAuthor.label}
        >
          <div
            style={{
              position: "absolute",
              bottom: 180,
              left: footerIcon?.visible ? 148 : 80,
              right: 80,
              zIndex: 15,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
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
              }}
            >
              NEXUS // EDITORIAL SHORT
            </div>
          </div>
        </Sequence>
      )}
    </AbsoluteFill>
  );
};

export const TikTokVideo = NexusVideoComposition;

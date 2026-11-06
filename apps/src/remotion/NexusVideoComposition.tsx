import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  NexusVideoProps,
  buildCompositionLayers,
  resolveColorToHex,
  COLOR_HEX_MAP,
} from "./types";

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
  blueprint: {
    bg: "radial-gradient(ellipse at 50% 25%, #0e4572 0%, #072847 48%, #031424 100%)",
    accent: "#00e5ff",
    glow: "rgba(0, 229, 255, 0.5)",
    border: "rgba(0, 229, 255, 0.8)",
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
  blue: {
    bg: "radial-gradient(circle at 50% 20%, #1e3a8a 0%, #172554 45%, #050b14 100%)",
    accent: "#3b82f6",
    glow: "rgba(59, 130, 246, 0.4)",
    border: "rgba(59, 130, 246, 0.6)",
  },
  sky: {
    bg: "radial-gradient(circle at 50% 20%, #075985 0%, #0c4a6e 45%, #050b14 100%)",
    accent: "#0ea5e9",
    glow: "rgba(14, 165, 233, 0.4)",
    border: "rgba(14, 165, 233, 0.6)",
  },
  pink: {
    bg: "radial-gradient(circle at 50% 20%, #831843 0%, #500724 45%, #050b14 100%)",
    accent: "#ec4899",
    glow: "rgba(236, 72, 153, 0.4)",
    border: "rgba(236, 72, 153, 0.6)",
  },
  fuchsia: {
    bg: "radial-gradient(circle at 50% 20%, #701a75 0%, #4a044e 45%, #050b14 100%)",
    accent: "#d946ef",
    glow: "rgba(217, 70, 239, 0.4)",
    border: "rgba(217, 70, 239, 0.6)",
  },
  purple: {
    bg: "radial-gradient(circle at 50% 20%, #581c87 0%, #3b0764 45%, #050b14 100%)",
    accent: "#a855f7",
    glow: "rgba(168, 85, 247, 0.4)",
    border: "rgba(168, 85, 247, 0.6)",
  },
  slate: {
    bg: "radial-gradient(circle at 50% 20%, #334155 0%, #1e293b 45%, #050b14 100%)",
    accent: "#64748b",
    glow: "rgba(100, 116, 139, 0.4)",
    border: "rgba(100, 116, 139, 0.6)",
  },
};

function resolveThemePalette(themeColor?: string) {
  if (!themeColor) return THEME_GRADIENTS.orange;
  const key = themeColor.trim().toLowerCase();
  if (THEME_GRADIENTS[key]) return THEME_GRADIENTS[key];

  const hexValue = COLOR_HEX_MAP[key] || (themeColor.trim().startsWith("#") ? themeColor.trim() : null);
  if (hexValue) {
    const hexMatch = hexValue.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
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
  }

  return THEME_GRADIENTS.orange;
}

const HookTitleAnimated: React.FC<{
  hookText: string;
  color?: string;
  textColor?: string;
  offset?: { x: number; y: number };
}> = ({ hookText, color, textColor, offset }) => {
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

  const offX = offset?.x || 0;
  const offY = offset?.y || 0;
  const titleHex = color ? resolveColorToHex(color, "#cbd5e1") : "#cbd5e1";
  const textHex = textColor ? resolveColorToHex(textColor, "#ffffff") : "#ffffff";

  return (
    <div
      data-nexus-layer-id="text-hook"
      data-nexus-layer-name="Hook Headline"
      style={{
        display: "inline-block",
        cursor: "pointer",
        transform: `translate3d(${offX}px, ${offY}px, 0)`,
      }}
    >
      <h1
        style={{
          fontSize: "64px",
          lineHeight: 1.22,
          fontWeight: 900,
          letterSpacing: "-1px",
          margin: 0,
          textShadow: `0 4px 30px rgba(0,0,0,0.8), 0 0 24px ${titleHex}40`,
          transform: `scale(${hookSpring})`,
          opacity: hookOpacity,
          background: `linear-gradient(180deg, ${textHex} 15%, ${titleHex} 100%)`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        {hookText}
      </h1>
    </div>
  );
};

const BulletCardAnimated: React.FC<{
  line: string;
  accent: string;
  color?: string;
  textColor?: string;
  cardBg?: string;
  layerId?: string;
  layerName?: string;
  offset?: { x: number; y: number };
}> = ({ line, accent, color, textColor, cardBg, layerId, layerName, offset }) => {
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

  const offX = offset?.x || 0;
  const offY = offset?.y || 0;
  const cardAccent = color ? resolveColorToHex(color, accent) : accent;
  const textCol = textColor
    ? resolveColorToHex(textColor, "#f1f5f9")
    : color
    ? resolveColorToHex(color, "#f1f5f9")
    : "#f1f5f9";
  const bgCol = cardBg
    ? cardBg === "transparent"
      ? "transparent"
      : cardBg === "solid"
      ? "#0a0a0c"
      : cardBg.startsWith("tint")
      ? `${cardAccent}1c`
      : cardBg.startsWith("#")
      ? cardBg
      : "rgba(10, 10, 10, 0.88)"
    : "rgba(10, 10, 10, 0.88)";

  return (
    <div
      data-nexus-layer-id={layerId}
      data-nexus-layer-name={layerName || "Bullet Card"}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "20px",
        background: bgCol,
        border: `1px solid ${cardAccent}50`,
        boxShadow: `0 0 25px ${cardAccent}1a`,
        padding: "24px 32px",
        borderRadius: "0px",
        backdropFilter: "blur(16px)",
        opacity,
        cursor: "pointer",
        transform: `translate3d(${offX}px, ${translateY + offY}px, 0)`,
      }}
    >
      <span
        style={{
          fontSize: "30px",
          fontWeight: 800,
          color: cardAccent,
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
          color: textCol,
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

  const layerColors = props.layerColors || {};
  const layerTextColors = props.layerTextColors || {};
  const layerBgColors = props.layerBgColors || {};
  const bgStyle = props.bgStyle || "radial";

  const getBgStyleCss = () => {
    const baseColorInput = layerBgColors["bg-base"] || layerColors["bg-base"];
    const baseHex = baseColorInput
      ? resolveColorToHex(baseColorInput)
      : currentTheme.accent;
    const pal = baseColorInput
      ? resolveThemePalette(baseColorInput)
      : currentTheme;

    switch (bgStyle) {
      case "linear":
        return `linear-gradient(180deg, ${baseHex}44 0%, #0a0f1d 55%, #050b14 100%)`;
      case "vignette":
        return `radial-gradient(ellipse at center, ${baseHex}48 0%, #070b14 65%, #000000 100%)`;
      case "solid":
        return baseColorInput ? `${baseHex}28` : "#0a0c14";
      case "cyberpunk":
        return `linear-gradient(135deg, ${baseHex}42 0%, #050b14 50%, #1e1b4b 100%)`;
      case "blueprint":
        return "radial-gradient(ellipse at 50% 25%, #0e4572 0%, #072847 48%, #031424 100%)";
      case "radial":
      default:
        return pal.bg;
    }
  };

  const currentTheme = resolveThemePalette(themeColor);
  const bodyLines = (bodyText || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const orbSize = props.orbSize ?? 600;
  const orbBlur = props.orbBlur ?? 140;
  const gridSize = props.gridSize ?? 40;
  const gridOpacity = props.gridOpacity ?? 0.22;
  const footerIconChar =
    props.footerIconChar ||
    (props.layerLabels?.["footer-icon"] &&
    props.layerLabels["footer-icon"].length <= 3
      ? props.layerLabels["footer-icon"]
      : "⚡");

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

  const offsets = props.layerOffsets || {};
  const getOffset = (id: string) => offsets[id] || { x: 0, y: 0 };
  const getOffsetStyle = (id: string): React.CSSProperties => {
    const off = getOffset(id);
    if (!off.x && !off.y) return {};
    return {
      transform: `translate3d(${off.x}px, ${off.y}px, 0)`,
    };
  };

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
          <AbsoluteFill
            style={{
              background: getBgStyleCss(),
              zIndex: 0,
            }}
          />
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
                width: `${orbSize}px`,
                height: `${orbSize}px`,
                background: layerColors["bg-orb-pattern"]
                  ? resolveThemePalette(layerColors["bg-orb-pattern"]).glow
                  : currentTheme.glow,
                filter: `blur(${orbBlur}px)`,
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
              backgroundImage: layerColors["bg-grid-pattern"]
                ? `linear-gradient(to right, ${resolveColorToHex(layerColors["bg-grid-pattern"])}${Math.max(16, Math.min(255, Math.round(gridOpacity * 255))).toString(16).padStart(2, "0")} 1px, transparent 1px), linear-gradient(to bottom, ${resolveColorToHex(layerColors["bg-grid-pattern"])}${Math.max(16, Math.min(255, Math.round(gridOpacity * 255))).toString(16).padStart(2, "0")} 1px, transparent 1px)`
                : `linear-gradient(to right, rgba(255,255,255,${gridOpacity}) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,${gridOpacity}) 1px, transparent 1px)`,
              backgroundSize: `${gridSize}px ${gridSize}px`,
              pointerEvents: "none",
              zIndex: 2,
            }}
          />
        </Sequence>
      )}

      {/* LAYER: Architectural Blueprint Overlay & Swiss Brutalist Technical HUD */}
      {(bgStyle === "blueprint" || themeColor === "blueprint") && (
        <AbsoluteFill style={{ pointerEvents: "none", zIndex: 3 }}>
          {/* Top Architectural Dimension Ruler */}
          <div
            style={{
              position: "absolute",
              top: "36px",
              left: "80px",
              right: "80px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: "1px dashed rgba(0, 229, 255, 0.4)",
              paddingTop: "6px",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "14px",
              color: "rgba(0, 229, 255, 0.75)",
              letterSpacing: "2px",
            }}
          >
            <span>|◄── SECTION A-A // ELEVATION 1080px</span>
            <span style={{ fontSize: "12px", opacity: 0.8 }}>SCALE 1:1 // SWISS ARCH-SPEC</span>
            <span>SPEC: MEMORY_SAFETY ──►|</span>
          </div>

          {/* Top-Right Technical Blueprint Stamp Box */}
          <div
            style={{
              position: "absolute",
              top: "72px",
              right: "80px",
              border: "1.5px solid rgba(0, 229, 255, 0.6)",
              padding: "8px 16px",
              background: "rgba(3, 20, 36, 0.85)",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "13px",
              color: "#00e5ff",
              lineHeight: 1.4,
              boxShadow: "0 0 15px rgba(0, 229, 255, 0.2)",
            }}
          >
            <div style={{ fontWeight: 800, letterSpacing: "1.5px" }}>DWG NO: RUST-SYS-2006</div>
            <div style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.7)" }}>PROJECT: THE SYSTEM IN LAYERS</div>
          </div>

          {/* Left Vertical Dimension Line */}
          <div
            style={{
              position: "absolute",
              left: "32px",
              top: "140px",
              bottom: "200px",
              width: "1px",
              borderLeft: "1px dashed rgba(0, 229, 255, 0.3)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              alignItems: "center",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "12px",
              color: "rgba(0, 229, 255, 0.6)",
            }}
          >
            <span style={{ transform: "rotate(-90deg)", transformOrigin: "center", whiteSpace: "nowrap" }}>
              ▲ 1920px HEIGHT
            </span>
            <span style={{ transform: "rotate(-90deg)", transformOrigin: "center", whiteSpace: "nowrap" }}>
              ▼ VERTICAL RATIO 9:16
            </span>
          </div>

          {/* 4 Corner Crosshairs */}
          <div style={{ position: "absolute", top: "24px", left: "24px", color: "#00e5ff", fontFamily: "monospace", fontSize: "16px" }}>+</div>
          <div style={{ position: "absolute", top: "24px", right: "24px", color: "#00e5ff", fontFamily: "monospace", fontSize: "16px" }}>+</div>
          <div style={{ position: "absolute", bottom: "24px", left: "24px", color: "#00e5ff", fontFamily: "monospace", fontSize: "16px" }}>+</div>
          <div style={{ position: "absolute", bottom: "24px", right: "24px", color: "#00e5ff", fontFamily: "monospace", fontSize: "16px" }}>+</div>
        </AbsoluteFill>
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
                data-nexus-layer-id="hud-category"
                data-nexus-layer-name="Category Badge"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "12px",
                  background: layerBgColors["hud-category"]
                    ? resolveColorToHex(layerBgColors["hud-category"])
                    : "rgba(10, 10, 10, 0.75)",
                  border: `1.5px solid ${layerColors["hud-category"] ? resolveThemePalette(layerColors["hud-category"]).border : currentTheme.border}`,
                  padding: "10px 24px",
                  borderRadius: "0px",
                  backdropFilter: "blur(20px)",
                  boxShadow: `0 0 25px ${layerColors["hud-category"] ? resolveThemePalette(layerColors["hud-category"]).glow : currentTheme.glow}`,
                  cursor: "pointer",
                  ...getOffsetStyle("hud-category"),
                }}
              >
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    background: layerColors["hud-category"] ? resolveColorToHex(layerColors["hud-category"]) : currentTheme.accent,
                  }}
                />
                <span
                  style={{
                    fontSize: "22px",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "3px",
                    color: layerTextColors["hud-category"]
                      ? resolveColorToHex(layerTextColors["hud-category"])
                      : "#f8fafc",
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
                data-nexus-layer-id="hud-subcategory"
                data-nexus-layer-name="Subcategory Label"
                style={{
                  fontSize: "18px",
                  fontWeight: 600,
                  color: layerTextColors["hud-subcategory"]
                    ? resolveColorToHex(layerTextColors["hud-subcategory"])
                    : layerColors["hud-subcategory"]
                    ? resolveColorToHex(layerColors["hud-subcategory"])
                    : "rgba(255, 255, 255, 0.55)",
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  ...getOffsetStyle("hud-subcategory"),
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
            <HookTitleAnimated
              hookText={hookText}
              color={layerColors["text-hook"]}
              textColor={layerTextColors["text-hook"]}
              offset={getOffset("text-hook")}
            />
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
                <BulletCardAnimated
                  line={line}
                  accent={currentTheme.accent}
                  color={layerColors[bulletLayer.id]}
                  textColor={layerTextColors[bulletLayer.id]}
                  cardBg={layerBgColors[bulletLayer.id]}
                  layerId={bulletLayer.id}
                  layerName={`Bullet #${idx + 1}`}
                  offset={getOffset(bulletLayer.id)}
                />
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
                  color={layerColors[customLayer.id] || customLayer.color}
                  textColor={layerTextColors[customLayer.id]}
                  cardBg={layerBgColors[customLayer.id]}
                  layerId={customLayer.id}
                  layerName={customLayer.label}
                  offset={getOffset(customLayer.id)}
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
                data-nexus-layer-id="footer-icon"
                data-nexus-layer-name="Footer Icon"
                style={{
                  width: "52px",
                  height: "52px",
                  background: layerColors["footer-icon"] ? resolveColorToHex(layerColors["footer-icon"]) : currentTheme.accent,
                  color: "#000000",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "26px",
                  fontWeight: 900,
                  borderRadius: "0px",
                  boxShadow: `0 0 20px ${layerColors["footer-icon"] ? resolveThemePalette(layerColors["footer-icon"]).glow : currentTheme.glow}`,
                  cursor: "pointer",
                  ...getOffsetStyle("footer-icon"),
                }}
              >
                {footerIconChar}
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
              <div
                data-nexus-layer-id="footer-author"
                data-nexus-layer-name="Author Handle"
                style={{
                  cursor: "pointer",
                  ...getOffsetStyle("footer-author"),
                }}
              >
                <div
                  style={{
                    fontSize: "26px",
                    fontWeight: 800,
                    color: layerTextColors["footer-author"]
                      ? resolveColorToHex(layerTextColors["footer-author"])
                      : layerColors["footer-author"]
                      ? resolveColorToHex(layerColors["footer-author"])
                      : "#ffffff",
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
                data-nexus-layer-id="footer-tag"
                data-nexus-layer-name="Editorial Badge"
                style={{
                  fontSize: "18px",
                  fontWeight: 800,
                  color: layerTextColors["footer-tag"]
                    ? resolveColorToHex(layerTextColors["footer-tag"])
                    : layerColors["footer-tag"]
                    ? resolveColorToHex(layerColors["footer-tag"])
                    : currentTheme.accent,
                  border: `1px solid ${layerColors["footer-tag"] ? resolveThemePalette(layerColors["footer-tag"]).border : currentTheme.border}`,
                  boxShadow: layerColors["footer-tag"] ? `0 0 15px ${resolveThemePalette(layerColors["footer-tag"]).glow}` : undefined,
                  background: layerBgColors["footer-tag"]
                    ? resolveColorToHex(layerBgColors["footer-tag"])
                    : "rgba(10, 10, 10, 0.6)",
                  padding: "8px 20px",
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: "2px",
                  borderRadius: "0px",
                  cursor: "pointer",
                  ...getOffsetStyle("footer-tag"),
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

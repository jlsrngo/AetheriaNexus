import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

export type BackgroundStyle =
  | "mesh"
  | "aurora"
  | "cyber-grid"
  | "dot-matrix"
  | "radial-glow"
  | "stock-media";

export interface BackgroundEngineProps {
  type?: BackgroundStyle;
  primaryColor?: string;
  accentColor?: string;
  secondaryColor?: string;
  mediaSrc?: string;
  mediaType?: "image" | "video";
  intensity?: number;
  vignette?: boolean;
  style?: React.CSSProperties;
}

/**
 * 1. Aurora Glow Background: Organic glowing orbs undulating across the frame.
 */
export const AuroraBackground: React.FC<{
  primaryColor?: string;
  accentColor?: string;
  secondaryColor?: string;
  intensity?: number;
}> = ({
  primaryColor = "#064E3B",
  accentColor = "#10B981",
  secondaryColor = "#022C22",
  intensity = 0.6,
}) => {
  const frame = useCurrentFrame();

  const orb1X = Math.sin(frame / 60) * 120;
  const orb1Y = Math.cos(frame / 45) * 150;
  const orb2X = Math.cos(frame / 50) * 160;
  const orb2Y = Math.sin(frame / 70) * 130;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0A0A0C",
        overflow: "hidden",
      }}
    >
      {/* Base deep background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 50% 30%, ${secondaryColor} 0%, #070709 85%)`,
        }}
      />

      {/* Primary Aurora Orb */}
      <div
        style={{
          position: "absolute",
          left: `calc(40% + ${orb1X}px)`,
          top: `calc(25% + ${orb1Y}px)`,
          width: 700,
          height: 700,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accentColor} 0%, transparent 65%)`,
          filter: "blur(90px)",
          opacity: 0.45 * intensity,
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* Secondary Counter Orb */}
      <div
        style={{
          position: "absolute",
          left: `calc(60% + ${orb2X}px)`,
          top: `calc(65% + ${orb2Y}px)`,
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${primaryColor} 0%, transparent 65%)`,
          filter: "blur(80px)",
          opacity: 0.5 * intensity,
          transform: "translate(-50%, -50%)",
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * 2. Cyber Perspective Grid: Infinite tactical grid lines with breathing horizon glow.
 */
export const CyberGridBackground: React.FC<{
  accentColor?: string;
  gridSize?: number;
}> = ({ accentColor = "#10B981", gridSize = 48 }) => {
  const frame = useCurrentFrame();
  const offset = (frame * 1.5) % gridSize;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#08080A",
        overflow: "hidden",
      }}
    >
      {/* Top ambient glow */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "40%",
          background: `radial-gradient(ellipse at 50% 0%, ${accentColor}33 0%, transparent 70%)`,
          filter: "blur(40px)",
        }}
      />

      {/* Perspective Grid Floor */}
      <div
        style={{
          position: "absolute",
          inset: "-50% -20% 0 -20%",
          perspective: 600,
          transformStyle: "preserve-3d",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: "rotateX(68deg)",
            transformOrigin: "center 70%",
            backgroundImage: `
              linear-gradient(to right, ${accentColor}22 1px, transparent 1px),
              linear-gradient(to bottom, ${accentColor}22 1px, transparent 1px)
            `,
            backgroundSize: `${gridSize}px ${gridSize}px`,
            backgroundPosition: `0px ${offset}px`,
            maskImage: "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 80%)",
            WebkitMaskImage: "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 80%)",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

/**
 * 3. Dot Matrix / Blueprint Background: Clean technical grid dots with subtle pulse.
 */
export const DotMatrixBackground: React.FC<{
  accentColor?: string;
  spacing?: number;
}> = ({ accentColor = "#FAFAFA", spacing = 36 }) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0A0A0D",
        backgroundImage: `radial-gradient(${accentColor}22 1.5px, transparent 1.5px)`,
        backgroundSize: `${spacing}px ${spacing}px`,
      }}
    >
      {/* Vignette Overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(circle at 50% 50%, transparent 35%, rgba(10,10,13,0.95) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * 4. Stock Media Background: Video/image with slow Ken Burns drift, dark tint, and grain.
 */
export const StockMediaBackground: React.FC<{
  mediaSrc: string;
  mediaType?: "image" | "video";
  zoomScale?: number;
  dimOpacity?: number;
}> = ({
  mediaSrc,
  zoomScale = 1.08,
  dimOpacity = 0.65,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = frame / Math.max(1, durationInFrames);
  const scale = 1 + (zoomScale - 1) * progress;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: "-5%",
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        <img
          src={mediaSrc}
          alt="Stock Background"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "brightness(0.9) contrast(1.1)",
          }}
        />
      </div>

      {/* Dim Overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: `rgba(10, 10, 12, ${dimOpacity})`,
        }}
      />

      {/* Cinematic Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(circle at 50% 50%, transparent 40%, rgba(0,0,0,0.85) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * Universal Smart Background Engine component.
 */
export const SmartBackground: React.FC<BackgroundEngineProps> = ({
  type = "aurora",
  primaryColor = "#064E3B",
  accentColor = "#10B981",
  secondaryColor = "#022C22",
  mediaSrc,
  mediaType = "image",
  intensity = 0.7,
  vignette = true,
  style = {},
}) => {
  return (
    <AbsoluteFill style={style}>
      {type === "aurora" && (
        <AuroraBackground
          primaryColor={primaryColor}
          accentColor={accentColor}
          secondaryColor={secondaryColor}
          intensity={intensity}
        />
      )}

      {type === "cyber-grid" && (
        <CyberGridBackground accentColor={accentColor} />
      )}

      {type === "dot-matrix" && (
        <DotMatrixBackground accentColor={accentColor} />
      )}

      {type === "stock-media" && mediaSrc && (
        <StockMediaBackground mediaSrc={mediaSrc} mediaType={mediaType} />
      )}

      {type === "radial-glow" && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle at 50% 25%, ${primaryColor} 0%, ${secondaryColor} 50%, #060608 100%)`,
          }}
        />
      )}

      {vignette && type !== "stock-media" && type !== "dot-matrix" && (
        <AbsoluteFill
          style={{
            background: "radial-gradient(circle at 50% 50%, transparent 45%, rgba(6,6,8,0.75) 100%)",
            pointerEvents: "none",
          }}
        />
      )}
    </AbsoluteFill>
  );
};

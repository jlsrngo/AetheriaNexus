import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { spr, stagger, TIKTOK_SAFE_INSETS } from "./anim";

export interface KineticTextProps {
  /** The text string. Put asterisks around words you want highlighted in accent color, e.g. "Ini cara *otomatisasi* video" */
  text: string;
  from?: number;
  staggerFrames?: number;
  fontSize?: number;
  color?: string;
  accentColor?: string;
  align?: "left" | "center" | "right";
  fontWeight?: number | string;
  lineHeight?: number;
  maxWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * High-retention Kinetic Typography component.
 * Words rise smoothly out of subtle blur one-by-one.
 * Words surrounded by *asterisks* receive the vibrant accent color automatically.
 */
export const KineticText: React.FC<KineticTextProps> = ({
  text,
  from = 0,
  staggerFrames = 4,
  fontSize = 54,
  color = "#FAFAFA",
  accentColor = "#10B981",
  align = "center",
  fontWeight = 800,
  lineHeight = 1.25,
  maxWidth = 1080 - TIKTOK_SAFE_INSETS.left - TIKTOK_SAFE_INSETS.right,
  className = "",
  style = {},
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Split text by spaces while preserving tokens
  const words = text.split(/\s+/).filter(Boolean);

  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent:
          align === "center"
            ? "center"
            : align === "right"
            ? "flex-end"
            : "flex-start",
        maxWidth,
        lineHeight,
        ...style,
      }}
    >
      {words.map((rawWord, i) => {
        const isAccent = rawWord.startsWith("*") && rawWord.endsWith("*");
        const cleanWord = isAccent ? rawWord.slice(1, -1) : rawWord;
        const wordStart = stagger(i, from, staggerFrames);
        const progress = spr(frame, wordStart, fps, "text");

        const translateY = interpolate(progress, [0, 1], [24, 0]);
        const opacity = interpolate(progress, [0, 1], [0, 1]);
        const blur = interpolate(progress, [0, 1], [8, 0]);
        const scale = interpolate(progress, [0, 1], [0.95, 1]);

        return (
          <span
            key={`${cleanWord}-${i}`}
            style={{
              display: "inline-block",
              margin: `0 ${fontSize * 0.16}px ${fontSize * 0.12}px 0`,
              fontSize,
              fontWeight,
              color: isAccent ? accentColor : color,
              transform: `translateY(${translateY}px) scale(${scale})`,
              opacity,
              filter: blur > 0.1 ? `blur(${blur}px)` : undefined,
              textShadow: isAccent
                ? `0 0 24px ${accentColor}44, 0 4px 12px rgba(0,0,0,0.6)`
                : "0 4px 16px rgba(0,0,0,0.7)",
              fontFamily: "Inter, system-ui, -apple-system, sans-serif",
              letterSpacing: "-0.02em",
            }}
          >
            {cleanWord}
          </span>
        );
      })}
    </div>
  );
};

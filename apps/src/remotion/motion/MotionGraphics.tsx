import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { spr, ramp } from "./anim";

/**
 * Animated Number Counter for stats, proofs, and metrics.
 */
export interface CounterProps {
  fromValue?: number;
  toValue: number;
  from?: number;
  durationFrames?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  color?: string;
  fontSize?: number;
  style?: React.CSSProperties;
}

export const Counter: React.FC<CounterProps> = ({
  fromValue = 0,
  toValue,
  from = 0,
  durationFrames = 24,
  prefix = "",
  suffix = "",
  decimals = 0,
  color = "#FAFAFA",
  fontSize = 64,
  style = {},
}) => {
  const frame = useCurrentFrame();
  const progress = ramp(frame, from, durationFrames);
  const currentValue = fromValue + (toValue - fromValue) * progress;
  const formatted = decimals > 0 ? currentValue.toFixed(decimals) : Math.round(currentValue).toLocaleString();

  return (
    <span
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize,
        fontWeight: 800,
        color,
        letterSpacing: "-0.03em",
        ...style,
      }}
    >
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};

/**
 * Animated UI Card with rise, subtle 3D tilt, and frosted glass finish.
 */
export interface AnimatedCardProps {
  children: React.ReactNode;
  from?: number;
  borderColor?: string;
  backgroundColor?: string;
  padding?: string | number;
  borderRadius?: number;
  tiltAngle?: number;
  style?: React.CSSProperties;
}

export const AnimatedCard: React.FC<AnimatedCardProps> = ({
  children,
  from = 0,
  borderColor = "#26262C",
  backgroundColor = "rgba(18, 18, 21, 0.85)",
  padding = "24px 32px",
  borderRadius = 16,
  tiltAngle = 4,
  style = {},
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spr(frame, from, fps, "card");

  const translateY = interpolate(progress, [0, 1], [40, 0]);
  const rotateX = interpolate(progress, [0, 1], [tiltAngle, 0]);
  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const scale = interpolate(progress, [0, 1], [0.94, 1]);

  return (
    <div
      style={{
        backgroundColor,
        border: `1px solid ${borderColor}`,
        borderRadius,
        padding,
        backdropFilter: "blur(20px)",
        transform: `perspective(1000px) translateY(${translateY}px) rotateX(${rotateX}deg) scale(${scale})`,
        opacity,
        boxShadow: "0 20px 40px -15px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05)",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/**
 * Badge Pill for tags, categories, or status badges.
 */
export interface BadgePillProps {
  label: string;
  from?: number;
  icon?: React.ReactNode;
  accentColor?: string;
  style?: React.CSSProperties;
}

export const BadgePill: React.FC<BadgePillProps> = ({
  label,
  from = 0,
  icon,
  accentColor = "#10B981",
  style = {},
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spr(frame, from, fps, "snappy");

  const scale = interpolate(progress, [0, 1], [0.8, 1]);
  const opacity = interpolate(progress, [0, 1], [0, 1]);

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 18px",
        borderRadius: 999,
        backgroundColor: "rgba(26, 26, 31, 0.9)",
        border: `1px solid ${accentColor}44`,
        color: "#FAFAFA",
        fontSize: 16,
        fontWeight: 600,
        fontFamily: "Inter, sans-serif",
        transform: `scale(${scale})`,
        opacity,
        boxShadow: `0 0 16px ${accentColor}22`,
        ...style,
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          backgroundColor: accentColor,
          boxShadow: `0 0 8px ${accentColor}`,
        }}
      />
      {icon}
      <span>{label}</span>
    </div>
  );
};

/**
 * Animated Strike-Through text for the "Myth vs Fact" pattern.
 */
export interface StrikeTextProps {
  text: string;
  from?: number;
  strikeAt?: number;
  strikeColor?: string;
  style?: React.CSSProperties;
}

export const StrikeText: React.FC<StrikeTextProps> = ({
  text,
  from = 0,
  strikeAt = 15,
  strikeColor = "#F43F5E",
  style = {},
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const textProgress = spr(frame, from, fps, "text");
  const strikeProgress = ramp(frame, strikeAt, 10);

  return (
    <span
      style={{
        position: "relative",
        display: "inline-block",
        opacity: interpolate(textProgress, [0, 1], [0, 1]),
        color: frame >= strikeAt ? "#8E8E98" : "#FAFAFA",
        transition: "color 0.2s ease",
        ...style,
      }}
    >
      {text}
      {strikeProgress > 0 && (
        <span
          style={{
            position: "absolute",
            left: 0,
            top: "50%",
            width: `${strikeProgress * 100}%`,
            height: 4,
            backgroundColor: strikeColor,
            borderRadius: 2,
            boxShadow: `0 0 8px ${strikeColor}88`,
            transform: "translateY(-50%) rotate(-2deg)",
            transformOrigin: "left center",
          }}
        />
      )}
    </span>
  );
};

/**
 * Camera Motion Wrapper: adds slow continuous drift and punch-in
 * to keep frames active and engaging without disorientation.
 */
export const CameraMotion: React.FC<{
  children: React.ReactNode;
  zoomScale?: number;
  durationFrames?: number;
}> = ({ children, zoomScale = 1.05, durationFrames = 120 }) => {
  const frame = useCurrentFrame();
  const progress = frame / Math.max(1, durationFrames);
  const scale = 1 + (zoomScale - 1) * Math.min(1, progress);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        transform: `scale(${scale})`,
        transformOrigin: "center center",
      }}
    >
      {children}
    </div>
  );
};

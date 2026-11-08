import React from "react";

export function clamp(val: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, val));
}

export function progress(t: number, start: number, end: number): number {
  if (end <= start) return t >= start ? 1 : 0;
  return clamp((t - start) / (end - start), 0, 1);
}

export function easeOutExpo(x: number): number {
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

export function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

export interface MotionWordProps {
  t: number;
  start: number;
  duration?: number;
  spring?: boolean;
  fromY?: number;
  fromScale?: number;
  blur?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export const MotionWord: React.FC<MotionWordProps> = ({
  t,
  start,
  duration = 0.38,
  spring = false,
  fromY = 24,
  fromScale = 0.74,
  blur = 6,
  style = {},
  children,
}) => {
  const p = progress(t, start, start + duration);
  const eased = spring ? easeOutBack(p) : easeOutExpo(p);
  const y = (1 - eased) * fromY;
  const scale = fromScale + eased * (1 - fromScale);
  const currentBlur = (1 - p) * blur;
  const opacity = clamp(p * 2.2, 0, 1);

  return (
    <span
      style={{
        display: "inline-block",
        willChange: "transform, opacity, filter",
        transformOrigin: "center center",
        opacity,
        transform: `translate3d(0, ${y.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`,
        filter: currentBlur > 0.3 ? `blur(${currentBlur.toFixed(1)}px)` : "none",
        ...style,
      }}
    >
      {children}
    </span>
  );
};

export interface BeatProps {
  t: number;
  startSec: number;
  endSec?: number;
  spring?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * Deterministic <Beat> container: enters smoothly at `startSec` and automatically
 * exits (fades + slides up) if `endSec` is reached, preventing element pile-up.
 */
export const Beat: React.FC<BeatProps> = ({
  t,
  startSec,
  endSec,
  spring = true,
  style = {},
  children,
}) => {
  const enterP = progress(t, startSec, startSec + 0.42);
  const enterEased = spring ? easeOutBack(enterP) : easeOutExpo(enterP);

  const exitP =
    endSec !== undefined && endSec > startSec
      ? progress(t, endSec - 0.28, endSec)
      : 0;
  const exitEased = easeOutExpo(exitP);

  if (exitP >= 1) return null;

  const opacity = clamp(enterP * 2.2, 0, 1) * (1 - exitEased);
  const y = (1 - enterEased) * 26 - exitEased * 22;
  const scale = (0.82 + enterEased * 0.18) * (1 - exitEased * 0.08);

  return (
    <div
      style={{
        opacity,
        transform: `translate3d(0, ${y.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`,
        willChange: "transform, opacity",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/**
 * Renders text with optional highlighted accent word/phrase and word-by-word stagger.
 */
export const HighlightedHeadline: React.FC<{
  t: number;
  startSec: number;
  text: string;
  accent?: string;
  accentColor: string;
  textColor: string;
  fontSize?: number;
}> = ({ t, startSec, text, accent, accentColor, textColor, fontSize = 31 }) => {
  const words = text.split(/\s+/).filter(Boolean);
  const accentLower = accent?.toLowerCase().trim() || "";

  return (
    <div
      style={{
        fontSize,
        fontWeight: 800,
        letterSpacing: "-0.04em",
        lineHeight: 1.08,
        textAlign: "center",
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "6px 8px",
      }}
    >
      {words.map((w, idx) => {
        const cleanW = w.toLowerCase().replace(/[^a-z0-9+#]/gi, "");
        const isAccent =
          accentLower.length > 0 &&
          (accentLower.includes(cleanW) || cleanW.includes(accentLower));
        return (
          <MotionWord
            key={idx}
            t={t}
            start={startSec + idx * 0.1}
            spring={isAccent}
            fromScale={isAccent ? 0.55 : 0.78}
            style={{
              color: isAccent ? accentColor : textColor,
              fontWeight: isAccent ? 900 : 800,
            }}
          >
            {w}
          </MotionWord>
        );
      })}
    </div>
  );
};


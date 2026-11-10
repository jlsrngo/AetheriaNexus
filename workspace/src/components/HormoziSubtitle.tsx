/**
 * HormoziSubtitle.tsx
 * Speech-synced word-by-word subtitle renderer for /mg-cutout-collage.
 *
 * Shows 3–4 words at a time (sliding window). Active word pops to 1.18× scale
 * in lemon yellow #FFDE59 then springs back to 1.0×.
 *
 * Usage:
 *   <HormoziSubtitle words={words} fps={30} />
 *   where words = Array<{ word: string; start: number; end: number }> (seconds)
 */
import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";

export interface WordTiming {
  word: string;
  start: number; // seconds (from scene start)
  end: number;   // seconds
}

interface HormoziSubtitleProps {
  words: WordTiming[];
  /** Max words visible per line window (default 4) */
  windowSize?: number;
  /** Font size in px (default 68) */
  fontSize?: number;
  /** Text color (default white) */
  color?: string;
  /** Active word highlight color (default lemon yellow) */
  activeColor?: string;
  /** Bottom offset from scene bottom (default 240) */
  bottomOffset?: number;
}

export const HormoziSubtitle: React.FC<HormoziSubtitleProps> = ({
  words,
  windowSize = 4,
  fontSize = 68,
  color = "#FFFFFF",
  activeColor = "#FFDE59",
  bottomOffset = 240,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const timeSec = frame / fps;

  if (!words || words.length === 0) return null;

  // Find currently spoken word index
  const activeIdx = words.findIndex(
    (w) => timeSec >= w.start && timeSec < w.end
  );

  // Determine window: center window around active word
  let windowStart = 0;
  if (activeIdx >= 0) {
    windowStart = Math.max(0, activeIdx - Math.floor(windowSize / 2));
    windowStart = Math.min(windowStart, Math.max(0, words.length - windowSize));
  } else if (timeSec >= (words[words.length - 1]?.end ?? 0)) {
    // After last word — show tail
    windowStart = Math.max(0, words.length - windowSize);
  }

  const visibleWords = words.slice(windowStart, windowStart + windowSize);

  return (
    <div
      style={{
        position: "absolute",
        bottom: bottomOffset,
        left: 0,
        right: 0,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "center",
        gap: "0.18em",
        padding: "0 60px",
        zIndex: 100,
      }}
    >
      {visibleWords.map((w, i) => {
        const globalIdx = windowStart + i;
        const isActive = globalIdx === activeIdx;

        // Spring pop: scale 1.18 → 1.0 when word becomes active
        const popFrame = isActive
          ? frame - Math.round(w.start * fps)
          : 0;
        const popScale = isActive
          ? interpolate(
              spring({ frame: Math.max(0, popFrame), fps, config: { damping: 11, mass: 0.5, stiffness: 240 } }),
              [0, 1],
              [1.18, 1.0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            )
          : 1.0;

        return (
          <span
            key={`${globalIdx}-${w.word}`}
            style={{
              display: "inline-block",
              fontSize,
              fontFamily: "'Impact', 'Arial Black', 'Franklin Gothic Heavy', sans-serif",
              fontWeight: 900,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              color: isActive ? activeColor : color,
              textShadow: "0 3px 10px rgba(0,0,0,0.9), 0 1px 3px rgba(0,0,0,0.8)",
              transform: `scale(${popScale})`,
              transformOrigin: "center bottom",
              textTransform: "uppercase",
              // Faint paper-cutout outline on each word
              WebkitTextStroke: isActive ? "1.5px rgba(0,0,0,0.3)" : "1px rgba(0,0,0,0.2)",
            }}
          >
            {w.word}
          </span>
        );
      })}
    </div>
  );
};

// ─── Static word builder ─────────────────────────────────────────────────────
/**
 * Builds uniform WordTiming[] from a plain string when no .words.json is available.
 * Distributes evenly across the given scene duration in seconds.
 */
export function buildWordsFromScript(
  script: string,
  durationSec: number,
  startOffsetSec = 0
): WordTiming[] {
  const rawWords = script.trim().split(/\s+/);
  const wordDuration = durationSec / rawWords.length;
  return rawWords.map((word, i) => ({
    word,
    start: startOffsetSec + i * wordDuration,
    end: startOffsetSec + (i + 1) * wordDuration,
  }));
}

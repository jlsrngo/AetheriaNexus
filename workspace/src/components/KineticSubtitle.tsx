import React from "react";
import { interpolate, spring, useCurrentFrame } from "remotion";

export interface WordTiming {
  word: string;
  start: number;
  end: number;
}

interface KineticSubtitleProps {
  words: WordTiming[];
  windowSize?: number; // max words visible at once (default 5)
  fps?: number;
}

/**
 * Speech-synced sliding-window subtitle.
 * Shows up to `windowSize` words at a time — never overflows vertical 9:16.
 * Active (spoken) word is highlighted in amber; past words are dim white.
 */
export const KineticSubtitle: React.FC<KineticSubtitleProps> = ({
  words,
  windowSize = 5,
  fps = 30,
}) => {
  const frame = useCurrentFrame();
  const currentSec = frame / fps;

  // Find the index of the word currently being spoken
  let activeIdx = -1;
  for (let i = 0; i < words.length; i++) {
    if (currentSec >= words[i].start && currentSec <= words[i].end + 0.15) {
      activeIdx = i;
    }
  }
  // If no active word yet use first; if past the end use last
  if (activeIdx === -1) {
    activeIdx = currentSec < words[0].start ? 0 : words.length - 1;
  }

  // Sliding window: centre window around activeIdx
  const half = Math.floor(windowSize / 2);
  let winStart = Math.max(0, activeIdx - half);
  let winEnd = Math.min(words.length - 1, winStart + windowSize - 1);
  // Clamp winStart so window doesn't exceed bounds
  winStart = Math.max(0, winEnd - windowSize + 1);

  const visibleWords = words.slice(winStart, winEnd + 1);

  // Panel slide-up spring when window shifts
  const panelSpr = spring({
    frame: Math.max(0, frame - 2),
    fps,
    config: { damping: 18, stiffness: 100 },
  });
  const panelY = interpolate(panelSpr, [0, 1], [20, 0]);
  const panelOpacity = interpolate(panelSpr, [0, 1], [0, 1]);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 100,
        left: 40,
        right: 40,
        display: "flex",
        flexWrap: "wrap",
        gap: "0 10px",
        justifyContent: "center",
        alignItems: "flex-end",
        transform: `translateY(${panelY}px)`,
        opacity: panelOpacity,
        zIndex: 100,
        // Frosted glass pill background
        background: "rgba(0,0,0,0.65)",
        borderRadius: 20,
        padding: "18px 28px",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        border: "1px solid rgba(255,180,50,0.18)",
      }}
    >
      {visibleWords.map((w, i) => {
        const globalIdx = winStart + i;
        const isActive = globalIdx === activeIdx;
        const isPast = globalIdx < activeIdx;

        const wordFrame = Math.max(0, frame - Math.round(w.start * fps));
        const wordSpr = spring({
          frame: wordFrame,
          fps,
          config: { damping: 14, stiffness: 120 },
        });
        const scale = interpolate(wordSpr, [0, 1], [0.7, 1]);
        const opacity = isPast ? 0.45 : isActive ? 1 : 0.8;
        const color = isActive ? "#F5A623" : "#FFFFFF";
        const textShadow = isActive
          ? "0 0 12px rgba(245,166,35,0.9), 0 2px 8px rgba(0,0,0,0.9)"
          : "0 2px 6px rgba(0,0,0,0.9)";

        return (
          <span
            key={globalIdx}
            style={{
              fontSize: 52,
              fontFamily: "'Special Elite', 'Courier New', monospace",
              fontWeight: 700,
              lineHeight: 1.25,
              color,
              textShadow,
              transform: `scale(${scale})`,
              display: "inline-block",
              transformOrigin: "center bottom",
              letterSpacing: isActive ? "0.04em" : "0.01em",
              transition: "color 0.1s",
            }}
          >
            {w.word}
          </span>
        );
      })}
    </div>
  );
};

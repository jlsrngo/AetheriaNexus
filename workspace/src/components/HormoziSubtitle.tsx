import React, { useMemo } from "react";
import { spring, useCurrentFrame } from "remotion";
import { WordTiming } from "./KineticSubtitle";

interface HormoziSubtitleProps {
  words: WordTiming[];
  top?: number;
  highlightColor?: string;
  maxWordsPerChunk?: number;
}

export const HormoziSubtitle: React.FC<HormoziSubtitleProps> = ({
  words,
  top = 1380,
  highlightColor = "#FFDE59", // Hormozi Signature High-Contrast Lemon Yellow
  maxWordsPerChunk = 4,
}) => {
  const frame = useCurrentFrame();
  const currentTimeSec = frame / 30;

  // Find the currently active word
  const activeIndex = useMemo(() => {
    return words.findIndex(
      (w) => currentTimeSec >= w.start && currentTimeSec < w.end
    );
  }, [words, currentTimeSec]);

  // Determine current window / chunk of 3-4 words
  const { currentChunk, currentActiveInChunk, activeWordStartFrame } = useMemo(() => {
    if (activeIndex === -1) {
      // Find nearest upcoming word
      const nextIdx = words.findIndex((w) => w.start > currentTimeSec);
      if (nextIdx !== -1 && words[nextIdx].start - currentTimeSec < 0.25) {
        const chunkStart = Math.floor(nextIdx / maxWordsPerChunk) * maxWordsPerChunk;
        return {
          currentChunk: words.slice(chunkStart, chunkStart + maxWordsPerChunk),
          currentActiveInChunk: nextIdx - chunkStart,
          activeWordStartFrame: Math.round(words[nextIdx].start * 30),
        };
      }
      return { currentChunk: [], currentActiveInChunk: -1, activeWordStartFrame: 0 };
    }

    const chunkStart = Math.floor(activeIndex / maxWordsPerChunk) * maxWordsPerChunk;
    const chunk = words.slice(chunkStart, chunkStart + maxWordsPerChunk);
    const inChunkIdx = activeIndex - chunkStart;
    const activeStartFrame = Math.round(words[activeIndex].start * 30);

    return {
      currentChunk: chunk,
      currentActiveInChunk: inChunkIdx,
      activeWordStartFrame: activeStartFrame,
    };
  }, [words, activeIndex, currentTimeSec, maxWordsPerChunk]);

  if (currentChunk.length === 0) {
    return null;
  }

  // Word pop scale animation when active word changes
  const framesSinceWordStart = Math.max(0, frame - activeWordStartFrame);
  const popSpring = spring({
    frame: framesSinceWordStart,
    fps: 30,
    config: { damping: 12, stiffness: 240, mass: 0.6 },
  });
  const wordScale = 1.0 + (1 - popSpring) * 0.18; // 1.18 -> 1.0 pop

  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 50,
        pointerEvents: "none",
        padding: "0 40px",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          gap: "14px 18px",
          background: "rgba(10, 8, 8, 0.88)",
          padding: "16px 32px",
          borderRadius: 14,
          border: "2px solid rgba(255, 222, 89, 0.35)",
          boxShadow:
            "0 16px 40px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.12)",
        }}
      >
        {currentChunk.map((w, idx) => {
          const isActive = idx === currentActiveInChunk;

          return (
            <span
              key={`${w.word}-${w.start}`}
              style={{
                fontFamily: "'Inter', 'Impact', sans-serif",
                fontWeight: 900,
                fontSize: 44,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: isActive ? highlightColor : "#FFFFFF",
                transform: isActive ? `scale(${wordScale})` : "scale(1.0)",
                transformOrigin: "center center",
                display: "inline-block",
                transition: "color 0.08s ease",
                textShadow: isActive
                  ? `0 0 24px rgba(255, 222, 89, 0.75), 0 2px 4px #000`
                  : "0 2px 6px rgba(0,0,0,0.9)",
                WebkitTextStroke: isActive ? "1px #000" : "1.5px #000",
              }}
            >
              {w.word}
            </span>
          );
        })}
      </div>
    </div>
  );
};


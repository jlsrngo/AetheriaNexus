import React from "react";
import { useCurrentFrame } from "remotion";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const COLS = 14;
const ROWS = 22;

// Deterministic pseudo-random using position seed
function seededChar(col: number, row: number, offset: number): string {
  const idx = ((col * 31 + row * 17 + offset) * 1234567) % ALPHABET.length;
  return ALPHABET[Math.abs(Math.floor(idx))];
}

/**
 * CipherStreamOverlay — full-background animated cipher character grid.
 * Columns "scroll" downward at different speeds, like a teletypewriter.
 * Opacity is intentionally low so underlying imagery shows through.
 */
export const CipherStreamOverlay: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        zIndex: 2,
        pointerEvents: "none",
        display: "grid",
        gridTemplateColumns: `repeat(${COLS}, 1fr)`,
        gridTemplateRows: `repeat(${ROWS}, 1fr)`,
        padding: "0 20px",
        opacity: 0.18,
      }}
    >
      {Array.from({ length: COLS * ROWS }).map((_, idx) => {
        const col = idx % COLS;
        const row = Math.floor(idx / COLS);
        // Each column scrolls at a slightly different rate
        const speed = 0.3 + (col % 5) * 0.07;
        const offset = Math.floor(frame * speed) + col * 7;
        const char = seededChar(col, row, offset);
        const isHighlight = ((col + row + Math.floor(frame / 8)) % 11) === 0;

        return (
          <div
            key={idx}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "'Courier New', monospace",
              fontSize: 28,
              fontWeight: 700,
              color: isHighlight ? "#F5A623" : "#4CAF50",
              textShadow: isHighlight ? "0 0 8px rgba(245,166,35,0.8)" : "none",
            }}
          >
            {char}
          </div>
        );
      })}
    </div>
  );
};

import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

/**
 * Scene 6: Cold rain trickling on dark glass window.
 */
export const RainWindowOverlay: React.FC<{ durationInFrames: number }> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();

  const droplets = [
    { x: 180, speed: 4.2, len: 90, width: 2, delay: 0 },
    { x: 320, speed: 5.5, len: 120, width: 2.5, delay: 15 },
    { x: 490, speed: 3.8, len: 80, width: 2, delay: 5 },
    { x: 670, speed: 6.0, len: 140, width: 3, delay: 20 },
    { x: 840, speed: 4.8, len: 100, width: 2, delay: 10 },
    { x: 920, speed: 5.2, len: 110, width: 2.5, delay: 25 },
  ];

  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 75, overflow: "hidden" }}>
      <svg width="1080" height="1920" style={{ opacity: 0.55 }}>
        {droplets.map((d, i) => {
          const y = ((frame * d.speed + d.delay * 80) % 2100) - 200;
          return (
            <line
              key={i}
              x1={d.x}
              y1={y}
              x2={d.x + 8}
              y2={y + d.len}
              stroke="rgba(200, 220, 240, 0.65)"
              strokeWidth={d.width}
              strokeLinecap="round"
              style={{ filter: "drop-shadow(0 0 3px rgba(180,210,240,0.5))" }}
            />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

/**
 * Scene 4: Turing's Bombe electromechanical spinning rotor drums.
 */
export const BombeGearsOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const rot1 = (frame * 3.5) % 360;
  const rot2 = -(frame * 4.8) % 360;
  const rot3 = (frame * 2.2) % 360;

  return (
    <div
      style={{
        position: "absolute",
        top: 240,
        right: 40,
        display: "flex",
        gap: 16,
        zIndex: 40,
        opacity: 0.75,
        pointerEvents: "none",
      }}
    >
      {[rot1, rot2, rot3].map((r, idx) => (
        <div
          key={idx}
          style={{
            width: 110,
            height: 110,
            borderRadius: "50%",
            border: "4px dashed #D97706",
            boxShadow: "0 0 24px rgba(217, 119, 6, 0.4), inset 0 0 16px rgba(0,0,0,0.8)",
            backgroundColor: "rgba(24, 20, 16, 0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `rotate(${r}deg)`,
          }}
        >
          <div style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "#DC2626" }} />
        </div>
      ))}
    </div>
  );
};

/**
 * Scene 3: Cryptographic cipher hex stream (Intercepted Nazi Naval Communications).
 */
export const CipherStreamOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const hexSample = ["4A", "7F", "2B", "9C", "E1", "88", "3D", "F0", "AA", "12", "6B", "CC", "99", "54"];
  const offset = Math.floor(frame / 4);

  return (
    <div
      style={{
        position: "absolute",
        top: 280,
        left: 60,
        right: 60,
        fontFamily: "'Courier Prime', monospace",
        fontSize: 18,
        color: "rgba(220, 38, 38, 0.65)",
        letterSpacing: "4px",
        zIndex: 35,
        pointerEvents: "none",
        userSelect: "none",
        textShadow: "0 0 8px rgba(220, 38, 38, 0.5)",
      }}
    >
      ENIGMA M4 INTERCEPT // RADAR 1942: {Array.from({ length: 16 })
        .map((_, i) => hexSample[(i + offset) % hexSample.length])
        .join(" ")}
    </div>
  );
};

/**
 * Scene 7: Modern Neural AI & Computing Network Matrix.
 */
export const ModernAiMatrixOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const pulse = 0.85 + Math.sin(frame * 0.1) * 0.15;

  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 30 }}>
      <svg width="1080" height="1920" style={{ opacity: 0.35 }}>
        <defs>
          <linearGradient id="aiGlow" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        {/* Network connection lines */}
        <line x1="200" y1="400" x2="540" y2="600" stroke="url(#aiGlow)" strokeWidth={2} />
        <line x1="540" y1="600" x2="880" y2="450" stroke="url(#aiGlow)" strokeWidth={2} />
        <line x1="540" y1="600" x2="540" y2="1050" stroke="url(#aiGlow)" strokeWidth={2.5} />
        <line x1="240" y1="1050" x2="540" y2="1050" stroke="url(#aiGlow)" strokeWidth={2} />
        <line x1="540" y1="1050" x2="840" y2="1100" stroke="url(#aiGlow)" strokeWidth={2} />

        {/* Neural nodes */}
        <circle cx="540" cy="600" r={16 * pulse} fill="#06B6D4" style={{ filter: "drop-shadow(0 0 12px #06B6D4)" }} />
        <circle cx="200" cy="400" r={10} fill="#3B82F6" />
        <circle cx="880" cy="450" r={10} fill="#3B82F6" />
        <circle cx="540" cy="1050" r={14 * pulse} fill="#10B981" style={{ filter: "drop-shadow(0 0 10px #10B981)" }} />
        <circle cx="240" cy="1050" r={9} fill="#3B82F6" />
        <circle cx="840" cy="1100" r={9} fill="#3B82F6" />
      </svg>
    </AbsoluteFill>
  );
};


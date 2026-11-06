/**
 * RustBlueprintStoryComposition.tsx
 * 60-second (1800 frame @ 30fps) — TECHNICAL BLUEPRINT / CAD SCHEMA
 *
 * GLOBAL ANIMATION RULES:
 *  1. SVG self-drawing via strokeDasharray / strokeDashoffset interpolation
 *  2. Dimension arrows via spring() + number counter roll
 *  3. Dynamic 2D blueprint camera rig (pan X/Y + zoom scale)
 *  4. Typewriter / Hex decoder text reveal
 *
 * SCENE MAP:
 *  Scene 1  —  0  –  240  (0s – 8s)    Blueprint Title Block & C++ Warning
 *  Scene 2  — 240 –  540  (8s – 18s)   Tragedi Lift Graydon Hoare 2006
 *  Scene 3  — 540 –  840  (18s – 28s)  Konsep Proyek Pribadi / Compiler Draft
 *  Scene 4  — 840 – 1200  (28s – 40s)  Mozilla & Servo 2009-2015
 *  Scene 5  —1200 – 1560  (40s – 52s)  Borrow Checker Innovation
 *  Scene 6  —1560 – 1800  (52s – 60s)  Adopsi Global & Epic Zoom-Out
 */

import React, { useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// ─────────────────────────────────────────────────────────────────────────────
// SHARED UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/** SVG path self-draw: returns strokeDashoffset for a path of `length` px */
function selfDraw(frame: number, start: number, end: number, pathLength: number): number {
  const t = interpolate(frame, [start, end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return pathLength * (1 - t);
}

/** Number counter roll: returns animated number string */
function counterRoll(frame: number, start: number, end: number, target: number, decimals = 0): string {
  const v = interpolate(frame, [start, end], [0, target], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return v.toFixed(decimals);
}

/** Hex/binary decoder typewriter — random chars → final text */
function decoderText(frame: number, startFrame: number, text: string, framesPerChar = 4): string {
  const HEX = "0123456789ABCDEF█▓▒░";
  const revealed = Math.floor((frame - startFrame) / framesPerChar);
  return text
    .split("")
    .map((ch, i) => {
      if (i < revealed) return ch;
      if (i === revealed)
        return HEX[Math.floor(((frame * (i + 1) * 7) % HEX.length))];
      return "_";
    })
    .join("");
}

/** Clamp helper */
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// Palette
const C = {
  bg: "#070d14",
  cyan: "#00e5ff",
  amber: "#f59e0b",
  red: "#ef4444",
  white: "#ffffff",
  muted: "#64748b",
  subtle: "rgba(0,229,255,0.08)",
  grid: "rgba(0,229,255,0.07)",
  gridMajor: "rgba(0,229,255,0.14)",
};

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL BLUEPRINT GRID (parallax-animated background)
// ─────────────────────────────────────────────────────────────────────────────
const BlueprintGrid: React.FC<{ panX: number; panY: number; scale: number }> = ({
  panX,
  panY,
  scale,
}) => (
  <AbsoluteFill
    style={{
      backgroundImage: `
        linear-gradient(to right, ${C.grid} 1px, transparent 1px),
        linear-gradient(to bottom, ${C.grid} 1px, transparent 1px),
        linear-gradient(to right, ${C.gridMajor} 1px, transparent 1px),
        linear-gradient(to bottom, ${C.gridMajor} 1px, transparent 1px)
      `,
      backgroundSize: `${20 * scale}px ${20 * scale}px, ${20 * scale}px ${20 * scale}px, ${100 * scale}px ${100 * scale}px, ${100 * scale}px ${100 * scale}px`,
      backgroundPosition: `${panX}px ${panY}px, ${panX}px ${panY}px, ${panX}px ${panY}px, ${panX}px ${panY}px`,
      pointerEvents: "none",
    }}
  />
);

// ─────────────────────────────────────────────────────────────────────────────
// TOP HUD BAR
// ─────────────────────────────────────────────────────────────────────────────
const TopHud: React.FC<{ frame: number; scene: number }> = ({ frame, scene }) => {
  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const labels = [
    "SCENE 1 // BLUEPRINT INIT",
    "SCENE 2 // INCIDENT REPORT",
    "SCENE 3 // DESIGN BRIEF",
    "SCENE 4 // MOZILLA FUNDING",
    "SCENE 5 // BORROW CHECKER",
    "SCENE 6 // GLOBAL DEPLOY",
  ];
  return (
    <div
      style={{
        position: "absolute",
        top: 36,
        left: 40,
        right: 56,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottom: `1px solid rgba(0,229,255,0.25)`,
        paddingBottom: 10,
        zIndex: 50,
        opacity,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 8, height: 8, background: C.amber }} />
        <span
          style={{
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "2px",
            color: C.white,
            fontFamily: "'JetBrains Mono', monospace",
            textTransform: "uppercase",
          }}
        >
          {labels[scene] ?? "SYS // BLUEPRINT"}
        </span>
      </div>
      <span
        style={{
          fontSize: 11,
          color: C.cyan,
          letterSpacing: "2px",
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        FRAME: {String(frame).padStart(4, "0")} / 1800 · 30FPS · 1080×1920
      </span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SUBTITLE BAR
// ─────────────────────────────────────────────────────────────────────────────
interface Caption {
  from: number;
  to: number;
  text: string;
  highlight: string;
}
const CAPTIONS: Caption[] = [
  { from: 5,   to: 90,  text: "Pernahkah kamu membayangkan,", highlight: "membayangkan" },
  { from: 90,  to: 200, text: "bahasa pemrograman paling dicintai dunia ini lahir", highlight: "bahasa pemrograman" },
  { from: 200, to: 240, text: "hanya gara-gara lift rusak?", highlight: "lift rusak" },
  { from: 250, to: 380, text: "Tahun 2006, insinyur Mozilla Graydon Hoare", highlight: "Graydon Hoare" },
  { from: 380, to: 540, text: "harus naik 20 lantai karena lift crash akibat C++ memory bug!", highlight: "C++ memory bug" },
  { from: 550, to: 680, text: "Frustrasi dengan bug memori di C dan C++,", highlight: "bug memori" },
  { from: 680, to: 840, text: "Hoare merancang bahasa secepat C, aman tanpa garbage collector.", highlight: "garbage collector" },
  { from: 850, to: 1000, text: "Tahun 2009, Mozilla mendanai pengembangan Rust", highlight: "Mozilla" },
  { from: 1000, to: 1200, text: "untuk browser engine Servo. Rust 1.0 rilis 2015.", highlight: "Rust 1.0" },
  { from: 1210, to: 1380, text: "Senjata rahasianya adalah Borrow Checker.", highlight: "Borrow Checker" },
  { from: 1380, to: 1560, text: "Menjamin keamanan memori langsung saat kompilasi.", highlight: "kompilasi" },
  { from: 1570, to: 1700, text: "Kini Rust menggerakkan Linux Kernel, Windows Core,", highlight: "Linux Kernel" },
  { from: 1700, to: 1800, text: "dan arsitektur cloud global AWS di seluruh dunia.", highlight: "AWS" },
];

const SubtitleBar: React.FC<{ frame: number }> = ({ frame }) => {
  const cap = CAPTIONS.find((c) => frame >= c.from && frame <= c.to);
  if (!cap) return null;
  const opacity = interpolate(frame, [cap.from, cap.from + 8, cap.to - 8, cap.to], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        bottom: 48,
        left: 40,
        right: 56,
        zIndex: 50,
        opacity,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          background: "rgba(5,12,18,0.95)",
          border: `1.5px solid ${C.cyan}`,
          boxShadow: `0 0 24px rgba(0,229,255,0.2)`,
          padding: "16px 20px",
        }}
      >
        <div
          style={{
            fontSize: 10,
            color: C.amber,
            letterSpacing: "2px",
            fontWeight: 800,
            marginBottom: 6,
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          [ SUBTITLE // ID ]
        </div>
        <div
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 28,
            fontWeight: 900,
            lineHeight: 1.3,
            color: C.white,
          }}
        >
          {cap.text.split(" ").map((w, i) => {
            const hl = cap.highlight
              .toLowerCase()
              .split(" ")
              .some((hw) => w.toLowerCase().replace(/[^a-z0-9]/g, "").includes(hw.replace(/[^a-z0-9]/g, "")));
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  margin: "0 3px",
                  color: hl ? C.cyan : C.white,
                  textShadow: hl ? `0 0 16px rgba(0,229,255,0.7)` : "none",
                  fontWeight: hl ? 900 : 700,
                }}
              >
                {w}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SCENE 1 — BLUEPRINT TITLE BLOCK & C++ FAULT  (F 0 – 240)
// ─────────────────────────────────────────────────────────────────────────────
const Scene1: React.FC<{ lf: number; fps: number }> = ({ lf, fps }) => {
  /* Grid spread from center */
  const gridScale = interpolate(lf, [0, 30], [0.05, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* Title block border self-draw */
  const tbPerim = 1400;
  const tbDash = selfDraw(lf, 30, 90, tbPerim);

  /* Title text decoder */
  const titleText = decoderText(lf, 80, "PROJECT: RUST_LANG | REV: 2006.0", 3);
  const subText   = decoderText(lf, 95, "DESIGNER: GRAYDON HOARE // VANCOUVER, BC", 3);

  /* CPU/RAM schematic draw */
  const cpuPerim = 900;
  const cpuDash  = selfDraw(lf, 90, 150, cpuPerim);

  /* Dimension arrow spring */
  const dimSpr = spring({ frame: lf - 100, fps, config: { damping: 12, stiffness: 120 } });
  const dimW   = interpolate(dimSpr, [0, 1], [0, 480]);

  /* Glitch oscillation for fault */
  const isFault = lf > 160;
  const glitchX = isFault ? Math.sin(lf * 1.8) * 6 : 0;
  const glitchY = isFault ? Math.cos(lf * 2.3) * 4 : 0;
  const faultBlink = isFault ? (Math.floor(lf / 4) % 2 === 0 ? 1 : 0.2) : 0;

  const dimCountW = counterRoll(lf, 100, 160, 167, 1);
  const dimCountH = counterRoll(lf, 110, 170, 83.7, 1);

  return (
    <AbsoluteFill style={{ transform: `scale(${gridScale})`, transformOrigin: "center" }}>
      <div
        style={{
          position: "absolute",
          top: 100,
          left: 40,
          right: 56,
          bottom: 160,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          paddingTop: 60,
        }}
      >
        {/* Scene Label */}
        <div style={{ fontSize: 13, color: C.amber, letterSpacing: "3px", fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", marginBottom: 10 }}>
          [ 01 // BLUEPRINT INIT ]
        </div>

        {/* Headline */}
        <h1
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 52,
            fontWeight: 900,
            textAlign: "center",
            margin: "0 0 24px",
            color: C.white,
            letterSpacing: "-1px",
            lineHeight: 1.2,
          }}
        >
          BLUEPRINT: SPEC-VANCOUVER-2006<br />
          <span style={{ color: C.cyan }}>RUST_LANG // ORIGIN DOCUMENT</span>
        </h1>

        {/* Title Block (self-drawn border) */}
        <div style={{ position: "relative", width: 880, marginBottom: 24 }}>
          <svg width="880" height="90" style={{ overflow: "visible" }}>
            <rect
              x="2" y="2" width="876" height="86"
              fill="rgba(2,8,14,0.95)"
              stroke={C.cyan}
              strokeWidth="2"
              strokeDasharray={tbPerim}
              strokeDashoffset={tbDash}
            />
            <line x1="220" y1="2" x2="220" y2="88" stroke={C.cyan} strokeWidth="1" strokeDasharray={`${86 - tbDash > 0 ? 2 : 0} 4`} />
            <line x1="560" y1="2" x2="560" y2="88" stroke={C.cyan} strokeWidth="1" strokeDasharray={`${86 - tbDash > 0 ? 2 : 0} 4`} />
          </svg>
          <div style={{ position: "absolute", top: 12, left: 16, fontFamily: "'JetBrains Mono', monospace" }}>
            <div style={{ fontSize: 10, color: "rgba(0,229,255,0.5)", marginBottom: 3 }}>PROJECT:</div>
            <div style={{ fontSize: 15, color: C.white, fontWeight: 800 }}>{titleText}</div>
          </div>
          <div style={{ position: "absolute", top: 12, left: 240, fontFamily: "'JetBrains Mono', monospace" }}>
            <div style={{ fontSize: 10, color: "rgba(0,229,255,0.5)", marginBottom: 3 }}>DESIGNER:</div>
            <div style={{ fontSize: 14, color: C.amber, fontWeight: 700 }}>{subText.slice(11, 32)}</div>
          </div>
          <div style={{ position: "absolute", top: 12, right: 16, fontFamily: "'JetBrains Mono', monospace", textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "rgba(0,229,255,0.5)", marginBottom: 3 }}>DATE:</div>
            <div style={{ fontSize: 14, color: C.white, fontWeight: 700 }}>2006-09-01 // DRAFT</div>
          </div>
        </div>

        {/* CPU / RAM Schematic with dimension arrows */}
        <div style={{ position: "relative", width: 880, height: 340, transform: `translate(${glitchX}px, ${glitchY}px)` }}>
          <svg width="880" height="340" viewBox="0 0 880 340">
            {/* Dimension line top */}
            <line x1="160" y1="24" x2={160 + dimW} y2="24" stroke={C.cyan} strokeWidth="1.5" />
            <line x1="160" y1="16" x2="160" y2="32" stroke={C.cyan} strokeWidth="1.5" />
            <line x1={160 + dimW} y1="16" x2={160 + dimW} y2="32" stroke={C.cyan} strokeWidth="1.5" />
            <text x={160 + dimW / 2 - 30} y="18" fill={C.cyan} fontSize="11" fontFamily="'JetBrains Mono', monospace">
              {dimCountW} MM
            </text>

            {/* Dimension line left */}
            <line x1="80" y1="50" x2="80" y2={50 + dimW * 0.5} stroke={C.cyan} strokeWidth="1.5" />
            <line x1="72" y1="50" x2="88" y2="50" stroke={C.cyan} strokeWidth="1.5" />
            <line x1="72" y1={50 + dimW * 0.5} x2="88" y2={50 + dimW * 0.5} stroke={C.cyan} strokeWidth="1.5" />
            <text x="20" y={50 + dimW * 0.25} fill={C.cyan} fontSize="11" fontFamily="'JetBrains Mono', monospace" transform={`rotate(-90, 60, ${50 + dimW * 0.25})`}>
              {dimCountH} MM
            </text>

            {/* CPU Block self-draw */}
            <rect x="160" y="50" width="240" height="180"
              fill="rgba(0,229,255,0.05)"
              stroke={isFault ? C.red : C.cyan}
              strokeWidth="2"
              strokeDasharray={isFault ? "6 4" : String(cpuPerim)}
              strokeDashoffset={cpuDash}
            />
            <text x="175" y="80" fill={isFault ? C.red : C.cyan} fontSize="13" fontWeight="800" fontFamily="'JetBrains Mono', monospace">
              CPU CORE x86_64
            </text>
            <rect x="180" y="95" width="200" height="28" fill="rgba(0,229,255,0.08)" stroke={C.cyan} strokeWidth="1" />
            <text x="190" y="114" fill={C.white} fontSize="11" fontFamily="'JetBrains Mono', monospace">ALU STAGE // EXECUTE</text>
            <rect x="180" y="135" width="200" height="28" fill="rgba(0,229,255,0.08)" stroke={C.cyan} strokeWidth="1" />
            <text x="190" y="154" fill={C.white} fontSize="11" fontFamily="'JetBrains Mono', monospace">L1 CACHE: 512KB ACTIVE</text>

            {/* Arrow CPU → RAM */}
            <defs>
              <marker id="arr" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" fill={C.cyan} />
              </marker>
              <marker id="arrRed" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" fill={C.red} />
              </marker>
            </defs>
            <line
              x1="400" y1="140"
              x2="480" y2="140"
              stroke={isFault ? C.red : C.cyan}
              strokeWidth="2.5"
              strokeDasharray={isFault ? "5 3" : "none"}
              markerEnd={isFault ? "url(#arrRed)" : "url(#arr)"}
            />
            <text x="408" y="132" fill={C.muted} fontSize="10" fontFamily="'JetBrains Mono', monospace">ADDR BUS</text>

            {/* RAM Block */}
            <rect x="480" y="50" width="360" height="180"
              fill={isFault ? "rgba(239,68,68,0.06)" : "rgba(0,229,255,0.05)"}
              stroke={isFault ? C.red : C.cyan}
              strokeWidth="2"
              strokeDasharray={isFault ? "6 4" : undefined}
            />
            <text x="495" y="80" fill={isFault ? C.red : C.cyan} fontSize="13" fontWeight="800" fontFamily="'JetBrains Mono', monospace">
              DRAM CONTROLLER
            </text>
            {[0, 1, 2, 3].map((row) => (
              <React.Fragment key={row}>
                <rect x="495" y={95 + row * 32} width="330" height="24"
                  fill={isFault && row === 2 ? "rgba(239,68,68,0.15)" : "rgba(0,229,255,0.06)"}
                  stroke={isFault && row === 2 ? C.red : "rgba(0,229,255,0.3)"}
                  strokeWidth="1"
                />
                <text x="505" y={112 + row * 32} fill={isFault && row === 2 ? C.red : C.white} fontSize="10" fontFamily="'JetBrains Mono', monospace">
                  {isFault && row === 2 ? "0xFF2A: DANGLING PTR ← FAULT" : `0x${(0xFF00 + row * 0x10).toString(16).toUpperCase()}: CELL [${String(row).padStart(2, "0")}] // ${16 + row * 8}B`}
                </text>
              </React.Fragment>
            ))}

            {/* Zero-cost dimension bottom */}
            <line x1="160" y1="265" x2="840" y2="265" stroke={C.cyan} strokeWidth="1.5" />
            <line x1="160" y1="257" x2="160" y2="273" stroke={C.cyan} strokeWidth="1.5" />
            <line x1="840" y1="257" x2="840" y2="273" stroke={C.cyan} strokeWidth="1.5" />
            <text x="410" y="285" fill={C.cyan} fontSize="11" fontFamily="'JetBrains Mono', monospace">
              |◄── TOTAL BUS WIDTH: 680 MM ──►|
            </text>
          </svg>

          {/* FAULT STAMP */}
          {isFault && (
            <div
              style={{
                position: "absolute",
                top: 60,
                left: 200,
                border: `2.5px solid ${C.red}`,
                background: "rgba(239,68,68,0.12)",
                padding: "10px 18px",
                opacity: faultBlink,
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              <div style={{ fontSize: 13, color: C.red, fontWeight: 900, letterSpacing: "2px" }}>
                ⚠ WARNING: SEGMENTATION FAULT
              </div>
              <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>
                MEMORY LEAK DETECTED // ABORT SIGNAL
              </div>
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SCENE 2 — TRAGEDI LIFT GRAYDON HOARE 2006  (F 240 – 540)
// ─────────────────────────────────────────────────────────────────────────────
const Scene2: React.FC<{ lf: number; fps: number }> = ({ lf, fps }) => {
  /* Pan-in from bottom */
  const panY = interpolate(lf, [0, 30], [80, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(lf, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* Building elevation self-draw */
  const bldgPerim = 2800;
  const bldgDash  = selfDraw(lf, 30, 120, bldgPerim);

  /* Elevator cabin Y position (climbs then jams) */
  const cabinProgress = spring({
    frame: clamp(lf - 60, 0, 9999),
    fps,
    config: { damping: 20, stiffness: 60 },
  });
  const cabinY = interpolate(cabinProgress, [0, 1], [460, 60]);

  /* Elastic shake at jam (FL-20) */
  const jammed = lf > 210;
  const shakeX = jammed ? Math.sin(lf * 4.5) * (lf < 240 ? 8 : 2) : 0;
  const shakeY = jammed ? Math.cos(lf * 5.1) * (lf < 240 ? 5 : 1) : 0;

  /* Leader line for diagnosis table */
  const leaderProgress = interpolate(lf, [210, 260], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* Building height dimension counter */
  const heightCount = counterRoll(lf, 30, 130, 68.0, 1);

  return (
    <AbsoluteFill style={{ opacity, transform: `translateY(${panY}px)` }}>
      <div
        style={{
          position: "absolute",
          top: 100,
          left: 40,
          right: 56,
          bottom: 160,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 60,
        }}
      >
        <div style={{ fontSize: 13, color: C.red, letterSpacing: "3px", fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", marginBottom: 10 }}>
          [ 02 // INCIDENT REPORT: VANCOUVER-2006 ]
        </div>
        <h1
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 48,
            fontWeight: 900,
            textAlign: "center",
            margin: "0 0 20px",
            color: C.white,
            lineHeight: 1.2,
          }}
        >
          CROSS-SECTION: 20-FLOOR SHAFT<br />
          <span style={{ color: C.red }}>HOIST SYSTEM FAILURE REPORT</span>
        </h1>

        {/* Main CAD Window */}
        <div
          style={{
            position: "relative",
            width: 900,
            height: 620,
            border: `1.5px solid ${C.cyan}`,
            background: "rgba(4,16,26,0.92)",
            boxShadow: `0 0 30px rgba(0,229,255,0.12)`,
          }}
        >
          <svg width="900" height="620" viewBox="0 0 900 620">
            {/* Dimension left: building height */}
            <line x1="44" y1="60" x2="44" y2="540" stroke={C.cyan} strokeWidth="1.5" />
            <line x1="36" y1="60" x2="52" y2="60" stroke={C.cyan} strokeWidth="1.5" />
            <line x1="36" y1="540" x2="52" y2="540" stroke={C.cyan} strokeWidth="1.5" />
            <text x="-380" y="34" fill={C.cyan} fontSize="11" fontFamily="'JetBrains Mono', monospace" transform="rotate(-90)">
              {heightCount} M (20 FLOORS)
            </text>

            {/* Building outline self-draw */}
            <rect
              x="80" y="60" width="640" height="480"
              fill="none"
              stroke={C.cyan}
              strokeWidth="2"
              strokeDasharray={bldgPerim}
              strokeDashoffset={bldgDash}
            />

            {/* Floor lines */}
            {Array.from({ length: 20 }, (_, i) => {
              const fy = 60 + i * 24;
              return (
                <g key={i}>
                  <line x1="80" y1={fy} x2="720" y2={fy} stroke="rgba(0,229,255,0.15)" strokeWidth="1" strokeDasharray="4 4" />
                  <text x="86" y={fy + 14} fill="rgba(0,229,255,0.5)" fontSize="9" fontFamily="'JetBrains Mono', monospace">
                    FL-{String(20 - i).padStart(2, "0")}
                  </text>
                </g>
              );
            })}

            {/* Stairwell shaft (left) */}
            <rect x="100" y="60" width="180" height="480" fill="none" stroke="rgba(0,229,255,0.4)" strokeWidth="1.5" />
            <text x="108" y="80" fill={C.cyan} fontSize="10" fontWeight="800" fontFamily="'JetBrains Mono', monospace">STAIRWELL B</text>
            {/* Stair zigzag */}
            <path d="M110 528 L140 528 L140 504 L170 504 L170 480 L200 480 L200 456 L230 456 L230 432 L260 432 L260 408 L270 408 L270 74"
              fill="none" stroke={C.cyan} strokeWidth="1.5" />

            {/* Elevator shaft (right) */}
            <rect x="360" y="60" width="340" height="480"
              fill={jammed ? "rgba(239,68,68,0.05)" : "rgba(0,229,255,0.03)"}
              stroke={jammed ? C.red : C.cyan}
              strokeWidth="1.5"
            />
            <text x="368" y="80" fill={jammed ? C.red : C.cyan} fontSize="10" fontWeight="800" fontFamily="'JetBrains Mono', monospace">
              {jammed ? "⚠ SECTION A-1: HOIST FAULT" : "SECTION A-1: TRACTION HOIST"}
            </text>

            {/* Guide rails */}
            <line x1="390" y1="90" x2="390" y2="530" stroke="rgba(0,229,255,0.3)" strokeWidth="1" strokeDasharray="4 4" />
            <line x1="670" y1="90" x2="670" y2="530" stroke="rgba(0,229,255,0.3)" strokeWidth="1" strokeDasharray="4 4" />

            {/* Elevator cabin */}
            <g transform={`translate(${shakeX}, ${shakeY})`}>
              <rect
                x="400" y={cabinY} width="260" height="80"
                fill="rgba(10,20,30,0.95)"
                stroke={jammed ? C.red : C.cyan}
                strokeWidth="2"
              />
              <text x="415" y={cabinY + 28} fill={jammed ? C.red : C.white} fontSize="12" fontWeight="800" fontFamily="'JetBrains Mono', monospace">
                {jammed ? "⚠ CABIN DEADLOCK" : "CAR #01: ASCENDING"}
              </text>
              <text x="415" y={cabinY + 48} fill={C.muted} fontSize="10" fontFamily="'JetBrains Mono', monospace">
                {jammed ? "FAULT: 0x00007FFF NULL PTR" : `POS: ${cabinY.toFixed(0)}px`}
              </text>
              <text x="415" y={cabinY + 66} fill={jammed ? C.red : C.muted} fontSize="10" fontFamily="'JetBrains Mono', monospace">
                {jammed ? "GRAYDON: MANUAL ASCENT REQUIRED" : "VELOCITY: NOMINAL"}
              </text>
            </g>

            {/* Leader line to diagnosis (animates in) */}
            <line
              x1="660"
              y1={cabinY + 40}
              x2={660 + leaderProgress * 80}
              y2={cabinY - leaderProgress * 60}
              stroke={C.red}
              strokeWidth="1.5"
            />
            <circle cx="660" cy={cabinY + 40} r="3" fill={C.red} />
          </svg>

          {/* Diagnosis Table */}
          {leaderProgress > 0.6 && (
            <div
              style={{
                position: "absolute",
                top: cabinY > 200 ? 40 : 200,
                right: 16,
                border: `1.5px solid ${C.red}`,
                background: "rgba(2,6,10,0.96)",
                padding: "12px 14px",
                width: 280,
                fontFamily: "'JetBrains Mono', monospace",
                opacity: interpolate(lf, [255, 275], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              }}
            >
              <div style={{ fontSize: 10, color: C.red, fontWeight: 900, letterSpacing: "1.5px", marginBottom: 6, borderBottom: `1px solid rgba(239,68,68,0.3)`, paddingBottom: 4 }}>
                DIAGNOSIS TABLE // FAULT
              </div>
              <div style={{ fontSize: 11, color: C.white, lineHeight: 1.7 }}>
                <span style={{ color: C.muted }}>CODE: </span><span style={{ color: C.red }}>NULL POINTER DEREF</span><br />
                <span style={{ color: C.muted }}>LANG: </span>C++ HOIST CTRL v3.2<br />
                <span style={{ color: C.muted }}>CAUSE: </span>DANGLING POINTER<br />
                <span style={{ color: C.amber }}>ROOT: </span>C++ MEMORY CRASH<br />
                <span style={{ color: C.muted }}>FIX: </span><span style={{ color: C.cyan }}>DESIGN NEW LANGUAGE</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SCENE 3 — KONSEP PROYEK PRIBADI / COMPILER DRAFT  (F 540 – 840)
// ─────────────────────────────────────────────────────────────────────────────
const Scene3: React.FC<{ lf: number; fps: number }> = ({ lf, fps }) => {
  /* Pan right + zoom in */
  const panX = interpolate(lf, [0, 30], [-60, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sceneScale = interpolate(lf, [0, 30], [0.94, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(lf, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* Compiler block layered assembly */
  const blockTop    = spring({ frame: clamp(lf - 30, 0, 9999), fps, config: { damping: 14, stiffness: 100 } });
  const blockBottom = spring({ frame: clamp(lf - 45, 0, 9999), fps, config: { damping: 14, stiffness: 100 } });
  const blockCenter = spring({ frame: clamp(lf - 60, 0, 9999), fps, config: { damping: 12, stiffness: 85 } });

  const topY    = interpolate(blockTop,    [0, 1], [-80, 0]);
  const botY    = interpolate(blockBottom, [0, 1], [80, 0]);
  const centerS = interpolate(blockCenter, [0, 1], [0.7, 1]);

  /* Module dimension shoots */
  const spr1 = spring({ frame: clamp(lf - 140, 0, 9999), fps, config: { damping: 12, stiffness: 120 } });
  const spr2 = spring({ frame: clamp(lf - 160, 0, 9999), fps, config: { damping: 12, stiffness: 120 } });
  const spr3 = spring({ frame: clamp(lf - 180, 0, 9999), fps, config: { damping: 12, stiffness: 120 } });

  const dimLen1 = interpolate(spr1, [0, 1], [0, 220]);
  const dimLen2 = interpolate(spr2, [0, 1], [0, 220]);
  const dimLen3 = interpolate(spr3, [0, 1], [0, 220]);

  /* Counter roll labels */
  const cntSafety = counterRoll(lf, 140, 200, 100, 0);
  const cntSpeed  = counterRoll(lf, 160, 220, 99.9, 1);
  const cntConc   = counterRoll(lf, 180, 240, 32, 0);

  return (
    <AbsoluteFill style={{ opacity, transform: `translateX(${panX}px) scale(${sceneScale})`, transformOrigin: "center" }}>
      <div
        style={{
          position: "absolute",
          top: 100,
          left: 40,
          right: 56,
          bottom: 160,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 60,
        }}
      >
        <div style={{ fontSize: 13, color: C.cyan, letterSpacing: "3px", fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", marginBottom: 10 }}>
          [ 03 // COMPILER DESIGN BRIEF ]
        </div>
        <h1
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 48,
            fontWeight: 900,
            textAlign: "center",
            margin: "0 0 24px",
            color: C.white,
            lineHeight: 1.2,
          }}
        >
          COMPILER DRAFT v0.1<br />
          <span style={{ color: C.cyan }}>PERSONAL RESEARCH PROJECT</span>
        </h1>

        {/* Layered Compiler Assembly */}
        <div style={{ position: "relative", width: 880, height: 480, transform: `scale(${centerS})`, transformOrigin: "center" }}>
          {/* Top block (floats in from top) */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 80,
              right: 80,
              height: 90,
              transform: `translateY(${topY}px)`,
              border: `1.5px solid ${C.cyan}`,
              background: C.subtle,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 40,
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: C.muted }}>STAGE 1</div>
              <div style={{ fontSize: 14, color: C.cyan, fontWeight: 800 }}>LEXER / TOKENIZER</div>
              <div style={{ fontSize: 10, color: C.muted }}>INPUT: RAW SOURCE CODE</div>
            </div>
            <div style={{ fontSize: 20, color: "rgba(0,229,255,0.4)" }}>→</div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: C.muted }}>STAGE 2</div>
              <div style={{ fontSize: 14, color: C.cyan, fontWeight: 800 }}>PARSER / AST</div>
              <div style={{ fontSize: 10, color: C.muted }}>SYNTAX VALIDATION</div>
            </div>
          </div>

          {/* Center block (scales in) */}
          <div
            style={{
              position: "absolute",
              top: 110,
              left: 40,
              right: 40,
              height: 120,
              border: `2px solid ${C.amber}`,
              background: "rgba(245,158,11,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 32,
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: C.amber, fontWeight: 900 }}>◆ CORE INNOVATION ◆</div>
              <div style={{ fontSize: 22, color: C.white, fontWeight: 900, marginTop: 6 }}>BORROW CHECKER</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>COMPILE-TIME OWNERSHIP + LIFETIMES</div>
            </div>
            <svg width="160" height="80">
              <rect x="4" y="20" width="60" height="40" fill="none" stroke={C.amber} strokeWidth="1.5" />
              <text x="12" y="38" fill={C.amber} fontSize="9" fontFamily="'JetBrains Mono', monospace">SCOPE A</text>
              <text x="12" y="52" fill={C.white} fontSize="8" fontFamily="'JetBrains Mono', monospace">OWNER</text>
              <path d="M64 40 L96 40" stroke={C.amber} strokeWidth="2" markerEnd="url(#arr)" />
              <rect x="96" y="20" width="60" height="40" fill="none" stroke="rgba(0,229,255,0.4)" strokeWidth="1.5" strokeDasharray="4 3" />
              <text x="104" y="38" fill={C.cyan} fontSize="9" fontFamily="'JetBrains Mono', monospace">SCOPE B</text>
              <text x="104" y="52" fill={C.muted} fontSize="8" fontFamily="'JetBrains Mono', monospace">BORROW</text>
            </svg>
          </div>

          {/* Bottom block (floats in from bottom) */}
          <div
            style={{
              position: "absolute",
              top: 250,
              left: 80,
              right: 80,
              height: 90,
              transform: `translateY(${botY}px)`,
              border: `1.5px solid ${C.cyan}`,
              background: C.subtle,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 40,
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: C.muted }}>STAGE 3</div>
              <div style={{ fontSize: 14, color: C.cyan, fontWeight: 800 }}>MIR / CODEGEN</div>
              <div style={{ fontSize: 10, color: C.muted }}>ZERO-COST ABSTRACTIONS</div>
            </div>
            <div style={{ fontSize: 20, color: "rgba(0,229,255,0.4)" }}>→</div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: C.muted }}>OUTPUT</div>
              <div style={{ fontSize: 14, color: C.amber, fontWeight: 800 }}>NATIVE BINARY</div>
              <div style={{ fontSize: 10, color: C.muted }}>PERFORMANCE = C/C++</div>
            </div>
          </div>

          {/* Three dimension shoots: SAFETY, SPEED, CONCURRENCY */}
          <svg style={{ position: "absolute", top: 0, left: 0 }} width="880" height="480">
            {/* Cross-hatching pattern */}
            <defs>
              <pattern id="hatch" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(0,229,255,0.15)" strokeWidth="1" />
              </pattern>
            </defs>

            {/* LEFT shoot: SAFETY */}
            <line x1="40" y1="240" x2={40 - dimLen1} y2="240" stroke={C.cyan} strokeWidth="2" markerEnd="url(#arr)" />
            <rect x={40 - dimLen1 - 140} y="210" width="140" height="60"
              fill="url(#hatch)"
              stroke={dimLen1 > 80 ? C.cyan : "transparent"}
              strokeWidth="1.5"
            />
            <text x={40 - dimLen1 - 130} y="238" fill={C.cyan} fontSize="14" fontWeight="900" fontFamily="'JetBrains Mono', monospace">
              {dimLen1 > 80 ? "+ SAFETY" : ""}
            </text>
            <text x={40 - dimLen1 - 130} y="256" fill={C.muted} fontSize="10" fontFamily="'JetBrains Mono', monospace">
              {dimLen1 > 80 ? `${cntSafety}% GUARANTEED` : ""}
            </text>

            {/* RIGHT shoot: SPEED */}
            <line x1="840" y1="170" x2={840 + dimLen2} y2="170" stroke={C.amber} strokeWidth="2" markerEnd="url(#arr)" />
            <rect x={840 + dimLen2} y="140" width="140" height="60"
              fill="url(#hatch)"
              stroke={dimLen2 > 80 ? C.amber : "transparent"}
              strokeWidth="1.5"
            />
            <text x={840 + dimLen2 + 6} y="168" fill={C.amber} fontSize="14" fontWeight="900" fontFamily="'JetBrains Mono', monospace">
              {dimLen2 > 80 ? "+ SPEED" : ""}
            </text>
            <text x={840 + dimLen2 + 6} y="186" fill={C.muted} fontSize="10" fontFamily="'JetBrains Mono', monospace">
              {dimLen2 > 80 ? `${cntSpeed}% PERF` : ""}
            </text>

            {/* TOP shoot: CONCURRENCY */}
            <line x1="440" y1="0" x2="440" y2={-dimLen3} stroke={C.cyan} strokeWidth="2" markerEnd="url(#arr)" />
            <rect x="360" y={-dimLen3 - 60} width="160" height="60"
              fill="url(#hatch)"
              stroke={dimLen3 > 40 ? C.cyan : "transparent"}
              strokeWidth="1.5"
            />
            <text x="368" y={-dimLen3 - 34} fill={C.cyan} fontSize="14" fontWeight="900" fontFamily="'JetBrains Mono', monospace">
              {dimLen3 > 40 ? "+ CONCURRENCY" : ""}
            </text>
            <text x="368" y={-dimLen3 - 16} fill={C.muted} fontSize="10" fontFamily="'JetBrains Mono', monospace">
              {dimLen3 > 40 ? `${cntConc} CORES` : ""}
            </text>
          </svg>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SCENE 4 — MOZILLA & SERVO 2009-2015  (F 840 – 1200)
// ─────────────────────────────────────────────────────────────────────────────
const Scene4: React.FC<{ lf: number; fps: number }> = ({ lf, fps }) => {
  /* Slight 90° perspective rotation effect via skewX */
  const rotSpr = spring({ frame: clamp(lf - 0, 0, 9999), fps, config: { damping: 16, stiffness: 70 } });
  const skewX  = interpolate(rotSpr, [0, 1], [8, 0]);
  const opacity = interpolate(lf, [0, 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* Parallel pipeline draws */
  const pipe1 = selfDraw(lf, 80, 160, 600);
  const pipe2 = selfDraw(lf, 95, 175, 600);
  const pipe3 = selfDraw(lf, 110, 190, 600);
  const pipe4 = selfDraw(lf, 125, 205, 600);

  /* Packet positions along pipelines */
  const pktT = (offset: number) => ((lf + offset) % 120) / 120;

  /* Odometer year */
  const yearVal = Math.floor(interpolate(lf, [240, 300], [2009, 2015], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  }));

  /* Speed counter */
  const speedNs = counterRoll(lf, 80, 200, 148.3, 1);

  return (
    <AbsoluteFill style={{ opacity, transform: `skewX(${skewX}deg)`, transformOrigin: "left center" }}>
      <div
        style={{
          position: "absolute",
          top: 100,
          left: 40,
          right: 56,
          bottom: 160,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 60,
        }}
      >
        <div style={{ fontSize: 13, color: C.amber, letterSpacing: "3px", fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", marginBottom: 10 }}>
          [ 04 // MOZILLA SPONSOR BRIEF ]
        </div>
        <h1
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 48,
            fontWeight: 900,
            textAlign: "center",
            margin: "0 0 24px",
            color: C.white,
            lineHeight: 1.2,
          }}
        >
          SERVO ENGINE // BROWSER CORE<br />
          <span style={{ color: C.amber }}>MOZILLA FOUNDATION 2009-2015</span>
        </h1>

        {/* Pipeline Section */}
        <div
          style={{
            position: "relative",
            width: 900,
            height: 440,
            border: `1.5px solid ${C.cyan}`,
            background: "rgba(4,16,26,0.92)",
            boxShadow: `0 0 30px rgba(0,229,255,0.1)`,
          }}
        >
          <svg width="900" height="440" viewBox="0 0 900 440">
            <defs>
              <marker id="pktArr" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill={C.cyan} />
              </marker>
            </defs>

            {/* Section labels */}
            <text x="16" y="50" fill={C.cyan} fontSize="11" fontWeight="800" fontFamily="'JetBrains Mono', monospace">THREAD POOL: SERVO PARALLEL LAYOUT ENGINE</text>
            <line x1="16" y1="58" x2="884" y2="58" stroke="rgba(0,229,255,0.25)" strokeWidth="1" />

            {/* 4 Parallel pipelines */}
            {[
              { y: 100, label: "THREAD-0: HTML PARSER", dash: pipe1, color: C.cyan },
              { y: 180, label: "THREAD-1: CSS ENGINE",  dash: pipe2, color: C.amber },
              { y: 260, label: "THREAD-2: LAYOUT CALC", dash: pipe3, color: C.cyan },
              { y: 340, label: "THREAD-3: COMPOSITOR",  dash: pipe4, color: C.amber },
            ].map((p, pi) => {
              const pkt = pktT(pi * 30);
              const pktX = 80 + pkt * 720;
              return (
                <g key={pi}>
                  <text x="20" y={p.y - 10} fill={p.color} fontSize="10" fontWeight="700" fontFamily="'JetBrains Mono', monospace">{p.label}</text>
                  {/* Rail */}
                  <rect x="80" y={p.y - 20} width="720" height="32"
                    fill="rgba(0,229,255,0.03)"
                    stroke={p.color}
                    strokeWidth="1.5"
                    strokeDasharray={600}
                    strokeDashoffset={p.dash}
                  />
                  {/* Data packet */}
                  {p.dash < 400 && (
                    <g>
                      <rect x={pktX - 18} y={p.y - 16} width="36" height="24"
                        fill={p.color}
                        opacity="0.85"
                      />
                      <text x={pktX - 13} y={p.y} fill={C.bg} fontSize="9" fontWeight="900" fontFamily="'JetBrains Mono', monospace">PKT</text>
                    </g>
                  )}
                  {/* Speed indicator */}
                  <text x="810" y={p.y} fill={C.muted} fontSize="9" fontFamily="'JetBrains Mono', monospace">{speedNs}ns</text>
                </g>
              );
            })}

            {/* No-collision indicator */}
            <line x1="80" y1="380" x2="800" y2="380" stroke={C.cyan} strokeWidth="1" strokeDasharray="4 4" />
            <text x="240" y="400" fill={C.cyan} fontSize="11" fontFamily="'JetBrains Mono', monospace">✓ ZERO DATA RACE — BORROW CHECKER ENFORCED</text>
          </svg>
        </div>

        {/* Odometer year block */}
        <div
          style={{
            marginTop: 20,
            display: "flex",
            alignItems: "center",
            gap: 16,
            border: `1.5px solid ${C.amber}`,
            background: "rgba(2,8,14,0.95)",
            padding: "14px 24px",
            width: 900,
          }}
        >
          <div style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>REVISION HISTORY // ODOMETER</div>
            <div style={{ fontSize: 28, color: C.amber, fontWeight: 900 }}>
              {yearVal} {yearVal < 2015 ? "— DEVELOPMENT PHASE" : "— RUST 1.0 RELEASED"}
            </div>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>
            <div style={{ fontSize: 10, color: C.muted }}>SPONSOR</div>
            <div style={{ fontSize: 18, color: C.white, fontWeight: 800 }}>MOZILLA FOUNDATION</div>
            <div style={{ fontSize: 11, color: C.cyan }}>BUDGET: PRODUCTION APPROVED</div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SCENE 5 — BORROW CHECKER INNOVATION  (F 1200 – 1560)
// ─────────────────────────────────────────────────────────────────────────────
const Scene5: React.FC<{ lf: number; fps: number }> = ({ lf, fps }) => {
  const opacity = interpolate(lf, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* Circuit morph in */
  const morphSpr = spring({ frame: clamp(lf - 0, 0, 9999), fps, config: { damping: 14, stiffness: 80 } });
  const morphScale = interpolate(morphSpr, [0, 1], [0.8, 1]);

  /* DATA_PTR movement across logic gates */
  const ptrProgress = interpolate(lf, [100, 350], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ptrX = interpolate(ptrProgress, [0, 0.4, 0.6, 1], [60, 360, 360, 700]);
  const ptrY = interpolate(ptrProgress, [0, 0.4, 0.6, 1], [180, 180, 280, 280]);

  /* Ownership cut animation */
  const cutProgress = interpolate(lf, [250, 310], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* Gate close animation */
  const gateClose = spring({ frame: clamp(lf - 280, 0, 9999), fps, config: { damping: 18, stiffness: 150 } });
  const gateBarW  = interpolate(gateClose, [0, 1], [0, 80]);

  /* STAMP drop animation */
  const stampSpr = spring({ frame: clamp(lf - 250, 0, 9999), fps, config: { damping: 10, stiffness: 200 } });
  const stampScale = interpolate(stampSpr, [0, 1], [3.0, 1.0]);
  const stampOpacity = interpolate(lf, [250, 265], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* Camera shake on stamp */
  const shakeAmt = interpolate(lf, [250, 260, 268, 280], [0, 6, 6, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const shakeX = Math.sin(lf * 7.3) * shakeAmt;
  const shakeY = Math.cos(lf * 6.1) * shakeAmt;

  return (
    <AbsoluteFill style={{ opacity, transform: `translate(${shakeX}px, ${shakeY}px)` }}>
      <div
        style={{
          position: "absolute",
          top: 100,
          left: 40,
          right: 56,
          bottom: 160,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 60,
        }}
      >
        <div style={{ fontSize: 13, color: C.cyan, letterSpacing: "3px", fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", marginBottom: 10 }}>
          [ 05 // BORROW CHECKER SCHEMATIC ]
        </div>
        <h1
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 48,
            fontWeight: 900,
            textAlign: "center",
            margin: "0 0 24px",
            color: C.white,
            lineHeight: 1.2,
          }}
        >
          BORROW CHECKER SYSTEM<br />
          <span style={{ color: C.cyan }}>COMPILE-TIME OWNERSHIP ENGINE</span>
        </h1>

        {/* Circuit diagram */}
        <div
          style={{
            position: "relative",
            width: 900,
            height: 480,
            border: `1.5px solid ${C.cyan}`,
            background: "rgba(4,16,26,0.92)",
            transform: `scale(${morphScale})`,
            transformOrigin: "center",
          }}
        >
          <svg width="900" height="480" viewBox="0 0 900 480">
            <defs>
              <marker id="bcArr" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" fill={C.cyan} />
              </marker>
            </defs>

            {/* Scope A block */}
            <rect x="30" y="120" width="200" height="120"
              fill={ptrProgress > 0.6 ? "rgba(0,229,255,0.03)" : "rgba(0,229,255,0.08)"}
              stroke={C.cyan} strokeWidth="2"
            />
            <text x="45" y="148" fill={C.cyan} fontSize="12" fontWeight="800" fontFamily="'JetBrains Mono', monospace">SCOPE A // OWNER</text>
            <text x="45" y="172" fill={C.white} fontSize="11" fontFamily="'JetBrains Mono', monospace">let x = DATA_PTR;</text>
            <text x="45" y="192" fill={C.muted} fontSize="10" fontFamily="'JetBrains Mono', monospace">lifetime: 'a</text>
            <text x="45" y="210" fill={cutProgress > 0.5 ? C.red : C.muted} fontSize="10" fontFamily="'JetBrains Mono', monospace">
              {cutProgress > 0.5 ? "MOVED → INVALIDATED" : "STATUS: VALID"}
            </text>

            {/* Logic gate: BORROW CHECK */}
            <rect x="350" y="100" width="200" height="80"
              fill="rgba(245,158,11,0.08)"
              stroke={C.amber} strokeWidth="2"
            />
            <text x="364" y="130" fill={C.amber} fontSize="11" fontWeight="900" fontFamily="'JetBrains Mono', monospace">◆ BORROW CHECKER</text>
            <text x="364" y="150" fill={C.white} fontSize="10" fontFamily="'JetBrains Mono', monospace">VERIFY OWNERSHIP</text>
            <text x="364" y="168" fill={C.muted} fontSize="9" fontFamily="'JetBrains Mono', monospace">LIFETIME ANALYSIS</text>

            {/* Scope B block */}
            <rect x="640" y="240" width="220" height="120"
              fill="rgba(0,229,255,0.08)"
              stroke={C.cyan} strokeWidth="2"
            />
            <text x="655" y="268" fill={C.cyan} fontSize="12" fontWeight="800" fontFamily="'JetBrains Mono', monospace">SCOPE B // RECEIVER</text>
            <text x="655" y="292" fill={C.white} fontSize="11" fontFamily="'JetBrains Mono', monospace">let y = move(x);</text>
            <text x="655" y="312" fill={C.cyan} fontSize="10" fontFamily="'JetBrains Mono', monospace">NEW OWNER</text>
            <text x="655" y="332" fill={C.muted} fontSize="10" fontFamily="'JetBrains Mono', monospace">lifetime: 'b</text>

            {/* INVALID ACCESS gate */}
            <rect x="350" y="280" width="200" height="80"
              fill="rgba(239,68,68,0.06)"
              stroke={C.red} strokeWidth="2"
            />
            <text x="364" y="310" fill={C.red} fontSize="11" fontWeight="900" fontFamily="'JetBrains Mono', monospace">⊗ INVALID ACCESS</text>
            <text x="364" y="330" fill={C.muted} fontSize="10" fontFamily="'JetBrains Mono', monospace">GATE: CLOSED</text>
            {/* Gate closing bar */}
            <rect x="350" y="340" width={gateBarW} height="8" fill={C.red} />
            <rect x={430 - gateBarW} y="340" width={gateBarW} height="8" fill={C.red} />

            {/* Data bus lines */}
            <line x1="230" y1="180" x2="350" y2="140" stroke={C.cyan} strokeWidth="2" markerEnd="url(#bcArr)" />
            <line x1="550" y1="140" x2="640" y2="270" stroke={C.cyan} strokeWidth="2" markerEnd="url(#bcArr)" />
            <line x1="230" y1="200" x2="350" y2="320" stroke="rgba(239,68,68,0.4)" strokeWidth="1.5" strokeDasharray="4 3" />

            {/* Moving DATA_PTR object */}
            {ptrProgress < 0.95 && (
              <g transform={`translate(${ptrX}, ${ptrY})`}>
                <rect x="-36" y="-18" width="72" height="36" fill={C.amber} />
                <text x="-28" y="7" fill={C.bg} fontSize="10" fontWeight="900" fontFamily="'JetBrains Mono', monospace">DATA_PTR</text>
              </g>
            )}

            {/* Ownership cut scissors */}
            {cutProgress > 0.3 && (
              <g transform={`translate(290, 185)`}>
                <line x1="-20" y1="0" x2="20" y2="0" stroke={C.red} strokeWidth="2.5" />
                <text x="-8" y="-6" fill={C.red} fontSize="14">✂</text>
                <text x="-30" y="16" fill={C.red} fontSize="9" fontFamily="'JetBrains Mono', monospace">MOVE</text>
              </g>
            )}

            {/* Bottom annotation */}
            <line x1="30" y1="440" x2="860" y2="440" stroke={C.cyan} strokeWidth="1.5" />
            <line x1="30" y1="432" x2="30" y2="448" stroke={C.cyan} strokeWidth="1.5" />
            <line x1="860" y1="432" x2="860" y2="448" stroke={C.cyan} strokeWidth="1.5" />
            <text x="240" y="460" fill={C.cyan} fontSize="11" fontFamily="'JetBrains Mono', monospace">
              |◄── ZERO RUNTIME COST // 100% COMPILE-TIME VERIFICATION ──►|
            </text>
          </svg>

          {/* MEMORY SAFE STAMP */}
          {stampOpacity > 0 && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: `translate(-50%, -50%) scale(${stampScale})`,
                opacity: stampOpacity,
                border: `4px solid ${C.cyan}`,
                padding: "18px 32px",
                background: "rgba(0,10,20,0.96)",
                textAlign: "center",
                pointerEvents: "none",
                boxShadow: `0 0 60px rgba(0,229,255,0.5)`,
              }}
            >
              <div style={{ fontSize: 11, color: C.amber, letterSpacing: "3px", fontFamily: "'JetBrains Mono', monospace", marginBottom: 6 }}>
                STATUS: VERIFIED
              </div>
              <div
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 26,
                  fontWeight: 900,
                  color: C.cyan,
                  textShadow: `0 0 20px rgba(0,229,255,0.8)`,
                }}
              >
                MEMORY SAFE<br />AT COMPILE TIME
              </div>
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SCENE 6 — ADOPSI GLOBAL & EPIC ZOOM-OUT  (F 1560 – 1800)
// ─────────────────────────────────────────────────────────────────────────────
const Scene6: React.FC<{ lf: number; fps: number }> = ({ lf, fps }) => {
  /* Epic zoom-out */
  const zoomSpr = spring({ frame: clamp(lf - 0, 0, 9999), fps, config: { damping: 18, stiffness: 60 } });
  const sceneScale = interpolate(zoomSpr, [0, 1], [1.8, 1]);
  const opacity = interpolate(lf, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* Gear rotation */
  const gearAngle = (lf * 0.6) % 360;
  const gear1Angle = (lf * -0.4) % 360;
  const gear2Angle = (lf * 0.35) % 360;

  /* Dimension arms for gear */
  const dimArm = spring({ frame: clamp(lf - 100, 0, 9999), fps, config: { damping: 12, stiffness: 100 } });
  const dimLen = interpolate(dimArm, [0, 1], [0, 120]);

  /* Final verdict flash */
  const verdictBlink = lf > 240 ? (Math.floor(lf / 6) % 2 === 0 ? 1 : 0.6) : 0;
  const verdictScale = spring({ frame: clamp(lf - 180, 0, 9999), fps, config: { damping: 12, stiffness: 100 } });
  const verdictS = interpolate(verdictScale, [0, 1], [0.7, 1]);

  /* Outer gear dimension counter */
  const diaCount = counterRoll(lf, 80, 160, 320.0, 1);

  const GearSvg: React.FC<{ cx: number; cy: number; r: number; teeth: number; color: string; angle: number }> = ({
    cx, cy, r, teeth, color, angle
  }) => {
    const toothH = r * 0.18;
    return (
      <g transform={`rotate(${angle}, ${cx}, ${cy})`}>
        {Array.from({ length: teeth }, (_, i) => {
          const a = (i * 360) / teeth;
          return (
            <rect
              key={i}
              x={cx - 6}
              y={cy - r - toothH}
              width={12}
              height={toothH}
              fill={color}
              transform={`rotate(${a}, ${cx}, ${cy})`}
            />
          );
        })}
        <circle cx={cx} cy={cy} r={r} fill={`${C.bg}`} stroke={color} strokeWidth={4} />
        {/* Spoke holes */}
        {Array.from({ length: 5 }, (_, i) => {
          const ra = (i * 72 * Math.PI) / 180;
          return (
            <circle key={i} cx={cx + Math.cos(ra) * r * 0.56} cy={cy + Math.sin(ra) * r * 0.56} r={r * 0.14}
              fill={C.bg} stroke={color} strokeWidth={2} />
          );
        })}
        <circle cx={cx} cy={cy} r={r * 0.28} fill="rgba(4,16,26,0.9)" stroke={C.amber} strokeWidth={3} />
      </g>
    );
  };

  return (
    <AbsoluteFill style={{ opacity, transform: `scale(${sceneScale})`, transformOrigin: "center" }}>
      <div
        style={{
          position: "absolute",
          top: 80,
          left: 40,
          right: 56,
          bottom: 100,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 30,
        }}
      >
        <div style={{ fontSize: 13, color: C.amber, letterSpacing: "3px", fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", marginBottom: 10 }}>
          [ 06 // GLOBAL INFRASTRUCTURE REGISTRY ]
        </div>
        <h1
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 44,
            fontWeight: 900,
            textAlign: "center",
            margin: "0 0 20px",
            color: C.white,
            lineHeight: 1.2,
          }}
        >
          DARI LIFT RUSAK<br />
          <span style={{ color: C.cyan }}>MENJADI STANDAR TEKNOLOGI DUNIA</span>
        </h1>

        {/* Gear System CAD */}
        <div
          style={{
            position: "relative",
            width: 900,
            height: 420,
            border: `1.5px solid ${C.cyan}`,
            background: "rgba(4,16,26,0.92)",
            boxShadow: `0 0 30px rgba(0,229,255,0.1)`,
            overflow: "visible",
          }}
        >
          <svg width="900" height="420" viewBox="0 0 900 420" style={{ overflow: "visible" }}>
            <defs>
              <marker id="dimArr" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto">
                <path d="M0,0 L7,3.5 L0,7 Z" fill={C.cyan} />
              </marker>
              <marker id="dimArrL" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto-start-reverse">
                <path d="M0,0 L7,3.5 L0,7 Z" fill={C.cyan} />
              </marker>
            </defs>

            {/* Center: Main Rust Gear (large) */}
            <GearSvg cx={450} cy={210} r={120} teeth={32} color={C.cyan} angle={gearAngle} />
            {/* Center R label */}
            <text x="436" y="220" fill={C.white} fontSize="36" fontWeight="900" fontFamily="'Inter', sans-serif"
              style={{ textShadow: `0 0 20px ${C.cyan}` }} transform={`rotate(${-gearAngle}, 450, 210)`}>R</text>

            {/* Small gear: LINUX KERNEL (top-left) */}
            <GearSvg cx={252} cy={100} r={68} teeth={20} color={C.amber} angle={gear1Angle} />
            <text x="204" y="96" fill={C.amber} fontSize="10" fontWeight="800" fontFamily="'JetBrains Mono', monospace">LINUX</text>
            <text x="204" y="110" fill={C.amber} fontSize="10" fontWeight="800" fontFamily="'JetBrains Mono', monospace">KERNEL</text>
            <text x="204" y="124" fill={C.muted} fontSize="9" fontFamily="'JetBrains Mono', monospace">v6.1+</text>

            {/* Small gear: WINDOWS CORE (top-right) */}
            <GearSvg cx={648} cy={100} r={68} teeth={20} color={C.amber} angle={gear2Angle} />
            <text x="664" y="96" fill={C.amber} fontSize="10" fontWeight="800" fontFamily="'JetBrains Mono', monospace">WINDOWS</text>
            <text x="664" y="110" fill={C.amber} fontSize="10" fontWeight="800" fontFamily="'JetBrains Mono', monospace">CORE</text>
            <text x="664" y="124" fill={C.muted} fontSize="9" fontFamily="'JetBrains Mono', monospace">MSRC</text>

            {/* Small gear: AWS CLOUD (bottom-center) */}
            <GearSvg cx={450} cy={370} r={50} teeth={16} color={C.cyan} angle={gear1Angle} />
            <text x="416" y="392" fill={C.cyan} fontSize="10" fontWeight="800" fontFamily="'JetBrains Mono', monospace">AWS CLOUD</text>

            {/* Dimension arms: outer diameter */}
            <line x1="330" y1="210" x2={330 - dimLen} y2="210" stroke={C.cyan} strokeWidth="1.5" markerEnd="url(#dimArrL)" />
            <line x1="570" y1="210" x2={570 + dimLen} y2="210" stroke={C.cyan} strokeWidth="1.5" markerEnd="url(#dimArr)" />
            <text x="440" y="172" fill={C.cyan} fontSize="10" fontFamily="'JetBrains Mono', monospace">Ø {diaCount} MM</text>
            <line x1="395" y1="176" x2="450" y2="176" stroke="rgba(0,229,255,0.4)" strokeWidth="1" strokeDasharray="4 3" />

            {/* Degree angle arcs on side gears */}
            <path d={`M${252 + 50},${100} A50,50 0 0,1 ${252},${100 - 50}`}
              fill="none" stroke={C.amber} strokeWidth="1" strokeDasharray="3 3" />
            <text x="266" y="62" fill={C.amber} fontSize="9" fontFamily="'JetBrains Mono', monospace">{Math.abs(gear1Angle % 360).toFixed(0)}°</text>

            {/* Contact point indicators between gears */}
            <circle cx={348} cy={152} r={5} fill={C.white} stroke={C.cyan} strokeWidth="1.5" />
            <circle cx={552} cy={152} r={5} fill={C.white} stroke={C.cyan} strokeWidth="1.5" />
            <circle cx={450} cy={320} r={5} fill={C.white} stroke={C.cyan} strokeWidth="1.5" />
          </svg>
        </div>

        {/* FINAL VERDICT BLOCK */}
        <div
          style={{
            marginTop: 18,
            width: 900,
            border: `2px solid ${C.cyan}`,
            background: "rgba(2,8,14,0.98)",
            padding: "18px 24px",
            textAlign: "center",
            transform: `scale(${verdictS})`,
            opacity: lf > 180 ? 1 : 0,
            boxShadow: `0 0 40px rgba(0,229,255,0.3)`,
          }}
        >
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              color: C.amber,
              letterSpacing: "3px",
              marginBottom: 8,
              opacity: verdictBlink,
            }}
          >
            [ FINAL VERDICT // BLUEPRINT CLOSED ]
          </div>
          <div
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 32,
              fontWeight: 900,
              color: C.white,
              textShadow: `0 0 20px rgba(0,229,255,0.5)`,
            }}
          >
            MOST LOVED LANGUAGE 9 YEARS IN A ROW
          </div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 13,
              color: C.cyan,
              marginTop: 8,
              letterSpacing: "2px",
            }}
          >
            VERDICT: END OF BLUEPRINT // SPEC-RUST-ORIGIN-2006-2024
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// CAMERA RIG — wraps each scene with 2D pan/zoom transitions
// ─────────────────────────────────────────────────────────────────────────────
interface CamRigProps {
  frame: number;
  sceneStart: number;
  sceneEnd: number;
  panXFrom?: number;
  panXTo?: number;
  panYFrom?: number;
  panYTo?: number;
  zoomFrom?: number;
  zoomTo?: number;
  children: React.ReactNode;
}
const CamRig: React.FC<CamRigProps> = ({
  frame,
  sceneStart,
  sceneEnd,
  panXFrom = 0,
  panXTo = 0,
  panYFrom = 0,
  panYTo = 0,
  zoomFrom = 1,
  zoomTo = 1,
  children,
}) => {
  const t = interpolate(frame, [sceneStart, sceneEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const px = interpolate(t, [0, 1], [panXFrom, panXTo]);
  const py = interpolate(t, [0, 1], [panYFrom, panYTo]);
  const zoom = interpolate(t, [0, 1], [zoomFrom, zoomTo]);
  return (
    <AbsoluteFill
      style={{
        transform: `translate(${px}px, ${py}px) scale(${zoom})`,
        transformOrigin: "center",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ROOT COMPOSITION
// ─────────────────────────────────────────────────────────────────────────────
export const RustBlueprintStoryComposition: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  /* Global camera pan across the "giant blueprint sheet" */
  const globalPanX = interpolate(frame, [0, 240, 540, 840, 1200, 1560, 1800], [0, -20, 30, -15, 20, 10, 0]);
  const globalPanY = interpolate(frame, [0, 240, 540, 840, 1200, 1560, 1800], [0, 10, -15, 20, -10, 5, 0]);
  const globalZoom = interpolate(frame, [0, 240, 540, 840, 1200, 1560, 1800], [1, 1.01, 0.99, 1.01, 0.99, 1, 0.97]);

  const currentScene = useMemo(() => {
    if (frame < 240) return 0;
    if (frame < 540) return 1;
    if (frame < 840) return 2;
    if (frame < 1200) return 3;
    if (frame < 1560) return 4;
    return 5;
  }, [frame]);

  return (
    <AbsoluteFill
      style={{
        background: C.bg,
        fontFamily: "'JetBrains Mono', 'Inter', monospace",
        overflow: "hidden",
      }}
    >
      {/* LAYER 1: Animated Blueprint Grid */}
      <BlueprintGrid panX={globalPanX} panY={globalPanY} scale={globalZoom} />

      {/* LAYER 2: Global Camera Rig */}
      <AbsoluteFill
        style={{
          transform: `translate(${globalPanX * 0.3}px, ${globalPanY * 0.3}px) scale(${globalZoom})`,
          transformOrigin: "center",
        }}
      >
        {/* SCENE 1 */}
        {frame >= 0 && frame < 240 && (
          <CamRig frame={frame} sceneStart={0} sceneEnd={240} panXFrom={0} panXTo={-10} zoomFrom={1} zoomTo={1.03}>
            <Scene1 lf={frame} fps={fps} />
          </CamRig>
        )}

        {/* SCENE 2 */}
        {frame >= 240 && frame < 540 && (
          <CamRig frame={frame} sceneStart={240} sceneEnd={540} panXFrom={0} panXTo={5} panYFrom={20} panYTo={0} zoomFrom={1.05} zoomTo={1}>
            <Scene2 lf={frame - 240} fps={fps} />
          </CamRig>
        )}

        {/* SCENE 3 */}
        {frame >= 540 && frame < 840 && (
          <CamRig frame={frame} sceneStart={540} sceneEnd={840} panXFrom={-40} panXTo={0} zoomFrom={0.96} zoomTo={1.02}>
            <Scene3 lf={frame - 540} fps={fps} />
          </CamRig>
        )}

        {/* SCENE 4 */}
        {frame >= 840 && frame < 1200 && (
          <CamRig frame={frame} sceneStart={840} sceneEnd={1200} panXFrom={30} panXTo={0} panYFrom={-20} panYTo={0} zoomFrom={0.97} zoomTo={1.01}>
            <Scene4 lf={frame - 840} fps={fps} />
          </CamRig>
        )}

        {/* SCENE 5 */}
        {frame >= 1200 && frame < 1560 && (
          <CamRig frame={frame} sceneStart={1200} sceneEnd={1560} panXFrom={0} panXTo={-8} panYFrom={0} panYTo={5} zoomFrom={0.98} zoomTo={1.02}>
            <Scene5 lf={frame - 1200} fps={fps} />
          </CamRig>
        )}

        {/* SCENE 6 */}
        {frame >= 1560 && frame <= 1800 && (
          <CamRig frame={frame} sceneStart={1560} sceneEnd={1800} panXFrom={0} panXTo={0} zoomFrom={1.1} zoomTo={1}>
            <Scene6 lf={frame - 1560} fps={fps} />
          </CamRig>
        )}
      </AbsoluteFill>

      {/* LAYER 3: Top HUD (always on top) */}
      <TopHud frame={frame} scene={currentScene} />

      {/* LAYER 4: Subtitle bar (always on top) */}
      <SubtitleBar frame={frame} />
    </AbsoluteFill>
  );
};

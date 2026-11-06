import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// Subtitle timeline segments in Bahasa Indonesia
interface CaptionSegment {
  startFrame: number;
  endFrame: number;
  text: string;
  highlightWord?: string;
}

const CAPTION_TIMELINE_ID: CaptionSegment[] = [
  // Scene 1: Vancouver 2006 Incident (Frames 0 - 405 | 0.0s - 13.5s)
  { startFrame: 3, endFrame: 75, text: "Tahun 2006 di Vancouver.", highlightWord: "2006" },
  { startFrame: 75, endFrame: 175, text: "Seorang insinyur bernama Graydon Hoare", highlightWord: "Graydon Hoare" },
  { startFrame: 175, endFrame: 252, text: "harus menaiki 21 lantai tangga apartemennya dengan ngos-ngosan.", highlightWord: "21 lantai" },
  { startFrame: 252, endFrame: 298, text: "Kenapa?", highlightWord: "Kenapa" },
  { startFrame: 298, endFrame: 405, text: "Karena lift gedung mendadak mati total akibat C++ memory leak!", highlightWord: "C++ memory leak" },

  // Scene 2: Kitchen Table Blueprint (Frames 405 - 625 | 13.5s - 20.8s)
  { startFrame: 405, endFrame: 490, text: "Kesal dengan software yang terus-menerus crash,", highlightWord: "crash" },
  { startFrame: 490, endFrame: 560, text: "malam itu dia duduk di meja dapurnya", highlightWord: "meja dapurnya" },
  { startFrame: 560, endFrame: 625, text: "dan mulai merancang blueprint sebuah bahasa baru: Rust.", highlightWord: "Rust" },

  // Scene 3: The Borrow Checker & Official Logo (Frames 625 - 905 | 20.8s - 30.1s)
  { startFrame: 625, endFrame: 729, text: "Idenya sangat revolusioner: The Borrow Checker!", highlightWord: "The Borrow Checker" },
  { startFrame: 729, endFrame: 815, text: "Menjamin keamanan memori seratus persen,", highlightWord: "seratus persen" },
  { startFrame: 815, endFrame: 905, text: "tanpa garbage collector, dan tanpa bikin sistem lemot.", highlightWord: "tanpa lemot" },

  // Scene 4: Global Adoption (Frames 905 - 1175 | 30.1s - 39.1s)
  { startFrame: 905, endFrame: 990, text: "Hari ini, berawal dari lift yang rusak,", highlightWord: "lift rusak" },
  { startFrame: 990, endFrame: 1080, text: "logo gear Rust ini telah menggerakkan Kernel Linux, Windows Core,", highlightWord: "Kernel Linux" },
  { startFrame: 1080, endFrame: 1175, text: "hingga server AWS di seluruh dunia!", highlightWord: "server AWS" },
];

export const RustBlueprintStoryComposition: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Active caption
  const currentCaption = useMemo(() => {
    return CAPTION_TIMELINE_ID.find(
      (c) => frame >= c.startFrame && frame <= c.endFrame
    );
  }, [frame]);

  // Audio waveform heights
  const waveformHeights = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => {
      const v = Math.sin(frame * 0.25 + i * 0.45) * 0.5 + 0.5;
      return Math.round(v * 16) + 4;
    });
  }, [frame]);

  return (
    <AbsoluteFill
      style={{
        background: "#080c10",
        color: "#ffffff",
        fontFamily: "'JetBrains Mono', 'Inter', monospace",
        overflow: "hidden",
      }}
    >
      {/* 1. DUAL AUDIO LAYERS */}
      <Audio src={staticFile("rust_voiceover.wav")} volume={1.0} />
      <Audio src={staticFile("ambient_bg.wav")} volume={0.25} />

      {/* 2. ENGINEERING MILLIMETER GRAPH PAPER (Exact Swiss CAD Style) */}
      <AbsoluteFill
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(0, 229, 255, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0, 229, 255, 0.05) 1px, transparent 1px),
            linear-gradient(to right, rgba(0, 229, 255, 0.12) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0, 229, 255, 0.12) 1px, transparent 1px)
          `,
          backgroundSize: "20px 20px, 20px 20px, 100px 100px, 100px 100px",
          pointerEvents: "none",
        }}
      />

      {/* Right-Side Precision Drafting Ruler (Like user's website Image 2) */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          right: "16px",
          width: "28px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px 0 160px 0",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "10px",
          color: "rgba(0, 229, 255, 0.4)",
          borderLeft: "1px solid rgba(0, 229, 255, 0.2)",
          paddingLeft: "6px",
          pointerEvents: "none",
          zIndex: 10,
        }}
      >
        {Array.from({ length: 18 }, (_, idx) => (
          <div key={idx} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <div style={{ width: "6px", height: "1px", background: "rgba(0, 229, 255, 0.4)" }} />
            <span>{idx * 10}</span>
          </div>
        ))}
      </div>

      {/* 3. TOP TELEMETRY BAR (Swiss Brutalist Header matching User Web) */}
      <div
        style={{
          position: "absolute",
          top: "48px",
          left: "48px",
          right: "64px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1.5px solid rgba(0, 229, 255, 0.3)",
          paddingBottom: "12px",
          zIndex: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "8px", height: "8px", background: "#f59e0b" }} />
          <span
            style={{
              fontSize: "13px",
              fontWeight: 800,
              letterSpacing: "2px",
              color: "#ffffff",
              textTransform: "uppercase",
            }}
          >
            SYS // BLUEPRINT [01] | SPEC: RUST-ORIGIN
          </span>
        </div>

        <div
          style={{
            fontSize: "12px",
            color: "#00e5ff",
            letterSpacing: "1.5px",
            fontWeight: 700,
          }}
        >
          CAD SCHEMATIC // 1080×1920
        </div>
      </div>

      {/* 4. DYNAMIC TECHNICAL SCENES */}

      {/* SCENE 1: CAD 21-FLOOR ELEVATION & ELEVATOR SHAFT FAILURE (Frames 0 - 405) */}
      {frame >= 0 && frame < 405 && (
        <SceneCadStairElevator localFrame={frame} />
      )}

      {/* SCENE 2: CAD MEMORY ARCHITECTURE BLUEPRINT (Frames 405 - 625) */}
      {frame >= 405 && frame < 625 && (
        <SceneCadMemoryLayout localFrame={frame - 405} fps={fps} />
      )}

      {/* SCENE 3: OFFICIAL RUST GEAR ORTHOGRAPHIC CAD BLUEPRINT (Frames 625 - 905) */}
      {frame >= 625 && frame < 905 && (
        <SceneCadRustGearBlueprint localFrame={frame - 625} fps={fps} />
      )}

      {/* SCENE 4: SWISS BRUTALIST ADOPTION MATRIX (Frames 905 - 1175) */}
      {frame >= 905 && frame <= 1175 && (
        <SceneCadAdoptionMatrix localFrame={frame - 905} fps={fps} />
      )}

      {/* 5. BOTTOM KINETIC SUBTITLE & STATUS BAR */}
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          zIndex: 30,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: "0 48px 56px 48px",
        }}
      >
        {currentCaption && (
          <div
            style={{
              background: "rgba(5, 12, 18, 0.95)",
              border: "1.5px solid #00e5ff",
              boxShadow: "0 0 30px rgba(0, 229, 255, 0.25)",
              padding: "20px 24px",
              marginBottom: "16px",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                color: "#f59e0b",
                letterSpacing: "2px",
                marginBottom: "6px",
                fontWeight: 800,
              }}
            >
              [ SUBTITLE // ID ]
            </div>
            <div
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: "32px",
                fontWeight: 900,
                lineHeight: 1.35,
                color: "#ffffff",
              }}
            >
              {currentCaption.text.split(" ").map((word, wIdx) => {
                const isHighlight =
                  currentCaption.highlightWord &&
                  currentCaption.highlightWord
                    .toLowerCase()
                    .includes(word.toLowerCase().replace(/[^a-z0-9]/g, ""));
                return (
                  <span
                    key={wIdx}
                    style={{
                      display: "inline-block",
                      margin: "0 4px",
                      color: isHighlight ? "#00e5ff" : "#ffffff",
                      textShadow: isHighlight
                        ? "0 0 20px rgba(0, 229, 255, 0.8)"
                        : "none",
                      fontWeight: isHighlight ? 900 : 700,
                    }}
                  >
                    {word}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer Spectrum & Frame Count */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid rgba(0, 229, 255, 0.2)",
            paddingTop: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height: "24px" }}>
            {waveformHeights.map((h, i) => (
              <div
                key={i}
                style={{
                  width: "4px",
                  height: `${h}px`,
                  background: i % 3 === 0 ? "#f59e0b" : "#00e5ff",
                }}
              />
            ))}
          </div>

          <div style={{ fontSize: "12px", color: "#64748b" }}>
            FRAME: {String(frame).padStart(4, "0")} / 1175 // FPS: 30
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* =========================================================================
   SCENE 1: CAD 21-FLOOR ELEVATION BLUEPRINT & SHAFT FAULT
   Pure CAD Drafting with dimension lines, elevation marker, and leader callouts
   ========================================================================= */
const SceneCadStairElevator: React.FC<{ localFrame: number }> = ({ localFrame }) => {
  // Elevation tracking Y coordinate (climbs upward smoothly)
  const currentFloor = Math.min(21, Math.floor(interpolate(localFrame, [0, 320], [1, 21])));
  const elevationMeters = (currentFloor * 3.4).toFixed(1);

  const trackerY = interpolate(localFrame, [0, 320], [520, 100], {
    extrapolateRight: "clamp",
  });

  const isFault = localFrame > 140;

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "140px 48px 200px 48px",
      }}
    >
      <div
        style={{
          fontSize: "14px",
          color: "#f59e0b",
          letterSpacing: "3px",
          marginBottom: "8px",
          fontWeight: 800,
        }}
      >
        [ 01 // ARCHITECTURAL ELEVATION ]
      </div>

      <h1
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: "56px",
          fontWeight: 900,
          lineHeight: 1.15,
          textAlign: "center",
          margin: "0 0 28px 0",
          letterSpacing: "-1px",
        }}
      >
        21-STORY SHAFT ELEVATION <br />
        <span style={{ color: "#00e5ff" }}>C++ MEMORY FAULT INCIDENT</span>
      </h1>

      {/* Main CAD Orthographic Drafting Window */}
      <div
        style={{
          position: "relative",
          width: "920px",
          height: "680px",
          border: "1.5px solid #00e5ff",
          background: "rgba(4, 16, 26, 0.92)",
          boxShadow: "0 0 35px rgba(0, 229, 255, 0.15)",
          padding: "24px",
        }}
      >
        {/* CAD SVG SCHEMATIC */}
        <svg width="872" height="520" viewBox="0 0 872 520" style={{ overflow: "visible" }}>
          {/* Dimension Line Left (Total Elevation 74.8m) */}
          <line x1="50" y1="80" x2="50" y2="500" stroke="#00e5ff" strokeWidth="1.5" />
          <line x1="42" y1="80" x2="58" y2="80" stroke="#00e5ff" strokeWidth="1.5" />
          <line x1="42" y1="500" x2="58" y2="500" stroke="#00e5ff" strokeWidth="1.5" />
          <text
            x="-300"
            y="38"
            fill="#00e5ff"
            fontSize="12"
            fontFamily="'JetBrains Mono', monospace"
            transform="rotate(-90)"
          >
            |◄── 74.8 METER ELEVATION (21 FLOORS) ──►|
          </text>

          {/* Floor Grid Horizontal Cross-Section Lines */}
          {Array.from({ length: 8 }, (_, i) => {
            const fy = 500 - i * 56;
            const floorNum = i === 7 ? 21 : i * 3 + 1;
            return (
              <g key={i}>
                <line x1="80" y1={fy} x2="800" y2={fy} stroke="rgba(0, 229, 255, 0.2)" strokeWidth="1" strokeDasharray="4 4" />
                <text x="85" y={fy - 6} fill="rgba(0, 229, 255, 0.6)" fontSize="11" fontFamily="'JetBrains Mono', monospace">
                  FL {String(floorNum).padStart(2, "0")}
                </text>
              </g>
            );
          })}

          {/* Stairwell Core B (Left Column CAD) */}
          <rect x="180" y="80" width="220" height="420" fill="none" stroke="#00e5ff" strokeWidth="1.5" />
          <text x="190" y="105" fill="#00e5ff" fontSize="12" fontWeight="800" fontFamily="'JetBrains Mono', monospace">
            SECTION B: STAIRWELL CORE
          </text>

          {/* Stepped Stair Vector Path */}
          <path
            d="M 190 490 L 220 490 L 220 434 L 260 434 L 260 378 L 300 378 L 300 322 L 340 322 L 340 266 L 380 266 L 380 90"
            fill="none"
            stroke="#00e5ff"
            strokeWidth="2"
          />

          {/* Dynamic CAD Elevation Crosshair Marker */}
          <g transform={`translate(285, ${trackerY})`}>
            <circle cx="0" cy="0" r="16" fill="rgba(0, 229, 255, 0.15)" stroke="#00e5ff" strokeWidth="2" />
            <line x1="-24" y1="0" x2="24" y2="0" stroke="#00e5ff" strokeWidth="1.5" />
            <line x1="0" y1="-24" x2="0" y2="24" stroke="#00e5ff" strokeWidth="1.5" />
            <circle cx="0" cy="0" r="3" fill="#f59e0b" />
            <text x="32" y="5" fill="#f59e0b" fontSize="12" fontWeight="800" fontFamily="'JetBrains Mono', monospace">
              ELEVATION: +{elevationMeters}m [FL {String(currentFloor).padStart(2, "0")}]
            </text>
          </g>

          {/* Elevator Shaft A-1 (Right Column CAD) */}
          <rect
            x="460"
            y="80"
            width="320"
            height="420"
            fill={isFault ? "rgba(239, 68, 68, 0.08)" : "none"}
            stroke={isFault ? "#ef4444" : "#00e5ff"}
            strokeWidth="1.5"
          />
          <text
            x="475"
            y="105"
            fill={isFault ? "#ef4444" : "#00e5ff"}
            fontSize="12"
            fontWeight="800"
            fontFamily="'JetBrains Mono', monospace"
          >
            SECTION A-1: TRACTION HOIST SHAFT
          </text>

          {/* Elevator Cabin at Floor 21 */}
          <rect
            x="500"
            y="130"
            width="240"
            height="110"
            fill="rgba(10, 20, 30, 0.95)"
            stroke={isFault ? "#ef4444" : "#00e5ff"}
            strokeWidth="2"
          />
          <text
            x="520"
            y="170"
            fill={isFault ? "#ef4444" : "#ffffff"}
            fontSize="14"
            fontWeight="800"
            fontFamily="'JetBrains Mono', monospace"
          >
            {isFault ? "⚠ LIFT DEADLOCK // MATI TOTAL" : "CAR #01: OPERATIONAL"}
          </text>
          <text
            x="520"
            y="195"
            fill="#94a3b8"
            fontSize="11"
            fontFamily="'JetBrains Mono', monospace"
          >
            HOIST MOTOR: FAULT CODE 0x00007FFF
          </text>

          {/* CAD Leader Callout Arrow to Fault */}
          <line x1="740" y1="185" x2="840" y2="185" stroke="#ef4444" strokeWidth="1.5" />
          <circle cx="740" cy="185" r="3" fill="#ef4444" />
          <text x="760" y="175" fill="#ef4444" fontSize="10" fontWeight="700" fontFamily="'JetBrains Mono', monospace">
            CALLOUT [A]
          </text>
        </svg>

        {/* CAD Blueprint Title Block at Bottom Right (Image 3 Style!) */}
        <div
          style={{
            position: "absolute",
            bottom: "16px",
            right: "24px",
            border: "1.5px solid #00e5ff",
            background: "rgba(2, 8, 14, 0.95)",
            padding: "12px 16px",
            width: "360px",
            fontSize: "11px",
            color: "#94a3b8",
            lineHeight: 1.5,
          }}
        >
          <div style={{ color: "#00e5ff", fontWeight: 800, borderBottom: "1px solid rgba(0,229,255,0.3)", paddingBottom: "4px", marginBottom: "4px" }}>
            ЧЕРТЕЖ / CAD DRAFT: SPEC-VANCOUVER-2006
          </div>
          <div>LOKASI: VANCOUVER RESIDENTIAL CORE B</div>
          <div>PENYEBAB: C++ DANGLING POINTER // HOIST CRASH</div>
          <div style={{ color: "#f59e0b", fontWeight: 700 }}>STATUS: MANUAL ASCENT VIA STAIRWELL</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* =========================================================================
   SCENE 2: CAD COMPILER & MEMORY ARCHITECTURE BLUEPRINT
   Pure CAD Drafting of Stack vs Heap Memory Allocation and Lifetime Bounds
   ========================================================================= */
const SceneCadMemoryLayout: React.FC<{ localFrame: number; fps: number }> = ({ localFrame, fps }) => {
  const enterScale = spring({
    frame: localFrame,
    fps,
    config: { damping: 14, stiffness: 85 },
  });

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "140px 48px 200px 48px",
        transform: `scale(${enterScale})`,
      }}
    >
      <div
        style={{
          fontSize: "14px",
          color: "#00e5ff",
          letterSpacing: "3px",
          marginBottom: "8px",
          fontWeight: 800,
        }}
      >
        [ 02 // MEMORY ARCHITECTURE DRAFT ]
      </div>

      <h1
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: "56px",
          fontWeight: 900,
          lineHeight: 1.15,
          textAlign: "center",
          margin: "0 0 28px 0",
          letterSpacing: "-1px",
        }}
      >
        THE KITCHEN BLUEPRINT <br />
        <span style={{ color: "#00e5ff" }}>MEMORY SAFETY SPECIFICATION</span>
      </h1>

      {/* Main CAD Window */}
      <div
        style={{
          position: "relative",
          width: "920px",
          height: "680px",
          border: "1.5px solid #00e5ff",
          background: "rgba(4, 16, 26, 0.92)",
          boxShadow: "0 0 35px rgba(0, 229, 255, 0.15)",
          padding: "24px",
        }}
      >
        <svg width="872" height="520" viewBox="0 0 872 520">
          {/* Top Memory Segment: STACK (Deterministic LIFO) */}
          <rect x="60" y="60" width="360" height="240" fill="none" stroke="#00e5ff" strokeWidth="1.5" />
          <text x="80" y="90" fill="#00e5ff" fontSize="13" fontWeight="800" fontFamily="'JetBrains Mono', monospace">
            SEGMENT 01: STACK FRAME [STATIC]
          </text>
          <line x1="60" y1="105" x2="420" y2="105" stroke="rgba(0,229,255,0.3)" strokeWidth="1" />
          
          <rect x="80" y="120" width="320" height="40" fill="rgba(0,229,255,0.08)" stroke="#00e5ff" strokeWidth="1" />
          <text x="95" y="145" fill="#ffffff" fontSize="11" fontFamily="'JetBrains Mono', monospace">
            0x7FFF0010: OWNER BINDING [mut x: String]
          </text>

          <rect x="80" y="180" width="320" height="40" fill="rgba(0,229,255,0.08)" stroke="#00e5ff" strokeWidth="1" />
          <text x="95" y="205" fill="#ffffff" fontSize="11" fontFamily="'JetBrains Mono', monospace">
            0x7FFF0020: BORROW REF [&amp;x: Lifetime 'a]
          </text>

          <text x="80" y="270" fill="#94a3b8" fontSize="11" fontFamily="'JetBrains Mono', monospace">
            DETERMINISTIC DROP: DEALLOCATE ON OUT-OF-SCOPE
          </text>

          {/* Bottom Memory Segment: HEAP BUFFER */}
          <rect x="460" y="60" width="360" height="240" fill="none" stroke="#f59e0b" strokeWidth="1.5" />
          <text x="480" y="90" fill="#f59e0b" fontSize="13" fontWeight="800" fontFamily="'JetBrains Mono', monospace">
            SEGMENT 02: DYNAMIC HEAP BUFFER
          </text>
          <line x1="460" y1="105" x2="820" y2="105" stroke="rgba(245,158,11,0.3)" strokeWidth="1" />

          <rect x="480" y="120" width="320" height="100" fill="rgba(245,158,11,0.08)" stroke="#f59e0b" strokeWidth="1" strokeDasharray="3 3" />
          <text x="500" y="150" fill="#ffffff" fontSize="12" fontFamily="'JetBrains Mono', monospace">
            RAW BUFFER: 1024 BYTES (ALLOC)
          </text>
          <text x="500" y="180" fill="#f59e0b" fontSize="11" fontFamily="'JetBrains Mono', monospace">
            EXCLUSIVE MUTABLE ACCESS ONLY
          </text>
          <text x="500" y="205" fill="#fca5a5" fontSize="10" fontFamily="'JetBrains Mono', monospace">
            C++ BUG: 2 POINTERS POINTING SAME HEAP
          </text>

          {/* Pointer Vector Arrow connecting Stack to Heap */}
          <path
            d="M 400 140 L 480 140"
            stroke="#00e5ff"
            strokeWidth="2.5"
            fill="none"
            markerEnd="url(#arrow)"
          />
          <circle cx="400" cy="140" r="4" fill="#00e5ff" />
          <circle cx="480" cy="140" r="4" fill="#00e5ff" />

          {/* Dimension Extension Line below */}
          <line x1="60" y1="330" x2="820" y2="330" stroke="#00e5ff" strokeWidth="1.5" />
          <line x1="60" y1="322" x2="60" y2="338" stroke="#00e5ff" strokeWidth="1.5" />
          <line x1="820" y1="322" x2="820" y2="338" stroke="#00e5ff" strokeWidth="1.5" />
          <text x="340" y="350" fill="#00e5ff" fontSize="11" fontFamily="'JetBrains Mono', monospace">
            |◄── ZERO-COST COMPILE-TIME VERIFICATION ──►|
          </text>
        </svg>

        {/* CAD Title Block */}
        <div
          style={{
            position: "absolute",
            bottom: "16px",
            right: "24px",
            border: "1.5px solid #00e5ff",
            background: "rgba(2, 8, 14, 0.95)",
            padding: "12px 16px",
            width: "360px",
            fontSize: "11px",
            color: "#94a3b8",
            lineHeight: 1.5,
          }}
        >
          <div style={{ color: "#00e5ff", fontWeight: 800, borderBottom: "1px solid rgba(0,229,255,0.3)", paddingBottom: "4px", marginBottom: "4px" }}>
            DRAFT: RUST COMPILER SPECIFICATION // 2006
          </div>
          <div>DESIGNER: GRAYDON HOARE (VANCOUVER)</div>
          <div>INNOVATION: STATIC OWNERSHIP &amp; LIFETIMES</div>
          <div style={{ color: "#f59e0b", fontWeight: 700 }}>RUNTIME OVERHEAD: EXACTLY 0.00 MS</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* =========================================================================
   SCENE 3: THE OFFICIAL RUST GEAR ORTHOGRAPHIC CAD BLUEPRINT
   Authentic technical drawing of the Rust Cogwheel Gear (Image 3 iPhone style)
   ========================================================================= */
const SceneCadRustGearBlueprint: React.FC<{ localFrame: number; fps: number }> = ({ localFrame, fps }) => {
  const enterScale = spring({
    frame: localFrame,
    fps,
    config: { damping: 12, stiffness: 90 },
  });

  const gearAngle = (localFrame * 0.8) % 360;

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "140px 48px 200px 48px",
        transform: `scale(${enterScale})`,
      }}
    >
      <div
        style={{
          fontSize: "14px",
          color: "#f59e0b",
          letterSpacing: "3px",
          marginBottom: "8px",
          fontWeight: 800,
        }}
      >
        [ 03 // ORTHOGRAPHIC PART BLUEPRINT ]
      </div>

      <h1
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: "56px",
          fontWeight: 900,
          lineHeight: 1.15,
          textAlign: "center",
          margin: "0 0 28px 0",
          letterSpacing: "-1px",
        }}
      >
        OFFICIAL RUST COGWHEEL <br />
        <span style={{ color: "#00e5ff" }}>CAD TECHNICAL SCHEMATIC</span>
      </h1>

      {/* Main CAD Window */}
      <div
        style={{
          position: "relative",
          width: "920px",
          height: "680px",
          border: "1.5px solid #00e5ff",
          background: "rgba(4, 16, 26, 0.92)",
          boxShadow: "0 0 35px rgba(0, 229, 255, 0.15)",
          padding: "24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Left Side: Orthographic CAD Gear with Rotating Teeth and Dimension Extension Lines */}
        <div style={{ position: "relative", width: "480px", height: "480px" }}>
          {/* Dimension Lines (Orthographic drafting layout matching Image 3) */}
          <svg width="480" height="480" viewBox="0 0 480 480" style={{ position: "absolute", top: 0, left: 0 }}>
            {/* Top Dimension Arrow: 320 mm */}
            <line x1="80" y1="30" x2="400" y2="30" stroke="#00e5ff" strokeWidth="1.5" />
            <line x1="80" y1="22" x2="80" y2="38" stroke="#00e5ff" strokeWidth="1.5" />
            <line x1="400" y1="22" x2="400" y2="38" stroke="#00e5ff" strokeWidth="1.5" />
            <text x="180" y="24" fill="#00e5ff" fontSize="11" fontFamily="'JetBrains Mono', monospace">
              Ø 320.0 MM (OUTER DIA)
            </text>

            {/* Left Dimension Arrow: 320 mm */}
            <line x1="30" y1="80" x2="30" y2="400" stroke="#00e5ff" strokeWidth="1.5" />
            <line x1="22" y1="80" x2="38" y2="80" stroke="#00e5ff" strokeWidth="1.5" />
            <line x1="22" y1="400" x2="38" y2="400" stroke="#00e5ff" strokeWidth="1.5" />
            <text x="-280" y="22" fill="#00e5ff" fontSize="11" fontFamily="'JetBrains Mono', monospace" transform="rotate(-90)">
              Ø 320.0 MM (HEIGHT)
            </text>

            {/* Crosshair Center Lines */}
            <line x1="40" y1="240" x2="440" y2="240" stroke="rgba(0,229,255,0.3)" strokeWidth="1" strokeDasharray="6 4" />
            <line x1="240" y1="40" x2="240" y2="440" stroke="rgba(0,229,255,0.3)" strokeWidth="1" strokeDasharray="6 4" />
          </svg>

          {/* ROTATING RUST COGWHEEL SVG */}
          <div style={{ position: "absolute", top: "80px", left: "80px", width: "320px", height: "320px" }}>
            <svg
              width="320"
              height="320"
              viewBox="0 0 320 320"
              style={{
                transform: `rotate(${gearAngle}deg)`,
                filter: "drop-shadow(0 0 15px rgba(0, 229, 255, 0.5))",
              }}
            >
              {/* 32 Precision Gear Teeth */}
              {Array.from({ length: 32 }, (_, i) => {
                const angle = (i * 360) / 32;
                return (
                  <rect
                    key={i}
                    x="153"
                    y="8"
                    width="14"
                    height="22"
                    fill="#00e5ff"
                    stroke="#ffffff"
                    strokeWidth="1"
                    transform={`rotate(${angle} 160 160)`}
                  />
                );
              })}

              {/* Outer Rim */}
              <circle cx="160" cy="160" r="136" fill="#05121e" stroke="#00e5ff" strokeWidth="6" />

              {/* 5 Circular Holes (Authentic Rust Geometry) */}
              {Array.from({ length: 5 }, (_, i) => {
                const rad = (i * 72 * Math.PI) / 180;
                const hx = 160 + Math.cos(rad) * 80;
                const hy = 160 + Math.sin(rad) * 80;
                return (
                  <circle
                    key={i}
                    cx={hx}
                    cy={hy}
                    r="24"
                    fill="#02080e"
                    stroke="#00e5ff"
                    strokeWidth="3"
                  />
                );
              })}

              {/* Inner Hub Ring */}
              <circle cx="160" cy="160" r="48" fill="#081c2e" stroke="#f59e0b" strokeWidth="3.5" />
            </svg>

            {/* Central Stylized 'R' Letter */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'Inter', sans-serif",
                fontSize: "100px",
                fontWeight: 900,
                color: "#ffffff",
                textShadow: "0 0 25px #00e5ff",
                userSelect: "none",
              }}
            >
              R
            </div>
          </div>
        </div>

        {/* Right Side: CAD Component Callout Leader Specs */}
        <div style={{ flex: 1, paddingLeft: "32px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              border: "1px solid #00e5ff",
              background: "rgba(2, 8, 14, 0.9)",
              padding: "16px",
            }}
          >
            <div style={{ fontSize: "11px", color: "#f59e0b", fontWeight: 800 }}>
              CALLOUT [01] // COGWHEEL TEETH
            </div>
            <div style={{ fontSize: "16px", fontWeight: 800, color: "#ffffff", marginTop: "4px" }}>
              32 Precision Mod 2.5 Teeth
            </div>
            <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
              Radial spacing 11.25°. Simbol transmisi performa bare-metal setara C++.
            </div>
          </div>

          <div
            style={{
              border: "1px solid #00e5ff",
              background: "rgba(2, 8, 14, 0.9)",
              padding: "16px",
            }}
          >
            <div style={{ fontSize: "11px", color: "#00e5ff", fontWeight: 800 }}>
              CALLOUT [02] // BORROW CHECKER HUB
            </div>
            <div style={{ fontSize: "16px", fontWeight: 800, color: "#ffffff", marginTop: "4px" }}>
              Static Memory Ownership
            </div>
            <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
              Garansi keamanan memori 100% tanpa garbage collector dan latensi 0.00ms.
            </div>
          </div>

          {/* Bottom Title Block (Image 3 Style) */}
          <div
            style={{
              border: "1.5px solid #00e5ff",
              background: "rgba(2, 8, 14, 0.95)",
              padding: "12px 16px",
              fontSize: "11px",
              color: "#94a3b8",
              lineHeight: 1.5,
            }}
          >
            <div style={{ color: "#00e5ff", fontWeight: 800, borderBottom: "1px solid rgba(0,229,255,0.3)", paddingBottom: "4px", marginBottom: "4px" }}>
              ЧЕРТЕЖ: RUST OFFICIAL LOGO SPEC (2015)
            </div>
            <div>ORGANISASI: RUST FOUNDATION // MOZILLA</div>
            <div>TOLERANCE: ZERO RUNTIME OVERHEAD (±0.00ms)</div>
            <div style={{ color: "#f59e0b", fontWeight: 700 }}>STATUS: PRODUCTION APPROVED</div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* =========================================================================
   SCENE 4: SWISS BRUTALIST ADOPTION MATRIX (Matching User Website Image 2)
   High contrast, graph background, clean borders, and industrial status tags
   ========================================================================= */
const SceneCadAdoptionMatrix: React.FC<{ localFrame: number; fps: number }> = ({ localFrame, fps }) => {
  const enterScale = spring({
    frame: localFrame,
    fps,
    config: { damping: 12, stiffness: 90 },
  });

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "140px 48px 200px 48px",
        transform: `scale(${enterScale})`,
      }}
    >
      <div
        style={{
          fontSize: "14px",
          color: "#f59e0b",
          letterSpacing: "3px",
          marginBottom: "8px",
          fontWeight: 800,
        }}
      >
        [ 04 // GLOBAL INFRASTRUCTURE REGISTRY ]
      </div>

      <h1
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: "56px",
          fontWeight: 900,
          lineHeight: 1.15,
          textAlign: "center",
          margin: "0 0 28px 0",
          letterSpacing: "-1px",
        }}
      >
        DARI SEBUAH LIFT RUSAK <br />
        <span style={{ color: "#00e5ff" }}>MENJADI STANDAR TEKNOLOGI DUNIA</span>
      </h1>

      {/* Cards structured identically to user's website Image 2 */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          width: "920px",
        }}
      >
        {[
          {
            index: "SYS // CREDENTIAL [01]",
            title: "Linux Kernel 6.1+",
            subtitle: "Linus Torvalds & The Linux Foundation",
            badge: "KERNEL LEVEL",
            desc: "Bahasa kedua yang resmi diizinkan masuk ke kode Kernel Linux setelah C selama lebih dari 30 tahun sejarah komputasi modern.",
          },
          {
            index: "SYS // CREDENTIAL [02]",
            title: "Microsoft Windows Core",
            subtitle: "Microsoft Security Response Center (MSRC)",
            badge: "OS ARCHITECTURE",
            desc: "Komponen inti grafis GDI dan kernel Windows ditulis ulang menggunakan Rust untuk melenyapkan 70% celah keamanan memori.",
          },
          {
            index: "SYS // CREDENTIAL [03]",
            title: "Amazon AWS Cloud Infrastructure",
            subtitle: "AWS Serverless & Firecracker MicroVMs",
            badge: "HYPERSCALE CLOUD",
            desc: "Menopang miliaran server cloud di dunia lewat teknologi Firecracker microVM yang mengeksekusi AWS Lambda secepat kilat.",
          },
        ].map((item) => (
          <div
            key={item.title}
            style={{
              background: "rgba(4, 16, 26, 0.95)",
              border: "1.5px solid #00e5ff",
              boxShadow: "0 0 25px rgba(0, 229, 255, 0.15)",
              padding: "20px 24px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
                <span style={{ fontSize: "11px", color: "rgba(0, 229, 255, 0.7)", fontWeight: 700 }}>
                  {item.index}
                </span>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 900,
                    color: "#031424",
                    background: "#f59e0b",
                    padding: "2px 8px",
                  }}
                >
                  {item.badge}
                </span>
              </div>

              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "24px", fontWeight: 900, color: "#ffffff" }}>
                {item.title}
              </div>
              <div style={{ fontSize: "12px", color: "#00e5ff", marginTop: "2px" }}>
                {item.subtitle}
              </div>
              <div style={{ fontSize: "13px", color: "#94a3b8", marginTop: "6px", maxWidth: "700px" }}>
                {item.desc}
              </div>
            </div>

            <div
              style={{
                width: "44px",
                height: "44px",
                border: "1.5px solid #00e5ff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#00e5ff",
                fontSize: "20px",
                fontWeight: 900,
              }}
            >
              ✓
            </div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

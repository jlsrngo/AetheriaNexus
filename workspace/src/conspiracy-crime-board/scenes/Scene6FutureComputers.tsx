import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { spring, interpolate, staticFile, Img } from "remotion";
import { ArchivalBackground } from "../components/ArchivalBackground";
import { BottomArchivalTitle } from "../components/BottomArchivalTitle";

const SCALE = 2.7692;
const u = (px: number) => px * SCALE;

export const Scene6FutureComputers: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Cards staggered drop
  const c1Spr = spring({ frame: Math.max(0, frame - 8), fps, config: { damping: 15, stiffness: 80, mass: 0.9 } });
  const c2Spr = spring({ frame: Math.max(0, frame - 22), fps, config: { damping: 15, stiffness: 80, mass: 0.9 } });
  const c3Spr = spring({ frame: Math.max(0, frame - 36), fps, config: { damping: 14, stiffness: 75, mass: 0.95 } });

  const mk = (spr: any) => ({
    y: interpolate(spr, [0, 1], [-260, 0]),
    s: interpolate(spr, [0, 1], [1.3, 1]),
    o: interpolate(spr, [0, 0.4, 1], [0, 1, 1]),
  });

  const c1 = mk(c1Spr);
  const c2 = mk(c2Spr);
  const c3 = mk(c3Spr);

  // Pulse effect on Turing Test title
  const pulse = 1 + Math.sin(frame * 0.15) * 0.04;

  // Scanning line animation
  const scanY = interpolate(frame % 90, [0, 90], [u(100), u(500)], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        position: "relative",
        width: 1080,
        height: 1920,
        overflow: "hidden",
        backgroundColor: "#070709",
      }}
    >
      <ArchivalBackground spotlightGlow={true} />

      {/* Header */}
      <div
        style={{
          position: "absolute",
          top: u(28),
          left: 0,
          right: 0,
          zIndex: 50,
          textAlign: "center",
          transform: `translateY(${interpolate(frame, [0, 6], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)`,
          opacity: interpolate(frame, [0, 6, 18], [0, 0, 1]),
        }}
      >
        <div
          style={{
            backgroundColor: "#22c55e",
            padding: "6px 28px",
            borderRadius: 6,
            border: "2px solid #1c1815",
            boxShadow: "0 8px 24px rgba(0,0,0,0.85)",
            display: "inline-block",
          }}
        >
          <span style={{ fontFamily: "'Courier Prime', monospace", fontWeight: 900, fontSize: u(14), color: "#181410", letterSpacing: 3, textTransform: "uppercase" }}>
            ★ WARISAN INTELEGENSIA BUATAN ★
          </span>
        </div>
      </div>

      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: u(95),
          left: 0,
          right: 0,
          zIndex: 55,
          textAlign: "center",
          fontFamily: "'Anton', sans-serif",
          fontSize: u(44),
          color: "#F5F0E4",
          letterSpacing: u(3),
          textTransform: "uppercase",
          transform: `translateY(${interpolate(frame, [0, 10], [-40, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)`,
          opacity: interpolate(frame, [0, 10, 20], [0, 0, 1]),
          textShadow: "2px 3px 0 rgba(34,197,94,0.3)",
        }}
      >
        Masa Depan &amp; Turing Test
      </div>

      {/* Card 1: AI Concept */}
      <div
        style={{
          position: "absolute",
          top: u(240),
          left: u(50),
          width: u(440),
          zIndex: 22,
          transform: `translateY(${c1.y}px) scale(${c1.s}) rotate(-3deg)`,
          opacity: c1.o,
        }}
      >
        <EvidenceCard label="Konsep AI" note="ARTIFICIAL INTELLIGENCE 1950" handwritten="Turing merumuskan: dapat mesin berpikir?" accentColor="#22c55e">
          <div style={{ width: "100%", height: u(220), background: "#1a1612", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: u(14), padding: u(20) }}>
            {/* Neural network visualization */}
            <svg width={u(320)} height={u(160)} viewBox="0 0 320 160">
              {/* Connections */}
              {[0, 1, 2].map(i =>
                [0, 1, 2].map(j => (
                  <line
                    key={`l-${i}-${j}`}
                    x1={50 + i * 50}
                    y1={80}
                    x2={180 + j * 40}
                    y2={40 + (j - 1) * 40}
                    stroke="#22c55e"
                    strokeWidth={1}
                    opacity={0.4}
                  />
                ))
              )}
              {/* Input nodes */}
              {[0, 1, 2].map(i => (
                <circle key={`in-${i}`} cx={50 + i * 50} cy={80} r={12} fill="#1a1612" stroke="#22c55e" strokeWidth={2}>
                  <animate attributeName="r" values="12;14;12" dur={`${1 + i * 0.2}s`} repeatCount="indefinite" />
                </circle>
              ))}
              {/* Output nodes */}
              {[0, 1, 2].map(i => (
                <circle key={`out-${i}`} cx={180 + i * 40} cy={40 + (i - 1) * 40} r={12} fill="#1a1612" stroke="#22c55e" strokeWidth={2}>
                  <animate attributeName="r" values="12;15;12" dur={`${1.2 + i * 0.15}s`} repeatCount="indefinite" />
                </circle>
              ))}
              <text x={160} y={150} fill="#8c7b64" fontSize={10} fontFamily="monospace" textAnchor="middle">NEURAL ARCHITECTURE CONCEPT</text>
            </svg>
            <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: u(13), color: "#22c55e", textAlign: "center" }}>
              {"« CAN MACHINES THINK? »"}
            </div>
          </div>
        </EvidenceCard>
      </div>

      {/* Card 2: Computing legacy */}
      <div
        style={{
          position: "absolute",
          top: u(240),
          left: u(590),
          width: u(440),
          zIndex: 23,
          transform: `translateY(${c2.y}px) scale(${c2.s}) rotate(3deg)`,
          opacity: c2.o,
        }}
      >
        <EvidenceCard label="Warisan Komputer" note="FATHER OF COMPUTING" handwritten="Konsep stored-program computer" accentColor="#F59E0B">
          <div style={{ width: "100%", height: u(220), background: "#1a1612", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: u(12), padding: u(20) }}>
            {/* Timeline */}
            <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: u(13), color: "#F59E0B", letterSpacing: u(2) }}>TIMELINE</div>
            {[
              { year: "1936", event: "Paper: Concepts of BC" },
              { year: "1945", event: "ACE Proposal" },
              { year: "1950", event: "Computing Machinery & AI" },
              { year: "1950", event: "Imitation Game Test" },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", gap: u(12), alignItems: "center", width: "100%" }}>
                <div style={{ fontFamily: "'Anton', sans-serif", fontSize: u(16), color: "#DC2626", minWidth: u(60) }}>{item.year}</div>
                <div style={{ width: u(30), height: 2, background: "#8c7b64" }} />
                <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: u(12), color: "#F5F0E4" }}>{item.event}</div>
              </div>
            ))}
          </div>
        </EvidenceCard>
      </div>

      {/* HERO CARD: Turing Test */}
      <div
        style={{
          position: "absolute",
          top: u(720),
          left: "50%",
          transform: `translateX(-50%) translateY(${c3.y}px) scale(${c3.s}) rotate(${interpolate(c3.y, [-260, 0], [4, 0])}deg)`,
          width: u(860),
          zIndex: 50,
          opacity: c3.o,
        }}
      >
        <EvidenceCard label="⬛ TURING TEST 1950" note="THE IMITATION GAME" handwritten="Jika mesin bisa berkhotbah setara manusia..." accentColor="#22c55e">
          <div style={{ width: "100%", padding: u(24), display: "flex", flexDirection: "column", alignItems: "center", gap: u(20) }}>
            {/* Question mark pulsing */}
            <div
              style={{
                fontFamily: "'Anton', sans-serif",
                fontSize: u(120),
                color: "#22c55e",
                transform: `scale(${pulse})`,
                textShadow: "0 0 30px rgba(34,197,94,0.5), 4px 4px 0 rgba(0,0,0,0.5)",
                letterSpacing: u(10),
              }}
            >
              ?
            </div>
            <div
              style={{
                fontFamily: "'Caveat', cursive",
                fontSize: u(28),
                color: "#F5F0E4",
                textAlign: "center",
                lineHeight: 1.4,
              }}
            >
              "Apakah mesin dapat berpikir?<br />Atau cukup membuat manusia<br />percaya bahwa ia manusia?"
            </div>
            {/* Scanning line effect */}
            <div
              style={{
                position: "relative",
                width: "100%",
                height: u(3),
                background: "linear-gradient(90deg, transparent, #22c55e, transparent)",
                opacity: 0.6,
                boxShadow: "0 0 15px #22c55e",
              }}
            />
            <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: u(13), color: "#8c7b64", textAlign: "center", letterSpacing: u(2) }}>
              PUBLICATION: "COMPUTING MACHINERY AND INTELLIGENCE"<br />
              JOURNAL: MIND, OCTOBER 1950
            </div>
          </div>
        </EvidenceCard>
      </div>

      {/* Red threads */}
      {frame > 45 && (
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 60, pointerEvents: "none" }} viewBox="0 0 1080 1920">
          <path d={`M ${u(270)} ${u(460)} Q ${u(300)} ${u(600)} ${u(430)} ${u(800)}`} stroke="#D32F2F" strokeWidth={2} fill="none" strokeDasharray="400" strokeDashoffset={interpolate(frame, [45, 80], [400, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.9))" }} />
          <path d={`M ${u(810)} ${u(460)} Q ${u(780)} ${u(600)} ${u(650)} ${u(800)}`} stroke="#D32F2F" strokeWidth={2} fill="none" strokeDasharray="400" strokeDashoffset={interpolate(frame, [50, 85], [400, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.9))" }} />
        </svg>
      )}
      {frame > 50 && <Pushpin x={u(430)} y={u(800)} frame={frame} />}
      {frame > 52 && <Pushpin x={u(650)} y={u(800)} frame={frame} />}

      <BottomArchivalTitle
        frame={frame}
        fps={fps}
        title="TURING TEST"
        dateMarker="1950"
        subnote="Ia pun merumuskan konsep Artificial Intelligence. Di tahun sembilan belas lima puluh, ia mengajukan Turing Test legendaris."
        startFrame={100}
      />
    </div>
  );
};

const EvidenceCard: React.FC<{
  label: string;
  note: string;
  handwritten: string;
  accentColor?: string;
  children: React.ReactNode;
}> = ({ label, note, handwritten, accentColor = "#F59E0B", children }) => (
  <div
    style={{
      backgroundColor: "#F5F0E4",
      borderRadius: u(4),
      padding: `${u(12)} ${u(12)} ${u(48)} ${u(12)}`,
      boxShadow: "0 20px 50px rgba(0,0,0,0.85), inset 0 0 25px rgba(120,90,50,0.15)",
      border: "1px solid rgba(168,152,128,0.8)",
      position: "relative",
    }}
  >
    <div
      style={{
        position: "absolute",
        top: -u(8),
        left: u(14),
        backgroundColor: accentColor,
        padding: `${u(4)} ${u(12)}`,
        borderRadius: u(3),
        fontFamily: "'Courier Prime', monospace",
        fontSize: u(13),
        fontWeight: 700,
        color: accentColor === "#DC2626" ? "#F5F0E4" : accentColor === "#22c55e" ? "#181410" : "#181410",
        letterSpacing: u(2),
        transform: "rotate(-2deg)",
        boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
      }}
    >
      {label}
    </div>
    {children}
    <div style={{ position: "absolute", bottom: u(8), left: u(12), right: u(12), fontFamily: "'Caveat', cursive", fontSize: u(19), color: "#5a4a3a", transform: "rotate(-1deg)" }}>
      {handwritten}
    </div>
    <div style={{ position: "absolute", bottom: u(3), right: u(12), fontFamily: "'Courier Prime', monospace", fontSize: u(11), color: "#8c7b64", letterSpacing: u(1), textTransform: "uppercase" }}>
      {note}
    </div>
  </div>
);

const Pushpin: React.FC<{ x: number; y: number; frame: number }> = ({ x, y, frame }) => {
  const spr = spring({ frame: Math.max(0, frame - 2), fps: 30, config: { damping: 10, stiffness: 120, mass: 0.6 } });
  const s = interpolate(spr, [0, 0.6, 1], [1.6, 0.9, 1]);
  return (
    <div
      style={{
        position: "absolute",
        left: x - u(10),
        top: y - u(10),
        width: u(20),
        height: u(20),
        borderRadius: "50%",
        background: "radial-gradient(circle at 35% 35%, #ff6b6b, #DC2626, #7f1d1d)",
        boxShadow: "0 3px 8px rgba(0,0,0,0.7), inset 0 1px 3px rgba(255,255,255,0.3)",
        transform: `scale(${s})`,
        zIndex: 70,
      }}
    />
  );
};

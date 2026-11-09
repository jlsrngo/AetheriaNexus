import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { spring, interpolate, staticFile, Img } from "remotion";
import { ArchivalBackground } from "../components/ArchivalBackground";
import { BottomArchivalTitle } from "../components/BottomArchivalTitle";

const SCALE = 2.7692;
const u = (px: number) => px * SCALE;

export const Scene8LegacyPardon: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Gentle, hopeful motion — slower springs
  const card1Spr = spring({ frame: Math.max(0, frame - 8), fps, config: { damping: 18, stiffness: 60, mass: 0.8 } });
  const card2Spr = spring({ frame: Math.max(0, frame - 24), fps, config: { damping: 18, stiffness: 60, mass: 0.8 } });
  const heroSpr = spring({ frame: Math.max(0, frame - 40), fps, config: { damping: 14, stiffness: 70, mass: 0.9 } });

  const mk = (spr: any) => ({
    y: interpolate(spr, [0, 1], [-260, 0]),
    s: interpolate(spr, [0, 1], [1.3, 1]),
    o: interpolate(spr, [0, 0.4, 1], [0, 1, 1]),
  });

  const c1 = mk(card1Spr);
  const c2 = mk(card2Spr);
  const h = mk(heroSpr);

  // Golden glow pulse on hero
  const goldPulse = 0.3 + Math.sin(frame * 0.08) * 0.15;

  // Royal pardon stamp
  const stampSpr = spring({ frame: Math.max(0, frame - 70), fps, config: { damping: 10, stiffness: 70, mass: 1.2 } });
  const stampScale = interpolate(stampSpr, [0, 0.4, 1], [2.5, 0.95, 1]);
  const stampRot = interpolate(stampSpr, [0, 0.5, 1], [-12, 2, 0]);
  const stampO = interpolate(stampSpr, [0, 0.2, 1], [0, 1, 1]);

  // Hero tilt correction
  const heroRot = interpolate(h.y, [-260, 0], [4, 0]);

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

      {/* Warm golden glow overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 50% 50%, rgba(245,158,11,${goldPulse}) 0%, transparent 65%)`,
          zIndex: 5,
          pointerEvents: "none",
        }}
      />

      {/* Header — gold/amber for hope */}
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
            backgroundColor: "#D97706",
            padding: "6px 28px",
            borderRadius: 6,
            border: "2px solid #1c1815",
            boxShadow: "0 8px 24px rgba(0,0,0,0.85)",
            display: "inline-block",
          }}
        >
          <span style={{ fontFamily: "'Courier Prime', monospace", fontWeight: 900, fontSize: u(14), color: "#181410", letterSpacing: 3, textTransform: "uppercase" }}>
            ★ WARISAN ABADI // REHABILITASI ★
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
          color: "#F59E0B",
          letterSpacing: u(4),
          textTransform: "uppercase",
          transform: `translateY(${interpolate(frame, [0, 10], [-40, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)`,
          opacity: interpolate(frame, [0, 10, 20], [0, 0, 1]),
          textShadow: "0 0 25px rgba(245,158,11,0.5), 2px 3px 0 rgba(0,0,0,0.6)",
        }}
      >
        Warisan Abadi
      </div>

      {/* Card 1: Death and aftermath */}
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
        <EvidenceCard label="KRONOLOGI" note="1952 → 2013" handwritten="Dari penganiayaan hingga pengampunan kerajaan" accentColor="#8c7b64">
          <div style={{ width: "100%", height: u(240), background: "#1a1612", display: "flex", flexDirection: "column", gap: u(12), padding: u(20) }}>
            {[
              { year: "1952", event: "Diturut karena homoseksualitas", color: "#DC2626" },
              { year: "1952", event: "Dipilih terapi hormon — tubuh hancur", color: "#DC2626" },
              { year: "1954", event: "Meninggal di usia 41 tahun", color: "#DC2626" },
              { year: "2009", event: "PM Gordon Brown minta maaf resmi", color: "#F59E0B" },
              { year: "2013", event: "Ratu Elizabeth II beri Royal Pardon", color: "#22c55e" },
            ].map((item, i) => (
              <TimelineItem key={i} year={item.year} event={item.event} color={item.color} delay={i * 8} totalFrames={frame} />
            ))}
          </div>
        </EvidenceCard>
      </div>

      {/* Card 2: Honors */}
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
        <EvidenceCard label="LEGASI" note="HERO TANPA GELAR" handwritten="Istilah 'Ayah Computer Science' dan 'Father of AI'" accentColor="#22c55e">
          <div style={{ width: "100%", height: u(240), background: "#1a1612", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: u(16), padding: u(20) }}>
            {/* Honors list */}
            {[
              "Order of the Companion of Honour (2014)",
              "Uang £50 — foto Alan Turing (2007)",
              "Galunggung Turing — bintang di Mars",
              "Alan Turing Award — Nobel-nya CS",
            ].map((honor, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: u(10),
                  opacity: interpolate(frame, [60 + i * 12, 70 + i * 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                }}
              >
                <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: u(16), color: "#22c55e" }}>★</span>
                <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: u(12), color: "#F5F0E4", letterSpacing: u(1) }}>{honor}</span>
              </div>
            ))}
          </div>
        </EvidenceCard>
      </div>

      {/* HERO CARD: Royal Pardon */}
      <div
        style={{
          position: "absolute",
          top: u(730),
          left: "50%",
          transform: `translateX(-50%) translateY(${h.y}px) scale(${h.s}) rotate(${heroRot}deg)`,
          width: u(860),
          zIndex: 50,
          opacity: h.o,
        }}
      >
        <EvidenceCard label="⬛ ROYAL PARDON 2013" note="AMPUNAN RAJAAT" handwritten="Ratu Elizabeth II memberi ampunan pascahumous" accentColor="#D97706">
          <div style={{ width: "100%", padding: u(24), display: "flex", flexDirection: "column", alignItems: "center", gap: u(20) }}>
            {/* Quote */}
            <div
              style={{
                fontFamily: "'Caveat', cursive",
                fontSize: u(28),
                color: "#14110E",
                textAlign: "center",
                lineHeight: 1.5,
                maxWidth: u(700),
                fontStyle: "italic",
              }}
            >
              "Kami menyesal dan permintaan maaf<br />yang tulus atas perlakuan tragis ini."<br />
              <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: u(14), color: "#8c7b64", fontStyle: "normal" }}>— Prime Minister Gordon Brown, 2009</span>
            </div>

            {/* Royal seal visualization */}
            <div
              style={{
                width: u(160),
                height: u(160),
                borderRadius: "50%",
                border: `3px solid #D97706`,
                background: "radial-gradient(circle, #1a1612, #0d0a08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                boxShadow: `0 0 30px rgba(217,119,6,${goldPulse})`,
              }}
            >
              <div style={{ fontFamily: "'Anton', sans-serif", fontSize: u(20), color: "#D97706", letterSpacing: u(2) }}>ROYAL</div>
              <div style={{ fontFamily: "'Anton', sans-serif", fontSize: u(20), color: "#D97706", letterSpacing: u(2) }}>PARDON</div>
              <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: u(14), color: "#8c7b64", marginTop: u(6) }}>2013</div>
            </div>

            {/* Final message */}
            <div
              style={{
                fontFamily: "'Anton', sans-serif",
                fontSize: u(32),
                color: "#F5F0E4",
                textAlign: "center",
                letterSpacing: u(4),
                textTransform: "uppercase",
                textShadow: "0 0 15px rgba(245,158,11,0.4)",
              }}
            >
              Dia akhirnya diterima dunia.<br />
              <span style={{ color: "#F59E0B" }}>Tapi terlambat bagi dirinya sendiri.</span>
            </div>
          </div>
        </EvidenceCard>
      </div>

      {/* Royal pardon stamp overlay */}
      <div
        style={{
          position: "absolute",
          top: "45%",
          left: "50%",
          transform: `translate(-50%, -50%) scale(${stampScale}) rotate(${stampRot}deg)`,
          zIndex: 80,
          opacity: stampO,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            fontFamily: "'Anton', sans-serif",
            fontSize: u(60),
            color: "#D97706",
            border: `3px solid #D97706`,
            padding: `${u(8)} ${u(30)}`,
            transform: "rotate(-5deg)",
            letterSpacing: u(4),
            backgroundColor: "rgba(245,240,228,0.08)",
            boxShadow: "0 0 30px rgba(217,119,6,0.4)",
          }}
        >
          PARDON
        </div>
      </div>

      {/* Red threads */}
      {frame > 50 && (
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 60, pointerEvents: "none" }} viewBox="0 0 1080 1920">
          <path d={`M ${u(270)} ${u(470)} Q ${u(300)} ${u(600)} ${u(430)} ${u(800)}`} stroke="#D32F2F" strokeWidth={2} fill="none" strokeDasharray="400" strokeDashoffset={interpolate(frame, [50, 85], [400, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.9))" }} />
          <path d={`M ${u(810)} ${u(470)} Q ${u(780)} ${u(600)} ${u(650)} ${u(800)}`} stroke="#D32F2F" strokeWidth={2} fill="none" strokeDasharray="400" strokeDashoffset={interpolate(frame, [55, 90], [400, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.9))" }} />
        </svg>
      )}
      {frame > 55 && <Pushpin x={u(430)} y={u(800)} frame={frame} />}
      {frame > 57 && <Pushpin x={u(650)} y={u(800)} frame={frame} />}

      <BottomArchivalTitle
        frame={frame}
        fps={fps}
        title="WARISAN ABADI"
        dateMarker="2013"
        subnote="Dua bulan kemudian, Alan Turing meninggal. Baru pada dua ribu tiga belas, sang raja memberi ampunan kerajaan."
        startFrame={130}
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
}> = ({ label, note, handwritten, accentColor = "#D97706", children }) => (
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

const TimelineItem: React.FC<{ year: string; event: string; color: string; delay: number; totalFrames: number }> = ({ year, event, color, delay, totalFrames }) => {
  const spr = spring({ frame: Math.max(0, totalFrames - delay - 60), fps: 30, config: { damping: 14, stiffness: 80, mass: 0.8 } });
  const x = interpolate(spr, [0, 1], [-60, 0]);
  const o = interpolate(spr, [0, 0.3, 1], [0, 1, 1]);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: u(10),
        transform: `translateX(${x}px)`,
        opacity: o,
      }}
    >
      <span style={{ fontFamily: "'Anton', sans-serif", fontSize: u(16), color, minWidth: u(60), letterSpacing: u(2) }}>{year}</span>
      <div style={{ width: u(20), height: 2, background: color }} />
      <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: u(12), color: "#F5F0E4", letterSpacing: u(1) }}>{event}</span>
    </div>
  );
};

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

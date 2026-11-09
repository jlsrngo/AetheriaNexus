import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { spring, interpolate, staticFile, Img } from "remotion";
import { ArchivalBackground } from "../components/ArchivalBackground";
import { BottomArchivalTitle } from "../components/BottomArchivalTitle";

const SCALE = 2.7692;
const u = (px: number) => px * SCALE;

export const Scene3BletchleyPark: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Hero card (Turing portrait) drops last
  const heroSpr = spring({ frame: Math.max(0, frame - 36), fps, config: { damping: 14, stiffness: 75, mass: 0.95 } });
  const heroY = interpolate(heroSpr, [0, 1], [-260, 0]);
  const heroS = interpolate(heroSpr, [0, 1], [1.35, 1]);
  const heroR = interpolate(heroSpr, [0, 0.7, 1], [-8, 2, 0]);
  const heroO = interpolate(heroSpr, [0, 0.3, 1], [0, 1, 1]);

  // Side evidence cards
  const side1Spr = spring({ frame: Math.max(0, frame - 10), fps, config: { damping: 15, stiffness: 80, mass: 0.9 } });
  const side2Spr = spring({ frame: Math.max(0, frame - 22), fps, config: { damping: 15, stiffness: 80, mass: 0.9 } });

  const s1 = { y: interpolate(side1Spr, [0, 1], [-240, 0]), s: interpolate(side1Spr, [0, 1], [1.3, 1]), o: interpolate(side1Spr, [0, 0.4, 1], [0, 1, 1]) };
  const s2 = { y: interpolate(side2Spr, [0, 1], [-240, 0]), s: interpolate(side2Spr, [0, 1], [1.3, 1]), o: interpolate(side2Spr, [0, 0.4, 1], [0, 1, 1]) };

  // Tremor on hero landing
  const tremorSpr = spring({ frame: Math.max(0, frame - 36), fps, config: { damping: 8, stiffness: 50, mass: 2 } });
  const tremor = interpolate(tremorSpr, [0, 0.12, 1], [8, 0, 0]);

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
            backgroundColor: "#F59E0B",
            backgroundImage: "repeating-linear-gradient(45deg, #F59E0B, #F59E0B 12px, #D97706 12px, #D97706 24px)",
            padding: "6px 28px",
            borderRadius: 6,
            border: "2px solid #1c1815",
            boxShadow: "0 8px 24px rgba(0,0,0,0.85)",
            display: "inline-block",
          }}
        >
          <span style={{ fontFamily: "'Courier Prime', monospace", fontWeight: 900, fontSize: u(14), color: "#181410", letterSpacing: 3, textTransform: "uppercase" }}>
            ★ BERKAS RAHASIA // BLETCHLEY PARK ★
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
          fontSize: u(52),
          color: "#14110E",
          letterSpacing: u(3),
          textTransform: "uppercase",
          transform: `translateY(${interpolate(frame, [0, 10], [-40, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)`,
          opacity: interpolate(frame, [0, 10, 20], [0, 0, 1]),
          textShadow: "2px 3px 0 rgba(220,38,38,0.25)",
        }}
      >
        Bletchley Park
      </div>

      {/* Left card: Bletchley Park building */}
      <div
        style={{
          position: "absolute",
          top: u(260),
          left: u(30),
          width: u(340),
          zIndex: 22,
          transform: `translateY(${s1.y}px) scale(${s1.s}) rotate(-4deg)`,
          opacity: s1.o,
        }}
      >
        <EvidenceCard
          label="BUKTI B-1"
          note="LOKASI OPERASI"
          handwritten="Mansion Bletchley — Hutchi's Lab"
        >
          <Img src={staticFile("img_bletchley.jpg")} style={{ width: "100%", height: u(240), objectFit: "cover" }} />
        </EvidenceCard>
      </div>

      {/* Right card: Puzzle pieces / code reference */}
      <div
        style={{
          position: "absolute",
          top: u(260),
          left: u(710),
          width: u(340),
          zIndex: 23,
          transform: `translateY(${s2.y}px) scale(${s2.s}) rotate(4deg)`,
          opacity: s2.o,
        }}
      >
        <EvidenceCard
          label="BUKTI B-2"
          note="METODE KRIPSIOGRAFI"
          handwritten="Enigma: 3-4 rotor, kabel panel, plugboard"
        >
          <div style={{ width: "100%", height: u(240), background: "#1a1612", display: "flex", alignItems: "center", justifyContent: "center", padding: u(20) }}>
            <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: u(14), color: "#8c7b64", lineHeight: 2, textAlign: "center" }}>
              <div style={{ color: "#DC2626", fontSize: u(20), fontWeight: 700, marginBottom: u(10) }}>ROTOR SETTINGS</div>
              <div>WIRING: β θ γ δ ε ζ</div>
              <div>PLUGBOARD: A↔N  B↔Y  C↔X</div>
              <div style={{ color: "#F59E0B", marginTop: u(10) }}>COMBINATIONS: 158 quintillion</div>
              <div style={{ fontSize: u(11), color: "#5a4a3a", marginTop: u(8) }}>"Setting berubah setiap hari"</div>
            </div>
          </div>
        </EvidenceCard>
      </div>

      {/* HERO CARD: Alan Turing portrait — drops last, highest z-index */}
      <div
        style={{
          position: "absolute",
          top: u(580),
          left: "50%",
          transform: `translateX(-50%) translateY(${heroY}px) scale(${heroS}) rotate(${heroR}deg)`,
          width: u(520),
          zIndex: 50,
          opacity: heroO,
        }}
      >
        <EvidenceCard
          label="⬛ SUBJEK UTAMA"
          note="JENIUS YANG MERUBAH DUNIA"
          handwritten="Alan Mathison Turing — 1912–1954"
        >
          {/* Portrait with slight sepia treatment */}
          <div style={{ position: "relative", width: "100%", height: u(360), overflow: "hidden" }}>
            <Img
              src={staticFile("img_alan_turing.jpg")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "sepia(20%) contrast(1.1) brightness(0.9)",
              }}
            />
            {/* Subtle vignette overlay */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "radial-gradient(ellipse at center, transparent 40%, rgba(24,20,16,0.5) 100%)",
                pointerEvents: "none",
              }}
            />
          </div>
          {/* Name stamp */}
          <div
            style={{
              position: "absolute",
              bottom: u(60),
              left: u(20),
              fontFamily: "'Anton', sans-serif",
              fontSize: u(36),
              color: "#14110E",
              letterSpacing: u(3),
              textTransform: "uppercase",
              textShadow: "1px 1px 0 rgba(220,38,38,0.3)",
            }}
          >
            ALAN TURING
          </div>
        </EvidenceCard>
      </div>

      {/* Red threads connecting to hero */}
      {frame > 50 && (
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 60, pointerEvents: "none" }} viewBox="0 0 1080 1920">
          <path
            d={`M ${u(200)} ${u(500)} Q ${u(350)} ${u(600)} ${u(310)} ${u(780)}`}
            stroke="#D32F2F"
            strokeWidth={3}
            fill="none"
            strokeDasharray="600"
            strokeDashoffset={interpolate(frame, [50, 90], [600, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
            style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.9))" }}
          />
          <path
            d={`M ${u(880)} ${u(500)} Q ${u(730)} ${u(600)} ${u(770)} ${u(780)}`}
            stroke="#D32F2F"
            strokeWidth={3}
            fill="none"
            strokeDasharray="600"
            strokeDashoffset={interpolate(frame, [55, 95], [600, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
            style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.9))" }}
          />
        </svg>
      )}

      {/* Pushpins */}
      {frame > 14 && <Pushpin x={u(200)} y={u(500)} frame={frame} />}
      {frame > 26 && <Pushpin x={u(880)} y={u(480)} frame={frame} />}
      {frame > 40 && <Pushpin x={u(310)} y={u(780)} frame={frame} />}
      {frame > 42 && <Pushpin x={u(770)} y={u(780)} frame={frame} />}

      <div style={{ transform: `translateY(${tremor}px)` }}>
        <BottomArchivalTitle
          frame={frame}
          fps={fps}
          title="ALAN TURING"
          dateMarker="1940"
          subnote="Jenius yang diberi tugas mustahil: memecahkan kode Enigma di Bletchley Park."
          startFrame={100}
        />
      </div>
    </div>
  );
};

const EvidenceCard: React.FC<{
  label: string;
  note: string;
  handwritten: string;
  children: React.ReactNode;
}> = ({ label, note, handwritten, children }) => (
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
        backgroundColor: label.includes("UTAMA") ? "#DC2626" : "#F59E0B",
        padding: `${u(4)} ${u(12)}`,
        borderRadius: u(3),
        fontFamily: "'Courier Prime', monospace",
        fontSize: u(13),
        fontWeight: 700,
        color: "#fff",
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

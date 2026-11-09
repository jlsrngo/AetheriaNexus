import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { spring, interpolate, staticFile, Img } from "remotion";
import { ArchivalBackground } from "../components/ArchivalBackground";
import { BottomArchivalTitle } from "../components/BottomArchivalTitle";

const SCALE = 2.7692;

// Helper: u() converts design px to 1080x1920 coord space
const u = (px: number) => px * SCALE;

export const Scene2PetaPerang: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Cards drop sequence
  const card1Spr = spring({ frame: Math.max(0, frame - 6), fps, config: { damping: 15, stiffness: 80, mass: 0.9 } });
  const card2Spr = spring({ frame: Math.max(0, frame - 18), fps, config: { damping: 15, stiffness: 80, mass: 0.9 } });
  const card3Spr = spring({ frame: Math.max(0, frame - 30), fps, config: { damping: 15, stiffness: 80, mass: 0.9 } });

  const c1 = { y: interpolate(card1Spr, [0, 1], [-280, 0]), s: interpolate(card1Spr, [0, 1], [1.3, 1]), o: interpolate(card1Spr, [0, 0.4, 1], [0, 1, 1]) };
  const c2 = { y: interpolate(card2Spr, [0, 1], [-280, 0]), s: interpolate(card2Spr, [0, 1], [1.3, 1]), o: interpolate(card2Spr, [0, 0.4, 1], [0, 1, 1]) };
  const c3 = { y: interpolate(card3Spr, [0, 1], [-280, 0]), s: interpolate(card3Spr, [0, 1], [1.3, 1]), o: interpolate(card3Spr, [0, 0.4, 1], [0, 1, 1]) };

  // Tremor effect
  const tremorSpr = spring({ frame: Math.max(0, frame - 30), fps, config: { damping: 8, stiffness: 60, mass: 2 } });
  const tremor = interpolate(tremorSpr, [0, 0.15, 1], [6, 0, 0]);

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

      {/* Top stencil header */}
      <div
        style={{
          position: "absolute",
          top: u(30),
          left: u(40),
          right: u(40),
          zIndex: 50,
          textAlign: "center",
          transform: `translateY(${interpolate(frame, [0, 8], [40, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)`,
          opacity: interpolate(frame, [0, 8, 20], [0, 0, 1]),
        }}
      >
        <div
          style={{
            backgroundColor: "#F59E0B",
            backgroundImage: "repeating-linear-gradient(45deg, #F59E0B, #F59E0B 12px, #D97706 12px, #D97706 24px)",
            padding: "6px 32px",
            borderRadius: 6,
            border: "2px solid #1c1815",
            boxShadow: "0 8px 24px rgba(0,0,0,0.85)",
            display: "inline-block",
          }}
        >
          <span style={{ fontFamily: "'Courier Prime', monospace", fontWeight: 900, fontSize: u(14), color: "#181410", letterSpacing: 4, textTransform: "uppercase" }}>
            ★ DOKUMEN PERANG 1940 ★
          </span>
        </div>
      </div>

      {/* Main title */}
      <div
        style={{
          position: "absolute",
          top: u(100),
          left: 0,
          right: 0,
          zIndex: 55,
          textAlign: "center",
          fontFamily: "'Anton', sans-serif",
          fontSize: u(56),
          color: "#14110E",
          letterSpacing: u(4),
          textTransform: "uppercase",
          transform: `translateY(${interpolate(frame, [0, 12], [-50, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)`,
          opacity: interpolate(frame, [0, 12, 25], [0, 0, 1]),
          textShadow: "2px 3px 0 rgba(220,38,38,0.3)",
        }}
      >
        Peta Perang &amp; U-Boat
      </div>

      {/* Card 1: Peta Eropa 1940 — top left */}
      <div
        style={{
          position: "absolute",
          top: u(240),
          left: u(30),
          width: u(380),
          zIndex: 20,
          transform: `translateY(${c1.y}px) scale(${c1.s}) rotate(-5deg)`,
          opacity: c1.o,
        }}
      >
        <PolaroidCard
          label="BUKTI A-1"
          note="PETA EROPA 1940"
          handwritten="Front Barat — Zona Pendudukan"
        >
          <Img src={staticFile("img_siege.jpg")} style={{ width: "100%", height: u(260), objectFit: "cover" }} />
        </PolaroidCard>
      </div>

      {/* Card 2: U-Boat — top right */}
      <div
        style={{
          position: "absolute",
          top: u(220),
          left: u(670),
          width: u(380),
          zIndex: 22,
          transform: `translateY(${c2.y}px) scale(${c2.s}) rotate(5deg)`,
          opacity: c2.o,
        }}
      >
        <PolaroidCard
          label="BUKTI A-2"
          note="KAPAL SELAM U-BOAT"
          handwritten="Armada Atlantik // Rahasia"
        >
          <Img src={staticFile("img_uboat.jpg")} style={{ width: "100%", height: u(260), objectFit: "cover" }} />
        </PolaroidCard>
      </div>

      {/* Card 3: Pesan terenkripsi — bottom center */}
      <div
        style={{
          position: "absolute",
          top: u(680),
          left: u(160),
          width: u(760),
          zIndex: 24,
          transform: `translateY(${c3.y}px) scale(${c3.s}) rotate(-1deg)`,
          opacity: c3.o,
        }}
      >
        <PolaroidCard
          label="BUKTI A-3"
          note="PESAN TERENKRIPSI ENIGMA"
          handwritten="Setiap hari — jutaan kombinasi rotor"
        >
          <div style={{ width: "100%", height: u(200), background: "#1a1612", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: u(12), padding: u(20) }}>
            {/* Enigma rotor visualization */}
            <div style={{ display: "flex", gap: u(16) }}>
              {[0, 1, 2].map(i => (
                <RotorDisc key={i} frame={frame} offset={i * 10} />
              ))}
            </div>
            <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: u(18), color: "#DC2626", letterSpacing: u(6), textAlign: "center", opacity: 0.9 }}>
              X7K · M2P · R9Q · W4N
            </div>
            <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: u(14), color: "#8c7b64", letterSpacing: u(3) }}>
              {"{"} ENCRYPTED TRANSMISSION — DESTINATION UNKNOWN {"}"}
            </div>
          </div>
        </PolaroidCard>
      </div>

      {/* Red thread SVGs connecting cards */}
      {frame > 40 && (
        <svg
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 60, pointerEvents: "none" }}
          viewBox="0 0 1080 1920"
        >
          <path
            d={`M ${u(220)} ${u(370)} Q ${u(440)} ${u(310)} ${u(690)} ${u(350)}`}
            stroke="#D32F2F"
            strokeWidth={3}
            fill="none"
            strokeDasharray="800"
            strokeDashoffset={interpolate(frame, [40, 80], [800, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
            style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.9))" }}
          />
          <path
            d={`M ${u(220)} ${u(530)} Q ${u(440)} ${u(700)} ${u(540)} ${u(880)}`}
            stroke="#D32F2F"
            strokeWidth={3}
            fill="none"
            strokeDasharray="800"
            strokeDashoffset={interpolate(frame, [60, 100], [800, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
            style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.9))" }}
          />
          <path
            d={`M ${u(860)} ${u(480)} Q ${u(750)} ${u(680)} ${u(760)} ${u(830)}`}
            stroke="#D32F2F"
            strokeWidth={3}
            fill="none"
            strokeDasharray="800"
            strokeDashoffset={interpolate(frame, [70, 110], [800, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
            style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.9))" }}
          />
        </svg>
      )}

      {/* Pushpins */}
      {frame > 44 && <Pushpin x={u(220)} y={u(370)} frame={frame} />}
      {frame > 46 && <Pushpin x={u(860)} y={u(350)} frame={frame} />}
      {frame > 64 && <Pushpin x={u(220)} y={u(530)} frame={frame} />}
      {frame > 74 && <Pushpin x={u(760)} y={u(830)} frame={frame} />}

      {/* Tremor wrapper */}
      <div style={{ transform: `translateY(${tremor}px)` }}>
        <BottomArchivalTitle
          frame={frame}
          fps={fps}
          title="U-BOAT JERMAN"
          dateMarker="1940"
          subnote="Kapal selam mengirim pesan terenkripsi lewat Enigma. Sekutu kewalahan."
          startFrame={90}
        />
      </div>
    </div>
  );
};

const PolaroidCard: React.FC<{
  label: string;
  note: string;
  handwritten: string;
  children: React.ReactNode;
}> = ({ label, note, handwritten, children }) => (
  <div
    style={{
      backgroundColor: "#F5F0E4",
      borderRadius: u(4),
      padding: `${u(14)} ${u(14)} ${u(50)} ${u(14)}`,
      boxShadow: "0 20px 50px rgba(0,0,0,0.85), inset 0 0 30px rgba(120,90,50,0.15)",
      border: "1px solid rgba(168,152,128,0.8)",
      position: "relative",
    }}
  >
    {/* Label tape */}
    <div
      style={{
        position: "absolute",
        top: -u(8),
        left: u(16),
        backgroundColor: "rgba(245,158,11,0.85)",
        padding: `${u(4)} ${u(14)}`,
        borderRadius: u(3),
        fontFamily: "'Courier Prime', monospace",
        fontSize: u(14),
        fontWeight: 700,
        color: "#181410",
        letterSpacing: u(2),
        transform: "rotate(-2deg)",
        boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
      }}
    >
      {label}
    </div>
    {children}
    {/* Handwritten note */}
    <div
      style={{
        position: "absolute",
        bottom: u(10),
        left: u(14),
        right: u(14),
        fontFamily: "'Caveat', cursive",
        fontSize: u(20),
        color: "#5a4a3a",
        transform: "rotate(-1deg)",
      }}
    >
      {handwritten}
    </div>
    {/* Bottom typed note */}
    <div
      style={{
        position: "absolute",
        bottom: u(4),
        right: u(14),
        fontFamily: "'Courier Prime', monospace",
        fontSize: u(12),
        color: "#8c7b64",
        letterSpacing: u(1),
        textTransform: "uppercase",
      }}
    >
      {note}
    </div>
  </div>
);

const RotorDisc: React.FC<{ frame: number; offset: number }> = ({ frame, offset }) => {
  const rot = interpolate(frame + offset, [0, 60], [0, 360], { extrapolateRight: "clamp" });
  return (
    <div
      style={{
        width: u(70),
        height: u(70),
        borderRadius: "50%",
        border: `3px solid #8c7b64`,
        background: `radial-gradient(circle, #2a2420 40%, #1a1612 100%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 0 15px rgba(220,38,38,0.3)",
        transform: `rotate(${rot}deg)`,
      }}
    >
      <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: u(16), color: "#DC2626", fontWeight: 700 }}>
        {String.fromCharCode(65 + (frame + offset) % 26)}
      </div>
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

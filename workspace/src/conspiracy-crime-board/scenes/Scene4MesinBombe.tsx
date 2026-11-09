import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { spring, interpolate, staticFile, Img } from "remotion";
import { ArchivalBackground } from "../components/ArchivalBackground";
import { BottomArchivalTitle } from "../components/BottomArchivalTitle";

const SCALE = 2.7692;
const u = (px: number) => px * SCALE;

export const Scene4MesinBombe: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Left card (Bombe machine) drops first
  const leftSpr = spring({ frame: Math.max(0, frame - 8), fps, config: { damping: 15, stiffness: 80, mass: 0.9 } });
  const leftY = interpolate(leftSpr, [0, 1], [-260, 0]);
  const leftS = interpolate(leftSpr, [0, 1], [1.3, 1]);
  const leftO = interpolate(leftSpr, [0, 0.4, 1], [0, 1, 1]);

  // VS divider animation
  const vsSpr = spring({ frame: Math.max(0, frame - 24), fps, config: { damping: 10, stiffness: 90, mass: 1 } });
  const vsScale = interpolate(vsSpr, [0, 0.5, 1], [0.5, 1.2, 1]);
  const vsOpacity = interpolate(vsSpr, [0, 0.3, 1], [0, 1, 1]);

  // Right card (Enigma) drops second
  const rightSpr = spring({ frame: Math.max(0, frame - 20), fps, config: { damping: 15, stiffness: 80, mass: 0.9 } });
  const rightY = interpolate(rightSpr, [0, 1], [-260, 0]);
  const rightS = interpolate(rightSpr, [0, 1], [1.3, 1]);
  const rightO = interpolate(rightSpr, [0, 0.4, 1], [0, 1, 1]);

  // Spinning rotor animation for Enigma side
  const rotorAngle = (frame * 3) % 360;
  const rotorAngle2 = (frame * 2 + 120) % 360;
  const rotorAngle3 = (frame * 4 + 240) % 360;

  // Stats counter animation
  const comboCount = interpolate(frame, [60, 120], [0, 158], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

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
            backgroundColor: "#DC2626",
            padding: "6px 28px",
            borderRadius: 6,
            border: "2px solid #1c1815",
            boxShadow: "0 8px 24px rgba(0,0,0,0.85)",
            display: "inline-block",
          }}
        >
          <span style={{ fontFamily: "'Courier Prime', monospace", fontWeight: 900, fontSize: u(14), color: "#F5F0E4", letterSpacing: 3, textTransform: "uppercase" }}>
            ★ MESIN PENEMBOSONGAN KODE ★
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
          fontSize: u(48),
          color: "#F5F0E4",
          letterSpacing: u(3),
          textTransform: "uppercase",
          transform: `translateY(${interpolate(frame, [0, 10], [-40, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)`,
          opacity: interpolate(frame, [0, 10, 20], [0, 0, 1]),
          textShadow: "2px 3px 0 rgba(220,38,38,0.5)",
        }}
      >
        Mesin Bombe vs Enigma
      </div>

      {/* LEFT CARD: Mesin Bombe */}
      <div
        style={{
          position: "absolute",
          top: u(240),
          left: u(40),
          width: u(460),
          zIndex: 22,
          transform: `translateY(${leftY}px) scale(${leftS}) rotate(-3deg)`,
          opacity: leftO,
        }}
      >
        <EvidenceCard label="MESIN BOMBE" note="CIPTAAN TURING" handwritten="Ribuan rotor berputar menandingi Enigma" accentColor="#F59E0B">
          <div style={{ width: "100%", height: u(300), background: "#1a1612", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: u(16), padding: u(20) }}>
            {/* Animated rotor stack visualization */}
            <div style={{ display: "flex", flexDirection: "column", gap: u(8), alignItems: "center" }}>
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  style={{
                    width: u(160),
                    height: u(24),
                    borderRadius: u(4),
                    border: `2px solid #8c7b64`,
                    background: `linear-gradient(90deg, #2a2420, #3a3028, #2a2420)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "'Courier Prime', monospace",
                    fontSize: u(14),
                    color: "#F59E0B",
                    transform: `rotate(${Math.sin((frame + i * 15) * 0.1) * 3}deg)`,
                    boxShadow: "0 0 10px rgba(245,158,11,0.2)",
                  }}
                >
                  ROTOR {String.fromCharCode(65 + i)} — {String.fromCharCode(65 + ((frame + i * 20) % 26))}
                </div>
              ))}
            </div>
            <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: u(13), color: "#8c7b64", textAlign: "center" }}>
              {"«» OPERATIONAL SINCE JULY 1940"}
            </div>
          </div>
        </EvidenceCard>
      </div>

      {/* VS Divider */}
      <div
        style={{
          position: "absolute",
          top: u(400),
          left: "50%",
          transform: `translateX(-50%) scale(${vsScale})`,
          zIndex: 55,
          opacity: vsOpacity,
          fontFamily: "'Anton', sans-serif",
          fontSize: u(72),
          color: "#DC2626",
          textShadow: "0 0 20px rgba(220,38,38,0.6), 3px 3px 0 rgba(0,0,0,0.8)",
          letterSpacing: u(8),
        }}
      >
        VS
      </div>

      {/* RIGHT CARD: Enigma Machine */}
      <div
        style={{
          position: "absolute",
          top: u(240),
          left: u(580),
          width: u(460),
          zIndex: 23,
          transform: `translateY(${rightY}px) scale(${rightS}) rotate(3deg)`,
          opacity: rightO,
        }}
      >
        <EvidenceCard label="MESIN ENIGMA" note="RAHASIA NEGERI NAZI" handwritten="158 quintillion kombinasi harian" accentColor="#DC2626">
          <div style={{ width: "100%", height: u(300), background: "#1a1612", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: u(16), padding: u(20) }}>
            {/* Rotating rotor rings */}
            <div style={{ display: "flex", gap: u(12) }}>
              <RotatingRing angle={rotorAngle} label="I" />
              <RotatingRing angle={rotorAngle2} label="II" />
              <RotatingRing angle={rotorAngle3} label="III" />
            </div>
            {/* Plugboard visualization */}
            <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: u(13), color: "#DC2626", textAlign: "center" }}>
              PLUGBOARD AKTIF
            </div>
            <div style={{ display: "flex", gap: u(8), flexWrap: "wrap", justifyContent: "center" }}>
              {["A↔N", "B↔Y", "C↔X", "D↔K", "E↔R", "H↔U"].map(pair => (
                <span key={pair} style={{ fontFamily: "'Courier Prime', monospace", fontSize: u(12), color: "#F59E0B", border: "1px solid #8c7b64", padding: `${u(3)} ${u(8)}`, borderRadius: u(3) }}>
                  {pair}
                </span>
              ))}
            </div>
            {/* Combo counter */}
            <div style={{ fontFamily: "'Anton', sans-serif", fontSize: u(28), color: "#DC2626", letterSpacing: u(2) }}>
              {comboCount.toFixed(0)} Q COMBINATIONS
            </div>
          </div>
        </EvidenceCard>
      </div>

      {/* Red thread connecting both cards */}
      {frame > 30 && (
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 60, pointerEvents: "none" }} viewBox="0 0 1080 1920">
          <path
            d={`M ${u(500)} ${u(390)} L ${u(580)} ${u(390)}`}
            stroke="#D32F2F"
            strokeWidth={4}
            fill="none"
            strokeDasharray="400"
            strokeDashoffset={interpolate(frame, [30, 60], [400, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
            style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.9))" }}
          />
        </svg>
      )}
      {frame > 32 && <Pushpin x={u(540)} y={u(390)} frame={frame} />}

      <BottomArchivalTitle
        frame={frame}
        fps={fps}
        title="MESIN BOMBE"
        dateMarker="1940"
        subnote="Mesin Bombe ia rancang. Ribuan rotor berputar, menandingi jutaan kombinasi sandi Enigma setiap hari."
        startFrame={80}
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
        color: accentColor === "#DC2626" ? "#F5F0E4" : "#181410",
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

const RotatingRing: React.FC<{ angle: number; label: string }> = ({ angle, label }) => (
  <div
    style={{
      width: u(80),
      height: u(80),
      borderRadius: "50%",
      border: "3px solid #8c7b64",
      background: "radial-gradient(circle, #2a2420 30%, #1a1612 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transform: `rotate(${angle}deg)`,
      boxShadow: "0 0 15px rgba(220,38,38,0.3), inset 0 0 20px rgba(0,0,0,0.5)",
      position: "relative",
    }}
  >
    {/* Notches around the ring */}
    {Array.from({ length: 10 }).map((_, i) => (
      <div
        key={i}
        style={{
          position: "absolute",
          width: u(4),
          height: u(10),
          background: "#8c7b64",
          top: u(-5),
          left: "50%",
          transformOrigin: `50% ${u(45)}`,
          transform: `translateX(-50%) rotate(${i * 36}deg)`,
        }}
      />
    ))}
    <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: u(18), color: "#F59E0B", fontWeight: 700 }}>{label}</span>
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

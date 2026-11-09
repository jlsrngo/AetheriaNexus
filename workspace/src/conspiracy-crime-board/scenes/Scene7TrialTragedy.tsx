import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { spring, interpolate, staticFile, Img } from "remotion";
import { ArchivalBackground } from "../components/ArchivalBackground";
import { BottomArchivalTitle } from "../components/BottomArchivalTitle";

const SCALE = 2.7692;
const u = (px: number) => px * SCALE;

export const Scene7TrialTragedy: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Darker overall feel — slow, heavy animations
  const card1Spr = spring({ frame: Math.max(0, frame - 10), fps, config: { damping: 20, stiffness: 50, mass: 1.2 } });
  const card2Spr = spring({ frame: Math.max(0, frame - 28), fps, config: { damping: 20, stiffness: 50, mass: 1.2 } });
  const card3Spr = spring({ frame: Math.max(0, frame - 46), fps, config: { damping: 18, stiffness: 60, mass: 1.0 } });

  const mk = (spr: any) => ({
    y: interpolate(spr, [0, 1], [-280, 0]),
    s: interpolate(spr, [0, 1], [1.35, 1]),
    o: interpolate(spr, [0, 0.4, 1], [0, 1, 1]),
  });

  const c1 = mk(card1Spr);
  const c2 = mk(card2Spr);
  const c3 = mk(card3Spr);

  // Red vignette intensifies over time
  const redOverlay = interpolate(frame, [0, 60, 120], [0, 0.08, 0.05], { extrapolateRight: "clamp" });

  // Court document fade-in
  const docOpacity = interpolate(frame, [80, 100, 140], [0, 0, 1]);

  // Gavel impact tremor
  const tremor = interpolate(frame, [80, 84, 90], [12, 0, 0], { extrapolateRight: "clamp" });

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
      {/* Darker archival background with red tint */}
      <ArchivalBackground spotlightGlow={false} />

      {/* Red overlay that pulses subtly */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 50% 40%, rgba(220,38,38,${redOverlay}) 0%, transparent 70%)`,
          zIndex: 5,
          pointerEvents: "none",
        }}
      />

      {/* Header — darker red */}
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
            backgroundColor: "#7f1d1d",
            padding: "6px 28px",
            borderRadius: 6,
            border: "2px solid #1c1815",
            boxShadow: "0 8px 24px rgba(0,0,0,0.9)",
            display: "inline-block",
          }}
        >
          <span style={{ fontFamily: "'Courier Prime', monospace", fontWeight: 900, fontSize: u(14), color: "#F5F0E4", letterSpacing: 3, textTransform: "uppercase" }}>
            ★ KASUS PENGADILAN // 1952 ★
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
          color: "#DC2626",
          letterSpacing: u(4),
          textTransform: "uppercase",
          transform: `translateY(${interpolate(frame, [0, 10], [-40, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)`,
          opacity: interpolate(frame, [0, 10, 20], [0, 0, 1]),
          textShadow: "0 0 20px rgba(220,38,38,0.6), 3px 3px 0 rgba(0,0,0,0.8)",
        }}
      >
        Tragedi Pengadilian
      </div>

      {/* Card 1: The charge */}
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
        <EvidenceCard label="TANGGUNGAN" note="PIDANA KEPADA NEGERI" handwritten="Homoseksualitas — kejahatan terhadap negara" accentColor="#7f1d1d">
          <div style={{ width: "100%", height: u(220), background: "#1a0a0a", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: u(14), padding: u(20) }}>
            {/* Legal document text */}
            <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: u(13), color: "#DC2626", textAlign: "center", letterSpacing: u(2), textTransform: "uppercase" }}>
              Official Charge
            </div>
            <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: u(12), color: "#8c7b64", textAlign: "center", lineHeight: 1.8, maxWidth: u(340) }}>
              "Conspiracy to commit gross indecency<br />with another male person,<br />contrary to Section 11 of the<br />Criminal Law Amendment Act 1885"
            </div>
            <div style={{ fontFamily: "'Anton', sans-serif", fontSize: u(22), color: "#DC2626", letterSpacing: u(3), textTransform: "uppercase" }}>
              GUILTY
            </div>
          </div>
        </EvidenceCard>
      </div>

      {/* Card 2: Sentencing */}
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
        <EvidenceCard label="HUKUMAN" note="PENJARA & PEMBUNUHAN KIMIA" handwritten="Pilihan: 12 bulan penjara atau terapi hormon" accentColor="#7f1d1d">
          <div style={{ width: "100%", height: u(220), background: "#1a0a0a", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: u(16), padding: u(20) }}>
            {/* Decision tree */}
            <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: u(13), color: "#F59E0B", letterSpacing: u(2) }}>SENTENCING OPTIONS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: u(10), width: "100%" }}>
              <SentenceOption text="12 BULAN PENJARA" selected={false} />
              <SentenceOption text="TERAPI HORMON (CASTRATION)" selected={true} />
            </div>
            <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: u(12), color: "#DC2626", textAlign: "center", fontStyle: "italic" }}>
              {"← Dia memilih opsi kedua."}
            </div>
            <div style={{ fontFamily: "'Caveat', cursive", fontSize: u(20), color: "#8c7b64", transform: "rotate(-1deg)" }}>
              "Saya tidak merasa bersalah..."
            </div>
          </div>
        </EvidenceCard>
      </div>

      {/* HERO CARD: The tragic outcome */}
      <div
        style={{
          position: "absolute",
          top: u(720),
          left: "50%",
          transform: `translateX(-50%) translateY(${c3.y}px) scale(${c3.s}) rotate(${interpolate(c3.y, [-280, 0], [3, 0])}deg)`,
          width: u(860),
          zIndex: 50,
          opacity: c3.o,
        }}
      >
        <EvidenceCard label="⬛ AKHIR CERITA" note="1952 — KEHIDUPAN HANCUR" handwritten="Dua bulan kemudian... 8 Juni 1954" accentColor="#7f1d1d">
          <div style={{ width: "100%", padding: u(24), display: "flex", flexDirection: "column", alignItems: "center", gap: u(18) }}>
            {/* Date */}
            <div
              style={{
                fontFamily: "'Anton', sans-serif",
                fontSize: u(64),
                color: "#DC2626",
                letterSpacing: u(6),
                textShadow: "0 0 20px rgba(220,38,38,0.5)",
              }}
            >
              8 JUNI 1954
            </div>
            {/* Quote */}
            <div
              style={{
                fontFamily: "'Caveat', cursive",
                fontSize: u(26),
                color: "#F5F0E4",
                textAlign: "center",
                lineHeight: 1.5,
                maxWidth: u(700),
                borderLeft: "3px solid #DC2626",
                paddingLeft: u(16),
              }}
            >
              "Akhirnya saya menang atas perang ini. <br />Mereka tak akan bisa menang lagi."
            </div>
            {/* Fact */}
            <div
              style={{
                fontFamily: "'Courier Prime', monospace",
                fontSize: u(14),
                color: "#8c7b64",
                textAlign: "center",
                letterSpacing: u(2),
                width: "100%",
                borderTop: "1px solid #3a3028",
                paddingTop: u(14),
              }}
            >
              ALAN TURING MENINGGAL DI USIA 41 TAHUN<br />
              PENYEBAB: KERACUNAN SIANIDA DARI APA YANG DIA MAKAN<br />
              {" — "}DIVINE JUDGMENT? OR ACIDENT?
            </div>
          </div>
        </EvidenceCard>
      </div>

      {/* Dramatic red divider */}
      {frame > 120 && (
        <div
          style={{
            position: "absolute",
            top: u(680),
            left: u(60),
            right: u(60),
            height: 3,
            background: "linear-gradient(90deg, transparent, #DC2626, transparent)",
            zIndex: 55,
            opacity: interpolate(frame, [120, 140], [0, 0.7]),
          }}
        />
      )}

      <div style={{ transform: `translateY(${tremor}px)` }}>
        <BottomArchivalTitle
          frame={frame}
          fps={fps}
          title="TRAGEDI 1952"
          dateMarker="1952"
          subnote="Namun di tahun sembilan belas lima puluh dua, dunia berubah. Ia justru dipenjara karena cinta kepada laki-laki."
          startFrame={130}
        />
      </div>
    </div>
  );
};

const EvidenceCard: React.FC<{
  label: string;
  note: string;
  handwritten: string;
  accentColor?: string;
  children: React.ReactNode;
}> = ({ label, note, handwritten, accentColor = "#7f1d1d", children }) => (
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
        color: "#F5F0E4",
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

const SentenceOption: React.FC<{ text: string; selected: boolean }> = ({ text, selected }) => (
  <div
    style={{
      fontFamily: "'Courier Prime', monospace",
      fontSize: u(14),
      color: selected ? "#DC2626" : "#8c7b64",
      backgroundColor: selected ? "rgba(220,38,38,0.15)" : "transparent",
      border: selected ? "1px solid #DC2626" : "1px solid #3a3028",
      padding: `${u(8)} ${u(14)}`,
      borderRadius: u(4),
      textAlign: "center",
      letterSpacing: u(2),
      textTransform: "uppercase",
    }}
  >
    {selected ? "▶ " : "  "}{text}
  </div>
);

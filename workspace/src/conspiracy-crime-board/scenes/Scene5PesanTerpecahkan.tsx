import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { spring, interpolate, staticFile, Img } from "remotion";
import { ArchivalBackground } from "../components/ArchivalBackground";
import { BottomArchivalTitle } from "../components/BottomArchivalTitle";

const SCALE = 2.7692;
const u = (px: number) => px * SCALE;

export const Scene5PesanTerpecahkan: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Cards
  const card1Spr = spring({ frame: Math.max(0, frame - 6), fps, config: { damping: 15, stiffness: 80, mass: 0.9 } });
  const card2Spr = spring({ frame: Math.max(0, frame - 18), fps, config: { damping: 15, stiffness: 80, mass: 0.9 } });
  const card3Spr = spring({ frame: Math.max(0, frame - 30), fps, config: { damping: 15, stiffness: 80, mass: 0.9 } });

  const makeCard = (spr: ReturnType<typeof spring>) => ({
    y: interpolate(spr, [0, 1], [-260, 0]),
    s: interpolate(spr, [0, 1], [1.3, 1]),
    o: interpolate(spr, [0, 0.4, 1], [0, 1, 1]),
  });

  const c1 = makeCard(card1Spr);
  const c2 = makeCard(card2Spr);
  const c3 = makeCard(card3Spr);

  // Hero stamp animation
  const stampSpr = spring({ frame: Math.max(0, frame - 50), fps, config: { damping: 8, stiffness: 60, mass: 1.5 } });
  const stampScale = interpolate(stampSpr, [0, 0.4, 1], [3, 0.95, 1]);
  const stampRot = interpolate(stampSpr, [0, 0.5, 1], [-15, 3, 0]);
  const stampO = interpolate(stampSpr, [0, 0.2, 1], [0, 1, 1]);

  // Numbers counter
  const livesCount = interpolate(frame, [60, 140], [0, 78], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const messagesCount = interpolate(frame, [80, 160], [0, 1500], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Tremor on stamp
  const tremor = interpolate(stampSpr, [0, 0.08], [10, 0], { extrapolateRight: "clamp" });

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
            ★ HASIL OPERASI ULTRA ★
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
          textShadow: "2px 3px 0 rgba(220,38,38,0.5)",
        }}
      >
        Pesan Terpecahkan
      </div>

      {/* Card 1: Decoded message sample */}
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
        <EvidenceCard label="DOKUMEN C-1" note="TRANSMISI YANG DIPERCELAHKAN" handwritten="Contoh pesan U-Boat yang terbaca" accentColor="#DC2626">
          <div style={{ width: "100%", height: u(220), background: "#1a1612", display: "flex", alignItems: "center", justifyContent: "center", padding: u(20), flexDirection: "column", gap: u(10) }}>
            <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: u(13), color: "#8c7b64", textAlign: "center" }}>
              {"[ BEFORE — ENCRYPTED ]"}
            </div>
            <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: u(14), color: "#DC2626", letterSpacing: u(3), textAlign: "center", wordBreak: "break-all" }}>
              X7K M2P R9Q W4N T5H<br/>B3L K8J P1M N6X Y2Z
            </div>
            <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: u(24), color: "#5a4a3a", margin: `${u(8)}px 0` }}>↓ DECODED ↓</div>
            <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: u(14), color: "#22c55e", letterSpacing: u(2), textAlign: "center", wordBreak: "break-all" }}>
              POSITION 52N 04W<br/>ETERNAL APPROACHING<br/>CONVOY HG76 DIVERTED
            </div>
          </div>
        </EvidenceCard>
      </div>

      {/* Card 2: Convoy ship illustration placeholder */}
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
        <EvidenceCard label="DOKUMEN C-2" note="KONVOI ATLANTIK" handwritten="Rute perdagangan Sekutu — target U-Boat" accentColor="#F59E0B">
          <div style={{ width: "100%", height: u(220), background: "#1a1612", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: u(12), padding: u(20) }}>
            {/* Simple convoy route map */}
            <svg width={u(360)} height={u(160)} viewBox="0 0 360 160">
              {/* Ocean background */}
              <rect x={0} y={0} width={360} height={160} fill="#0d1520" rx={8} />
              {/* Route lines */}
              <path d="M 30 80 Q 120 30 200 80 T 330 70" stroke="#F59E0B" strokeWidth={2} fill="none" strokeDasharray="6 4" />
              <path d="M 30 100 Q 100 130 180 95 T 330 105" stroke="#DC2626" strokeWidth={2} fill="none" strokeDasharray="6 4" />
              {/* Ship dots */}
              {[
                { cx: 60, cy: 75, c: "#22c55e" },
                { cx: 120, cy: 55, c: "#22c55e" },
                { cx: 180, cy: 80, c: "#22c55e" },
                { cx: 250, cy: 72, c: "#22c55e" },
                { cx: 310, cy: 68, c: "#22c55e" },
                { cx: 90, cy: 110, c: "#DC2626" },
                { cx: 200, cy: 100, c: "#DC2626" },
              ].map((dot, i) => (
                <circle key={i} cx={dot.cx} cy={dot.cy} r={5} fill={dot.c} opacity={0.9}>
                  <animate attributeName="r" values={`${5};${7};${5}`} dur="1.5s" repeatCount="indefinite" begin={`${i * 0.2}s`} />
                </circle>
              ))}
              {/* Labels */}
              <text x={15} y={155} fill="#8c7b64" fontSize={10} fontFamily="monospace">ATLANTIC CONVOY ROUTES</text>
              <line x1={240} y1={148} x2={260} y2={148} stroke="#22c55e" strokeWidth={2} />
              <text x={265} y={152} fill="#22c55e" fontSize={9} fontFamily="monospace">Allied</text>
              <line x1={240} y1={138} x2={260} y2={138} stroke="#DC2626" strokeWidth={2} />
              <text x={265} y={142} fill="#DC2626" fontSize={9} fontFamily="monospace">U-Boat</text>
            </svg>
          </div>
        </EvidenceCard>
      </div>

      {/* HERO CARD: Saved lives stats — center, drops last */}
      <div
        style={{
          position: "absolute",
          top: u(730),
          left: "50%",
          transform: `translateX(-50%) translateY(${c3.y}px) scale(${c3.s}) rotate(${interpolate(c3.y, [-260, 0], [5, 0])}deg)`,
          width: u(860),
          zIndex: 50,
          opacity: c3.o,
        }}
      >
        <EvidenceCard label="⬛ DATA OPERASI ULTRA" note="REAKSI STRATEGIS SEKUTU" handwritten="Rahasia yang dijaga ketat sampai 1970-an" accentColor="#DC2626">
          <div style={{ width: "100%", padding: u(24), display: "flex", flexDirection: "column", gap: u(20), alignItems: "center" }}>
            {/* Counter stats */}
            <div style={{ display: "flex", gap: u(40), flexWrap: "wrap", justifyContent: "center" }}>
              <StatBox label="PESAN DINIECI" value={`${Math.round(messagesCount).toLocaleString()}+`} unit="/ bulan" />
              <StatBox label="NYAWA TERSLAMATKAN" value={`${Math.round(livesCount).toLocaleString()}.000+`} unit="" highlight />
            </div>
            {/* Classification stamp */}
            <div
              style={{
                fontFamily: "'Courier Prime', monospace",
                fontSize: u(14),
                color: "#8c7b64",
                textAlign: "center",
                letterSpacing: u(3),
                borderTop: "1px dashed #8c7b64",
                borderBottom: "1px dashed #8c7b64",
                padding: `${u(10)} 0`,
                width: "100%",
              }}
            >
              CLASSIFICATION: ULTRA • RESTRICTED<br />
              DECLASSIFIED: 1979
            </div>
          </div>
        </EvidenceCard>
      </div>

      {/* HERO STAMP: "TERPECAHKAN!" slams down */}
      <div
        style={{
          position: "absolute",
          top: "50%",
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
            fontSize: u(90),
            color: "#DC2626",
            border: `4px solid #DC2626`,
            padding: `${u(10)} ${u(40)}`,
            transform: "rotate(-8deg)",
            textShadow: "3px 3px 0 rgba(0,0,0,0.5)",
            letterSpacing: u(6),
            backgroundColor: "rgba(245,240,228,0.1)",
            boxShadow: "0 0 40px rgba(220,38,38,0.5)",
          }}
        >
          TERPECAHKAN!
        </div>
      </div>

      <div style={{ transform: `translateY(${tremor}px)` }}>
        <BottomArchivalTitle
          frame={frame}
          fps={fps}
          title="JIUTAAN NYAWA"
          dateMarker="1940–1945"
          subnote="Ribuan pesan musuh berhasil dipecahkan. Jutaan nyawa tentara Sekutu dan warga sipil terselamatkan."
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

const StatBox: React.FC<{ label: string; value: string; unit: string; highlight?: boolean }> = ({ label, value, unit, highlight }) => (
  <div style={{ textAlign: "center" }}>
    <div
      style={{
        fontFamily: "'Anton', sans-serif",
        fontSize: u(52),
        color: highlight ? "#DC2626" : "#14110E",
        letterSpacing: u(2),
        textShadow: highlight ? "0 0 20px rgba(220,38,38,0.4)" : "none",
        lineHeight: 1,
      }}
    >
      {value}{unit}
    </div>
    <div
      style={{
        fontFamily: "'Courier Prime', monospace",
        fontSize: u(14),
        color: "#8c7b64",
        letterSpacing: u(3),
        textTransform: "uppercase",
        marginTop: u(6),
      }}
    >
      {label}
    </div>
  </div>
);

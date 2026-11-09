import React from "react";
import { spring, interpolate, Img } from "remotion";
import { PinItem, ThreadConnection } from "../types";

export const DEFAULT_CONSPIRACY_CARDS: PinItem[] = [
  // 1. Top-Left: Slot 01
  {
    id: "pin1",
    name: "SLOT FOTO 01",
    role: "Subjek #01 // Bukti",
    photoUrl: "",
    dropFrame: 10,
    pinFrame: 18,
    x: 55,
    y: 125,
    width: 335,
    height: 415,
    rotation: -6,
    pinOffset: { x: 40, y: 140 },
    notes: "BERKAS A-1 // BUKTI",
    handwrittenMark: "Tersangka 01 // Lokasi A",
  },
  // 2. Top-Right: Slot 02
  {
    id: "pin2",
    name: "SLOT FOTO 02",
    role: "Subjek #02 // Saksi",
    photoUrl: "",
    dropFrame: 18,
    pinFrame: 26,
    x: 690,
    y: 110,
    width: 335,
    height: 415,
    rotation: 6,
    pinOffset: { x: 280, y: 70 },
    notes: "DOKUMEN RAHASIA B",
    handwrittenMark: "Saksi Kunci // Arsyiv",
  },
  // 3. Mid-Left: Slot 03
  {
    id: "pin3",
    name: "SLOT FOTO 03",
    role: "Subjek #03 // Motif",
    photoUrl: "",
    dropFrame: 26,
    pinFrame: 34,
    x: 40,
    y: 510,
    width: 335,
    height: 415,
    rotation: -8,
    pinOffset: { x: 45, y: 150 },
    notes: "PETUNJUK LAPANGAN",
    handwrittenMark: "Petunjuk 03 // ?",
  },
  // 4. Mid-Right: Slot 04
  {
    id: "pin4",
    name: "SLOT FOTO 04",
    role: "Subjek #04 // Koneksi",
    photoUrl: "",
    dropFrame: 34,
    pinFrame: 42,
    x: 710,
    y: 500,
    width: 335,
    height: 415,
    rotation: 8,
    pinOffset: { x: 285, y: 150 },
    notes: "JARINGAN KOMUNIKASI",
    handwrittenMark: "Koneksi Luar // Telegram",
  },
  // 5. Lower-Left / Bottom: Slot 05
  {
    id: "pin5",
    name: "SLOT FOTO 05",
    role: "Subjek #05 // Arsip",
    photoUrl: "",
    dropFrame: 42,
    pinFrame: 50,
    x: 85,
    y: 900,
    width: 335,
    height: 415,
    rotation: 4,
    pinOffset: { x: 70, y: 110 },
    notes: "REKAMAN DOKUMEN 05",
    handwrittenMark: "Barang Bukti #05",
  },
  // 6. Lower-Right / Bottom: Slot 06
  {
    id: "pin6",
    name: "SLOT FOTO 06",
    role: "Subjek #06 // Dokumen",
    photoUrl: "",
    dropFrame: 50,
    pinFrame: 58,
    x: 665,
    y: 885,
    width: 335,
    height: 415,
    rotation: -4,
    pinOffset: { x: 265, y: 110 },
    notes: "CATATAN OPERASI",
    handwrittenMark: "Laporan Akhir // 1939",
  },
  // 7. CENTER HERO: Slot Utama (Drops LAST and sits ON TOP of all cards!)
  {
    id: "pinHero",
    name: "FOTO UTAMA (HERO)",
    role: "Target Investigasi Utama",
    photoUrl: "",
    dropFrame: 60,
    pinFrame: 70,
    x: 320,
    y: 485,
    width: 440,
    height: 550,
    rotation: -2,
    pinOffset: { x: 370, y: 400 },
    notes: "OTAK DI BALIK PERISTIWA",
    handwrittenMark: "TARGET UTAMA // CONFIDENTIAL",
  },
];

export const DEFAULT_THREADS: ThreadConnection[] = [
  { from: 0, to: 1, startFrame: 26 }, // Slot 1 -> Slot 2
  { from: 1, to: 3, startFrame: 42 }, // Slot 2 -> Slot 4
  { from: 3, to: 5, startFrame: 58 }, // Slot 4 -> Slot 6
  { from: 5, to: 4, startFrame: 60 }, // Slot 6 -> Slot 5
  { from: 4, to: 2, startFrame: 52 }, // Slot 5 -> Slot 3
  { from: 2, to: 0, startFrame: 34 }, // Slot 3 -> Slot 1
  // Center Hero (Card 6 index) connects to all outer pins when hero lands:
  { from: 0, to: 6, startFrame: 70 }, // Slot 1 -> Hero
  { from: 1, to: 6, startFrame: 71 }, // Slot 2 -> Hero
  { from: 2, to: 6, startFrame: 72 }, // Slot 3 -> Hero
  { from: 3, to: 6, startFrame: 73 }, // Slot 4 -> Hero
  { from: 4, to: 6, startFrame: 74 }, // Slot 5 -> Hero
  { from: 5, to: 6, startFrame: 75 }, // Slot 6 -> Hero
];

export interface ConspiracyPinboardProps {
  frame: number;
  fps: number;
  cards?: PinItem[];
}

export const ConspiracyPinboard: React.FC<ConspiracyPinboardProps> = ({
  frame,
  fps,
  cards = DEFAULT_CONSPIRACY_CARDS,
}) => {
  const pinCoords = cards.map((c) => ({
    id: c.id,
    pinFrame: c.pinFrame,
    x: c.x + c.pinOffset.x,
    y: c.y + c.pinOffset.y,
  }));

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 15, pointerEvents: "none" }}>
      {/* 1. POLAROID PHOTOS STACK (Hero at Z-Index 50 so it never gets covered) */}
      {cards.map((card, idx) => {
        const isHero = card.id === "pinHero";
        const spr = spring({
          frame: Math.max(0, frame - card.dropFrame),
          fps,
          config: { damping: 15, stiffness: 80, mass: 0.95 },
        });

        const scale = interpolate(spr, [0, 1], [1.32, 1]);
        const translateY = interpolate(spr, [0, 1], [-240, 0]);
        const rotate = interpolate(
          spr,
          [0, 0.7, 1],
          [card.rotation - 12, card.rotation + 1.5, card.rotation]
        );
        const opacity = interpolate(spr, [0, 0.25, 1], [0, 1, 1]);

        if (frame < card.dropFrame) return null;
        const cardZIndex = isHero ? 50 : 20 + idx;

        return (
          <div
            key={card.id}
            style={{
              position: "absolute",
              top: card.y,
              left: card.x,
              width: card.width,
              height: card.height,
              backgroundColor: "#f5f0e4",
              backgroundImage:
                "radial-gradient(circle at 85% 90%, rgba(139, 109, 71, 0.18) 0%, transparent 65%)",
              padding: "16px 16px 28px 16px",
              boxShadow: isHero
                ? "0 35px 80px rgba(0,0,0,0.95), 0 10px 25px rgba(0,0,0,0.7)"
                : "0 22px 50px rgba(0,0,0,0.85), 0 4px 12px rgba(0,0,0,0.5)",
              border: "1px solid #d4cbb3",
              transform: `translateY(${translateY}px) rotate(${rotate}deg) scale(${scale})`,
              opacity,
              zIndex: cardZIndex,
            }}
          >
            <div
              style={{
                fontFamily: "'Caveat', cursive, sans-serif",
                fontSize: 16,
                fontWeight: 700,
                color: "#181410",
                marginBottom: 6,
                transform: "rotate(-2deg)",
                letterSpacing: 1,
              }}
            >
              {card.handwrittenMark}
            </div>

            <div
              style={{
                width: "100%",
                height: isHero ? 370 : 310,
                backgroundColor: "#1e1a17",
                border: "2px dashed rgba(255,255,255,0.22)",
                overflow: "hidden",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {card.photoUrl ? (
                <Img
                  src={card.photoUrl}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    filter: "grayscale(92%) sepia(18%) contrast(1.2)",
                  }}
                  alt={card.name}
                />
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    padding: 12,
                    color: "rgba(255,255,255,0.75)",
                  }}
                >
                  <svg
                    width="44"
                    height="44"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ opacity: 0.6, marginBottom: 8 }}
                  >
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  <div
                    style={{
                      fontFamily: "Courier Prime, monospace",
                      fontSize: isHero ? 14 : 12,
                      fontWeight: 900,
                      letterSpacing: 1.5,
                      color: isHero ? "#ffcc80" : "#d7ccc8",
                      textTransform: "uppercase",
                    }}
                  >
                    {isHero ? "★ " + card.name + " ★" : card.name}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Caveat', cursive, sans-serif",
                      fontSize: 14,
                      color: "rgba(255,255,255,0.5)",
                      marginTop: 2,
                    }}
                  >
                    Tempel Foto di Sini
                  </div>
                </div>
              )}
            </div>

            <div
              style={{
                marginTop: 10,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontFamily: "Courier Prime, monospace",
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  color: "#1c1814",
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}
              >
                {card.role}
              </span>
              <span style={{ fontSize: 10, color: "#6b5945", fontWeight: 700 }}>
                {card.notes}
              </span>
            </div>
          </div>
        );
      })}

      {/* 2. RED CONSPIRACY STRINGS (Z-INDEX 60: ALWAYS ON TOP OF PHOTOS) */}
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          overflow: "visible",
          zIndex: 60,
        }}
      >
        {DEFAULT_THREADS.map((t, i) => {
          if (frame < t.startFrame) return null;
          const p1 = pinCoords[t.from];
          const p2 = pinCoords[t.to];
          if (!p1 || !p2) return null;

          const drawProgress = Math.min(1, (frame - t.startFrame) / 8);
          const curX2 = p1.x + (p2.x - p1.x) * drawProgress;
          const curY2 = p1.y + (p2.y - p1.y) * drawProgress;

          return (
            <line
              key={i}
              x1={p1.x}
              y1={p1.y}
              x2={curX2}
              y2={curY2}
              stroke="#D32F2F"
              strokeWidth="4.2"
              strokeLinecap="round"
              filter="drop-shadow(0 2px 5px rgba(0,0,0,0.9))"
            />
          );
        })}

        {frame >= 30 && pinCoords[1] && (
          <ellipse
            cx={pinCoords[1].x}
            cy={pinCoords[1].y}
            rx={42}
            ry={34}
            fill="none"
            stroke="#1c1814"
            strokeWidth="2.2"
            strokeDasharray="4 2"
            transform={`rotate(-12 ${pinCoords[1].x} ${pinCoords[1].y})`}
            opacity={0.7}
          />
        )}

        {frame >= 38 && pinCoords[2] && (
          <text
            x={pinCoords[2].x + 35}
            y={pinCoords[2].y - 25}
            fontFamily="'Caveat', cursive, sans-serif"
            fontSize="54"
            fontWeight="bold"
            fill="#181410"
            opacity={0.85}
          >
            ?
          </text>
        )}
      </svg>

      {/* 3. 3D RED PUSHPINS (Z-INDEX 70: TOPMOST LAYER ON ALL PHOTOS) */}
      {pinCoords.map((pin) => {
        if (frame < pin.pinFrame) return null;
        const spr = spring({
          frame: Math.max(0, frame - pin.pinFrame),
          fps,
          config: { damping: 12, stiffness: 180, mass: 0.5 },
        });

        const scale = interpolate(spr, [0, 1], [2.2, 1]);
        const opacity = interpolate(spr, [0, 0.3, 1], [0, 1, 1]);

        return (
          <div
            key={pin.id}
            style={{
              position: "absolute",
              top: pin.y - 14,
              left: pin.x - 14,
              width: 28,
              height: 28,
              borderRadius: "50%",
              background:
                "radial-gradient(circle at 35% 35%, #ff5252 0%, #b71c1c 70%, #5f0909 100%)",
              boxShadow:
                "0 6px 14px rgba(0,0,0,0.95), inset 0 2px 4px rgba(255,255,255,0.6)",
              transform: `scale(${scale})`,
              opacity,
              zIndex: 70,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 6,
                left: 8,
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: "rgba(255, 255, 255, 0.75)",
              }}
            />
          </div>
        );
      })}
    </div>
  );
};


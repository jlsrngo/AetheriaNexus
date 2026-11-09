import React from "react";
import { spring, interpolate, Img, staticFile } from "remotion";
import defaultGlassImg from "../assets/vintage_magnifying_glass.png";
import defaultPersonImg from "../assets/person_photo.jpg";

export interface MagnifyingGlassInvestigatorProps {
  frame: number;
  fps: number;
  personPhotoUrl?: string;
  glassPngUrl?: string;
}

/**
 * MagnifyingGlassInvestigator
 * 
 * Sesuai Permintaan User:
 * 1. Tangan DIHILANGKAN.
 * 2. Kaca pembesar menggunakan PNG vintage antique (wood & brass) transparan.
 * 3. Menampilkan FOTO ORANG NYATA dengan efek muka blur tebal + tanda tanya '?' berdenyut.
 * 4. Kaca pembesar bergerak-gerak dinamis memeriksa dan memindai wajah di depan foto.
 */
export const MagnifyingGlassInvestigator: React.FC<MagnifyingGlassInvestigatorProps> = ({
  frame,
  fps,
  personPhotoUrl,
  glassPngUrl,
}) => {
  const photoSrc = personPhotoUrl || defaultPersonImg || staticFile("person_photo.jpg");
  const glassSrc = glassPngUrl || defaultGlassImg || staticFile("vintage_magnifying_glass.png");

  // 1. Kartu Polaroid Entry Animation
  const cardSpr = spring({
    frame: Math.max(0, frame - 6),
    fps,
    config: { damping: 14, stiffness: 85, mass: 0.9 },
  });
  const cardScale = interpolate(cardSpr, [0, 1], [1.25, 1]);
  const cardY = interpolate(cardSpr, [0, 1], [-180, 0]);
  const cardRotate = interpolate(cardSpr, [0, 1], [-8, -2]);
  const cardOpacity = interpolate(cardSpr, [0, 0.3, 1], [0, 1, 1]);

  // 2. Kaca Pembesar Entry & Scanning Kinematics (Tanpa Tangan)
  const glassEntrySpr = spring({
    frame: Math.max(0, frame - 18),
    fps,
    config: { damping: 15, stiffness: 70, mass: 1 },
  });
  const glassBaseX = interpolate(glassEntrySpr, [0, 1], [220, 0]);
  const glassBaseY = interpolate(glassEntrySpr, [0, 1], [260, 0]);
  const glassOpacity = interpolate(glassEntrySpr, [0, 0.3, 1], [0, 1, 1]);

  // Gerakan memindai melingkar/elips di area wajah subjek:
  const t = Math.max(0, (frame - 26) / fps);
  const scanOffsetX = Math.sin(t * 1.7) * 75 + Math.sin(t * 3.2) * 24;
  const scanOffsetY = Math.cos(t * 1.3) * 60 + Math.sin(t * 2.6) * 18;
  const glassTilt = Math.sin(t * 1.7) * 9;

  // Efek denyut tanda tanya '?' di atas wajah
  const questionPulse = 1 + Math.sin(frame * 0.12) * 0.08;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 20,
      }}
    >
      {/* ===================================================================
          A. FOTO POLAROID INVESTIGASI DENGAN FOTO ORANG ASLI (MUKA BLUR)
          =================================================================== */}
      <div
        style={{
          position: "relative",
          width: 540,
          backgroundColor: "#f5f0e4",
          backgroundImage:
            "radial-gradient(circle at 85% 90%, rgba(139, 109, 71, 0.22) 0%, transparent 70%)",
          padding: "24px 24px 36px 24px",
          borderRadius: 10,
          boxShadow:
            "0 35px 85px rgba(0,0,0,0.95), 0 10px 30px rgba(0,0,0,0.7), inset 0 0 10px rgba(0,0,0,0.06)",
          border: "1px solid #d4cbb3",
          transform: `translateY(${cardY - 60}px) scale(${cardScale}) rotate(${cardRotate}deg)`,
          opacity: cardOpacity,
          zIndex: 22,
        }}
      >
        {/* Cap Stempel RAHASIA / TOP SECRET */}
        <div
          style={{
            position: "absolute",
            top: 28,
            right: 28,
            border: "3px solid #b91c1c",
            borderRadius: 6,
            padding: "3px 14px",
            color: "#b91c1c",
            fontFamily: "'Courier Prime', monospace",
            fontWeight: 900,
            fontSize: 18,
            letterSpacing: 2,
            textTransform: "uppercase",
            transform: "rotate(14deg)",
            opacity: 0.9,
            zIndex: 10,
            boxShadow: "0 0 10px rgba(185, 28, 28, 0.35)",
            backgroundColor: "rgba(245, 240, 228, 0.8)",
          }}
        >
          TOP SECRET
        </div>

        {/* Catatan Tulisan Tangan di Atas */}
        <div
          style={{
            fontFamily: "'Caveat', cursive, sans-serif",
            fontSize: 22,
            fontWeight: 700,
            color: "#1c1814",
            marginBottom: 10,
            transform: "rotate(-1.5deg)",
            letterSpacing: 1,
          }}
        >
          Subjek Investigasi #01 // Identitas Dirahasiakan
        </div>

        {/* Container Foto Orang Asli dengan Sensor Muka Blur */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: 530,
            backgroundColor: "#161311",
            borderRadius: 4,
            overflow: "hidden",
            boxShadow: "inset 0 0 25px rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* FOTO ORANG ASLI */}
          <Img
            src={photoSrc}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "grayscale(85%) contrast(1.25) brightness(0.9)",
            }}
            alt="Foto Subjek Orang"
          />

          {/* SENSOR MUKA BLUR TEBAL (Hanya di Area Wajah) */}
          <div
            style={{
              position: "absolute",
              top: "16%",
              left: "26%",
              width: 255,
              height: 255,
              borderRadius: "50%",
              backdropFilter: "blur(22px) brightness(0.75)",
              WebkitBackdropFilter: "blur(22px) brightness(0.75)",
              background:
                "radial-gradient(circle at center, rgba(140, 110, 80, 0.65) 0%, rgba(30, 25, 20, 0.85) 75%, transparent 100%)",
              boxShadow: "0 0 35px rgba(0,0,0,0.8)",
              zIndex: 3,
            }}
          />

          {/* Tanda Tanya Besar '?' Emas Mengambang di Depan Muka */}
          <div
            style={{
              position: "absolute",
              top: "22%",
              zIndex: 5,
              fontFamily: "'Caveat', cursive, sans-serif",
              fontSize: 145,
              fontWeight: 900,
              color: "#fbbf24",
              textShadow:
                "0 0 25px rgba(251, 191, 36, 0.8), 0 6px 16px rgba(0,0,0,0.95)",
              transform: `scale(${questionPulse}) rotate(-4deg)`,
              lineHeight: 1,
              userSelect: "none",
            }}
          >
            ?
          </div>

          {/* Vignette Gelap di Sekeliling Foto */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle, transparent 40%, rgba(10,8,7,0.8) 100%)",
              zIndex: 4,
              pointerEvents: "none",
            }}
          />

          {/* HUD Target Koordinat */}
          <div
            style={{
              position: "absolute",
              top: 14,
              left: 14,
              fontFamily: "'Courier Prime', monospace",
              fontSize: 11,
              color: "#f59e0b",
              opacity: 0.9,
              display: "flex",
              flexDirection: "column",
              gap: 2,
              zIndex: 6,
            }}
          >
            <span>[ TARGET: UNKNOWN PERSON ]</span>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.6)" }}>
              FACIAL BLUR MASK: ACTIVE (100%)
            </span>
          </div>
        </div>

        {/* Caption Bawah Monospace */}
        <div
          style={{
            marginTop: 14,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontFamily: "'Courier Prime', monospace",
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 900,
              color: "#1c1814",
              letterSpacing: 1.5,
              textTransform: "uppercase",
            }}
          >
            KASUS #01 // MISTERI TAK TERPECAHKAN
          </span>
          <span style={{ fontSize: 11, color: "#6b5945", fontWeight: 700 }}>
            DOSSIER X
          </span>
        </div>
      </div>

      {/* ===================================================================
          B. KACA PEMBESAR VINTAGE PNG (TANPA TANGAN, MEMINDAI WAJAH!)
          =================================================================== */}
      <div
        style={{
          position: "absolute",
          top: "44%",
          left: "48%",
          width: 440,
          height: 440,
          transform: `translate(${glassBaseX + scanOffsetX - 220}px, ${
            glassBaseY + scanOffsetY - 220
          }px) rotate(${glassTilt}deg)`,
          opacity: glassOpacity,
          zIndex: 60,
          filter: "drop-shadow(0 30px 45px rgba(0,0,0,0.95))",
          pointerEvents: "none",
        }}
      >
        {/* Kaca Pembesar Antique Brass & Wood Transparent PNG */}
        <Img
          src={glassSrc}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            transform: "scale(1.05)",
          }}
          alt="Vintage Magnifying Glass"
        />

        {/* Dynamic Focus Ring di Tengah Kaca */}
        <div
          style={{
            position: "absolute",
            top: "22%",
            left: "22%",
            width: 130,
            height: 130,
            borderRadius: "50%",
            border: "1.5px dashed rgba(251, 191, 36, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255, 230, 160, 0.08)",
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              fontFamily: "'Caveat', cursive, sans-serif",
              fontSize: 54,
              fontWeight: 900,
              color: "#f59e0b",
              opacity: 0.9,
              textShadow: "0 0 12px rgba(245, 158, 11, 0.8)",
              transform: `rotate(${Math.sin(frame * 0.1) * 6}deg)`,
            }}
          >
            ?
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * Scene 7 — LEGACY & REDEMPTION  (563 frames · 18.775s)
 * "Hari ini, dunia komputasi dan kecerdasan buatan berdiri di atas gagasan..."
 *
 * /mg-cutout-collage beats:
 *  B1 (0):   Black fades to kraft warmth. Turing statue CollagePiece rises.
 *  B2 (80):  AI/computing elements slap in — circuit traces, modern laptop.
 *  B3 (200): "ROYAL PARDON 2013" badge slams. Typewriter text: "Turing Test · AI".
 *  B4 (340): End card: "DIA MENYELAMATKAN DUNIA" — centred, micro-motion boil. Held 1.2s.
 */
import React from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { ArchivalBackground } from "../components/ArchivalBackground";
import { CollagePiece } from "../components/CollagePiece";
import { HormoziSubtitle } from "../components/HormoziSubtitle";
import { SceneTransition } from "../components/SceneTransition";
import { TURING_SCENES, TURING_WORDS } from "../types";
import { cameraSnapZoom, boilJitter } from "../motion/collageMotion";

const B1 = 0;
const B2 = 80;
const B3 = 200;
const B4 = 340;

export const Scene7: React.FC = () => {
  const frame = useCurrentFrame();
  const meta = TURING_SCENES.s7;
  const cam = cameraSnapZoom(frame, [B1, B2, B3, B4]);

  // B1: Background lightens from black to warm kraft
  const bgLightness = interpolate(frame, [B1, B1 + 60], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const bgColor = `rgb(${Math.round(10 + bgLightness * 237)}, ${Math.round(8 + bgLightness * 231)}, ${Math.round(6 + bgLightness * 220)})`;

  // B1: Statue rise from bottom
  const statueSpr = spring({
    frame: Math.max(0, frame - B1 - 15), fps: 30,
    config: { damping: 14, stiffness: 120 },
  });
  const statueY = interpolate(statueSpr, [0, 1], [600, 0]);
  const statueOpacity = interpolate(statueSpr, [0, 1], [0, 1]);

  // B2: Laptop slap
  const laptopSpr = spring({
    frame: Math.max(0, frame - B2), fps: 30,
    config: { damping: 11, stiffness: 190 },
  });
  const laptopX = interpolate(laptopSpr, [0, 1], [680, 0]);
  const laptopOpacity = interpolate(laptopSpr, [0, 1], [0, 1]);

  // B2: Circuit annotation
  const circuitOpacity = interpolate(frame, [B2 + 20, B2 + 50], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // B3: Pardon badge slam
  const pardonSpr = spring({
    frame: Math.max(0, frame - B3), fps: 30,
    config: { damping: 7, stiffness: 260 },
  });
  const pardonScale = interpolate(pardonSpr, [0, 1], [4.5, 1]);
  const pardonOpacity = interpolate(pardonSpr, [0, 1], [0, 1]);

  // B3: Typewriter text reveals
  const typewriterProgress = interpolate(frame, [B3 + 10, B3 + 90], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const typewriterText = "TURING TEST · ARTIFICIAL INTELLIGENCE · COMPUTER SCIENCE";
  const charsVisible = Math.floor(typewriterProgress * typewriterText.length);

  // B4: End card centred
  const endCardOpacity = interpolate(frame, [B4, B4 + 30], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const endCardJitter = boilJitter(701, frame, 1.2, 6);

  // B1–B4: subtle candle-warmth vignette lightens
  const vignetteAlpha = interpolate(frame, [B1, B4], [0.0, 0.3], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // Final micro-hold — no fade-out (end card lives on)
  const holdOpacity = interpolate(
    frame,
    [meta.durationInFrames - 20, meta.durationInFrames - 5],
    [1, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        background: bgColor,
        overflow: "hidden",
        transform: `scale(${cam.scale}) translate(${cam.panX}px, ${cam.panY}px)`,
      }}
    >
      <Audio src={staticFile(meta.audioFile)} />

      <ArchivalBackground variant="kraft" />

      {/* Warm vignette */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(180,120,40,${vignetteAlpha}) 100%)`,
          pointerEvents: "none",
          zIndex: 50,
        }}
      />

      {/* B1: Turing statue centrepiece */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          transform: `translateY(${statueY}px)`,
          opacity: statueOpacity,
          zIndex: 12,
        }}
      >
        <CollagePiece
          id={701}
          src={staticFile("img_turing_statue.jpg")}
          top={160}
          left={100}
          width={880}
          height={760}
          rotation={-0.8}
          dropFrame={0}
          hasPin
          pinColor="#2B4A8F"
          tapeColor="#FFDE59"
          zIndex={12}
        />
      </div>

      {/* B2: Modern laptop */}
      <div
        style={{
          position: "absolute",
          top: 860,
          left: 460,
          transform: `translateX(${laptopX}px) rotate(2.5deg)`,
          opacity: laptopOpacity,
          zIndex: 16,
        }}
      >
        <CollagePiece
          id={702}
          src={staticFile("img_laptop_local.jpg")}
          top={0}
          left={0}
          width={500}
          height={340}
          rotation={2.5}
          dropFrame={0}
          hasPin={false}
          tapeColor="#2B4A8F"
          zIndex={16}
        />
      </div>

      {/* B2: Circuit annotation */}
      <div
        style={{
          position: "absolute",
          top: 920,
          left: 80,
          opacity: circuitOpacity,
          zIndex: 18,
        }}
      >
        <svg width="380" height="100">
          <line x1="10" y1="50" x2="340" y2="50" stroke="#2B4A8F" strokeWidth="2" strokeDasharray="8 4" />
          <circle cx="10" cy="50" r="6" fill="#D94030" />
          <circle cx="180" cy="50" r="6" fill="#FFDE59" />
          <circle cx="340" cy="50" r="6" fill="#2B4A8F" />
          <text x="0" y="82" fill="#1A1A1A" fontSize="18" fontFamily="Courier New" fontWeight="bold">
            AI · COMPUTING · LEGACY
          </text>
        </svg>
      </div>

      {/* B3: Royal Pardon badge */}
      <div
        style={{
          position: "absolute",
          top: 148,
          left: 100,
          transform: `scale(${pardonScale}) rotate(5deg)`,
          opacity: pardonOpacity,
          background: "#2B4A8F",
          border: "5px solid #FFDE59",
          padding: "10px 22px",
          zIndex: 26,
        }}
      >
        <span
          style={{
            fontFamily: "Impact, sans-serif",
            fontSize: 38,
            fontWeight: 900,
            color: "#FFDE59",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          ✦ ROYAL PARDON · 2013 ✦
        </span>
      </div>

      {/* B3: Typewriter text */}
      <div
        style={{
          position: "absolute",
          bottom: 320,
          left: 60,
          right: 60,
          zIndex: 24,
          opacity: circuitOpacity,
        }}
      >
        <div
          style={{
            fontFamily: "'Courier New', monospace",
            fontSize: 22,
            fontWeight: 700,
            color: "#1A1A1A",
            letterSpacing: "0.08em",
            lineHeight: 1.5,
            background: "rgba(244,239,228,0.9)",
            padding: "10px 16px",
            border: "2px solid #1A1A1A",
          }}
        >
          {typewriterText.slice(0, charsVisible)}
          {charsVisible < typewriterText.length && <span style={{ opacity: frame % 8 < 4 ? 1 : 0 }}>|</span>}
        </div>
      </div>

      {/* B4: END CARD */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 60,
          opacity: endCardOpacity,
          transform: `translate(${endCardJitter.x}px, ${endCardJitter.y}px)`,
        }}
      >
        <div
          style={{
            background: "rgba(10,8,6,0.88)",
            padding: "40px 60px",
            textAlign: "center",
            border: "4px solid #FFDE59",
            maxWidth: 900,
          }}
        >
          <div
            style={{
              fontFamily: "Impact, 'Arial Black', sans-serif",
              fontSize: 76,
              fontWeight: 900,
              color: "#F4EFE4",
              textTransform: "uppercase",
              letterSpacing: "-1px",
              lineHeight: 1.05,
              textShadow: "3px 3px 0 #000",
            }}
          >
            DIA MENYELAMATKAN
            <span style={{ color: "#D94030" }}> DUNIA</span>
          </div>
          <div
            style={{
              marginTop: 18,
              fontFamily: "'Courier New', monospace",
              fontSize: 28,
              color: "#FFDE59",
              letterSpacing: "0.1em",
              fontWeight: 700,
            }}
          >
            ALAN TURING · 1912–1954
          </div>
          <div
            style={{
              marginTop: 10,
              fontFamily: "'Courier New', monospace",
              fontSize: 20,
              color: "#F4EFE4",
              letterSpacing: "0.08em",
              opacity: 0.8,
            }}
          >
            TAPI DUNIA TIDAK MENYELAMATKANNYA
          </div>
        </div>
      </div>

      <HormoziSubtitle
        words={TURING_WORDS["s7"]}
        top={1430}
        highlightColor="#FFDE59"
        maxWordsPerChunk={4}
      />

      <SceneTransition frame={frame} totalFrames={meta.durationInFrames} type="none" />
    </AbsoluteFill>
  );
};

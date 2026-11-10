/**
 * Scene 4 — THE BOMBE MACHINE  (419 frames · 13.955s)
 * "Turing kemudian mengembangkan mesin bernama Bombe..."
 *
 * /mg-cutout-collage beats:
 *  B1 (0):   Blueprint paper slaps from right. Bombe machine image DROPS. Scissor rim.
 *  B2 (60):  Gear/drum animation annotated. "THE BOMBE" stencil punch-in.
 *  B3 (150): "BREAKING THE CODE" badge SLAMS yellow-on-black. OBE document card.
 *  B4 (250): Camera hard snap zoom. Bletchley annotation. Morse cipher strip.
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
const B2 = 60;
const B3 = 150;
const B4 = 250;

export const Scene4: React.FC = () => {
  const frame = useCurrentFrame();
  const meta = TURING_SCENES.s4;
  const cam = cameraSnapZoom(frame, [B1, B2, B3, B4]);

  // B1: Blueprint annotation opacity
  const blueprintAnnotOpacity = interpolate(frame, [B1 + 20, B1 + 45], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // B2: "THE BOMBE" title punch
  const bombeTitleSpr = spring({
    frame: Math.max(0, frame - B2), fps: 30,
    config: { damping: 9, stiffness: 200 },
  });
  const bombeTitleScale = interpolate(bombeTitleSpr, [0, 1], [3.2, 1]);
  const bombeTitleOpacity = interpolate(bombeTitleSpr, [0, 1], [0, 1]);

  // B3: Badge slam
  const badgeSpr = spring({
    frame: Math.max(0, frame - B3), fps: 30,
    config: { damping: 7, stiffness: 240 },
  });
  const badgeScale = interpolate(badgeSpr, [0, 1], [4.0, 1]);
  const badgeOpacity = interpolate(badgeSpr, [0, 1], [0, 1]);

  // B3: OBE document card fade
  const obeOpacity = interpolate(frame, [B3 + 10, B3 + 40], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // Gear rotation (continuous spinning) — stop-motion 12fps
  const gearStepIndex = Math.floor((frame / 30) * 12);
  const gearRotation = (gearStepIndex * 30) % 360;

  // Boil jitter on blueprint
  const blueprintJitter = boilJitter(401, frame, 1.5, 12);

  // Cut flash
  const flashOpacity = interpolate(
    frame,
    [meta.durationInFrames - 6, meta.durationInFrames - 1],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        background: "#0F1318",
        overflow: "hidden",
        transform: `scale(${cam.scale}) translate(${cam.panX}px, ${cam.panY}px)`,
      }}
    >
      <Audio src={staticFile(meta.audioFile)} />

      <ArchivalBackground variant="blueprint" />

      {/* B1: Bombe machine photo — main hero */}
      <CollagePiece
        id={401}
        src={staticFile("img_bombe.jpg")}
        top={240}
        left={80}
        width={920}
        height={660}
        rotation={-1.0}
        dropFrame={B1 + 10}
        hasPin
        pinColor="#FFDE59"
        tapeColor="#2B4A8F"
        zIndex={12}
      />

      {/* Blueprint annotation overlay */}
      <div
        style={{
          position: "absolute",
          top: 230,
          left: 72,
          opacity: blueprintAnnotOpacity,
          transform: `translate(${blueprintJitter.x}px, ${blueprintJitter.y}px)`,
          zIndex: 14,
          pointerEvents: "none",
        }}
      >
        {/* Gear indicator line */}
        <svg width="300" height="80">
          <line x1="10" y1="40" x2="260" y2="40" stroke="#FFDE59" strokeWidth="2" strokeDasharray="6 4" />
          <circle cx="10" cy="40" r="6" fill="#D94030" />
          <text x="270" y="46" fill="#FFDE59" fontSize="18" fontFamily="Courier New">
            DRUM
          </text>
        </svg>
      </div>

      {/* B2: Animated gear (SVG stop-motion) */}
      <div
        style={{
          position: "absolute",
          top: 820,
          left: 760,
          zIndex: 18,
          opacity: bombeTitleOpacity,
        }}
      >
        <svg
          width="180"
          height="180"
          style={{ transform: `rotate(${gearRotation}deg)` }}
        >
          <circle cx="90" cy="90" r="70" fill="none" stroke="#FFDE59" strokeWidth="3" />
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i * 30 * Math.PI) / 180;
            const x1 = 90 + 65 * Math.cos(angle);
            const y1 = 90 + 65 * Math.sin(angle);
            const x2 = 90 + 82 * Math.cos(angle);
            const y2 = 90 + 82 * Math.sin(angle);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#FFDE59" strokeWidth="8" strokeLinecap="round" />;
          })}
          <circle cx="90" cy="90" r="22" fill="#D94030" />
          <circle cx="90" cy="90" r="8" fill="#0F1318" />
        </svg>
      </div>

      {/* B2: "THE BOMBE" stencil title */}
      <div
        style={{
          position: "absolute",
          top: 820,
          left: 60,
          transform: `scale(${bombeTitleScale}) rotate(-2deg)`,
          opacity: bombeTitleOpacity,
          zIndex: 20,
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
            lineHeight: 0.95,
            textShadow: "3px 3px 0 #1A1A1A",
          }}
        >
          THE
          <span style={{ color: "#FFDE59" }}> BOMBE</span>
        </div>
      </div>

      {/* B3: BREAKING THE CODE badge */}
      <div
        style={{
          position: "absolute",
          top: 148,
          left: 180,
          transform: `scale(${badgeScale}) rotate(3deg)`,
          opacity: badgeOpacity,
          background: "#FFDE59",
          border: "5px solid #1A1A1A",
          padding: "10px 22px",
          zIndex: 26,
        }}
      >
        <span
          style={{
            fontFamily: "Impact, sans-serif",
            fontSize: 42,
            fontWeight: 900,
            color: "#1A1A1A",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          ✦ BREAKING THE CODE ✦
        </span>
      </div>

      {/* B3: OBE document card */}
      <div
        style={{
          position: "absolute",
          top: 920,
          right: 60,
          opacity: obeOpacity,
          transform: "rotate(2.5deg)",
          zIndex: 22,
          background: "#F4EFE4",
          border: "3px solid #1A1A1A",
          padding: "14px 18px",
          width: 280,
        }}
      >
        <div
          style={{
            fontFamily: "'Courier New', monospace",
            fontSize: 20,
            fontWeight: 700,
            color: "#1A1A1A",
            lineHeight: 1.5,
            textAlign: "center",
          }}
        >
          OBE AWARD<br />
          <span style={{ color: "#D94030", fontWeight: 900 }}>ALAN TURING</span><br />
          1946
        </div>
      </div>

      <HormoziSubtitle
        words={TURING_WORDS["s4"]}
        top={1430}
        highlightColor="#FFDE59"
        maxWordsPerChunk={4}
      />

      <AbsoluteFill
        style={{
          background: `rgba(255,255,255,${flashOpacity})`,
          zIndex: 99,
          pointerEvents: "none",
        }}
      />

      <SceneTransition frame={frame} totalFrames={meta.durationInFrames} type="flash" />
    </AbsoluteFill>
  );
};

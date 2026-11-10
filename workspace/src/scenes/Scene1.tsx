/**
 * Scene 1 — THE HOOK  (256 frames · 8.535s)
 * "Negaranya membutuhkan otaknya untuk memenangkan perang..."
 *
 * /mg-cutout-collage beats:
 *  B1 (0):    Stencil headline PUNCHES in — Impact, red on kraft paper, −3° diagonal.
 *  B2 (40):   Alan Turing portrait CollagePiece SLAPS down from camera; scissor rim; cork pin.
 *  B3 (100):  Redaction bar TEARS left→right; "★ TOP SECRET // GC&CS ★" appears.
 *  B4 (160):  Camera snap-zoom push; vignette intensifies. Subtitle active throughout.
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
import { cameraSnapZoom } from "../motion/collageMotion";

const B1 = 0;
const B2 = 40;
const B3 = 100;
const B4 = 160;

export const Scene1: React.FC = () => {
  const frame = useCurrentFrame();
  const meta = TURING_SCENES.s1;
  const cam = cameraSnapZoom(frame, [B1, B2, B3, B4]);

  // ── B1: Constructivist headline punch-in ──────────────────────────────
  const titleSpr = spring({ frame, fps: 30, config: { damping: 10, stiffness: 180 } });
  const titleScale = interpolate(titleSpr, [0, 1], [2.4, 1]);
  const titleOpacity = interpolate(titleSpr, [0, 1], [0, 1]);

  // ── B3: Redaction bar sweep ───────────────────────────────────────────
  const redactSpr = spring({
    frame: Math.max(0, frame - B3), fps: 30,
    config: { damping: 18, stiffness: 95 },
  });
  const redactW = interpolate(redactSpr, [0, 1], [0, 920]);
  const secretOpacity = interpolate(frame, [B3 + 15, B3 + 35], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // ── B4: Vignette intensifies ──────────────────────────────────────────
  const vignetteAlpha = interpolate(frame, [B4, B4 + 40], [0.45, 0.72], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // ── Cut flash on exit ─────────────────────────────────────────────────
  const flashOpacity = interpolate(
    frame,
    [meta.durationInFrames - 6, meta.durationInFrames - 1],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        background: "#1A1512",
        overflow: "hidden",
        transform: `scale(${cam.scale}) translate(${cam.panX}px, ${cam.panY}px)`,
      }}
    >
      {/* Voiceover */}
      <Audio src={staticFile(meta.audioFile)} />

      {/* Kraft paper background */}
      <ArchivalBackground variant="kraft" />

      {/* Vignette */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,${vignetteAlpha}) 100%)`,
          pointerEvents: "none",
          zIndex: 50,
        }}
      />

      {/* B1: Title headline slam */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 20,
        }}
      >
        <div
          style={{
            fontFamily: "Impact, 'Arial Black', sans-serif",
            fontSize: 96,
            fontWeight: 900,
            color: "#D94030",
            textTransform: "uppercase",
            letterSpacing: "-2px",
            lineHeight: 1.05,
            textAlign: "center",
            transform: `scale(${titleScale}) rotate(-3deg)`,
            opacity: titleOpacity,
            padding: "0 54px",
            textShadow: "4px 4px 0px #1A1A1A",
          }}
        >
          DIA MENYELAMATKAN{"\n"}DUNIA
        </div>
      </AbsoluteFill>

      {/* B2: Turing portrait CollagePiece */}
      <CollagePiece
        id={101}
        src={staticFile("img_alan_turing.jpg")}
        top={520}
        left={120}
        width={840}
        height={760}
        rotation={-1.5}
        dropFrame={B2}
        hasPin
        pinColor="#D94030"
        stampText="★ ALAN TURING · 1912–1954 ★"
        stampFrame={B3 + 20}
        stampColor="#D94030"
        tapeColor="#FFDE59"
        zIndex={15}
      />

      {/* B3: Redaction bar */}
      <div
        style={{
          position: "absolute",
          top: 460,
          left: 80,
          width: redactW,
          height: 44,
          background: "#1A1A1A",
          zIndex: 25,
          overflow: "hidden",
        }}
      >
        <span
          style={{
            fontFamily: "'Courier New', monospace",
            fontSize: 20,
            fontWeight: 700,
            color: "#F4EFE4",
            letterSpacing: "0.18em",
            lineHeight: "44px",
            paddingLeft: 12,
            opacity: secretOpacity,
            display: "block",
          }}
        >
          ★ TOP SECRET // GC&CS ★
        </span>
      </div>

      {/* Subtitle */}
      <HormoziSubtitle
        words={TURING_WORDS["s1"]}
        top={1430}
        highlightColor="#FFDE59"
        maxWordsPerChunk={4}
      />

      {/* Cut flash */}
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

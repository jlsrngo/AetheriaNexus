/**
 * Scene 1 — THE HOOK
 * "Negaranya membutuhkan otaknya untuk memenangkan perang..."
 *
 * Beat 1 (0–B2):   HOOK stencil title slams + Enigma CollagePiece drops
 * Beat 2 (B2–B3):  Redaction bar tears open across the title word
 * Beat 3 (B3–B4):  "★ TOP SECRET ★" stamp on Enigma card
 * Beat 4 (B4–end): Camera snap-zoom push; vignette intensifies
 */
import React from "react";
import { AbsoluteFill, Audio, interpolate, spring, staticFile, useCurrentFrame } from "remotion";
import { ArchivalBackground } from "../components/ArchivalBackground";
import { CollagePiece } from "../components/CollagePiece";
import { HormoziSubtitle } from "../components/HormoziSubtitle";
import { SceneTransition } from "../components/SceneTransition";
import { TURING_SCENES, TURING_WORDS } from "../types";
import { cameraSnapZoom } from "../motion/collageMotion";

const B1 = 0;
const B2 = 40;   // 1.3s — Enigma card drops
const B3 = 95;   // 3.2s — redaction bar reveals
const B4 = 155;  // 5.2s — camera snap-zoom

export const Scene1: React.FC = () => {
  const frame = useCurrentFrame();
  const meta = TURING_SCENES.s1;
  const cam = cameraSnapZoom(frame, [B1, B2, B3, B4]);

  // ── Beat 1: Stencil title punch ───────────────────────────────────────
  const titleSpr = spring({ frame, fps: 30, config: { damping: 10, stiffness: 180 } });
  const titleScale = interpolate(titleSpr, [0, 1], [2.4, 1]);
  const titleOpacity = interpolate(titleSpr, [0, 1], [0, 1]);

  // ── Beat 3: Redaction bar sweep ───────────────────────────────────────
  const redactSpr = spring({ frame: Math.max(0, frame - B3), fps: 30, config: { damping: 18, stiffness: 95 } });
  const redactW = interpolate(redactSpr, [0, 1], [0, 920]);
  const redactTextOpacity = interpolate(frame, [B3 + 12, B3 + 32], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // ── Beat 4: Vignette darkens ──────────────────────────────────────────
  const vigOpacity = interpolate(frame, [B4, meta.durationInFrames - 10], [0.35, 0.72], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: "#080608", overflow: "hidden" }}>
      <Audio src={staticFile(meta.audioFile)} />

      {/* Flash cut-in */}
      <SceneTransition type="flash" />

      {/* Cork-board background */}
      <ArchivalBackground durationInFrames={meta.durationInFrames} />

      {/* ── Camera wrap ─────────────────────────────────────────────────── */}
      <AbsoluteFill
        style={{
          transform: `translate3d(${cam.panX}px,${cam.panY}px,0) scale(${cam.scale})`,
          transformOrigin: "center center",
        }}
      >
        {/* Beat 1 — Stencil headline */}
        <div
          style={{
            position: "absolute",
            top: 180,
            left: 0,
            right: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            opacity: titleOpacity,
            transform: `scale(${titleScale})`,
          }}
        >
          <div style={{
            fontFamily: "'Anton', 'Impact', sans-serif",
            fontSize: 76,
            fontWeight: 900,
            color: "#F5F0E0",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            textAlign: "center",
            lineHeight: 1.05,
            textShadow: "3px 3px 0 #000, -3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000",
            padding: "0 60px",
          }}>
            DIA MENYELAMATKAN{"\n"}DUNIA
          </div>
          <div style={{
            fontFamily: "'Special Elite', monospace",
            fontSize: 32,
            color: "#C8B89A",
            letterSpacing: "0.22em",
            marginTop: 12,
            textTransform: "uppercase",
          }}>
            — TAPI DUNIA TIDAK MENYELAMATKANNYA —
          </div>
        </div>

        {/* Beat 2 — Enigma CollagePiece */}
        <CollagePiece
          id={1}
          src="img_enigma.jpg"
          top={340}
          left={80}
          width={920}
          height={560}
          rotation={-2}
          dropFrame={B2}
          hasPin={true}
          pinColor="#CC2200"
          stampText="★ TOP SECRET ★"
          stampFrame={B3 + 10}
          stampColor="#CC1A00"
          tapeColor="rgba(240,220,170,0.75)"
          zIndex={12}
        />

        {/* Beat 3 — Redaction bar */}
        <div
          style={{
            position: "absolute",
            top: 950,
            left: 80,
            height: 56,
            display: "flex",
            alignItems: "center",
            overflow: "hidden",
          }}
        >
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0,
            width: redactW, background: "rgba(200,20,20,0.9)", borderRadius: 4,
            maxWidth: 920,
          }} />
          <span style={{
            position: "relative", zIndex: 2,
            paddingLeft: 18,
            fontFamily: "'Special Elite', monospace",
            fontSize: 28, color: "#fff",
            letterSpacing: "0.14em",
            opacity: redactTextOpacity,
            whiteSpace: "nowrap",
          }}>
            CLASSIFIED — BLETCHLEY PARK — GC&CS
          </span>
        </div>

        {/* Vignette */}
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.85) 100%)",
          opacity: vigOpacity,
          pointerEvents: "none",
        }} />
      </AbsoluteFill>

      {/* Kinetic subtitle — always above camera wrap */}
      <HormoziSubtitle words={TURING_WORDS.s1} top={1400} highlightColor="#FFDE59" />
    </AbsoluteFill>
  );
};

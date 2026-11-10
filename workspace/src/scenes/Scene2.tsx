/**
 * Scene 2 — WHO IS HE?
 * "Namanya Alan Turing. Seorang matematikawan Inggris..."
 *
 * Beat 1 (0–B2):   Turing portrait CollagePiece drops (top-centre)
 * Beat 2 (B2–B3):  Enigma card swings in from right; RedThread connects them
 * Beat 3 (B3–B4):  DECLASSIFIED stamp slams
 * Beat 4 (B4–end): Camera snap-zoom handheld drift
 */
import React from "react";
import { AbsoluteFill, Audio, interpolate, spring, staticFile, useCurrentFrame } from "remotion";
import { ArchivalBackground } from "../components/ArchivalBackground";
import { CollagePiece } from "../components/CollagePiece";
import { HormoziSubtitle } from "../components/HormoziSubtitle";
import { RedThread } from "../components/RedThread";
import { SceneTransition } from "../components/SceneTransition";
import { TURING_SCENES, TURING_WORDS } from "../types";
import { cameraSnapZoom } from "../motion/collageMotion";

const B1 = 0;
const B2 = 70;   // 2.3s — Enigma card drops
const B3 = 155;  // 5.2s — DECLASSIFIED stamp
const B4 = 240;  // 8.0s — camera snap-zoom

export const Scene2: React.FC = () => {
  const frame = useCurrentFrame();
  const meta = TURING_SCENES.s2;
  const cam = cameraSnapZoom(frame, [B1, B2, B3, B4]);

  // Red thread fades in with Beat 2
  const threadOpacity = interpolate(frame, [B2 + 5, B2 + 30], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // Date annotation fades at B2
  const annotationOpacity = interpolate(frame, [B2, B2 + 25], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // Classification bar at B3
  const classBarSpr = spring({ frame: Math.max(0, frame - B3), fps: 30, config: { damping: 14, stiffness: 110 } });
  const classBarW = interpolate(classBarSpr, [0, 1], [0, 880]);

  return (
    <AbsoluteFill style={{ background: "#0A0A0C", overflow: "hidden" }}>
      <Audio src={staticFile(meta.audioFile)} />
      <SceneTransition type="flash" />
      <ArchivalBackground durationInFrames={meta.durationInFrames} />

      <AbsoluteFill
        style={{
          transform: `translate3d(${cam.panX}px,${cam.panY}px,0) scale(${cam.scale})`,
          transformOrigin: "center center",
        }}
      >
        {/* Beat 1 — Turing portrait */}
        <CollagePiece
          id={2}
          src="img_alan_turing.jpg"
          top={130}
          left={120}
          width={520}
          height={640}
          rotation={-3}
          dropFrame={B1}
          hasPin={true}
          pinColor="#2244CC"
          tapeColor="rgba(240,220,170,0.75)"
          zIndex={12}
        />

        {/* Beat 2 — Enigma card from right */}
        <CollagePiece
          id={3}
          src="img_enigma.jpg"
          top={200}
          left={500}
          width={440}
          height={500}
          rotation={4}
          dropFrame={B2}
          hasPin={true}
          pinColor="#CC2200"
          stampText="ENIGMA"
          stampFrame={B2 + 20}
          stampColor="#8B0000"
          zIndex={11}
        />

        {/* Red thread connecting the two cards */}
        <div style={{ opacity: threadOpacity, position: "absolute", inset: 0, zIndex: 13 }}>
          <RedThread x1={380} y1={320} x2={590} y2={380} startFrame={B2 + 5} sag={28} />
        </div>

        {/* Beat 2 — Typewriter annotation */}
        <div style={{
          position: "absolute",
          top: 820,
          left: 100,
          opacity: annotationOpacity,
          fontFamily: "'Special Elite', monospace",
          fontSize: 26,
          color: "#C8B89A",
          letterSpacing: "0.1em",
          lineHeight: 1.6,
        }}>
          <div>BORN: 23 JUNE 1912 — LONDON</div>
          <div>PROFESSION: MATHEMATICIAN / LOGICIAN</div>
          <div>CLEARANCE: GC&CS ULTRA SECRET</div>
        </div>

        {/* Beat 3 — Classification bar */}
        <div style={{
          position: "absolute",
          top: 1020,
          left: 100,
          height: 54,
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0,
            width: classBarW, maxWidth: 880,
            background: "rgba(0,80,180,0.85)", borderRadius: 4,
          }} />
          <span style={{
            position: "relative", zIndex: 2, paddingLeft: 16,
            fontFamily: "'Special Elite', monospace",
            fontSize: 26, color: "#fff",
            letterSpacing: "0.14em",
            opacity: interpolate(frame, [B3 + 10, B3 + 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            whiteSpace: "nowrap",
          }}>
            ★★★ DECLASSIFIED — PUBLIC RECORD OFFICE ★★★
          </span>
        </div>
      </AbsoluteFill>

      <HormoziSubtitle words={TURING_WORDS.s2} top={1390} highlightColor="#FFDE59" />
    </AbsoluteFill>
  );
};

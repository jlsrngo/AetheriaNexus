/**
 * Scene 6 — THE TRAGIC END
 * "Pada 7 Juni 1954, Alan Turing meninggal dunia di usia 41 tahun..."
 *
 * Beat 1 (0–B2):   Turing statue CollagePiece drops; RainWindowOverlay active
 * Beat 2 (B2–B3):  "1954" date badge fades in; candlelight glow
 * Beat 3 (B3–B4):  IN MEMORIAM plaque slams
 * Beat 4 (B4–end): SceneTransition fade-to-black (cinematic end)
 */
import React from "react";
import { AbsoluteFill, Audio, interpolate, spring, staticFile, useCurrentFrame } from "remotion";
import { ArchivalBackground } from "../components/ArchivalBackground";
import { CollagePiece } from "../components/CollagePiece";
import { HormoziSubtitle } from "../components/HormoziSubtitle";
import { RainWindowOverlay } from "../components/RainWindowOverlay";
import { SceneTransition } from "../components/SceneTransition";
import { TURING_SCENES, TURING_WORDS } from "../types";
import { cameraSnapZoom } from "../motion/collageMotion";

const B1 = 0;
const B2 = 65;   // 2.2s — date badge
const B3 = 140;  // 4.7s — IN MEMORIAM plaque
const B4 = 210;  // 7.0s — fade to black begins

export const Scene6: React.FC = () => {
  const frame = useCurrentFrame();
  const meta = TURING_SCENES.s6;
  const cam = cameraSnapZoom(frame, [B1, B2, B3]);

  // Date badge entrance
  const dateSpr = spring({ frame: Math.max(0, frame - B2), fps: 30, config: { damping: 14, stiffness: 110 } });
  const dateScale = interpolate(dateSpr, [0, 1], [0.4, 1]);
  const dateOpacity = interpolate(dateSpr, [0, 1], [0, 1]);

  // IN MEMORIAM plaque
  const plaqueSpr = spring({ frame: Math.max(0, frame - B3), fps: 30, config: { damping: 9, stiffness: 200 } });
  const plaqueScale = interpolate(plaqueSpr, [0, 1], [2.8, 1]);
  const plaqueOpacity = interpolate(plaqueSpr, [0, 1], [0, 1]);

  // Candlelight flicker warm glow
  const flicker = Math.sin(frame * 0.41) * 0.06 + Math.sin(frame * 0.73) * 0.04;
  const candleAlpha = interpolate(frame, [B2, B2 + 40], [0, 0.22 + flicker], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: "#080608", overflow: "hidden" }}>
      <Audio src={staticFile(meta.audioFile)} />
      <SceneTransition type="flash" />

      {/* Archival bg */}
      <ArchivalBackground durationInFrames={meta.durationInFrames} />

      {/* Rain window — always at scene level, below content */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.65, zIndex: 2, pointerEvents: "none" }}>
        <RainWindowOverlay durationInFrames={meta.durationInFrames} />
      </div>

      <AbsoluteFill
        style={{
          transform: `translate3d(${cam.panX}px,${cam.panY}px,0) scale(${cam.scale})`,
          transformOrigin: "center center",
          zIndex: 5,
        }}
      >
        {/* Beat 1 — Turing statue */}
        <CollagePiece
          id={10}
          src="img_turing_statue.jpg"
          top={130}
          left={120}
          width={840}
          height={620}
          rotation={-1}
          dropFrame={B1}
          hasPin={false}
          tapeColor="rgba(240,220,170,0.72)"
          zIndex={10}
        />

        {/* Candlelight warm overlay */}
        <div style={{
          position: "absolute",
          top: 130, left: 120, width: 840, height: 620,
          background: "radial-gradient(ellipse at 30% 70%, rgba(255,160,30,1) 0%, transparent 60%)",
          opacity: candleAlpha,
          borderRadius: 2,
          zIndex: 11,
          pointerEvents: "none",
        }} />

        {/* Beat 2 — Date badge */}
        <div style={{
          position: "absolute",
          top: 820,
          left: "50%",
          transform: `translateX(-50%) scale(${dateScale})`,
          transformOrigin: "center top",
          opacity: dateOpacity,
          background: "rgba(8,6,8,0.90)",
          border: "3px solid rgba(200,180,140,0.6)",
          borderRadius: 10,
          padding: "16px 36px",
          textAlign: "center",
          zIndex: 15,
        }}>
          <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 32, color: "#C8B89A", letterSpacing: "0.1em" }}>
            7 JUNE 1954
          </div>
          <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 22, color: "#888", letterSpacing: "0.08em", marginTop: 4 }}>
            WILMSLOW, CHESHIRE
          </div>
        </div>

        {/* Beat 3 — IN MEMORIAM plaque */}
        <div style={{
          position: "absolute",
          top: 1020,
          left: "50%",
          transform: `translateX(-50%) scale(${plaqueScale}) rotate(-2deg)`,
          transformOrigin: "center center",
          opacity: plaqueOpacity,
          border: "4px solid #888",
          borderRadius: 6,
          padding: "14px 32px",
          background: "rgba(14,12,14,0.92)",
          fontFamily: "'Special Elite', monospace",
          fontSize: 36,
          color: "#BBBBBB",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
          zIndex: 20,
        }}>
          IN MEMORIAM
        </div>
      </AbsoluteFill>

      {/* Fade to black from B4 */}
      <SceneTransition type="fade-black" durationInFrames={meta.durationInFrames} />

      <HormoziSubtitle words={TURING_WORDS.s6} top={1395} highlightColor="#FFDE59" />
    </AbsoluteFill>
  );
};

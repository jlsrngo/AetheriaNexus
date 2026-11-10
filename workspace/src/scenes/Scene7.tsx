/**
 * Scene 7 — THE FINAL MESSAGE
 * "Hari ini, dunia komputasi dan kecerdasan buatan berdiri..."
 *
 * Beat 1 (0–B2):   Supercomputer CollagePiece rises + ModernAiMatrixOverlay pulses
 * Beat 2 (B2–B3):  Turing portrait returns (CollagePiece from left)
 * Beat 3 (B3–B4):  ROYAL PARDON stamp slams (royal blue)
 * Beat 4 (B4–end): Final rhetorical question card fades in
 */
import React from "react";
import { AbsoluteFill, Audio, interpolate, spring, staticFile, useCurrentFrame } from "remotion";
import { ArchivalBackground } from "../components/ArchivalBackground";
import { CollagePiece } from "../components/CollagePiece";
import { HormoziSubtitle } from "../components/HormoziSubtitle";
import { ModernAiMatrixOverlay } from "../components/ModernAiMatrixOverlay";
import { SceneTransition } from "../components/SceneTransition";
import { TURING_SCENES, TURING_WORDS } from "../types";
import { cameraSnapZoom } from "../motion/collageMotion";

const B1 = 0;
const B2 = 90;   // 3.0s — Turing portrait
const B3 = 185;  // 6.2s — ROYAL PARDON stamp
const B4 = 320;  // 10.7s — final question card

export const Scene7: React.FC = () => {
  const frame = useCurrentFrame();
  const meta = TURING_SCENES.s7;
  const cam = cameraSnapZoom(frame, [B1, B2, B3, B4]);

  // AI matrix opacity ramp
  const matrixAlpha = interpolate(frame, [B1, B2], [0.3, 0.65], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // ROYAL PARDON stamp
  const pardonSpr = spring({ frame: Math.max(0, frame - B3), fps: 30, config: { damping: 8, stiffness: 240 } });
  const pardonScale = interpolate(pardonSpr, [0, 1], [3.2, 1]);
  const pardonOpacity = interpolate(pardonSpr, [0, 1], [0, 1]);

  // Final question card
  const questionSpr = spring({ frame: Math.max(0, frame - B4), fps: 30, config: { damping: 14, stiffness: 80 } });
  const questionY = interpolate(questionSpr, [0, 1], [80, 0]);
  const questionOpacity = interpolate(questionSpr, [0, 1], [0, 1]);

  return (
    <AbsoluteFill style={{ background: "#04040C", overflow: "hidden" }}>
      <Audio src={staticFile(meta.audioFile)} />
      <SceneTransition type="flash" />
      <ArchivalBackground durationInFrames={meta.durationInFrames} />

      {/* AI Matrix always at scene level */}
      <div style={{ position: "absolute", inset: 0, opacity: matrixAlpha, pointerEvents: "none", zIndex: 2 }}>
        <ModernAiMatrixOverlay />
      </div>

      <AbsoluteFill
        style={{
          transform: `translate3d(${cam.panX}px,${cam.panY}px,0) scale(${cam.scale})`,
          transformOrigin: "center center",
          zIndex: 5,
        }}
      >
        {/* Beat 1 — Supercomputer card */}
        <CollagePiece
          id={11}
          src="img_modern_supercomputer.jpg"
          top={120}
          left={80}
          width={920}
          height={520}
          rotation={1}
          dropFrame={B1}
          hasPin={false}
          tapeColor="rgba(100,140,240,0.5)"
          zIndex={10}
        />

        {/* Beat 2 — Turing portrait returns */}
        <CollagePiece
          id={12}
          src="img_alan_turing.jpg"
          top={690}
          left={80}
          width={360}
          height={420}
          rotation={-4}
          dropFrame={B2}
          hasPin={true}
          pinColor="#2244CC"
          tapeColor="rgba(240,220,170,0.72)"
          zIndex={12}
        />

        {/* Beat 2 — Timeline annotation */}
        {frame >= B2 && (
          <div style={{
            position: "absolute",
            top: 710,
            left: 470,
            width: 490,
            opacity: interpolate(frame, [B2 + 5, B2 + 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            fontFamily: "'Special Elite', monospace",
            fontSize: 24,
            color: "#C8B89A",
            lineHeight: 1.8,
            letterSpacing: "0.06em",
            zIndex: 13,
          }}>
            <div>1936 — Turing Machine paper</div>
            <div>1945 — ACE computer design</div>
            <div>1950 — Turing Test proposed</div>
            <div style={{ color: "#F5A623", fontWeight: 900 }}>2024 — AI era foundations</div>
          </div>
        )}

        {/* Beat 3 — ROYAL PARDON stamp */}
        <div style={{
          position: "absolute",
          top: 460,
          right: 80,
          transform: `scale(${pardonScale}) rotate(6deg)`,
          transformOrigin: "center center",
          opacity: pardonOpacity,
          zIndex: 25,
          border: "5px solid #2244CC",
          borderRadius: 10,
          padding: "14px 28px",
          background: "rgba(2,4,20,0.92)",
          fontFamily: "'Special Elite', monospace",
          fontSize: 30,
          color: "#6688FF",
          letterSpacing: "0.1em",
          textAlign: "center",
          whiteSpace: "nowrap",
        }}>
          ★ ROYAL PARDON ★{"\n"}
          <span style={{ fontSize: 22, color: "#8899CC" }}>QUEEN ELIZABETH II — 2013</span>
        </div>

        {/* Beat 4 — Final question card */}
        <div style={{
          position: "absolute",
          bottom: 220,
          left: 60,
          right: 60,
          transform: `translateY(${questionY}px)`,
          opacity: questionOpacity,
          background: "rgba(8,6,20,0.92)",
          border: "2px solid rgba(100,120,220,0.5)",
          borderRadius: 14,
          padding: "24px 28px",
          zIndex: 30,
        }}>
          <div style={{
            fontFamily: "'Special Elite', monospace",
            fontSize: 30,
            color: "#FFDE59",
            lineHeight: 1.5,
            letterSpacing: "0.04em",
            textAlign: "center",
          }}>
            "Berapa banyak orang jenius yang{"\n"}harus kehilangan hidupnya{"\n"}sebelum dunia belajar{"\n"}menghargai perbedaan?"
          </div>
        </div>
      </AbsoluteFill>

      <HormoziSubtitle words={TURING_WORDS.s7} top={1360} highlightColor="#FFDE59" />
    </AbsoluteFill>
  );
};

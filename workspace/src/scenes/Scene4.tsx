/**
 * Scene 4 — THE SECRET WEAPON
 * "Turing kemudian mengembangkan mesin bernama Bombe..."
 *
 * Beat 1 (0–B2):   Bombe machine CollagePiece drops centre-stage
 * Beat 2 (B2–B3):  Bletchley Park card swings in; RedThread connects; gears spin
 * Beat 3 (B3–B4):  "★ CODE BROKEN ★" stamp slams
 * Beat 4 (B4–end): BombeGearsOverlay intensifies; camera snap-zoom
 */
import React from "react";
import { AbsoluteFill, Audio, interpolate, spring, staticFile, useCurrentFrame } from "remotion";
import { ArchivalBackground } from "../components/ArchivalBackground";
import { BombeGearsOverlay } from "../components/BombeGearsOverlay";
import { CollagePiece } from "../components/CollagePiece";
import { HormoziSubtitle } from "../components/HormoziSubtitle";
import { RedThread } from "../components/RedThread";
import { SceneTransition } from "../components/SceneTransition";
import { TURING_SCENES, TURING_WORDS } from "../types";
import { cameraSnapZoom } from "../motion/collageMotion";

const B1 = 0;
const B2 = 75;   // 2.5s — Bletchley card
const B3 = 165;  // 5.5s — CODE BROKEN stamp
const B4 = 240;  // 8.0s — gears intensify

export const Scene4: React.FC = () => {
  const frame = useCurrentFrame();
  const meta = TURING_SCENES.s4;
  const cam = cameraSnapZoom(frame, [B1, B2, B3, B4]);

  // CODE BROKEN stamp
  const stampSpr = spring({ frame: Math.max(0, frame - B3), fps: 30, config: { damping: 7, stiffness: 300 } });
  const stampScale = interpolate(stampSpr, [0, 1], [3.5, 1]);
  const stampOpacity = interpolate(stampSpr, [0, 1], [0, 1]);

  // Gears opacity ramp at B4
  const gearOpacity = interpolate(frame, [B1, B4], [0.25, 0.75], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // Thread
  const threadOpacity = interpolate(frame, [B2 + 5, B2 + 30], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // Progress ticker at B4
  const ticks = Math.floor(interpolate(frame - B4, [0, meta.durationInFrames - B4], [0, 420], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  }));

  return (
    <AbsoluteFill style={{ background: "#06060A", overflow: "hidden" }}>
      <Audio src={staticFile(meta.audioFile)} />
      <SceneTransition type="flash" />
      <ArchivalBackground durationInFrames={meta.durationInFrames} />

      {/* Bombe gears always at scene level */}
      <div style={{ position: "absolute", inset: 0, opacity: gearOpacity, pointerEvents: "none", zIndex: 2 }}>
        <BombeGearsOverlay />
      </div>

      <AbsoluteFill
        style={{
          transform: `translate3d(${cam.panX}px,${cam.panY}px,0) scale(${cam.scale})`,
          transformOrigin: "center center",
          zIndex: 5,
        }}
      >
        {/* Beat 1 — Bombe machine (hero) */}
        <CollagePiece
          id={6}
          src="img_bombe.jpg"
          top={150}
          left={80}
          width={920}
          height={520}
          rotation={-1}
          dropFrame={B1}
          hasPin={true}
          pinColor="#CC2200"
          tapeColor="rgba(240,220,170,0.72)"
          zIndex={10}
        />

        {/* Beat 2 — Bletchley Park */}
        <CollagePiece
          id={7}
          src="img_bletchley.jpg"
          top={720}
          left={80}
          width={480}
          height={320}
          rotation={3}
          dropFrame={B2}
          hasPin={true}
          pinColor="#2244CC"
          stampText="BLETCHLEY PARK"
          stampFrame={B2 + 25}
          stampColor="#003080"
          zIndex={12}
        />

        {/* Red thread: bombe → bletchley */}
        <div style={{ opacity: threadOpacity, position: "absolute", inset: 0, zIndex: 14 }}>
          <RedThread x1={540} y1={670} x2={320} y2={790} startFrame={B2 + 5} sag={36} />
        </div>

        {/* Beat 3 — CODE BROKEN stamp (floating top-right) */}
        <div style={{
          position: "absolute",
          top: 300,
          right: 60,
          transform: `scale(${stampScale}) rotate(8deg)`,
          transformOrigin: "center center",
          opacity: stampOpacity,
          zIndex: 20,
          border: "5px solid #40C040",
          borderRadius: 10,
          padding: "14px 28px",
          background: "rgba(4,10,4,0.90)",
          fontFamily: "'Special Elite', monospace",
          fontSize: 36,
          color: "#40C040",
          letterSpacing: "0.1em",
          textAlign: "center",
          whiteSpace: "nowrap",
        }}>
          ★ CODE{"\n"}BROKEN ★
        </div>

        {/* Beat 4 — Progress ticker */}
        {frame >= B4 && (
          <div style={{
            position: "absolute",
            top: 740,
            right: 70,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 22,
            color: "#70FF90",
            textShadow: "0 0 10px #40FF60",
            lineHeight: 1.5,
          }}>
            <div>DECODE CYCLES: {ticks.toLocaleString()}</div>
            <div>STATUS: ██████████ 100%</div>
          </div>
        )}
      </AbsoluteFill>

      <HormoziSubtitle words={TURING_WORDS.s4} top={1390} highlightColor="#FFDE59" />
    </AbsoluteFill>
  );
};

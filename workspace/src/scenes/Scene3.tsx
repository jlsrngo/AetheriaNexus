/**
 * Scene 3 — THE INVISIBLE ENEMY
 * "Enigma bukan sekadar mesin biasa..."
 *
 * Beat 1 (0–B2):   Europe battle map rises + CipherStreamOverlay ticks
 * Beat 2 (B2–B3):  U-boat card slaps in from left; red thread from map to uboat
 * Beat 3 (B3–B4):  "⚠ UNBREAKABLE CIPHER" badge slams
 * Beat 4 (B4–end): Camera snap-zoom; cipher overlay intensifies
 */
import React from "react";
import { AbsoluteFill, Audio, interpolate, spring, staticFile, useCurrentFrame } from "remotion";
import { ArchivalBackground } from "../components/ArchivalBackground";
import { CipherStreamOverlay } from "../components/CipherStreamOverlay";
import { CollagePiece } from "../components/CollagePiece";
import { HormoziSubtitle } from "../components/HormoziSubtitle";
import { RedThread } from "../components/RedThread";
import { SceneTransition } from "../components/SceneTransition";
import { TURING_SCENES, TURING_WORDS } from "../types";
import { cameraSnapZoom } from "../motion/collageMotion";

const B1 = 0;
const B2 = 65;   // 2.2s — U-boat card
const B3 = 145;  // 4.8s — badge slam
const B4 = 230;  // 7.7s — camera push

export const Scene3: React.FC = () => {
  const frame = useCurrentFrame();
  const meta = TURING_SCENES.s3;
  const cam = cameraSnapZoom(frame, [B1, B2, B3, B4]);

  // Badge entrance
  const badgeSpr = spring({ frame: Math.max(0, frame - B3), fps: 30, config: { damping: 8, stiffness: 220 } });
  const badgeScale = interpolate(badgeSpr, [0, 1], [3.8, 1]);
  const badgeOpacity = interpolate(badgeSpr, [0, 1], [0, 1]);

  // Cipher overlay intensifies at B4
  const cipherAlpha = interpolate(frame, [B1, B4], [0.18, 0.55], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // Morse ticker at B4
  const morseOpacity = interpolate(frame, [B4, B4 + 20], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const MORSE = "... . -.-. .-. . - / . -. .. --. -- .-  / -. .- --.. .. ";
  const morseChars = Math.floor(interpolate(frame - B4, [0, 60], [0, MORSE.length], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  }));

  // Thread opacity
  const threadOpacity = interpolate(frame, [B2 + 5, B2 + 30], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: "#080808", overflow: "hidden" }}>
      <Audio src={staticFile(meta.audioFile)} />
      <SceneTransition type="flash" />
      <ArchivalBackground durationInFrames={meta.durationInFrames} />

      {/* CipherStream always rendered at scene level (not under cam) */}
      <div style={{ position: "absolute", inset: 0, opacity: cipherAlpha, pointerEvents: "none", zIndex: 2 }}>
        <CipherStreamOverlay />
      </div>

      <AbsoluteFill
        style={{
          transform: `translate3d(${cam.panX}px,${cam.panY}px,0) scale(${cam.scale})`,
          transformOrigin: "center center",
          zIndex: 5,
        }}
      >
        {/* Beat 1 — Europe battle map */}
        <CollagePiece
          id={4}
          src="img_europe_battle_map.jpg"
          top={120}
          left={60}
          width={960}
          height={520}
          rotation={1}
          dropFrame={B1}
          hasPin={false}
          tapeColor="rgba(240,220,170,0.7)"
          zIndex={10}
        />

        {/* Beat 2 — U-boat card */}
        <CollagePiece
          id={5}
          src="img_uboat.jpg"
          top={690}
          left={80}
          width={480}
          height={320}
          rotation={-4}
          dropFrame={B2}
          hasPin={true}
          pinColor="#CC2200"
          stampText="U-BOOT KRIEGSMARINE"
          stampFrame={B2 + 25}
          stampColor="#8B0000"
          zIndex={12}
        />

        {/* Red thread: map → uboat */}
        <div style={{ opacity: threadOpacity, position: "absolute", inset: 0, zIndex: 13 }}>
          <RedThread x1={540} y1={640} x2={320} y2={760} startFrame={B2 + 5} sag={34} />
        </div>

        {/* Beat 3 — UNBREAKABLE CIPHER badge */}
        <div style={{
          position: "absolute",
          top: 680,
          left: 580,
          transform: `scale(${badgeScale}) rotate(-6deg)`,
          transformOrigin: "center center",
          opacity: badgeOpacity,
          zIndex: 20,
          border: "5px solid #E8C040",
          borderRadius: 10,
          padding: "12px 24px",
          background: "rgba(10,8,4,0.88)",
          fontFamily: "'Special Elite', monospace",
          fontSize: 30,
          color: "#E8C040",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
          textAlign: "center",
        }}>
          ⚠ UNBREAKABLE{"\n"}CIPHER
        </div>

        {/* Beat 4 — Morse ticker */}
        <div style={{
          position: "absolute",
          bottom: 220,
          left: 60,
          right: 60,
          opacity: morseOpacity,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 22,
          color: "#70FF90",
          letterSpacing: "0.18em",
          textShadow: "0 0 10px #40FF60",
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}>
          {MORSE.slice(0, morseChars)}
          <span style={{ opacity: (Math.floor(frame / 8) % 2) === 0 ? 1 : 0 }}>_</span>
        </div>
      </AbsoluteFill>

      <HormoziSubtitle words={TURING_WORDS.s3} top={1385} highlightColor="#FFDE59" />
    </AbsoluteFill>
  );
};

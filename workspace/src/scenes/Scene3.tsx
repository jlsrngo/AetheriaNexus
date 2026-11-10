/**
 * Scene 3 — THE INVISIBLE ENEMY  (437 frames · 14.575s)
 * "Enigma bukan sekadar mesin biasa..."
 *
 * /mg-cutout-collage beats:
 *  B1 (0):   Europe battle map CollagePiece rises. CipherStream ticks dark green.
 *  B2 (65):  U-boat card SLAPS in from left. RedThread map → uboat. "U-BOOT" label.
 *  B3 (150): Enigma machine card drops with stamp "⚠ UNBREAKABLE CIPHER".
 *  B4 (240): Cipher overlay intensifies. Morse ticker strip. Camera push.
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
import { CipherStreamOverlay } from "../components/CipherStreamOverlay";
import { CollagePiece } from "../components/CollagePiece";
import { HormoziSubtitle } from "../components/HormoziSubtitle";
import { RedThread } from "../components/RedThread";
import { SceneTransition } from "../components/SceneTransition";
import { TURING_SCENES, TURING_WORDS } from "../types";
import { cameraSnapZoom } from "../motion/collageMotion";

const B1 = 0;
const B2 = 65;
const B3 = 150;
const B4 = 240;

const MORSE = "... . -.-. .-. . - / . -. .. --. -- .";

export const Scene3: React.FC = () => {
  const frame = useCurrentFrame();
  const meta = TURING_SCENES.s3;
  const cam = cameraSnapZoom(frame, [B1, B2, B3, B4]);

  // Badge entrance at B3
  const badgeSpr = spring({
    frame: Math.max(0, frame - B3), fps: 30,
    config: { damping: 8, stiffness: 220 },
  });
  const badgeScale = interpolate(badgeSpr, [0, 1], [3.8, 1]);
  const badgeOpacity = interpolate(badgeSpr, [0, 1], [0, 1]);

  // Cipher overlay intensifies
  const cipherAlpha = interpolate(frame, [B1, B4], [0.18, 0.55], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // Morse ticker at B4
  const morseOpacity = interpolate(frame, [B4, B4 + 20], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const morseX = interpolate(frame, [B4, B4 + 160], [0, -1600], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // Thread opacity
  const threadOpacity = interpolate(frame, [B2 + 8, B2 + 30], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  const flashOpacity = interpolate(
    frame,
    [meta.durationInFrames - 6, meta.durationInFrames - 1],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        background: "#0E1A12",
        overflow: "hidden",
        transform: `scale(${cam.scale}) translate(${cam.panX}px, ${cam.panY}px)`,
      }}
    >
      <Audio src={staticFile(meta.audioFile)} />

      <ArchivalBackground variant="dark" />

      {/* Cipher stream overlay */}
      <CipherStreamOverlay opacity={cipherAlpha} color="#2D6A3F" />

      {/* B1: Europe battle map */}
      <CollagePiece
        id={301}
        src={staticFile("img_europe_battle_map.jpg")}
        top={200}
        left={60}
        width={960}
        height={680}
        rotation={-1.0}
        dropFrame={B1 + 12}
        hasPin
        pinColor="#D94030"
        zIndex={12}
      />

      {/* B2: U-boat card from left */}
      <CollagePiece
        id={302}
        src={staticFile("img_uboat.jpg")}
        top={780}
        left={40}
        width={520}
        height={340}
        rotation={2.5}
        dropFrame={B2}
        hasPin
        pinColor="#FFDE59"
        tapeColor="#D94030"
        zIndex={14}
      />

      {/* B2: U-BOOT label */}
      <div
        style={{
          position: "absolute",
          top: 1130,
          left: 50,
          opacity: threadOpacity,
          transform: "rotate(-2deg)",
          zIndex: 16,
        }}
      >
        <div
          style={{
            background: "#D94030",
            color: "#F4EFE4",
            fontFamily: "Impact, sans-serif",
            fontSize: 38,
            fontWeight: 900,
            padding: "6px 20px",
            letterSpacing: "0.1em",
          }}
        >
          ⚡ U-BOOT KRIEGSMARINE
        </div>
      </div>

      {/* B2: RedThread connecting map → uboat */}
      <div style={{ position: "absolute", inset: 0, zIndex: 11, opacity: threadOpacity }}>
        <RedThread x1={540} y1={880} x2={280} y2={960} color="#D94030" />
      </div>

      {/* B3: Enigma machine card */}
      <CollagePiece
        id={303}
        src={staticFile("img_enigma.jpg")}
        top={680}
        left={520}
        width={480}
        height={360}
        rotation={-3.0}
        dropFrame={B3}
        hasPin
        pinColor="#2B4A8F"
        stampText="⚠ UNBREAKABLE"
        stampFrame={B3 + 15}
        stampColor="#FFDE59"
        zIndex={16}
      />

      {/* B3: Badge */}
      <div
        style={{
          position: "absolute",
          top: 388,
          left: 110,
          transform: `scale(${badgeScale}) rotate(4deg)`,
          opacity: badgeOpacity,
          border: "4px solid #FFDE59",
          padding: "10px 22px",
          background: "rgba(0,0,0,0.75)",
          zIndex: 22,
        }}
      >
        <span
          style={{
            fontFamily: "Impact, sans-serif",
            fontSize: 44,
            color: "#FFDE59",
            fontWeight: 900,
            letterSpacing: "0.06em",
          }}
        >
          ⚠ CIPHER UNBREAKABLE
        </span>
      </div>

      {/* B4: Morse ticker */}
      <div
        style={{
          position: "absolute",
          bottom: 320,
          left: 0,
          right: 0,
          height: 44,
          background: "rgba(0,0,0,0.85)",
          overflow: "hidden",
          opacity: morseOpacity,
          zIndex: 24,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: morseX,
            top: 0,
            height: 44,
            display: "flex",
            alignItems: "center",
            whiteSpace: "nowrap",
          }}
        >
          <span
            style={{
              fontFamily: "'Courier New', monospace",
              fontSize: 24,
              color: "#4CAF50",
              letterSpacing: "0.22em",
              padding: "0 1600px 0 20px",
            }}
          >
            {MORSE} — {MORSE} — {MORSE}
          </span>
        </div>
      </div>

      <HormoziSubtitle
        words={TURING_WORDS["s3"]}
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

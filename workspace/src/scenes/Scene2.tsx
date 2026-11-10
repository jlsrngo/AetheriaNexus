/**
 * Scene 2 — WHO IS HE?  (444 frames · 14.795s)
 * "Namanya Alan Turing. Seorang matematikawan Inggris..."
 *
 * /mg-cutout-collage beats:
 *  B1 (0):    Alan Turing portrait CollagePiece SLAPS top-centre. Cork pin. Scissor rim.
 *  B2 (70):   Bletchley Park card swings in from right. RedThread connects. Date annotation.
 *  B3 (160):  DECLASSIFIED stamp slams (constructivist green-on-black). Classification bar sweeps.
 *  B4 (260):  Camera snap-zoom. Subtitle active throughout.
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
import { RedThread } from "../components/RedThread";
import { SceneTransition } from "../components/SceneTransition";
import { TURING_SCENES, TURING_WORDS } from "../types";
import { cameraSnapZoom } from "../motion/collageMotion";

const B1 = 0;
const B2 = 70;
const B3 = 160;
const B4 = 260;

export const Scene2: React.FC = () => {
  const frame = useCurrentFrame();
  const meta = TURING_SCENES.s2;
  const cam = cameraSnapZoom(frame, [B1, B2, B3, B4]);

  const threadOpacity = interpolate(frame, [B2 + 5, B2 + 30], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const annotationOpacity = interpolate(frame, [B2, B2 + 25], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // Classification bar sweeps at B3
  const classBarSpr = spring({
    frame: Math.max(0, frame - B3), fps: 30,
    config: { damping: 14, stiffness: 110 },
  });
  const classBarW = interpolate(classBarSpr, [0, 1], [0, 880]);

  // DECLASSIFIED stamp
  const stampSpr = spring({
    frame: Math.max(0, frame - (B3 + 10)), fps: 30,
    config: { damping: 8, stiffness: 240 },
  });
  const stampScale = interpolate(stampSpr, [0, 1], [4.0, 1]);
  const stampOpacity = interpolate(stampSpr, [0, 1], [0, 1]);

  // Cut flash on exit
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
      <Audio src={staticFile(meta.audioFile)} />

      <ArchivalBackground variant="newsprint" />

      {/* B1: Portrait */}
      <CollagePiece
        id={201}
        src={staticFile("img_alan_turing.jpg")}
        top={180}
        left={160}
        width={760}
        height={680}
        rotation={1.2}
        dropFrame={B1 + 8}
        hasPin
        pinColor="#2B4A8F"
        zIndex={12}
      />

      {/* B2: Bletchley Park card */}
      <CollagePiece
        id={202}
        src={staticFile("img_bletchley.jpg")}
        top={780}
        left={80}
        width={580}
        height={360}
        rotation={-2.5}
        dropFrame={B2}
        hasPin
        pinColor="#FFDE59"
        tapeColor="#FFDE59"
        zIndex={14}
      />

      {/* B2: Annotation — birth date card */}
      <div
        style={{
          position: "absolute",
          top: 870,
          left: 680,
          opacity: annotationOpacity,
          transform: `rotate(3deg)`,
          zIndex: 16,
        }}
      >
        <div
          style={{
            background: "#F4EFE4",
            border: "2px solid #1A1A1A",
            padding: "10px 18px",
            fontFamily: "'Courier New', monospace",
            fontSize: 26,
            fontWeight: 700,
            color: "#1A1A1A",
            lineHeight: 1.5,
          }}
        >
          LAHIR: 23 JUN 1912<br />
          <span style={{ color: "#D94030" }}>LONDON, ENGLAND</span>
        </div>
      </div>

      {/* B2: Red thread connecting portrait → Bletchley */}
      <div style={{ position: "absolute", inset: 0, zIndex: 11, opacity: threadOpacity }}>
        <RedThread x1={540} y1={860} x2={370} y2={880} color="#D94030" />
      </div>

      {/* B3: Classification bar */}
      <div
        style={{
          position: "absolute",
          top: 148,
          left: 80,
          width: classBarW,
          height: 36,
          background: "#1A1A1A",
          zIndex: 20,
          display: "flex",
          alignItems: "center",
          paddingLeft: 12,
          overflow: "hidden",
        }}
      >
        <span
          style={{
            fontFamily: "'Courier New', monospace",
            fontSize: 18,
            fontWeight: 700,
            color: "#4CAF50",
            letterSpacing: "0.14em",
            whiteSpace: "nowrap",
          }}
        >
          ✦ GOVERNMENT COMMUNICATIONS HQ — CASE FILE #AT-1912 ✦
        </span>
      </div>

      {/* B3: DECLASSIFIED stamp */}
      <div
        style={{
          position: "absolute",
          top: 420,
          left: 480,
          transform: `scale(${stampScale}) rotate(−12deg)`,
          opacity: stampOpacity,
          zIndex: 25,
          border: "5px solid #4CAF50",
          padding: "8px 18px",
          color: "#4CAF50",
          fontFamily: "Impact, sans-serif",
          fontSize: 52,
          fontWeight: 900,
          letterSpacing: "0.06em",
          pointerEvents: "none",
        }}
      >
        DECLASSIFIED
      </div>

      <HormoziSubtitle
        words={TURING_WORDS["s2"]}
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

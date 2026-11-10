/**
 * Scene 6 — THE DEATH  (283 frames · 9.435s)
 * "Pada 7 Juni 1954, Alan Turing meninggal dunia di usia 41 tahun..."
 *
 * /mg-cutout-collage beats:
 *  B1 (0):   Black ground. Turing portrait dims slowly in. Date typography slams.
 *  B2 (40):  Official death notice card SLAPS in — white scissor rim, cork pin.
 *  B3 (100): "7 JUNI 1954" bold red stencil. Black redaction bar. Torn tape.
 *  B4 (170): Fade progressively darker. Candle / apple silhouette. Exit to darkness.
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
const B2 = 40;
const B3 = 100;
const B4 = 170;

export const Scene6: React.FC = () => {
  const frame = useCurrentFrame();
  const meta = TURING_SCENES.s6;
  const cam = cameraSnapZoom(frame, [B1, B2, B3, B4]);

  // B1: Portrait dims in slowly
  const portraitOpacity = interpolate(frame, [B1, B1 + 50], [0, 0.72], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // B2: Death notice card
  const noticeSpr = spring({
    frame: Math.max(0, frame - B2), fps: 30,
    config: { damping: 11, stiffness: 180 },
  });
  const noticeScale = interpolate(noticeSpr, [0, 1], [2.8, 1]);
  const noticeOpacity = interpolate(noticeSpr, [0, 1], [0, 1]);

  // B3: Date stencil punch
  const dateSpr = spring({
    frame: Math.max(0, frame - B3), fps: 30,
    config: { damping: 8, stiffness: 240 },
  });
  const dateScale = interpolate(dateSpr, [0, 1], [3.2, 1]);
  const dateOpacity = interpolate(dateSpr, [0, 1], [0, 1]);

  // Redaction bar sweep
  const redactSpr = spring({
    frame: Math.max(0, frame - (B3 + 5)), fps: 30,
    config: { damping: 18, stiffness: 95 },
  });
  const redactW = interpolate(redactSpr, [0, 1], [0, 920]);

  // B4: Darkness closes in
  const darknessAlpha = interpolate(frame, [B4, meta.durationInFrames - 10], [0, 0.88], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // Boil jitter on notice
  const noticeJitter = boilJitter(601, frame, 1.5, 12);

  // Candle flicker (B4+)
  const candleFlicker = boilJitter(602, frame, 1.0, 6);
  const candleOpacity = interpolate(frame, [B4, B4 + 20], [0, 0.9], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // Final fade-to-black
  const finalBlack = interpolate(
    frame,
    [meta.durationInFrames - 15, meta.durationInFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        background: "#080808",
        overflow: "hidden",
        transform: `scale(${cam.scale}) translate(${cam.panX}px, ${cam.panY}px)`,
      }}
    >
      <Audio src={staticFile(meta.audioFile)} />

      <ArchivalBackground variant="dark" />

      {/* B1: Dimmed Turing portrait */}
      <AbsoluteFill
        style={{
          opacity: portraitOpacity,
          filter: "grayscale(100%) brightness(0.4)",
          zIndex: 10,
        }}
      >
        <CollagePiece
          id={601}
          src={staticFile("img_alan_turing.jpg")}
          top={160}
          left={100}
          width={880}
          height={760}
          rotation={0.5}
          dropFrame={0}
          hasPin={false}
          zIndex={10}
        />
      </AbsoluteFill>

      {/* B2: Death notice card */}
      <div
        style={{
          position: "absolute",
          top: 820,
          left: 100,
          transform: `scale(${noticeScale}) rotate(-1.5deg) translate(${noticeJitter.x}px, ${noticeJitter.y}px)`,
          opacity: noticeOpacity,
          zIndex: 18,
          background: "#F4EFE4",
          border: "3.5px solid #1A1A1A",
          padding: "18px 24px",
          width: 580,
          boxShadow: "5px 8px 0 rgba(0,0,0,0.5)",
        }}
      >
        <div
          style={{
            fontFamily: "'Courier New', monospace",
            fontSize: 22,
            fontWeight: 700,
            color: "#1A1A1A",
            lineHeight: 1.7,
            letterSpacing: "0.04em",
          }}
        >
          CORONER'S REPORT<br />
          <span style={{ color: "#D94030" }}>ALAN MATHISON TURING</span><br />
          DATE OF DEATH: 7 JUNE 1954<br />
          AGE: 41 · CAUSE: CYANIDE
        </div>
      </div>

      {/* B3: Redaction bar */}
      <div
        style={{
          position: "absolute",
          top: 148,
          left: 80,
          width: redactW,
          height: 44,
          background: "#1A1A1A",
          zIndex: 22,
        }}
      />

      {/* B3: Date stencil */}
      <div
        style={{
          position: "absolute",
          top: 1020,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          transform: `scale(${dateScale}) rotate(0deg)`,
          opacity: dateOpacity,
          zIndex: 24,
        }}
      >
        <div
          style={{
            fontFamily: "Impact, 'Arial Black', sans-serif",
            fontSize: 90,
            fontWeight: 900,
            color: "#D94030",
            letterSpacing: "0.04em",
            textShadow: "4px 4px 0 #000",
          }}
        >
          7 JUNI 1954
        </div>
      </div>

      {/* B4: Candle flicker symbol */}
      <div
        style={{
          position: "absolute",
          top: 480,
          right: 120,
          opacity: candleOpacity,
          transform: `translate(${candleFlicker.x}px, ${candleFlicker.y}px) rotate(${candleFlicker.x * 0.5}deg)`,
          zIndex: 20,
          fontSize: 120,
          lineHeight: 1,
          filter: "drop-shadow(0 0 24px rgba(255,160,0,0.9))",
        }}
      >
        🕯️
      </div>

      {/* B4: Closing darkness */}
      <AbsoluteFill
        style={{
          background: `rgba(0,0,0,${darknessAlpha})`,
          zIndex: 40,
          pointerEvents: "none",
        }}
      />

      <HormoziSubtitle
        words={TURING_WORDS["s6"]}
        top={1430}
        highlightColor="#FFDE59"
        maxWordsPerChunk={4}
      />

      {/* Final fade-to-black */}
      <AbsoluteFill
        style={{
          background: `rgba(0,0,0,${finalBlack})`,
          zIndex: 99,
          pointerEvents: "none",
        }}
      />

      <SceneTransition frame={frame} totalFrames={meta.durationInFrames} type="fade" />
    </AbsoluteFill>
  );
};

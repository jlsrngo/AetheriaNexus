/**
 * Scene 5 — WAR WON  (582 frames · 19.395s)
 * "Tapi setelah perang, kisahnya berubah drastis..."
 *
 * /mg-cutout-collage beats:
 *  B1 (0):   Victory headline slams. Europe map CollagePiece drops.
 *  B2 (70):  Allies celebration cutout from left. "VICTORY" diagonal banner.
 *  B3 (180): Counter stat: "14 MILLION LIVES SAVED". Red underline sweep.
 *  B4 (300): Camera snap zoom. Transition to dark tone (betrayal coming next).
 *
 * Note: Scene 5 carries the full persecution narration from turing_s5.wav
 * "Tapi setelah perang... chemical castration..."
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
const B2 = 70;
const B3 = 180;
const B4 = 300;

export const Scene5: React.FC = () => {
  const frame = useCurrentFrame();
  const meta = TURING_SCENES.s5;
  const cam = cameraSnapZoom(frame, [B1, B2, B3, B4]);

  // B1: Victory title punch
  const victoryTitleSpr = spring({ frame, fps: 30, config: { damping: 9, stiffness: 190 } });
  const victoryTitleScale = interpolate(victoryTitleSpr, [0, 1], [2.8, 1]);
  const victoryTitleOpacity = interpolate(victoryTitleSpr, [0, 1], [0, 1]);

  // B2: Victory banner
  const bannerSpr = spring({
    frame: Math.max(0, frame - B2), fps: 30,
    config: { damping: 11, stiffness: 180 },
  });
  const bannerX = interpolate(bannerSpr, [0, 1], [-1200, 0]);
  const bannerOpacity = interpolate(bannerSpr, [0, 1], [0, 1]);

  // B3: Stat counter
  const statSpr = spring({
    frame: Math.max(0, frame - B3), fps: 30,
    config: { damping: 10, stiffness: 220 },
  });
  const statScale = interpolate(statSpr, [0, 1], [3.5, 1]);
  const statOpacity = interpolate(statSpr, [0, 1], [0, 1]);
  const redUnderlineW = interpolate(frame, [B3 + 20, B3 + 55], [0, 580], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // B4: Mood darkens — court trial image fades in (betrayal foreshadow)
  const darkOverlayAlpha = interpolate(frame, [B4, B4 + 60], [0, 0.65], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const courtOpacity = interpolate(frame, [B4 + 20, B4 + 60], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // Boil jitter on map
  const mapJitter = boilJitter(501, frame, 1.8, 12);

  // Cut flash on exit (dramatic fade-to-black for the betrayal transition)
  const exitBlack = interpolate(
    frame,
    [meta.durationInFrames - 15, meta.durationInFrames],
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

      {/* B1: Europe map — centrepiece */}
      <div
        style={{
          position: "absolute",
          top: 300,
          left: 60,
          transform: `translate(${mapJitter.x}px, ${mapJitter.y}px)`,
          zIndex: 12,
        }}
      >
        <CollagePiece
          id={501}
          src={staticFile("img_europe_battle_map.jpg")}
          top={0}
          left={0}
          width={960}
          height={640}
          rotation={-0.8}
          dropFrame={B1 + 12}
          hasPin
          pinColor="#2B4A8F"
          zIndex={12}
        />
      </div>

      {/* B1: Victory title */}
      <div
        style={{
          position: "absolute",
          top: 148,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          zIndex: 22,
          transform: `scale(${victoryTitleScale})`,
          opacity: victoryTitleOpacity,
        }}
      >
        <div
          style={{
            fontFamily: "Impact, 'Arial Black', sans-serif",
            fontSize: 86,
            fontWeight: 900,
            color: "#F4EFE4",
            textTransform: "uppercase",
            letterSpacing: "-1px",
            textAlign: "center",
            textShadow: "4px 4px 0 #1A1A1A",
          }}
        >
          PERANG
          <span style={{ color: "#D94030" }}> DIMENANGKAN</span>
        </div>
      </div>

      {/* B2: Diagonal "VICTORY" banner */}
      <div
        style={{
          position: "absolute",
          top: 920,
          left: bannerX,
          opacity: bannerOpacity,
          transform: "rotate(-3deg)",
          background: "#D94030",
          padding: "12px 60px",
          zIndex: 20,
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            fontFamily: "Impact, sans-serif",
            fontSize: 58,
            fontWeight: 900,
            color: "#F4EFE4",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          ✦ ALLIES VICTORY · 1945 ✦
        </span>
      </div>

      {/* B3: 14 million stat */}
      <div
        style={{
          position: "absolute",
          top: 1020,
          left: 100,
          transform: `scale(${statScale}) rotate(-1.5deg)`,
          opacity: statOpacity,
          zIndex: 24,
        }}
      >
        <div
          style={{
            fontFamily: "Impact, 'Arial Black', sans-serif",
            fontSize: 68,
            fontWeight: 900,
            color: "#FFDE59",
            textShadow: "3px 3px 0 #1A1A1A",
          }}
        >
          14 JUTA JIWA
        </div>
        <div
          style={{
            fontFamily: "'Courier New', monospace",
            fontSize: 26,
            color: "#F4EFE4",
            letterSpacing: "0.08em",
          }}
        >
          DISELAMATKAN
        </div>
        {/* Red underline */}
        <div
          style={{
            marginTop: 6,
            height: 5,
            width: redUnderlineW,
            background: "#D94030",
          }}
        />
      </div>

      {/* B4: Court trial card foreshadow */}
      <CollagePiece
        id={502}
        src={staticFile("img_court_trial_1952.jpg")}
        top={1030}
        left={500}
        width={520}
        height={380}
        rotation={3.5}
        dropFrame={B4 + 20}
        hasPin={false}
        stampText="BETRAYED"
        stampFrame={B4 + 50}
        stampColor="#D94030"
        zIndex={16}
      />
      <div style={{ position: "absolute", inset: 0, zIndex: 18, opacity: courtOpacity }}>
        <AbsoluteFill
          style={{
            background: "transparent",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* B4: Darkening overlay */}
      <AbsoluteFill
        style={{
          background: `rgba(10,8,6,${darkOverlayAlpha})`,
          zIndex: 30,
          pointerEvents: "none",
        }}
      />

      <HormoziSubtitle
        words={TURING_WORDS["s5"]}
        top={1430}
        highlightColor="#FFDE59"
        maxWordsPerChunk={4}
      />

      {/* Fade-to-black exit */}
      <AbsoluteFill
        style={{
          background: `rgba(0,0,0,${exitBlack})`,
          zIndex: 99,
          pointerEvents: "none",
        }}
      />

      <SceneTransition frame={frame} totalFrames={meta.durationInFrames} type="fade" />
    </AbsoluteFill>
  );
};

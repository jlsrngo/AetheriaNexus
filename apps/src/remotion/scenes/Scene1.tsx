/**
 * Scene1.tsx — HOOK: "1912. Otak terbesar abad ini lahir diam-diam."
 * Duration: 150 frames (5s @ 30fps)
 * Style: /mg-cutout-collage — kraft paper ground, portrait slap-in, big year stamp
 *
 * Beat layout:
 *   Beat 1 (0–18f):  Kraft paper ground fades in; "1912" stamp slams from above
 *   Beat 2 (18–60f): Turing portrait CollagePiece slaps onto page (scissor rim, cork pin)
 *   Beat 3 (60–100f): Bold red constructivist diagonal banner "OTAK TERBESAR" slides in
 *   Beat 4 (100–150f): Camera snap zoom; subtitle words complete; white flash cut-out transition
 */
import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { CollagePiece } from "../components/CollagePiece";
import { HormoziSubtitle, buildWordsFromScript } from "../components/HormoziSubtitle";
import {
  slapDrop,
  slapSquash,
  stampSlam,
  cameraSnapZoom,
  fadeIn,
  fadeOut,
  boilJitter,
  rotateIn,
} from "../motion/collageMotion";

const SCRIPT = "1912. Otak terbesar abad ini lahir diam-diam.";
const DURATION_SEC = 5.0;

export const Scene1: React.FC<{ durationInFrames?: number }> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = durationInFrames ?? 150;

  const words = buildWordsFromScript(SCRIPT, DURATION_SEC);

  // --- Beat 1: "1912" stamp ---
  const stampScale = stampSlam(frame, 4, fps);
  const stampOpacity = fadeIn(frame, 2, 6);

  // --- Beat 2: Portrait slap-in at frame 18 ---
  const portraitY = slapDrop(frame, 18, fps);
  const portraitSquash = slapSquash(frame, 18, fps);
  const portraitOpacity = fadeIn(frame, 18, 4);
  const [jx, jy] = boilJitter(frame, 1);

  // --- Beat 3: Red banner slides from left at frame 60 ---
  const bannerX = interpolate(frame, [60, 78], [-700, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const bannerOpacity = fadeIn(frame, 60, 10);

  // --- Beat 4: Camera snap zoom at frame 100 ---
  const { scale: camScale, rotate: camRotate } = cameraSnapZoom(frame, 100, fps, 1.03, 0.2);

  // --- Transition: white flash at end (frames dur-8 → dur) ---
  const flashOpacity = interpolate(frame, [dur - 10, dur - 2], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Sub-label "ALAN TURING" rotates in after portrait
  const subLabelRotate = rotateIn(frame, 30, -6, fps);
  const subLabelOpacity = fadeIn(frame, 30, 8);

  return (
    <AbsoluteFill style={{ background: "#2a1f10", overflow: "hidden" }}>
      {/* Audio voiceover */}
      <Audio src={staticFile("turing_s1.wav")} />

      {/* Camera wrapper */}
      <AbsoluteFill
        style={{
          transform: `scale(${camScale}) rotate(${camRotate}deg)`,
          transformOrigin: "center center",
        }}
      >
        {/* Background: authentic clean kraft paper texture */}
        <AbsoluteFill>
          <img
            src={staticFile("mg-styles/06-collage/assets/gen/page_kraft.jpg")}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.85,
              filter: "sepia(0.4) brightness(0.75)",
            }}
            alt=""
          />
          {/* Dark vignette */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(10,6,2,0.65) 100%)",
            }}
          />
        </AbsoluteFill>

        {/* Beat 1 — Year stamp "1912" */}
        <div
          style={{
            position: "absolute",
            top: 180,
            left: "50%",
            transform: `translateX(-50%) scale(${stampScale})`,
            opacity: stampOpacity,
            zIndex: 20,
            fontFamily: "'Impact', 'Arial Black', sans-serif",
            fontSize: 220,
            fontWeight: 900,
            color: "#C0392B",
            letterSpacing: "-8px",
            textShadow: "6px 6px 0px rgba(0,0,0,0.6)",
            WebkitTextStroke: "3px #8B1A1A",
            transformOrigin: "center center",
          }}
        >
          1912
        </div>

        {/* Beat 2 — Turing portrait CollagePiece */}
        <div
          style={{
            position: "absolute",
            top: 320,
            left: "50%",
            transform: `translateX(-50%) translateY(${portraitY + jy}px) translateX(${jx}px) scaleY(${portraitSquash}) rotate(-2deg)`,
            opacity: portraitOpacity,
            zIndex: 15,
          }}
        >
          {/* Scissor rim border */}
          <div
            style={{
              outline: "3.5px solid #F4EFE4",
              outlineOffset: "0px",
              boxShadow: "4px 8px 20px rgba(0,0,0,0.6)",
              position: "relative",
              width: 480,
              height: 540,
            }}
          >
            <img
              src={staticFile("img_alan_turing.jpg")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "top center",
                filter: "sepia(0.25) contrast(1.1)",
              }}
              alt="Alan Turing"
            />
            {/* Cork pin */}
            <div
              style={{
                position: "absolute",
                top: -10,
                left: "50%",
                transform: "translateX(-50%)",
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "radial-gradient(circle at 35% 35%, #e74c3c, #8B0000)",
                boxShadow: "0 2px 5px rgba(0,0,0,0.6)",
                zIndex: 25,
              }}
            />
          </div>

          {/* Sub-label "ALAN TURING" below portrait */}
          <div
            style={{
              marginTop: 10,
              textAlign: "center",
              fontFamily: "'Impact', 'Arial Black', sans-serif",
              fontSize: 52,
              fontWeight: 900,
              color: "#F4EFE4",
              letterSpacing: "4px",
              textTransform: "uppercase",
              textShadow: "3px 3px 0 #000",
              transform: `rotate(${subLabelRotate}deg)`,
              opacity: subLabelOpacity,
            }}
          >
            ALAN TURING
          </div>
        </div>

        {/* Beat 3 — Red constructivist diagonal banner */}
        <div
          style={{
            position: "absolute",
            top: 920,
            left: 0,
            right: 0,
            transform: `translateX(${bannerX}px) rotate(-3deg)`,
            opacity: bannerOpacity,
            zIndex: 30,
            background: "#C0392B",
            padding: "18px 60px",
            boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
          }}
        >
          <div
            style={{
              fontFamily: "'Impact', 'Arial Black', sans-serif",
              fontSize: 56,
              fontWeight: 900,
              color: "#F4EFE4",
              letterSpacing: "6px",
              textTransform: "uppercase",
              textShadow: "3px 3px 0 rgba(0,0,0,0.4)",
            }}
          >
            OTAK TERBESAR ABAD INI
          </div>
        </div>
      </AbsoluteFill>

      {/* Hormozi subtitles — above camera wrapper */}
      <HormoziSubtitle words={words} fontSize={62} bottomOffset={200} />

      {/* White flash transition at end */}
      {frame > dur - 12 && (
        <AbsoluteFill
          style={{
            background: "#F4EFE4",
            opacity: flashOpacity,
            zIndex: 999,
          }}
        />
      )}
    </AbsoluteFill>
  );
};

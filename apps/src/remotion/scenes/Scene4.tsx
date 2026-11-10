/**
 * Scene4.tsx — VICTORY: "14 juta nyawa terselamatkan. Namanya dirahasiakan 50 tahun."
 * Duration: 195 frames (6.5s @ 30fps)
 * Style: /mg-cutout-collage
 *
 * Beat layout:
 *   Beat 1 (0–18f):  Europe battle map slaps onto page
 *   Beat 2 (18–70f): "14 JUTA NYAWA" giant red counter stamp slams in
 *   Beat 3 (70–120f): OBE medal photo drops with scissor rim + "TOP SECRET" stamp
 *   Beat 4 (120–195f): Camera push + "50 TAHUN" redaction bar slides + flash
 */
import React from "react";
import {
  AbsoluteFill,
  Audio,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { HormoziSubtitle, buildWordsFromScript } from "../components/HormoziSubtitle";
import {
  slapDrop,
  slapSquash,
  slapShadowBlur,
  stampSlam,
  cameraSnapZoom,
  fadeIn,
  boilJitter,
} from "../motion/collageMotion";

const SCRIPT = "14 juta nyawa terselamatkan. Namanya dirahasiakan 50 tahun.";
const DURATION_SEC = 6.5;

export const Scene4: React.FC<{ durationInFrames?: number }> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = durationInFrames ?? 195;

  const words = buildWordsFromScript(SCRIPT, DURATION_SEC);

  // Beat 1 — Map
  const mapY = slapDrop(frame, 5, fps);
  const mapSquash = slapSquash(frame, 5, fps);
  const mapShadow = slapShadowBlur(frame, 5, fps);
  const mapOpacity = fadeIn(frame, 5, 5);
  const [mx, my] = boilJitter(frame, 6);

  // Beat 2 — "14 JUTA NYAWA" counter stamp
  const counterScale = stampSlam(frame, 22, fps);
  const counterOpacity = fadeIn(frame, 20, 5);

  // Beat 3 — OBE medal
  const obeY = slapDrop(frame, 72, fps);
  const obeSquash = slapSquash(frame, 72, fps);
  const obeShadow = slapShadowBlur(frame, 72, fps);
  const obeOpacity = fadeIn(frame, 72, 5);
  const [ox, oy] = boilJitter(frame, 7);

  // "TOP SECRET" stamp
  const tsScale = stampSlam(frame, 90, fps);
  const tsOpacity = fadeIn(frame, 88, 4);

  // Beat 4 — Black redaction bar "50 TAHUN"
  const redactX = interpolate(frame, [122, 142], [-700, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const redactOpacity = fadeIn(frame, 122, 10);

  const { scale: camScale, rotate: camRotate } = cameraSnapZoom(frame, 120, fps, 1.04, 0.1);

  const flashOpacity = interpolate(frame, [dur - 10, dur - 2], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: "#0e0e0e", overflow: "hidden" }}>
      <Audio src={staticFile("turing_s4.wav")} />

      <AbsoluteFill
        style={{
          transform: `scale(${camScale}) rotate(${camRotate}deg)`,
          transformOrigin: "center center",
        }}
      >
        {/* BG */}
        <AbsoluteFill>
          <div
            style={{
              width: "100%",
              height: "100%",
              background:
                "radial-gradient(ellipse at 50% 30%, #1a1008 0%, #0e0e0e 60%, #050505 100%)",
            }}
          />
        </AbsoluteFill>

        {/* Beat 1 — Europe battle map */}
        <div
          style={{
            position: "absolute",
            top: 100,
            left: "50%",
            transform: `translateX(calc(-50% + ${mx}px)) translateY(${mapY + my}px) scaleY(${mapSquash}) rotate(-1.5deg)`,
            opacity: mapOpacity,
            zIndex: 10,
          }}
        >
          <div
            style={{
              outline: "3.5px solid #F4EFE4",
              boxShadow: `4px ${mapShadow * 0.3}px ${mapShadow}px rgba(0,0,0,0.65)`,
              width: 520,
              height: 380,
              overflow: "hidden",
            }}
          >
            <img
              src={staticFile("img_europe_battle_map.jpg")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "sepia(0.5) contrast(1.1) brightness(0.75)",
              }}
              alt="Europe battle map"
            />
          </div>
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
            }}
          />
        </div>

        {/* Beat 2 — "14 JUTA NYAWA" counter */}
        <div
          style={{
            position: "absolute",
            top: 530,
            left: "50%",
            transform: `translateX(-50%) scale(${counterScale})`,
            opacity: counterOpacity,
            zIndex: 25,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: "'Impact', 'Arial Black', sans-serif",
              fontSize: 130,
              fontWeight: 900,
              color: "#C0392B",
              letterSpacing: "-4px",
              lineHeight: 0.9,
              textShadow: "6px 6px 0 rgba(0,0,0,0.7)",
              WebkitTextStroke: "2px #8B1A1A",
            }}
          >
            14 JUTA
          </div>
          <div
            style={{
              fontFamily: "'Impact', 'Arial Black', sans-serif",
              fontSize: 56,
              fontWeight: 900,
              color: "#F4EFE4",
              letterSpacing: "10px",
              textTransform: "uppercase",
              textShadow: "3px 3px 0 rgba(0,0,0,0.6)",
            }}
          >
            NYAWA TERSELAMATKAN
          </div>
        </div>

        {/* Beat 3 — OBE medal */}
        <div
          style={{
            position: "absolute",
            top: 820,
            right: 80,
            transform: `translateX(${ox}px) translateY(${obeY + oy}px) scaleY(${obeSquash}) rotate(5deg)`,
            opacity: obeOpacity,
            zIndex: 15,
          }}
        >
          <div
            style={{
              outline: "3.5px solid #F4EFE4",
              boxShadow: `4px ${obeShadow * 0.3}px ${obeShadow}px rgba(0,0,0,0.6)`,
              width: 280,
              height: 320,
              overflow: "hidden",
            }}
          >
            <img
              src={staticFile("img_turing_obe.jpg")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "sepia(0.4) contrast(1.1)",
              }}
              alt="Turing OBE"
            />
          </div>
          <div
            style={{
              position: "absolute",
              top: -10,
              left: "50%",
              transform: "translateX(-50%)",
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: "radial-gradient(circle at 35% 35%, #f1c40f, #8B6400)",
              boxShadow: "0 2px 4px rgba(0,0,0,0.5)",
            }}
          />
        </div>

        {/* "TOP SECRET" red stamp on OBE */}
        <div
          style={{
            position: "absolute",
            top: 870,
            left: 70,
            transform: `scale(${tsScale}) rotate(-15deg)`,
            opacity: tsOpacity,
            zIndex: 30,
            border: "5px solid #C0392B",
            padding: "8px 20px",
          }}
        >
          <div
            style={{
              fontFamily: "'Impact', 'Arial Black', sans-serif",
              fontSize: 68,
              fontWeight: 900,
              color: "#C0392B",
              letterSpacing: "4px",
              opacity: 0.85,
            }}
          >
            TOP SECRET
          </div>
        </div>

        {/* Beat 4 — Black redaction bar */}
        <div
          style={{
            position: "absolute",
            top: 1200,
            left: 0,
            transform: `translateX(${redactX}px)`,
            opacity: redactOpacity,
            zIndex: 35,
            width: "100%",
            background: "#000",
            padding: "16px 50px",
          }}
        >
          <div
            style={{
              fontFamily: "'Courier New', monospace",
              fontSize: 42,
              fontWeight: 900,
              color: "#F4EFE4",
              letterSpacing: "8px",
              textTransform: "uppercase",
            }}
          >
            ████████████ — 50 TAHUN █████████
          </div>
        </div>
      </AbsoluteFill>

      <HormoziSubtitle words={words} fontSize={58} bottomOffset={175} />

      {frame > dur - 12 && (
        <AbsoluteFill
          style={{ background: "#F4EFE4", opacity: flashOpacity, zIndex: 999 }}
        />
      )}
    </AbsoluteFill>
  );
};

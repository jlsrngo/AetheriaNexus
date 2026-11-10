/**
 * Scene3.tsx — BOMBE: "Bombe bekerja. Jerman tak sadar perang sudah tamat."
 * Duration: 180 frames (6s @ 30fps)
 * Style: /mg-cutout-collage
 *
 * Beat layout:
 *   Beat 1 (0–20f):  Bletchley Park building photo slaps onto kraft ground
 *   Beat 2 (20–70f): Bombe machine photograph CollagePiece drops center
 *   Beat 3 (70–110f): Spinning drum SVG decorative element + "DECODED" stamp
 *   Beat 4 (110–180f): Camera snap + subtitle completes + flash
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

const SCRIPT = "Bombe bekerja. Jerman tak sadar — perang sudah tamat.";
const DURATION_SEC = 6.0;

export const Scene3: React.FC<{ durationInFrames?: number }> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = durationInFrames ?? 180;

  const words = buildWordsFromScript(SCRIPT, DURATION_SEC);

  // Beat 1 — Bletchley slap in
  const bpY = slapDrop(frame, 5, fps);
  const bpSquash = slapSquash(frame, 5, fps);
  const bpShadow = slapShadowBlur(frame, 5, fps);
  const bpOpacity = fadeIn(frame, 5, 5);
  const [bpjx, bpjy] = boilJitter(frame, 4);

  // Beat 2 — Bombe machine
  const bombeY = slapDrop(frame, 22, fps);
  const bombeSquash = slapSquash(frame, 22, fps);
  const bombeShadow = slapShadowBlur(frame, 22, fps);
  const bombeOpacity = fadeIn(frame, 22, 5);
  const [bjx, bjy] = boilJitter(frame, 5);

  // Beat 3 — Spinning drum decorative circles
  const drumRotation = interpolate(frame, [70, 180], [0, 720], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // "DECODED" stamp
  const decodedScale = stampSlam(frame, 75, fps);
  const decodedOpacity = fadeIn(frame, 73, 4);

  // Red thread line from Bletchley → Bombe
  const threadWidth = interpolate(frame, [60, 90], [0, 320], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Beat 4 — camera snap
  const { scale: camScale, rotate: camRotate } = cameraSnapZoom(frame, 110, fps, 1.03, -0.2);

  const flashOpacity = interpolate(frame, [dur - 10, dur - 2], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: "#1e2a1e", overflow: "hidden" }}>
      <Audio src={staticFile("turing_s3.wav")} />

      <AbsoluteFill
        style={{
          transform: `scale(${camScale}) rotate(${camRotate}deg)`,
          transformOrigin: "center center",
        }}
      >
        {/* BG: dark forest-green wartime paper */}
        <AbsoluteFill>
          <div
            style={{
              width: "100%",
              height: "100%",
              background:
                "radial-gradient(ellipse at 50% 30%, #2d4a2d 0%, #1e2a1e 55%, #0e160e 100%)",
            }}
          />
        </AbsoluteFill>

        {/* Beat 1 — Bletchley Park building */}
        <div
          style={{
            position: "absolute",
            top: 140,
            left: "50%",
            transform: `translateX(calc(-50% + ${bpjx}px)) translateY(${bpY + bpjy}px) scaleY(${bpSquash}) rotate(-2.5deg)`,
            opacity: bpOpacity,
            zIndex: 10,
          }}
        >
          <div
            style={{
              outline: "3.5px solid #F4EFE4",
              boxShadow: `4px ${bpShadow * 0.3}px ${bpShadow}px rgba(0,0,0,0.6)`,
              width: 500,
              height: 300,
              overflow: "hidden",
            }}
          >
            <img
              src={staticFile("img_bletchley.jpg")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "sepia(0.4) contrast(1.1) brightness(0.8)",
              }}
              alt="Bletchley Park"
            />
          </div>
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
              background: "radial-gradient(circle at 35% 35%, #2ecc71, #1a7a40)",
              boxShadow: "0 2px 5px rgba(0,0,0,0.6)",
            }}
          />
          <div
            style={{
              textAlign: "center",
              marginTop: 8,
              fontFamily: "'Courier New', monospace",
              fontSize: 24,
              color: "#A8C8A8",
              letterSpacing: "3px",
            }}
          >
            BLETCHLEY PARK, 1942
          </div>
        </div>

        {/* Red thread connecting pieces */}
        <div
          style={{
            position: "absolute",
            top: 530,
            left: "50%",
            transform: "translateX(-50%)",
            width: threadWidth,
            height: 3,
            background: "#C0392B",
            zIndex: 8,
            transformOrigin: "left center",
          }}
        />

        {/* Beat 2 — Bombe machine */}
        <div
          style={{
            position: "absolute",
            top: 490,
            left: "50%",
            transform: `translateX(calc(-50% + ${bjx}px)) translateY(${bombeY + bjy}px) scaleY(${bombeSquash}) rotate(2deg)`,
            opacity: bombeOpacity,
            zIndex: 15,
          }}
        >
          <div
            style={{
              outline: "3.5px solid #F4EFE4",
              boxShadow: `4px ${bombeShadow * 0.3}px ${bombeShadow}px rgba(0,0,0,0.6)`,
              width: 460,
              height: 400,
              overflow: "hidden",
            }}
          >
            <img
              src={staticFile("img_bombe.jpg")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "sepia(0.3) contrast(1.15) brightness(0.85)",
              }}
              alt="Bombe machine"
            />
          </div>
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
              background: "radial-gradient(circle at 35% 35%, #f39c12, #8B6400)",
              boxShadow: "0 2px 5px rgba(0,0,0,0.6)",
            }}
          />
        </div>

        {/* Beat 3 — Spinning Bombe drum decorative element */}
        {frame >= 70 && (
          <div
            style={{
              position: "absolute",
              top: 960,
              left: 60,
              width: 90,
              height: 90,
              transform: `rotate(${drumRotation}deg)`,
              zIndex: 20,
              opacity: fadeIn(frame, 70, 8),
            }}
          >
            <svg viewBox="0 0 90 90" width="90" height="90">
              {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => (
                <line
                  key={angle}
                  x1="45"
                  y1="45"
                  x2={45 + 38 * Math.cos((angle * Math.PI) / 180)}
                  y2={45 + 38 * Math.sin((angle * Math.PI) / 180)}
                  stroke="#F4EFE4"
                  strokeWidth="2"
                  opacity="0.6"
                />
              ))}
              <circle cx="45" cy="45" r="38" fill="none" stroke="#F4EFE4" strokeWidth="3" />
              <circle cx="45" cy="45" r="6" fill="#C0392B" />
            </svg>
          </div>
        )}

        {/* Beat 3 — "DECODED" green stamp */}
        <div
          style={{
            position: "absolute",
            top: 950,
            right: 60,
            transform: `scale(${decodedScale}) rotate(12deg)`,
            opacity: decodedOpacity,
            zIndex: 25,
            border: "5px solid #27AE60",
            padding: "8px 24px",
          }}
        >
          <div
            style={{
              fontFamily: "'Impact', 'Arial Black', sans-serif",
              fontSize: 72,
              fontWeight: 900,
              color: "#27AE60",
              letterSpacing: "6px",
              opacity: 0.9,
            }}
          >
            DECODED
          </div>
        </div>
      </AbsoluteFill>

      <HormoziSubtitle words={words} fontSize={60} bottomOffset={180} />

      {frame > dur - 12 && (
        <AbsoluteFill
          style={{ background: "#F4EFE4", opacity: flashOpacity, zIndex: 999 }}
        />
      )}
    </AbsoluteFill>
  );
};

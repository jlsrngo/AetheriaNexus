/**
 * Scene2.tsx — WAR: "Jerman punya kode mustahil. Turing punya mesin yang lebih mustahil."
 * Duration: 195 frames (6.5s @ 30fps)
 * Style: /mg-cutout-collage
 *
 * Beat layout:
 *   Beat 1 (0–24f):  Enigma machine photo slaps onto dark wartime paper ground
 *   Beat 2 (24–80f): Decoded-telegram scan slides in with scissor rim; cipher text typewriter
 *   Beat 3 (80–130f): "MUSTAHIL" red stamp slams; U-boat silhouette slides in from right
 *   Beat 4 (130–195f): Camera push; subtitle completes; white flash cut
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
  typewriterChars,
} from "../motion/collageMotion";

const SCRIPT = "Jerman punya kode mustahil. Turing punya mesin yang lebih mustahil.";
const DURATION_SEC = 6.5;

export const Scene2: React.FC<{ durationInFrames?: number }> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = durationInFrames ?? 195;

  const words = buildWordsFromScript(SCRIPT, DURATION_SEC);

  // Beat 1 — Enigma photo
  const enigmaY = slapDrop(frame, 6, fps);
  const enigmaSquash = slapSquash(frame, 6, fps);
  const enigmaShadow = slapShadowBlur(frame, 6, fps);
  const enigmaOpacity = fadeIn(frame, 6, 5);
  const [ex, ey] = boilJitter(frame, 2);

  // Beat 2 — Telegram cipher scan
  const telegramX = interpolate(frame, [30, 52], [-900, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const telegramOpacity = fadeIn(frame, 30, 10);

  // Typewriter cipher text
  const CIPHER = "XVLZG DJPAG NVQZU WPXOP UZMQO";
  const cipherVisible = typewriterChars(frame, 40, CIPHER, fps, 20);

  // Beat 3 — "MUSTAHIL" stamp
  const stampScale = stampSlam(frame, 85, fps);
  const stampOpacity = fadeIn(frame, 83, 4);

  // U-boat slides from right
  const uboatX = interpolate(frame, [95, 120], [800, -60], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const uboatOpacity = fadeIn(frame, 95, 12);
  const [ubx, uby] = boilJitter(frame, 3);

  // Beat 4 — camera push
  const { scale: camScale, rotate: camRotate } = cameraSnapZoom(frame, 130, fps, 1.035, 0.15);

  // Flash out
  const flashOpacity = interpolate(frame, [dur - 10, dur - 2], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: "#1a1208", overflow: "hidden" }}>
      <Audio src={staticFile("turing_s2.wav")} />

      <AbsoluteFill
        style={{
          transform: `scale(${camScale}) rotate(${camRotate}deg)`,
          transformOrigin: "center center",
        }}
      >
        {/* Background — dark wartime paper */}
        <AbsoluteFill>
          <div
            style={{
              width: "100%",
              height: "100%",
              background:
                "radial-gradient(ellipse at 30% 40%, #3a2a10 0%, #1a1208 55%, #0a0804 100%)",
            }}
          />
          {/* Paper grain overlay */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.07'/%3E%3C/svg%3E\")",
              opacity: 0.4,
            }}
          />
        </AbsoluteFill>

        {/* Beat 1 — Enigma machine */}
        <div
          style={{
            position: "absolute",
            top: 160,
            left: "50%",
            transform: `translateX(-50%) translateY(${enigmaY + ey}px) translateX(${ex}px) scaleY(${enigmaSquash}) rotate(3deg)`,
            opacity: enigmaOpacity,
            zIndex: 15,
          }}
        >
          <div
            style={{
              outline: "3.5px solid #F4EFE4",
              boxShadow: `4px ${enigmaShadow * 0.3}px ${enigmaShadow}px rgba(0,0,0,0.65)`,
              width: 440,
              height: 380,
              overflow: "hidden",
            }}
          >
            <img
              src={staticFile("img_enigma.jpg")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "sepia(0.5) contrast(1.15) brightness(0.85)",
              }}
              alt="Enigma machine"
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
              background: "radial-gradient(circle at 35% 35%, #e74c3c, #8B0000)",
              boxShadow: "0 2px 5px rgba(0,0,0,0.6)",
            }}
          />
          {/* Label under photo */}
          <div
            style={{
              marginTop: 8,
              textAlign: "center",
              fontFamily: "'Courier New', monospace",
              fontSize: 28,
              color: "#D4C8A8",
              letterSpacing: "3px",
              textTransform: "uppercase",
            }}
          >
            ENIGMA — REICH, 1939
          </div>
        </div>

        {/* Beat 2 — Telegram scan piece */}
        <div
          style={{
            position: "absolute",
            top: 640,
            left: 60,
            transform: `translateX(${telegramX}px) rotate(-4deg)`,
            opacity: telegramOpacity,
            zIndex: 20,
          }}
        >
          <div
            style={{
              outline: "3.5px solid #F4EFE4",
              background: "#E8DFC0",
              padding: "20px 24px",
              width: 380,
              boxShadow: "6px 8px 18px rgba(0,0,0,0.5)",
            }}
          >
            <div
              style={{
                fontFamily: "'Courier New', monospace",
                fontSize: 22,
                color: "#2a1a08",
                letterSpacing: "5px",
                lineHeight: 1.6,
                fontWeight: "bold",
              }}
            >
              {CIPHER.slice(0, cipherVisible)}
              <span style={{ opacity: 0.3 }}>█</span>
            </div>
            <div
              style={{
                marginTop: 10,
                fontFamily: "'Courier New', monospace",
                fontSize: 16,
                color: "#5a3a18",
                letterSpacing: "2px",
              }}
            >
              INTERCEPTED NAVAL CIPHER
            </div>
          </div>
          {/* Cork pin on telegram */}
          <div
            style={{
              position: "absolute",
              top: -8,
              right: 30,
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: "radial-gradient(circle at 35% 35%, #3498db, #1a5276)",
              boxShadow: "0 2px 4px rgba(0,0,0,0.5)",
            }}
          />
        </div>

        {/* Beat 3 — MUSTAHIL red stamp */}
        <div
          style={{
            position: "absolute",
            top: 1100,
            left: "50%",
            transform: `translateX(-50%) scale(${stampScale}) rotate(-8deg)`,
            opacity: stampOpacity,
            zIndex: 30,
            border: "6px solid #C0392B",
            padding: "10px 32px",
          }}
        >
          <div
            style={{
              fontFamily: "'Impact', 'Arial Black', sans-serif",
              fontSize: 96,
              fontWeight: 900,
              color: "#C0392B",
              letterSpacing: "8px",
              textTransform: "uppercase",
              textShadow: "none",
              opacity: 0.85,
            }}
          >
            MUSTAHIL
          </div>
        </div>

        {/* Beat 3 — U-Boat silhouette */}
        <div
          style={{
            position: "absolute",
            bottom: 320,
            right: -60,
            transform: `translateX(${uboatX}px) translateX(${ubx}px) translateY(${uby}px) rotate(1deg)`,
            opacity: uboatOpacity,
            zIndex: 12,
          }}
        >
          <div
            style={{
              outline: "3.5px solid #F4EFE4",
              boxShadow: "4px 6px 16px rgba(0,0,0,0.6)",
              width: 360,
              height: 200,
              overflow: "hidden",
            }}
          >
            <img
              src={staticFile("img_uboat.jpg")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "sepia(0.6) contrast(1.2) brightness(0.7)",
              }}
              alt="U-boat"
            />
          </div>
        </div>
      </AbsoluteFill>

      <HormoziSubtitle words={words} fontSize={58} bottomOffset={180} />

      {frame > dur - 12 && (
        <AbsoluteFill
          style={{ background: "#F4EFE4", opacity: flashOpacity, zIndex: 999 }}
        />
      )}
    </AbsoluteFill>
  );
};

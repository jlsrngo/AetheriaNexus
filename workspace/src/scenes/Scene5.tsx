/**
 * Scene 5 — THE DARK IRONY
 * "Tapi setelah perang, kisahnya berubah drastis..."
 *
 * Beat 1 (0–B2):   Turing OBE portrait CollagePiece drops
 * Beat 2 (B2–B3):  Court trial document card swings in from right
 * Beat 3 (B3–B4):  "★ GUILTY ★" stamp slams in red
 * Beat 4 (B4–end): Redaction bars animate left-to-right revealing charges
 */
import React from "react";
import { AbsoluteFill, Audio, interpolate, spring, staticFile, useCurrentFrame } from "remotion";
import { ArchivalBackground } from "../components/ArchivalBackground";
import { CollagePiece } from "../components/CollagePiece";
import { HormoziSubtitle } from "../components/HormoziSubtitle";
import { RedThread } from "../components/RedThread";
import { SceneTransition } from "../components/SceneTransition";
import { TURING_SCENES, TURING_WORDS } from "../types";
import { cameraSnapZoom } from "../motion/collageMotion";

const B1 = 0;
const B2 = 90;   // 3.0s — court doc card
const B3 = 200;  // 6.7s — GUILTY stamp
const B4 = 320;  // 10.7s — redaction bars

// Individual redaction bar (reveals left → right)
const RedactionBar: React.FC<{ text: string; revealFrame: number; frame: number; color?: string }> = ({
  text, revealFrame, frame, color = "rgba(200,20,20,0.88)",
}) => {
  const spr = spring({ frame: Math.max(0, frame - revealFrame), fps: 30, config: { damping: 18, stiffness: 110 } });
  const w = interpolate(spr, [0, 1], [0, 820]);
  const textOp = interpolate(frame, [revealFrame + 12, revealFrame + 32], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  return (
    <div style={{ position: "relative", height: 58, marginBottom: 10, display: "flex", alignItems: "center" }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "100%", background: "rgba(0,0,0,0.9)", borderRadius: 4 }} />
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: w, background: color, borderRadius: 4, maxWidth: "100%" }} />
      <span style={{
        position: "relative", zIndex: 2, paddingLeft: 18,
        fontFamily: "'Special Elite', monospace",
        fontSize: 24, color: "#fff", letterSpacing: "0.1em",
        opacity: textOp, whiteSpace: "nowrap",
      }}>
        {text}
      </span>
    </div>
  );
};

export const Scene5: React.FC = () => {
  const frame = useCurrentFrame();
  const meta = TURING_SCENES.s5;
  const cam = cameraSnapZoom(frame, [B1, B2, B3, B4]);

  // GUILTY stamp
  const guiltySpr = spring({ frame: Math.max(0, frame - B3), fps: 30, config: { damping: 7, stiffness: 310 } });
  const guiltyScale = interpolate(guiltySpr, [0, 1], [4.0, 1]);
  const guiltyOpacity = interpolate(guiltySpr, [0, 1], [0, 1]);

  // Thread
  const threadOpacity = interpolate(frame, [B2 + 5, B2 + 30], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: "#080608", overflow: "hidden" }}>
      <Audio src={staticFile(meta.audioFile)} />
      <SceneTransition type="flash" />
      <ArchivalBackground durationInFrames={meta.durationInFrames} />

      <AbsoluteFill
        style={{
          transform: `translate3d(${cam.panX}px,${cam.panY}px,0) scale(${cam.scale})`,
          transformOrigin: "center center",
        }}
      >
        {/* Beat 1 — Turing OBE portrait */}
        <CollagePiece
          id={8}
          src="img_turing_obe.jpg"
          top={120}
          left={80}
          width={480}
          height={580}
          rotation={-3}
          dropFrame={B1}
          hasPin={true}
          pinColor="#2244CC"
          tapeColor="rgba(240,220,170,0.72)"
          zIndex={10}
        />

        {/* Beat 2 — Court trial doc card */}
        <CollagePiece
          id={9}
          src="img_turing_obe.jpg"
          top={160}
          left={560}
          width={420}
          height={380}
          rotation={5}
          dropFrame={B2}
          hasPin={false}
          tapeColor="rgba(240,220,170,0.72)"
          zIndex={11}
        />

        {/* Court doc overlay text */}
        {frame >= B2 && (
          <div style={{
            position: "absolute",
            top: 185,
            left: 575,
            width: 388,
            height: 350,
            zIndex: 15,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "24px 20px",
            background: "rgba(252,248,232,0.92)",
            borderRadius: 2,
            fontFamily: "'Special Elite', monospace",
            fontSize: 20,
            color: "#1A1200",
            lineHeight: 1.7,
            letterSpacing: "0.04em",
            opacity: interpolate(frame, [B2 + 5, B2 + 25], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}>
            <div style={{ fontWeight: 900, fontSize: 22, marginBottom: 8, letterSpacing: "0.1em" }}>
              REGINA v. TURING
            </div>
            <div>MANCHESTER CROWN COURT</div>
            <div>31 MARCH 1952</div>
            <div style={{ marginTop: 8, color: "#8B0000" }}>
              CHARGE: GROSS INDECENCY
            </div>
            <div style={{ color: "#8B0000" }}>
              s.11 Criminal Law Amendment Act 1885
            </div>
          </div>
        )}

        {/* Thread: portrait → doc */}
        <div style={{ opacity: threadOpacity, position: "absolute", inset: 0, zIndex: 13 }}>
          <RedThread x1={560} y1={380} x2={700} y2={380} startFrame={B2 + 5} sag={22} />
        </div>

        {/* Beat 3 — GUILTY stamp */}
        <div style={{
          position: "absolute",
          top: 450,
          left: "50%",
          transform: `translateX(-50%) scale(${guiltyScale}) rotate(-10deg)`,
          transformOrigin: "center center",
          opacity: guiltyOpacity,
          zIndex: 25,
          border: "6px solid #DC2626",
          borderRadius: 8,
          padding: "16px 36px",
          background: "rgba(8,0,0,0.90)",
          fontFamily: "'Special Elite', monospace",
          fontSize: 54,
          color: "#DC2626",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}>
          ★ GUILTY ★
        </div>

        {/* Beat 4 — Redaction bars */}
        <div style={{
          position: "absolute",
          bottom: 240,
          left: 80,
          right: 80,
          zIndex: 20,
        }}>
          <RedactionBar text="CHEMICAL CASTRATION ORDERED" revealFrame={B4} frame={frame} />
          <RedactionBar text="SECURITY CLEARANCE: REVOKED" revealFrame={B4 + 20} frame={frame} color="rgba(80,20,160,0.88)" />
          <RedactionBar text="DISMISSED FROM GCHQ SERVICE" revealFrame={B4 + 40} frame={frame} color="rgba(180,80,0,0.88)" />
        </div>
      </AbsoluteFill>

      <HormoziSubtitle words={TURING_WORDS.s5} top={1365} highlightColor="#FFDE59" />
    </AbsoluteFill>
  );
};

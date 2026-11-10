/**
 * CollagePiece — mg-styles-15 Collage Cutout photo element
 *
 * Features:
 *  • Slap drop physics: squash on landing (scaleY 0.965) then overshoot spring
 *  • White scissor rim border (#F4EFE4, 3.5px)
 *  • Shadow collapse: deep shadow on entry → thin resting shadow
 *  • Cork-board pin (optional, coloured)
 *  • Optional stamp text that slams in after stampFrame
 *  • Stop-motion boil jitter (12fps quantized) so it never looks frozen
 *  • Optional paper-tape strip on top edge
 */
import React from "react";
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { boilOffset } from "../motion/collageMotion";

export interface CollagePieceProps {
  /** Unique seed for boil jitter (use a constant integer per element) */
  id: number;
  src: string;
  top: number;
  left: number;
  width: number;
  height: number;
  /** Resting rotation in degrees */
  rotation?: number;
  /** Frame at which the piece drops in */
  dropFrame?: number;
  /** Show a cork pin on the top-centre */
  hasPin?: boolean;
  pinColor?: string;
  /** Stamp text (e.g. "★ TOP SECRET ★") */
  stampText?: string;
  /** Frame at which the stamp slams */
  stampFrame?: number;
  /** Stamp colour */
  stampColor?: string;
  /** Paper tape strip colour */
  tapeColor?: string;
  /** zIndex override */
  zIndex?: number;
}

export const CollagePiece: React.FC<CollagePieceProps> = ({
  id,
  src,
  top,
  left,
  width,
  height,
  rotation = 0,
  dropFrame = 10,
  hasPin = false,
  pinColor = "#CC2200",
  stampText,
  stampFrame = 30,
  stampColor = "#CC1A00",
  tapeColor,
  zIndex = 10,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Drop spring (overshoot into resting position) ──────────────────────
  const dropSpr = spring({
    frame: Math.max(0, frame - dropFrame),
    fps,
    config: { damping: 11, stiffness: 130 },
  });
  const translateY = interpolate(dropSpr, [0, 1], [-520, 0]);

  // Squash on landing: scaleY dips to 0.965 at peak spring then returns to 1
  const squashSpr = spring({
    frame: Math.max(0, frame - dropFrame),
    fps,
    config: { damping: 6, stiffness: 400 },
  });
  const scaleY = interpolate(squashSpr, [0, 0.5, 1], [1, 0.965, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Shadow: deep on entry → thin resting
  const shadowBlur = interpolate(dropSpr, [0, 1], [60, 14], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const shadowY = interpolate(dropSpr, [0, 1], [30, 7], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Stop-motion boil jitter (only while piece is visible)
  const isLanded = frame > dropFrame + 10;
  const boil = isLanded ? boilOffset(frame, id, 1.2) : { x: 0, y: 0 };

  // ── Stamp spring ───────────────────────────────────────────────────────
  const stampSpr = spring({
    frame: Math.max(0, frame - stampFrame),
    fps,
    config: { damping: 7, stiffness: 300 },
  });
  const stampScale = interpolate(stampSpr, [0, 1], [3.2, 1]);
  const stampOpacity = interpolate(stampSpr, [0, 1], [0, 1]);

  // ── Pin bob ────────────────────────────────────────────────────────────
  const pinBob = Math.sin(frame * 0.08) * 1.5;

  return (
    <div
      style={{
        position: "absolute",
        top: top + boil.y,
        left: left + boil.x,
        width,
        height,
        transform: `translateY(${translateY}px) rotate(${rotation}deg) scaleY(${scaleY})`,
        transformOrigin: "top center",
        zIndex,
        // Scissor-cut white rim
        outline: "3.5px solid #F4EFE4",
        outlineOffset: "0px",
        boxShadow: `0 ${shadowY}px ${shadowBlur}px rgba(0,0,0,0.70), 0 2px 4px rgba(0,0,0,0.40)`,
        borderRadius: 2,
        overflow: "visible",
      }}
    >
      {/* Photo */}
      <img
        src={src.startsWith("http") || src.startsWith("/") || src.startsWith("data:") ? src : staticFile(src)}
        alt=""
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
          borderRadius: 2,
          filter: "sepia(0.18) contrast(1.08) brightness(0.96)",
        }}
      />

      {/* Paper tape strip on top edge */}
      {tapeColor && (
        <div
          style={{
            position: "absolute",
            top: -14,
            left: "50%",
            transform: "translateX(-50%)",
            width: 90,
            height: 28,
            background: tapeColor,
            opacity: 0.82,
            borderRadius: 3,
            boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
          }}
        />
      )}

      {/* Cork pin */}
      {hasPin && (
        <div
          style={{
            position: "absolute",
            top: -16 + pinBob,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 20,
          }}
        >
          {/* Pin head */}
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: pinColor,
              boxShadow: `0 2px 6px rgba(0,0,0,0.6), inset 0 -2px 4px rgba(255,255,255,0.3)`,
              margin: "0 auto",
            }}
          />
          {/* Pin shaft */}
          <div
            style={{
              width: 3,
              height: 14,
              background: "#888",
              margin: "0 auto",
              borderRadius: "0 0 2px 2px",
            }}
          />
        </div>
      )}

      {/* Stamp overlay */}
      {stampText && (
        <div
          style={{
            position: "absolute",
            bottom: 24,
            left: "50%",
            transform: `translateX(-50%) scale(${stampScale}) rotate(-8deg)`,
            transformOrigin: "center center",
            opacity: stampOpacity,
            border: `4px solid ${stampColor}`,
            borderRadius: 6,
            padding: "8px 18px",
            fontFamily: "'Special Elite', monospace",
            fontSize: 28,
            fontWeight: 900,
            color: stampColor,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            background: "rgba(255,255,255,0.06)",
            pointerEvents: "none",
            zIndex: 15,
          }}
        >
          {stampText}
        </div>
      )}
    </div>
  );
};

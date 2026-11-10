/**
 * CollagePiece.tsx
 * Reusable Dada/Paper-Collage piece component for /mg-cutout-collage style.
 *
 * Features:
 *  - Slap-drop physics entrance (fast drop + squash landing)
 *  - 3.5px scissor rim #F4EFE4 outline
 *  - Shadow collapse from elevated → contact
 *  - Cork pin dot at top-center
 *  - Stop-motion boil jitter at 12fps
 *  - Accepts children (image, text, SVG)
 */
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import {
  slapDrop,
  slapSquash,
  slapShadowBlur,
  boilJitter,
  fadeIn,
} from "../motion/collageMotion";

export interface CollagePieceProps {
  /** Local frame (0-based inside the parent Sequence) at which piece slaps in */
  atFrame?: number;
  /** Deterministic seed for jitter so each piece moves differently */
  pieceId?: number;
  /** Rotation angle in degrees (resting pose) */
  rotate?: number;
  /** Whether to show cork pin at top */
  showPin?: boolean;
  /** Pin color */
  pinColor?: string;
  /** Scissor rim color (default #F4EFE4) */
  rimColor?: string;
  /** Additional styles on the outer wrapper */
  style?: React.CSSProperties;
  className?: string;
  children?: React.ReactNode;
  /** Width of the collage piece */
  width?: number | string;
  /** Height of the collage piece */
  height?: number | string;
  /** Disable jitter (for large background pieces) */
  noJitter?: boolean;
}

export const CollagePiece: React.FC<CollagePieceProps> = ({
  atFrame = 0,
  pieceId = 0,
  rotate = 0,
  showPin = true,
  pinColor = "#C0392B",
  rimColor = "#F4EFE4",
  style = {},
  className,
  children,
  width = "auto",
  height = "auto",
  noJitter = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Slap physics
  const dropY = slapDrop(frame, atFrame, fps);
  const squashY = slapSquash(frame, atFrame, fps);
  const shadowBlur = slapShadowBlur(frame, atFrame, fps);
  const opacity = fadeIn(frame, atFrame, 3);

  // 12fps boil jitter
  const [jx, jy] = noJitter ? [0, 0] : boilJitter(frame, pieceId);

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width,
        height,
        transform: `
          translateY(${dropY + jy}px)
          translateX(${jx}px)
          rotate(${rotate}deg)
          scaleY(${squashY})
        `,
        opacity,
        // Scissor rim: white border outline simulating cut paper edge
        outline: `3.5px solid ${rimColor}`,
        outlineOffset: "0px",
        // Contact shadow collapses on landing
        boxShadow: `0px ${shadowBlur * 0.4}px ${shadowBlur}px rgba(0,0,0,0.55)`,
        // Slight halftone texture via CSS filter
        filter: "contrast(1.03) saturate(0.92)",
        ...style,
      }}
    >
      {children}

      {/* Cork pin */}
      {showPin && (
        <div
          style={{
            position: "absolute",
            top: -8,
            left: "50%",
            transform: "translateX(-50%)",
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: `radial-gradient(circle at 35% 35%, #e74c3c, ${pinColor})`,
            boxShadow: "0 2px 4px rgba(0,0,0,0.5)",
            zIndex: 10,
          }}
        />
      )}
    </div>
  );
};

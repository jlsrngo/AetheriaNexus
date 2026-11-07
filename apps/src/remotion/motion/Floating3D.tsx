import React from "react";
import { useCurrentFrame } from "remotion";

export interface FloatingShapeProps {
  color?: string;
  size?: number;
  initialX?: number;
  initialY?: number;
  depth?: number;
  speed?: number;
  shape?: "cube" | "sphere" | "torus" | "diamond";
}

/**
 * 3D Floating Geometry Primitive (Hardware Accelerated CSS 3D).
 * Renders spatial depth and ambient parallax without requiring heavy external WebGL context.
 */
export const Floating3DElement: React.FC<FloatingShapeProps> = ({
  color = "#10B981",
  size = 64,
  initialX = 0,
  initialY = 0,
  depth = 200,
  speed = 1.0,
  shape = "cube",
}) => {
  const frame = useCurrentFrame();

  const floatY = Math.sin((frame * speed) / 25) * 20;
  const floatX = Math.cos((frame * speed) / 35) * 12;
  const rotX = (frame * speed * 0.8) % 360;
  const rotY = (frame * speed * 1.2) % 360;

  const half = size / 2;

  return (
    <div
      style={{
        position: "absolute",
        left: `calc(50% + ${initialX + floatX}px)`,
        top: `calc(50% + ${initialY + floatY}px)`,
        width: size,
        height: size,
        transformStyle: "preserve-3d",
        transform: `translate3d(-50%, -50%, ${depth}px) rotateX(${rotX}deg) rotateY(${rotY}deg)`,
        pointerEvents: "none",
        opacity: 0.75,
      }}
    >
      {shape === "cube" && (
        <>
          {/* Front */}
          <div
            style={{
              position: "absolute",
              width: size,
              height: size,
              background: `linear-gradient(135deg, ${color}66, ${color}22)`,
              border: `1px solid ${color}88`,
              borderRadius: 8,
              transform: `translateZ(${half}px)`,
              backdropFilter: "blur(4px)",
            }}
          />
          {/* Back */}
          <div
            style={{
              position: "absolute",
              width: size,
              height: size,
              background: `linear-gradient(135deg, ${color}44, ${color}11)`,
              border: `1px solid ${color}44`,
              borderRadius: 8,
              transform: `rotateY(180deg) translateZ(${half}px)`,
            }}
          />
          {/* Top */}
          <div
            style={{
              position: "absolute",
              width: size,
              height: size,
              background: `linear-gradient(135deg, ${color}88, ${color}33)`,
              border: `1px solid ${color}aa`,
              borderRadius: 8,
              transform: `rotateX(90deg) translateZ(${half}px)`,
            }}
          />
          {/* Bottom */}
          <div
            style={{
              position: "absolute",
              width: size,
              height: size,
              background: `linear-gradient(135deg, ${color}33, ${color}11)`,
              border: `1px solid ${color}44`,
              borderRadius: 8,
              transform: `rotateX(-90deg) translateZ(${half}px)`,
            }}
          />
        </>
      )}

      {shape === "sphere" && (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            background: `radial-gradient(circle at 35% 35%, #FFFFFFaa 0%, ${color} 50%, #000000 100%)`,
            boxShadow: `0 0 24px ${color}66`,
          }}
        />
      )}

      {shape === "diamond" && (
        <div
          style={{
            width: size,
            height: size,
            background: `linear-gradient(45deg, ${color}99, ${color}33)`,
            border: `2px solid ${color}`,
            borderRadius: 6,
            transform: "rotate(45deg)",
            boxShadow: `0 0 20px ${color}55`,
          }}
        />
      )}
    </div>
  );
};

/**
 * Floating 3D Background Canvas.
 * Creates depth and spatial movement across the video canvas.
 */
export const Floating3DBackground: React.FC<{
  accentColor?: string;
}> = ({ accentColor = "#10B981" }) => {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        perspective: 1200,
        transformStyle: "preserve-3d",
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <Floating3DElement
        color={accentColor}
        size={72}
        initialX={-320}
        initialY={-280}
        depth={-100}
        speed={0.8}
        shape="cube"
      />
      <Floating3DElement
        color="#F59E0B"
        size={48}
        initialX={340}
        initialY={-180}
        depth={50}
        speed={1.1}
        shape="sphere"
      />
      <Floating3DElement
        color="#3B82F6"
        size={56}
        initialX={-280}
        initialY={320}
        depth={-50}
        speed={0.9}
        shape="diamond"
      />
      <Floating3DElement
        color={accentColor}
        size={40}
        initialX={300}
        initialY={360}
        depth={100}
        speed={1.3}
        shape="cube"
      />
    </div>
  );
};

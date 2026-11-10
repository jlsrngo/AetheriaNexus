import React from "react";
import { interpolate, spring, staticFile, useCurrentFrame } from "remotion";

interface PolaroidCardProps {
  imageSrc: string;
  caption?: string;
  rotation?: number;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  dropFrame?: number;
  stamp?: string;
}

export const PolaroidCard: React.FC<PolaroidCardProps> = ({
  imageSrc,
  caption,
  rotation = -3,
  width = 560,
  height = 680,
  x = 260,
  y = 480,
  dropFrame = 8,
  stamp,
}) => {
  const frame = useCurrentFrame();

  const spr = spring({
    frame: Math.max(0, frame - dropFrame),
    fps: 30,
    config: { damping: 14, stiffness: 85, mass: 0.95 },
  });

  const translateY = interpolate(spr, [0, 1], [-300, 0]);
  const scale = interpolate(spr, [0, 1], [1.3, 1]);
  const rot = interpolate(spr, [0, 0.7, 1], [rotation - 8, rotation + 1.5, rotation]);
  const opacity = interpolate(spr, [0, 0.4, 1], [0, 1, 1]);

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        backgroundColor: "#F5F0E4",
        padding: "20px 20px 60px 20px",
        borderRadius: 4,
        boxShadow: "0 20px 50px rgba(0, 0, 0, 0.75), 0 4px 12px rgba(0, 0, 0, 0.4)",
        transform: `translate(${translateY * 0.1}px, ${translateY}px) scale(${scale}) rotate(${rot}deg)`,
        transformOrigin: "center center",
        opacity,
        zIndex: 50,
      }}
    >
      {/* 3D Pushpin at the top center */}
      <div
        style={{
          position: "absolute",
          top: -16,
          left: "50%",
          transform: "translateX(-50%)",
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "radial-gradient(circle at 35% 35%, #ff6b6b 0%, #DC2626 50%, #7f1d1d 100%)",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.8)",
          zIndex: 70,
        }}
      />

      {/* Image container */}
      <div
        style={{
          width: "100%",
          height: height - 120,
          overflow: "hidden",
          backgroundColor: "#181410",
          borderRadius: 2,
        }}
      >
        <img
          src={staticFile(imageSrc)}
          alt="Evidence"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "contrast(1.1) brightness(0.95)",
          }}
        />
      </div>

      {/* Handwritten Caption */}
      {caption && (
        <div
          style={{
            marginTop: 16,
            textAlign: "center",
            color: "#181410",
            fontFamily: "'Caveat', cursive",
            fontSize: 34,
            fontWeight: 700,
            letterSpacing: "1px",
          }}
        >
          {caption}
        </div>
      )}

      {/* Optional Classified Stamp */}
      {stamp && (
        <div
          style={{
            position: "absolute",
            bottom: 80,
            right: 30,
            border: "3px solid #DC2626",
            padding: "6px 16px",
            color: "#DC2626",
            fontFamily: "'Courier Prime', monospace",
            fontWeight: 900,
            fontSize: 22,
            letterSpacing: "3px",
            transform: "rotate(-12deg)",
            textTransform: "uppercase",
            boxShadow: "inset 0 0 8px rgba(220, 38, 38, 0.2)",
          }}
        >
          {stamp}
        </div>
      )}
    </div>
  );
};


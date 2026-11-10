import React from "react";
import { interpolate, spring, useCurrentFrame } from "remotion";

interface TopDossierHeaderProps {
  classification?: string;
  fileCode?: string;
}

export const TopDossierHeader: React.FC<TopDossierHeaderProps> = ({
  classification = "★ TOP SECRET // BLETCHLEY PARK ★",
  fileCode = "FILE REF: GC&CS-ENIGMA-1940",
}) => {
  const frame = useCurrentFrame();

  const spr = spring({
    frame,
    fps: 30,
    config: { damping: 14, stiffness: 90 },
  });

  const translateY = interpolate(spr, [0, 1], [-60, 0]);
  const opacity = interpolate(spr, [0, 1], [0, 1]);

  return (
    <div
      style={{
        position: "absolute",
        top: 80,
        left: 60,
        right: 60,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        zIndex: 90,
        opacity,
        transform: `translateY(${translateY}px)`,
        pointerEvents: "none",
      }}
    >
      {/* Classification pill */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 24px",
          backgroundColor: "#DC2626",
          color: "#FAFAFA",
          fontFamily: "'Courier Prime', monospace",
          fontSize: 16,
          fontWeight: 900,
          letterSpacing: "3px",
          borderRadius: 4,
          boxShadow: "0 4px 16px rgba(220, 38, 38, 0.4)",
          textTransform: "uppercase",
        }}
      >
        <span>{classification}</span>
      </div>

      {/* Monospace dossier metadata */}
      <div
        style={{
          marginTop: 8,
          color: "#8E8E98",
          fontFamily: "'Courier Prime', monospace",
          fontSize: 14,
          letterSpacing: "2px",
          textTransform: "uppercase",
        }}
      >
        {fileCode}
      </div>
    </div>
  );
};


import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

interface GearProps {
  cx: number;
  cy: number;
  r: number;
  teeth: number;
  direction: 1 | -1;
  speed: number;
  color: string;
}

const Gear: React.FC<GearProps & { frame: number }> = ({
  cx, cy, r, teeth, direction, speed, color, frame,
}) => {
  const angle = (frame * speed * direction * Math.PI) / 180;
  const toothH = r * 0.28;
  const innerR = r - toothH;

  // Build SVG path for gear outline
  let path = "";
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2;
    const a1 = ((i + 0.35) / teeth) * Math.PI * 2;
    const a2 = ((i + 0.65) / teeth) * Math.PI * 2;
    const a3 = ((i + 1) / teeth) * Math.PI * 2;
    const p = (a: number, rad: number) => ({
      x: Math.cos(a) * rad,
      y: Math.sin(a) * rad,
    });
    if (i === 0) path += `M ${p(a0, innerR).x} ${p(a0, innerR).y}`;
    path += ` L ${p(a1, innerR).x} ${p(a1, innerR).y}`;
    path += ` L ${p(a1, r + toothH).x} ${p(a1, r + toothH).y}`;
    path += ` L ${p(a2, r + toothH).x} ${p(a2, r + toothH).y}`;
    path += ` L ${p(a2, innerR).x} ${p(a2, innerR).y}`;
    path += ` L ${p(a3, innerR).x} ${p(a3, innerR).y}`;
  }
  path += " Z";

  return (
    <g transform={`translate(${cx},${cy}) rotate(${(angle * 180) / Math.PI})`}>
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={3}
        opacity={0.72}
      />
      {/* Hub */}
      <circle r={r * 0.22} fill="none" stroke={color} strokeWidth={2.5} opacity={0.6} />
      {/* Spokes */}
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <line
          key={deg}
          x1={0} y1={0}
          x2={Math.cos((deg * Math.PI) / 180) * innerR * 0.82}
          y2={Math.sin((deg * Math.PI) / 180) * innerR * 0.82}
          stroke={color}
          strokeWidth={2}
          opacity={0.45}
        />
      ))}
    </g>
  );
};

/**
 * BombeGearsOverlay — animated SVG gear train.
 * Renders over imagery to represent the Bombe decryption machine.
 */
export const BombeGearsOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const amber = "#F5A623";
  const green = "#7CB342";
  const grey = "#90A4AE";

  const gears: GearProps[] = [
    { cx: 540, cy: 420, r: 160, teeth: 20, direction: 1,  speed: 0.6,  color: amber },
    { cx: 290, cy: 300, r: 90,  teeth: 12, direction: -1, speed: 1.07, color: green },
    { cx: 790, cy: 320, r: 95,  teeth: 13, direction: -1, speed: 1.0,  color: green },
    { cx: 200, cy: 520, r: 60,  teeth: 8,  direction: 1,  speed: 1.6,  color: grey  },
    { cx: 870, cy: 530, r: 65,  teeth: 9,  direction: 1,  speed: 1.5,  color: grey  },
    { cx: 540, cy: 630, r: 75,  teeth: 10, direction: -1, speed: 1.28, color: grey  },
  ];

  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 3,
        pointerEvents: "none",
        opacity: 0.55,
      }}
      viewBox="0 0 1080 1920"
      xmlns="http://www.w3.org/2000/svg"
    >
      {gears.map((g, i) => (
        <Gear key={i} {...g} frame={frame} />
      ))}
    </svg>
  );
};

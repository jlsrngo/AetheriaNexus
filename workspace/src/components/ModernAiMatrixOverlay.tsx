import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

const NODE_COUNT = 24;
const NODES = Array.from({ length: NODE_COUNT }, (_, i) => ({
  x: 60 + ((i * 173) % 960),
  y: 200 + ((i * 237) % 1500),
  r: 6 + ((i * 11) % 14),
}));

// Deterministic edges
const EDGES: [number, number][] = [];
for (let i = 0; i < NODE_COUNT; i++) {
  EDGES.push([i, (i + 3) % NODE_COUNT]);
  EDGES.push([i, (i + 7) % NODE_COUNT]);
}

/**
 * ModernAiMatrixOverlay — animated neural network nodes + edges.
 * Represents modern AI/ML built on Turing's legacy.
 */
export const ModernAiMatrixOverlay: React.FC = () => {
  const frame = useCurrentFrame();

  const pulse = 0.5 + 0.5 * Math.sin(frame * 0.08);
  const globalOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 3,
        pointerEvents: "none",
        opacity: globalOpacity * 0.55,
      }}
      viewBox="0 0 1080 1920"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Edges */}
      {EDGES.map(([a, b], i) => {
        const na = NODES[a];
        const nb = NODES[b];
        const edgePulse = 0.3 + 0.3 * Math.sin(frame * 0.06 + i * 0.4);
        return (
          <line
            key={i}
            x1={na.x} y1={na.y}
            x2={nb.x} y2={nb.y}
            stroke={`rgba(80,180,255,${edgePulse})`}
            strokeWidth={1.5}
          />
        );
      })}

      {/* Nodes */}
      {NODES.map((n, i) => {
        const nodePulse = 0.6 + 0.4 * Math.sin(frame * 0.09 + i * 0.7);
        const isActive = ((i + Math.floor(frame / 12)) % 6) === 0;
        return (
          <g key={i}>
            {isActive && (
              <circle
                cx={n.x} cy={n.y}
                r={n.r * 2.2 * nodePulse}
                fill="none"
                stroke="rgba(80,200,255,0.4)"
                strokeWidth={2}
              />
            )}
            <circle
              cx={n.x} cy={n.y}
              r={n.r}
              fill={isActive ? "rgba(80,200,255,0.9)" : "rgba(60,140,220,0.65)"}
            />
          </g>
        );
      })}
    </svg>
  );
};

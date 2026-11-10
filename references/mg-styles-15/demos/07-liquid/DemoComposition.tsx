import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const LiquidFluidDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Viscous metaball stretch and snap
  const fluidSpr = spring({ frame, fps, config: { damping: 9, stiffness: 90 } });
  const yOffset = interpolate(fluidSpr, [0, 1], [-300, 150]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0A0D14", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg style={{ position: "absolute", width: 0, height: 0 }}>
        <filter id="metaball">
          <feGaussianBlur in="SourceGraphic" stdDeviation="22" result="blur" />
          <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 28 -9" result="goo" />
        </filter>
      </svg>

      <div style={{ filter: "url(#metaball)", width: 600, height: 600, position: "relative" }}>
        <div style={{ position: "absolute", left: 200, top: 200, width: 200, height: 200, borderRadius: "50%", backgroundColor: "#06B6D4" }} />
        <div style={{ position: "absolute", left: 200, top: 200 + yOffset, width: 140, height: 140, borderRadius: "50%", backgroundColor: "#3B82F6" }} />
      </div>
    </AbsoluteFill>
  );
};
export default LiquidFluidDemo;

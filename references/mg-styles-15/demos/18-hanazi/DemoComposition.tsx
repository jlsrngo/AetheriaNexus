import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const KineticTypographyDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slamSpr = spring({ frame, fps, config: { damping: 9, stiffness: 180 } });
  const scale = interpolate(slamSpr, [0, 1], [3.5, 1.0]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#FFE500", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      {/* Speed lines */}
      <div style={{ transform: `scale(${scale}) rotate(-4deg)`, textAlign: "center" }}>
        <h1
          style={{
            fontFamily: "Impact, 'Arial Black', sans-serif",
            fontSize: 140,
            fontWeight: 900,
            color: "#FF1493",
            margin: 0,
            textTransform: "uppercase",
            WebkitTextStroke: "6px #1A1A1A",
            textShadow: "10px 10px 0px #1A1A1A, 20px 20px 0px #00F0FF",
            letterSpacing: 4,
          }}
        >
          EXPLOSIVE!
        </h1>
      </div>
    </AbsoluteFill>
  );
};
export default KineticTypographyDemo;

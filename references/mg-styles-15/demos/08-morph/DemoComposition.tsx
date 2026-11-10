import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const ShapeMorphDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Morph cycle: Circle (0..60) -> Square (60..120) -> Pill (120..180)
  const morphSpr = spring({ frame: frame % 90, fps, config: { damping: 12, stiffness: 100 } });
  const borderRadius = interpolate(morphSpr, [0, 1], [0, 180]);
  const rotate = interpolate(morphSpr, [0, 1], [0, 90]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width: 320,
          height: 320,
          backgroundColor: "#8B5CF6",
          borderRadius: `${borderRadius}px`,
          transform: `rotate(${rotate}deg)`,
          boxShadow: "0 20px 40px rgba(139,92,246,0.35)",
        }}
      />
    </AbsoluteFill>
  );
};
export default ShapeMorphDemo;

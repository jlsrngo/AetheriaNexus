import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const IsometricDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 3-tier block assembly dropping along 30-deg axonometric axis
  const b1 = spring({ frame: Math.max(0, frame - 10), fps, config: { damping: 11, stiffness: 120 } });
  const b2 = spring({ frame: Math.max(0, frame - 25), fps, config: { damping: 11, stiffness: 120 } });
  const b3 = spring({ frame: Math.max(0, frame - 40), fps, config: { damping: 11, stiffness: 120 } });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0E141D", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ transform: "rotateX(60deg) rotateZ(45deg)", transformStyle: "preserve-3d" }}>
        <div style={{ width: 220, height: 220, backgroundColor: "#38BDF8", transform: `translateZ(${interpolate(b1, [0, 1], [600, 0])}px)`, boxShadow: "10px 10px 0 #0284C7" }} />
        <div style={{ width: 160, height: 160, backgroundColor: "#818CF8", transform: `translateZ(${interpolate(b2, [0, 1], [800, 60])}px)`, boxShadow: "10px 10px 0 #4F46E5" }} />
        <div style={{ width: 100, height: 100, backgroundColor: "#F43F5E", transform: `translateZ(${interpolate(b3, [0, 1], [1000, 120])}px)`, boxShadow: "10px 10px 0 #BE123C" }} />
      </div>
    </AbsoluteFill>
  );
};
export default IsometricDemo;

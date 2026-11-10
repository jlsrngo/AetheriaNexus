import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const Spatial3DDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Soft clay sphere drops with heavy squash and damped spring
  const dropSpr = spring({ frame, fps, config: { damping: 8, stiffness: 110 } });
  const sphereY = interpolate(dropSpr, [0, 1], [-500, 0]);
  const squashY = interpolate(dropSpr, [0, 0.8, 1], [1.2, 0.88, 1.0]);

  return (
    <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 35%, #2D2738 0%, #110E17 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ transform: `translateY(${sphereY}px) scaleY(${squashY})`, transformOrigin: "bottom center" }}>
        {/* Soft-body Clay Sphere with ambient shadow */}
        <div
          style={{
            width: 320,
            height: 320,
            borderRadius: "50%",
            background: "radial-gradient(circle at 35% 30%, #FFB6C1 0%, #FF69B4 45%, #C71585 90%)",
            boxShadow: "0 40px 80px rgba(0,0,0,0.6), inset -10px -10px 25px rgba(0,0,0,0.4), inset 15px 15px 30px rgba(255,255,255,0.4)",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
export default Spatial3DDemo;

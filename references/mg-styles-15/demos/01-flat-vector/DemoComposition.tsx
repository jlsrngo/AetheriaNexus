import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const FlatVectorDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // B1 (0..35): Saturated circle drops with anticipation -> squash -> overshoot
  const dropSpr = spring({ frame, fps, config: { damping: 9, stiffness: 140 } });
  const circleY = interpolate(dropSpr, [0, 1], [-400, 540]);
  const circleScale = interpolate(dropSpr, [0, 0.8, 1], [0.5, 1.15, 1.0]);

  // B2 (35..90): Flat city buildings pop up with staggered overshoots
  const b1Spr = spring({ frame: Math.max(0, frame - 35), fps, config: { damping: 10, stiffness: 120 } });
  const b2Spr = spring({ frame: Math.max(0, frame - 42), fps, config: { damping: 10, stiffness: 120 } });
  const b3Spr = spring({ frame: Math.max(0, frame - 49), fps, config: { damping: 10, stiffness: 120 } });

  // B3 (120..200): Shape wipe notification burst
  const wipeSpr = spring({ frame: Math.max(0, frame - 120), fps, config: { damping: 14, stiffness: 100 } });
  const wipeScale = interpolate(wipeSpr, [0, 1], [0, 1]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#2B2BFF", overflow: "hidden" }}>
      {/* Background Sun / Hero Circle */}
      <div
        style={{
          position: "absolute",
          left: 960 - 120,
          top: circleY - 120,
          width: 240,
          height: 240,
          borderRadius: "50%",
          backgroundColor: "#FFC62B",
          transform: `scale(${circleScale})`,
        }}
      />

      {/* Flat City Horizon */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 380, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 30 }}>
        <div style={{ width: 140, height: 320, backgroundColor: "#FFF6E9", transform: `scaleY(${b1Spr})`, transformOrigin: "bottom" }} />
        <div style={{ width: 180, height: 420, backgroundColor: "#FF5A4E", transform: `scaleY(${b2Spr})`, transformOrigin: "bottom" }} />
        <div style={{ width: 150, height: 280, backgroundColor: "#2EE6A8", transform: `scaleY(${b3Spr})`, transformOrigin: "bottom" }} />
      </div>

      {/* Shape Wipe Overlay */}
      {frame >= 120 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${wipeScale})`,
            transformOrigin: "center center",
          }}
        >
          <div style={{ width: 900, height: 500, backgroundColor: "#FFF6E9", borderRadius: 32, padding: 48, boxShadow: "0 24px 60px rgba(0,0,0,0.3)" }}>
            <h1 style={{ fontFamily: "Inter, sans-serif", fontSize: 64, fontWeight: 900, color: "#151433", margin: 0 }}>POPEASY SaaS</h1>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 28, color: "#666", marginTop: 16 }}>Continuous one-shot flat vector motion design.</p>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
export default FlatVectorDemo;

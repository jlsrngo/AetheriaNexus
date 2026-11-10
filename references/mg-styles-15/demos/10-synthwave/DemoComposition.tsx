import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

export const SynthwaveDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const gridOffset = (frame * 6) % 60;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0B001A", overflow: "hidden" }}>
      {/* Segmented Gradient Sun */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "25%",
          transform: "translateX(-50%)",
          width: 380,
          height: 380,
          borderRadius: "50%",
          background: "linear-gradient(to bottom, #FFE600 0%, #FF007F 100%)",
          boxShadow: "0 0 80px #FF007F",
        }}
      />

      {/* Perspective Neon 3D Grid */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: -200,
          right: -200,
          height: "55%",
          transform: "perspective(400px) rotateX(65deg)",
          transformOrigin: "bottom center",
          backgroundImage: `linear-gradient(#00FFFF 1.5px, transparent 1.5px), linear-gradient(90deg, #FF007F 1.5px, transparent 1.5px)`,
          backgroundSize: `60px 60px`,
          backgroundPosition: `0px ${gridOffset}px`,
          borderTop: "3px solid #00FFFF",
          boxShadow: "0 -20px 40px #FF007F",
        }}
      />

      {/* Retro Headline */}
      <div style={{ position: "absolute", bottom: 80, left: 0, right: 0, textAlign: "center" }}>
        <h1 style={{ fontFamily: "Impact, sans-serif", fontSize: 92, color: "#FFF", textShadow: "0 0 20px #00FFFF, 0 0 40px #FF007F", letterSpacing: 8, margin: 0 }}>
          SYNTHWAVE 1986
        </h1>
      </div>
    </AbsoluteFill>
  );
};
export default SynthwaveDemo;

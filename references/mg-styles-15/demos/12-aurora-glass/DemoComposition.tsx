import { AbsoluteFill, useCurrentFrame } from "remotion";

export const AuroraGlassDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const x1 = Math.sin(frame * 0.03) * 120;
  const y1 = Math.cos(frame * 0.025) * 80;

  return (
    <AbsoluteFill style={{ backgroundColor: "#060814", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* Drifting Aurora Blobs */}
      <div style={{ position: "absolute", left: `calc(35% + ${x1}px)`, top: `calc(30% + ${y1}px)`, width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, #8B5CF6 0%, transparent 70%)", filter: "blur(60px)", opacity: 0.8 }} />
      <div style={{ position: "absolute", right: `calc(30% - ${x1}px)`, bottom: `calc(30% - ${y1}px)`, width: 550, height: 550, borderRadius: "50%", background: "radial-gradient(circle, #06B6D4 0%, transparent 70%)", filter: "blur(70px)", opacity: 0.7 }} />

      {/* Frosted Glass Card */}
      <div
        style={{
          width: 640,
          padding: "48px 56px",
          background: "rgba(255, 255, 255, 0.07)",
          backdropFilter: "blur(32px)",
          WebkitBackdropFilter: "blur(32px)",
          borderRadius: 24,
          border: "1px solid rgba(255, 255, 255, 0.2)",
          boxShadow: "0 30px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.25)",
          color: "#FFF",
        }}
      >
        <h2 style={{ fontFamily: "Inter, sans-serif", fontSize: 44, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>Aurora Intelligence</h2>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 20, color: "rgba(255,255,255,0.75)", marginTop: 16, lineHeight: 1.6 }}>
          Frosted glassmorphism with dynamic mesh gradient refractions.
        </p>
      </div>
    </AbsoluteFill>
  );
};
export default AuroraGlassDemo;

import { AbsoluteFill, useCurrentFrame } from "remotion";

export const SciFiHudDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const r1 = (frame * 1.5) % 360;
  const r2 = (-frame * 0.8) % 360;

  return (
    <AbsoluteFill style={{ backgroundColor: "#060A10", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      {/* Concentric Rotating Reticles */}
      <div style={{ position: "relative", width: 500, height: 500 }}>
        <svg viewBox="0 0 500 500" style={{ position: "absolute", inset: 0, transform: `rotate(${r1}deg)` }}>
          <circle cx="250" cy="250" r="220" fill="none" stroke="#06B6D4" strokeWidth="2" strokeDasharray="30 15" />
          <circle cx="250" cy="250" r="180" fill="none" stroke="#06B6D4" strokeWidth="1.5" strokeDasharray="60 40" />
        </svg>

        <svg viewBox="0 0 500 500" style={{ position: "absolute", inset: 0, transform: `rotate(${r2}deg)` }}>
          <circle cx="250" cy="250" r="140" fill="none" stroke="#EF4444" strokeWidth="2" strokeDasharray="10 10" />
          <line x1="250" y1="90" x2="250" y2="410" stroke="#06B6D4" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="90" y1="250" x2="410" y2="250" stroke="#06B6D4" strokeWidth="1" strokeDasharray="4 4" />
        </svg>

        {/* Lock-on Target Center */}
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", color: "#06B6D4", fontFamily: "'Courier New', monospace", fontSize: 20, textAlign: "center" }}>
          [TARGET ACQUIRED]<br />
          <span style={{ fontSize: 14, color: "#EF4444" }}>COORD: 42.88N 19.45E</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
export default SciFiHudDemo;

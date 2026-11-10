import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

export const BauhausDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const beat = Math.floor(frame / 15); // Snap every half second

  return (
    <AbsoluteFill style={{ backgroundColor: "#EBE6DD", padding: 60, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 30 }}>
      <div style={{ backgroundColor: beat % 2 === 0 ? "#D94030" : "#1A1A1A", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 160, height: 160, borderRadius: "50%", backgroundColor: "#EBE6DD" }} />
      </div>
      <div style={{ backgroundColor: "#20407C", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <h1 style={{ fontFamily: "Impact, sans-serif", fontSize: 100, color: "#EBE6DD", margin: 0 }}>1919</h1>
      </div>
      <div style={{ backgroundColor: "#F2B824", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 0, height: 0, borderLeft: "80px solid transparent", borderRight: "80px solid transparent", borderBottom: "160px solid #1A1A1A" }} />
      </div>
      <div style={{ backgroundColor: "#1A1A1A", padding: 30 }}>
        <p style={{ fontFamily: "'Courier New', monospace", color: "#EBE6DD", fontSize: 24, margin: 0 }}>KONSTRUKTION<br />BAUHAUS WEIMAR</p>
      </div>
    </AbsoluteFill>
  );
};
export default BauhausDemo;

import { AbsoluteFill, useCurrentFrame } from "remotion";

export const PixelArcadeDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const charCount = Math.min(22, Math.floor(frame / 3));
  const fullText = "READY PLAYER ONE...";
  const typedText = fullText.slice(0, charCount);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0F0F1A", display: "flex", alignItems: "center", justifyContent: "center", imageRendering: "pixelated" }}>
      {/* Retro Dialogue Box */}
      <div
        style={{
          width: 700,
          border: "8px solid #FFF",
          backgroundColor: "#000",
          padding: 32,
          boxShadow: "10px 10px 0 #3B82F6",
        }}
      >
        <p style={{ fontFamily: "'Courier New', monospace", fontSize: 36, fontWeight: 900, color: "#22C55E", margin: 0, letterSpacing: 2 }}>
          {typedText}
          {frame % 16 < 8 && "█"}
        </p>
      </div>
    </AbsoluteFill>
  );
};
export default PixelArcadeDemo;

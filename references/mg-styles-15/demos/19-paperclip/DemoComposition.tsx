import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const PaperclipStickerDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const popSpr = spring({ frame, fps, config: { damping: 10, stiffness: 140 } });
  const scale = interpolate(popSpr, [0, 1], [0.4, 1.0]);
  const rot = interpolate(popSpr, [0, 1], [-20, -4]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#F7F5EE", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* Yellow Highlighter Underline */}
      <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", bottom: 8, left: -20, right: -20, height: 32, backgroundColor: "rgba(255, 230, 0, 0.75)", transform: "rotate(-1deg)", zIndex: 1 }} />
        
        {/* Sticker Card */}
        <div
          style={{
            transform: `scale(${scale}) rotate(${rot}deg)`,
            background: "#FFF",
            padding: "24px 36px",
            border: "4px solid #1A1A1A",
            borderRadius: 16,
            boxShadow: "8px 12px 0 rgba(0,0,0,0.15)",
            zIndex: 2,
          }}
        >
          <h2 style={{ fontFamily: "Inter, sans-serif", fontSize: 48, fontWeight: 900, color: "#1A1A1A", margin: 0 }}>
            STICKER EXPLAINER
          </h2>
        </div>
      </div>
    </AbsoluteFill>
  );
};
export default PaperclipStickerDemo;

import { AbsoluteFill, useCurrentFrame } from "remotion";

export const CelBoilDemo: React.FC = () => {
  const frame = useCurrentFrame();
  // Quantized 12fps line boil frame index
  const boilStep = Math.floor(frame / 2.5) % 3;
  const offsets = [0, 2.5, -2.5];
  const rotOffsets = [0, 1.2, -1.0];

  return (
    <AbsoluteFill style={{ backgroundColor: "#F9F6F0", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg
        viewBox="0 0 600 600"
        style={{
          width: 500,
          height: 500,
          transform: `translate(${offsets[boilStep]}px, ${offsets[(boilStep + 1) % 3]}px) rotate(${rotOffsets[boilStep]}deg)`,
        }}
      >
        <circle cx="300" cy="300" r="180" fill="#FF4A3D" stroke="#1A1A1A" strokeWidth="8" />
        <path d="M 220 260 Q 250 220 280 260" stroke="#1A1A1A" strokeWidth="8" fill="none" strokeLinecap="round" />
        <path d="M 320 260 Q 350 220 380 260" stroke="#1A1A1A" strokeWidth="8" fill="none" strokeLinecap="round" />
        <path d="M 240 340 Q 300 400 360 340" stroke="#1A1A1A" strokeWidth="10" fill="none" strokeLinecap="round" />
      </svg>
    </AbsoluteFill>
  );
};
export default CelBoilDemo;

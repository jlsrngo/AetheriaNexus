import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const LineArtDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Draw-on progress of technical lines (0 -> 100%)
  const drawSpr = spring({ frame, fps, config: { damping: 15, stiffness: 70 } });
  const strokeDash = interpolate(drawSpr, [0, 1], [1000, 0]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0C131F", overflow: "hidden" }}>
      {/* Blueprint Grid */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.25 }}>
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#2563EB" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Technical Monoline Geometry Tracing */}
      <svg viewBox="0 0 1000 1000" style={{ position: "absolute", left: "50%", top: "50%", width: 700, height: 700, transform: "translate(-50%, -50%)" }}>
        <circle cx="500" cy="500" r="320" fill="none" stroke="#38BDF8" strokeWidth="2.5" strokeDasharray="2010" strokeDashoffset={strokeDash} />
        <rect x="250" y="250" width="500" height="500" fill="none" stroke="#60A5FA" strokeWidth="2" strokeDasharray="2000" strokeDashoffset={strokeDash} />
        <polygon points="500,150 850,750 150,750" fill="none" stroke="#F43F5E" strokeWidth="2.5" strokeDasharray="2400" strokeDashoffset={strokeDash} />
        <line x1="150" y1="500" x2="850" y2="500" stroke="#FBBF24" strokeWidth="1.5" strokeDasharray="6 6" />
      </svg>
    </AbsoluteFill>
  );
};
export default LineArtDemo;

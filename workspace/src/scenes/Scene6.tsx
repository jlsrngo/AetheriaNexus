import { ReactElement } from "react";
import { SCENE_DURATIONS, COLORS, easing, interpolateClamped, u, WordTiming, VIDEO_CONFIG } from "../types";
import {
  Circle,
  Rect,
  Path,
  Text,
  Line,
  KineticSubtitles,
} from "./FlatVectorPrimitives";

interface Scene6Props {
  frame: number;
  words?: WordTiming[];
}

export function Scene6({ frame, words }: Scene6Props) {
  const duration = SCENE_DURATIONS.scene6;

  // Scene phases
  const PHASE_QUESTION = 0;       // 0-150: Siapa penemu listrik?
  const PHASE_CITY_DAWN = 150;     // 150-400: Kota mulai gemerlap cahaya
  const PHASE_SWITCH_FLIP = 400;   // 400-550: Sakelar modern ditekan
  const PHASE_FINAL_GLOW = 550;    // 550-end: Cahaya hangat penuh

  // City Lights progression
  const cityGlowProgress = Math.max(0, Math.min(1, (frame - PHASE_CITY_DAWN) / 200));
  const cityGlowEased = easing.easeInOutCubic(cityGlowProgress);

  // Switch Animation
  const switchProgress = Math.max(0, Math.min(1, (frame - PHASE_SWITCH_FLIP) / 40));
  const switchToggled = switchProgress >= 0.5;

  // Final Warm Glow
  const finalGlowProgress = Math.max(0, Math.min(1, (frame - PHASE_FINAL_GLOW) / 100));
  const finalGlowEased = easing.easeOutExpo(finalGlowProgress);

  // Skyline buildings
  const buildings: ReactElement[] = [];
  const bData = [
    { x: u(50), w: u(140), h: u(480), windows: 16 },
    { x: u(210), w: u(180), h: u(680), windows: 28 },
    { x: u(410), w: u(160), h: u(550), windows: 20 },
    { x: u(590), w: u(220), h: u(750), windows: 36 },
    { x: u(830), w: u(200), h: u(600), windows: 24 },
  ];

  bData.forEach((b, idx) => {
    buildings.push(
      <g key={idx}>
        <Rect
          x={b.x}
          y={VIDEO_CONFIG.height * 0.7 - b.h * 0.5}
          width={b.w}
          height={b.h * 0.6}
          rx={u(6)}
          fill={COLORS.darkCityAccent}
          stroke={COLORS.mint}
          strokeWidth={u(1.5)}
          opacity={0.9}
        />
        {/* Windows glowing with cityGlowEased */}
        {Array.from({ length: b.windows }).map((_, wIdx) => {
          const wx = b.x + u(16) + (wIdx % 4) * u(28);
          const wy = VIDEO_CONFIG.height * 0.7 - b.h * 0.5 + u(20) + Math.floor(wIdx / 4) * u(32);
          const winLit = (idx + wIdx) % 3 !== 0;
          return (
            <Rect
              key={wIdx}
              x={wx}
              y={wy}
              width={u(18)}
              height={u(20)}
              rx={u(3)}
              fill={winLit && cityGlowEased > 0.3 ? COLORS.modernCityLight : COLORS.darkCity}
              opacity={winLit ? cityGlowEased : 0.2}
            />
          );
        })}
      </g>
    );
  });

  return (
    <g>
      {/* Background */}
      <Rect
        x={0}
        y={0}
        width={VIDEO_CONFIG.width}
        height={VIDEO_CONFIG.height}
        fill={COLORS.darkCity}
      />

      {/* Modern Skyline Buildings */}
      {buildings}

      {/* Switch Component - Zone 2 / Center */}
      <g transform={`translate(${VIDEO_CONFIG.width / 2}, ${VIDEO_CONFIG.height * 0.36})`}>
        {/* Switch Plate */}
        <Rect
          x={-u(110)}
          y={-u(160)}
          width={u(220)}
          height={u(320)}
          rx={u(24)}
          fill={COLORS.cream}
          stroke={COLORS.ink}
          strokeWidth={u(6)}
        />
        {/* Switch Toggle Rocker */}
        <Rect
          x={-u(50)}
          y={-u(90)}
          width={u(100)}
          height={u(180)}
          rx={u(12)}
          fill={switchToggled ? COLORS.sunflower : COLORS.switchOff}
        />
        <Circle
          cx={0}
          cy={switchToggled ? u(30) : -u(30)}
          r={u(24)}
          fill={switchToggled ? COLORS.cream : "#555"}
        />
      </g>

      {/* Warm Ambient Aura when switched on */}
      {switchToggled && (
        <Circle
          cx={VIDEO_CONFIG.width / 2}
          cy={VIDEO_CONFIG.height * 0.36}
          r={u(450) * finalGlowEased + u(100)}
          fill={COLORS.sunflower}
          opacity={0.25 * finalGlowEased + 0.1}
        />
      )}

      {/* Headline Plaque - Zone 4 */}
      <g transform={`translate(${VIDEO_CONFIG.width / 2}, 1200)`}>
        <Rect
          x={-u(460)}
          y={-u(60)}
          width={u(920)}
          height={u(130)}
          rx={u(12)}
          fill={COLORS.ink}
          stroke={COLORS.sunflower}
          strokeWidth={u(4)}
        />
        <Text
          x={0}
          y={-u(10)}
          children="CAHAYA RIBUAN TAHUN"
          fontSize={u(52)}
          fontWeight="900"
          fill={COLORS.sunflower}
          textAnchor="middle"
        />
        <Text
          x={0}
          y={u(40)}
          children="HASIL PERJALANAN PENEMUAN UMAT MANUSIA"
          fontSize={u(20)}
          fontWeight="700"
          fill={COLORS.cream}
          textAnchor="middle"
        />
      </g>

      {/* Kinetic Subtitles - Zone 5 */}
      {words && words.length > 0 && (
        <KineticSubtitles
          words={words}
          frame={frame}
          y={1620}
          fontSize={u(56)}
          activeColor={COLORS.sunflower}
          inactiveColor={COLORS.cream}
        />
      )}
    </g>
  );
}
export default Scene6;


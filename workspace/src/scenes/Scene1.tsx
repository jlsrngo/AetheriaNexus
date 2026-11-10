import { ReactElement } from "react";
import { useCurrentFrame } from "remotion";
import { SCENE_DURATIONS, COLORS, easing, interpolateClamped, u, WordTiming, VIDEO_CONFIG } from "../types";
import {
  Circle,
  Rect,
  Path,
  Text,
  Building,
  Spark,
  ParticleBurst,
  KineticSubtitles,
  FlashTransition,
} from "./FlatVectorPrimitives";

interface Scene1Props {
  frame: number;
  words?: WordTiming[];
}

export function Scene1({ frame, words }: Scene1Props) {
  const duration = SCENE_DURATIONS.scene1;
  const progress = frame / duration;
  
  // Scene phases (in frames)
  const PHASE_SWITCH = 0;       // 0-15: Black screen, switch click
  const PHASE_CITY_REVEAL = 15; // 15-120: City buildings rise
  const PHASE_HOLD = 120;       // 120-end: Hold with subtle motion
  
  // ============ BACKGROUND ============
  // Pure black at start, then dark city gradient
  const bgOpacity = frame < PHASE_CITY_REVEAL ? 1 : 1;
  const bgColor = frame < PHASE_CITY_REVEAL ? COLORS.ink : COLORS.darkCity;
  
  // ============ SWITCH ANIMATION (Phase 0-15) ============
  const switchProgress = Math.max(0, Math.min(1, frame / 15));
  const switchEased = easing.easeInOutCubic(switchProgress);
  
  const switchX = VIDEO_CONFIG.width / 2;
  const switchY = VIDEO_CONFIG.height * 0.35;
  const toggleAngle = interpolateClamped(switchEased, [0, 1], [-30, 30]); // degrees
  const toggleGlow = switchProgress > 0.5 ? (switchProgress - 0.5) * 2 : 0;
  
  // ============ CITY BUILDINGS (Phase 15+) ============
  const cityProgress = Math.max(0, Math.min(1, (frame - PHASE_CITY_REVEAL) / 100));
  const cityEased = easing.easeOutBack(cityProgress);
  
  // Building data: x, width, height, windows, delay
  const buildings = [
    { x: u(50), width: u(120), height: u(600), windows: 12, delay: 0 },
    { x: u(200), width: u(100), height: u(700), windows: 14, delay: 2 },
    { x: u(330), width: u(140), height: u(550), windows: 10, delay: 4 },
    { x: u(500), width: u(110), height: u(650), windows: 12, delay: 6 },
    { x: u(640), width: u(130), height: u(750), windows: 16, delay: 8 },
    { x: u(800), width: u(100), height: u(500), windows: 8, delay: 10 },
    { x: u(920), width: u(110), height: u(600), windows: 10, delay: 12 },
  ];
  
  // ============ AMBIENT PARTICLES (dust motes) ============
  const dustParticles: ReactElement[] = [];
  if (frame > PHASE_CITY_REVEAL + 50) {
    for (let i = 0; i < 15; i++) {
      const seed = i * 17.3;
      const speed = 0.02 + (Math.sin(seed) * 0.5 + 0.5) * 0.03;
      const y = (VIDEO_CONFIG.height * 0.6 + Math.sin(frame * speed + seed) * u(200)) % VIDEO_CONFIG.height;
      const x = (Math.sin(seed * 2) * 0.5 + 0.5) * VIDEO_CONFIG.width;
      const opacity = (Math.sin(seed * 3) * 0.5 + 0.5) * 0.3;
      const size = u(2) + (Math.sin(seed * 5) * 0.5 + 0.5) * u(3);
      
      dustParticles.push(
        <circle
          key={i}
          cx={x}
          cy={y}
          r={size}
          fill={COLORS.cream}
          opacity={opacity}
        />
      );
    }
  }
  
  // ============ HEADLINE PLAQUE (Zone 4) ============
  const headlineProgress = Math.max(0, Math.min(1, (frame - PHASE_CITY_REVEAL - 60) / 40));
  const headlineEased = easing.easeOutBack(headlineProgress);
  const headlineY = interpolateClamped(headlineEased, [0, 1], [1500, 1240]); // Zone 4
  const headlineOpacity = headlineEased;
  const headlineScale = interpolateClamped(headlineEased, [0, 1], [0.7, 1]);
  
  // ============ SUBTITLES (Zone 5) ============
  
  return (
    <g>
      {/* Background */}
      <rect
        x={0}
        y={0}
        width={VIDEO_CONFIG.width}
        height={VIDEO_CONFIG.height}
        fill={bgColor}
        opacity={bgOpacity}
      />
      
      {/* Flash transition at scene start */}
      <FlashTransition frame={frame} triggerFrame={0} duration={3} color={COLORS.cream} />
      
      {/* Switch - Zone 2 area */}
      {frame <= 30 && (
        <g transform={`translate(${switchX}, ${switchY})`}>
          {/* Switch plate */}
          <Rect
            x={-u(80)}
            y={-u(80)}
            width={u(160)}
            height={u(160)}
            rx={u(20)}
            fill={COLORS.darkCityAccent}
            stroke={COLORS.switchOff}
            strokeWidth={u(3)}
          />
          
          {/* Switch toggle */}
          <g transform={`rotate(${toggleAngle})`}>
            <Rect
              x={-u(30)}
              y={-u(60)}
              width={u(60)}
              height={u(120)}
              rx={u(10)}
              fill={toggleGlow > 0 ? COLORS.switchOn : COLORS.switchOff}
              opacity={0.8 + toggleGlow * 0.2}
            />
            
            {/* Glow effect when flipped */}
            {toggleGlow > 0 && (
              <Circle
                cx={0}
                cy={0}
                r={u(50) + toggleGlow * u(30)}
                fill="none"
                stroke={COLORS.sunflower}
                strokeWidth={u(2)}
                opacity={toggleGlow * (1 - switchProgress)}
              />
            )}
            
            {/* Spark particles on flip */}
            {switchProgress > 0.4 && switchProgress < 0.8 && (
              <ParticleBurst
                x={0}
                y={0}
                frame={frame}
                startFrame={6}
                duration={10}
                count={8}
                color={COLORS.sunflower}
                spread={u(60)}
              />
            )}
          </g>
          
          {/* "KLIK" text */}
          {switchProgress > 0.5 && (
            <Text
              x={0}
              y={u(100)}
              children="KLIK"
              fontSize={u(28)}
              fontWeight="900"
              fill={COLORS.sunflower}
              opacity={(switchProgress - 0.5) * 2}
              textAnchor="middle"
            />
          )}
        </g>
      )}
      
      {/* City Buildings - Zone 1 & 2 */}
      {frame > PHASE_CITY_REVEAL && (
        <g transform={`translate(0, ${VIDEO_CONFIG.height * 0.75})`}>
          {buildings.map((b, i) => (
            <Building
              key={i}
              x={b.x}
              y={0}
              width={b.width}
              height={b.height}
              windows={b.windows}
              fill={COLORS.darkCity}
              frame={frame - PHASE_CITY_REVEAL - b.delay * 2}
              animDelay={0}
            />
          ))}
          
          {/* Ground line */}
          <Rect
            x={0}
            y={u(20)}
            width={VIDEO_CONFIG.width}
            height={u(6)}
            fill={COLORS.darkCityAccent}
            opacity={cityEased}
          />
          
          {/* Window glow reflections on ground */}
          {cityProgress > 0.7 && (
            <g opacity={(cityProgress - 0.7) / 0.3 * 0.3}>
              {buildings.map((b, i) => (
                <Rect
                  key={`glow-${i}`}
                  x={b.x + b.width * 0.2}
                  y={u(30)}
                  width={b.width * 0.6}
                  height={u(40)}
                  fill={COLORS.cream}
                  opacity={0.1}
                  rx={u(5)}
                />
              ))}
            </g>
          )}
        </g>
      )}
      
      {/* Dust motes */}
      {dustParticles}
      
      {/* Headline Plaque - Zone 4 */}
      {frame > PHASE_CITY_REVEAL + 60 && (
        <g
          transform={`translate(${VIDEO_CONFIG.width / 2}, ${headlineY}) scale(${headlineScale})`}
          opacity={headlineOpacity}
        >
          {/* Plaque background */}
          <Rect
            x={-u(450)}
            y={-u(60)}
            width={u(900)}
            height={u(120)}
            rx={u(8)}
            fill={COLORS.ink}
            stroke={COLORS.sunflower}
            strokeWidth={u(4)}
          />
          
          {/* Shadow */}
          <Rect
            x={-u(450) + u(8)}
            y={-u(60) + u(8)}
            width={u(900)}
            height={u(120)}
            rx={u(8)}
            fill={COLORS.ink}
            opacity={0.4}
          />
          
          {/* Headline text */}
          <Text
            x={0}
            y={-u(10)}
            children="TANPA LISTRIK"
            fontSize={u(52)}
            fontWeight="900"
            fill={COLORS.sunflower}
            textAnchor="middle"
          />
          <Text
            x={0}
            y={u(40)}
            children="MANUSIA HIDUP SELAMA RIBUAN TAHUN"
            fontSize={u(24)}
            fontWeight="600"
            fill={COLORS.cream}
            textAnchor="middle"
            opacity={0.9}
          />
        </g>
      )}
      
      {/* Kinetic Subtitles - Zone 5 */}
      {words && words.length > 0 && (
        <KineticSubtitles
          words={words}
          frame={frame}
          y={1620}
          fontSize={u(58)}
          activeColor={COLORS.sunflower}
          inactiveColor={COLORS.cream}
        />
      )}
    </g>
  );
}
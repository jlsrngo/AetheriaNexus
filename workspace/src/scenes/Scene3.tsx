import { ReactElement } from "react";
import { useCurrentFrame } from "remotion";
import { SCENE_DURATIONS, COLORS, easing, interpolateClamped, u, WordTiming, VIDEO_CONFIG } from "../types";
import {
  Circle,
  Rect,
  Path,
  Text,
  Polygon,
  Line,
  Spark,
  ParticleBurst,
  KineticSubtitles,
  FlashTransition,
  generateLightningPath,
} from "./FlatVectorPrimitives";

interface Scene3Props {
  frame: number;
  words?: WordTiming[];
}

export function Scene3({ frame, words }: Scene3Props) {
  const duration = SCENE_DURATIONS.scene3;
  const progress = frame / duration;
  
  // Scene phases
  const PHASE_STORM_BUILD = 0;      // 0-120: Storm clouds gather
  const PHASE_KITE_RISE = 120;      // 120-280: Kite rises into storm
  const PHASE_LIGHTNING_STRIKE = 280; // 280-380: Lightning strikes key
  const PHASE_REALIZATION = 380;    // 380-550: Franklin realizes connection
  const PHASE_LEGACY = 550;         // 550-end: Legacy text
  
  // ============ STORM CLOUDS ============
  const stormProgress = Math.max(0, Math.min(1, frame / 120));
  const stormEased = easing.easeInOutCubic(stormProgress);
  
  // Cloud layers
  const clouds: ReactElement[] = [];
  const cloudData = [
    { x: u(100), y: u(150), width: u(300), height: u(120), speed: 0.008, baseOpacity: 0.8 },
    { x: u(450), y: u(100), width: u(400), height: u(150), speed: 0.005, baseOpacity: 0.9 },
    { x: u(800), y: u(180), width: u(250), height: u(100), speed: 0.01, baseOpacity: 0.7 },
    { x: u(200), y: u(300), width: u(350), height: u(130), speed: 0.006, baseOpacity: 0.75 },
    { x: u(650), y: u(280), width: u(300), height: u(110), speed: 0.007, baseOpacity: 0.85 },
  ];
  
  cloudData.forEach((c, i) => {
    const driftX = c.x + Math.sin(frame * c.speed + i) * u(30);
    const cloudProgress = Math.max(0, Math.min(1, (frame - i * 15) / 100));
    const cloudEased = easing.easeOutCubic(cloudProgress);
    const opacity = c.baseOpacity * cloudEased * stormEased;
    
    clouds.push(
      <g key={i} transform={`translate(${driftX}, ${c.y}) scale(${cloudEased})`} opacity={opacity}>
        {/* Cloud blob 1 */}
        <Circle cx={0} cy={0} r={c.width * 0.25} fill={COLORS.stormCloud} />
        <Circle cx={c.width * 0.2} cy={-c.height * 0.1} r={c.width * 0.22} fill={COLORS.stormCloud} />
        <Circle cx={-c.width * 0.15} cy={-c.height * 0.05} r={c.width * 0.2} fill={COLORS.stormCloud} />
        <Circle cx={c.width * 0.35} cy={c.height * 0.05} r={c.width * 0.18} fill={COLORS.stormCloud} />
        <Circle cx={-c.width * 0.3} cy={c.height * 0.1} r={c.width * 0.16} fill={COLORS.stormCloud} />
        {/* Highlight */}
        <Circle cx={-c.width * 0.1} cy={-c.height * 0.15} r={c.width * 0.12} fill={COLORS.stormCloudLight} opacity={0.3} />
      </g>
    );
  });
  
  // ============ RAIN ============
  const rain: ReactElement[] = [];
  if (frame > PHASE_STORM_BUILD + 60) {
    for (let i = 0; i < 30; i++) {
      const seed = i * 13.7;
      const rainX = (Math.sin(seed) * 0.5 + 0.5) * VIDEO_CONFIG.width;
      const rainSpeed = 15 + (Math.sin(seed * 2) * 0.5 + 0.5) * 10;
      const rainY = ((frame - 180) * rainSpeed + Math.sin(seed * 3) * 500) % (VIDEO_CONFIG.height + 200) - 100;
      const rainLen = u(15) + (Math.sin(seed * 4) * 0.5 + 0.5) * u(10);
      
      rain.push(
        <Line
          key={i}
          x1={rainX}
          y1={rainY}
          x2={rainX - u(3)}
          y2={rainY + rainLen}
          stroke={COLORS.lightning}
          strokeWidth={u(1.5)}
          opacity={0.4}
        />
      );
    }
  }
  
  // ============ FRANKLIN FIGURE ============
  const franklinProgress = Math.max(0, Math.min(1, (frame - PHASE_KITE_RISE) / 160));
  const franklinEased = easing.easeOutBack(franklinProgress);
  
  const franklinX = VIDEO_CONFIG.width * 0.2;
  const franklinY = interpolateClamped(franklinEased, [0, 1], [VIDEO_CONFIG.height * 0.9, VIDEO_CONFIG.height * 0.6]);
  const franklinScale = franklinEased;
  
  // ============ KITE ============
  const kiteProgress = Math.max(0, Math.min(1, (frame - PHASE_KITE_RISE) / 160));
  const kiteEased = easing.easeOutCubic(kiteProgress);
  
  const kiteX = VIDEO_CONFIG.width * 0.7;
  const kiteY = interpolateClamped(kiteEased, [0, 1], [VIDEO_CONFIG.height * 0.8, VIDEO_CONFIG.height * 0.25]);
  const kiteAngle = Math.sin(frame * 0.02) * 8;
  const kiteString = kiteEased > 0 ? `M ${franklinX + u(30)} ${franklinY - u(40)} Q ${VIDEO_CONFIG.width * 0.45} ${VIDEO_CONFIG.height * 0.4} ${kiteX} ${kiteY}` : "";
  
  // ============ LIGHTNING STRIKE ============
  const lightningProgress = Math.max(0, Math.min(1, (frame - PHASE_LIGHTNING_STRIKE) / 100));
  const lightningEased = easing.easeOutExpo(lightningProgress);
  
  // Main bolt
  const lightningPath = generateLightningPath(
    kiteX, kiteY - u(30),
    kiteX + (Math.random() - 0.5) * u(40), kiteY - u(200),
    10, u(25), frame
  );
  
  // Branches
  const branches: ReactElement[] = [];
  if (frame >= PHASE_LIGHTNING_STRIKE && frame < PHASE_LIGHTNING_STRIKE + 8) {
    for (let b = 0; b < 4; b++) {
      const branchPath = generateLightningPath(
        kiteX + (b - 1.5) * u(20), kiteY - u(80) - b * u(30),
        kiteX + (b - 1.5) * u(20) + (Math.random() - 0.5) * u(80), kiteY - u(150) - b * u(30),
        6, u(15), frame + b * 100
      );
      branches.push(
        <Path
          key={b}
          d={branchPath}
          stroke={COLORS.lightning}
          strokeWidth={u(2)}
          opacity={1 - (frame - PHASE_LIGHTNING_STRIKE) / 8}
          fill="none"
        />
      );
    }
  }
  
  // ============ KEY ON STRING ============
  const keyProgress = Math.max(0, Math.min(1, (frame - PHASE_LIGHTNING_STRIKE) / 100));
  const keyY = interpolateClamped(keyProgress, [0, 1], [kiteY + u(60), kiteY + u(120)]);
  const keyGlow = frame >= PHASE_LIGHTNING_STRIKE && frame < PHASE_LIGHTNING_STRIKE + 15 
    ? Math.sin((frame - PHASE_LIGHTNING_STRIKE) * 0.5) * 0.5 + 0.5 
    : 0;
  
  // ============ SPARKS AT KEY ============
  const keySparks: ReactElement[] = [];
  if (frame >= PHASE_LIGHTNING_STRIKE && frame < PHASE_LIGHTNING_STRIKE + 30) {
    for (let i = 0; i < 12; i++) {
      keySparks.push(
        <Spark
          key={i}
          x={kiteX}
          y={keyY}
          frame={frame}
          startFrame={PHASE_LIGHTNING_STRIKE + i * 2}
          duration={15}
          color={COLORS.lightning}
          size={u(5)}
        />
      );
    }
  }
  
  // ============ FLASH OVERLAY ============
  const flashOpacity = frame >= PHASE_LIGHTNING_STRIKE && frame < PHASE_LIGHTNING_STRIKE + 3
    ? 1 - (frame - PHASE_LIGHTNING_STRIKE) / 3
    : 0;
  
  // ============ REALIZATION PHASE ============
  const realizationProgress = Math.max(0, Math.min(1, (frame - PHASE_REALIZATION) / 170));
  const realizationEased = easing.easeOutCubic(realizationProgress);
  
  // Connection lines between sky and ground
  const connectionLines: ReactElement[] = [];
  if (frame > PHASE_REALIZATION) {
    for (let i = 0; i < 6; i++) {
      const lineProgress = Math.max(0, Math.min(1, realizationProgress - i * 0.1));
      if (lineProgress > 0) {
        connectionLines.push(
          <Line
            key={i}
            x1={VIDEO_CONFIG.width * 0.1 + i * u(150)}
            y1={VIDEO_CONFIG.height * 0.2}
            x2={VIDEO_CONFIG.width * 0.1 + i * u(150)}
            y2={VIDEO_CONFIG.height * 0.85}
            stroke={COLORS.lightning}
            strokeWidth={u(1)}
            opacity={lineProgress * 0.3}
            strokeDasharray="10,10"
            strokeDashoffset={frame * 2}
          />
        );
      }
    }
  }
  
  // ============ HEADLINE (Zone 4) ============
  const headlineProgress = Math.max(0, Math.min(1, (frame - PHASE_LEGACY + 50) / 60));
  const headlineEased = easing.easeOutBack(headlineProgress);
  const headlineY = interpolateClamped(headlineEased, [0, 1], [1500, 1240]);
  const headlineOpacity = headlineEased;
  const headlineScale = interpolateClamped(headlineEased, [0, 1], [0.7, 1]);
  
  return (
    <g>
      {/* Background - storm gradient */}
      <defs>
        <linearGradient id="scene3-bg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0A0A1A" />
          <stop offset="40%" stopColor="#151433" />
          <stop offset="100%" stopColor="#1E1E3A" />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={VIDEO_CONFIG.width} height={VIDEO_CONFIG.height} fill="url(#scene3-bg)" />
      
      {/* Flash transition at scene start */}
      <FlashTransition frame={frame} triggerFrame={0} duration={3} color={COLORS.lightning} />
      
      {/* Storm clouds */}
      <g>{clouds}</g>
      
      {/* Rain */}
      {rain}
      
      {/* Connection lines (realization phase) */}
      {connectionLines}
      
      {/* Franklin figure */}
      {frame >= PHASE_KITE_RISE && (
        <g transform={`translate(${franklinX}, ${franklinY}) scale(${franklinScale})`}>
          {/* Body */}
          <Path
            d={`M ${-u(30)} ${u(80)} L ${-u(25)} ${-u(40)} Q ${0} ${-u(60)} ${u(25)} ${-u(40)} L ${u(30)} ${u(80)} Z`}
            fill={COLORS.cream}
            opacity={0.8}
          />
          {/* Head */}
          <Circle cx={0} cy={-u(60)} r={u(25)} fill={COLORS.cream} opacity={0.8} />
          {/* Hair */}
          <Path
            d={`M ${-u(25)} ${-u(70)} Q ${-u(35)} ${-u(80)} ${-u(30)} ${-u(90)} M ${u(25)} ${-u(70)} Q ${u(35)} ${-u(80)} ${u(30)} ${-u(90)}`}
            stroke={COLORS.ink}
            strokeWidth={u(3)}
            fill="none"
            opacity={0.8}
          />
          {/* Coat tails */}
          <Path
            d={`M ${-u(30)} ${u(80)} L ${-u(45)} ${u(120)} M ${u(30)} ${u(80)} L ${u(45)} ${u(120)}`}
            stroke={COLORS.cream}
            strokeWidth={u(6)}
            fill="none"
            opacity={0.8}
            strokeLinecap="round"
          />
          {/* Hand holding string */}
          <Circle cx={u(35)} cy={-u(10)} r={u(10)} fill={COLORS.cream} opacity={0.8} />
          <Line x1={u(35)} y1={-u(10)} x2={u(35)} y2={u(30)} stroke={COLORS.cream} strokeWidth={u(4)} opacity={0.8} />
        </g>
      )}
      
      {/* Kite string */}
      {frame >= PHASE_KITE_RISE && kiteString && (
        <Path
          d={kiteString}
          stroke={COLORS.cream}
          strokeWidth={u(1.5)}
          opacity={0.6}
          fill="none"
          strokeDasharray="5,5"
          strokeDashoffset={frame * 0.5}
        />
      )}
      
      {/* Kite */}
      {frame >= PHASE_KITE_RISE && (
        <g transform={`translate(${kiteX}, ${kiteY}) rotate(${kiteAngle}) scale(${kiteEased})`}>
          {/* Kite frame */}
          <Polygon
            points={`0,${-u(50)} ${u(40)},${0} 0,${u(50)} ${-u(40)},${0}`}
            fill="none"
            stroke={COLORS.cream}
            strokeWidth={u(3)}
            opacity={0.8}
          />
          {/* Kite cross spars */}
          <Line x1={-u(40)} y1={0} x2={u(40)} y2={0} stroke={COLORS.cream} strokeWidth={u(2)} opacity={0.8} />
          <Line x1={0} y1={-u(50)} x2={0} y2={u(50)} stroke={COLORS.cream} strokeWidth={u(2)} opacity={0.8} />
          {/* Kite fabric */}
          <Polygon
            points={`0,${-u(50)} ${u(40)},${0} 0,${u(50)} ${-u(40)},${0}`}
            fill={COLORS.cream}
            opacity={0.2}
          />
          {/* Tail */}
          <Path
            d={`M 0 ${u(50)} Q ${u(10)} ${u(80)} ${-u(10)} ${u(110)} Q ${u(15)} ${u(140)} ${-u(5)} ${u(170)}`}
            stroke={COLORS.cream}
            strokeWidth={u(2)}
            fill="none"
            opacity={0.6}
          />
          {/* Tail bows */}
          {[-1, 1].map((side, idx) => (
            <Polygon
              key={idx}
              points={`${side * u(10)},${u(80)} ${side * u(20)},${u(70)} ${side * u(30)},${u(80)} ${side * u(20)},${u(90)}`}
              fill={COLORS.coral}
              opacity={0.8}
            />
          ))}
        </g>
      )}
      
      {/* Key on string */}
      {frame >= PHASE_KITE_RISE && (
        <g transform={`translate(${kiteX}, ${keyY})`} opacity={kiteEased}>
          {/* Key ring */}
          <Circle cx={0} cy={0} r={u(12)} fill="none" stroke={COLORS.voltaicZinc} strokeWidth={u(3)} opacity={0.8} />
          {/* Key teeth */}
          <Rect x={-u(4)} y={u(12)} width={u(8)} height={u(20)} fill={COLORS.voltaicZinc} opacity={0.8} rx={u(1)} />
          <Rect x={-u(8)} y={u(22)} width={u(16)} height={u(6)} fill={COLORS.voltaicZinc} opacity={0.8} rx={u(1)} />
          <Rect x={-u(4)} y={u(28)} width={u(8)} height={u(6)} fill={COLORS.voltaicZinc} opacity={0.8} rx={u(1)} />
          {/* Glow */}
          {keyGlow > 0 && (
            <Circle
              cx={0}
              cy={u(10)}
              r={u(30) + keyGlow * u(20)}
              fill="none"
              stroke={COLORS.lightning}
              strokeWidth={u(2)}
              opacity={keyGlow * 0.8}
            />
          )}
        </g>
      )}
      
      {/* Lightning strike */}
      {frame >= PHASE_LIGHTNING_STRIKE && frame < PHASE_LIGHTNING_STRIKE + 100 && (
        <g>
          {/* Main bolt */}
          <Path
            d={lightningPath}
            stroke={COLORS.lightning}
            strokeWidth={u(4)}
            opacity={lightningEased > 0.5 ? (1 - lightningEased) * 2 : lightningEased * 2}
            fill="none"
            filter="drop-shadow(0 0 20px #FFFFFF)"
          />
          {/* Bolt core */}
          <Path
            d={lightningPath}
            stroke={COLORS.lightning}
            strokeWidth={u(1)}
            opacity={1}
            fill="none"
          />
          {/* Branches */}
          {branches}
          {/* Key sparks */}
          {keySparks}
        </g>
      )}
      
      {/* Screen flash on lightning */}
      {flashOpacity > 0 && (
        <rect
          x={0}
          y={0}
          width={VIDEO_CONFIG.width}
          height={VIDEO_CONFIG.height}
          fill={COLORS.lightning}
          opacity={flashOpacity}
        />
      )}
      
      {/* Year marker */}
      {frame > PHASE_LIGHTNING_STRIKE + 50 && (
        <Text
          x={VIDEO_CONFIG.width - u(60)}
          y={u(80)}
          children="1752"
          fontSize={u(36)}
          fontWeight="900"
          fill={COLORS.lightning}
          textAnchor="end"
          opacity={Math.min(1, (frame - PHASE_LIGHTNING_STRIKE - 50) / 30)}
        />
      )}
      
      {/* Headline Plaque - Zone 4 */}
      {frame > PHASE_LEGACY - 50 && (
        <g
          transform={`translate(${VIDEO_CONFIG.width / 2}, ${headlineY}) scale(${headlineScale})`}
          opacity={headlineOpacity}
        >
          <Rect
            x={-u(450)}
            y={-u(60)}
            width={u(900)}
            height={u(120)}
            rx={u(8)}
            fill={COLORS.ink}
            stroke={COLORS.lightning}
            strokeWidth={u(4)}
          />
          <Rect
            x={-u(450) + u(8)}
            y={-u(60) + u(8)}
            width={u(900)}
            height={u(120)}
            rx={u(8)}
            fill={COLORS.ink}
            opacity={0.4}
          />
          <Text
            x={0}
            y={-u(10)}
            children="PETIR = LISTRIK"
            fontSize={u(52)}
            fontWeight="900"
            fill={COLORS.lightning}
            textAnchor="middle"
          />
          <Text
            x={0}
            y={u(40)}
            children="BENJAMIN FRANKLIN MEMBUKTIHUBUNGANNYA 1752"
            fontSize={u(22)}
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
          activeColor={COLORS.lightning}
          inactiveColor={COLORS.cream}
        />
      )}
    </g>
  );
}
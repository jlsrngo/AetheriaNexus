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
} from "./FlatVectorPrimitives";

interface Scene4Props {
  frame: number;
  words?: WordTiming[];
}

export function Scene4({ frame, words }: Scene4Props) {
  const duration = SCENE_DURATIONS.scene4;
  const progress = frame / duration;
  
  // Scene phases
  const PHASE_LAB_SETUP = 0;       // 0-80: Lab table, materials appear
  const PHASE_PILE_BUILD = 80;     // 80-220: Voltaic pile builds up
  const PHASE_CURRENT_FLOW = 220;  // 220-400: Current flows continuously
  const PHASE_BREAKTHROUGH = 400;  // 400-end: Breakthrough moment
  
  // ============ BACKGROUND ============
  // Laboratory backdrop (Zone 1)
  const labTableY = VIDEO_CONFIG.height * 0.7;
  
  // ============ VOLTAIC PILE ============
  const pileCenterX = VIDEO_CONFIG.width / 2;
  const pileBaseY = labTableY - u(20);
  const numCells = 12; // Number of cell pairs
  const cellHeight = u(28);
  const cellWidth = u(100);
  const totalPileHeight = numCells * cellHeight * 2; // copper + zinc + separator
  
  // Pile build progress
  const buildProgress = Math.max(0, Math.min(1, (frame - PHASE_PILE_BUILD) / 140));
  const buildEased = easing.easeOutBack(buildProgress);
  const builtCells = Math.floor(numCells * buildEased);
  
  // Current flow animation (continuous)
  const currentPhase = (frame * 0.08) % (Math.PI * 2);
  
  // ============ VOLTA FIGURE ============
  const voltaProgress = Math.max(0, Math.min(1, (frame - PHASE_LAB_SETUP) / 100));
  const voltaEased = easing.easeOutBack(voltaProgress);
  
  const voltaX = VIDEO_CONFIG.width * 0.15;
  const voltaY = labTableY - u(100);
  
  // ============ WIRES & GALVANOMETER ============
  const wireProgress = Math.max(0, Math.min(1, (frame - PHASE_CURRENT_FLOW) / 180));
  const wireEased = easing.easeOutCubic(wireProgress);
  
  // Wire from top of pile to galvanometer
  const wireTopY = pileBaseY - builtCells * cellHeight * 2;
  const galvanometerX = VIDEO_CONFIG.width * 0.75;
  const galvanometerY = pileBaseY - totalPileHeight * 0.5;
  
  // ============ SPARKS AT GALVANOMETER ============
  const galvoSparks: ReactElement[] = [];
  if (frame > PHASE_CURRENT_FLOW + 50) {
    for (let i = 0; i < 8; i++) {
      const sparkFrame = frame - PHASE_CURRENT_FLOW - 50;
      const sparkStart = (i * 12) % 80;
      const sparkDur = 25;
      if (sparkFrame >= sparkStart && sparkFrame < sparkStart + sparkDur) {
        galvoSparks.push(
          <Spark
            key={i}
            x={galvanometerX}
            y={galvanometerY}
            frame={sparkFrame}
            startFrame={sparkStart}
            duration={sparkDur}
            color={COLORS.lightning}
            size={u(6)}
          />
        );
      }
    }
  }
  
  // ============ BREAKTHROUGH PARTICLES ============
  const breakthroughProgress = Math.max(0, Math.min(1, (frame - PHASE_BREAKTHROUGH) / 100));
  const breakthroughEased = easing.easeOutExpo(breakthroughProgress);
  const breakthroughParticles: ReactElement[] = [];
  
  if (frame > PHASE_BREAKTHROUGH) {
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const dist = breakthroughEased * u(150);
      breakthroughParticles.push(
        <Circle
          key={i}
          cx={pileCenterX + Math.cos(angle) * dist}
          cy={pileBaseY - totalPileHeight * 0.5 + Math.sin(angle) * dist}
          r={u(4) * (1 - breakthroughEased)}
          fill={COLORS.sunflower}
          opacity={1 - breakthroughEased}
        />
      );
    }
  }
  
  // ============ YEAR MARKER ============
  const yearProgress = Math.max(0, Math.min(1, (frame - PHASE_PILE_BUILD + 20) / 60));
  const yearEased = easing.easeOutBack(yearProgress);
  
  // ============ HEADLINE (Zone 4) ============
  const headlineProgress = Math.max(0, Math.min(1, (frame - PHASE_BREAKTHROUGH + 30) / 60));
  const headlineEased = easing.easeOutBack(headlineProgress);
  const headlineY = interpolateClamped(headlineEased, [0, 1], [1500, 1240]);
  const headlineOpacity = headlineEased;
  const headlineScale = interpolateClamped(headlineEased, [0, 1], [0.7, 1]);
  
  return (
    <g>
      {/* Background - lab gradient */}
      <defs>
        <linearGradient id="scene4-bg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1A152E" />
          <stop offset="50%" stopColor="#2D2040" />
          <stop offset="100%" stopColor="#1E1530" />
        </linearGradient>
        <linearGradient id="copper-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#D4A574" />
          <stop offset="50%" stopColor="#B87333" />
          <stop offset="100%" stopColor="#8B5A2B" />
        </linearGradient>
        <linearGradient id="zinc-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#E0E0E0" />
          <stop offset="50%" stopColor="#C0C0C0" />
          <stop offset="100%" stopColor="#A0A0A0" />
        </linearGradient>
        <linearGradient id="electrolyte-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#7FC97F" />
          <stop offset="100%" stopColor="#4A904A" />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={VIDEO_CONFIG.width} height={VIDEO_CONFIG.height} fill="url(#scene4-bg)" />
      
      {/* Flash transition at scene start */}
      <FlashTransition frame={frame} triggerFrame={0} duration={3} color={COLORS.voltaicCopper} />
      
      {/* Zone 1: Lab table backdrop */}
      <g transform={`translate(${VIDEO_CONFIG.width / 2}, ${labTableY + u(50)}) rotate(-3)`} opacity={0.15}>
        <Rect
          x={-u(380)}
          y={-u(100)}
          width={u(760)}
          height={u(200)}
          rx={u(8)}
          fill={COLORS.cream}
          stroke={COLORS.voltaicCopper}
          strokeWidth={u(2)}
        />
      </g>
      
      {/* Lab table */}
      <Rect
        x={u(80)}
        y={labTableY}
        width={VIDEO_CONFIG.width - u(160)}
        height={u(30)}
        fill={COLORS.darkCity}
        stroke={COLORS.voltaicZinc}
        strokeWidth={u(2)}
        rx={u(3)}
      />
      <Rect
        x={u(80)}
        y={labTableY - u(5)}
        width={VIDEO_CONFIG.width - u(160)}
        height={u(5)}
        fill={COLORS.voltaicCopper}
      />
      
      {/* Volta figure */}
      {frame >= PHASE_LAB_SETUP && (
        <g transform={`translate(${voltaX}, ${voltaY}) scale(${voltaEased})`} opacity={voltaEased}>
          {/* Body */}
          <Path
            d={`M ${-u(25)} ${u(80)} L ${-u(20)} ${-u(30)} Q ${0} ${-u(50)} ${u(20)} ${-u(30)} L ${u(25)} ${u(80)} Z`}
            fill={COLORS.cream}
            opacity={0.7}
          />
          {/* Head */}
          <Circle cx={0} cy={-u(50)} r={u(22)} fill={COLORS.cream} opacity={0.7} />
          {/* Hair */}
          <Path
            d={`M ${-u(22)} ${-u(60)} Q ${-u(32)} ${-u(70)} ${-u(27)} ${-u(80)} M ${u(22)} ${-u(60)} Q ${u(32)} ${-u(70)} ${u(27)} ${-u(80)}`}
            stroke={COLORS.ink}
            strokeWidth={u(2.5)}
            fill="none"
            opacity={0.7}
          />
          {/* Coat */}
          <Path
            d={`M ${-u(25)} ${u(80)} L ${-u(40)} ${u(120)} M ${u(25)} ${u(80)} L ${u(40)} ${u(120)}`}
            stroke={COLORS.cream}
            strokeWidth={u(5)}
            fill="none"
            opacity={0.7}
            strokeLinecap="round"
          />
          {/* Hand pointing at pile */}
          <Circle cx={u(40)} cy={u(10)} r={u(9)} fill={COLORS.cream} opacity={0.7} />
          <Line x1={u(40)} y1={u(10)} x2={pileCenterX - voltaX} y2={pileBaseY - u(100) - voltaY} stroke={COLORS.cream} strokeWidth={u(3)} opacity={0.5} strokeDasharray="5,5" />
        </g>
      )}
      
      {/* Voltaic Pile */}
      <g transform={`translate(${pileCenterX}, ${pileBaseY})`}>
        {/* Base */}
        <Rect
          x={-cellWidth / 2 - u(10)}
          y={u(10)}
          width={cellWidth + u(20)}
          height={u(15)}
          fill={COLORS.darkCity}
          stroke={COLORS.voltaicZinc}
          strokeWidth={u(2)}
          rx={u(3)}
        />
        
        {/* Cells */}
        {Array.from({ length: numCells }).map((_, cellIndex) => {
          const isBuilt = cellIndex < builtCells;
          if (!isBuilt) return null;
          
          const cellY = -cellIndex * cellHeight * 2;
          const cellProgress = Math.max(0, Math.min(1, buildProgress - cellIndex / numCells));
          const cellEased = easing.easeOutBack(cellProgress);
          const cellScale = cellEased;
          
          // Current flow indicator
          const currentFlow = Math.sin(currentPhase + cellIndex * 0.5) * 0.5 + 0.5;
          
          return (
            <g key={cellIndex} transform={`translate(0, ${cellY}) scale(${cellScale})`} opacity={cellEased}>
              {/* Copper disc (cathode) */}
              <Circle
                cx={0}
                cy={-cellHeight * 0.5}
                r={cellWidth * 0.45}
                fill="url(#copper-gradient)"
                stroke={COLORS.voltaicCopper}
                strokeWidth={u(2)}
              />
              {/* + symbol */}
              <Text
                x={0}
                y={-cellHeight * 0.5}
                children="+"
                fontSize={u(20)}
                fontWeight="900"
                fill={COLORS.ink}
                textAnchor="middle"
              />
              
              {/* Electrolyte separator (cardboard soaked in brine) */}
              <Rect
                x={-cellWidth * 0.4}
                y={-cellHeight * 0.5 + u(4)}
                width={cellWidth * 0.8}
                height={cellHeight - u(8)}
                fill="url(#electrolyte-gradient)"
                rx={u(2)}
                opacity={0.7}
              />
              {/* Wet indicator */}
              {Array.from({ length: 3 }).map((_, d) => (
                <Circle
                  key={d}
                  cx={-cellWidth * 0.2 + d * cellWidth * 0.2}
                  cy={-cellHeight * 0.5 + cellHeight * 0.5}
                  r={u(3)}
                  fill={COLORS.mint}
                  opacity={0.6 + Math.sin(frame * 0.1 + cellIndex + d) * 0.3}
                />
              ))}
              
              {/* Zinc disc (anode) */}
              <Circle
                cx={0}
                cy={cellHeight * 0.5}
                r={cellWidth * 0.45}
                fill="url(#zinc-gradient)"
                stroke={COLORS.voltaicZinc}
                strokeWidth={u(2)}
              />
              {/* - symbol */}
              <Text
                x={0}
                y={cellHeight * 0.5}
                children="−"
                fontSize={u(20)}
                fontWeight="900"
                fill={COLORS.ink}
                textAnchor="middle"
              />
              
              {/* Current flow arrow between cells */}
              {cellIndex < numCells - 1 && (
                <g opacity={currentFlow * wireEased}>
                  <Path
                    d={`M 0 ${cellHeight * 0.5 + u(4)} L 0 ${cellHeight * 1.5 - u(4)}`}
                    stroke={COLORS.lightning}
                    strokeWidth={u(3)}
                    fill="none"
                    strokeLinecap="round"
                  />
                  <Polygon
                    points={`0,${cellHeight * 1.5 - u(4)} ${-u(6)},${cellHeight * 1.5 - u(14)} ${u(6)},${cellHeight * 1.5 - u(14)}`}
                    fill={COLORS.lightning}
                  />
                </g>
              )}
            </g>
          );
        })}
        
        {/* Top copper terminal */}
        {builtCells > 0 && (
          <g transform={`translate(0, ${-(builtCells - 1) * cellHeight * 2 - cellHeight * 0.5})`} opacity={buildEased}>
            <Circle
              cx={0}
              cy={0}
              r={cellWidth * 0.5}
              fill="url(#copper-gradient)"
              stroke={COLORS.voltaicCopper}
              strokeWidth={u(3)}
            />
            <Text x={0} y={0} children="+" fontSize={u(24)} fontWeight="900" fill={COLORS.ink} textAnchor="middle" />
            {/* Wire to galvanometer */}
            {wireEased > 0 && (
              <Path
                d={`M 0 ${-u(10)} L ${galvanometerX - pileCenterX} ${galvanometerY - pileBaseY + (builtCells - 1) * cellHeight * 2 + cellHeight * 0.5}`}
                stroke={COLORS.voltaicWire}
                strokeWidth={u(3)}
                fill="none"
                opacity={wireEased}
                strokeDasharray="10,5"
                strokeDashoffset={frame * 2}
              />
            )}
          </g>
        )}
        
        {/* Bottom zinc terminal */}
        <g opacity={buildEased}>
          <Circle
            cx={0}
            cy={cellHeight * 0.5}
            r={cellWidth * 0.5}
            fill="url(#zinc-gradient)"
            stroke={COLORS.voltaicZinc}
            strokeWidth={u(3)}
          />
          <Text x={0} y={cellHeight * 0.5} children="−" fontSize={u(24)} fontWeight="900" fill={COLORS.ink} textAnchor="middle" />
          {/* Ground wire */}
          <Path
            d={`M 0 ${cellHeight * 0.5 + u(10)} L 0 ${u(20)}`}
            stroke={COLORS.voltaicWire}
            strokeWidth={u(3)}
            fill="none"
            opacity={buildEased}
          />
        </g>
      </g>
      
      {/* Galvanometer */}
      {wireEased > 0 && (
        <g transform={`translate(${galvanometerX}, ${galvanometerY}) scale(${wireEased})`} opacity={wireEased}>
          {/* Case */}
          <Circle cx={0} cy={0} r={u(50)} fill={COLORS.darkCity} stroke={COLORS.voltaicZinc} strokeWidth={u(3)} />
          {/* Scale */}
          {Array.from({ length: 9 }).map((_, i) => (
            <Line
              key={i}
              x1={u(35)}
              y1={0}
              x2={u(45)}
              y2={0}
              stroke={COLORS.cream}
              strokeWidth={u(1.5)}
              transform={`rotate(${i * 22.5 - 90})`}
              opacity={0.6}
            />
          ))}
          {/* Needle */}
          <Line
            x1={0}
            y1={0}
            x2={u(35)}
            y2={0}
            stroke={COLORS.lightning}
            strokeWidth={u(3)}
            transform={`rotate(${Math.sin(frame * 0.15) * 60 * wireEased - 90})`}
            strokeLinecap="round"
          />
          {/* Center pivot */}
          <Circle cx={0} cy={0} r={u(5)} fill={COLORS.voltaicZinc} />
          {/* Label */}
          <Text x={0} y={u(70)} children="GAVANOMETER" fontSize={u(16)} fontWeight="700" fill={COLORS.cream} textAnchor="middle" opacity={0.8} />
        </g>
      )}
      
      {/* Galvanometer sparks */}
      {galvoSparks}
      
      {/* Breakthrough particles */}
      {breakthroughParticles}
      
      {/* Year marker */}
      {yearEased > 0 && (
        <Text
          x={VIDEO_CONFIG.width - u(60)}
          y={u(80)}
          children="1800"
          fontSize={u(36)}
          fontWeight="900"
          fill={COLORS.voltaicCopper}
          textAnchor="end"
          opacity={yearEased}
        />
      )}
      
      {/* Headline Plaque - Zone 4 */}
      {frame > PHASE_BREAKTHROUGH - 30 && (
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
            stroke={COLORS.voltaicCopper}
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
            children="BATERAI PERTAMA"
            fontSize={u(52)}
            fontWeight="900"
            fill={COLORS.voltaicCopper}
            textAnchor="middle"
          />
          <Text
            x={0}
            y={u(40)}
            children="ALESSANDRO VOLTA MENCIPTAKAN ARUS TERUS-MENERUS"
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
          activeColor={COLORS.voltaicCopper}
          inactiveColor={COLORS.cream}
        />
      )}
    </g>
  );
}
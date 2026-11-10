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

interface Scene2Props {
  frame: number;
  words?: WordTiming[];
}

export function Scene2({ frame, words }: Scene2Props) {
  const duration = SCENE_DURATIONS.scene2;
  const progress = frame / duration;
  
  // Scene phases
  const PHASE_INTRO = 0;           // 0-30: Dark backdrop, title
  const PHASE_HAIR_RUB = 30;       // 30-180: Hand rubbing amber on hair
  const PHASE_PAPER_ATTRACT = 180; // 180-360: Paper pieces attracted
  const PHASE_GREEK_AMBER = 360;   // 360-520: Greek amber observation
  const PHASE_REVEAL = 520;        // 520-end: Secret revealed
  
  // ============ BACKGROUND ============
  // Angled paper scrap backdrop (Zone 1)
  const backdropAngle = -6; // degrees
  const backdropY = 400;
  
  // ============ HAIR & AMBER ANIMATION ============
  const hairRubProgress = Math.max(0, Math.min(1, (frame - PHASE_HAIR_RUB) / 150));
  const hairRubEased = easing.easeInOutCubic(hairRubProgress);
  
  // Hand position
  const handX = interpolateClamped(hairRubEased, [0, 1], [VIDEO_CONFIG.width * 0.3, VIDEO_CONFIG.width * 0.7]);
  const handY = VIDEO_CONFIG.height * 0.45;
  
  // Hair strands
  const hairStrands: ReactElement[] = [];
  for (let i = 0; i < 12; i++) {
    const strandPhase = (frame * 0.1 + i * 0.5) % (Math.PI * 2);
    const sway = Math.sin(strandPhase) * u(8) * hairRubEased;
    const strandX = handX - u(60) + i * u(10);
    const strandBaseY = handY - u(20);
    
    hairStrands.push(
      <Path
        key={i}
        d={`M ${strandX} ${strandBaseY} Q ${strandX + sway} ${strandBaseY - u(40)} ${strandX + sway * 0.5} ${strandBaseY - u(80)}`}
        stroke={COLORS.cream}
        strokeWidth={u(2)}
        opacity={0.6 * hairRubEased}
        fill="none"
      />
    );
  }
  
  // Amber piece in hand
  const amberX = handX;
  const amberY = handY + u(10);
  const amberRotate = Math.sin(frame * 0.15) * 5 * hairRubEased;
  const amberGlow = Math.sin(frame * 0.3) * 0.3 + 0.7;
  
  // ============ PAPER ATTRACTION ============
  const paperProgress = Math.max(0, Math.min(1, (frame - PHASE_PAPER_ATTRACT) / 180));
  const paperEased = easing.easeOutExpo(paperProgress);
  
  const paperPieces: ReactElement[] = [];
  const paperCount = 8;
  for (let i = 0; i < paperCount; i++) {
    const angle = (i / paperCount) * Math.PI * 2;
    const startX = VIDEO_CONFIG.width / 2 + Math.cos(angle) * u(200);
    const startY = VIDEO_CONFIG.height * 0.75 + Math.sin(angle) * u(100);
    const targetX = amberX;
    const targetY = amberY - u(30);
    
    const currentX = interpolateClamped(paperEased, [0, 1], [startX, targetX]);
    const currentY = interpolateClamped(paperEased, [0, 1], [startY, targetY]);
    const rotation = interpolateClamped(paperEased, [0, 1], [angle * 180 / Math.PI + (i * 45), 0]);
    const scale = interpolateClamped(paperEased, [0, 1], [0.5, 1]);
    const opacity = paperEased > 0.8 ? (1 - paperEased) * 5 : 1;
    
    paperPieces.push(
      <g
        key={i}
        transform={`translate(${currentX}, ${currentY}) rotate(${rotation}) scale(${scale})`}
        opacity={opacity}
      >
        <Rect
          x={-u(15)}
          y={-u(20)}
          width={u(30)}
          height={u(40)}
          fill={COLORS.cream}
          stroke={COLORS.ink}
          strokeWidth={u(1)}
          rx={u(2)}
        />
        {/* Text lines on paper */}
        <Line x1={-u(8)} y1={-u(5)} x2={u(8)} y2={-u(5)} stroke={COLORS.ink} strokeWidth={u(1.5)} opacity={0.6} />
        <Line x1={-u(6)} y1={u(3)} x2={u(6)} y2={u(3)} stroke={COLORS.ink} strokeWidth={u(1.5)} opacity={0.6} />
        <Line x1={-u(10)} y1={u(11)} x2={u(5)} y2={u(11)} stroke={COLORS.ink} strokeWidth={u(1.5)} opacity={0.6} />
      </g>
    );
  }
  
  // ============ SPARK PARTICLES (Static electricity) ============
  const sparks: ReactElement[] = [];
  if (frame > PHASE_HAIR_RUB + 50) {
    for (let i = 0; i < 20; i++) {
      const sparkFrame = frame - PHASE_HAIR_RUB - 50;
      const sparkStart = (i * 7) % 60;
      const sparkDur = 30;
      if (sparkFrame >= sparkStart && sparkFrame < sparkStart + sparkDur) {
        const angle = Math.random() * Math.PI * 2;
        const dist = u(30) + Math.random() * u(50);
        sparks.push(
          <Spark
            key={`spark-${i}-${frame}`}
            x={amberX}
            y={amberY}
            frame={sparkFrame}
            startFrame={sparkStart}
            duration={sparkDur}
            color={COLORS.amberGlow}
            size={u(4)}
          />
        );
      }
    }
  }
  
  // ============ GREEK AMBER ILLUSTRATION ============
  const greekProgress = Math.max(0, Math.min(1, (frame - PHASE_GREEK_AMBER) / 160));
  const greekEased = easing.easeOutBack(greekProgress);
  
  // Greek figure (simplified silhouette)
  const greekX = VIDEO_CONFIG.width * 0.25;
  const greekY = VIDEO_CONFIG.height * 0.65;
  const greekScale = greekEased;
  
  // Amber stone on table
  const amberStoneX = VIDEO_CONFIG.width * 0.55;
  const amberStoneY = VIDEO_CONFIG.height * 0.75;
  const amberStoneScale = greekEased;
  
  // ============ MAGNETIC FIELD LINES ============
  const fieldLines: ReactElement[] = [];
  if (frame > PHASE_REVEAL - 50) {
    const fieldProgress = Math.max(0, Math.min(1, (frame - (PHASE_REVEAL - 50)) / 100));
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const len = u(80) * fieldProgress;
      fieldLines.push(
        <Line
          key={i}
          x1={amberX}
          y1={amberY}
          x2={amberX + Math.cos(angle) * len}
          y2={amberY + Math.sin(angle) * len}
          stroke={COLORS.amberGlow}
          strokeWidth={u(1.5)}
          opacity={fieldProgress * (1 - fieldProgress) * 4}
          strokeDasharray="5,5"
        />
      );
    }
  }
  
  // ============ HEADLINE (Zone 4) ============
  const headlineProgress = Math.max(0, Math.min(1, (frame - PHASE_REVEAL + 50) / 60));
  const headlineEased = easing.easeOutBack(headlineProgress);
  const headlineY = interpolateClamped(headlineEased, [0, 1], [1500, 1240]);
  const headlineOpacity = headlineEased;
  const headlineScale = interpolateClamped(headlineEased, [0, 1], [0.7, 1]);
  
  return (
    <g>
      {/* Background - deep amber gradient */}
      <defs>
        <linearGradient id="scene2-bg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#2D1B00" />
          <stop offset="50%" stopColor="#1A0F00" />
          <stop offset="100%" stopColor="#0D0800" />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={VIDEO_CONFIG.width} height={VIDEO_CONFIG.height} fill="url(#scene2-bg)" />
      
      {/* Flash transition at scene start */}
      <FlashTransition frame={frame} triggerFrame={0} duration={3} color={COLORS.amber} />
      
      {/* Zone 1: Angled backdrop paper scrap */}
      <g transform={`translate(${VIDEO_CONFIG.width / 2}, ${backdropY}) rotate(${backdropAngle})`} opacity={0.15}>
        <Rect
          x={-u(380)}
          y={-u(200)}
          width={u(760)}
          height={u(400)}
          rx={u(8)}
          fill={COLORS.cream}
          stroke={COLORS.amber}
          strokeWidth={u(2)}
        />
        {/* Grid lines */}
        {Array.from({ length: 8 }).map((_, i) => (
          <Line
            key={i}
            x1={-u(360)}
            y1={-u(180) + i * u(50)}
            x2={u(360)}
            y2={-u(180) + i * u(50)}
            stroke={COLORS.amber}
            strokeWidth={u(0.5)}
            opacity={0.3}
          />
        ))}
      </g>
      
      {/* Hair rubbing animation */}
      {frame >= PHASE_HAIR_RUB && (
        <g>
          {/* Hair strands */}
          {hairStrands}
          
          {/* Hand silhouette */}
          <g transform={`translate(${handX}, ${handY})`} opacity={hairRubEased}>
            {/* Hand palm */}
            <Path
              d={`M ${-u(30)} ${u(10)} Q ${-u(30)} ${-u(20)} ${0} ${-u(20)} Q ${u(30)} ${-u(20)} ${u(30)} ${u(10)} Q ${u(20)} ${u(40)} ${-u(20)} ${u(40)} Z`}
              fill={COLORS.cream}
              opacity={0.9}
            />
            {/* Fingers */}
            {[-2, -1, 0, 1, 2].map((f, idx) => (
              <Rect
                key={idx}
                x={f * u(10) - u(4)}
                y={-u(50)}
                width={u(8)}
                height={u(35)}
                rx={u(2)}
                fill={COLORS.cream}
                opacity={0.9}
              />
            ))}
            {/* Thumb */}
            <Rect
              x={-u(40)}
              y={-u(10)}
              width={u(12)}
              height={u(30)}
              rx={u(3)}
              fill={COLORS.cream}
              opacity={0.9}
              transform="rotate(-30)"
            />
          </g>
          
          {/* Amber in hand */}
          <g transform={`translate(${amberX}, ${amberY}) rotate(${amberRotate})`} opacity={hairRubEased}>
            <Polygon
              points={`0,${-u(25)} ${u(20)},${-u(10)} ${u(20)},${u(10)} 0,${u(25)} ${-u(20)},${u(10)} ${-u(20)},${-u(10)}`}
              fill={COLORS.amber}
              stroke={COLORS.amberGlow}
              strokeWidth={u(2)}
              opacity={0.9 * amberGlow}
            />
            {/* Amber glow */}
            <Circle cx={0} cy={0} r={u(30) * amberGlow} fill="none" stroke={COLORS.amberGlow} strokeWidth={u(1)} opacity={0.4 * amberGlow} />
          </g>
          
          {/* Static sparks */}
          {sparks}
          
          {/* Electric field lines */}
          {fieldLines}
        </g>
      )}
      
      {/* Paper pieces attracted */}
      {frame >= PHASE_PAPER_ATTRACT && <g>{paperPieces}</g>}
      
      {/* Greek amber illustration */}
      {frame >= PHASE_GREEK_AMBER && (
        <g opacity={greekEased}>
          {/* Greek figure silhouette */}
          <g transform={`translate(${greekX}, ${greekY}) scale(${greekScale})`}>
            {/* Robe */}
            <Path
              d={`M ${-u(40)} ${u(60)} L ${-u(30)} ${-u(80)} Q ${0} ${-u(100)} ${u(30)} ${-u(80)} L ${u(40)} ${u(60)} Z`}
              fill={COLORS.cream}
              opacity={0.6}
            />
            {/* Head */}
            <Circle cx={0} cy={-u(100)} r={u(25)} fill={COLORS.cream} opacity={0.6} />
            {/* Beard */}
            <Path
              d={`M ${-u(15)} ${-u(85)} Q ${0} ${-u(70)} ${u(15)} ${-u(85)}`}
              stroke={COLORS.cream}
              strokeWidth={u(3)}
              fill="none"
              opacity={0.6}
            />
            {/* Hand holding amber */}
            <Path
              d={`M ${u(30)} ${-u(20)} Q ${u(50)} ${-u(10)} ${u(60)} ${u(10)} Q ${u(55)} ${u(25)} ${u(40)} ${u(20)}`}
              stroke={COLORS.cream}
              strokeWidth={u(6)}
              fill="none"
              opacity={0.6}
              strokeLinecap="round"
            />
          </g>
          
          {/* Amber stone on table */}
          <g transform={`translate(${amberStoneX}, ${amberStoneY}) scale(${amberStoneScale})`}>
            <Rect
              x={-u(80)}
              y={u(20)}
              width={u(160)}
              height={u(10)}
              fill={COLORS.darkCity}
              rx={u(3)}
            />
            <Polygon
              points={`0,${-u(35)} ${u(28)},${-u(14)} ${u(28)},${u(14)} 0,${u(35)} ${-u(28)},${u(14)} ${-u(28)},${-u(14)}`}
              fill={COLORS.amber}
              stroke={COLORS.amberGlow}
              strokeWidth={u(3)}
              opacity={0.9}
            />
            {/* Attracted feather */}
            <g transform={`translate(${Math.sin(frame * 0.05) * u(10)}, ${-u(50) + Math.sin(frame * 0.03) * u(5)})`}>
              <Path
                d={`M 0 ${-u(30)} Q ${-u(8)} ${-u(15)} ${-u(5)} ${0} Q ${-u(8)} ${u(15)} 0 ${u(30)} Q ${u(8)} ${u(15)} ${u(5)} ${0} Q ${u(8)} ${-u(15)} 0 ${-u(30)}`}
                fill={COLORS.cream}
                opacity={0.8}
              />
            </g>
          </g>
          
          {/* Greek label */}
          <Text
            x={greekX}
            y={greekY + u(100)}
            children="THALES OF MILETUS ~600 SM"
            fontSize={u(22)}
            fontWeight="600"
            fill={COLORS.amberGlow}
            textAnchor="middle"
            opacity={0.8}
          />
        </g>
      )}
      
      {/* Headline Plaque - Zone 4 */}
      {frame > PHASE_REVEAL - 50 && (
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
            stroke={COLORS.amberGlow}
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
            children="RAHASIA ALAM"
            fontSize={u(52)}
            fontWeight="900"
            fill={COLORS.amberGlow}
            textAnchor="middle"
          />
          <Text
            x={0}
            y={u(40)}
            children="LISTRIK STATIS DITEMUKAN RIBUAN TAHUN YANG LALU"
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
          activeColor={COLORS.amberGlow}
          inactiveColor={COLORS.cream}
        />
      )}
    </g>
  );
}
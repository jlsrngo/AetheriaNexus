import { ReactElement } from "react";
import { SCENE_DURATIONS, COLORS, easing, interpolateClamped, u, WordTiming, VIDEO_CONFIG } from "../types";
import {
  Circle,
  Rect,
  Path,
  Text,
  Line,
  Spark,
  KineticSubtitles,
  FlashTransition,
} from "./FlatVectorPrimitives";

interface Scene5Props {
  frame: number;
  words?: WordTiming[];
}

export function Scene5({ frame, words }: Scene5Props) {
  const duration = SCENE_DURATIONS.scene5;

  // Scene phases
  const PHASE_INTRO = 0;
  const PHASE_GENERATOR_SPIN = 60;
  const PHASE_INDUCTION = 180;
  const PHASE_LIGHTBULB = 300;

  // ============ FARADAY ROTATING GENERATOR ============
  const genCenterX = VIDEO_CONFIG.width / 2;
  const genCenterY = VIDEO_CONFIG.height * 0.45;
  const rotationAngle = (frame * 6) % 360;

  // Induction glow
  const inductionProgress = Math.max(0, Math.min(1, (frame - PHASE_INDUCTION) / 100));
  const inductionEased = easing.easeOutCubic(inductionProgress);

  // Lightbulb glow
  const bulbProgress = Math.max(0, Math.min(1, (frame - PHASE_LIGHTBULB) / 80));
  const bulbEased = easing.easeOutBack(bulbProgress);
  const bulbGlow = Math.sin(frame * 0.2) * 0.15 + 0.85;

  // Sparks
  const sparks: ReactElement[] = [];
  if (frame > PHASE_INDUCTION) {
    for (let i = 0; i < 6; i++) {
      const sparkStart = (i * 20) % 100;
      const sparkDur = 20;
      const sf = (frame - PHASE_INDUCTION) % 100;
      if (sf >= sparkStart && sf < sparkStart + sparkDur) {
        sparks.push(
          <Spark
            key={i}
            x={genCenterX + Math.cos(i) * u(120)}
            y={genCenterY + Math.sin(i) * u(120)}
            frame={sf}
            startFrame={sparkStart}
            duration={sparkDur}
            color={COLORS.faradayWire}
            size={u(7)}
          />
        );
      }
    }
  }

  // Headline
  const headlineProgress = Math.max(0, Math.min(1, (frame - 40) / 60));
  const headlineEased = easing.easeOutBack(headlineProgress);

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

      {/* Header bar */}
      <Text
        x={u(64)}
        y={u(80)}
        children="ARSIP ILMIAH // INDUKSI ELEKTROMAGNETIK"
        fontSize={u(18)}
        fontWeight="700"
        fill={COLORS.cream}
        opacity={0.7}
      />
      <Text
        x={VIDEO_CONFIG.width - u(64)}
        y={u(80)}
        children="1831"
        fontSize={u(36)}
        fontWeight="900"
        fill={COLORS.faradayCopper}
        textAnchor="end"
      />

      {/* Generator Base Stand */}
      <Rect
        x={genCenterX - u(200)}
        y={genCenterY + u(140)}
        width={u(400)}
        height={u(40)}
        rx={u(8)}
        fill={COLORS.faradayIron}
      />
      <Rect
        x={genCenterX - u(30)}
        y={genCenterY - u(40)}
        width={u(60)}
        height={u(180)}
        fill={COLORS.faradayIron}
      />

      {/* Horseshoe Magnet */}
      <g transform={`translate(${genCenterX}, ${genCenterY})`}>
        {/* North Pole (Red/Coral) */}
        <Path
          d={`M ${-u(140)} ${-u(120)} L ${-u(80)} ${-u(120)} L ${-u(80)} ${u(100)} L ${-u(140)} ${u(100)} Z`}
          fill={COLORS.coral}
        />
        <Text
          x={-u(110)}
          y={-u(60)}
          children="N"
          fontSize={u(32)}
          fontWeight="900"
          fill={COLORS.cream}
          textAnchor="middle"
        />

        {/* South Pole (Ultramarine) */}
        <Path
          d={`M ${u(80)} ${-u(120)} L ${u(140)} ${-u(120)} L ${u(140)} ${u(100)} L ${u(80)} ${u(100)} Z`}
          fill={COLORS.ultramarine}
        />
        <Text
          x={u(110)}
          y={-u(60)}
          children="S"
          fontSize={u(32)}
          fontWeight="900"
          fill={COLORS.cream}
          textAnchor="middle"
        />

        {/* Rotating Copper Coil Disk */}
        <g transform={`rotate(${rotationAngle})`}>
          <Circle cx={0} cy={0} r={u(70)} fill="none" stroke={COLORS.faradayCopper} strokeWidth={u(16)} />
          <Circle cx={0} cy={0} r={u(45)} fill="none" stroke={COLORS.faradayCopper} strokeWidth={u(10)} />
          <Line x1={-u(70)} y1={0} x2={u(70)} y2={0} stroke={COLORS.faradayWire} strokeWidth={u(4)} />
          <Line x1={0} y1={-u(70)} x2={0} y2={u(70)} stroke={COLORS.faradayWire} strokeWidth={u(4)} />
          <Circle cx={0} cy={0} r={u(18)} fill={COLORS.faradayIron} />
        </g>
      </g>

      {/* Sparks */}
      {sparks}

      {/* Lightbulb (Phase 4) */}
      {bulbEased > 0 && (
        <g transform={`translate(${genCenterX}, ${genCenterY + u(280)}) scale(${bulbEased})`}>
          {/* Outer Aura Glow */}
          <Circle
            cx={0}
            cy={0}
            r={u(100) * bulbGlow}
            fill={COLORS.sunflower}
            opacity={0.3 * bulbGlow}
          />
          <Circle
            cx={0}
            cy={0}
            r={u(60)}
            fill={COLORS.modernCityLight}
            opacity={0.9}
          />
          {/* Filament */}
          <Path
            d={`M ${-u(15)} ${u(15)} Q 0 ${-u(30)} ${u(15)} ${u(15)}`}
            stroke={COLORS.lightning}
            strokeWidth={u(4)}
            fill="none"
          />
          {/* Screw Base */}
          <Rect x={-u(20)} y={u(40)} width={u(40)} height={u(30)} rx={u(4)} fill={COLORS.faradayIron} />
        </g>
      )}

      {/* Headline Plaque - Zone 4 */}
      <g
        transform={`translate(${VIDEO_CONFIG.width / 2}, 1220) scale(${headlineEased})`}
        opacity={headlineEased}
      >
        <Rect
          x={-u(460)}
          y={-u(60)}
          width={u(920)}
          height={u(120)}
          rx={u(10)}
          fill={COLORS.ink}
          stroke={COLORS.faradayCopper}
          strokeWidth={u(4)}
        />
        <Text
          x={0}
          y={-u(10)}
          children="MICHAEL FARADAY"
          fontSize={u(52)}
          fontWeight="900"
          fill={COLORS.faradayCopper}
          textAnchor="middle"
        />
        <Text
          x={0}
          y={u(38)}
          children="MENGUBAH GERAK MENJADI LISTRIK"
          fontSize={u(22)}
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
          fontSize={u(58)}
          activeColor={COLORS.sunflower}
          inactiveColor={COLORS.cream}
        />
      )}
    </g>
  );
}
export default Scene5;


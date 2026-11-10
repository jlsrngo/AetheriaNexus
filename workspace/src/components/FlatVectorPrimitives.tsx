import { ReactElement } from "react";
import { COLORS, easing, interpolateClamped, u, WordTiming, VIDEO_CONFIG } from "../types";

/**
 * Reusable Flat Vector Shape Primitives
 * All shapes are pure SVG/code - zero external images
 */

// ============ BASE SHAPES ============

export interface CircleProps {
  cx: number;
  cy: number;
  r: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  className?: string;
}

export function Circle({ cx, cy, r, fill = COLORS.cream, stroke, strokeWidth, opacity = 1, className }: CircleProps) {
  return (
    <circle
      className={className}
      cx={cx}
      cy={cy}
      r={r}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      opacity={opacity}
    />
  );
}

export interface RectProps {
  x: number;
  y: number;
  width: number;
  height: number;
  rx?: number;
  ry?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  transform?: string;
  className?: string;
}

export function Rect({ x, y, width, height, rx = 0, ry = 0, fill = COLORS.cream, stroke, strokeWidth, opacity = 1, transform, className }: RectProps) {
  return (
    <rect
      className={className}
      x={x}
      y={y}
      width={width}
      height={height}
      rx={rx}
      ry={ry}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      opacity={opacity}
      transform={transform}
    />
  );
}

export interface PathProps {
  d: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  strokeLinecap?: "butt" | "round" | "square";
  strokeLinejoin?: "miter" | "round" | "bevel";
  className?: string;
}

export function Path({ d, fill = "none", stroke, strokeWidth, opacity = 1, strokeLinecap = "round", strokeLinejoin = "round", className }: PathProps) {
  return (
    <path
      className={className}
      d={d}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      opacity={opacity}
      strokeLinecap={strokeLinecap}
      strokeLinejoin={strokeLinejoin}
    />
  );
}

export interface PolygonProps {
  points: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  className?: string;
}

export function Polygon({ points, fill = COLORS.cream, stroke, strokeWidth, opacity = 1, className }: PolygonProps) {
  return (
    <polygon className={className} points={points} fill={fill} stroke={stroke} strokeWidth={strokeWidth} opacity={opacity} />
  );
}

export interface LineProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  strokeWidth?: number;
  opacity?: number;
  strokeDasharray?: string;
  strokeDashoffset?: number;
  className?: string;
}

export function Line({ x1, y1, x2, y2, stroke, strokeWidth = 2, opacity = 1, strokeDasharray, strokeDashoffset, className }: LineProps) {
  return (
    <line
      className={className}
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={stroke}
      strokeWidth={strokeWidth}
      opacity={opacity}
      strokeDasharray={strokeDasharray}
      strokeDashoffset={strokeDashoffset}
    />
  );
}

export interface TextProps {
  x: number;
  y: number;
  children: React.ReactNode;
  fontSize?: number;
  fontWeight?: string;
  fill?: string;
  textAnchor?: "start" | "middle" | "end";
  dominantBaseline?: "auto" | "text-bottom" | "alphabetic" | "ideographic" | "middle" | "central" | "mathematical" | "hanging" | "text-top";
  opacity?: number;
  transform?: string;
  className?: string;
  fontFamily?: string;
}

export function Text({ x, y, children, fontSize = 48, fontWeight = "700", fill = COLORS.ink, textAnchor = "middle", dominantBaseline = "central", opacity = 1, transform, className, fontFamily = "Inter, system-ui, sans-serif" }: TextProps) {
  return (
    <text
      className={className}
      x={x}
      y={y}
      fontSize={fontSize}
      fontWeight={fontWeight}
      fill={fill}
      textAnchor={textAnchor}
      dominantBaseline={dominantBaseline}
      opacity={opacity}
      transform={transform}
      fontFamily={fontFamily}
    >
      {children}
    </text>
  );
}

// ============ ANIMATED PRIMITIVES ============

export interface AnimatedCircleProps extends CircleProps {
  frame: number;
  animStart?: number;
  animDuration?: number;
  scaleRange?: [number, number];
  yRange?: [number, number];
  opacityRange?: [number, number];
}

export function AnimatedCircle({ frame, animStart = 0, animDuration = 30, scaleRange = [0, 1], yRange, opacityRange = [0, 1], ...rest }: AnimatedCircleProps) {
  const progress = Math.max(0, Math.min(1, (frame - animStart) / animDuration));
  const eased = easing.easeOutBack(progress);
  const scale = interpolateClamped(eased, [0, 1], scaleRange);
  const cy = yRange ? interpolateClamped(eased, [0, 1], yRange) : rest.cy;
  const opacity = interpolateClamped(eased, [0, 1], opacityRange);
  
  return (
    <g transform={`translate(${rest.cx}, ${cy}) scale(${scale})`}>
      <Circle {...rest} cx={0} cy={0} opacity={opacity * (rest.opacity ?? 1)} />
    </g>
  );
}

export interface AnimatedRectProps extends RectProps {
  frame: number;
  animStart?: number;
  animDuration?: number;
  scaleRange?: [number, number];
  xRange?: [number, number];
  yRange?: [number, number];
  opacityRange?: [number, number];
  rotationRange?: [number, number];
}

export function AnimatedRect({ frame, animStart = 0, animDuration = 30, scaleRange = [0, 1], xRange, yRange, opacityRange = [0, 1], rotationRange, ...rest }: AnimatedRectProps) {
  const progress = Math.max(0, Math.min(1, (frame - animStart) / animDuration));
  const eased = easing.easeOutBack(progress);
  const scale = interpolateClamped(eased, [0, 1], scaleRange);
  const x = xRange ? interpolateClamped(eased, [0, 1], xRange) : rest.x;
  const y = yRange ? interpolateClamped(eased, [0, 1], yRange) : rest.y;
  const opacity = interpolateClamped(eased, [0, 1], opacityRange);
  const rotation = rotationRange ? interpolateClamped(eased, [0, 1], rotationRange) : 0;
  
  const transformParts = [];
  if (rotation !== 0) transformParts.push(`rotate(${rotation})`);
  transformParts.push(`scale(${scale})`);
  if (rest.transform) transformParts.push(rest.transform);
  
  return (
    <g transform={`translate(${x}, ${y}) ${transformParts.join(" ")}`}>
      <Rect {...rest} x={0} y={0} opacity={opacity * (rest.opacity ?? 1)} transform={undefined} />
    </g>
  );
}

export interface AnimatedPathProps extends PathProps {
  frame: number;
  animStart?: number;
  animDuration?: number;
  strokeDashoffsetRange?: [number, number];
  opacityRange?: [number, number];
}

export function AnimatedPath({ frame, animStart = 0, animDuration = 30, strokeDashoffsetRange, opacityRange = [0, 1], ...rest }: AnimatedPathProps) {
  const progress = Math.max(0, Math.min(1, (frame - animStart) / animDuration));
  const eased = easing.easeOutExpo(progress);
  const strokeDashoffset = strokeDashoffsetRange ? interpolateClamped(eased, [0, 1], strokeDashoffsetRange) : undefined;
  const opacity = interpolateClamped(eased, [0, 1], opacityRange);
  
  return <Path {...rest} strokeDashoffset={strokeDashoffset} opacity={opacity * (rest.opacity ?? 1)} />;
}

// ============ COMPOUND SHAPES ============

// Building silhouette for city scenes
export interface BuildingProps {
  x: number;
  y: number; // bottom Y
  width: number;
  height: number;
  windows?: number;
  fill?: string;
  frame?: number;
  animDelay?: number;
}

export function Building({ x, y, width, height, windows = 0, fill = COLORS.darkCity, frame = 0, animDelay = 0 }: BuildingProps) {
  const currentFrame = frame ?? 0;
  
  // Staggered entrance animation
  const progress = Math.max(0, Math.min(1, (currentFrame - animDelay) / 40));
  const eased = easing.easeOutBack(progress);
  const drawHeight = height * eased;
  
  const windowElements: ReactElement[] = [];
  if (windows > 0 && progress > 0.5) {
    const windowProgress = Math.max(0, Math.min(1, (progress - 0.5) * 2));
    const windowRows = Math.ceil(windows / 2);
    for (let row = 0; row < windowRows; row++) {
      for (let col = 0; col < 2; col++) {
        if (row * 2 + col >= windows) break;
        const wx = x + width * 0.15 + col * width * 0.4;
        const wy = y - height * 0.15 - row * (height / (windowRows + 1));
        const windowOn = Math.random() > 0.3; // Some windows lit
        windowElements.push(
          <rect
            key={`w-${row}-${col}`}
            x={wx}
            y={wy}
            width={width * 0.2}
            height={height / (windowRows + 1) * 0.4}
            fill={windowOn ? COLORS.cream : COLORS.darkCityAccent}
            opacity={windowProgress}
          />
        );
      }
    }
  }
  
  return (
    <g>
      <rect
        x={x}
        y={y - drawHeight}
        width={width}
        height={drawHeight}
        fill={fill}
      />
      {windowElements}
    </g>
  );
}

// Lightning bolt path generator
export function generateLightningPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  segments: number = 8,
  jitter: number = 30,
  seed: number = 0
): string {
  let path = `M ${startX} ${startY}`;
  let currentX = startX;
  let currentY = startY;
  
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const targetX = startX + (endX - startX) * t;
    const targetY = startY + (endY - startY) * t;
    
    // Pseudo-random jitter based on seed
    const rand1 = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
    const rand2 = Math.sin(seed * 39.346 + i * 11.135) * 43758.5453;
    const jx = (rand1 - Math.floor(rand1)) * 2 - 1;
    const jy = (rand2 - Math.floor(rand2)) * 2 - 1;
    
    currentX = targetX + jx * jitter * (1 - t * 0.5);
    currentY = targetY + jy * jitter * 0.3;
    
    path += ` L ${currentX} ${currentY}`;
  }
  
  return path;
}

// Spark particle
export interface SparkProps {
  x: number;
  y: number;
  frame: number;
  startFrame: number;
  duration: number;
  color?: string;
  size?: number;
}

export function Spark({ x, y, frame, startFrame, duration, color = COLORS.sunflower, size = 4 }: SparkProps) {
  const progress = Math.max(0, Math.min(1, (frame - startFrame) / duration));
  if (progress <= 0 || progress >= 1) return null;
  
  const eased = easing.easeOutExpo(progress);
  const scale = 1 - eased;
  const opacity = 1 - eased;
  const angle = (frame * 10) % 360;
  const distance = eased * 30;
  const sx = x + Math.cos(angle * Math.PI / 180) * distance;
  const sy = y - Math.sin(angle * Math.PI / 180) * distance;
  
  return (
    <g transform={`translate(${sx}, ${sy}) rotate(${angle}) scale(${scale})`}>
      <polygon
        points={`0,${-size} ${size * 0.5},0 0,${size} ${-size * 0.5},0`}
        fill={color}
        opacity={opacity}
      />
    </g>
  );
}

// Particle burst
export interface ParticleBurstProps {
  x: number;
  y: number;
  frame: number;
  startFrame: number;
  duration: number;
  count?: number;
  color?: string;
  spread?: number;
}

export function ParticleBurst({ x, y, frame, startFrame, duration, count = 12, color = COLORS.sunflower, spread = 60 }: ParticleBurstProps) {
  const progress = Math.max(0, Math.min(1, (frame - startFrame) / duration));
  if (progress <= 0 || progress >= 1) return null;
  
  const particles: ReactElement[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const pProgress = Math.max(0, Math.min(1, progress - i * 0.02));
    if (pProgress <= 0) continue;
    
    const eased = easing.easeOutExpo(pProgress);
    const distance = eased * spread;
    const px = x + Math.cos(angle) * distance;
    const py = y + Math.sin(angle) * distance;
    const scale = 1 - eased;
    const opacity = 1 - eased;
    
    particles.push(
      <circle
        key={i}
        cx={px}
        cy={py}
        r={u(3) * scale}
        fill={color}
        opacity={opacity}
      />
    );
  }
  
  return <g>{particles}</g>;
}

// ============ KINETIC SUBTITLES ============

export interface KineticSubtitlesProps {
  words: WordTiming[];
  frame: number;
  fps?: number;
  y?: number;
  fontSize?: number;
  activeColor?: string;
  inactiveColor?: string;
  maxLines?: number;
  wordsPerLine?: number;
}

export function KineticSubtitles({
  words,
  frame,
  fps = 30,
  y = 1620, // Zone 5: Safe subtitle zone
  fontSize = 60,
  activeColor = COLORS.sunflower,
  inactiveColor = COLORS.cream,
  maxLines = 2,
  wordsPerLine = 6,
}: KineticSubtitlesProps) {
  const currentTime = frame / fps;
  
  // Find active word
  let activeIndex = -1;
  words.forEach((w, i) => {
    if (currentTime >= w.start && currentTime < w.end) {
      activeIndex = i;
    }
  });
  
  // Build sliding window of words (max 2 lines)
  const windowSize = maxLines * wordsPerLine;
  const startIdx = Math.max(0, activeIndex - Math.floor(windowSize / 2));
  const endIdx = Math.min(words.length, startIdx + windowSize);
  
  const visibleWords = words.slice(startIdx, endIdx);
  
  const lineHeight = fontSize * 1.3;
  const totalWidth = visibleWords.reduce((sum, w) => sum + w.word.length * fontSize * 0.5, 0);
  let startX = VIDEO_CONFIG.width / 2 - totalWidth / 2;
  
  return (
    <g transform={`translate(0, ${y})`}>
      {visibleWords.map((w, i) => {
        const isActive = startIdx + i === activeIndex;
        const wordWidth = w.word.length * fontSize * 0.5;
        const x = startX + wordWidth / 2;
        startX += wordWidth + fontSize * 0.2;
        
        return (
          <text
            key={startIdx + i}
            x={x}
            y={0}
            fontSize={fontSize}
            fontWeight={isActive ? "900" : "700"}
            fill={isActive ? activeColor : inactiveColor}
            textAnchor="middle"
            dominantBaseline="central"
            opacity={isActive ? 1 : 0.6}
            fontFamily="Inter, system-ui, sans-serif"
            style={{
              filter: isActive ? "drop-shadow(0 0 8px rgba(255, 222, 89, 0.8))" : "none",
              transition: "all 0.05s ease-out",
            }}
          >
            {w.word}
          </text>
        );
      })}
    </g>
  );
}

// ============ TRANSITION EFFECTS ============

export interface FlashTransitionProps {
  frame: number;
  triggerFrame: number;
  duration?: number;
  color?: string;
}

export function FlashTransition({ frame, triggerFrame, duration = 5, color = "#FFFFFF" }: FlashTransitionProps) {
  const progress = Math.max(0, Math.min(1, (frame - triggerFrame) / duration));
  if (progress <= 0 || progress >= 1) return null;
  
  // Quick flash: in at frame 0, out by frame 2-3
  const opacity = progress < 0.4 ? progress * 2.5 : (1 - progress) * 1.67;
  
  return (
    <rect
      x={0}
      y={0}
      width={VIDEO_CONFIG.width}
      height={VIDEO_CONFIG.height}
      fill={color}
      opacity={opacity}
    />
  );
}

export interface GlitchTransitionProps {
  frame: number;
  triggerFrame: number;
  duration?: number;
  intensity?: number;
}

export function GlitchTransition({ frame, triggerFrame, duration = 8, intensity = 1 }: GlitchTransitionProps) {
  const progress = Math.max(0, Math.min(1, (frame - triggerFrame) / duration));
  if (progress <= 0 || progress >= 1) return null;
  
  const slices = 8;
  const sliceHeight = VIDEO_CONFIG.height / slices;
  const offset = Math.sin(frame * 0.5) * intensity * u(20) * (1 - progress);
  
  return (
    <g>
      {Array.from({ length: slices }).map((_, i) => {
        const sliceOffset = i % 2 === 0 ? offset : -offset;
        return (
          <rect
            key={i}
            x={sliceOffset}
            y={i * sliceHeight}
            width={VIDEO_CONFIG.width}
            height={sliceHeight}
            fill="url(#glitchPattern)"
            opacity={0.1 * (1 - progress)}
          />
        );
      })}
    </g>
  );
}
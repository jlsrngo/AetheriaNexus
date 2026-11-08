// Motion helpers for frame-driven animations
import { spring, interpolate } from 'remotion';
import { SPRING_CONFIGS } from './types';

const enter = (frame: number, at: number, opts?: { duration?: number; config?: string }) => {
  const duration = opts?.duration ?? 30;
  const config = SPRING_CONFIGS[opts?.config ?? 'fastPop'];
  const progressFrame = Math.max(0, frame - at);
  
  return spring({
    frame: progressFrame,
    fps: 60,
    config,
    from: 0,
    to: 1,
  });
};

const exit = (frame: number, end: number, opts?: { duration?: number }) => {
  const duration = opts?.duration ?? 20;
  const progressFrame = Math.max(0, end - frame);
  
  if (progressFrame > duration) return 1;
  
  return spring({
    frame: progressFrame,
    fps: 60,
    config: SPRING_CONFIGS.fastPop,
    from: 0,
    to: 1,
  });
};

const staggerEnter = (frame: number, at: number, stagger: number, index: number) => {
  const progressFrame = Math.max(0, frame - at - stagger * index);
  
  return spring({
    frame: progressFrame,
    fps: 60,
    config: SPRING_CONFIGS.fastPop,
    from: 0,
    to: 1,
  });
};

const scaleIn = (frame: number, at: number, fromScale = 0.8) => {
  const progress = enter(frame, at);
  return interpolate(progress, [0, 1], [fromScale, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
};

const slideUp = (frame: number, at: number, fromY = 40) => {
  const progress = enter(frame, at);
  return interpolate(progress, [0, 1], [fromY, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
};

const fadeIn = (frame: number, at: number, duration = 25) => {
  const progressFrame = Math.max(0, frame - at);
  return interpolate(progressFrame, [0, duration], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
};

const glowPulse = (frame: number, at: number, duration = 60) => {
  const progressFrame = Math.max(0, frame - at);
  const cycle = (progressFrame % duration) / duration;
  return interpolate(cycle, [0, 0.5, 1], [0.3, 0.8, 0.3], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
};

const cursorGlide = (frame: number, at: number, startX: number, endX: number, startY: number, endY: number) => {
  const progressFrame = Math.max(0, frame - at);
  const progress = interpolate(progressFrame, [0, 90], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  
  const x = interpolate(progress, [0, 1], [startX, endX], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const y = interpolate(progress, [0, 1], [startY, endY], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  
  return { x, y, progress };
};

const svgDashDraw = (frame: number, at: number, length = 600, duration = 45) => {
  const progressFrame = Math.max(0, frame - at);
  const progress = interpolate(progressFrame, [0, duration], [length, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return progress;
};

const cameraZoom = (frame: number, at: number, fromScale = 1, toScale = 1.15, duration = 120) => {
  const progressFrame = Math.max(0, frame - at);
  const progress = interpolate(progressFrame, [0, duration], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return interpolate(progress, [0, 1], [fromScale, toScale], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
};

export { enter, exit, staggerEnter, scaleIn, slideUp, fadeIn, glowPulse, cursorGlide, svgDashDraw, cameraZoom };

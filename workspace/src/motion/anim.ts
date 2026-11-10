import { spring } from "remotion";

/**
 * Standard spring configs for tasteful, anti-slop animations.
 */
export const SPRING_PRESETS = {
  /** Soft, non-bouncy spring for typography and headlines */
  text: { damping: 18, mass: 0.8, stiffness: 120 },
  /** Crisp, snappy pop for badges, pills, and icons */
  snappy: { damping: 14, mass: 0.6, stiffness: 160 },
  /** Heavy, confident entrance for hero cards and containers */
  card: { damping: 20, mass: 1.1, stiffness: 110 },
  /** Bouncy micro-accent for checkmarks, hearts, and numbers */
  pop: { damping: 11, mass: 0.5, stiffness: 180 },
  /** Dramatic sub-punch for climaxes */
  impact: { damping: 16, mass: 1.2, stiffness: 140 },
};

/**
 * Computes a normalized 0..1 spring progress starting at frame `at`.
 */
export function spr(
  frame: number,
  at: number,
  fps: number = 30,
  preset: keyof typeof SPRING_PRESETS = "snappy"
): number {
  if (frame < at) return 0;
  return spring({
    frame: frame - at,
    fps,
    config: SPRING_PRESETS[preset],
  });
}

/**
 * Smooth ramp from 0 to 1 with cubic ease-out.
 */
export function ramp(frame: number, at: number, durationFrames: number): number {
  if (frame <= at) return 0;
  if (frame >= at + durationFrames) return 1;
  const t = (frame - at) / durationFrames;
  // Cubic ease out
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Stagger helper: calculates the start frame for the i-th item in a sequence.
 */
export function stagger(index: number, startFrame: number, stepFrames: number = 4): number {
  return startFrame + index * stepFrames;
}

/**
 * TikTok Safe Area bounds.
 * Prevents text and important graphics from being obscured by TikTok's UI overlays:
 * - Top header (live, search): 120px
 * - Right action bar (like, comment, bookmark, share): 160px from right
 * - Bottom info (account handle, caption, sound disk): 260px from bottom
 */
export const TIKTOK_SAFE_INSETS = {
  top: 140,
  bottom: 280,
  left: 64,
  right: 160,
};

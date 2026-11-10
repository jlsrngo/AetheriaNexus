/**
 * collageMotion.ts
 * Kinetic physics & camera helpers for /mg-cutout-collage style.
 * Dada / Paper Collage stop-motion archetype — 12fps grid, slap physics, cork-pin jitter.
 */
import { interpolate, spring } from "remotion";

// ─── Timing grid ────────────────────────────────────────────────────────────
/** Snap a continuous frame to the 12 fps stop-motion grid. */
export function snap12(frame: number): number {
  return Math.floor(frame / 2.5) * 2.5; // 30/12 = 2.5 frames per 12fps tick
}

// ─── Slap-drop physics ───────────────────────────────────────────────────────
/**
 * Returns a Y-offset that starts above viewport, drops with overshoot squash,
 * and settles. Mimics paper piece slapped onto a table.
 *
 * @param frame     current frame (local to scene, starts at 0)
 * @param atFrame   frame at which the piece begins to drop
 * @param fps       composition fps (default 30)
 */
export function slapDrop(frame: number, atFrame: number, fps = 30): number {
  if (frame < atFrame) return -1200;
  const f = frame - atFrame;
  const progress = spring({
    frame: f,
    fps,
    config: { damping: 14, mass: 0.9, stiffness: 200 },
  });
  return interpolate(progress, [0, 1], [-1200, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

/**
 * Squash scale on landing beat (scaleY 0.965 for a few frames then springs back).
 */
export function slapSquash(frame: number, atFrame: number, fps = 30): number {
  if (frame < atFrame) return 1;
  const f = frame - atFrame;
  const squash = spring({
    frame: f,
    fps,
    config: { damping: 10, mass: 0.5, stiffness: 300 },
  });
  return interpolate(squash, [0, 1], [0.965, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

/**
 * Shadow blur: collapses from 24px elevated to 4px resting contact shadow.
 */
export function slapShadowBlur(frame: number, atFrame: number, fps = 30): number {
  if (frame < atFrame) return 24;
  const f = frame - atFrame;
  const p = spring({ frame: f, fps, config: { damping: 18, mass: 1, stiffness: 180 } });
  return interpolate(p, [0, 1], [24, 4], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

// ─── Stop-motion boil jitter ─────────────────────────────────────────────────
/**
 * Deterministic ±jitter seeded by pieceId so each piece jiggles differently.
 * Uses a 12fps grid: position only updates every 2.5 frames.
 */
export function boilJitter(frame: number, pieceId: number, amplitude = 1.5): [number, number] {
  const gridFrame = Math.floor(frame / 2.5);
  // Seeded LCG-style hash
  const h = (gridFrame * 1664525 + pieceId * 1013904223) & 0x7fffffff;
  const hx = (h & 0xfff) / 0xfff;
  const hy = ((h >> 12) & 0xfff) / 0xfff;
  const jx = (hx - 0.5) * 2 * amplitude;
  const jy = (hy - 0.5) * 2 * amplitude;
  return [jx, jy];
}

// ─── Camera snap zoom ────────────────────────────────────────────────────────
/**
 * Applies a subtle push-in zoom + slight rotation snap on a beat.
 * Returns { scale, rotate } CSS values.
 */
export function cameraSnapZoom(
  frame: number,
  atFrame: number,
  fps = 30,
  targetScale = 1.04,
  targetRotate = 0.3
): { scale: number; rotate: number } {
  if (frame < atFrame) return { scale: 1, rotate: 0 };
  const f = frame - atFrame;
  const p = spring({ frame: f, fps, config: { damping: 20, mass: 1.2, stiffness: 160 } });
  const scale = interpolate(p, [0, 1], [1.08, targetScale], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rotate = interpolate(p, [0, 1], [targetRotate, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return { scale, rotate };
}

// ─── Fade in / out helpers ────────────────────────────────────────────────────
export function fadeIn(frame: number, atFrame: number, durationFrames = 8): number {
  return interpolate(frame, [atFrame, atFrame + durationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

export function fadeOut(frame: number, fromFrame: number, durationFrames = 8): number {
  return interpolate(frame, [fromFrame, fromFrame + durationFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

// ─── Stamp slam ───────────────────────────────────────────────────────────────
/** Kinetic stamp scale: starts huge (1.8) slams to 1.0 with spring bounce. */
export function stampSlam(frame: number, atFrame: number, fps = 30): number {
  if (frame < atFrame) return 0;
  const f = frame - atFrame;
  const p = spring({ frame: f, fps, config: { damping: 11, mass: 0.8, stiffness: 220 } });
  return interpolate(p, [0, 1], [1.8, 1.0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

// ─── Typewriter letter reveal ─────────────────────────────────────────────────
/** Returns how many characters of `text` to show at frame `f`. */
export function typewriterChars(frame: number, atFrame: number, text: string, fps = 30, charsPerSec = 24): number {
  if (frame < atFrame) return 0;
  const elapsed = (frame - atFrame) / fps;
  return Math.min(text.length, Math.floor(elapsed * charsPerSec));
}

// ─── Rotate spring in ─────────────────────────────────────────────────────────
export function rotateIn(
  frame: number,
  atFrame: number,
  fromDeg: number,
  fps = 30
): number {
  if (frame < atFrame) return fromDeg;
  const p = spring({
    frame: frame - atFrame,
    fps,
    config: { damping: 16, mass: 0.9, stiffness: 150 },
  });
  return interpolate(p, [0, 1], [fromDeg, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

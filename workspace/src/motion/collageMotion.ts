import { interpolate, spring } from "remotion";

/**
 * Hash function for deterministic pseudo-random jitter.
 * Ported from mg-styles-15 (06-collage).
 */
export function hash(a: number, b: number = 0): number {
  let h = (a * 374761393 + b * 668265263 + 1013904223) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * Seeded hand-placement stop-motion boil jitter (px X, px Y, deg Rot).
 * Quantised to stepped FPS (default 12fps for moving, 6fps for resting holds).
 */
export function boilJitter(
  id: number,
  frame: number,
  amp: number = 2.0,
  stepFps: number = 12
): { x: number; y: number; rotDeg: number } {
  const stepIndex = Math.floor((frame / 30) * stepFps);
  const jx = (hash(id, stepIndex) * 2 - 1) * amp;
  const jy = (hash(id + 71, stepIndex) * 2 - 1) * amp;
  const jrot = (hash(id + 913, stepIndex) * 2 - 1) * (amp * 0.45);
  return { x: jx, y: jy, rotDeg: jrot };
}

/**
 * Slap physics: A paper/evidence piece drops from camera onto the pinboard.
 * Hits exactly on hitFrame with squash impact (scale down) then rebound.
 * Shadow collapses as it touches the surface.
 */
export interface SlapResult {
  scale: number;
  lift: number;       // 1 = high in air, 0 = slapped flat on board
  shadowAlpha: number;
  shadowBlur: number;
  shadowOffsetY: number;
}

export function slapPhysics(
  frame: number,
  hitFrame: number,
  preFrames: number = 8
): SlapResult {
  const diff = frame - hitFrame;

  if (diff < -preFrames) {
    // Before entrance
    return { scale: 1.5, lift: 1, shadowAlpha: 0, shadowBlur: 40, shadowOffsetY: 30 };
  }

  if (diff < 0) {
    // Dropping from air
    const u = -diff / preFrames; // 1 down to 0
    return {
      scale: 1 + 0.35 * u * u + 0.08 * u,
      lift: u,
      shadowAlpha: 0.2 + 0.15 * (1 - u),
      shadowBlur: 10 + u * 40,
      shadowOffsetY: 8 + u * 32,
    };
  }

  if (diff === 0) {
    // Impact squash!
    return { scale: 0.965, lift: 0, shadowAlpha: 0.65, shadowBlur: 6, shadowOffsetY: 5 };
  }

  if (diff === 1 || diff === 2) {
    // Elastic rebound
    return { scale: 1.018, lift: 0.05, shadowAlpha: 0.55, shadowBlur: 10, shadowOffsetY: 8 };
  }

  // Settled flat
  return { scale: 1.0, lift: 0, shadowAlpha: 0.5, shadowBlur: 8, shadowOffsetY: 6 };
}

/**
 * Snap Zoom Camera: Generates Hormozi-style camera punch-ins on key impact beats.
 * E.g., at beatFrame, snaps scale from 1.0 to 1.12 with spring overshoot,
 * plus subtle continuous handheld organic drift.
 */
export function cameraSnapZoom(
  frame: number,
  beatFrames: number[],
  baseScale: number = 1.0
): { scale: number; panX: number; panY: number } {
  // Continuous organic handheld breathing drift (slow sin/cos)
  const driftX = Math.sin(frame * 0.04) * 3.5 + Math.cos(frame * 0.07) * 2.0;
  const driftY = Math.cos(frame * 0.035) * 3.0 + Math.sin(frame * 0.06) * 1.5;

  let zoomAdd = 0;
  for (const bf of beatFrames) {
    if (frame >= bf) {
      // Snap up by 6% and settle
      const punch = spring({
        frame: frame - bf,
        fps: 30,
        config: { damping: 12, stiffness: 220 },
      });
      // decay slightly after punch
      const decay = interpolate(frame - bf, [0, 45], [0.08, 0.03], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      zoomAdd = Math.max(zoomAdd, punch * decay);
    }
  }

  return {
    scale: baseScale + zoomAdd,
    panX: driftX,
    panY: driftY,
  };
}


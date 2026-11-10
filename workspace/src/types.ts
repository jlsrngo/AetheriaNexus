import type { ReactNode } from "react";

export const VIDEO_CONFIG = {
  width: 1080,
  height: 1920,
  fps: 30,
  durationInFrames: 3616, // ~120.5s total
} as const;

export const SCENE_DURATIONS = {
  scene1: 427,   // 14.235s
  scene2: 654,   // 21.795s
  scene3: 803,   // 26.755s
  scene4: 554,   // 18.455s
  scene5: 470,   // 15.655s
  scene6: 708,   // 23.595s
} as const;

export const SCENE_OFFSETS = {
  scene1: 0,
  scene2: SCENE_DURATIONS.scene1,
  scene3: SCENE_DURATIONS.scene1 + SCENE_DURATIONS.scene2,
  scene4: SCENE_DURATIONS.scene1 + SCENE_DURATIONS.scene2 + SCENE_DURATIONS.scene3,
  scene5: SCENE_DURATIONS.scene1 + SCENE_DURATIONS.scene2 + SCENE_DURATIONS.scene3 + SCENE_DURATIONS.scene4,
  scene6: SCENE_DURATIONS.scene1 + SCENE_DURATIONS.scene2 + SCENE_DURATIONS.scene3 + SCENE_DURATIONS.scene4 + SCENE_DURATIONS.scene5,
} as const;

// Flat Vector Color Palette (mg-flat-vector tokens)
export const COLORS = {
  // Core palette
  ink: "#151433",
  cream: "#FFF6E9",
  ultramarine: "#2B2BFF",
  coral: "#FF5A4E",
  sunflower: "#FFC62B",
  mint: "#2EE6A8",
  // Scene-specific
  darkCity: "#0D0D1A",
  darkCityAccent: "#1A1A2E",
  amber: "#FFBF00",
  amberGlow: "#FFD700",
  lightning: "#FFFFFF",
  stormCloud: "#1E1E3A",
  stormCloudLight: "#2D2D5E",
  voltaicCopper: "#B87333",
  voltaicZinc: "#C0C0C0",
  voltaicAcid: "#8FBC8F",
  faradayCopper: "#D98A44",
  faradayIron: "#4A4A4A",
  faradayWire: "#FFD700",
  modernCityLight: "#FFE08A",
  modernCityGlow: "#FFF8DC",
  warmWhite: "#FFFDF5",
  switchOff: "#3D3D3D",
  switchOn: "#FFD700",
} as const;

// Easing functions
export const easing = {
  easeOutBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  easeOutExpo: (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  easeOutElastic: (t: number) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  easeInOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  spring: (t: number, stiffness = 300, damping = 30) => {
    const w = Math.sqrt(stiffness);
    const z = damping / (2 * Math.sqrt(stiffness));
    if (z >= 1) return 1 - Math.exp(-w * t);
    const wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z / Math.sqrt(1 - z * z)) * Math.sin(wd * t));
  },
} as const;

// Interpolation helper with clamping
export function interpolateClamped(
  value: number,
  inputRange: [number, number],
  outputRange: [number, number],
  extrapolate: "clamp" | "extend" = "clamp"
): number {
  const [inMin, inMax] = inputRange;
  const [outMin, outMax] = outputRange;
  const t = (value - inMin) / (inMax - inMin);

  if (extrapolate === "clamp") {
    if (t <= 0) return outMin;
    if (t >= 1) return outMax;
  }
  return outMin + t * (outMax - outMin);
}

// Scale law for responsive sizing
export const u = (refPx: number): number => {
  const baseWidth = 1080;
  return (refPx / baseWidth) * VIDEO_CONFIG.width;
};

// Word timing type for kinetic subtitles
export interface WordTiming {
  word: string;
  start: number;
  duration?: number;
  end: number;
}

// Scene component props
export interface SceneProps {
  frame: number;
  words?: WordTiming[];
  audioDuration?: number;
}

// Audio paths
export const AUDIO_PATHS = {
  scene1: "audio/scene1_hook.wav",
  scene2: "audio/scene2_rahasia_alam.wav",
  scene3: "audio/scene3_langit_laboratorium.wav",
  scene4: "audio/scene4_volta_baterai.wav",
  scene5: "audio/scene5_faraday_generator.wav",
  scene6: "audio/scene6_twist_penutup.wav",
} as const;

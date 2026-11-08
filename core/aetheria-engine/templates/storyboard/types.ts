// Storyboard Engine Type Definitions (Strict TypeScript, Zero `any`)

export type StyleThemeId =
  | "editorial-kinetic"
  | "pi-v2"
  | "pi-v2-dark"
  | "mono-editorial"
  | "tech-neon-soft"
  | "warm-paper"
  | "editorial"
  | "dark-tech"
  | "clean-airy"
  | "neon-cyber"
  | "warm-minimal";

export type LayoutKind =
  | "hero-photo"
  | "headline"
  | "stat"
  | "list"
  | "terminal"
  | "cta";

export type BeatType =
  | "badge"
  | "headline"
  | "subheadline"
  | "punch"
  | "stat"
  | "card"
  | "code"
  | "cta";

export interface ResolvedBeat {
  id: string;
  type: BeatType;
  text: string;
  subtext?: string;
  accent?: string;
  startSec: number; // local seconds from scene start
  endSec?: number;  // optional local exit seconds for stage handoff
}

export interface ResolvedScene {
  index: number;
  id: string;
  narration: string;
  layout: LayoutKind;
  dark?: boolean;
  tag?: string;
  image?: string;
  statValue?: string;
  statLabel?: string;
  codeLines?: string[];
  startSec: number;
  durationSec: number;
  startFrame: number;
  durationInFrames: number;
  beats: ResolvedBeat[];
}

export interface ResolvedStoryboard {
  title: string;
  style: StyleThemeId;
  fps: number;
  width: number;
  height: number;
  totalFrames: number;
  totalDurationSec: number;
  audioFile: string;
  scenes: ResolvedScene[];
}

export interface ThemePalette {
  name: string;
  fontDisplay: string;
  fontMono: string;
  bgLight: string;
  bgDark: string;
  textLight: string;
  textDark: string;
  mutedLight: string;
  mutedDark: string;
  accent: string;
  accentSoft: string;
  accentGlow: string;
  cardLight: string;
  cardDark: string;
  borderLight: string;
  borderDark: string;
}

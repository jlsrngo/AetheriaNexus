// Aetheria Launch - Types & Tokens
// Style: Dark 3D Particle + Editorial Grid + Screen-Studio Macro + SVG Node Graph

import { TSpringConfig } from 'remotion';

export const FPS = 60;
export const WIDTH = 1920;
export const HEIGHT = 1080;

// Scene durations in frames (derived from voiceover words.json)
export const SCENE_FRAMES = [640, 1020, 730, 460];

// Strict sequential start frames - ZERO overlap
export const SCENE_START_FRAMES = SCENE_FRAMES.reduce((acc: number[], _, i) => {
  if (i === 0) acc.push(0);
  else acc.push(acc[i - 1] + SCENE_FRAMES[i - 1]);
  return acc;
}, []);

export const TOTAL_FRAMES = SCENE_FRAMES.reduce((sum, f) => sum + f, 0);

// Color tokens - Scene 1 Dark, Scenes 2-4 Editorial
export const COLORS = {
  // Scene 1: Dark 3D Particle
  darkBg: '#0C0B0B',
  emeraldSage: '#4D5E4E',
  warmGold: '#E2C07D',
  accentRed: '#D96B43',
  white: '#FFFFFF',
  
  // Scenes 2-4: Editorial Grid
  editorialBg: '#F2ECE5',
  primaryText: '#121212',
  brandAccent: '#9E977A',
  cardSurface: '#F4F4F6',
  border: 'rgba(0,0,0,0.08)',
  mintSage: '#6B8E7A',
  
  // End card
  endCardBg: '#0C0B0B',
};

export const FONT_FAMILY = {
  sans: 'Inter, system-ui, -apple-system, sans-serif',
  serif: 'Playfair Display, Georgia, serif',
  mono: 'JetBrains Mono, monospace',
};

export const SPRING_CONFIGS: Record<string, TSpringConfig> = {
  fastPop: { damping: 12, stiffness: 180 },
  smooth: { damping: 20, stiffness: 100 },
  slow: { damping: 30, stiffness: 60 },
  bouncy: { damping: 8, stiffness: 220 },
};

export interface SceneProps {
  frame: number;
  startFrame?: number;
}

export interface FloatingCapsuleProps {
  frame: number;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  delay: number;
  color: string;
  blur?: boolean;
  type?: 'pill' | 'star' | 'cross' | 'badge';
}

export interface PillCardProps {
  frame: number;
  text: string;
  x: number;
  y: number;
  delay: number;
  width?: number;
}

export interface WorkstationUIProps {
  frame: number;
  showCursor?: boolean;
  zoom?: number;
}

export interface NodeGraphProps {
  frame: number;
  nodes: Array<{ id: string; label: string; x: number; y: number }>;
}

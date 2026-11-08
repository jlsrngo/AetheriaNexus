import { StyleThemeId, ThemePalette } from "./types";

/**
 * Direct 1:1 integration of Motioncraft's 5 official styles
 * Source of truth: .agents/skills/motioncraft/styles/
 */
const MONO_EDITORIAL: ThemePalette = {
  name: "mono-editorial",
  fontDisplay: "'Newsreader', serif, system-ui",
  fontMono: "'IBM Plex Mono', monospace",
  bgLight: "#FAF7F2",
  bgDark: "#0A0A0A",
  textLight: "#111111",
  textDark: "#FFFFFF",
  mutedLight: "#6F6F6F",
  mutedDark: "#A1A1AA",
  accent: "#A3241C",
  accentSoft: "rgba(163, 36, 28, 0.16)",
  accentGlow: "rgba(163, 36, 28, 0.45)",
  cardLight: "#FFFFFF",
  cardDark: "#141418",
  borderLight: "rgba(24, 24, 27, 0.14)",
  borderDark: "rgba(255, 255, 255, 0.18)",
};

const PI_V2: ThemePalette = {
  name: "pi-v2",
  fontDisplay: "'Figtree', sans-serif, system-ui",
  fontMono: "'JetBrains Mono', monospace",
  bgLight: "#F7F8FA",
  bgDark: "#0F172A",
  textLight: "#16181D",
  textDark: "#F8FAFC",
  mutedLight: "#8A909B",
  mutedDark: "#94A3B8",
  accent: "#2B7FD4",
  accentSoft: "rgba(43, 127, 212, 0.16)",
  accentGlow: "rgba(43, 127, 212, 0.45)",
  cardLight: "#FFFFFF",
  cardDark: "#1E293B",
  borderLight: "rgba(20, 40, 80, 0.08)",
  borderDark: "rgba(255, 255, 255, 0.15)",
};

const PI_V2_DARK: ThemePalette = {
  name: "pi-v2-dark",
  fontDisplay: "'Figtree', sans-serif, system-ui",
  fontMono: "'JetBrains Mono', monospace",
  bgLight: "#0F1217",
  bgDark: "#0D0F13",
  textLight: "#F2F4F7",
  textDark: "#FFFFFF",
  mutedLight: "#9AA3B2",
  mutedDark: "#9AA3B2",
  accent: "#5AA9F5",
  accentSoft: "rgba(90, 169, 245, 0.18)",
  accentGlow: "rgba(90, 169, 245, 0.45)",
  cardLight: "#1C2029",
  cardDark: "#171A21",
  borderLight: "rgba(255, 255, 255, 0.12)",
  borderDark: "rgba(90, 169, 245, 0.28)",
};

const TECH_NEON_SOFT: ThemePalette = {
  name: "tech-neon-soft",
  fontDisplay: "'Space Grotesk', sans-serif, system-ui",
  fontMono: "'JetBrains Mono', monospace",
  bgLight: "#0E1020",
  bgDark: "#0B0C16",
  textLight: "#EEF1FF",
  textDark: "#FFFFFF",
  mutedLight: "#9BA3C7",
  mutedDark: "#9BA3C7",
  accent: "#7CF0C8",
  accentSoft: "rgba(124, 240, 200, 0.18)",
  accentGlow: "rgba(124, 240, 200, 0.45)",
  cardLight: "#191C33",
  cardDark: "#141629",
  borderLight: "rgba(160, 170, 255, 0.15)",
  borderDark: "rgba(124, 240, 200, 0.32)",
};

const WARM_PAPER: ThemePalette = {
  name: "warm-paper",
  fontDisplay: "'Manrope', sans-serif, system-ui",
  fontMono: "'IBM Plex Mono', monospace",
  bgLight: "#FAF7F1",
  bgDark: "#1C1917",
  textLight: "#221C16",
  textDark: "#FAF7F1",
  mutedLight: "#857A6C",
  mutedDark: "#A8A29E",
  accent: "#C2552D",
  accentSoft: "rgba(194, 85, 45, 0.16)",
  accentGlow: "rgba(194, 85, 45, 0.42)",
  cardLight: "#FFFDF9",
  cardDark: "#292524",
  borderLight: "rgba(80, 50, 20, 0.1)",
  borderDark: "rgba(250, 246, 240, 0.16)",
};

export const THEMES: Record<StyleThemeId, ThemePalette> = {
  // Official Motioncraft & Editorial Kinetic styles
  "editorial-kinetic": {
    name: "editorial-kinetic",
    fontDisplay: "'Inter', sans-serif, system-ui",
    fontMono: "'JetBrains Mono', monospace",
    bgLight: "#F4F1EA",
    bgDark: "#0A0A0A",
    textLight: "#111111",
    textDark: "#FFFFFF",
    mutedLight: "#71717A",
    mutedDark: "#A1A1AA",
    accent: "#FF2424",
    accentSoft: "rgba(255, 36, 36, 0.16)",
    accentGlow: "rgba(255, 36, 36, 0.45)",
    cardLight: "#FFFFFF",
    cardDark: "#141418",
    borderLight: "rgba(24, 24, 27, 0.14)",
    borderDark: "rgba(255, 255, 255, 0.18)",
  },
  "mono-editorial": MONO_EDITORIAL,
  "pi-v2": PI_V2,
  "pi-v2-dark": PI_V2_DARK,
  "tech-neon-soft": TECH_NEON_SOFT,
  "warm-paper": WARM_PAPER,

  // Semantic Aliases
  editorial: MONO_EDITORIAL,
  "clean-airy": PI_V2,
  "dark-tech": PI_V2_DARK,
  "neon-cyber": TECH_NEON_SOFT,
  "warm-minimal": WARM_PAPER,
};

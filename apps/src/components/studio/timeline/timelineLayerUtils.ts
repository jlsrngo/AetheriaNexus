import type { VideoLayerSpec } from "../../../types/video";
import type { HtmlFilmScene } from "../HtmlFilmStage";

const SCENE_COLORS = ["amber", "sky", "violet", "indigo", "rose", "cyan"] as const;

export interface FilmMetaLintIssue {
  severity: string;
  code: string;
  message: string;
  line?: number | null;
}

export interface FilmMetaLintReport {
  valid: boolean;
  hasRenderAt: boolean;
  hasReadyFlag: boolean;
  hasFilmMeta: boolean;
  issues: FilmMetaLintIssue[];
}

export interface FilmMetaResponse {
  exists?: boolean;
  engine?: string;
  htmlPath?: string;
  title?: string;
  width?: number;
  height?: number;
  fps?: number;
  duration?: number;
  totalFrames?: number;
  scenes?: HtmlFilmScene[];
  lint?: FilmMetaLintReport;
}

export interface TimelineDragOverride {
  id: string;
  from: number;
  durationInFrames: number;
}

export interface PremiereClipPalette {
  badge: string;
  icon: string;
  clip: string;
  selected: string;
  dot: string;
  handle: string;
  customHex?: string;
}

export const PREMIERE_PALETTES: Record<string, PremiereClipPalette> = {
  violet: {
    badge: "text-[#DDD6FE] bg-[#2E1065] border-[#6D28D9]",
    icon: "text-[#A78BFA]",
    clip: "bg-[#3B1D6E] border-[#7C3AED] text-[#F5F3FF]",
    selected: "ring-1 ring-[#C4B5FD] border-[#C4B5FD] bg-[#4C1D95]",
    dot: "bg-[#A78BFA]",
    handle: "bg-[#5B21B6] hover:bg-[#7C3AED]",
  },
  cyan: {
    badge: "text-[#A5F3FC] bg-[#083344] border-[#0891B2]",
    icon: "text-[#22D3EE]",
    clip: "bg-[#134E63] border-[#06B6D4] text-[#ECFEFF]",
    selected: "ring-1 ring-[#67E8F9] border-[#67E8F9] bg-[#155E75]",
    dot: "bg-[#22D3EE]",
    handle: "bg-[#0E7490] hover:bg-[#06B6D4]",
  },
  rose: {
    badge: "text-[#FECDD3] bg-[#4C0519] border-[#E11D48]",
    icon: "text-[#FB7185]",
    clip: "bg-[#65162E] border-[#F43F5E] text-[#FFF1F2]",
    selected: "ring-1 ring-[#FDA4AF] border-[#FDA4AF] bg-[#881337]",
    dot: "bg-[#FB7185]",
    handle: "bg-[#9F1239] hover:bg-[#F43F5E]",
  },
  amber: {
    badge: "text-[#FDE68A] bg-[#451A03] border-[#D97706]",
    icon: "text-[#FBBF24]",
    clip: "bg-[#5C2D0C] border-[#F59E0B] text-[#FFFBEB]",
    selected: "ring-1 ring-[#FCD34D] border-[#FCD34D] bg-[#78350F]",
    dot: "bg-[#FBBF24]",
    handle: "bg-[#92400E] hover:bg-[#F59E0B]",
  },
  sky: {
    badge: "text-[#BAE6FD] bg-[#082F49] border-[#0284C7]",
    icon: "text-[#38BDF8]",
    clip: "bg-[#124264] border-[#0EA5E9] text-[#F0F9FF]",
    selected: "ring-1 ring-[#7DD3FC] border-[#7DD3FC] bg-[#075985]",
    dot: "bg-[#38BDF8]",
    handle: "bg-[#0369A1] hover:bg-[#0EA5E9]",
  },
  fuchsia: {
    badge: "text-[#F5D0FE] bg-[#4A044E] border-[#C026D3]",
    icon: "text-[#E879F9]",
    clip: "bg-[#5E1666] border-[#D946EF] text-[#FDF4FF]",
    selected: "ring-1 ring-[#F0ABFC] border-[#F0ABFC] bg-[#701A75]",
    dot: "bg-[#E879F9]",
    handle: "bg-[#86198F] hover:bg-[#D946EF]",
  },
  orange: {
    badge: "text-[#FED7AA] bg-[#431407] border-[#EA580C]",
    icon: "text-[#FB923C]",
    clip: "bg-[#63230F] border-[#F97316] text-[#FFF7ED]",
    selected: "ring-1 ring-[#FDBA74] border-[#FDBA74] bg-[#7C2D12]",
    dot: "bg-[#FB923C]",
    handle: "bg-[#9A3412] hover:bg-[#F97316]",
  },
  indigo: {
    badge: "text-[#C7D2FE] bg-[#1E1B4B] border-[#4F46E5]",
    icon: "text-[#818CF8]",
    clip: "bg-[#282466] border-[#6366F1] text-[#EEF2FF]",
    selected: "ring-1 ring-[#A5B4FC] border-[#A5B4FC] bg-[#312E81]",
    dot: "bg-[#818CF8]",
    handle: "bg-[#3730A3] hover:bg-[#6366F1]",
  },
  pink: {
    badge: "text-[#FBCFE8] bg-[#500724] border-[#DB2777]",
    icon: "text-[#F472B6]",
    clip: "bg-[#681438] border-[#EC4899] text-[#FDF2F8]",
    selected: "ring-1 ring-[#F9A8D4] border-[#F9A8D4] bg-[#831843]",
    dot: "bg-[#F472B6]",
    handle: "bg-[#9D174D] hover:bg-[#EC4899]",
  },
  blue: {
    badge: "text-[#BFDBFE] bg-[#172554] border-[#2563EB]",
    icon: "text-[#60A5FA]",
    clip: "bg-[#1E346E] border-[#3B82F6] text-[#EFF6FF]",
    selected: "ring-1 ring-[#93C5FD] border-[#93C5FD] bg-[#1E40AF]",
    dot: "bg-[#60A5FA]",
    handle: "bg-[#1D4ED8] hover:bg-[#3B82F6]",
  },
  purple: {
    badge: "text-[#E9D5FF] bg-[#3B0764] border-[#9333EA]",
    icon: "text-[#C084FC]",
    clip: "bg-[#4E1478] border-[#A855F7] text-[#FAF5FF]",
    selected: "ring-1 ring-[#D8B4FE] border-[#D8B4FE] bg-[#581C87]",
    dot: "bg-[#C084FC]",
    handle: "bg-[#6B21A8] hover:bg-[#A855F7]",
  },
  slate: {
    badge: "text-[#E2E8F0] bg-[#1E293B] border-[#475569]",
    icon: "text-[#94A3B8]",
    clip: "bg-[#273549] border-[#64748B] text-[#F8FAFC]",
    selected: "ring-1 ring-[#CBD5E1] border-[#CBD5E1] bg-[#334155]",
    dot: "bg-[#CBD5E1]",
    handle: "bg-[#475569] hover:bg-[#64748B]",
  },
};

export const PALETTE_CYCLE = [
  "violet",
  "cyan",
  "rose",
  "amber",
  "sky",
  "fuchsia",
  "orange",
  "indigo",
  "pink",
  "blue",
  "purple",
  "slate",
] as const;

const DEFAULT_LAYER_PALETTE_BY_ID: Record<string, keyof typeof PREMIERE_PALETTES> = {
  "hud-category": "violet",
  "hud-subcategory": "cyan",
  "text-hook": "rose",
  "text-bullet-0": "amber",
  "text-bullet-1": "sky",
  "text-bullet-2": "fuchsia",
  "footer-icon": "orange",
  "footer-author": "indigo",
  "footer-tag": "pink",
  "bg-grid-pattern": "blue",
  "bg-orb-pattern": "purple",
  "bg-base": "slate",
};

export function getLayerPalette(
  layer: VideoLayerSpec,
  idx: number,
  layerColors?: Record<string, string>
): PremiereClipPalette {
  const key = layerColors?.[layer.id] || layer.color;
  if (key && PREMIERE_PALETTES[key]) {
    return PREMIERE_PALETTES[key];
  }
  if (key && key.startsWith("#")) {
    return {
      badge: "text-white bg-black/60 border-white/40",
      icon: "text-white",
      clip: "text-white border-white/40",
      selected: "ring-1 ring-white border-white",
      dot: "bg-white",
      handle: "bg-white/40 hover:bg-white/80",
      customHex: key,
    };
  }
  const fallbackKey =
    DEFAULT_LAYER_PALETTE_BY_ID[layer.id] ??
    PALETTE_CYCLE[idx % PALETTE_CYCLE.length];
  return PREMIERE_PALETTES[fallbackKey] || PREMIERE_PALETTES.violet;
}

export function buildDynamicHtmlSceneLayers(
  meta: FilmMetaResponse | null,
  totalFrames: number
): VideoLayerSpec[] | null {
  if (!meta?.exists || !Array.isArray(meta.scenes) || meta.scenes.length === 0) {
    return null;
  }
  const scenes = meta.scenes;
  const hasAudio = scenes.some((s) => Boolean(s.audio));
  const layers: VideoLayerSpec[] = [];
  if (hasAudio) {
    layers.push({
      id: "audio-master-voiceover",
      trackCode: "A1",
      label: `Audio: ${meta.title || "HTML Motion Voiceover"}`,
      kind: "audio",
      content: `${scenes.length} Scene Audio Tracks`,
      color: "cyan",
      from: 0,
      durationInFrames: Math.max(1, meta.totalFrames || totalFrames),
      visible: true,
    });
  }
  scenes.forEach((scene, idx) => {
    layers.push({
      id: `scene-block-${scene.id}`,
      trackCode: `V${scenes.length - idx}`,
      label: scene.title || scene.id,
      kind: "video",
      content: scene.title || scene.id,
      color: SCENE_COLORS[idx % SCENE_COLORS.length],
      from: Math.max(0, scene.startFrame),
      durationInFrames: Math.max(1, scene.durationFrames),
      visible: true,
      isCustom: true,
    });
  });
  return layers;
}


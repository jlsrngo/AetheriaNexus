export interface VideoLayerSpec {
  id: string;
  trackCode: string;
  label: string;
  kind: "background" | "pattern" | "icon" | "text";
  from: number;
  durationInFrames: number;
  visible: boolean;
}

export interface NexusVideoProps extends Record<string, unknown> {
  hookText: string;
  bodyText: string;
  authorHandle: string;
  themeColor: "orange" | "emerald" | "violet" | "rose" | "amber" | "cyan";
  category: string;
  subCategory?: string;
  editorialTag?: string;
  showText?: boolean;
  showBackground?: boolean;
  isMuted?: boolean;
  /** Per-layer visibility map (keyed by layer id) */
  layerVisibility?: Record<string, boolean>;
  /** Per-layer start frame override (Premiere clip position) */
  layerStartFrame?: Record<string, number>;
  /** Per-layer duration override in frames (Premiere clip length) */
  layerDuration?: Record<string, number>;
}

/**
 * Backward compatibility alias for legacy references
 */
export type TikTokVideoProps = NexusVideoProps;

export const defaultNexusVideoProps: NexusVideoProps = {
  hookText: "3 Morning Habits of High Performers You Never Knew",
  bodyText:
    "1. Drink 500ml of mineral water before checking your phone\n2. 10 minutes of light stretching to boost mental focus\n3. Write down your single most critical priority for today",
  authorHandle: "@nexus.creative",
  themeColor: "orange",
  category: "PRODUCTIVITY",
  subCategory: "EXECUTIVE HABITS",
  editorialTag: "NEXUS // EDITORIAL SHORT",
  showText: true,
  showBackground: true,
  layerVisibility: {},
  layerStartFrame: {},
  layerDuration: {},
};

export const defaultTikTokProps: NexusVideoProps = defaultNexusVideoProps;

/** Shared by the Composition registration and the in-app preview so the two cannot drift. */
export const nexusVideoSpec = {
  id: "NexusEditorialVideo",
  durationInFrames: 150,
  fps: 30,
  width: 1080,
  height: 1920,
} as const;

/**
 * Decomposes the video into individual Premiere-style NLE tracks so every
 * badge, text block, bullet point, icon, and background pattern has its own
 * independent <Sequence> clip.
 */
export function buildCompositionLayers(
  props: NexusVideoProps,
  totalFrames: number
): VideoLayerSpec[] {
  const vis = props.layerVisibility || {};
  const starts = props.layerStartFrame || {};
  const durations = props.layerDuration || {};
  const showBg = props.showBackground !== false;
  const showTxt = props.showText !== false;

  const isLayerVisible = (id: string, groupEnabled: boolean) =>
    groupEnabled && vis[id] !== false;

  const resolveTiming = (id: string, defaultFrom: number) => {
    const from = Math.max(
      0,
      Math.min(totalFrames - 5, Math.round(starts[id] ?? defaultFrom))
    );
    const maxDur = Math.max(5, totalFrames - from);
    const dur = Math.max(
      5,
      Math.min(maxDur, Math.round(durations[id] ?? maxDur))
    );
    return { from, durationInFrames: dur };
  };

  const bodyLines = (props.bodyText || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const rawLayers: Array<Omit<VideoLayerSpec, "trackCode">> = [
    {
      id: "hud-category",
      label: `Badge Kiri: // ${props.category || "CATEGORY"}`,
      kind: "icon",
      ...resolveTiming("hud-category", 0),
      visible: isLayerVisible("hud-category", showTxt),
    },
    {
      id: "hud-subcategory",
      label: `Label Kanan: [ ${props.subCategory || "SUBCATEGORY"} ]`,
      kind: "text",
      ...resolveTiming("hud-subcategory", 4),
      visible: isLayerVisible("hud-subcategory", showTxt),
    },
    {
      id: "text-hook",
      label: `Judul Hook: "${(props.hookText || "").slice(0, 24)}..."`,
      kind: "text",
      ...resolveTiming("text-hook", 8),
      visible: isLayerVisible("text-hook", showTxt),
    },
    ...bodyLines.map((line, idx) => {
      const id = `text-bullet-${idx}`;
      const defaultStart = Math.min(totalFrames - 15, 20 + idx * 14);
      return {
        id,
        label: `Poin #${idx + 1}: ${line.slice(0, 26)}`,
        kind: "text" as const,
        ...resolveTiming(id, defaultStart),
        visible: isLayerVisible(id, showTxt),
      };
    }),
    {
      id: "footer-icon",
      label: "Ikon Petir: [⚡] Avatar Box",
      kind: "icon",
      ...resolveTiming("footer-icon", 32),
      visible: isLayerVisible("footer-icon", showTxt),
    },
    {
      id: "footer-author",
      label: `Author: ${props.authorHandle || "@nexus.creative"}`,
      kind: "text",
      ...resolveTiming("footer-author", 36),
      visible: isLayerVisible("footer-author", showTxt),
    },
    {
      id: "footer-tag",
      label: `Badge Kanan Bawah: ${props.editorialTag || "NEXUS // EDITORIAL SHORT"}`,
      kind: "icon",
      ...resolveTiming("footer-tag", 40),
      visible: isLayerVisible("footer-tag", showTxt),
    },
    {
      id: "bg-grid-pattern",
      label: "Corak: Blueprint Grid",
      kind: "pattern",
      ...resolveTiming("bg-grid-pattern", 0),
      visible: isLayerVisible("bg-grid-pattern", showBg),
    },
    {
      id: "bg-orb-pattern",
      label: "Corak: Ambient Glow Orb",
      kind: "pattern",
      ...resolveTiming("bg-orb-pattern", 0),
      visible: isLayerVisible("bg-orb-pattern", showBg),
    },
    {
      id: "bg-base",
      label: "Background: Radial Gradient",
      kind: "background",
      ...resolveTiming("bg-base", 0),
      visible: isLayerVisible("bg-base", showBg),
    },
  ];

  const totalCount = rawLayers.length;
  return rawLayers.map((layer, index) => ({
    ...layer,
    trackCode: `V${totalCount - index}`,
  }));
}

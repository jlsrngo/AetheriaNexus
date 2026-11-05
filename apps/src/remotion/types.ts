export interface VideoLayerSpec {
  id: string;
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
  showText?: boolean;
  showBackground?: boolean;
  isMuted?: boolean;
  /** Per-layer visibility map (keyed by layer id) */
  layerVisibility?: Record<string, boolean>;
  /** Optional per-layer start frame override */
  layerStartFrame?: Record<string, number>;
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
  showText: true,
  showBackground: true,
  layerVisibility: {},
  layerStartFrame: {},
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
 * Computes the decomposed multi-layer structure for a composition so both
 * <NexusVideoComposition /> (Remotion <Sequence> tree) and <Timeline /> render
 * the exact same layers.
 */
export function buildCompositionLayers(
  props: NexusVideoProps,
  totalFrames: number
): VideoLayerSpec[] {
  const vis = props.layerVisibility || {};
  const starts = props.layerStartFrame || {};
  const showBg = props.showBackground !== false;
  const showTxt = props.showText !== false;

  const isLayerVisible = (id: string, groupEnabled: boolean) =>
    groupEnabled && vis[id] !== false;

  const getFrom = (id: string, defaultFrom: number) =>
    Math.max(0, Math.min(totalFrames - 5, starts[id] ?? defaultFrom));

  const bodyLines = (props.bodyText || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const layers: VideoLayerSpec[] = [
    {
      id: "bg-base",
      label: "Background: Radial Base",
      kind: "background",
      from: getFrom("bg-base", 0),
      durationInFrames: totalFrames - getFrom("bg-base", 0),
      visible: isLayerVisible("bg-base", showBg),
    },
    {
      id: "bg-orb-pattern",
      label: "Corak: Ambient Glow Orb",
      kind: "pattern",
      from: getFrom("bg-orb-pattern", 0),
      durationInFrames: totalFrames - getFrom("bg-orb-pattern", 0),
      visible: isLayerVisible("bg-orb-pattern", showBg),
    },
    {
      id: "bg-grid-pattern",
      label: "Corak: Blueprint Grid",
      kind: "pattern",
      from: getFrom("bg-grid-pattern", 0),
      durationInFrames: totalFrames - getFrom("bg-grid-pattern", 0),
      visible: isLayerVisible("bg-grid-pattern", showBg),
    },
    {
      id: "hud-category",
      label: `Badge: // ${props.category || "CATEGORY"}`,
      kind: "icon",
      from: getFrom("hud-category", 0),
      durationInFrames: totalFrames - getFrom("hud-category", 0),
      visible: isLayerVisible("hud-category", showTxt),
    },
    {
      id: "text-hook",
      label: `Text Hook: "${(props.hookText || "").slice(0, 26)}..."`,
      kind: "text",
      from: getFrom("text-hook", 5),
      durationInFrames: Math.max(10, totalFrames - getFrom("text-hook", 5)),
      visible: isLayerVisible("text-hook", showTxt),
    },
  ];

  bodyLines.forEach((line, idx) => {
    const id = `text-bullet-${idx}`;
    const defaultStart = Math.min(totalFrames - 15, 22 + idx * 14);
    const from = getFrom(id, defaultStart);
    layers.push({
      id,
      label: `Text #${idx + 1}: ${line.slice(0, 28)}`,
      kind: "text",
      from,
      durationInFrames: Math.max(10, totalFrames - from),
      visible: isLayerVisible(id, showTxt),
    });
  });

  const iconFrom = getFrom("footer-icon", 30);
  layers.push({
    id: "footer-icon",
    label: "Icon: Bolt Badge (⚡)",
    kind: "icon",
    from: iconFrom,
    durationInFrames: Math.max(10, totalFrames - iconFrom),
    visible: isLayerVisible("footer-icon", showTxt),
  });

  const authorFrom = getFrom("footer-author", 35);
  layers.push({
    id: "footer-author",
    label: `Text Author: ${props.authorHandle || "@nexus"}`,
    kind: "text",
    from: authorFrom,
    durationInFrames: Math.max(10, totalFrames - authorFrom),
    visible: isLayerVisible("footer-author", showTxt),
  });

  return layers;
}

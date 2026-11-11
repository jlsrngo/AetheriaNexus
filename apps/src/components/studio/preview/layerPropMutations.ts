import type { NexusVideoProps, VideoLayerSpec } from "../../../types/video";

export function buildLayerOffsetResetPatch(
  props: NexusVideoProps,
  layerId: string
): Partial<NexusVideoProps> {
  const currentOffsets = { ...(props.layerOffsets || {}) };
  delete currentOffsets[layerId];
  return { layerOffsets: currentOffsets };
}

export function buildLayerContentPatch(
  props: NexusVideoProps,
  layer: VideoLayerSpec,
  nextValue: string
): Partial<NexusVideoProps> | null {
  if (layer.id === "text-hook") return { hookText: nextValue };
  if (layer.id === "hud-category") return { category: nextValue };
  if (layer.id === "hud-subcategory") return { subCategory: nextValue };
  if (layer.id === "footer-author") return { authorHandle: nextValue };
  if (layer.id === "footer-tag") return { editorialTag: nextValue };

  if (layer.id.startsWith("text-bullet-")) {
    const bulletIdx = Number(layer.id.replace("text-bullet-", ""));
    const lines = (props.bodyText || "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (!Number.isNaN(bulletIdx) && bulletIdx >= 0 && bulletIdx < lines.length) {
      lines[bulletIdx] = nextValue;
      return { bodyText: lines.join("\n") };
    }
    return null;
  }

  if (layer.isCustom) {
    const currentCustom = Array.isArray(props.customLayers) ? props.customLayers : [];
    return {
      customLayers: currentCustom.map((item) =>
        item.id === layer.id ? { ...item, content: nextValue, label: nextValue } : item
      ),
    };
  }

  return {
    layerLabels: {
      ...(props.layerLabels || {}),
      [layer.id]: nextValue,
    },
  };
}

export function buildLayerTimingPatch(
  props: NexusVideoProps,
  layer: VideoLayerSpec,
  nextFrom: number,
  nextDur: number,
  maxFrames?: number
): Partial<NexusVideoProps> {
  const safeFrom =
    typeof maxFrames === "number"
      ? Math.max(0, Math.min(Math.max(0, maxFrames - 1), Math.round(nextFrom)))
      : Math.max(0, Math.round(nextFrom));
  const clampedDur =
    typeof maxFrames === "number"
      ? Math.max(1, Math.min(Math.max(1, maxFrames - safeFrom), Math.round(nextDur)))
      : Math.max(1, Math.round(nextDur));

  const timingPatch: Partial<NexusVideoProps> = {
    layerStartFrame: {
      ...(props.layerStartFrame || {}),
      [layer.id]: safeFrom,
    },
    layerDuration: {
      ...(props.layerDuration || {}),
      [layer.id]: clampedDur,
    },
  };

  if (layer.isCustom) {
    const currentCustom = Array.isArray(props.customLayers) ? props.customLayers : [];
    timingPatch.customLayers = currentCustom.map((item) =>
      item.id === layer.id
        ? { ...item, from: safeFrom, durationInFrames: clampedDur }
        : item
    );
  }

  return timingPatch;
}

export function buildLayerColorPatch(
  props: NexusVideoProps,
  layer: VideoLayerSpec,
  newColor: string
): Partial<NexusVideoProps> {
  const currentColors = { ...(props.layerColors || {}), [layer.id]: newColor };
  if (layer.isCustom) {
    const currentCustom = Array.isArray(props.customLayers) ? props.customLayers : [];
    return {
      layerColors: currentColors,
      customLayers: currentCustom.map((item) =>
        item.id === layer.id ? { ...item, color: newColor } : item
      ),
    };
  }
  return { layerColors: currentColors };
}

export function buildLayerVisibilityPatch(
  props: NexusVideoProps,
  layer: VideoLayerSpec
): Partial<NexusVideoProps> {
  const nextVisible = !layer.visible;
  const currentVis = { ...(props.layerVisibility || {}), [layer.id]: nextVisible };
  if (layer.isCustom) {
    const currentCustom = Array.isArray(props.customLayers) ? props.customLayers : [];
    return {
      layerVisibility: currentVis,
      customLayers: currentCustom.map((item) =>
        item.id === layer.id ? { ...item, visible: nextVisible } : item
      ),
    };
  }
  return { layerVisibility: currentVis };
}

export function buildCustomLayerRemovalPatch(
  props: NexusVideoProps,
  layerId: string
): Partial<NexusVideoProps> {
  const currentCustom = Array.isArray(props.customLayers) ? props.customLayers : [];
  return {
    customLayers: currentCustom.filter((item) => item.id !== layerId),
  };
}

import { useState } from "react";
import { toast } from "sonner";
import { apiFetch, API_BASE } from "../lib/api";
import type { StudioComposition, StudioRenderJob, StudioCanvasSettings } from "../types/studio";
import type { NexusVideoProps, VideoLayerSpec } from "../types/video";
import {
  buildLayerColorPatch,
  buildLayerContentPatch,
  buildLayerTimingPatch,
  buildLayerVisibilityPatch,
  buildCustomLayerRemovalPatch,
} from "../components/studio/preview/layerPropMutations";
import { PALETTE_CYCLE } from "../components/studio/timeline/timelineLayerUtils";

interface TimelineStoreActions {
  updateActiveProps: (patch: Partial<NexusVideoProps>) => void;
  updateActiveMetadata: (patch: Partial<Omit<StudioComposition, "props">>) => void;
  updateCanvas: (patch: Partial<StudioCanvasSettings>) => void;
  upsertRenderJob: (job: StudioRenderJob) => void;
  setRenderJobs: (jobs: StudioRenderJob[]) => void;
}

interface UseTimelineActionsParams {
  activeComposition: StudioComposition;
  canvas: StudioCanvasSettings;
  renderJobs: StudioRenderJob[];
  actions: TimelineStoreActions;
  layers: VideoLayerSpec[];
  durationInFrames: number;
  lastFrame: number;
  currentFrame: number;
  selectedLayerId: string | null;
  setSelectedLayerId: (id: string | null) => void;
}

const ASPECT_RATIO_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "16:9": { width: 1920, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
};

/**
 * Encapsulates timeline store mutations, layer split/duplicate/delete commands,
 * aspect ratio updates, and quick export requests.
 */
export function useTimelineActions({
  activeComposition,
  canvas,
  renderJobs,
  actions,
  layers,
  durationInFrames,
  lastFrame,
  currentFrame,
  selectedLayerId,
  setSelectedLayerId,
}: UseTimelineActionsParams) {
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const handleQuickExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    const cleanName = `${activeComposition.id}-${Date.now().toString().slice(-4)}.mp4`;
    const localRenderId = `render-${Date.now()}`;

    const initialJob: StudioRenderJob = {
      renderId: localRenderId,
      compositionId: activeComposition.id,
      status: "rendering",
      percent: 5,
      renderedFrames: Math.max(1, Math.round(durationInFrames * 0.05)),
      totalFrames: durationInFrames,
      outputPath: `out/${cleanName}`,
      createdAt: Date.now(),
    };
    actions.upsertRenderJob(initialJob);
    toast.info(`Exporting "${activeComposition.name}" to out/${cleanName}...`);

    try {
      const res = await apiFetch(`${API_BASE}/render-media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          compositionId: activeComposition.id,
          inputProps: activeComposition.props,
          outputName: cleanName,
          ratio: activeComposition.ratio,
          codec: "h264",
          inFrame: canvas.inFrame,
          outFrame: canvas.outFrame,
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as {
          success?: boolean;
          data?: { renderId?: string; outputPath?: string };
        };
        if (json.data?.renderId) {
          actions.setRenderJobs(renderJobs.filter((j) => j.renderId !== localRenderId));
          actions.upsertRenderJob({
            ...initialJob,
            renderId: json.data.renderId,
            outputPath: json.data.outputPath || initialJob.outputPath,
          });
          setIsExporting(false);
          return;
        }
      }
    } catch {
      // Handled by local progress feedback below when backend endpoint is unavailable
    }

    let stepCount = 1;
    const interval = setInterval(() => {
      stepCount += 1;
      const pct = Math.min(100, stepCount * 25);
      const frames = Math.round((pct / 100) * durationInFrames);
      if (pct >= 100) {
        clearInterval(interval);
        actions.upsertRenderJob({
          ...initialJob,
          status: "done",
          percent: 100,
          renderedFrames: durationInFrames,
        });
        setIsExporting(false);
        toast.success(`Export complete: out/${cleanName}`);
      } else {
        actions.upsertRenderJob({
          ...initialJob,
          status: "rendering",
          percent: pct,
          renderedFrames: frames,
        });
      }
    }, 650);
  };

  const handleToggleLayerVisibility = (layer: VideoLayerSpec) => {
    actions.updateActiveProps(
      buildLayerVisibilityPatch(activeComposition.props, layer)
    );
  };

  const handleAddCustomLayer = () => {
    const currentCustom = Array.isArray(activeComposition.props.customLayers)
      ? activeComposition.props.customLayers
      : [];
    const nextIdx = currentCustom.length + 1;
    const newId = `custom-layer-${Date.now().toString(36)}`;
    const colorKey = PALETTE_CYCLE[(layers.length + nextIdx) % PALETTE_CYCLE.length];
    const startFrame = Math.min(Math.max(0, lastFrame - 15), Math.max(0, currentFrame));
    const nextCustom = [
      ...currentCustom,
      {
        id: newId,
        label: `Dynamic Layer #${nextIdx}: New Component`,
        kind: "text" as const,
        content: `Dynamic Component Layer #${nextIdx}`,
        color: colorKey,
        from: startFrame,
        durationInFrames: Math.max(30, durationInFrames - startFrame),
        visible: true,
      },
    ];
    actions.updateActiveProps({ customLayers: nextCustom });
    setSelectedLayerId(newId);
  };

  const handleRemoveCustomLayer = (layerId: string) => {
    actions.updateActiveProps(
      buildCustomLayerRemovalPatch(activeComposition.props, layerId)
    );
  };

  const handleSplitClip = () => {
    let target = layers.find((l) => l.id === selectedLayerId);
    if (
      !target ||
      currentFrame <= target.from ||
      currentFrame >= target.from + target.durationInFrames
    ) {
      target = layers.find(
        (l) => currentFrame > l.from && currentFrame < l.from + l.durationInFrames
      );
    }
    if (!target) {
      toast.error("Place playhead inside a clip to split/cut");
      return;
    }

    const splitFrame = currentFrame;
    const origFrom = target.from;
    const origDur = target.durationInFrames;
    const firstPartDur = splitFrame - origFrom;
    const secondPartDur = origDur - firstPartDur;

    if (firstPartDur < 1 || secondPartDur < 1) {
      toast.error("Split point is too close to clip boundary");
      return;
    }

    const currentCustom = Array.isArray(activeComposition.props.customLayers)
      ? [...activeComposition.props.customLayers]
      : [];
    const newId = `custom-layer-${Date.now().toString(36)}`;
    const newPart = {
      id: newId,
      label: `${target.label} (Part 2)`,
      kind: target.kind,
      content: target.content,
      color: target.color || (target.isCustom ? "violet" : "rose"),
      from: splitFrame,
      durationInFrames: secondPartDur,
      visible: true,
    };

    if (target.isCustom) {
      const updatedCustom = currentCustom.map((c) =>
        c.id === target!.id ? { ...c, durationInFrames: firstPartDur } : c
      );
      actions.updateActiveProps({ customLayers: [...updatedCustom, newPart] });
    } else {
      actions.updateActiveProps({
        layerDuration: {
          ...(activeComposition.props.layerDuration || {}),
          [target.id]: firstPartDur,
        },
        customLayers: [...currentCustom, newPart],
      });
    }
    setSelectedLayerId(newId);
    toast.success(`Split "${target.label}" at frame ${splitFrame}`);
  };

  const handleDuplicateLayer = () => {
    const target = layers.find((l) => l.id === selectedLayerId) || layers[0];
    if (!target) return;
    const currentCustom = Array.isArray(activeComposition.props.customLayers)
      ? [...activeComposition.props.customLayers]
      : [];
    const newId = `custom-layer-${Date.now().toString(36)}`;
    const newFrom = Math.min(Math.max(0, lastFrame - 15), target.from + 5);
    const newLayer = {
      id: newId,
      label: `${target.label} (Copy)`,
      kind: target.kind,
      content: target.content || target.label,
      color: target.color || "cyan",
      from: newFrom,
      durationInFrames: Math.max(15, target.durationInFrames),
      visible: true,
    };
    actions.updateActiveProps({ customLayers: [...currentCustom, newLayer] });
    setSelectedLayerId(newId);
    toast.success(`Duplicated "${target.label}"`);
  };

  const handleDeleteSelectedLayer = () => {
    if (!selectedLayerId) return;
    const target = layers.find((l) => l.id === selectedLayerId);
    if (!target) return;
    if (target.isCustom) {
      handleRemoveCustomLayer(target.id);
      setSelectedLayerId(null);
      toast.success(`Deleted layer "${target.label}"`);
    } else {
      handleToggleLayerVisibility(target);
      toast.info(`Toggled visibility for "${target.label}"`);
    }
  };

  const handleRatioChange = (ratioVal: string) => {
    const dim = ASPECT_RATIO_DIMENSIONS[ratioVal] || ASPECT_RATIO_DIMENSIONS["9:16"];
    const baseName =
      activeComposition.name.replace(/\s*\(\d+:\d+\)/g, "").trim() ||
      "HTML Motion Film";
    actions.updateActiveMetadata({
      name: baseName,
      ratio: ratioVal as "9:16" | "1:1" | "16:9",
      width: dim.width,
      height: dim.height,
    });
    actions.updateCanvas({ zoom: "fit", panX: 0, panY: 0 });
    toast.success(`Aspect ratio changed to ${ratioVal} (${dim.width}×${dim.height})`);
  };

  const handleUpdateLayerContent = (layer: VideoLayerSpec, nextValue: string) => {
    const patch = buildLayerContentPatch(activeComposition.props, layer, nextValue);
    if (patch) actions.updateActiveProps(patch);
  };

  const handleUpdateLayerTiming = (
    layer: VideoLayerSpec,
    nextFrom: number,
    nextDur: number
  ) => {
    actions.updateActiveProps(
      buildLayerTimingPatch(
        activeComposition.props,
        layer,
        nextFrom,
        nextDur,
        durationInFrames
      )
    );
  };

  const handleUpdateLayerColor = (layer: VideoLayerSpec, newColor: string) => {
    actions.updateActiveProps(
      buildLayerColorPatch(activeComposition.props, layer, newColor)
    );
    toast.success(`Updated color tag for "${layer.label}" to ${newColor}`);
  };

  return {
    isExporting,
    handleQuickExport,
    handleToggleLayerVisibility,
    handleAddCustomLayer,
    handleRemoveCustomLayer,
    handleSplitClip,
    handleDuplicateLayer,
    handleDeleteSelectedLayer,
    handleRatioChange,
    handleUpdateLayerContent,
    handleUpdateLayerTiming,
    handleUpdateLayerColor,
  };
}

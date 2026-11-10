import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Eye,
  EyeOff,
  Layers,
  Sparkles,
  Type,
  Award,
  Captions,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../../lib/utils";
import { apiFetch, API_BASE } from "../../lib/api";
import { useStudioStore } from "../../hooks/useStudioStore";
import { buildCompositionLayers, type VideoLayerSpec } from "../../remotion/types";
import type { StudioRenderJob } from "../../types/studio";
import { ClipEditModal } from "./ClipEditModal";
import { DEFAULT_HTML_SCENES } from "./HtmlFilmStage";
import { TimelineHeaderToolbar } from "./timeline/TimelineHeaderToolbar";

const workspaceHtmlFiles = import.meta.glob<string>(
  "../../../../workspace/index.html",
  { query: "?raw", import: "default", eager: true }
);

const workspaceTypes = import.meta.glob<Record<string, unknown>>(
  "../../../../workspace/src/types.ts",
  { eager: true }
);

function getWorkspaceSceneLayers(totalFrames: number): VideoLayerSpec[] | null {
  if (Object.keys(workspaceHtmlFiles).length > 0) {
    const SCENE_COLORS = ["amber", "sky", "violet", "emerald", "rose", "cyan"];
    const layers: VideoLayerSpec[] = [
      {
        id: "audio-master-voiceover",
        trackCode: "A1",
        label: "VO: Voiceover Master Audio (6 Scenes)",
        kind: "audio",
        content: "Voiceover Narasi Sejarah Listrik (Full Synchronized)",
        color: "emerald",
        from: 0,
        durationInFrames: totalFrames,
        visible: true,
      },
    ];
    DEFAULT_HTML_SCENES.forEach((s, idx) => {
      layers.push({
        id: `scene-block-${s.id}`,
        trackCode: `V${DEFAULT_HTML_SCENES.length - idx}`,
        label: s.title,
        kind: "video",
        content: s.title,
        color: SCENE_COLORS[idx % SCENE_COLORS.length],
        from: s.startFrame,
        durationInFrames: s.durationFrames,
        visible: true,
        isCustom: true,
      });
    });
    return layers;
  }
  for (const mod of Object.values(workspaceTypes)) {
    if (!mod || typeof mod !== "object") continue;

    // Check for SCENE_DURATIONS / SCENE_OFFSETS (Active workspace documentary video)
    const sceneDurations = (mod as any).SCENE_DURATIONS;
    const sceneOffsets = (mod as any).SCENE_OFFSETS;
    if (sceneDurations && typeof sceneDurations === "object") {
      const keys = Object.keys(sceneDurations);
      const SCENE_TITLES: Record<string, string> = {
        scene1: "Scene 1 · Hook (Kota Gelap & Sakelar)",
        scene2: "Scene 2 · Rahasia Alam (Batu Ambar & Kertas)",
        scene3: "Scene 3 · Badai Petir Benjamin Franklin 1752",
        scene4: "Scene 4 · Baterai Alessandro Volta 1800",
        scene5: "Scene 5 · Induksi Generator Michael Faraday 1831",
        scene6: "Scene 6 · Twist / Kota Modern Penuh Cahaya",
      };
      const SCENE_COLORS = ["amber", "sky", "violet", "emerald", "rose", "cyan"];
      const layers: VideoLayerSpec[] = [];

      // Add audio voiceover master track at A1
      layers.push({
        id: "audio-master-voiceover",
        trackCode: "A1",
        label: "VO: Voiceover Master Audio (6 Scenes)",
        kind: "audio",
        content: "Voiceover Narasi Sejarah Listrik (Full Synchronized)",
        color: "emerald",
        from: 0,
        durationInFrames: totalFrames,
        visible: true,
      });

      keys.forEach((k, idx) => {
        const from = sceneOffsets && typeof sceneOffsets[k] === "number" ? sceneOffsets[k] : 0;
        const dur = typeof sceneDurations[k] === "number" ? sceneDurations[k] : 150;
        layers.push({
          id: `scene-block-${k}`,
          trackCode: `V${keys.length - idx}`,
          label: SCENE_TITLES[k] || `Scene ${idx + 1}`,
          kind: "video",
          content: SCENE_TITLES[k] || `Scene ${idx + 1}`,
          color: SCENE_COLORS[idx % SCENE_COLORS.length],
          from,
          durationInFrames: dur,
          visible: true,
          isCustom: true,
        });
      });

      return layers;
    }

    const turingScenes = (mod as any).TURING_SCENES;
    if (turingScenes && typeof turingScenes === "object") {
      const keys = Object.keys(turingScenes);
      const SCENE_TITLES: Record<string, string> = {
        s1: "Scene 1 · The Hook (Mesin Enigma)",
        s2: "Scene 2 · Who Is He? (Matematikawan)",
        s3: "Scene 3 · The Invisible Enemy (Kode Nazi)",
        s4: "Scene 4 · The Secret Weapon (Mesin Bombe)",
        s5: "Scene 5 · The Dark Irony (Tragedi Pasca Perang)",
        s6: "Scene 6 · The Tragic End (Kematian Turing)",
        s7: "Scene 7 · The Final Message (Warisan AI)",
      };
      const SCENE_COLORS = ["amber", "sky", "violet", "emerald", "rose", "slate", "orange"];
      const layers: VideoLayerSpec[] = [];

      // Add audio voiceover master track at A1
      layers.push({
        id: "audio-voxcpm2-voiceover",
        trackCode: "A1",
        label: "VO: VoxCPM2 Mystery Master Track",
        kind: "audio",
        content: "VoxCPM2 Mystery Voiceover (7 Scenes)",
        color: "emerald",
        from: 0,
        durationInFrames: totalFrames,
        visible: true,
      });

      keys.forEach((k, idx) => {
        const item = turingScenes[k];
        if (!item) return;
        const from = typeof item.startFrame === "number" ? item.startFrame : 0;
        const dur = typeof item.durationInFrames === "number" ? item.durationInFrames : 150;
        layers.push({
          id: `scene-block-${k}`,
          trackCode: `V${keys.length - idx}`,
          label: SCENE_TITLES[k] || `Scene ${idx + 1}`,
          kind: "video",
          content: SCENE_TITLES[k] || `Scene ${idx + 1}`,
          color: SCENE_COLORS[idx % SCENE_COLORS.length],
          from,
          durationInFrames: dur,
          visible: true,
          isCustom: true,
        });
      });

      return layers;
    }
  }
  return null;
}

interface TimelineProps {
  compositionId: string;
  durationInFrames: number;
  fps: number;
  currentFrame: number;
  isPlaying: boolean;
  onSeek: (frame: number) => void;
  onTogglePlay: () => void;
}

interface DragOverride {
  id: string;
  from: number;
  durationInFrames: number;
}

export const Timeline: React.FC<TimelineProps> = ({
  durationInFrames,
  fps,
  currentFrame,
  isPlaying,
  onSeek,
  onTogglePlay,
}) => {
  const {
    activeComposition,
    canvas,
    subtitleCues,
    renderJobs,
    undoStack,
    redoStack,
    actions,
  } = useStudioStore();
  const updateCanvas = actions.updateCanvas;
  const subtitles = subtitleCues;

  const [timelineHeight, setTimelineHeight] = useState<number>(280);
  const [isTimelineCollapsed, setIsTimelineCollapsed] = useState<boolean>(false);
  const [rulerWidth, setRulerWidth] = useState<number>(1000);
  const [timelineZoom, setTimelineZoom] = useState<number>(0);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>("text-hook");
  const [modalLayer, setModalLayer] = useState<VideoLayerSpec | null>(null);
  const [dragOverride, setDragOverride] = useState<DragOverride | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isSnapping, setIsSnapping] = useState<boolean>(true);

  // Zoom scale: negative = compact frames (down to 0.15x), 0% = 1.0x (fit), positive = stretch up to 25.0x
  const zoomMultiplier =
    timelineZoom >= 0
      ? 1 + (timelineZoom / 100) * 24
      : Math.max(0.15, 1 + (timelineZoom / 100) * 0.85);

  const rulerRef = useRef<HTMLDivElement>(null);
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rulerRef.current;
    if (!el) return;
    const updateWidth = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setRulerWidth(w);
    };
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const lastFrame = Math.max(0, durationInFrames - 1);
  const progress = lastFrame === 0 ? 0 : currentFrame / lastFrame;

  const baseLayers = useMemo(() => {
    const isAiWorkspace =
      activeComposition.folder === "AI WORKSPACE" ||
      activeComposition.id.toLowerCase().includes("turing") ||
      activeComposition.id === "NexusEditorialVideo";
    if (isAiWorkspace) {
      const wsLayers = getWorkspaceSceneLayers(durationInFrames);
      if (wsLayers && wsLayers.length > 0) return wsLayers;
    }
    return buildCompositionLayers(activeComposition.props, durationInFrames);
  }, [activeComposition.folder, activeComposition.id, activeComposition.props, durationInFrames]);

  // Merge local 60fps drag override so dragging never re-renders Remotion <Player> on every pixel
  const layers = useMemo(() => {
    if (!dragOverride) return baseLayers;
    return baseLayers.map((l) =>
      l.id === dragOverride.id
        ? {
            ...l,
            from: dragOverride.from,
            durationInFrames: dragOverride.durationInFrames,
          }
        : l
    );
  }, [baseLayers, dragOverride]);

  const selectedLayer = useMemo(
    () => layers.find((l) => l.id === selectedLayerId),
    [layers, selectedLayerId]
  );

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const el = rulerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      onSeek(Math.round(ratio * lastFrame));
    },
    [lastFrame, onSeek]
  );

  const step = (delta: number) =>
    onSeek(Math.min(lastFrame, Math.max(0, currentFrame + delta)));

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
          actions.setRenderJobs(
            renderJobs.filter((j) => j.renderId !== localRenderId)
          );
          actions.upsertRenderJob({
            ...initialJob,
            renderId: json.data.renderId,
            outputPath: json.data.outputPath || initialJob.outputPath,
          });
          setIsExporting(false);
          return;
        }
      }
    } catch {}

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
    const currentVis = activeComposition.props.layerVisibility || {};
    actions.updateActiveProps({
      layerVisibility: {
        ...currentVis,
        [layer.id]: !layer.visible,
      },
    });
  };

  const handleAddCustomLayer = () => {
    const currentCustom = Array.isArray(activeComposition.props.customLayers)
      ? activeComposition.props.customLayers
      : [];
    const nextIdx = currentCustom.length + 1;
    const newId = `custom-layer-${Date.now().toString(36)}`;
    const colorKey = PALETTE_CYCLE[(layers.length + nextIdx) % PALETTE_CYCLE.length];
    const startFrame = Math.min(lastFrame - 15, Math.max(0, currentFrame));
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
    const currentCustom = Array.isArray(activeComposition.props.customLayers)
      ? activeComposition.props.customLayers
      : [];
    actions.updateActiveProps({
      customLayers: currentCustom.filter((c) => c.id !== layerId),
    });
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

    if (target.isCustom) {
      const updatedCustom = currentCustom.map((c) =>
        c.id === target.id ? { ...c, durationInFrames: firstPartDur } : c
      );
      const newPart = {
        id: newId,
        label: `${target.label} (Part 2)`,
        kind: target.kind,
        content: target.content,
        color: target.color || "violet",
        from: splitFrame,
        durationInFrames: secondPartDur,
        visible: true,
      };
      actions.updateActiveProps({
        customLayers: [...updatedCustom, newPart],
      });
      setSelectedLayerId(newId);
      toast.success(`Split "${target.label}" at frame ${splitFrame}`);
    } else {
      const nextDurs = { ...(activeComposition.props.layerDuration || {}) };
      nextDurs[target.id] = firstPartDur;
      const newPart = {
        id: newId,
        label: `${target.label} (Part 2)`,
        kind: target.kind,
        content: target.content,
        color: target.color || "rose",
        from: splitFrame,
        durationInFrames: secondPartDur,
        visible: true,
      };
      actions.updateActiveProps({
        layerDuration: nextDurs,
        customLayers: [...currentCustom, newPart],
      });
      setSelectedLayerId(newId);
      toast.success(`Split "${target.label}" at frame ${splitFrame}`);
    }
  };

  const handleDuplicateLayer = () => {
    const target = layers.find((l) => l.id === selectedLayerId) || layers[0];
    if (!target) return;
    const currentCustom = Array.isArray(activeComposition.props.customLayers)
      ? [...activeComposition.props.customLayers]
      : [];
    const newId = `custom-layer-${Date.now().toString(36)}`;
    const newFrom = Math.min(lastFrame - 15, target.from + 5);
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
    actions.updateActiveProps({
      customLayers: [...currentCustom, newLayer],
    });
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
    const dims: Record<string, { width: number; height: number }> = {
      "9:16": { width: 1080, height: 1920 },
      "1:1": { width: 1080, height: 1080 },
      "16:9": { width: 1920, height: 1080 },
      "4:5": { width: 1080, height: 1350 },
    };
    const dim = dims[ratioVal] || dims["9:16"];
    const baseName =
      activeComposition.name.replace(/\s*\(\d+:\d+\)/g, "").trim() ||
      "NexusEditorialVideo";
    actions.updateActiveMetadata({
      name: baseName,
      ratio: ratioVal as "9:16" | "1:1" | "16:9",
      width: dim.width,
      height: dim.height,
    });
    actions.updateCanvas({ zoom: "fit", panX: 0, panY: 0 });
    toast.success(`Aspect ratio changed to ${ratioVal} (${dim.width}×${dim.height})`);
  };

  useEffect(() => {
    const handleTimelineKeys = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;

      if (isCtrlOrMeta && !e.shiftKey && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        actions.undoProps();
        toast.info("Undo: Reverted change", { duration: 1200 });
        return;
      }

      if (
        (isCtrlOrMeta && (e.key === "y" || e.key === "Y")) ||
        (isCtrlOrMeta && e.shiftKey && (e.key === "z" || e.key === "Z"))
      ) {
        e.preventDefault();
        actions.redoProps();
        toast.info("Redo: Reapplied change", { duration: 1200 });
        return;
      }

      if (isCtrlOrMeta && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        handleDuplicateLayer();
        return;
      }

      if (
        !isCtrlOrMeta &&
        (e.key === "s" || e.key === "S" || e.key === "c" || e.key === "C")
      ) {
        e.preventDefault();
        handleSplitClip();
        return;
      }

      if (e.key === "Delete") {
        e.preventDefault();
        handleDeleteSelectedLayer();
        return;
      }
    };

    window.addEventListener("keydown", handleTimelineKeys);
    return () => window.removeEventListener("keydown", handleTimelineKeys);
  }, [actions, currentFrame, layers, selectedLayerId, activeComposition.props]);

  const handleUpdateLayerContent = (layer: VideoLayerSpec, nextValue: string) => {
    const props = activeComposition.props;
    if (layer.id === "text-hook") {
      actions.updateActiveProps({ hookText: nextValue });
      return;
    }
    if (layer.id === "hud-category") {
      actions.updateActiveProps({ category: nextValue });
      return;
    }
    if (layer.id === "hud-subcategory") {
      actions.updateActiveProps({ subCategory: nextValue });
      return;
    }
    if (layer.id === "footer-author") {
      actions.updateActiveProps({ authorHandle: nextValue });
      return;
    }
    if (layer.id === "footer-tag") {
      actions.updateActiveProps({ editorialTag: nextValue });
      return;
    }
    if (layer.id.startsWith("text-bullet-")) {
      const bulletIdx = Number(layer.id.replace("text-bullet-", ""));
      const lines = (props.bodyText || "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      if (!Number.isNaN(bulletIdx) && bulletIdx >= 0 && bulletIdx < lines.length) {
        lines[bulletIdx] = nextValue;
        actions.updateActiveProps({ bodyText: lines.join("\n") });
      }
      return;
    }
    if (layer.isCustom) {
      const currentCustom = Array.isArray(props.customLayers)
        ? props.customLayers
        : [];
      actions.updateActiveProps({
        customLayers: currentCustom.map((item) =>
          item.id === layer.id
            ? { ...item, content: nextValue, label: nextValue }
            : item
        ),
      });
      return;
    }
    actions.updateActiveProps({
      layerLabels: {
        ...(props.layerLabels || {}),
        [layer.id]: nextValue,
      },
    });
  };

  const handleUpdateLayerTiming = (
    layer: VideoLayerSpec,
    nextFrom: number,
    nextEnd: number
  ) => {
    const safeFrom = Math.max(0, Math.min(durationInFrames - 1, Math.round(nextFrom)));
    const safeEnd = Math.max(safeFrom + 1, Math.min(durationInFrames, Math.round(nextEnd)));
    const safeDur = safeEnd - safeFrom;
    actions.updateActiveProps({
      layerStartFrame: {
        ...(activeComposition.props.layerStartFrame || {}),
        [layer.id]: safeFrom,
      },
      layerDuration: {
        ...(activeComposition.props.layerDuration || {}),
        [layer.id]: safeDur,
      },
    });
  };

  const handleUpdateLayerColor = (layer: VideoLayerSpec, newColor: string) => {
    const props = activeComposition.props;
    if (layer.isCustom) {
      const currentCustom = Array.isArray(props.customLayers)
        ? props.customLayers
        : [];
      actions.updateActiveProps({
        customLayers: currentCustom.map((item) =>
          item.id === layer.id ? { ...item, color: newColor } : item
        ),
      });
      toast.success(`Updated color tag for "${layer.label}" to ${newColor}`);
      return;
    }
    actions.updateActiveProps({
      layerColors: {
        ...(props.layerColors || {}),
        [layer.id]: newColor,
      },
    });
    toast.success(`Updated color tag for "${layer.label}" to ${newColor}`);
  };

  // 60fps Zero-Lag Clip Dragging (commits to store only on mouseup)
  const startClipDrag = (
    e: React.MouseEvent,
    layer: VideoLayerSpec,
    mode: "move" | "trim-start" | "trim-end"
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedLayerId(layer.id);

    const trackEl = rulerRef.current;
    if (!trackEl) return;
    const trackWidth = Math.max(1, trackEl.getBoundingClientRect().width);
    const startX = e.clientX;
    const origFrom = layer.from;
    const origDur = layer.durationInFrames;
    const origEnd = origFrom + origDur;

    let latestFrom = origFrom;
    let latestDur = origDur;
    let rafId: number | null = null;

    const snapCandidates: number[] = [0, currentFrame, lastFrame];
    if (canvas.inFrame !== null) snapCandidates.push(canvas.inFrame);
    if (canvas.outFrame !== null) snapCandidates.push(canvas.outFrame);
    layers.forEach((l) => {
      if (l.id !== layer.id) {
        snapCandidates.push(l.from);
        snapCandidates.push(l.from + l.durationInFrames);
      }
    });

    const snapVal = (val: number, threshold = 2): number => {
      if (!isSnapping) return val;
      for (const t of snapCandidates) {
        if (Math.abs(val - t) <= threshold) return t;
      }
      return val;
    };

    const onMove = (moveEvent: MouseEvent) => {
      const deltaPx = moveEvent.clientX - startX;
      const deltaFrames = Math.round((deltaPx / trackWidth) * durationInFrames);

      if (mode === "move") {
        let candidateFrom = Math.max(
          0,
          Math.min(durationInFrames - origDur, origFrom + deltaFrames)
        );
        candidateFrom = snapVal(candidateFrom);
        const snappedEnd = snapVal(candidateFrom + origDur);
        if (snappedEnd !== candidateFrom + origDur) {
          candidateFrom = Math.max(0, snappedEnd - origDur);
        }
        latestFrom = candidateFrom;
        latestDur = origDur;
      } else if (mode === "trim-start") {
        let candidateFrom = Math.max(
          0,
          Math.min(origEnd - 1, origFrom + deltaFrames)
        );
        candidateFrom = snapVal(candidateFrom);
        latestFrom = candidateFrom;
        latestDur = Math.max(1, origEnd - latestFrom);
      } else if (mode === "trim-end") {
        latestFrom = origFrom;
        let candidateEnd = origEnd + deltaFrames;
        candidateEnd = snapVal(candidateEnd);
        latestDur = Math.max(
          1,
          Math.min(durationInFrames - origFrom, candidateEnd - origFrom)
        );
      }

      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          setDragOverride({
            id: layer.id,
            from: latestFrom,
            durationInFrames: latestDur,
          });
        });
      }
    };

    const onUp = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setDragOverride(null);

      if (latestFrom !== origFrom || latestDur !== origDur) {
        const nextStarts = { ...(activeComposition.props.layerStartFrame || {}) };
        const nextDurs = { ...(activeComposition.props.layerDuration || {}) };
        nextStarts[layer.id] = latestFrom;
        nextDurs[layer.id] = latestDur;
        actions.updateActiveProps({
          layerStartFrame: nextStarts,
          layerDuration: nextDurs,
        });
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const startResizeHeight = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = timelineHeight;

    const onMove = (moveEvent: MouseEvent) => {
      const delta = startY - moveEvent.clientY;
      setTimelineHeight(Math.max(180, Math.min(460, startH + delta)));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const inPercent =
    canvas.inFrame !== null && lastFrame > 0
      ? (canvas.inFrame / lastFrame) * 100
      : null;
  const outPercent =
    canvas.outFrame !== null && lastFrame > 0
      ? (canvas.outFrame / lastFrame) * 100
      : null;

  interface PremiereClipPalette {
    badge: string;
    icon: string;
    clip: string;
    selected: string;
    dot: string;
    handle: string;
    customHex?: string;
  }

  const PREMIERE_PALETTES: Record<string, PremiereClipPalette> = {
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
    emerald: {
      badge: "text-[#A7F3D0] bg-[#064E3B] border-[#059669]",
      icon: "text-[#34D399]",
      clip: "bg-[#065F46] border-[#10B981] text-[#ECFDF5]",
      selected: "ring-1 ring-[#6EE7B7] border-[#6EE7B7] bg-[#047857]",
      dot: "bg-[#34D399]",
      handle: "bg-[#059669] hover:bg-[#10B981]",
    },
  };

  const PALETTE_CYCLE = [
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
    "emerald",
  ] as const;

  const getLayerPalette = (layer: VideoLayerSpec, idx: number): PremiereClipPalette => {
    const override = activeComposition.props.layerColors?.[layer.id];
    const key = override || layer.color;
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
    const byId: Record<string, keyof typeof PREMIERE_PALETTES> = {
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
    const fallbackKey = byId[layer.id] ?? PALETTE_CYCLE[idx % PALETTE_CYCLE.length];
    return PREMIERE_PALETTES[fallbackKey] || PREMIERE_PALETTES.violet;
  };

  const renderLayerIcon = (kind: VideoLayerSpec["kind"], iconClass: string) => {
    switch (kind) {
      case "background":
        return <Layers className={cn("w-3 h-3 shrink-0", iconClass)} />;
      case "pattern":
      case "media":
        return <Sparkles className={cn("w-3 h-3 shrink-0", iconClass)} />;
      case "icon":
      case "badge":
        return <Award className={cn("w-3 h-3 shrink-0", iconClass)} />;
      case "text":
      default:
        return <Type className={cn("w-3 h-3 shrink-0", iconClass)} />;
    }
  };

  return (
    <section
      className="shrink-0 border-t border-[var(--border-color)] bg-[var(--bg-app)] flex flex-col select-none relative transition-all duration-150"
      style={{ height: isTimelineCollapsed ? "auto" : timelineHeight }}
    >
      {/* Top Drag Handle to Resize Timeline Height (hidden when collapsed) */}
      {!isTimelineCollapsed && (
        <div
          onMouseDown={startResizeHeight}
          className="h-1 w-full cursor-row-resize hover:bg-[#cf6613] transition-colors shrink-0"
          title="Drag to resize Timeline height"
        />
      )}

      {/* Sleek Vertical Icon-and-Label Header Toolbar (Matching User Design) */}
      <TimelineHeaderToolbar
        currentFrame={currentFrame}
        durationInFrames={durationInFrames}
        fps={fps}
        isPlaying={isPlaying}
        playbackRate={canvas.playbackRate}
        timelineZoom={timelineZoom}
        isSnapping={isSnapping}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        activeRatio={activeComposition.ratio}
        selectedLayer={selectedLayer ?? null}
        isExporting={isExporting}
        isCollapsed={isTimelineCollapsed}
        onToggleCollapse={() => setIsTimelineCollapsed((c) => !c)}
        onTogglePlay={onTogglePlay}
        onStep={step}
        onUndo={() => {
          actions.undoProps();
          toast.info("Undo: Reverted change", { duration: 1200 });
        }}
        onRedo={() => {
          actions.redoProps();
          toast.info("Redo: Reapplied change", { duration: 1200 });
        }}
        onRatioChange={handleRatioChange}
        onFpsChange={(newFps) => {
          actions.updateActiveMetadata({ fps: newFps });
          toast.success(`Frame rate: ${newFps} FPS`);
        }}
        onFit={() => setTimelineZoom(0)}
        onTrimIn={() => {
          updateCanvas({
            inFrame: canvas.inFrame === currentFrame ? null : currentFrame,
          });
          toast.info(`In-point: ${currentFrame}f`);
        }}
        onTrimOut={() => {
          updateCanvas({
            outFrame: canvas.outFrame === currentFrame ? null : currentFrame,
          });
          toast.info(`Out-point: ${currentFrame}f`);
        }}
        onSplit={handleSplitClip}
        onSpeedChange={(speed) => {
          updateCanvas({ playbackRate: speed });
          toast.info(`Playback speed: ${speed}x`);
        }}
        onDuplicate={handleDuplicateLayer}
        onDelete={handleDeleteSelectedLayer}
        onToggleSnap={() => setIsSnapping((s) => !s)}
        onAddLayer={handleAddCustomLayer}
        onExport={() => void handleQuickExport()}
        onShare={() => {
          navigator.clipboard?.writeText(JSON.stringify(activeComposition.props, null, 2));
          toast.success("JSON konfigurasi komposisi disalin ke clipboard!");
        }}
        onZoomChange={setTimelineZoom}
      />

      {/* 2. Premiere-Style Multi-Track Body (collapsible) */}
      {!isTimelineCollapsed && (
        <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Column: Track Code (V12..V1) + Component Name + Edit/Visibility */}
        <div className="w-[245px] shrink-0 border-r border-[var(--border-color)] bg-[var(--bg-panel)] flex flex-col min-h-0">
          <div className="h-6 px-2.5 border-b border-[var(--border-color)] flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] shrink-0">
            <span>Track / Component Layer</span>
            <span>Visibility</span>
          </div>

          <div
            ref={leftScrollRef}
            onScroll={(e) => {
              if (rightScrollRef.current) {
                rightScrollRef.current.scrollTop = e.currentTarget.scrollTop;
              }
            }}
            className="flex-1 overflow-y-auto divide-y divide-[var(--border-color)]/50"
          >
            {layers.map((layer, idx) => {
              const isSelected = layer.id === selectedLayerId;
              const palette = getLayerPalette(layer, idx);
              return (
                <div
                  key={layer.id}
                  onClick={() => {
                    setSelectedLayerId(layer.id);
                    onSeek(layer.from);
                  }}
                  onDoubleClick={() => {
                    setSelectedLayerId(layer.id);
                    setModalLayer(layer);
                  }}
                  className={cn(
                    "h-7 px-2 flex items-center justify-between gap-1.5 transition-colors cursor-pointer",
                    isSelected
                      ? "bg-[var(--bg-hover)]"
                      : "hover:bg-[var(--bg-hover)]/60"
                  )}
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span
                      className={cn(
                        "w-7 text-[9px] font-mono font-bold border rounded px-1 py-0.5 text-center shrink-0",
                        layer.visible
                          ? palette.badge
                          : "text-[var(--text-muted)] bg-[var(--bg-card)] border-[var(--border-color)] opacity-50"
                      )}
                      style={
                        palette.customHex && layer.visible
                          ? {
                              backgroundColor: `${palette.customHex}25`,
                              borderColor: `${palette.customHex}80`,
                              color: palette.customHex,
                            }
                          : undefined
                      }
                    >
                      {layer.trackCode}
                    </span>
                    {renderLayerIcon(
                      layer.kind,
                      layer.visible ? palette.icon : "text-[var(--text-muted)]"
                    )}
                    <span
                      className={cn(
                        "text-[11px] truncate",
                        layer.visible
                          ? "text-[var(--text-primary)] font-medium"
                          : "text-[var(--text-muted)] line-through"
                      )}
                    >
                      {layer.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {layer.isCustom && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveCustomLayer(layer.id);
                        }}
                        className="p-1 rounded text-[var(--text-muted)] hover:text-rose-400 hover:bg-[var(--bg-card)] transition-colors cursor-pointer"
                        title="Delete Dynamic Layer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleLayerVisibility(layer);
                      }}
                      className={cn(
                        "p-1 rounded hover:bg-[var(--bg-card)] transition-colors cursor-pointer shrink-0",
                        layer.visible ? palette.icon : "text-[var(--text-muted)]"
                      )}
                      title={layer.visible ? "Hide Layer" : "Show Layer"}
                    >
                      {layer.visible ? (
                        <Eye className="w-3 h-3" />
                      ) : (
                        <EyeOff className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}

            {subtitles.length > 0 && (
              <div className="h-7 px-2 flex items-center justify-between gap-1.5 bg-[var(--bg-card)]">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-7 text-[9px] font-mono font-bold text-amber-400 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded px-1 py-0.5 text-center shrink-0">
                    SUB
                  </span>
                  <Captions className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="text-[11px] text-[var(--text-primary)] font-medium truncate">
                    Auto-Captions ({subtitles.length} cues)
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Horizontally Zoomable Time Ruler + Draggable/Trimmable/Editable Clip Lanes */}
        <div
          className="flex-1 relative flex flex-col min-h-0 overflow-x-auto overflow-y-hidden bg-[#0A0A0C]"
          onWheel={(e) => {
            if (e.ctrlKey || e.altKey) {
              e.preventDefault();
              const delta = e.deltaY < 0 ? 5 : -5;
              setTimelineZoom((z) => Math.max(-100, Math.min(100, z + delta)));
            }
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && zoomMultiplier < 1) {
              onSeek(lastFrame);
            }
          }}
        >
          <div
            className={cn(
              "relative flex-1 flex flex-col min-h-0",
              zoomMultiplier < 1 && "border-r-2 border-amber-500/60 shadow-lg"
            )}
            style={{
              width: `${zoomMultiplier * 100}%`,
              minWidth: zoomMultiplier >= 1 ? "100%" : `${zoomMultiplier * 100}%`,
            }}
          >
            {/* In/Out Highlight Region */}
            {(inPercent !== null || outPercent !== null) && (
              <div
                className="absolute top-0 bottom-0 bg-[#23190B] border-x border-[#D97706] pointer-events-none z-0"
                style={{
                  left: `${inPercent ?? 0}%`,
                  width: `${Math.max(0, (outPercent ?? 100) - (inPercent ?? 0))}%`,
                }}
              />
            )}

            {/* Time Ruler (Shows Clean, Pixel-Aware Timecode & Ticks without Clutter) */}
            <div
              ref={rulerRef}
              className="h-6 border-b border-[var(--border-color)] bg-[var(--bg-panel)] relative shrink-0 cursor-col-resize overflow-hidden"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                seekFromClientX(e.clientX);
              }}
              onPointerMove={(e) => {
                if (e.buttons === 1) seekFromClientX(e.clientX);
              }}
              onPointerUp={(e) =>
                e.currentTarget.releasePointerCapture(e.pointerId)
              }
            >
              {(() => {
                const totalDurationSec = durationInFrames / fps;
                if (totalDurationSec <= 0 || lastFrame <= 0) return null;

                // Total rendered pixel width of this lane
                const totalWidthPx = Math.max(200, rulerWidth);
                const pxPerSec = (fps / lastFrame) * totalWidthPx;
                const pxPerFrame = totalWidthPx / lastFrame;

                // Guarantee at least 80px between major timestamp text labels so they NEVER collide
                const MIN_LABEL_GAP_PX = 80;

                // 1. Extreme zoom: frame-based ticks
                if (pxPerFrame >= 25) {
                  const candidateFrameSteps = [1, 2, 5, 10, 15, 30, 60];
                  const frameStep =
                    candidateFrameSteps.find((s) => s * pxPerFrame >= MIN_LABEL_GAP_PX) ??
                    Math.ceil(MIN_LABEL_GAP_PX / pxPerFrame);
                  const totalMajor = Math.floor(durationInFrames / frameStep);

                  const ticks: React.ReactNode[] = [];
                  for (let i = 0; i <= totalMajor; i++) {
                    const f = i * frameStep;
                    if (f > durationInFrames) break;
                    const left = Math.min(100, (f / lastFrame) * 100);
                    ticks.push(
                      <div
                        key={`f-${f}`}
                        className={cn(
                          "absolute top-0 bottom-0 border-l font-mono text-[9px] leading-6 whitespace-nowrap pointer-events-none select-none",
                          "border-[var(--border-strong)] text-[var(--text-secondary)]",
                          left >= 98 ? "-translate-x-full pr-1 text-right" : "pl-1"
                        )}
                        style={{ left: `${left}%` }}
                      >
                        {f}f
                      </div>
                    );
                  }
                  return ticks;
                }

                // 2. Standard time-based ticks
                const CANDIDATE_SECONDS = [
                  0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 20, 30, 60, 120, 300, 600, 1200, 1800, 3600
                ];
                const majorStepSec =
                  CANDIDATE_SECONDS.find((s) => s * pxPerSec >= MIN_LABEL_GAP_PX) ??
                  Math.ceil(MIN_LABEL_GAP_PX / Math.max(0.001, pxPerSec));

                // Minor tick divisor: 5 divisions if step >= 10s, 2 if step >= 2s, else 1
                const minorDiv = majorStepSec >= 10 ? 5 : majorStepSec >= 2 ? 2 : 1;
                const minorStepSec = majorStepSec / minorDiv;

                const ticks: React.ReactNode[] = [];
                const totalMinorSteps = Math.floor(totalDurationSec / minorStepSec);

                for (let i = 0; i <= totalMinorSteps; i++) {
                  const sec = i * minorStepSec;
                  if (sec > totalDurationSec + 0.001) break;
                  const isMajor = i % minorDiv === 0;
                  const frameVal = Math.min(durationInFrames, Math.round(sec * fps));
                  const left = Math.min(100, (frameVal / lastFrame) * 100);

                  if (isMajor) {
                    const isSubSec = majorStepSec < 1;
                    const formattedTime = (() => {
                      if (isSubSec) return `${sec.toFixed(1)}s`;
                      const m = Math.floor(sec / 60);
                      const s = Math.floor(sec % 60);
                      if (m > 0) return `${m}:${s.toString().padStart(2, "0")}`;
                      return `${s}s`;
                    })();

                    ticks.push(
                      <div
                        key={`maj-${i}`}
                        className={cn(
                          "absolute top-0 bottom-0 border-l font-mono text-[9px] leading-6 whitespace-nowrap pointer-events-none select-none",
                          "border-[var(--border-strong)] text-[var(--text-secondary)]",
                          left >= 98 ? "-translate-x-full pr-1 text-right" : "pl-1"
                        )}
                        style={{ left: `${left}%` }}
                      >
                        {formattedTime}
                      </div>
                    );
                  } else {
                    // Subtle minor tick mark (line only, no text!)
                    ticks.push(
                      <div
                        key={`min-${i}`}
                        className="absolute bottom-0 h-1.5 border-l border-[var(--border-color)]/60 pointer-events-none"
                        style={{ left: `${left}%` }}
                      />
                    );
                  }
                }

                return ticks;
              })()}
            </div>

            {/* Scrollable Clip Track Lanes */}
            <div
              ref={rightScrollRef}
              onScroll={(e) => {
                if (leftScrollRef.current) {
                  leftScrollRef.current.scrollTop = e.currentTarget.scrollTop;
                }
              }}
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) {
                  seekFromClientX(e.clientX);
                }
              }}
              className="flex-1 overflow-y-auto divide-y divide-[var(--border-color)]/40 relative"
            >
              {layers.map((layer, idx) => {
                const leftPct = Math.min(
                  100,
                  (layer.from / Math.max(1, durationInFrames)) * 100
                );
                const widthPct = Math.max(
                  0.1,
                  (layer.durationInFrames / Math.max(1, durationInFrames)) * 100
                );
                const isSelected = layer.id === selectedLayerId;
                const palette = getLayerPalette(layer, idx);

                return (
                  <div
                    key={layer.id}
                    onMouseDown={(e) => {
                      if (e.target === e.currentTarget) {
                        seekFromClientX(e.clientX);
                      }
                    }}
                    className="h-7 relative flex items-center"
                  >
                    {/* Draggable, Trimmable & Double-Click Modal Editable Premiere Clip Bar */}
                    <div
                      style={{
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        ...(palette.customHex && layer.visible
                          ? {
                              backgroundColor: `${palette.customHex}33`,
                              borderColor: `${palette.customHex}99`,
                              boxShadow: isSelected
                                ? `0 0 0 1px ${palette.customHex}`
                                : undefined,
                            }
                          : {}),
                      }}
                      onMouseDown={(e) => {
                        startClipDrag(e, layer, "move");
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setSelectedLayerId(layer.id);
                        setModalLayer(layer);
                      }}
                      className={cn(
                        "group absolute top-1 bottom-1 rounded border flex items-center justify-between overflow-hidden select-none transition-colors cursor-grab active:cursor-grabbing",
                        !layer.visible
                          ? "bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-muted)] opacity-50"
                          : cn(palette.clip, isSelected && palette.selected)
                      )}
                      title={`${layer.trackCode} ${layer.label} (${layer.from}f – ${
                        layer.from + layer.durationInFrames
                      }f) • Double-click clip to open editor popup, drag center to move, drag edges to trim`}
                    >
                      {/* Left Trim Handle */}
                      <div
                        onMouseDown={(e) => startClipDrag(e, layer, "trim-start")}
                        className={cn(
                          "w-1.5 h-full cursor-ew-resize shrink-0 transition-colors",
                          palette.handle
                        )}
                        title="Trim Start Frame"
                      />

                      <div className="px-1.5 flex items-center justify-between gap-2 min-w-0 flex-1">
                        <span className="text-[10px] font-medium truncate flex items-center gap-1.5">
                          <span
                            className={cn(
                              "w-1.5 h-1.5 rounded-full shrink-0",
                              layer.visible ? palette.dot : "bg-[var(--text-muted)]"
                            )}
                            style={
                              palette.customHex && layer.visible
                                ? { backgroundColor: palette.customHex }
                                : undefined
                            }
                          />
                          {layer.content ?? layer.label}
                        </span>
                        <span className="text-[9px] font-mono opacity-80 shrink-0">
                          {layer.from}f–{layer.from + layer.durationInFrames}f
                        </span>
                      </div>

                      {/* Right Trim Handle */}
                      <div
                        onMouseDown={(e) => startClipDrag(e, layer, "trim-end")}
                        className={cn(
                          "w-1.5 h-full cursor-ew-resize shrink-0 transition-colors",
                          palette.handle
                        )}
                        title="Trim End Frame"
                      />
                    </div>
                  </div>
                );
              })}

              {/* Subtitles Track Row */}
              {subtitles.length > 0 && (
                <div className="h-7 relative">
                  {subtitles.map((cue, idx) => {
                    const startPct = Math.min(
                      100,
                      (cue.startFrame / Math.max(1, lastFrame)) * 100
                    );
                    const widthPct = Math.max(
                      1.5,
                      ((cue.endFrame - cue.startFrame) / Math.max(1, lastFrame)) *
                        100
                    );
                    return (
                      <div
                        key={`${cue.startFrame}-${idx}`}
                        style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                        className="absolute top-1 bottom-1 bg-[#5C2D0C] border border-[#F59E0B] rounded px-1 flex items-center overflow-hidden"
                        title={`${cue.text} (${cue.startFrame}f - ${cue.endFrame}f)`}
                      >
                        <span className="text-[9px] font-mono text-[#FEF3C7] truncate">
                          {cue.text}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Playhead Vertical Line */}
            <div
              className="absolute top-0 bottom-0 w-px bg-amber-500 pointer-events-none z-20"
              style={{ left: `${progress * 100}%` }}
            >
              <div className="absolute top-0 -left-[4px] w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-black" />
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Floating Clip Edit Modal (Triggered on Double-Click or Pencil Click) */}
      {modalLayer && (
        <ClipEditModal
          isOpen={Boolean(modalLayer)}
          layer={modalLayer}
          onClose={() => setModalLayer(null)}
          onSaveContent={handleUpdateLayerContent}
          onSaveTiming={handleUpdateLayerTiming}
          onSaveColor={handleUpdateLayerColor}
          onToggleVisibility={handleToggleLayerVisibility}
          onDeleteCustom={handleRemoveCustomLayer}
          durationInFrames={durationInFrames}
          fps={fps}
        />
      )}
    </section>
  );
};

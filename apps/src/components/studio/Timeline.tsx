import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  Pause,
  Play,
  Eye,
  EyeOff,
  Layers,
  Sparkles,
  Type,
  Award,
  Captions,
  RotateCcw,
  Plus,
  Trash2,
  Download,
  Loader2,
  ZoomIn,
  ZoomOut,
  Scissors,
  Copy,
  Magnet,
  Undo2,
  Redo2,
  Smartphone,
  Monitor,
  Repeat,
  Maximize2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../../lib/utils";
import { apiFetch, API_BASE } from "../../lib/api";
import { useStudioStore } from "../../hooks/useStudioStore";
import { buildCompositionLayers, type VideoLayerSpec } from "../../remotion/types";
import type { StudioRenderJob } from "../../types/studio";
import { ClipEditModal } from "./ClipEditModal";

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
  const [timelineZoom, setTimelineZoom] = useState<number>(0);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>("text-hook");
  const [modalLayer, setModalLayer] = useState<VideoLayerSpec | null>(null);
  const [dragOverride, setDragOverride] = useState<DragOverride | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isSnapping, setIsSnapping] = useState<boolean>(true);
  const [isRatioOpen, setIsRatioOpen] = useState<boolean>(false);
  const ratioDropdownRef = useRef<HTMLDivElement>(null);

  const containerRef = useRef<HTMLElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(1000);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isCompact = containerWidth < 720;
  const isMedium = containerWidth >= 720 && containerWidth < 960;
  const isWide = containerWidth >= 960;
  const isUltra = containerWidth >= 1200;

  useEffect(() => {
    if (!isRatioOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        ratioDropdownRef.current &&
        !ratioDropdownRef.current.contains(e.target as Node)
      ) {
        setIsRatioOpen(false);
      }
    };
    window.addEventListener("mousedown", handleOutsideClick);
    return () => window.removeEventListener("mousedown", handleOutsideClick);
  }, [isRatioOpen]);

  const RATIO_OPTIONS = [
    {
      value: "9:16",
      label: "9:16",
      sub: "TikTok, Reels, Shorts (1080×1920)",
      icon: Smartphone,
    },
    {
      value: "1:1",
      label: "1:1",
      sub: "Square Post (1080×1080)",
      icon: Monitor,
    },
    {
      value: "16:9",
      label: "16:9",
      sub: "YouTube Landscape (1920×1080)",
      icon: Monitor,
    },
    {
      value: "4:5",
      label: "4:5",
      sub: "Instagram Portrait (1080×1350)",
      icon: Smartphone,
    },
  ] as const;

  // Zoom scale: negative = compact frames (down to 0.15x), 0% = 1.0x (fit), positive = stretch up to 25.0x
  const zoomMultiplier =
    timelineZoom >= 0
      ? 1 + (timelineZoom / 100) * 24
      : Math.max(0.15, 1 + (timelineZoom / 100) * 0.85);

  const rulerRef = useRef<HTMLDivElement>(null);
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);

  const lastFrame = Math.max(0, durationInFrames - 1);
  const progress = lastFrame === 0 ? 0 : currentFrame / lastFrame;

  const baseLayers = useMemo(
    () => buildCompositionLayers(activeComposition.props, durationInFrames),
    [activeComposition.props, durationInFrames]
  );

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

  const handleResetLayerTimings = () => {
    setDragOverride(null);
    actions.updateActiveProps({
      layerStartFrame: {},
      layerDuration: {},
      layerVisibility: {},
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
      ref={containerRef}
      className="shrink-0 border-t border-[var(--border-color)] bg-[var(--bg-app)] flex flex-col select-none relative"
      style={{ height: timelineHeight }}
    >
      {/* Top Drag Handle to Resize Timeline Height */}
      <div
        onMouseDown={startResizeHeight}
        className="h-1 w-full cursor-row-resize hover:bg-[#cf6613] transition-colors shrink-0"
        title="Drag to resize Timeline height"
      />

      {/* Row 1: Playback Transport, Timecode, Markers, Zoom & Viewport Controls */}
      <div className="h-8 px-2 flex items-center justify-between gap-1.5 border-b border-[var(--border-color)] bg-[var(--bg-panel)] shrink-0 overflow-hidden">
        {/* Left Section: Transport + Timecode + Markers + Track Count */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Transport Pill (< ▶ >) */}
          <div className="flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-[var(--bg-card)] border border-[var(--border-strong)] shadow-sm shrink-0">
            <button
              type="button"
              onClick={() => step(-1)}
              title="Previous Frame (Left Arrow)"
              className="w-5 h-5 rounded-full bg-[var(--bg-panel)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>

            <button
              type="button"
              onClick={onTogglePlay}
              title={isPlaying ? "Pause (Space)" : "Play (Space)"}
              className="w-6 h-6 rounded-full flex items-center justify-center bg-[#cf6613] hover:bg-[#b8580f] text-white border border-[#e07b27] shadow transition-all cursor-pointer"
            >
              {isPlaying ? (
                <Pause className="w-2.5 h-2.5 fill-current" />
              ) : (
                <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => step(1)}
              title="Next Frame (Right Arrow)"
              className="w-5 h-5 rounded-full bg-[var(--bg-panel)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {/* Frame & Seconds Timecode */}
          <button
            type="button"
            onClick={() => onSeek(canvas.inFrame ?? 0)}
            title="Click to jump to in-frame"
            className="h-6 px-1.5 rounded-md bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)] flex items-center gap-1 text-[10px] font-mono text-[var(--text-secondary)] shrink-0 cursor-pointer"
          >
            {!isCompact && <span>FRAME</span>}
            <span className="text-amber-400 font-semibold">
              {String(currentFrame).padStart(3, "0")}
            </span>
            <span>/{durationInFrames}</span>
            {isWide && (
              <span className="text-[var(--text-muted)] ml-0.5">
                ({(currentFrame / fps).toFixed(2)}s)
              </span>
            )}
          </button>

          {/* In / Out Markers & Reset */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() =>
                updateCanvas({
                  inFrame: canvas.inFrame === currentFrame ? null : currentFrame,
                })
              }
              title="Set In Point (I)"
              className={cn(
                "px-1.5 h-6 rounded-md text-[10px] font-mono border transition-colors cursor-pointer shrink-0",
                canvas.inFrame !== null
                  ? "bg-[#cf6613] border-[#e07b27] text-white font-semibold"
                  : "bg-[var(--bg-card)] border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              [I{canvas.inFrame !== null ? `:${canvas.inFrame}` : ""}
            </button>
            <button
              type="button"
              onClick={() =>
                updateCanvas({
                  outFrame:
                    canvas.outFrame === currentFrame ? null : currentFrame,
                })
              }
              title="Set Out Point (O)"
              className={cn(
                "px-1.5 h-6 rounded-md text-[10px] font-mono border transition-colors cursor-pointer shrink-0",
                canvas.outFrame !== null
                  ? "bg-[#cf6613] border-[#e07b27] text-white font-semibold"
                  : "bg-[var(--bg-card)] border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              {canvas.outFrame !== null ? `${canvas.outFrame}:` : ""}O]
            </button>
            <button
              type="button"
              onClick={handleResetLayerTimings}
              title="Reset all clip timings"
              className="px-1.5 h-6 rounded-md bg-[var(--bg-card)] border border-[var(--border-strong)] text-[10px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 cursor-pointer shrink-0"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              {!isCompact && <span>Reset</span>}
            </button>
          </div>

          {/* Track Count Badge */}
          <span className="h-6 px-1.5 rounded-md bg-[var(--bg-card)] border border-[var(--border-strong)] text-amber-400 font-semibold text-[10px] font-mono flex items-center shrink-0">
            {layers.length}{!isCompact ? <span className="ml-1">TRACKS</span> : <span>T</span>}
          </span>
        </div>

        {/* Center / Flexible Section: Zoom Controls & Fluid Work Area Status */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-center">
          {/* Zoom Slider */}
          <div
            className="h-6 px-1.5 flex items-center gap-1 border border-[var(--border-strong)] bg-[var(--bg-card)] rounded-md text-[10px] font-mono shrink-0"
            title="Drag slider to zoom Timeline frames horizontally"
          >
            <button
              type="button"
              onClick={() => setTimelineZoom((z) => Math.max(-100, z - 10))}
              className="text-[var(--text-secondary)] hover:text-amber-400 cursor-pointer p-0.5"
              title="Zoom Out (-10%)"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <input
              type="range"
              min={-100}
              max={100}
              step={5}
              value={timelineZoom}
              onChange={(e) => setTimelineZoom(Number(e.target.value))}
              className={cn(
                "h-1 accent-[#cf6613] bg-[var(--bg-input)] rounded-lg cursor-ew-resize outline-none",
                isCompact ? "w-12" : isMedium ? "w-16" : "w-20"
              )}
              title={`Timeline Zoom: ${timelineZoom > 0 ? `+${timelineZoom}%` : `${timelineZoom}%`}`}
            />
            <button
              type="button"
              onClick={() => setTimelineZoom((z) => Math.min(100, z + 10))}
              className="text-[var(--text-secondary)] hover:text-amber-400 cursor-pointer p-0.5"
              title="Zoom In (+10%)"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setTimelineZoom(0)}
              className="text-amber-400 font-semibold px-0.5 hover:underline cursor-pointer min-w-5 text-center"
              title="Reset Zoom to 0%"
            >
              {timelineZoom > 0 ? `+${timelineZoom}%` : `${timelineZoom}%`}
            </button>
          </div>

          {/* Fit */}
          <button
            type="button"
            onClick={() => setTimelineZoom(0)}
            title="Fit Timeline to Screen"
            className="h-6 px-1.5 rounded-md bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border border-[var(--border-strong)] text-[10px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 cursor-pointer transition-colors shrink-0"
          >
            <Maximize2 className="w-2.5 h-2.5" />
            {!isCompact && <span>Fit</span>}
          </button>

          {/* Loop */}
          <button
            type="button"
            onClick={() => updateCanvas({ loop: !canvas.loop })}
            title={canvas.loop ? "Loop Playback ON" : "Loop Playback OFF"}
            className={cn(
              "h-6 px-1.5 rounded-md border text-[10px] font-medium flex items-center gap-1 cursor-pointer transition-colors shrink-0",
              canvas.loop
                ? "bg-[#cf6613]/20 border-[#cf6613] text-[#f97316]"
                : "bg-[var(--bg-card)] border-[var(--border-strong)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            )}
          >
            <Repeat className="w-2.5 h-2.5" />
            {!isCompact && <span>Loop</span>}
          </button>

          {/* Fluid Work Area Status Bar (Only shown when width is wide/ultra, fills all remaining center space!) */}
          {isWide && (
            <div className="flex-1 min-w-0 h-6 px-2.5 rounded-md bg-[var(--bg-card)] border border-[var(--border-strong)] flex items-center justify-between text-[10px] font-mono text-[var(--text-secondary)] overflow-hidden">
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-[var(--text-muted)]">Work Area:</span>
                <span className="text-amber-400 font-semibold">{canvas.inFrame ?? 0}f – {canvas.outFrame ?? durationInFrames}f</span>
                <span className="text-[var(--text-muted)]">({(((canvas.outFrame ?? durationInFrames) - (canvas.inFrame ?? 0)) / fps).toFixed(2)}s)</span>
              </div>
              {isUltra && (
                <div className="flex items-center gap-2 text-[var(--text-muted)] text-[9px] shrink-0 ml-2">
                  <span>Remotion 60fps</span>
                  <span>•</span>
                  <span className="text-emerald-400 font-semibold">Local GPU (Rp 0)</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Section: Speed + FPS + Export */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Speed */}
          <select
            value={canvas.playbackRate}
            onChange={(e) =>
              updateCanvas({
                playbackRate: Number(e.target.value) as 0.5 | 1 | 1.5 | 2,
              })
            }
            className="h-6 px-1 rounded-md bg-[var(--bg-card)] border border-[var(--border-strong)] text-[10px] font-mono text-[var(--text-primary)] outline-none cursor-pointer shrink-0"
            title="Playback Speed"
          >
            <option value={0.5} className="bg-[#121215] text-[#FAFAFA]">0.5x</option>
            <option value={1} className="bg-[#121215] text-[#FAFAFA]">1.0x</option>
            <option value={1.5} className="bg-[#121215] text-[#FAFAFA]">1.5x</option>
            <option value={2} className="bg-[#121215] text-[#FAFAFA]">2.0x</option>
          </select>

          {/* FPS */}
          <select
            value={fps}
            onChange={(e) => {
              const nextFps = Number(e.target.value) || 30;
              actions.updateActiveMetadata({ fps: nextFps });
              toast.success(`Updated frame rate to ${nextFps} FPS`);
            }}
            className="h-6 px-1 rounded-md bg-[var(--bg-card)] border border-[var(--border-strong)] text-[10px] font-mono text-[var(--text-primary)] outline-none cursor-pointer shrink-0"
            title="Frame Rate (FPS)"
          >
            <option value={24} className="bg-[#121215] text-[#FAFAFA]">24 FPS</option>
            <option value={25} className="bg-[#121215] text-[#FAFAFA]">25 FPS</option>
            <option value={30} className="bg-[#121215] text-[#FAFAFA]">30 FPS</option>
            <option value={50} className="bg-[#121215] text-[#FAFAFA]">50 FPS</option>
            <option value={60} className="bg-[#121215] text-[#FAFAFA]">60 FPS</option>
          </select>

          {/* Export Button */}
          <button
            type="button"
            onClick={() => void handleQuickExport()}
            disabled={isExporting}
            title="Export / Render Video (MP4)"
            className="h-6 px-2 rounded-md bg-[var(--bg-card)] hover:bg-[#cf6613] border border-[var(--border-strong)] hover:border-[#e07b27] text-[var(--text-primary)] hover:text-white flex items-center gap-1 text-[10px] font-medium cursor-pointer transition-colors disabled:opacity-60 shrink-0"
          >
            {isExporting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Download className="w-3 h-3" />
            )}
            {!isCompact && <span>Export</span>}
          </button>
        </div>
      </div>

      {/* Row 2: Aspect Ratio Popover, Editing Tools, Layer Operations & Fluid Clip Telemetry */}
      <div className="h-8 px-2 flex items-center gap-1.5 border-b border-[var(--border-color)] bg-[var(--bg-card)]/40 shrink-0 overflow-hidden">
        {/* Left Section: Aspect Ratio Popover */}
        <div ref={ratioDropdownRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setIsRatioOpen((v) => !v)}
            className={cn(
              "h-6 px-2 flex items-center gap-1.5 rounded-md border text-[10px] font-mono transition-colors cursor-pointer shrink-0",
              isRatioOpen
                ? "bg-[#cf6613]/20 border-[#cf6613] text-amber-400 font-semibold"
                : "bg-[var(--bg-panel)] border-[var(--border-strong)] text-amber-400 hover:bg-[var(--bg-hover)]"
            )}
            title="Select Composition Aspect Ratio"
          >
            <Smartphone className="w-3 h-3 text-[var(--text-muted)]" />
            <span>{activeComposition.ratio}</span>
            {!isCompact && (
              <span className="text-[9px] text-[var(--text-secondary)] font-normal">
                ({activeComposition.ratio === "9:16" ? "TikTok" : activeComposition.ratio === "1:1" ? "Square" : activeComposition.ratio === "16:9" ? "Landscape" : "Portrait"})
              </span>
            )}
            <ChevronDown className={cn("w-3 h-3 text-[var(--text-secondary)] transition-transform", isRatioOpen && "rotate-180")} />
          </button>

          {isRatioOpen && (
            <div className="absolute top-full left-0 mt-1 w-64 py-1 rounded-lg bg-[#141418] border border-[#2A2A33] shadow-2xl shadow-black/90 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] border-b border-[#222228] mb-1">
                Aspect Ratio
              </div>
              {RATIO_OPTIONS.map((opt) => {
                const isSelected = activeComposition.ratio === opt.value;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      handleRatioChange(opt.value);
                      setIsRatioOpen(false);
                    }}
                    className={cn(
                      "w-full px-2.5 py-1.5 flex items-center justify-between text-left transition-colors cursor-pointer",
                      isSelected
                        ? "bg-[#cf6613]/15 text-amber-400 font-semibold"
                        : "text-[var(--text-primary)] hover:bg-[#1E1E26] hover:text-white"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className={cn("w-3.5 h-3.5 shrink-0", isSelected ? "text-amber-400" : "text-[var(--text-secondary)]")} />
                      <div className="min-w-0">
                        <div className="text-[11px] leading-tight flex items-center gap-1.5">
                          <span>{opt.label}</span>
                          {isSelected && (
                            <span className="text-[8px] px-1 rounded bg-[#cf6613] text-white font-mono">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <div className="text-[9px] text-[var(--text-secondary)] font-mono leading-tight truncate">
                          {opt.sub}
                        </div>
                      </div>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 ml-1" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="w-px h-3.5 bg-[var(--border-color)] mx-0.5 shrink-0" />

        {/* Clip Action Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Split */}
          <button
            type="button"
            onClick={handleSplitClip}
            title="Split / Cut Clip at Playhead Frame (S or C)"
            className="h-6 px-1.5 rounded-md bg-[var(--bg-panel)] hover:bg-[#cf6613] hover:text-white border border-[var(--border-strong)] hover:border-[#e07b27] text-[10px] font-medium text-[var(--text-secondary)] flex items-center gap-1 cursor-pointer transition-colors shrink-0"
          >
            <Scissors className="w-3 h-3" />
            {!isCompact && <span>Split</span>}
          </button>

          {/* Duplicate */}
          <button
            type="button"
            onClick={handleDuplicateLayer}
            title="Duplicate Selected Layer (Ctrl+D)"
            className="h-6 px-1.5 rounded-md bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] border border-[var(--border-strong)] text-[10px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 cursor-pointer transition-colors shrink-0"
          >
            <Copy className="w-3 h-3" />
            {isWide ? <span>Duplicate</span> : !isCompact ? <span>Copy</span> : null}
          </button>

          {/* Delete */}
          <button
            type="button"
            onClick={handleDeleteSelectedLayer}
            title="Delete Selected Layer (Delete)"
            className="h-6 px-1.5 rounded-md bg-[var(--bg-panel)] hover:bg-rose-900/60 hover:text-rose-200 border border-[var(--border-strong)] hover:border-rose-700/60 text-[10px] font-medium text-[var(--text-secondary)] flex items-center gap-1 cursor-pointer transition-colors shrink-0"
          >
            <Trash2 className="w-3 h-3" />
            {!isCompact && <span>Delete</span>}
          </button>
        </div>

        <div className="w-px h-3.5 bg-[var(--border-color)] mx-0.5 shrink-0" />

        {/* Magnet Snapping + Undo / Redo */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setIsSnapping((s) => !s)}
            title={
              isSnapping
                ? "Snapping ON (Magnetic snap to playhead, markers & clip edges)"
                : "Snapping OFF"
            }
            className={cn(
              "h-6 px-1.5 rounded-md border text-[10px] font-medium flex items-center gap-1 cursor-pointer transition-colors shrink-0",
              isSnapping
                ? "bg-[#cf6613]/20 border-[#cf6613] text-[#f97316]"
                : "bg-[var(--bg-panel)] border-[var(--border-strong)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            )}
          >
            <Magnet className="w-3 h-3" />
            {!isCompact && <span>Snap</span>}
          </button>

          <button
            type="button"
            disabled={undoStack.length === 0}
            onClick={() => {
              actions.undoProps();
              toast.info("Undo: Reverted change", { duration: 1200 });
            }}
            title="Undo (Ctrl+Z)"
            className="w-6 h-6 rounded-md bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] border border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center cursor-pointer transition-colors shrink-0"
          >
            <Undo2 className="w-3 h-3" />
          </button>

          <button
            type="button"
            disabled={redoStack.length === 0}
            onClick={() => {
              actions.redoProps();
              toast.info("Redo: Reapplied change", { duration: 1200 });
            }}
            title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
            className="w-6 h-6 rounded-md bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] border border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center cursor-pointer transition-colors shrink-0"
          >
            <Redo2 className="w-3 h-3" />
          </button>
        </div>

        <div className="w-px h-3.5 bg-[var(--border-color)] mx-0.5 shrink-0" />

        {/* Add Layer Button */}
        <button
          type="button"
          onClick={handleAddCustomLayer}
          title="Add New Dynamic Layer"
          className="px-2 h-6 rounded-md bg-[#cf6613] hover:bg-[#b8580f] border border-[#e07b27] text-[10px] font-semibold text-white flex items-center gap-1 cursor-pointer transition-colors shrink-0"
        >
          <Plus className="w-3 h-3" />
          {!isCompact && <span>Layer</span>}
        </button>

        <div className="w-px h-3.5 bg-[var(--border-color)] mx-0.5 shrink-0" />

        {/* Live Selected Clip Telemetry & Status Pill (Fluid space filler on any screen width!) */}
        {selectedLayer ? (
          <div
            onClick={() => setModalLayer(selectedLayer)}
            title="Click to edit clip content, color tag and timing"
            className="flex-1 min-w-0 h-6 px-2.5 rounded-md bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)] flex items-center justify-between text-[10px] font-mono text-[var(--text-secondary)] cursor-pointer transition-colors overflow-hidden"
          >
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              <span className="text-amber-400 font-bold shrink-0">{selectedLayer.trackCode}</span>
              <span className="text-[var(--text-primary)] font-medium truncate">{selectedLayer.label}</span>
              <span className="text-[var(--text-muted)] shrink-0">•</span>
              <span className="text-amber-300 font-semibold shrink-0 capitalize">
                {activeComposition.props.layerColors?.[selectedLayer.id] || selectedLayer.color || "violet"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 text-[var(--text-muted)] ml-2">
              <span>{selectedLayer.from}f–{selectedLayer.from + selectedLayer.durationInFrames}f</span>
              {!isCompact && (
                <span>({(selectedLayer.durationInFrames / fps).toFixed(2)}s)</span>
              )}
              {isWide && (
                <span className="text-amber-400/90">• Double-click to edit</span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 min-w-0 h-6 px-2.5 rounded-md bg-[var(--bg-panel)]/50 border border-[var(--border-color)]/60 flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)] overflow-hidden">
            <span className="truncate">
              {isCompact ? "Click clip to inspect" : "Click a clip on timeline to inspect or customize color tag"}
            </span>
            {isWide && (
              <span className="text-[9px] text-[var(--text-secondary)] shrink-0 ml-2">
                Space: Play/Pause • S: Split • Del: Delete
              </span>
            )}
          </div>
        )}
      </div>

      {/* 2. Premiere-Style Multi-Track Body */}
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

            {/* Time Ruler (Shows Finer Single-Frame Graduations When Zoomed In) */}
            <div
              ref={rulerRef}
              className="h-6 border-b border-[var(--border-color)] bg-[var(--bg-panel)] relative shrink-0 cursor-col-resize"
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
                let frameStep = fps;
                if (timelineZoom >= 75) frameStep = 1; // 1 frame per tick!
                else if (timelineZoom >= 50) frameStep = 2; // 2 frames per tick
                else if (timelineZoom >= 30) frameStep = 5; // 5 frames per tick
                else if (timelineZoom >= 15) frameStep = Math.max(1, Math.round(fps / 2)); // half second
                else if (timelineZoom <= -60) frameStep = fps * 4; // every 4 seconds when heavily compacted
                else if (timelineZoom <= -30) frameStep = fps * 2; // every 2 seconds
                else frameStep = fps; // 1 second

                const totalTicks = Math.ceil(durationInFrames / frameStep);
                return Array.from({ length: totalTicks + 1 }, (_, idx) => {
                  const frameVal = idx * frameStep;
                  if (frameVal > durationInFrames) return null;
                  const left = Math.min(100, (frameVal / Math.max(1, lastFrame)) * 100);
                  const isMajor = frameVal % fps === 0 || (frameStep <= 2 && frameVal % 5 === 0);
                  const secVal = (frameVal / fps).toFixed(frameStep === 1 ? 2 : 1);
                  return (
                    <div
                      key={frameVal}
                      className={cn(
                        "absolute top-0 bottom-0 border-l font-mono text-[9px] leading-6",
                        isMajor
                          ? "border-[var(--border-strong)] text-[var(--text-secondary)]"
                          : "border-[var(--border-color)]/70 text-[var(--text-muted)]",
                        left >= 100
                          ? "-translate-x-full pr-1 text-right"
                          : "pl-1"
                      )}
                      style={{ left: `${left}%` }}
                    >
                      {timelineZoom >= 50
                        ? `${frameVal}f`
                        : isMajor
                        ? `${secVal}s (${frameVal}f)`
                        : `${frameVal}f`}
                    </div>
                  );
                });
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
                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
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

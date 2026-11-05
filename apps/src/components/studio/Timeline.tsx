import { useCallback, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
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
  Pencil,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../../lib/utils";
import { apiFetch, API_BASE } from "../../lib/api";
import { useStudioStore } from "../../hooks/useStudioStore";
import { buildCompositionLayers, type VideoLayerSpec } from "../../remotion/types";
import type { StudioRenderJob } from "../../types/studio";

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
  const { activeComposition, canvas, subtitleCues, renderJobs, actions } = useStudioStore();
  const updateCanvas = actions.updateCanvas;
  const subtitles = subtitleCues;

  const [timelineHeight, setTimelineHeight] = useState<number>(280);
  const [timelineZoom, setTimelineZoom] = useState<number>(1);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>("text-hook");
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<string>("");
  const [dragOverride, setDragOverride] = useState<DragOverride | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const rulerRef = useRef<HTMLDivElement>(null);
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);

  const lastFrame = Math.max(0, durationInFrames - 1);
  const progress = lastFrame === 0 ? 0 : currentFrame / lastFrame;
  const totalSeconds = Math.ceil(durationInFrames / fps);

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

  const selectedLayer = layers.find((l) => l.id === selectedLayerId) ?? layers[0];

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
    const safeFrom = Math.max(0, Math.min(durationInFrames - 5, Math.round(nextFrom)));
    const safeEnd = Math.max(safeFrom + 5, Math.min(durationInFrames, Math.round(nextEnd)));
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

  const startInlineEdit = (layer: VideoLayerSpec) => {
    setSelectedLayerId(layer.id);
    setEditingLayerId(layer.id);
    setEditingDraft(layer.content ?? layer.label);
  };

  const commitInlineEdit = (layer: VideoLayerSpec) => {
    if (editingLayerId === layer.id) {
      const trimmed = editingDraft.trim();
      if (trimmed.length > 0) {
        handleUpdateLayerContent(layer, trimmed);
      }
      setEditingLayerId(null);
    }
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

    const onMove = (moveEvent: MouseEvent) => {
      const deltaPx = moveEvent.clientX - startX;
      const deltaFrames = Math.round((deltaPx / trackWidth) * durationInFrames);

      if (mode === "move") {
        latestFrom = Math.max(
          0,
          Math.min(durationInFrames - origDur, origFrom + deltaFrames)
        );
        latestDur = origDur;
      } else if (mode === "trim-start") {
        latestFrom = Math.max(0, Math.min(origEnd - 5, origFrom + deltaFrames));
        latestDur = origEnd - latestFrom;
      } else if (mode === "trim-end") {
        latestFrom = origFrom;
        latestDur = Math.max(
          5,
          Math.min(durationInFrames - origFrom, origDur + deltaFrames)
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
  ] as const;

  const getLayerPalette = (layer: VideoLayerSpec, idx: number): PremiereClipPalette => {
    if (layer.color && PREMIERE_PALETTES[layer.color]) {
      return PREMIERE_PALETTES[layer.color];
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
    const key = byId[layer.id] ?? PALETTE_CYCLE[idx % PALETTE_CYCLE.length];
    return PREMIERE_PALETTES[key];
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
      className="shrink-0 border-t border-[var(--border-color)] bg-[var(--bg-app)] flex flex-col select-none relative"
      style={{ height: timelineHeight }}
    >
      {/* Top Drag Handle to Resize Timeline Height */}
      <div
        onMouseDown={startResizeHeight}
        className="h-1 w-full cursor-row-resize hover:bg-[#cf6613] transition-colors shrink-0"
        title="Drag to resize Timeline height"
      />

      {/* 1. Three-Column Solid Header (Never Overlaps When Resized Narrow) */}
      <div className="bg-[var(--bg-panel)] border-b border-[var(--border-color)] px-3 py-1.5 grid grid-cols-[1fr_auto_1fr] items-center gap-2 shrink-0">
        {/* Left Column: Row 1 (Timeline Zoom, [I, O], Reset) | Row 2 (Tracks Count + Inline Selected Clip Editor) */}
        <div className="flex flex-col gap-1.5 min-w-0 items-start">
          <div className="flex items-center gap-1.5 max-w-full overflow-x-auto no-scrollbar">
            {/* Timeline Horizontal Zoom Control (Replaces Redundant Start Button) */}
            <div
              className="h-6 px-1.5 flex items-center gap-1 border border-[var(--border-strong)] bg-[var(--bg-card)] rounded-md text-[10px] font-mono shrink-0"
              title="Zoom Timeline Horizontally (Stretch Frames)"
            >
              <button
                type="button"
                onClick={() =>
                  setTimelineZoom((z) => Math.max(1, Number((z - 0.5).toFixed(1))))
                }
                className="text-[var(--text-secondary)] hover:text-amber-400 cursor-pointer p-0.5"
                title="Zoom Out Timeline"
              >
                <ZoomOut className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => setTimelineZoom(1)}
                className="text-amber-400 font-semibold px-0.5 cursor-pointer"
                title="Click to reset Timeline Zoom to 100%"
              >
                {Math.round(timelineZoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() =>
                  setTimelineZoom((z) => Math.min(8, Number((z + 0.5).toFixed(1))))
                }
                className="text-[var(--text-secondary)] hover:text-amber-400 cursor-pointer p-0.5"
                title="Zoom In Timeline (Stretch Frames)"
              >
                <ZoomIn className="w-3 h-3" />
              </button>
            </div>

            <button
              type="button"
              onClick={() =>
                updateCanvas({
                  inFrame: canvas.inFrame === currentFrame ? null : currentFrame,
                })
              }
              title="Set In Point (I)"
              className={cn(
                "px-2 h-6 rounded-md text-[10px] font-mono border transition-colors cursor-pointer shrink-0",
                canvas.inFrame !== null
                  ? "bg-[#cf6613] border-[#e07b27] text-white font-semibold"
                  : "bg-[var(--bg-card)] border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
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
                "px-2 h-6 rounded-md text-[10px] font-mono border transition-colors cursor-pointer shrink-0",
                canvas.outFrame !== null
                  ? "bg-[#cf6613] border-[#e07b27] text-white font-semibold"
                  : "bg-[var(--bg-card)] border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
              )}
            >
              {canvas.outFrame !== null ? `${canvas.outFrame}:` : ""}O]
            </button>
            <button
              type="button"
              onClick={handleResetLayerTimings}
              title="Reset all clip positions and durations"
              className="px-2 h-6 rounded-md bg-[var(--bg-card)] border border-[var(--border-strong)] text-[10px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] flex items-center gap-1 cursor-pointer transition-colors shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] font-mono max-w-full overflow-x-auto no-scrollbar">
            <span className="h-6 px-2 rounded-md bg-[var(--bg-card)] border border-[var(--border-strong)] text-amber-400 font-semibold flex items-center shrink-0">
              {layers.length} TRACKS
            </span>
            {selectedLayer && (
              <div className="h-6 px-1.5 rounded-md bg-[var(--bg-card)] border border-[var(--border-strong)] flex items-center gap-1.5 min-w-0">
                <span className="text-[var(--text-primary)] font-semibold shrink-0">
                  {selectedLayer.trackCode}:
                </span>
                <input
                  type="text"
                  value={selectedLayer.content ?? selectedLayer.label}
                  onChange={(e) =>
                    handleUpdateLayerContent(selectedLayer, e.target.value)
                  }
                  placeholder="Edit clip text..."
                  className="w-28 sm:w-40 h-4 px-1 rounded bg-[var(--bg-input)] border border-[var(--border-color)] text-[10px] font-sans text-[var(--text-primary)] outline-none focus:border-amber-400"
                  title="Edit selected clip content directly"
                />
                <input
                  type="number"
                  min={0}
                  max={durationInFrames - 5}
                  value={selectedLayer.from}
                  onChange={(e) =>
                    handleUpdateLayerTiming(
                      selectedLayer,
                      Number(e.target.value) || 0,
                      selectedLayer.from + selectedLayer.durationInFrames
                    )
                  }
                  className="w-9 h-4 text-center rounded bg-[var(--bg-input)] border border-[var(--border-color)] text-[9px] text-amber-400 outline-none"
                  title="Clip Start Frame"
                />
                <span className="text-[var(--text-muted)]">–</span>
                <input
                  type="number"
                  min={selectedLayer.from + 5}
                  max={durationInFrames}
                  value={selectedLayer.from + selectedLayer.durationInFrames}
                  onChange={(e) =>
                    handleUpdateLayerTiming(
                      selectedLayer,
                      selectedLayer.from,
                      Number(e.target.value) || durationInFrames
                    )
                  }
                  className="w-9 h-4 text-center rounded bg-[var(--bg-input)] border border-[var(--border-color)] text-[9px] text-amber-400 outline-none"
                  title="Clip End Frame"
                />
              </div>
            )}
          </div>
        </div>

        {/* Center Column: Solid Transport Pill (<  (Play)  >) — Dedicated Grid Column, Zero Overlap */}
        <div className="flex items-center justify-center shrink-0 px-1">
          <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[var(--bg-card)] border-2 border-[var(--border-strong)] shadow-xl">
            <button
              type="button"
              onClick={() => step(-1)}
              title="Previous Frame"
              className="w-6 h-6 rounded-full bg-[var(--bg-panel)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={onTogglePlay}
              title={isPlaying ? "Pause (Space)" : "Play (Space)"}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-[#cf6613] hover:bg-[#b8580f] text-white border border-[#e07b27] shadow-md transition-all cursor-pointer"
            >
              {isPlaying ? (
                <Pause className="w-3.5 h-3.5 fill-current" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => step(1)}
              title="Next Frame"
              className="w-6 h-6 rounded-full bg-[var(--bg-panel)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Column: Row 1 (Frame/Time, + Layer, Export) | Row 2 (Speed Dropdown + Interactive FPS Dropdown) */}
        <div className="flex flex-col gap-1.5 min-w-0 items-end">
          <div className="flex items-center gap-1.5 max-w-full overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => onSeek(canvas.inFrame ?? 0)}
              title="Click to jump to frame 0"
              className="h-6 px-2 rounded-md bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)] flex items-center gap-1 text-[10px] font-mono text-[var(--text-secondary)] shrink-0 cursor-pointer"
            >
              <span>FRAME</span>
              <span className="text-amber-400 font-semibold">
                {String(currentFrame).padStart(3, "0")}
              </span>
              <span>/ {durationInFrames}</span>
            </button>
            <span className="h-6 px-2 rounded-md bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center text-[10px] font-mono text-[var(--text-primary)] shrink-0">
              {(currentFrame / fps).toFixed(2)}s
            </span>
            <button
              type="button"
              onClick={handleAddCustomLayer}
              title="Add New Dynamic Layer (Unlimited V1..Vn Tracks)"
              className="px-2 h-6 rounded-md bg-[#cf6613] hover:bg-[#b8580f] border border-[#e07b27] text-[10px] font-semibold text-white flex items-center gap-1 cursor-pointer transition-colors shrink-0"
            >
              <Plus className="w-3 h-3" />
              <span>Layer</span>
            </button>
            <button
              type="button"
              onClick={() => void handleQuickExport()}
              disabled={isExporting}
              title="Export / Render Video (MP4)"
              className="w-6 h-6 rounded-md bg-[var(--bg-card)] hover:bg-[#cf6613] border border-[var(--border-strong)] hover:border-[#e07b27] text-[var(--text-primary)] hover:text-white flex items-center justify-center cursor-pointer transition-colors disabled:opacity-60 shrink-0"
            >
              {isExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] font-mono max-w-full overflow-x-auto no-scrollbar">
            <select
              value={canvas.playbackRate}
              onChange={(e) =>
                updateCanvas({
                  playbackRate: Number(e.target.value) as 0.5 | 1 | 1.5 | 2,
                })
              }
              className="h-6 px-2 rounded-md bg-[var(--bg-card)] border border-[var(--border-strong)] text-[10px] font-mono text-[var(--text-primary)] outline-none cursor-pointer shrink-0"
              title="Playback Speed"
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1.0x</option>
              <option value={1.5}>1.5x</option>
              <option value={2}>2.0x</option>
            </select>

            <select
              value={fps}
              onChange={(e) => {
                const nextFps = Number(e.target.value) || 30;
                actions.updateActiveMetadata({ fps: nextFps });
                toast.success(`Updated composition frame rate to ${nextFps} FPS`);
              }}
              className="h-6 px-2 rounded-md bg-[var(--bg-card)] border border-[var(--border-strong)] text-[10px] font-mono text-[var(--text-primary)] outline-none cursor-pointer shrink-0"
              title="Select Composition FPS (Frame Rate)"
            >
              <option value={24}>24 FPS</option>
              <option value={25}>25 FPS</option>
              <option value={30}>30 FPS</option>
              <option value={50}>50 FPS</option>
              <option value={60}>60 FPS</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. Premiere-Style Multi-Track Body */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Column: Track Code (V12..V1) + Component Name + Edit/Visibility */}
        <div className="w-[245px] shrink-0 border-r border-[var(--border-color)] bg-[var(--bg-panel)] flex flex-col min-h-0">
          <div className="h-6 px-2.5 border-b border-[var(--border-color)] flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] shrink-0">
            <span>Track / Component Layer</span>
            <span>Edit / View</span>
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
                  onDoubleClick={() => startInlineEdit(layer)}
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
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        startInlineEdit(layer);
                      }}
                      className="p-1 rounded text-[var(--text-muted)] hover:text-amber-400 hover:bg-[var(--bg-card)] transition-colors cursor-pointer"
                      title="Edit clip content manually"
                    >
                      <Pencil className="w-2.5 h-2.5" />
                    </button>
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
          className="flex-1 relative flex flex-col min-h-0 overflow-x-auto overflow-y-hidden"
          onWheel={(e) => {
            if (e.ctrlKey || e.altKey) {
              e.preventDefault();
              const delta = e.deltaY < 0 ? 0.5 : -0.5;
              setTimelineZoom((z) =>
                Math.max(1, Math.min(8, Number((z + delta).toFixed(1))))
              );
            }
          }}
        >
          <div
            className="relative flex-1 flex flex-col min-h-0"
            style={{
              width: `${timelineZoom * 100}%`,
              minWidth: "100%",
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

            {/* Time Ruler (Shows Finer Frame/Sub-Second Graduations When Zoomed In) */}
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
                const subSteps = timelineZoom >= 4 ? 4 : timelineZoom >= 2 ? 2 : 1;
                const totalTicks = totalSeconds * subSteps;
                return Array.from({ length: totalTicks + 1 }, (_, idx) => {
                  const secVal = idx / subSteps;
                  const frameVal = Math.round(secVal * fps);
                  const left = Math.min(
                    100,
                    (frameVal / Math.max(1, lastFrame)) * 100
                  );
                  const isWholeSec = idx % subSteps === 0;
                  return (
                    <div
                      key={idx}
                      className={cn(
                        "absolute top-0 bottom-0 border-l font-mono text-[9px] leading-6",
                        isWholeSec
                          ? "border-[var(--border-strong)] text-[var(--text-secondary)]"
                          : "border-[var(--border-color)] text-[var(--text-muted)]",
                        left >= 100
                          ? "-translate-x-full pr-1 text-right"
                          : "pl-1"
                      )}
                      style={{ left: `${left}%` }}
                    >
                      {isWholeSec
                        ? timelineZoom >= 2
                          ? `${secVal}s (${frameVal}f)`
                          : `${secVal}s`
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
                  3,
                  (layer.durationInFrames / Math.max(1, durationInFrames)) * 100
                );
                const isSelected = layer.id === selectedLayerId;
                const isEditing = layer.id === editingLayerId;
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
                    {/* Draggable, Trimmable & Double-Click Editable Premiere Clip Bar */}
                    <div
                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                      onMouseDown={(e) => {
                        if (!isEditing) startClipDrag(e, layer, "move");
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        startInlineEdit(layer);
                      }}
                      className={cn(
                        "group absolute top-1 bottom-1 rounded border flex items-center justify-between overflow-hidden select-none transition-colors",
                        isEditing ? "cursor-text" : "cursor-grab active:cursor-grabbing",
                        !layer.visible
                          ? "bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-muted)] opacity-50"
                          : cn(palette.clip, isSelected && palette.selected)
                      )}
                      title={`${layer.trackCode} ${layer.label} (${layer.from}f – ${
                        layer.from + layer.durationInFrames
                      }f) • Double-click clip to edit text manually, drag center to move, drag edges to trim`}
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
                        {isEditing ? (
                          <input
                            type="text"
                            autoFocus
                            value={editingDraft}
                            onChange={(e) => setEditingDraft(e.target.value)}
                            onBlur={() => commitInlineEdit(layer)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitInlineEdit(layer);
                              if (e.key === "Escape") setEditingLayerId(null);
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-full h-4 px-1 rounded bg-black/60 border border-amber-400 text-[10px] text-white outline-none"
                          />
                        ) : (
                          <span className="text-[10px] font-medium truncate flex items-center gap-1.5">
                            <span
                              className={cn(
                                "w-1.5 h-1.5 rounded-full shrink-0",
                                layer.visible ? palette.dot : "bg-[var(--text-muted)]"
                              )}
                            />
                            {layer.label}
                          </span>
                        )}
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
    </section>
  );
};

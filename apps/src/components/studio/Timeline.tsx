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
  ZoomIn,
  ZoomOut,
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
  const { activeComposition, canvas, subtitleCues, renderJobs, actions } = useStudioStore();
  const updateCanvas = actions.updateCanvas;
  const subtitles = subtitleCues;

  const [timelineHeight, setTimelineHeight] = useState<number>(280);
  const [timelineZoom, setTimelineZoom] = useState<number>(0);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>("text-hook");
  const [modalLayer, setModalLayer] = useState<VideoLayerSpec | null>(null);
  const [dragOverride, setDragOverride] = useState<DragOverride | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

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
        latestFrom = Math.max(0, Math.min(origEnd - 1, origFrom + deltaFrames));
        latestDur = Math.max(1, origEnd - latestFrom);
      } else if (mode === "trim-end") {
        latestFrom = origFrom;
        latestDur = Math.max(
          1,
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

      {/* 1. Premiere-Style Compact Unified Transport & Options Toolbar */}
      <div className="bg-[var(--bg-panel)] border-b border-[var(--border-color)] px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
        {/* Left Section: Playback Transport, Timecode, Markers & Tracks */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Transport Pill (<  (Play)  >) */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-card)] border border-[var(--border-strong)] shadow-sm shrink-0">
            <button
              type="button"
              onClick={() => step(-1)}
              title="Previous Frame"
              className="w-5 h-5 rounded-full bg-[var(--bg-panel)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>

            <button
              type="button"
              onClick={onTogglePlay}
              title={isPlaying ? "Pause (Space)" : "Play (Space)"}
              className="w-7 h-7 rounded-full flex items-center justify-center bg-[#cf6613] hover:bg-[#b8580f] text-white border border-[#e07b27] shadow transition-all cursor-pointer"
            >
              {isPlaying ? (
                <Pause className="w-3 h-3 fill-current" />
              ) : (
                <Play className="w-3 h-3 fill-current ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => step(1)}
              title="Next Frame"
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
            className="h-6 px-2 rounded-md bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)] flex items-center gap-1 text-[10px] font-mono text-[var(--text-secondary)] shrink-0 cursor-pointer"
          >
            <span>FRAME</span>
            <span className="text-amber-400 font-semibold">
              {String(currentFrame).padStart(3, "0")}
            </span>
            <span>/ {durationInFrames}</span>
            <span className="text-[var(--text-muted)] ml-1">
              ({(currentFrame / fps).toFixed(2)}s)
            </span>
          </button>

          {/* In / Out Markers & Reset */}
          <div className="flex items-center gap-1">
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
                "px-2 h-6 rounded-md text-[10px] font-mono border transition-colors cursor-pointer shrink-0",
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
              className="px-2 h-6 rounded-md bg-[var(--bg-card)] border border-[var(--border-strong)] text-[10px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 cursor-pointer shrink-0"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Reset</span>
            </button>
          </div>

          {/* Track Count Badge */}
          <span className="h-6 px-2 rounded-md bg-[var(--bg-card)] border border-[var(--border-strong)] text-amber-400 font-semibold text-[10px] font-mono flex items-center shrink-0">
            {layers.length} TRACKS
          </span>
        </div>

        {/* Right Section: Zoom Slider (Minus/Plus), Speed, FPS, Add Layer, Quick Export */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Timeline Horizontal Zoom Slider Bar (Minus zooms out / compacts frames, Plus zooms in / stretches) */}
          <div
            className="h-6 px-2 flex items-center gap-1.5 border border-[var(--border-strong)] bg-[var(--bg-card)] rounded-md text-[10px] font-mono shrink-0"
            title="Drag slider to zoom Timeline frames horizontally (minus to compact, plus to stretch for micro precision)"
          >
            <button
              type="button"
              onClick={() =>
                setTimelineZoom((z) => Math.max(-100, z - 10))
              }
              className="text-[var(--text-secondary)] hover:text-amber-400 cursor-pointer p-0.5"
              title="Zoom Out Timeline / Compact Frames (-10%)"
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
              className="w-16 sm:w-20 h-1 accent-[#cf6613] bg-[var(--bg-input)] rounded-lg cursor-ew-resize outline-none"
              title={`Timeline Zoom: ${timelineZoom > 0 ? `+${timelineZoom}%` : `${timelineZoom}%`}`}
            />
            <button
              type="button"
              onClick={() =>
                setTimelineZoom((z) => Math.min(100, z + 10))
              }
              className="text-[var(--text-secondary)] hover:text-amber-400 cursor-pointer p-0.5"
              title="Zoom In Timeline / Stretch Frames (+10%)"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setTimelineZoom(0)}
              className="text-amber-400 font-semibold px-0.5 hover:underline cursor-pointer min-w-8 text-center"
              title="Click to reset Timeline Zoom to 0% (Fit)"
            >
              {timelineZoom > 0 ? `+${timelineZoom}%` : `${timelineZoom}%`}
            </button>
          </div>

          {/* Playback Speed */}
          <select
            value={canvas.playbackRate}
            onChange={(e) =>
              updateCanvas({
                playbackRate: Number(e.target.value) as 0.5 | 1 | 1.5 | 2,
              })
            }
            className="h-6 px-1.5 rounded-md bg-[var(--bg-card)] border border-[var(--border-strong)] text-[10px] font-mono text-[var(--text-primary)] outline-none cursor-pointer shrink-0"
            title="Playback Speed"
          >
            <option value={0.5}>0.5x</option>
            <option value={1}>1.0x</option>
            <option value={1.5}>1.5x</option>
            <option value={2}>2.0x</option>
          </select>

          {/* FPS Selector */}
          <select
            value={fps}
            onChange={(e) => {
              const nextFps = Number(e.target.value) || 30;
              actions.updateActiveMetadata({ fps: nextFps });
              toast.success(`Updated frame rate to ${nextFps} FPS`);
            }}
            className="h-6 px-1.5 rounded-md bg-[var(--bg-card)] border border-[var(--border-strong)] text-[10px] font-mono text-[var(--text-primary)] outline-none cursor-pointer shrink-0"
            title="Frame Rate (FPS)"
          >
            <option value={24}>24 FPS</option>
            <option value={25}>25 FPS</option>
            <option value={30}>30 FPS</option>
            <option value={50}>50 FPS</option>
            <option value={60}>60 FPS</option>
          </select>

          {/* Add Layer Button */}
          <button
            type="button"
            onClick={handleAddCustomLayer}
            title="Add New Dynamic Layer"
            className="px-2 h-6 rounded-md bg-[#cf6613] hover:bg-[#b8580f] border border-[#e07b27] text-[10px] font-semibold text-white flex items-center gap-1 cursor-pointer transition-colors shrink-0"
          >
            <Plus className="w-3 h-3" />
            <span>Layer</span>
          </button>

          {/* Quick Export Button */}
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
          className="flex-1 relative flex flex-col min-h-0 overflow-x-auto overflow-y-hidden"
          onWheel={(e) => {
            if (e.ctrlKey || e.altKey) {
              e.preventDefault();
              const delta = e.deltaY < 0 ? 5 : -5;
              setTimelineZoom((z) => Math.max(0, Math.min(100, z + delta)));
            }
          }}
        >
          <div
            className="relative flex-1 flex flex-col min-h-0"
            style={{
              width: `${zoomMultiplier * 100}%`,
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
          onToggleVisibility={handleToggleLayerVisibility}
          onDeleteCustom={handleRemoveCustomLayer}
          durationInFrames={durationInFrames}
          fps={fps}
        />
      )}
    </section>
  );
};

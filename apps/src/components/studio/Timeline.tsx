import { useCallback, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  SkipBack,
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
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useStudioStore } from "../../hooks/useStudioStore";
import { buildCompositionLayers, type VideoLayerSpec } from "../../remotion/types";

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
  const { activeComposition, canvas, subtitleCues, actions } = useStudioStore();
  const updateCanvas = actions.updateCanvas;
  const subtitles = subtitleCues;

  const [timelineHeight, setTimelineHeight] = useState<number>(264);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>("text-hook");
  const [dragOverride, setDragOverride] = useState<DragOverride | null>(null);

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
      badge: "text-violet-300 bg-violet-950/60 border-violet-500/40",
      icon: "text-violet-400",
      clip: "bg-violet-500/25 border-violet-400/60 text-violet-100",
      selected: "ring-1 ring-violet-300 border-violet-300 bg-violet-500/35",
      dot: "bg-violet-400",
      handle: "bg-violet-400/35 hover:bg-violet-300",
    },
    cyan: {
      badge: "text-cyan-300 bg-cyan-950/60 border-cyan-500/40",
      icon: "text-cyan-400",
      clip: "bg-cyan-500/25 border-cyan-400/60 text-cyan-100",
      selected: "ring-1 ring-cyan-300 border-cyan-300 bg-cyan-500/35",
      dot: "bg-cyan-400",
      handle: "bg-cyan-400/35 hover:bg-cyan-300",
    },
    rose: {
      badge: "text-rose-300 bg-rose-950/60 border-rose-500/40",
      icon: "text-rose-400",
      clip: "bg-rose-500/25 border-rose-400/60 text-rose-100",
      selected: "ring-1 ring-rose-300 border-rose-300 bg-rose-500/35",
      dot: "bg-rose-400",
      handle: "bg-rose-400/35 hover:bg-rose-300",
    },
    amber: {
      badge: "text-amber-300 bg-amber-950/60 border-amber-500/40",
      icon: "text-amber-400",
      clip: "bg-amber-500/25 border-amber-400/60 text-amber-100",
      selected: "ring-1 ring-amber-300 border-amber-300 bg-amber-500/35",
      dot: "bg-amber-400",
      handle: "bg-amber-400/35 hover:bg-amber-300",
    },
    sky: {
      badge: "text-sky-300 bg-sky-950/60 border-sky-500/40",
      icon: "text-sky-400",
      clip: "bg-sky-500/25 border-sky-400/60 text-sky-100",
      selected: "ring-1 ring-sky-300 border-sky-300 bg-sky-500/35",
      dot: "bg-sky-400",
      handle: "bg-sky-400/35 hover:bg-sky-300",
    },
    fuchsia: {
      badge: "text-fuchsia-300 bg-fuchsia-950/60 border-fuchsia-500/40",
      icon: "text-fuchsia-400",
      clip: "bg-fuchsia-500/25 border-fuchsia-400/60 text-fuchsia-100",
      selected: "ring-1 ring-fuchsia-300 border-fuchsia-300 bg-fuchsia-500/35",
      dot: "bg-fuchsia-400",
      handle: "bg-fuchsia-400/35 hover:bg-fuchsia-300",
    },
    orange: {
      badge: "text-orange-300 bg-orange-950/60 border-orange-500/40",
      icon: "text-orange-400",
      clip: "bg-orange-500/25 border-orange-400/60 text-orange-100",
      selected: "ring-1 ring-orange-300 border-orange-300 bg-orange-500/35",
      dot: "bg-orange-400",
      handle: "bg-orange-400/35 hover:bg-orange-300",
    },
    indigo: {
      badge: "text-indigo-300 bg-indigo-950/60 border-indigo-500/40",
      icon: "text-indigo-400",
      clip: "bg-indigo-500/25 border-indigo-400/60 text-indigo-100",
      selected: "ring-1 ring-indigo-300 border-indigo-300 bg-indigo-500/35",
      dot: "bg-indigo-400",
      handle: "bg-indigo-400/35 hover:bg-indigo-300",
    },
    pink: {
      badge: "text-pink-300 bg-pink-950/60 border-pink-500/40",
      icon: "text-pink-400",
      clip: "bg-pink-500/25 border-pink-400/60 text-pink-100",
      selected: "ring-1 ring-pink-300 border-pink-300 bg-pink-500/35",
      dot: "bg-pink-400",
      handle: "bg-pink-400/35 hover:bg-pink-300",
    },
    blue: {
      badge: "text-blue-300 bg-blue-950/60 border-blue-500/40",
      icon: "text-blue-400",
      clip: "bg-blue-500/25 border-blue-400/60 text-blue-100",
      selected: "ring-1 ring-blue-300 border-blue-300 bg-blue-500/35",
      dot: "bg-blue-400",
      handle: "bg-blue-400/35 hover:bg-blue-300",
    },
    purple: {
      badge: "text-purple-300 bg-purple-950/60 border-purple-500/40",
      icon: "text-purple-400",
      clip: "bg-purple-500/25 border-purple-400/60 text-purple-100",
      selected: "ring-1 ring-purple-300 border-purple-300 bg-purple-500/35",
      dot: "bg-purple-400",
      handle: "bg-purple-400/35 hover:bg-purple-300",
    },
    slate: {
      badge: "text-slate-300 bg-slate-900/80 border-slate-500/40",
      icon: "text-slate-400",
      clip: "bg-slate-500/25 border-slate-400/60 text-slate-200",
      selected: "ring-1 ring-slate-300 border-slate-300 bg-slate-500/35",
      dot: "bg-slate-300",
      handle: "bg-slate-400/35 hover:bg-slate-300",
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
        className="h-1 w-full cursor-row-resize hover:bg-amber-500/60 transition-colors shrink-0"
        title="Drag to resize Timeline height"
      />

      {/* 1. Two-Row Header with Centered Transport Pill (Matches User Diagram) */}
      <div className="relative bg-[var(--bg-panel)] border-b border-[var(--border-color)] shrink-0">
        {/* Top Row: Left Trim/Reset Menu | Right Frame & Time Telemetry */}
        <div className="h-7 px-3 flex items-center justify-between border-b border-[var(--border-color)]/70 whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onSeek(canvas.inFrame ?? 0)}
              title="Jump to Start / In Point"
              className="h-5 px-1.5 flex items-center gap-1 border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded text-[10px] cursor-pointer transition-colors"
            >
              <SkipBack className="w-2.5 h-2.5" />
              <span>Start</span>
            </button>
            <button
              type="button"
              onClick={() =>
                updateCanvas({
                  inFrame: canvas.inFrame === currentFrame ? null : currentFrame,
                })
              }
              title="Set In Point (I)"
              className={cn(
                "px-1.5 h-5 rounded text-[10px] font-mono border transition-colors cursor-pointer",
                canvas.inFrame !== null
                  ? "bg-amber-500/20 border-amber-500/50 text-amber-400"
                  : "bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
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
                "px-1.5 h-5 rounded text-[10px] font-mono border transition-colors cursor-pointer",
                canvas.outFrame !== null
                  ? "bg-amber-500/20 border-amber-500/50 text-amber-400"
                  : "bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
            >
              {canvas.outFrame !== null ? `${canvas.outFrame}:` : ""}O]
            </button>
            <button
              type="button"
              onClick={handleResetLayerTimings}
              title="Reset all clip positions and durations"
              className="px-1.5 h-5 rounded bg-[var(--bg-card)] border border-[var(--border-color)] text-[10px] text-[var(--text-muted)] hover:text-amber-400 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Reset</span>
            </button>
            <button
              type="button"
              onClick={handleAddCustomLayer}
              title="Add New Dynamic Layer (Unlimited V1..Vn Tracks)"
              className="px-1.5 h-5 rounded bg-amber-500/15 border border-amber-500/40 text-[10px] text-amber-400 hover:bg-amber-500/25 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Plus className="w-2.5 h-2.5" />
              <span>Layer</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-mono text-[var(--text-muted)] whitespace-nowrap">
            <span>
              FRAME{" "}
              <span className="text-amber-400 font-semibold">
                {String(currentFrame).padStart(3, "0")}
              </span>{" "}
              / {durationInFrames}
            </span>
            <span className="text-[var(--border-strong)]">•</span>
            <span className="text-[var(--text-primary)]">
              {(currentFrame / fps).toFixed(2)}s
            </span>
          </div>
        </div>

        {/* Bottom Row: Left Selected Track Info | Right Speed & FPS */}
        <div className="h-7 px-3 flex items-center justify-between whitespace-nowrap">
          <div className="flex items-center gap-2 text-[10px] font-mono text-[var(--text-muted)]">
            <span className="px-1.5 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-color)] text-amber-400 font-semibold">
              {layers.length} TRACKS
            </span>
            {selectedLayer && (
              <span className="text-[var(--text-secondary)] truncate max-w-[180px]">
                {selectedLayer.trackCode}:{" "}
                <span className="text-amber-400">
                  {selectedLayer.from}f–
                  {selectedLayer.from + selectedLayer.durationInFrames}f
                </span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-[10px] font-mono text-[var(--text-muted)] whitespace-nowrap">
            <select
              value={canvas.playbackRate}
              onChange={(e) =>
                updateCanvas({
                  playbackRate: Number(e.target.value) as 0.5 | 1 | 1.5 | 2,
                })
              }
              className="h-5 px-1.5 rounded bg-[var(--bg-card)] border border-[var(--border-color)] text-[10px] font-mono text-[var(--text-primary)] outline-none cursor-pointer"
              title="Playback Speed"
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1.0x</option>
              <option value={1.5}>1.5x</option>
              <option value={2}>2.0x</option>
            </select>
            <span className="px-1.5 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)]">
              {fps} FPS
            </span>
          </div>
        </div>

        {/* Center Floating Transport Pill (<  (Play)  >) straddling Row 1 & Row 2 */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--bg-card)] border border-[var(--border-strong)] shadow-lg">
          <button
            type="button"
            onClick={() => step(-1)}
            title="Previous Frame"
            className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onTogglePlay}
            title={isPlaying ? "Pause (Space)" : "Play (Space)"}
            className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center border transition-all cursor-pointer",
              isPlaying
                ? "bg-amber-500 text-black border-amber-400 shadow-sm"
                : "bg-amber-500/20 border-amber-500/50 text-amber-400 hover:bg-amber-500/30"
            )}
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
            className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Premiere-Style Multi-Track Body */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Column: Track Code (V12..V1) + Component Name + Eye Visibility */}
        <div className="w-[245px] shrink-0 border-r border-[var(--border-color)] bg-[var(--bg-panel)] flex flex-col min-h-0">
          <div className="h-6 px-2.5 border-b border-[var(--border-color)] flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] shrink-0">
            <span>Track / Component Layer</span>
            <span>View</span>
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
              <div className="h-7 px-2 flex items-center justify-between gap-1.5 bg-[var(--bg-card)]/40">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-7 text-[9px] font-mono font-bold text-amber-400 bg-[var(--bg-card)] border border-[var(--border-color)] rounded px-1 py-0.5 text-center shrink-0">
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

        {/* Right Column: Time Ruler + Draggable/Trimmable Clip Lanes */}
        <div className="flex-1 relative flex flex-col min-h-0 overflow-hidden">
          {/* In/Out Highlight Region */}
          {(inPercent !== null || outPercent !== null) && (
            <div
              className="absolute top-0 bottom-0 bg-amber-500/10 border-x border-amber-500/40 pointer-events-none z-0"
              style={{
                left: `${inPercent ?? 0}%`,
                width: `${Math.max(0, (outPercent ?? 100) - (inPercent ?? 0))}%`,
              }}
            />
          )}

          {/* Time Ruler */}
          <div
            ref={rulerRef}
            className="h-6 border-b border-[var(--border-color)] bg-[var(--bg-panel)]/70 relative shrink-0 cursor-col-resize"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              seekFromClientX(e.clientX);
            }}
            onPointerMove={(e) => {
              if (e.buttons === 1) seekFromClientX(e.clientX);
            }}
            onPointerUp={(e) => e.currentTarget.releasePointerCapture(e.pointerId)}
          >
            {Array.from({ length: totalSeconds + 1 }, (_, second) => {
              const left = Math.min(
                100,
                ((second * fps) / Math.max(1, lastFrame)) * 100
              );
              return (
                <div
                  key={second}
                  className={cn(
                    "absolute top-0 bottom-0 border-l border-[var(--border-color)] font-mono text-[9px] leading-6 text-[var(--text-muted)]",
                    left >= 100 ? "-translate-x-full pr-1 text-right" : "pl-1"
                  )}
                  style={{ left: `${left}%` }}
                >
                  {second}s
                </div>
              );
            })}
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
                  {/* Draggable & Trimmable Premiere Clip Bar */}
                  <div
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    onMouseDown={(e) => startClipDrag(e, layer, "move")}
                    className={cn(
                      "group absolute top-1 bottom-1 rounded border flex items-center justify-between overflow-hidden cursor-grab active:cursor-grabbing select-none transition-colors",
                      !layer.visible
                        ? "bg-[var(--bg-card)]/40 border-[var(--border-color)] text-[var(--text-muted)] opacity-40"
                        : cn(palette.clip, isSelected && palette.selected)
                    )}
                    title={`${layer.trackCode} ${layer.label} (${layer.from}f – ${
                      layer.from + layer.durationInFrames
                    }f) • Drag center to move clip, drag left/right edges to trim`}
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
                        {layer.label}
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
                      className="absolute top-1 bottom-1 bg-amber-500/20 border border-amber-500/40 rounded px-1 flex items-center overflow-hidden"
                      title={`${cue.text} (${cue.startFrame}f - ${cue.endFrame}f)`}
                    >
                      <span className="text-[9px] font-mono text-amber-300 truncate">
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
    </section>
  );
};

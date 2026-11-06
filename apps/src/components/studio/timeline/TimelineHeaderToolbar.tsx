import React, { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  RotateCw,
  LayoutTemplate,
  Crop,
  FoldHorizontal,
  Scissors,
  Gauge,
  Copy,
  Volume2,
  VolumeX,
  Trash2,
  Magnet,
  Plus,
  Share2,
  Download,
  Loader2,
  Check,
  ZoomIn,
  ZoomOut,
  Film,
  Smartphone,
  Square,
  Monitor,
  Smartphone as PhonePortrait,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import type { VideoLayerSpec } from "../../../remotion/types";

export interface TimelineHeaderToolbarProps {
  currentFrame: number;
  durationInFrames: number;
  fps: number;
  isPlaying: boolean;
  playbackRate: number;
  timelineZoom: number;
  isSnapping: boolean;
  canUndo: boolean;
  canRedo: boolean;
  activeRatio: string;
  selectedLayer?: VideoLayerSpec | null;
  isExporting: boolean;
  onTogglePlay: () => void;
  onStep: (delta: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onRatioChange: (ratio: string) => void;
  onFpsChange?: (fps: number) => void;
  onFit: () => void;
  onTrimIn?: () => void;
  onTrimOut?: () => void;
  onSplit: () => void;
  onSpeedChange: (speed: 0.5 | 1 | 1.5 | 2) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleSnap: () => void;
  onAddLayer: () => void;
  onExport: () => void;
  onShare?: () => void;
  onZoomChange: (zoom: number) => void;
}

export const TimelineHeaderToolbar: React.FC<TimelineHeaderToolbarProps> = ({
  currentFrame,
  durationInFrames,
  fps,
  isPlaying,
  playbackRate,
  timelineZoom,
  isSnapping,
  canUndo,
  canRedo,
  activeRatio,
  isExporting,
  onTogglePlay,
  onStep,
  onUndo,
  onRedo,
  onRatioChange,
  onFpsChange,
  onFit,
  onTrimIn,
  onSplit,
  onSpeedChange,
  onDuplicate,
  onDelete,
  onToggleSnap,
  onAddLayer,
  onExport,
  onShare,
  onZoomChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(1000);

  // Dropdown states
  const [isRatioOpen, setIsRatioOpen] = useState(false);
  const [isSpeedOpen, setIsSpeedOpen] = useState(false);
  const [isFpsOpen, setIsFpsOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const ratioRef = useRef<HTMLDivElement>(null);
  const speedRef = useRef<HTMLDivElement>(null);
  const fpsRef = useRef<HTMLDivElement>(null);

  // ResizeObserver for fluid responsive scaling without overlapping or voids
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

  // Adaptive breakpoints
  const isCompact = containerWidth < 740;
  const isMedium = containerWidth >= 740 && containerWidth < 1050;
  const isWide = containerWidth >= 1050;

  // Close dropdowns on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ratioRef.current && !ratioRef.current.contains(e.target as Node)) {
        setIsRatioOpen(false);
      }
      if (speedRef.current && !speedRef.current.contains(e.target as Node)) {
        setIsSpeedOpen(false);
      }
      if (fpsRef.current && !fpsRef.current.contains(e.target as Node)) {
        setIsFpsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsRatioOpen(false);
        setIsSpeedOpen(false);
        setIsFpsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const timeFormatted = (currentFrame / fps).toFixed(2);
  const totalDurationFormatted = (durationInFrames / fps).toFixed(2);

  const ratioOptions = [
    { value: "9:16", label: "9:16 Vertical", sub: "1080×1920 (TikTok, Shorts)", icon: Smartphone },
    { value: "1:1", label: "1:1 Square", sub: "1080×1080 (Feed, Carousel)", icon: Square },
    { value: "16:9", label: "16:9 Landscape", sub: "1920×1080 (YouTube, Web)", icon: Monitor },
    { value: "4:5", label: "4:5 Portrait", sub: "1080×1350 (IG Portrait)", icon: PhonePortrait },
  ];

  const speedOptions: (0.5 | 1 | 1.5 | 2)[] = [0.5, 1, 1.5, 2];
  const fpsOptions: number[] = [24, 25, 30, 50, 60];

  // Dynamic responsive tool button classes
  const toolBtnClass = cn(
    "flex-1 min-w-[28px] max-w-[54px] sm:max-w-[60px] h-10 flex flex-col items-center justify-center rounded-lg transition-all cursor-pointer group text-center select-none shrink-0 sm:shrink",
    isCompact ? "p-0.5" : "px-1 py-0.5"
  );
  const toolIconClass = isCompact ? "w-3 h-3" : "w-3.5 h-3.5";
  const toolLabelClass = cn(
    "tracking-tight leading-none mt-0.5",
    isCompact ? "text-[7.5px]" : "text-[8.5px]"
  );

  return (
    <div
      ref={containerRef}
      className="h-14 px-2 sm:px-3 border-b border-[var(--border-color)] bg-[var(--bg-panel)] flex items-center justify-between gap-1 sm:gap-2 select-none shrink-0 relative z-40 w-full"
    >
      {/* 1. LEFT SECTION: Playback Transport & Timecode */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        <div className="flex items-center gap-0.5 p-0.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm shrink-0">
          <button
            type="button"
            onClick={() => onStep(-1)}
            title="Frame Mundur (Panah Kiri)"
            className={cn(
              "rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-white flex items-center justify-center transition-colors cursor-pointer",
              isCompact ? "w-5 h-6" : "w-6 h-6"
            )}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onTogglePlay}
            title={isPlaying ? "Pause (Spasi)" : "Putar Video (Spasi)"}
            className={cn(
              "rounded-lg bg-[#cf6613] hover:bg-[#b8580f] text-white flex items-center justify-center transition-colors cursor-pointer shadow-sm",
              isCompact ? "w-6 h-6" : "w-7 h-6"
            )}
          >
            {isPlaying ? (
              <Pause className="w-3 h-3 fill-current" />
            ) : (
              <Play className="w-3 h-3 fill-current translate-x-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => onStep(1)}
            title="Frame Maju (Panah Kanan)"
            className={cn(
              "rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-white flex items-center justify-center transition-colors cursor-pointer",
              isCompact ? "w-5 h-6" : "w-6 h-6"
            )}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Timecode Badge */}
        <div
          className={cn(
            "h-7 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center gap-1 font-mono shrink-0",
            isCompact ? "px-1.5 text-[9.5px]" : "px-2 text-[10px]"
          )}
        >
          {isWide && <span className="text-[var(--text-muted)] text-[9px]">FRAME</span>}
          <span className="text-amber-400 font-bold">
            {String(currentFrame).padStart(3, "0")}
          </span>
          <span className="text-[var(--text-muted)]">/</span>
          <span className="text-[var(--text-secondary)]">{durationInFrames}</span>
          {isWide && (
            <span className="text-[var(--text-muted)] text-[9px] ml-0.5">
              ({timeFormatted}s / {totalDurationFormatted}s)
            </span>
          )}
          {!isWide && !isCompact && (
            <span className="text-[var(--text-muted)] text-[9px] ml-0.5">
              ({timeFormatted}s)
            </span>
          )}
        </div>
      </div>

      {/* 2. CENTER SECTION: Fluid Responsive Tools (Adjusts & Expands to Fill Space) */}
      <div className="flex-1 min-w-0 flex items-center justify-center gap-0.5 sm:gap-1 px-0.5 sm:px-1 max-w-4xl mx-auto">
        {/* --- GROUP 1: Composition Settings (Ratio, Speed, FPS) --- */}
        {/* Rasio Dropdown (NO chevron arrow, fully clickable) */}
        <div ref={ratioRef} className="relative flex-1 min-w-[28px] max-w-[54px] sm:max-w-[60px]">
          <button
            type="button"
            onClick={() => {
              setIsRatioOpen((v) => !v);
              setIsSpeedOpen(false);
              setIsFpsOpen(false);
            }}
            title="Pilih Rasio Layar Video"
            className={cn(
              "w-full h-10 flex flex-col items-center justify-center rounded-lg border transition-all cursor-pointer group text-center select-none",
              isRatioOpen
                ? "bg-[var(--bg-hover)] border-amber-400/80 text-amber-400 shadow-sm shadow-amber-500/10"
                : "bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)]"
            )}
          >
            <LayoutTemplate className={cn(toolIconClass, "text-amber-400 transition-colors")} />
            <span className={cn("font-mono font-semibold", toolLabelClass)}>
              {activeRatio || "9:16"}
            </span>
          </button>

          {isRatioOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-60 py-1.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-strong)] shadow-2xl shadow-black/90 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border-color)] mb-1">
                Pilih Rasio Aspek Video
              </div>
              {ratioOptions.map((opt) => {
                const isSelected = activeRatio === opt.value;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onRatioChange(opt.value);
                      setIsRatioOpen(false);
                    }}
                    className={cn(
                      "w-full px-3 py-1.5 flex items-center justify-between text-left transition-colors cursor-pointer",
                      isSelected
                        ? "bg-[#cf6613]/20 text-amber-400 font-semibold"
                        : "text-[var(--text-primary)] hover:bg-[var(--bg-hover)] hover:text-white"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className={cn("w-3.5 h-3.5 shrink-0", isSelected ? "text-amber-400" : "text-[var(--text-muted)]")} />
                      <div>
                        <div className="text-[11px] leading-tight font-medium">{opt.label}</div>
                        <div className="text-[8.5px] text-[var(--text-muted)] font-mono">{opt.sub}</div>
                      </div>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Speed Dropdown (NO chevron arrow, fully clickable) */}
        <div ref={speedRef} className="relative flex-1 min-w-[28px] max-w-[54px] sm:max-w-[60px]">
          <button
            type="button"
            onClick={() => {
              setIsSpeedOpen((v) => !v);
              setIsRatioOpen(false);
              setIsFpsOpen(false);
            }}
            title="Pilih Kecepatan Putar Preview"
            className={cn(
              "w-full h-10 flex flex-col items-center justify-center rounded-lg border transition-all cursor-pointer group text-center select-none",
              isSpeedOpen
                ? "bg-[var(--bg-hover)] border-amber-400/80 text-amber-400 shadow-sm shadow-amber-500/10"
                : "bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)]"
            )}
          >
            <Gauge className={cn(toolIconClass, "text-amber-400 transition-colors")} />
            <span className={cn("font-mono font-semibold", toolLabelClass)}>
              {playbackRate}x
            </span>
          </button>

          {isSpeedOpen && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 w-36 py-1.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-strong)] shadow-2xl shadow-black/90 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border-color)] mb-1">
                Kecepatan Putar
              </div>
              {speedOptions.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => {
                    onSpeedChange(rate);
                    setIsSpeedOpen(false);
                  }}
                  className={cn(
                    "w-full px-3 py-1 flex items-center justify-between text-left text-xs transition-colors cursor-pointer",
                    playbackRate === rate
                      ? "bg-[#cf6613]/20 text-amber-400 font-semibold"
                      : "text-[var(--text-primary)] hover:bg-[var(--bg-hover)] hover:text-white"
                  )}
                >
                  <span className="font-mono">{rate}x Speed</span>
                  {playbackRate === rate && <Check className="w-3.5 h-3.5 text-amber-400" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Frame Rate (FPS) Dropdown (NO chevron arrow, fully clickable) */}
        <div ref={fpsRef} className="relative flex-1 min-w-[28px] max-w-[54px] sm:max-w-[60px]">
          <button
            type="button"
            onClick={() => {
              setIsFpsOpen((v) => !v);
              setIsRatioOpen(false);
              setIsSpeedOpen(false);
            }}
            title="Pilih Frame Rate Komposisi (FPS)"
            className={cn(
              "w-full h-10 flex flex-col items-center justify-center rounded-lg border transition-all cursor-pointer group text-center select-none",
              isFpsOpen
                ? "bg-[var(--bg-hover)] border-amber-400/80 text-amber-400 shadow-sm shadow-amber-500/10"
                : "bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)]"
            )}
          >
            <Film className={cn(toolIconClass, "text-amber-400 transition-colors")} />
            <span className={cn("font-mono font-semibold", toolLabelClass)}>
              {fps}f
            </span>
          </button>

          {isFpsOpen && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 w-36 py-1.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-strong)] shadow-2xl shadow-black/90 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border-color)] mb-1">
                Frame Rate (FPS)
              </div>
              {fpsOptions.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => {
                    if (onFpsChange) onFpsChange(rate);
                    setIsFpsOpen(false);
                  }}
                  className={cn(
                    "w-full px-3 py-1 flex items-center justify-between text-left text-xs transition-colors cursor-pointer",
                    fps === rate
                      ? "bg-[#cf6613]/20 text-amber-400 font-semibold"
                      : "text-[var(--text-primary)] hover:bg-[var(--bg-hover)] hover:text-white"
                  )}
                >
                  <span className="font-mono">{rate} FPS</span>
                  {fps === rate && <Check className="w-3.5 h-3.5 text-amber-400" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Group Divider */}
        {!isCompact && <div className="w-px h-5 bg-[var(--border-color)] mx-0.5 shrink-0" />}

        {/* --- GROUP 2: History (Undo, Redo) --- */}
        {/* Undo */}
        <button
          type="button"
          disabled={!canUndo}
          onClick={onUndo}
          title="Undo Perubahan (Ctrl+Z)"
          className={cn(
            toolBtnClass,
            "text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)] disabled:opacity-20 disabled:pointer-events-none"
          )}
        >
          <RotateCcw className={cn(toolIconClass, "transition-colors group-hover:text-white")} />
          <span className={cn("font-medium", toolLabelClass)}>Undo</span>
        </button>

        {/* Redo */}
        <button
          type="button"
          disabled={!canRedo}
          onClick={onRedo}
          title="Redo Perubahan (Ctrl+Y)"
          className={cn(
            toolBtnClass,
            "text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)] disabled:opacity-20 disabled:pointer-events-none"
          )}
        >
          <RotateCw className={cn(toolIconClass, "transition-colors group-hover:text-white")} />
          <span className={cn("font-medium", toolLabelClass)}>Redo</span>
        </button>

        {/* Group Divider */}
        {!isCompact && <div className="w-px h-5 bg-[var(--border-color)] mx-0.5 shrink-0" />}

        {/* --- GROUP 3: Editing Tools (Crop, Trim, Cut, Mirror, Volume, Delete) --- */}
        {/* Crop / Fit */}
        <button
          type="button"
          onClick={onFit}
          title="Fit Timeline Zoom ke Layar"
          className={cn(
            toolBtnClass,
            "text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)]"
          )}
        >
          <Crop className={cn(toolIconClass, "transition-colors group-hover:text-white")} />
          <span className={cn("font-medium", toolLabelClass)}>Crop</span>
        </button>

        {/* Trim */}
        <button
          type="button"
          onClick={onTrimIn}
          title="Trim In-Point di Playhead"
          className={cn(
            toolBtnClass,
            "text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)]"
          )}
        >
          <FoldHorizontal className={cn(toolIconClass, "transition-colors group-hover:text-white")} />
          <span className={cn("font-medium", toolLabelClass)}>Trim</span>
        </button>

        {/* Cut / Split */}
        <button
          type="button"
          onClick={onSplit}
          title="Potong / Split Klip di Playhead (S atau C)"
          className={cn(
            toolBtnClass,
            "text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)]"
          )}
        >
          <Scissors className={cn(toolIconClass, "transition-colors group-hover:text-white")} />
          <span className={cn("font-medium", toolLabelClass)}>Cut</span>
        </button>

        {/* Mirror / Duplicate */}
        <button
          type="button"
          onClick={onDuplicate}
          title="Duplikasi Klip Aktif (Ctrl+D)"
          className={cn(
            toolBtnClass,
            "text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)]"
          )}
        >
          <Copy className={cn(toolIconClass, "transition-colors group-hover:text-white")} />
          <span className={cn("font-medium", toolLabelClass)}>Mirror</span>
        </button>

        {/* Volume */}
        <button
          type="button"
          onClick={() => setIsMuted((m) => !m)}
          title={isMuted ? "Aktifkan Suara Audio" : "Bisukan Audio Preview"}
          className={cn(
            toolBtnClass,
            isMuted
              ? "text-rose-400 hover:text-rose-300 bg-rose-950/20"
              : "text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)]"
          )}
        >
          {isMuted ? (
            <VolumeX className={cn(toolIconClass, "text-rose-400")} />
          ) : (
            <Volume2 className={cn(toolIconClass, "transition-colors group-hover:text-white")} />
          )}
          <span className={cn("font-medium", toolLabelClass)}>
            {isMuted ? "Muted" : "Volume"}
          </span>
        </button>

        {/* Delete */}
        <button
          type="button"
          onClick={onDelete}
          title="Hapus Klip / Layer Terpilih (Del)"
          className={cn(
            toolBtnClass,
            "text-[var(--text-secondary)] hover:text-rose-400 hover:bg-rose-950/40"
          )}
        >
          <Trash2 className={cn(toolIconClass, "transition-colors group-hover:text-rose-400")} />
          <span className={cn("font-medium", toolLabelClass)}>Delete</span>
        </button>

        {/* Group Divider */}
        {!isCompact && <div className="w-px h-5 bg-[var(--border-color)] mx-0.5 shrink-0" />}

        {/* --- GROUP 4: Track Controls (Snap, Layer) --- */}
        {/* Magnet Snapping */}
        <button
          type="button"
          onClick={onToggleSnap}
          title={isSnapping ? "Magnetic Snapping AKTIF" : "Magnetic Snapping NONAKTIF"}
          className={cn(
            toolBtnClass,
            isSnapping
              ? "bg-[#cf6613]/20 text-amber-400 border border-amber-500/30"
              : "text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)]"
          )}
        >
          <Magnet className={cn(toolIconClass, "transition-colors")} />
          <span className={cn("font-medium", toolLabelClass)}>Snap</span>
        </button>

        {/* Add Layer Track */}
        <button
          type="button"
          onClick={onAddLayer}
          title="Tambah Layer Track Baru"
          className={cn(
            toolBtnClass,
            "text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
          )}
        >
          <Plus className={cn(toolIconClass, "transition-colors")} />
          <span className={cn("font-semibold", toolLabelClass)}>Layer</span>
        </button>
      </div>

      {/* 3. RIGHT SECTION: Zoom, Share, and Orange Export Button */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        {/* Zoom Controls */}
        {isCompact ? (
          <button
            type="button"
            onClick={() => onZoomChange(timelineZoom === 0 ? 30 : 0)}
            className="w-7 h-7 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[9px] font-mono font-bold text-amber-400 hover:text-white flex items-center justify-center cursor-pointer shrink-0"
            title="Toggle Timeline Zoom"
          >
            {timelineZoom > 0 ? `+${timelineZoom}%` : "1x"}
          </button>
        ) : isMedium ? (
          <div className="h-7 px-1.5 flex items-center gap-1 border border-[var(--border-color)] bg-[var(--bg-card)] rounded-xl text-[10px] font-mono shrink-0">
            <button
              type="button"
              onClick={() => onZoomChange(Math.max(-100, timelineZoom - 10))}
              className="text-[var(--text-secondary)] hover:text-amber-400 cursor-pointer p-0.5"
              title="Zoom Out"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => onZoomChange(0)}
              className="text-amber-400 font-semibold px-0.5 cursor-pointer text-[9px]"
              title="Reset Zoom"
            >
              {timelineZoom > 0 ? `+${timelineZoom}%` : `${timelineZoom}%`}
            </button>
            <button
              type="button"
              onClick={() => onZoomChange(Math.min(100, timelineZoom + 10))}
              className="text-[var(--text-secondary)] hover:text-amber-400 cursor-pointer p-0.5"
              title="Zoom In"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="h-7 px-2 flex items-center gap-1.5 border border-[var(--border-color)] bg-[var(--bg-card)] rounded-xl text-[10px] font-mono shrink-0">
            <button
              type="button"
              onClick={() => onZoomChange(Math.max(-100, timelineZoom - 10))}
              className="text-[var(--text-secondary)] hover:text-amber-400 cursor-pointer p-0.5"
              title="Zoom Out"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <input
              type="range"
              min={-100}
              max={100}
              step={5}
              value={timelineZoom}
              onChange={(e) => onZoomChange(Number(e.target.value))}
              className="w-16 sm:w-20 md:w-24 h-1 accent-[#cf6613] bg-[var(--bg-input)] rounded-lg cursor-ew-resize outline-none"
              title={`Timeline Zoom: ${timelineZoom > 0 ? `+${timelineZoom}%` : `${timelineZoom}%`}`}
            />
            <button
              type="button"
              onClick={() => onZoomChange(Math.min(100, timelineZoom + 10))}
              className="text-[var(--text-secondary)] hover:text-amber-400 cursor-pointer p-0.5"
              title="Zoom In"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => onZoomChange(0)}
              className="text-amber-400 font-semibold px-0.5 hover:underline cursor-pointer min-w-5 text-center text-[9px]"
              title="Reset Zoom to 0%"
            >
              {timelineZoom > 0 ? `+${timelineZoom}%` : `${timelineZoom}%`}
            </button>
          </div>
        )}

        {/* Share Button (hidden on compact screens to give full priority to tools) */}
        {!isCompact && (
          <button
            type="button"
            onClick={() => {
              if (onShare) onShare();
            }}
            title="Bagikan Konfigurasi Video (Copy JSON)"
            className="flex flex-col items-center justify-center w-9 h-10 rounded-lg text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)] transition-colors cursor-pointer group shrink-0"
          >
            <Share2 className="w-3.5 h-3.5 text-[var(--text-secondary)] group-hover:text-white transition-colors" />
            <span className="text-[8.5px] font-medium tracking-tight mt-0.5">Share</span>
          </button>
        )}

        {/* Orange Export Pill Button */}
        <button
          type="button"
          onClick={onExport}
          disabled={isExporting}
          title="Render & Export Video MP4 (Lokal GPU)"
          className={cn(
            "h-8 rounded-full bg-[#cf6613] hover:bg-[#b8580f] active:scale-[0.98] border border-[#e07b27] text-white flex items-center gap-1.5 font-semibold shadow-md shadow-orange-950/40 hover:scale-[1.02] transition-all cursor-pointer disabled:opacity-50 shrink-0",
            isCompact ? "px-2.5 text-[11px]" : "px-3.5 text-xs"
          )}
        >
          {isExporting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
          ) : (
            <Download className="w-3.5 h-3.5 text-white stroke-[2.5]" />
          )}
          <span>Export</span>
        </button>
      </div>
    </div>
  );
};

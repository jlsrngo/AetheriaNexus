import React, { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
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

  // ResizeObserver for fluid responsive scaling without overlapping
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

  const isMini = containerWidth < 660;
  const isSmall = containerWidth >= 660 && containerWidth < 880;

  // Close dropdowns on outside click
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
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const timeFormatted = (currentFrame / fps).toFixed(2);

  const ratioOptions = [
    { value: "9:16", label: "9:16 Vertical", sub: "1080×1920 (TikTok, Shorts)", icon: Smartphone },
    { value: "1:1", label: "1:1 Square", sub: "1080×1080 (Feed, Carousel)", icon: Square },
    { value: "16:9", label: "16:9 Landscape", sub: "1920×1080 (YouTube, Web)", icon: Monitor },
    { value: "4:5", label: "4:5 Portrait", sub: "1080×1350 (IG Portrait)", icon: PhonePortrait },
  ];

  const speedOptions: (0.5 | 1 | 1.5 | 2)[] = [0.5, 1, 1.5, 2];
  const fpsOptions: number[] = [24, 25, 30, 50, 60];

  const handleToolsWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY !== 0) {
      e.currentTarget.scrollLeft += e.deltaY;
    }
  };

  return (
    <div
      ref={containerRef}
      className="h-14 px-2 border-b border-[var(--border-color)] bg-[var(--bg-panel)] flex items-center justify-between gap-1.5 select-none shrink-0 relative z-40"
    >
      {/* 1. LEFT SECTION: Playback Transport & Timecode */}
      <div className="flex items-center gap-1 shrink-0">
        <div className="flex items-center gap-0.5 p-0.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm shrink-0">
          <button
            type="button"
            onClick={() => onStep(-1)}
            title="Frame Mundur (Panah Kiri)"
            className="w-6 h-6 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onTogglePlay}
            title={isPlaying ? "Pause (Spasi)" : "Putar Video (Spasi)"}
            className="w-7 h-6 rounded-lg bg-[#cf6613] hover:bg-[#b8580f] text-white flex items-center justify-center transition-colors cursor-pointer shadow-sm"
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
            className="w-6 h-6 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Timecode Badge */}
        <div className="px-2 h-7 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center gap-1 font-mono text-[10px] shrink-0">
          {!isMini && <span className="text-[var(--text-muted)] text-[9px]">FRAME</span>}
          <span className="text-amber-400 font-bold">
            {String(currentFrame).padStart(3, "0")}
          </span>
          <span className="text-[var(--text-muted)]">/</span>
          <span className="text-[var(--text-secondary)]">{durationInFrames}</span>
          {!isSmall && !isMini && (
            <span className="text-[var(--text-muted)] text-[9px] ml-0.5">
              ({timeFormatted}s)
            </span>
          )}
        </div>
      </div>

      {/* 2. COMPOSITION SETTINGS CLUSTER: Ratio, Speed, FPS Dropdowns (Never clipped!) */}
      <div className="flex items-center gap-1 shrink-0 relative z-50">
        {/* Rasio Dropdown Menu */}
        <div ref={ratioRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setIsRatioOpen((v) => !v);
              setIsSpeedOpen(false);
              setIsFpsOpen(false);
            }}
            title="Pilih Rasio Layar Video"
            className={cn(
              "flex flex-col items-center justify-center w-11 h-11 rounded-lg border transition-colors cursor-pointer group",
              isRatioOpen
                ? "bg-[var(--bg-hover)] border-amber-400/80 text-amber-400"
                : "bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)]"
            )}
          >
            <LayoutTemplate className="w-3.5 h-3.5 text-amber-400 transition-colors" />
            <div className="flex items-center gap-0.5 mt-0.5">
              <span className="text-[9px] font-mono font-semibold leading-none">
                {activeRatio || "9:16"}
              </span>
              <ChevronDown className="w-2.5 h-2.5 text-[var(--text-muted)] group-hover:text-amber-400" />
            </div>
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

        {/* Speed Dropdown Menu */}
        <div ref={speedRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setIsSpeedOpen((v) => !v);
              setIsRatioOpen(false);
              setIsFpsOpen(false);
            }}
            title="Pilih Kecepatan Putar Preview"
            className={cn(
              "flex flex-col items-center justify-center w-11 h-11 rounded-lg border transition-colors cursor-pointer group",
              isSpeedOpen
                ? "bg-[var(--bg-hover)] border-amber-400/80 text-amber-400"
                : "bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)]"
            )}
          >
            <Gauge className="w-3.5 h-3.5 text-amber-400 transition-colors" />
            <div className="flex items-center gap-0.5 mt-0.5">
              <span className="text-[9px] font-mono font-semibold leading-none">
                {playbackRate}x
              </span>
              <ChevronDown className="w-2.5 h-2.5 text-[var(--text-muted)] group-hover:text-amber-400" />
            </div>
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

        {/* Frame Rate (FPS) Dropdown Menu */}
        <div ref={fpsRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setIsFpsOpen((v) => !v);
              setIsRatioOpen(false);
              setIsSpeedOpen(false);
            }}
            title="Pilih Frame Rate Komposisi (FPS)"
            className={cn(
              "flex flex-col items-center justify-center w-11 h-11 rounded-lg border transition-colors cursor-pointer group",
              isFpsOpen
                ? "bg-[var(--bg-hover)] border-amber-400/80 text-amber-400"
                : "bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)]"
            )}
          >
            <Film className="w-3.5 h-3.5 text-amber-400 transition-colors" />
            <div className="flex items-center gap-0.5 mt-0.5">
              <span className="text-[9px] font-mono font-semibold leading-none">
                {fps}f
              </span>
              <ChevronDown className="w-2.5 h-2.5 text-[var(--text-muted)] group-hover:text-amber-400" />
            </div>
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
      </div>

      {/* 3. CENTER SECTION: Action Tools (Horizontal Scroll without any clipping) */}
      <div
        onWheel={handleToolsWheel}
        className="flex-1 min-w-0 flex items-center gap-0.5 px-1 py-0.5 rounded-xl bg-[var(--bg-card)]/70 border border-[var(--border-color)] overflow-x-auto scrollbar-none"
      >
        {/* Undo */}
        <button
          type="button"
          disabled={!canUndo}
          onClick={onUndo}
          title="Undo Perubahan (Ctrl+Z)"
          className="flex flex-col items-center justify-center w-10 h-10 rounded-lg text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)] disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer group shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[var(--text-secondary)] group-hover:text-white transition-colors" />
          <span className="text-[8.5px] font-medium tracking-tight mt-0.5">Undo</span>
        </button>

        {/* Redo */}
        <button
          type="button"
          disabled={!canRedo}
          onClick={onRedo}
          title="Redo Perubahan (Ctrl+Y)"
          className="flex flex-col items-center justify-center w-10 h-10 rounded-lg text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)] disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer group shrink-0"
        >
          <RotateCw className="w-3.5 h-3.5 text-[var(--text-secondary)] group-hover:text-white transition-colors" />
          <span className="text-[8.5px] font-medium tracking-tight mt-0.5">Redo</span>
        </button>

        <div className="w-px h-5 bg-[var(--border-color)] mx-0.5 shrink-0" />

        {/* Crop / Fit */}
        <button
          type="button"
          onClick={onFit}
          title="Fit Timeline ke Layar"
          className="flex flex-col items-center justify-center w-10 h-10 rounded-lg text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)] transition-colors cursor-pointer group shrink-0"
        >
          <Crop className="w-3.5 h-3.5 text-[var(--text-secondary)] group-hover:text-white transition-colors" />
          <span className="text-[8.5px] font-medium tracking-tight mt-0.5">Crop</span>
        </button>

        {/* Trim */}
        <button
          type="button"
          onClick={onTrimIn}
          title="Trim Work Area Playhead"
          className="flex flex-col items-center justify-center w-10 h-10 rounded-lg text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)] transition-colors cursor-pointer group shrink-0"
        >
          <FoldHorizontal className="w-3.5 h-3.5 text-[var(--text-secondary)] group-hover:text-white transition-colors" />
          <span className="text-[8.5px] font-medium tracking-tight mt-0.5">Trim</span>
        </button>

        {/* Cut / Split */}
        <button
          type="button"
          onClick={onSplit}
          title="Potong / Split Klip di Playhead (S atau C)"
          className="flex flex-col items-center justify-center w-10 h-10 rounded-lg text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)] transition-colors cursor-pointer group shrink-0"
        >
          <Scissors className="w-3.5 h-3.5 text-[var(--text-secondary)] group-hover:text-white transition-colors" />
          <span className="text-[8.5px] font-medium tracking-tight mt-0.5">Cut</span>
        </button>

        {/* Mirror / Duplicate */}
        <button
          type="button"
          onClick={onDuplicate}
          title="Duplikasi Klip Aktif (Ctrl+D)"
          className="flex flex-col items-center justify-center w-10 h-10 rounded-lg text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)] transition-colors cursor-pointer group shrink-0"
        >
          <Copy className="w-3.5 h-3.5 text-[var(--text-secondary)] group-hover:text-white transition-colors" />
          <span className="text-[8.5px] font-medium tracking-tight mt-0.5">Mirror</span>
        </button>

        {/* Volume */}
        <button
          type="button"
          onClick={() => setIsMuted((m) => !m)}
          title={isMuted ? "Aktifkan Suara Audio" : "Bisukan Audio Preview"}
          className={cn(
            "flex flex-col items-center justify-center w-10 h-10 rounded-lg transition-colors cursor-pointer group shrink-0",
            isMuted
              ? "text-rose-400 hover:text-rose-300"
              : "text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)]"
          )}
        >
          {isMuted ? (
            <VolumeX className="w-3.5 h-3.5 text-rose-400" />
          ) : (
            <Volume2 className="w-3.5 h-3.5 text-[var(--text-secondary)] group-hover:text-white transition-colors" />
          )}
          <span className="text-[8.5px] font-medium tracking-tight mt-0.5">
            {isMuted ? "Muted" : "Volume"}
          </span>
        </button>

        {/* Delete */}
        <button
          type="button"
          onClick={onDelete}
          title="Hapus Klip / Layer Terpilih (Del)"
          className="flex flex-col items-center justify-center w-10 h-10 rounded-lg text-[var(--text-secondary)] hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer group shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5 text-[var(--text-secondary)] group-hover:text-rose-400 transition-colors" />
          <span className="text-[8.5px] font-medium tracking-tight mt-0.5">Delete</span>
        </button>

        <div className="w-px h-5 bg-[var(--border-color)] mx-0.5 shrink-0" />

        {/* Magnet Snapping */}
        <button
          type="button"
          onClick={onToggleSnap}
          title={isSnapping ? "Magnetic Snapping AKTIF" : "Magnetic Snapping NONAKTIF"}
          className={cn(
            "flex flex-col items-center justify-center w-10 h-10 rounded-lg transition-colors cursor-pointer group shrink-0",
            isSnapping
              ? "bg-[#cf6613]/20 text-amber-400"
              : "text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)]"
          )}
        >
          <Magnet className="w-3.5 h-3.5 transition-colors" />
          <span className="text-[8.5px] font-medium tracking-tight mt-0.5">Snap</span>
        </button>

        {/* Add Layer Track (NO duplicate + sign! Only icon + and text 'Layer') */}
        <button
          type="button"
          onClick={onAddLayer}
          title="Tambah Layer Track Baru"
          className="flex flex-col items-center justify-center w-10 h-10 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors cursor-pointer group shrink-0"
        >
          <Plus className="w-3.5 h-3.5 transition-colors" />
          <span className="text-[8.5px] font-semibold tracking-tight mt-0.5">Layer</span>
        </button>
      </div>

      {/* 4. RIGHT SECTION: Zoom, Share, and ORANGE Export Button */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Zoom Controls */}
        {isMini ? (
          <button
            type="button"
            onClick={() => onZoomChange(timelineZoom === 0 ? 30 : 0)}
            className="w-7 h-7 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[9px] font-mono font-bold text-amber-400 hover:text-white flex items-center justify-center cursor-pointer shrink-0"
            title="Toggle Timeline Zoom"
          >
            {timelineZoom > 0 ? `+${timelineZoom}%` : "1x"}
          </button>
        ) : isSmall ? (
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
              className="w-14 h-1 accent-[#cf6613] bg-[var(--bg-input)] rounded-lg cursor-ew-resize outline-none"
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

        {/* Share Button (hidden on mini screens) */}
        {!isMini && (
          <button
            type="button"
            onClick={() => {
              if (onShare) onShare();
            }}
            title="Bagikan Konfigurasi Video"
            className="flex flex-col items-center justify-center w-10 h-10 rounded-lg text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)] transition-colors cursor-pointer group shrink-0"
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
            isMini ? "px-2.5 text-[11px]" : "px-3.5 text-xs"
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

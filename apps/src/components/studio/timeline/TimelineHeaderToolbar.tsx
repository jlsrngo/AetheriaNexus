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
  const [isRatioOpen, setIsRatioOpen] = useState(false);
  const [isSpeedOpen, setIsSpeedOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const ratioDropdownRef = useRef<HTMLDivElement>(null);
  const speedDropdownRef = useRef<HTMLDivElement>(null);

  // Close popovers when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        ratioDropdownRef.current &&
        !ratioDropdownRef.current.contains(e.target as Node)
      ) {
        setIsRatioOpen(false);
      }
      if (
        speedDropdownRef.current &&
        !speedDropdownRef.current.contains(e.target as Node)
      ) {
        setIsSpeedOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const timeFormatted = (currentFrame / fps).toFixed(2);
  const totalSec = (durationInFrames / fps).toFixed(2);

  const ratioOptions = [
    { value: "9:16", label: "9:16 Vertical", sub: "1080×1920 (TikTok / Reels)", icon: Smartphone },
    { value: "1:1", label: "1:1 Square", sub: "1080×1080 (Feed / Carousel)", icon: Square },
    { value: "16:9", label: "16:9 Landscape", sub: "1920×1080 (YouTube / Web)", icon: Monitor },
    { value: "4:5", label: "4:5 Portrait", sub: "1080×1350 (IG Portrait)", icon: PhonePortrait },
  ];

  const speedOptions: (0.5 | 1 | 1.5 | 2)[] = [0.5, 1, 1.5, 2];

  return (
    <div className="h-14 px-3 border-b border-[var(--border-color)] bg-[var(--bg-panel)] flex items-center justify-between gap-2 select-none shrink-0 relative z-30">
      {/* 1. LEFT SECTION: Playback Transport & Frame Counter */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-0.5 p-0.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm">
          {/* Step Back Frame */}
          <button
            type="button"
            onClick={() => onStep(-1)}
            title="Step Back 1 Frame (Arrow Left)"
            className="w-7 h-7 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {/* Play / Pause Primary Button */}
          <button
            type="button"
            onClick={onTogglePlay}
            title={isPlaying ? "Pause (Space)" : "Play (Space)"}
            className="w-8 h-7 rounded-lg bg-[#cf6613] hover:bg-[#b8580f] text-white flex items-center justify-center transition-colors cursor-pointer shadow-sm"
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current translate-x-0.5" />
            )}
          </button>

          {/* Step Forward Frame */}
          <button
            type="button"
            onClick={() => onStep(1)}
            title="Step Forward 1 Frame (Arrow Right)"
            className="w-7 h-7 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors cursor-pointer"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Timecode Badge */}
        <div className="px-2.5 h-8 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center gap-1.5 font-mono text-[11px] shrink-0">
          <span className="text-[var(--text-muted)]">FRAME</span>
          <span className="text-amber-400 font-bold">
            {String(currentFrame).padStart(3, "0")}
          </span>
          <span className="text-[var(--text-muted)]">/</span>
          <span className="text-[var(--text-secondary)]">{durationInFrames}</span>
          <span className="text-[var(--text-muted)] text-[10px]">
            ({timeFormatted}s / {totalSec}s)
          </span>
        </div>
      </div>

      {/* 2. CENTER SECTION: Vertical Icon-and-Label Tools (Matching Reference Design) */}
      <div className="flex items-center gap-1 px-2 py-0.5 rounded-xl bg-[var(--bg-card)]/60 border border-[var(--border-color)] overflow-x-auto">
        {/* Undo */}
        <button
          type="button"
          disabled={!canUndo}
          onClick={onUndo}
          title="Undo (Ctrl+Z)"
          className="flex flex-col items-center justify-center w-11 h-11 rounded-lg text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer group"
        >
          <RotateCcw className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-white transition-colors" />
          <span className="text-[9px] font-medium tracking-tight mt-0.5">Undo</span>
        </button>

        {/* Redo */}
        <button
          type="button"
          disabled={!canRedo}
          onClick={onRedo}
          title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
          className="flex flex-col items-center justify-center w-11 h-11 rounded-lg text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer group"
        >
          <RotateCw className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-white transition-colors" />
          <span className="text-[9px] font-medium tracking-tight mt-0.5">Redo</span>
        </button>

        <div className="w-px h-6 bg-[var(--border-color)] mx-0.5 shrink-0" />

        {/* Canvas / Aspect Ratio Popover */}
        <div ref={ratioDropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setIsRatioOpen((v) => !v)}
            title="Canvas Ratio (9:16, 1:1, 16:9, 4:5)"
            className={cn(
              "flex flex-col items-center justify-center w-11 h-11 rounded-lg transition-colors cursor-pointer group",
              isRatioOpen
                ? "bg-[var(--bg-hover)] text-amber-400 font-semibold"
                : "text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)]"
            )}
          >
            <LayoutTemplate className="w-4 h-4 transition-colors" />
            <span className="text-[9px] font-medium tracking-tight mt-0.5">
              {activeRatio || "Canvas"}
            </span>
          </button>

          {isRatioOpen && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 py-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-strong)] shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border-color)] mb-1">
                Pilih Rasio Canvas
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
                        ? "bg-[#cf6613]/15 text-amber-400 font-semibold"
                        : "text-[var(--text-primary)] hover:bg-[var(--bg-hover)] hover:text-white"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className={cn("w-3.5 h-3.5 shrink-0", isSelected ? "text-amber-400" : "text-[var(--text-muted)]")} />
                      <div>
                        <div className="text-[11px] leading-tight font-medium">{opt.label}</div>
                        <div className="text-[9px] text-[var(--text-muted)] font-mono">{opt.sub}</div>
                      </div>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Crop / Fit */}
        <button
          type="button"
          onClick={onFit}
          title="Crop / Fit Timeline to Screen"
          className="flex flex-col items-center justify-center w-11 h-11 rounded-lg text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)] transition-colors cursor-pointer group"
        >
          <Crop className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-white transition-colors" />
          <span className="text-[9px] font-medium tracking-tight mt-0.5">Crop</span>
        </button>

        {/* Trim / In-Out */}
        <button
          type="button"
          onClick={onTrimIn}
          title="Trim / Set In-Out Work Area"
          className="flex flex-col items-center justify-center w-11 h-11 rounded-lg text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)] transition-colors cursor-pointer group"
        >
          <FoldHorizontal className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-white transition-colors" />
          <span className="text-[9px] font-medium tracking-tight mt-0.5">Trim</span>
        </button>

        {/* Cut / Split */}
        <button
          type="button"
          onClick={onSplit}
          title="Cut / Split Clip at Current Frame (S or C)"
          className="flex flex-col items-center justify-center w-11 h-11 rounded-lg text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)] transition-colors cursor-pointer group"
        >
          <Scissors className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-white transition-colors" />
          <span className="text-[9px] font-medium tracking-tight mt-0.5">Cut</span>
        </button>

        {/* Speed */}
        <div ref={speedDropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setIsSpeedOpen((v) => !v)}
            title="Playback Speed (0.5x, 1.0x, 1.5x, 2.0x)"
            className={cn(
              "flex flex-col items-center justify-center w-11 h-11 rounded-lg transition-colors cursor-pointer group",
              isSpeedOpen
                ? "bg-[var(--bg-hover)] text-amber-400 font-semibold"
                : "text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)]"
            )}
          >
            <Gauge className="w-4 h-4 transition-colors" />
            <span className="text-[9px] font-medium tracking-tight mt-0.5">
              {playbackRate === 1 ? "Speed" : `${playbackRate}x`}
            </span>
          </button>

          {isSpeedOpen && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-36 py-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-strong)] shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border-color)] mb-1">
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
                    "w-full px-2.5 py-1 flex items-center justify-between text-left text-xs transition-colors cursor-pointer",
                    playbackRate === rate
                      ? "bg-[#cf6613]/15 text-amber-400 font-semibold"
                      : "text-[var(--text-primary)] hover:bg-[var(--bg-hover)] hover:text-white"
                  )}
                >
                  <span className="font-mono">{rate}x</span>
                  {playbackRate === rate && <Check className="w-3.5 h-3.5 text-amber-400" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Mirror / Duplicate */}
        <button
          type="button"
          onClick={onDuplicate}
          title="Mirror / Duplicate Selected Layer (Ctrl+D)"
          className="flex flex-col items-center justify-center w-11 h-11 rounded-lg text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)] transition-colors cursor-pointer group"
        >
          <Copy className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-white transition-colors" />
          <span className="text-[9px] font-medium tracking-tight mt-0.5">Mirror</span>
        </button>

        {/* Volume */}
        <button
          type="button"
          onClick={() => setIsMuted((m) => !m)}
          title={isMuted ? "Unmute Preview Audio" : "Mute Preview Audio"}
          className={cn(
            "flex flex-col items-center justify-center w-11 h-11 rounded-lg transition-colors cursor-pointer group",
            isMuted
              ? "text-rose-400 hover:text-rose-300"
              : "text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)]"
          )}
        >
          {isMuted ? (
            <VolumeX className="w-4 h-4 text-rose-400" />
          ) : (
            <Volume2 className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-white transition-colors" />
          )}
          <span className="text-[9px] font-medium tracking-tight mt-0.5">
            {isMuted ? "Muted" : "Volume"}
          </span>
        </button>

        {/* Delete */}
        <button
          type="button"
          onClick={onDelete}
          title="Delete Selected Clip / Layer (Delete)"
          className="flex flex-col items-center justify-center w-11 h-11 rounded-lg text-[var(--text-secondary)] hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer group"
        >
          <Trash2 className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-rose-400 transition-colors" />
          <span className="text-[9px] font-medium tracking-tight mt-0.5">Delete</span>
        </button>

        <div className="w-px h-6 bg-[var(--border-color)] mx-0.5 shrink-0" />

        {/* Magnet Snapping */}
        <button
          type="button"
          onClick={onToggleSnap}
          title={isSnapping ? "Magnetic Snapping ON" : "Magnetic Snapping OFF"}
          className={cn(
            "flex flex-col items-center justify-center w-11 h-11 rounded-lg transition-colors cursor-pointer group",
            isSnapping
              ? "bg-[#cf6613]/20 text-[#f97316]"
              : "text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)]"
          )}
        >
          <Magnet className="w-4 h-4 transition-colors" />
          <span className="text-[9px] font-medium tracking-tight mt-0.5">Snap</span>
        </button>

        {/* Add Layer Track */}
        <button
          type="button"
          onClick={onAddLayer}
          title="Add New Dynamic Track"
          className="flex flex-col items-center justify-center w-11 h-11 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors cursor-pointer group"
        >
          <Plus className="w-4 h-4 transition-colors" />
          <span className="text-[9px] font-semibold tracking-tight mt-0.5">+ Layer</span>
        </button>
      </div>

      {/* 3. RIGHT SECTION: Zoom Slider, Share, and Export Pill Button */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Zoom Controls */}
        <div className="h-8 px-2 flex items-center gap-1.5 border border-[var(--border-color)] bg-[var(--bg-card)] rounded-xl text-[10px] font-mono shrink-0">
          <button
            type="button"
            onClick={() => onZoomChange(Math.max(-100, timelineZoom - 10))}
            className="text-[var(--text-secondary)] hover:text-amber-400 cursor-pointer p-0.5"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
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
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onZoomChange(0)}
            className="text-amber-400 font-semibold px-0.5 hover:underline cursor-pointer min-w-5 text-center text-[10px]"
            title="Reset Zoom to 0%"
          >
            {timelineZoom > 0 ? `+${timelineZoom}%` : `${timelineZoom}%`}
          </button>
        </div>

        {/* Share Button (matching reference) */}
        <button
          type="button"
          onClick={() => {
            if (onShare) onShare();
          }}
          title="Share Video Project"
          className="flex flex-col items-center justify-center w-11 h-11 rounded-lg text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)] transition-colors cursor-pointer group shrink-0"
        >
          <Share2 className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-white transition-colors" />
          <span className="text-[9px] font-medium tracking-tight mt-0.5">Share</span>
        </button>

        {/* Prominent Export Pill Button (Matching user screenshot rounded cyan/emerald pill) */}
        <button
          type="button"
          onClick={onExport}
          disabled={isExporting}
          title="Export / Render Video MP4"
          className="h-9 px-4 rounded-full bg-[#10b981] hover:bg-[#059669] text-white flex items-center gap-1.5 text-xs font-semibold shadow-md shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 shrink-0"
        >
          {isExporting ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : (
            <Download className="w-4 h-4 text-white stroke-[2.5]" />
          )}
          <span>Export</span>
        </button>
      </div>
    </div>
  );
};

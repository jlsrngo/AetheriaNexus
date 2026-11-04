import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Play,
  Pause,
  Repeat,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Zap,
  Eye,
} from "lucide-react";
import { PlayerRef } from "@remotion/player";

interface NexusTimelineProps {
  playerRef: React.RefObject<PlayerRef | null>;
  durationInSeconds?: number;
  fps?: number;
  hookText?: string;
  onOpenExportModal?: () => void;
}

export const NexusTimeline: React.FC<NexusTimelineProps> = ({
  playerRef,
  durationInSeconds = 5,
  fps = 30,
  onOpenExportModal,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  const totalFrames = Math.max(30, Math.round(durationInSeconds * fps));

  // Sync with player current frame
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const interval = setInterval(() => {
      try {
        const frame = player.getCurrentFrame?.() ?? 0;
        setCurrentFrame(frame);
        setIsPlaying(player.isPlaying?.() ?? false);
      } catch { }
    }, 1000 / fps);

    return () => clearInterval(interval);
  }, [playerRef, fps]);

  const togglePlay = () => {
    const player = playerRef.current;
    if (!player) return;
    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
    } else {
      player.play();
      setIsPlaying(true);
    }
  };

  const seekToFrame = useCallback(
    (frame: number) => {
      const clamped = Math.max(0, Math.min(totalFrames, Math.round(frame)));
      playerRef.current?.seekTo(clamped);
      setCurrentFrame(clamped);
    },
    [playerRef, totalFrames]
  );

  const stepFrame = (delta: number) => {
    seekToFrame(currentFrame + delta);
  };

  const toggleMute = () => {
    const player = playerRef.current;
    if (!player) return;
    if (isMuted) {
      player.unmute();
      setIsMuted(false);
    } else {
      player.mute();
      setIsMuted(true);
    }
  };

  // Timeline dragging / scrubbing handler
  const handleTimelineInteraction = useCallback(
    (clientX: number) => {
      const el = timelineRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const clickX = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const ratio = clickX / rect.width;
      seekToFrame(ratio * totalFrames);
    },
    [seekToFrame, totalFrames]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleTimelineInteraction(e.clientX);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        handleTimelineInteraction(e.clientX);
      }
    };
    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleTimelineInteraction]);

  // Format timecode: 00:02.13 (Seconds.Frames like Remotion)
  const formatRemotionTimecode = (frame: number) => {
    const sec = Math.floor(frame / fps);
    const subFrames = frame % fps;
    const mins = Math.floor(sec / 60);
    const remainingSec = sec % 60;
    return `${String(mins).padStart(2, "0")}:${String(remainingSec).padStart(2, "0")}.${String(subFrames).padStart(2, "0")}`;
  };

  const progressPercent = (currentFrame / totalFrames) * 100;

  // Generate ruler timestamps: 00:01.00, 00:02.00, etc.
  const rulerMarks = [];
  for (let s = 1; s <= durationInSeconds; s++) {
    rulerMarks.push({
      sec: s,
      percent: (s / durationInSeconds) * 100,
      label: `00:0${s}.00`,
    });
  }

  return (
    <div className="h-40 bg-[#0e1017] border-t border-neutral-800 flex flex-col shrink-0 select-none font-mono text-xs z-10">
      {/* =================================================================== */}
      {/* 1. TOP TRANSPORT CONTROLS BAR (Identical to Remotion Studio) */}
      {/* =================================================================== */}
      <div className="h-9 px-3 border-b border-neutral-800/80 flex items-center justify-between bg-[#12141c]">
        {/* Left: Quick options */}
        <div className="flex items-center gap-1.5 text-neutral-400">
          <button
            type="button"
            onClick={() => setIsLooping(!isLooping)}
            title={isLooping ? "Loop On" : "Loop Off"}
            className={`p-1.5 hover:text-white transition-none cursor-pointer ${
              isLooping ? "text-orange-400" : "text-neutral-500"
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={toggleMute}
            title={isMuted ? "Unmute" : "Mute"}
            className="p-1.5 hover:text-white text-neutral-400 cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-500" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Center: Authentic Transport Buttons */}
        <div className="flex items-center gap-1">
          {/* First frame */}
          <button
            type="button"
            onClick={() => seekToFrame(0)}
            title="First frame (Home)"
            className="p-1.5 text-neutral-400 hover:text-white cursor-pointer"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          {/* Previous frame */}
          <button
            type="button"
            onClick={() => stepFrame(-1)}
            title="Previous frame (Left arrow)"
            className="p-1.5 text-neutral-400 hover:text-white cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Play / Pause Toggle (Clean, compact, no giant clutter) */}
          <button
            type="button"
            onClick={togglePlay}
            title={isPlaying ? "Pause (Space)" : "Play (Space)"}
            className="w-7 h-7 mx-1 flex items-center justify-center bg-orange-500 hover:bg-orange-400 text-black font-bold transition-none cursor-pointer rounded-none shadow-[0_0_10px_rgba(249,115,22,0.4)]"
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-black" /> : <Play className="w-4 h-4 fill-black ml-0.5" />}
          </button>

          {/* Next frame */}
          <button
            type="button"
            onClick={() => stepFrame(1)}
            title="Next frame (Right arrow)"
            className="p-1.5 text-neutral-400 hover:text-white cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Last frame */}
          <button
            type="button"
            onClick={() => seekToFrame(totalFrames)}
            title="Last frame (End)"
            className="p-1.5 text-neutral-400 hover:text-white cursor-pointer"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: FPS & Sleek Render MP4 Button */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-neutral-400 font-mono">
            {fps}.0 FPS
          </span>

          <button
            type="button"
            onClick={onOpenExportModal}
            className="px-2.5 py-1 bg-orange-500 hover:bg-orange-400 text-black font-bold text-xs flex items-center gap-1.5 uppercase tracking-wider rounded-none cursor-pointer transition-none shadow-[0_0_10px_rgba(249,115,22,0.3)]"
          >
            <Zap className="w-3 h-3 fill-black" />
            <span>Render</span>
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 2. TIMELINE RULER & SCRUBBER AREA (Simple, Authentic Remotion) */}
      {/* =================================================================== */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0c12]">
        {/* Ruler Row */}
        <div className="h-7 border-b border-neutral-800/80 flex shrink-0">
          {/* Left Timecode Box: clean, single line, no overlap */}
          <div className="w-36 px-2.5 border-r border-neutral-800/80 flex items-center justify-between text-[11px] text-orange-400 font-mono bg-[#0e1017] shrink-0">
            <span>{formatRemotionTimecode(currentFrame)}</span>
            <span className="text-neutral-500 text-[10px]">{currentFrame}</span>
          </div>

          {/* Ruler Canvas */}
          <div
            ref={timelineRef}
            onMouseDown={handleMouseDown}
            className="flex-1 relative cursor-pointer overflow-hidden bg-[#0d0f17]"
          >
            {/* Timestamp Ticks */}
            {rulerMarks.map((mark) => (
              <div
                key={mark.sec}
                style={{ left: `${mark.percent}%` }}
                className="absolute top-0 bottom-0 pointer-events-none flex flex-col items-start -translate-x-1/2"
              >
                <span className="text-[9px] text-neutral-500 mt-1 pl-1">
                  {mark.label}
                </span>
                <div className="w-px flex-1 bg-neutral-800/60" />
              </div>
            ))}

            {/* Scrubber Playhead (Orange Line + Pointer Head) */}
            <div
              style={{ left: `${progressPercent}%` }}
              className="absolute top-0 bottom-0 z-30 pointer-events-none -translate-x-1/2 flex flex-col items-center"
            >
              {/* Pointer handle at top of ruler */}
              <div className="w-2.5 h-2.5 bg-orange-500 rotate-45 -mt-1 shadow-md" />
              {/* Red/Orange vertical playhead line */}
              <div className="w-[1.5px] flex-1 bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* 3. SEQUENCE TRACK AREA (Clean single horizontal bar like Remotion) */}
        {/* =================================================================== */}
        <div className="flex-1 flex overflow-hidden">
          {/* Track Header */}
          <div className="w-36 px-2.5 border-r border-neutral-800/80 flex items-center gap-2 text-[11px] text-neutral-300 font-mono bg-[#0c0e15] shrink-0">
            <Eye className="w-3.5 h-3.5 text-neutral-500" />
            <span className="truncate font-semibold">&lt;AbsoluteFill&gt;</span>
          </div>

          {/* Sequence Track Bar (Remotion Blue/Indigo) */}
          <div
            onMouseDown={handleMouseDown}
            className="flex-1 relative cursor-pointer p-1.5 flex items-center bg-[#07090e]"
          >
            {/* Solid Sequence Bar spanning full composition duration */}
            <div className="w-full h-7 bg-[#0b84f3] hover:bg-[#1a8df7] border border-blue-400/40 text-white text-[11px] font-bold flex items-center px-3 shadow-sm select-none transition-none">
              <span className="truncate">&lt;NexusEditorialVideo /&gt;</span>
            </div>

            {/* Vertical Playhead across track */}
            <div
              style={{ left: `${progressPercent}%` }}
              className="absolute top-0 bottom-0 pointer-events-none -translate-x-1/2"
            >
              <div className="w-[1.5px] h-full bg-orange-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

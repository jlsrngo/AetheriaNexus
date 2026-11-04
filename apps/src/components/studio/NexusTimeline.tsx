import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Plus,
  Zap,
  ZoomIn,
  ZoomOut,
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
  hookText = "3 Morning Habits of High Performers",
  onOpenExportModal,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const trackContainerRef = useRef<HTMLDivElement>(null);

  const totalFrames = Math.max(30, Math.round(durationInSeconds * fps));

  // Sync player time updates
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const handleFrameUpdate = () => {
      try {
        const frame = player.getCurrentFrame?.() ?? 0;
        setCurrentFrame(frame);
        setIsPlaying(player.isPlaying?.() ?? false);
      } catch { }
    };

    const interval = setInterval(handleFrameUpdate, 1000 / fps);
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

  const handleStop = () => {
    const player = playerRef.current;
    if (!player) return;
    player.pause();
    player.seekTo(0);
    setIsPlaying(false);
    setCurrentFrame(0);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = trackContainerRef.current;
    if (!container || !playerRef.current) return;
    const rect = container.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const targetPercent = clickX / rect.width;
    const targetFrame = Math.round(targetPercent * totalFrames);
    playerRef.current.seekTo(targetFrame);
    setCurrentFrame(targetFrame);
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

  // Format timecode: 00:00:SS:FF
  const formatTimecode = (frame: number) => {
    const currentSec = Math.floor(frame / fps);
    const subFrames = frame % fps;
    const mins = Math.floor(currentSec / 60);
    const secs = currentSec % 60;
    return `00:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}:${String(subFrames).padStart(2, "0")}`;
  };

  const progressPercent = (currentFrame / totalFrames) * 100;

  return (
    <div className="h-44 bg-neutral-950 border-t border-neutral-800 flex flex-col shrink-0 select-none font-mono text-xs z-10">
      {/* 1. TIMELINE TOP CONTROL BAR */}
      <div className="h-9 px-3 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/80">
        {/* Left: Title + New track */}
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-[11px] tracking-wider text-white uppercase">
            TIMELINE
          </span>
          <button
            type="button"
            title="Add track"
            className="p-1 text-neutral-400 hover:text-white cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center: Timecode & Transport Buttons */}
        <div className="flex items-center gap-4">
          <div className="font-mono text-emerald-400 text-xs font-bold tracking-wider">
            {formatTimecode(currentFrame)}{" "}
            <span className="text-neutral-500 font-normal">/ {formatTimecode(totalFrames)}</span>
          </div>

          {/* Transport Controls */}
          <div className="flex items-center gap-1 bg-neutral-950 px-2 py-0.5 border border-neutral-800">
            <button
              type="button"
              onClick={() => playerRef.current?.seekTo(0)}
              title="First Frame"
              className="p-1 text-neutral-400 hover:text-white cursor-pointer"
            >
              <SkipBack className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={handleStop}
              title="Stop"
              className="p-1 text-neutral-400 hover:text-white cursor-pointer"
            >
              <Square className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={togglePlay}
              title={isPlaying ? "Pause" : "Play"}
              className="px-2 py-0.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold cursor-pointer transition-none"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => playerRef.current?.seekTo(totalFrames)}
              title="Last Frame"
              className="p-1 text-neutral-400 hover:text-white cursor-pointer"
            >
              <SkipForward className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={toggleMute}
              title={isMuted ? "Unmute" : "Mute"}
              className="p-1 text-neutral-400 hover:text-white cursor-pointer ml-1"
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Zoom Slider */}
          <div className="hidden md:flex items-center gap-1.5 text-neutral-500">
            <ZoomOut className="w-3 h-3" />
            <input
              type="range"
              min="1"
              max="2"
              step="0.1"
              value={zoomLevel}
              onChange={(e) => setZoomLevel(Number(e.target.value))}
              className="w-16 h-1 bg-neutral-800 accent-emerald-500 cursor-pointer"
            />
            <ZoomIn className="w-3 h-3" />
          </div>
        </div>

        {/* Right: EXPORT MP4 BUTTON (Placed in Timeline as requested!) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenExportModal}
            className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs flex items-center gap-1.5 uppercase tracking-wider rounded-none cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-none"
          >
            <Zap className="w-3.5 h-3.5 fill-black" />
            <span>EXPORT MP4</span>
          </button>
        </div>
      </div>

      {/* 2. TIMELINE TRACKS AREA */}
      <div className="flex-1 flex overflow-hidden">
        {/* Track Headers Column */}
        <div className="w-36 bg-neutral-900/60 border-r border-neutral-800 flex flex-col divide-y divide-neutral-800/80 text-[10px] text-neutral-400 font-mono shrink-0">
          <div className="h-8 px-2 flex items-center justify-between text-neutral-500">
            <span>TRACK / FPS</span>
            <span>{fps}F</span>
          </div>
          <div className="h-8 px-2 flex items-center gap-1.5 text-white font-bold bg-neutral-950/60">
            <span className="w-2 h-2 bg-emerald-400" />
            <span>V1: HOOK TEXT</span>
          </div>
          <div className="h-8 px-2 flex items-center gap-1.5 text-cyan-300 font-bold bg-neutral-950/60">
            <span className="w-2 h-2 bg-cyan-400" />
            <span>V2: B-ROLL BG</span>
          </div>
          <div className="h-8 px-2 flex items-center gap-1.5 text-purple-300 font-bold bg-neutral-950/60">
            <span className="w-2 h-2 bg-purple-400" />
            <span>A1: AUDIO BGM</span>
          </div>
        </div>

        {/* Multi-Track Scrubbing Grid */}
        <div
          ref={trackContainerRef}
          onClick={handleSeek}
          className="flex-1 flex flex-col relative overflow-hidden cursor-pointer divide-y divide-neutral-900 bg-neutral-950"
        >
          {/* Time Ruler */}
          <div className="h-8 bg-neutral-900/40 relative flex items-center px-2 text-[9px] text-neutral-500 border-b border-neutral-800/80 pointer-events-none">
            <div className="absolute left-[0%] font-mono">00:00:00</div>
            <div className="absolute left-[25%] font-mono">00:00:03</div>
            <div className="absolute left-[50%] font-mono">00:00:07</div>
            <div className="absolute left-[75%] font-mono">00:00:11</div>
            <div className="absolute left-[92%] font-mono">00:00:15</div>
          </div>

          {/* Track 1: V1 Hook Text */}
          <div className="h-8 relative flex items-center px-1">
            <div className="h-6 w-full bg-emerald-950/40 border border-emerald-500/50 flex items-center px-2 text-[10px] text-emerald-300 truncate font-mono">
              <span className="font-bold mr-1.5">[HOOK]:</span>
              <span className="truncate">{hookText}</span>
            </div>
          </div>

          {/* Track 2: V2 B-Roll BG Blocks */}
          <div className="h-8 relative flex items-center gap-1 px-1">
            <div className="h-6 w-[45%] bg-cyan-950/40 border border-cyan-500/40 flex items-center px-2 text-[10px] text-cyan-300 font-mono truncate">
              cyber_grid_loop.mp4
            </div>
            <div className="h-6 w-[55%] bg-cyan-950/40 border border-cyan-500/40 flex items-center px-2 text-[10px] text-cyan-300 font-mono truncate">
              matrix_particles.mp4
            </div>
          </div>

          {/* Track 3: A1 Background Audio with Waveform SVG */}
          <div className="h-8 relative flex items-center px-1">
            <div className="h-6 w-full bg-purple-950/40 border border-purple-500/40 relative overflow-hidden flex items-center px-2">
              <span className="text-[10px] text-purple-300 font-mono z-10">lofi_focus_beat.mp3 (120 BPM)</span>
              {/* Synthetic Audio Waveform Graphic */}
              <svg className="absolute inset-0 w-full h-full opacity-30 text-purple-400" preserveAspectRatio="none" viewBox="0 0 200 24">
                <path d="M0,12 Q10,2 20,12 T40,12 T60,4 T80,18 T100,2 T120,20 T140,8 T160,16 T180,6 T200,12 L200,24 L0,24 Z" fill="currentColor" />
              </svg>
            </div>
          </div>

          {/* Active Playhead Scrubber Line */}
          <div
            className="absolute top-0 bottom-0 pointer-events-none z-20"
            style={{ left: `${progressPercent}%` }}
          >
            <div className="w-0.5 h-full bg-rose-500 relative">
              <div className="w-2.5 h-3 bg-rose-500 -ml-1 -top-0.5 absolute shadow-md border border-white" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


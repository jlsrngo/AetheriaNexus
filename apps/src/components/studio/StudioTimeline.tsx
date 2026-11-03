import { memo, useState, useRef, useCallback, useEffect } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

interface StudioTimelineProps {
  currentFrame: number;
  durationInFrames: number;
  fps: number;
  isPlaying: boolean;
  onPlayPause: () => void;
  onSeek: (frame: number) => void;
  onToggleLoop?: () => void;
  isLooping?: boolean;
}

export const StudioTimeline = memo(function StudioTimeline({
  currentFrame,
  durationInFrames,
  fps,
  isPlaying,
  onPlayPause,
  onSeek,
}: StudioTimelineProps) {
  const [zoom, setZoom] = useState(1);
  const [trackVisibility, setTrackVisibility] = useState({
    hook: true,
    body: true,
    captions: true,
    audio: true,
  });
  const [trackMuted, setTrackMuted] = useState({
    audio: false,
  });

  const rulerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  // Format frame into mm:ss.ff
  const formatTimecode = (frame: number) => {
    const totalSeconds = frame / fps;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const subFrames = Math.floor(frame % fps);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(subFrames).padStart(2, "0")}`;
  };

  const handleRulerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    updateSeekFromMouse(e);
  };

  const updateSeekFromMouse = useCallback(
    (e: MouseEvent | React.MouseEvent<HTMLDivElement>) => {
      if (!rulerRef.current) return;
      const rect = rulerRef.current.getBoundingClientRect();
      const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const percentage = clickX / rect.width;
      const targetFrame = Math.round(percentage * (durationInFrames - 1));
      onSeek(Math.max(0, Math.min(targetFrame, durationInFrames - 1)));
    },
    [durationInFrames, onSeek]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        updateSeekFromMouse(e);
      }
    };
    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [updateSeekFromMouse]);

  // Generate time ruler interval ticks (every 1 second)
  const durationSeconds = Math.ceil(durationInFrames / fps);
  const playheadPercent = durationInFrames > 0 ? (currentFrame / (durationInFrames - 1)) * 100 : 0;

  return (
    <div className="h-64 bg-neutral-950 border-t border-neutral-800 flex flex-col select-none font-mono text-xs overflow-hidden">
      {/* 1. TOP TIMELINE TOOLBAR (Swiss Brutalism Technical HUD) */}
      <div className="h-9 bg-neutral-900/90 border-b border-neutral-800 px-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {/* Current Timecode Badge */}
          <div className="flex items-center gap-2 bg-black border border-neutral-700 px-2.5 py-1 text-white font-mono text-xs tracking-wider">
            <span className="w-1.5 h-1.5 bg-rose-500 rounded-none inline-block animate-pulse" />
            <span className="font-bold text-neutral-100">{formatTimecode(currentFrame)}</span>
            <span className="text-neutral-500">/</span>
            <span className="text-neutral-400">{formatTimecode(durationInFrames)}</span>
          </div>

          {/* Quick Transport Buttons */}
          <div className="flex items-center gap-0.5 border border-neutral-800 bg-neutral-950 p-0.5">
            <button
              type="button"
              onClick={() => onSeek(0)}
              title="Return to start (Frame 0)"
              className="p-1 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-none cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onPlayPause}
              title={isPlaying ? "Pause (Space)" : "Play (Space)"}
              className="p-1 px-2.5 bg-white text-black hover:bg-neutral-200 transition-none cursor-pointer font-bold flex items-center gap-1 text-[11px]"
            >
              {isPlaying ? <Pause className="w-3 h-3 fill-black" /> : <Play className="w-3 h-3 fill-black" />}
              <span>{isPlaying ? "PAUSE" : "PLAY"}</span>
            </button>
          </div>

          {/* Frame & FPS Telemetry */}
          <div className="hidden sm:flex items-center gap-2 text-[10px] text-neutral-400 tracking-wider">
            <span>FRAME: {currentFrame}</span>
            <span className="text-neutral-700">|</span>
            <span>FPS: {fps}</span>
            <span className="text-neutral-700">|</span>
            <span className="text-emerald-400">SYNCED: REMOTION_SIDEBAR</span>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-neutral-400 text-[10px]">
            <ZoomOut className="w-3 h-3" />
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-16 h-1 bg-neutral-800 accent-white rounded-none cursor-pointer"
            />
            <ZoomIn className="w-3 h-3" />
            <span className="w-7 text-right">{Math.round(zoom * 100)}%</span>
          </div>
        </div>
      </div>

      {/* 2. TIMELINE MAIN WORKSPACE (Tracks & Ruler) */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Left Column: Track Headers */}
        <div className="w-48 bg-neutral-900/95 border-r border-neutral-800 flex flex-col shrink-0 z-20">
          {/* Header spacer aligned with ruler */}
          <div className="h-6 border-b border-neutral-800 px-3 flex items-center text-[9px] uppercase tracking-widest text-neutral-500 bg-neutral-950 font-bold">
            TRACK CHANNELS
          </div>

          {/* Track 1: Hook Track */}
          <div className="h-12 border-b border-neutral-800 px-2.5 flex items-center justify-between bg-neutral-900/80">
            <div className="flex items-center gap-2 truncate">
              <span className="w-2 h-2 bg-emerald-400 shrink-0" />
              <div className="truncate">
                <div className="text-[10px] font-bold text-white uppercase tracking-wider truncate">
                  V1 // HOOK LAYER
                </div>
                <div className="text-[9px] text-neutral-500 uppercase tracking-widest">Visual & Title</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setTrackVisibility((prev) => ({ ...prev, hook: !prev.hook }))}
              className="p-1 text-neutral-400 hover:text-white"
            >
              {trackVisibility.hook ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 text-neutral-600" />}
            </button>
          </div>

          {/* Track 2: Core Body Points */}
          <div className="h-12 border-b border-neutral-800 px-2.5 flex items-center justify-between bg-neutral-900/80">
            <div className="flex items-center gap-2 truncate">
              <span className="w-2 h-2 bg-violet-400 shrink-0" />
              <div className="truncate">
                <div className="text-[10px] font-bold text-white uppercase tracking-wider truncate">
                  V2 // VALUE BULLETS
                </div>
                <div className="text-[9px] text-neutral-500 uppercase tracking-widest">3-Point Sequence</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setTrackVisibility((prev) => ({ ...prev, body: !prev.body }))}
              className="p-1 text-neutral-400 hover:text-white"
            >
              {trackVisibility.body ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 text-neutral-600" />}
            </button>
          </div>

          {/* Track 3: Kinetic Captions */}
          <div className="h-12 border-b border-neutral-800 px-2.5 flex items-center justify-between bg-neutral-900/80">
            <div className="flex items-center gap-2 truncate">
              <span className="w-2 h-2 bg-amber-400 shrink-0" />
              <div className="truncate">
                <div className="text-[10px] font-bold text-white uppercase tracking-wider truncate">
                  TXT // CAPTIONS
                </div>
                <div className="text-[9px] text-neutral-500 uppercase tracking-widest">Typewriter HUD</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setTrackVisibility((prev) => ({ ...prev, captions: !prev.captions }))}
              className="p-1 text-neutral-400 hover:text-white"
            >
              {trackVisibility.captions ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 text-neutral-600" />}
            </button>
          </div>

          {/* Track 4: Audio Track */}
          <div className="h-12 border-b border-neutral-800 px-2.5 flex items-center justify-between bg-neutral-900/80">
            <div className="flex items-center gap-2 truncate">
              <span className="w-2 h-2 bg-cyan-400 shrink-0" />
              <div className="truncate">
                <div className="text-[10px] font-bold text-white uppercase tracking-wider truncate">
                  A1 // AUDIO & BGM
                </div>
                <div className="text-[9px] text-neutral-500 uppercase tracking-widest">Ambient Waveform</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setTrackMuted((prev) => ({ ...prev, audio: !prev.audio }))}
              className="p-1 text-neutral-400 hover:text-white"
            >
              {trackMuted.audio ? <VolumeX className="w-3 h-3 text-rose-500" /> : <Volume2 className="w-3 h-3 text-cyan-400" />}
            </button>
          </div>
        </div>

        {/* Right Column: Time Ruler & Multi-Track Clips Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-x-auto relative bg-neutral-950">
          {/* Time Ruler (Interactive Seekbar) */}
          <div
            ref={rulerRef}
            onMouseDown={handleRulerMouseDown}
            className="h-6 bg-neutral-900/60 border-b border-neutral-800 relative cursor-pointer select-none"
          >
            {Array.from({ length: durationSeconds + 1 }).map((_, sec) => {
              const posPercent = (sec / durationSeconds) * 100;
              return (
                <div
                  key={sec}
                  className="absolute top-0 bottom-0 flex flex-col justify-between"
                  style={{ left: `${posPercent}%` }}
                >
                  <div className="h-2 w-px bg-neutral-600" />
                  <span className="text-[8px] text-neutral-500 font-mono tracking-tighter pl-1">
                    00:{String(sec).padStart(2, "0")}
                  </span>
                  <div className="h-1 w-px bg-neutral-700" />
                </div>
              );
            })}
          </div>

          {/* Multi-Track Clip Lanes */}
          <div className="flex-1 flex flex-col relative min-w-full">
            {/* Background Grid Lines */}
            <div
              className="absolute inset-0 pointer-events-none opacity-20"
              style={{
                backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px)",
                backgroundSize: `${100 / durationSeconds}% 100%`,
              }}
            />

            {/* Track 1: Hook Clip Block */}
            <div className="h-12 border-b border-neutral-900 px-1 py-1.5 relative">
              <div
                className="h-full bg-emerald-950/70 border border-emerald-500/60 text-emerald-200 px-3 flex items-center justify-between text-[10px] font-bold shadow-sm"
                style={{ width: "35%" }}
              >
                <span className="truncate">HOOK INTRO // 0s - 1.8s (CURIOSTIY GAP)</span>
                <span className="text-[9px] text-emerald-400 font-mono">1.8s</span>
              </div>
            </div>

            {/* Track 2: Core Body Points Clips */}
            <div className="h-12 border-b border-neutral-900 px-1 py-1.5 flex gap-1 relative">
              <div
                className="h-full bg-violet-950/70 border border-violet-500/60 text-violet-200 px-2.5 flex items-center justify-between text-[10px] font-bold truncate"
                style={{ width: "25%", marginLeft: "35%" }}
              >
                <span className="truncate">POINT 01: WATER</span>
              </div>
              <div
                className="h-full bg-violet-950/70 border border-violet-500/60 text-violet-200 px-2.5 flex items-center justify-between text-[10px] font-bold truncate"
                style={{ width: "22%" }}
              >
                <span className="truncate">POINT 02: STRETCH</span>
              </div>
              <div
                className="h-full bg-violet-950/70 border border-violet-500/60 text-violet-200 px-2.5 flex items-center justify-between text-[10px] font-bold truncate"
                style={{ width: "18%" }}
              >
                <span className="truncate">POINT 03: CTA</span>
              </div>
            </div>

            {/* Track 3: Kinetic Captions Clip Block */}
            <div className="h-12 border-b border-neutral-900 px-1 py-1.5 relative">
              <div
                className="h-full bg-amber-950/70 border border-amber-500/60 text-amber-200 px-3 flex items-center justify-between text-[10px] font-bold"
                style={{ width: "95%" }}
              >
                <span className="truncate">TYPEWRITER CAPTIONS // AUTO-SYNC TELEMETRY</span>
                <span className="text-[9px] text-amber-400 font-mono">FULL DURATION</span>
              </div>
            </div>

            {/* Track 4: Audio Waveform Clip Block */}
            <div className="h-12 border-b border-neutral-900 px-1 py-1.5 relative">
              <div
                className="h-full bg-cyan-950/70 border border-cyan-500/60 text-cyan-200 px-3 flex items-center justify-between text-[10px] font-bold relative overflow-hidden"
                style={{ width: "100%" }}
              >
                {/* SVG Simulated Waveform */}
                <div className="absolute inset-0 flex items-center justify-around opacity-30 px-2 pointer-events-none">
                  {Array.from({ length: 48 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-1 bg-cyan-300"
                      style={{
                        height: `${Math.sin(i * 0.4) * 40 + 50}%`,
                      }}
                    />
                  ))}
                </div>
                <span className="truncate z-10">BGM: LO-FI FOCUS BEATS // H.264 STEREO AAC</span>
                <span className="text-[9px] text-cyan-400 font-mono z-10">-14 LUFS</span>
              </div>
            </div>

            {/* RED PLAYHEAD SCRUBBER LINE (Spans through entire ruler & lanes) */}
            <div
              className="absolute top-0 bottom-0 pointer-events-none z-30 transition-none"
              style={{ left: `${playheadPercent}%` }}
            >
              {/* Scrubber Head Arrow */}
              <div className="w-3 h-3 bg-rose-500 -ml-1.5 -mt-6 transform rotate-45 border border-white" />
              {/* Vertical Scrubber Needle Line */}
              <div className="w-0.5 h-full bg-rose-500 -ml-px shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

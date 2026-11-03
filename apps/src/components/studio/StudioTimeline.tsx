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
  Type,
  Layers,
  Music,
  Edit3,
  X,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { NexusVideoProps } from "../../remotion/types";

interface StudioTimelineProps {
  currentFrame: number;
  durationInFrames: number;
  fps: number;
  isPlaying: boolean;
  videoProps?: NexusVideoProps;
  trackVisibility?: { text: boolean; background: boolean; audio: boolean };
  onToggleTrackVisibility?: (track: "text" | "background" | "audio") => void;
  onUpdateProps?: (updated: Partial<NexusVideoProps>) => void;
  onPlayPause: () => void;
  onSeek: (frame: number) => void;
  onToggleLoop?: () => void;
  isLooping?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const StudioTimeline = memo(function StudioTimeline({
  currentFrame,
  durationInFrames,
  fps,
  isPlaying,
  videoProps,
  trackVisibility = { text: true, background: true, audio: true },
  onToggleTrackVisibility,
  onUpdateProps,
  onPlayPause,
  onSeek,
  isCollapsed = false,
  onToggleCollapse,
}: StudioTimelineProps) {
  const [zoom, setZoom] = useState(1);
  const [editingClip, setEditingClip] = useState<"hook" | "bullets" | "background" | "audio" | null>(null);

  // Local draft states for modal
  const [draftHook, setDraftHook] = useState(videoProps?.hookText || "");
  const [draftBody, setDraftBody] = useState(videoProps?.bodyText || "");
  const [draftTheme, setDraftTheme] = useState<NexusVideoProps["themeColor"]>(videoProps?.themeColor || "emerald");
  const [draftVolume, setDraftVolume] = useState(80);

  // Keep draft in sync if external props change
  useEffect(() => {
    if (videoProps) {
      setDraftHook(videoProps.hookText);
      setDraftBody(videoProps.bodyText);
      setDraftTheme(videoProps.themeColor);
    }
  }, [videoProps]);

  // Listen to Edit Menu events
  useEffect(() => {
    const handleEditTrack = (e: CustomEvent<"hook" | "bullets" | "background" | "audio">) => {
      if (e.detail) {
        setEditingClip(e.detail);
      }
    };
    window.addEventListener("arunaki-edit-track", handleEditTrack as any);
    return () => window.removeEventListener("arunaki-edit-track", handleEditTrack as any);
  }, []);

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

  const handleApplyHook = () => {
    onUpdateProps?.({ hookText: draftHook });
    setEditingClip(null);
  };

  const handleApplyBullets = () => {
    onUpdateProps?.({ bodyText: draftBody });
    setEditingClip(null);
  };

  const handleApplyBackground = (theme: NexusVideoProps["themeColor"]) => {
    setDraftTheme(theme);
    onUpdateProps?.({ themeColor: theme });
    setEditingClip(null);
  };

  const durationSeconds = Math.ceil(durationInFrames / fps);
  const playheadPercent = durationInFrames > 0 ? (currentFrame / (durationInFrames - 1)) * 100 : 0;

  // Collapsed Minimalist Transport Bar
  if (isCollapsed) {
    return (
      <div className="h-8 bg-neutral-900 border-t border-neutral-800 px-3 flex items-center justify-between shrink-0 select-none font-mono text-xs z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-black border border-neutral-700 px-2 py-0.5 text-white font-mono text-[11px]">
            <span className="w-1.5 h-1.5 bg-rose-500 rounded-none inline-block animate-pulse" />
            <span className="font-bold">{formatTimecode(currentFrame)}</span>
            <span className="text-neutral-500">/</span>
            <span className="text-neutral-400">{formatTimecode(durationInFrames)}</span>
          </div>

          <button
            type="button"
            onClick={onPlayPause}
            className="px-2 py-0.5 bg-white text-black font-bold text-[10px] flex items-center gap-1 hover:bg-neutral-200 transition-none cursor-pointer"
          >
            {isPlaying ? <Pause className="w-3 h-3 fill-black" /> : <Play className="w-3 h-3 fill-black" />}
            <span>{isPlaying ? "PAUSE" : "PLAY"}</span>
          </button>

          <span className="text-[10px] text-neutral-400 hidden sm:inline">FRAME: {currentFrame} | FPS: {fps}</span>
        </div>

        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-white font-mono text-[10px] font-bold uppercase tracking-wider transition-none cursor-pointer"
            title="Expand Timeline (Ctrl+T)"
          >
            <ChevronUp className="w-3 h-3 text-emerald-400" />
            <span>EXPAND TIMELINE (Ctrl+T)</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="h-64 bg-neutral-950 border-t border-neutral-800 flex flex-col select-none font-mono text-xs overflow-hidden relative">
      {/* 1. TOP TIMELINE TOOLBAR (Swiss Brutalism Technical HUD) */}
      <div className="h-9 bg-neutral-900/90 border-b border-neutral-800 px-3 flex items-center justify-between shrink-0 overflow-x-auto no-scrollbar gap-3">
        <div className="flex items-center gap-3 shrink-0 whitespace-nowrap">
          {/* Current Timecode Badge */}
          <div className="flex items-center gap-2 bg-black border border-neutral-700 px-2.5 py-1 text-white font-mono text-xs tracking-wider shrink-0 whitespace-nowrap">
            <span className="w-1.5 h-1.5 bg-rose-500 rounded-none inline-block animate-pulse shrink-0" />
            <span className="font-bold text-neutral-100">{formatTimecode(currentFrame)}</span>
            <span className="text-neutral-500">/</span>
            <span className="text-neutral-400">{formatTimecode(durationInFrames)}</span>
          </div>

          {/* Quick Transport Buttons */}
          <div className="flex items-center gap-0.5 border border-neutral-800 bg-neutral-950 p-0.5 shrink-0 whitespace-nowrap">
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

          {/* Frame & FPS Telemetry (Guaranteed single line, never stacks) */}
          <div className="hidden sm:flex items-center gap-2 text-[10px] text-neutral-400 tracking-wider shrink-0 whitespace-nowrap">
            <span className="whitespace-nowrap">FRAME: {currentFrame}</span>
            <span className="text-neutral-700">|</span>
            <span className="whitespace-nowrap">FPS: {fps}</span>
            <span className="text-neutral-700">|</span>
            <span className="text-emerald-400 whitespace-nowrap">SYNCED: LOCAL ENGINE</span>
          </div>
        </div>

        {/* Zoom & Collapse Controls */}
        <div className="flex items-center gap-3 shrink-0 whitespace-nowrap">
          <div className="flex items-center gap-1 text-neutral-400 text-[10px] shrink-0 whitespace-nowrap">
            <ZoomOut className="w-3 h-3 shrink-0" />
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-16 h-1 bg-neutral-800 accent-white rounded-none cursor-pointer"
            />
            <ZoomIn className="w-3 h-3 shrink-0" />
            <span className="w-7 text-right shrink-0">{Math.round(zoom * 100)}%</span>
          </div>

          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="flex items-center gap-1 px-2.5 py-1 bg-neutral-950 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-white text-[10px] font-mono font-bold tracking-wider uppercase transition-none cursor-pointer"
              title="Collapse Timeline (Ctrl+T)"
            >
              <ChevronDown className="w-3 h-3 text-emerald-400" />
              <span>COLLAPSE</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. TIMELINE MAIN WORKSPACE (Tracks & Ruler) */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Left Column: Track Headers (Icons Only - Zero Edit Icons) */}
        <div className="w-16 bg-neutral-900/95 border-r border-neutral-800 flex flex-col shrink-0 z-20">
          {/* Header spacer aligned with ruler */}
          <div className="h-6 border-b border-neutral-800 px-2 flex items-center justify-center text-[9px] uppercase tracking-wider text-neutral-500 bg-neutral-950 font-bold">
            TRACKS
          </div>

          {/* Track 1: TEXT */}
          <div className="h-14 border-b border-neutral-800 px-2.5 flex items-center justify-between bg-neutral-900/80">
            <Type className="w-4 h-4 text-amber-400 shrink-0" />
            <button
              type="button"
              onClick={() => onToggleTrackVisibility?.("text")}
              className="p-1 text-neutral-400 hover:text-white cursor-pointer"
              title={trackVisibility.text ? "Hide text layer" : "Show text layer"}
            >
              {trackVisibility.text ? <Eye className="w-3.5 h-3.5 text-white" /> : <EyeOff className="w-3.5 h-3.5 text-neutral-600" />}
            </button>
          </div>

          {/* Track 2: BACKGROUND */}
          <div className="h-14 border-b border-neutral-800 px-2.5 flex items-center justify-between bg-neutral-900/80">
            <Layers className="w-4 h-4 text-emerald-400 shrink-0" />
            <button
              type="button"
              onClick={() => onToggleTrackVisibility?.("background")}
              className="p-1 text-neutral-400 hover:text-white cursor-pointer"
              title={trackVisibility.background ? "Hide background layer" : "Show background layer"}
            >
              {trackVisibility.background ? <Eye className="w-3.5 h-3.5 text-white" /> : <EyeOff className="w-3.5 h-3.5 text-neutral-600" />}
            </button>
          </div>

          {/* Track 3: AUDIO */}
          <div className="h-14 border-b border-neutral-800 px-2.5 flex items-center justify-between bg-neutral-900/80">
            <Music className="w-4 h-4 text-cyan-400 shrink-0" />
            <button
              type="button"
              onClick={() => onToggleTrackVisibility?.("audio")}
              className="p-1 text-neutral-400 hover:text-white cursor-pointer"
              title={trackVisibility.audio ? "Mute audio" : "Unmute audio"}
            >
              {trackVisibility.audio ? <Volume2 className="w-3.5 h-3.5 text-cyan-400" /> : <VolumeX className="w-3.5 h-3.5 text-rose-500" />}
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

            {/* Track 1: TEXT Lane (Hook & Bullets edited 1/1) */}
            <div className="h-14 border-b border-neutral-900 px-1 py-1.5 flex gap-1 relative select-none">
              {/* Hook Clip */}
              <div
                onClick={() => setEditingClip("hook")}
                className="h-full bg-amber-950/70 border border-amber-500/60 text-amber-200 px-2.5 flex items-center justify-between text-[10px] font-bold hover:border-amber-400 hover:bg-amber-900/60 cursor-pointer transition-colors"
                style={{ width: "45%" }}
                title="Click to edit Hook Title"
              >
                <div className="truncate flex items-center gap-1.5">
                  <Type className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="truncate">{videoProps?.hookText || "Hook Headline"}</span>
                </div>
                <span className="text-[9px] text-amber-400 font-mono shrink-0 ml-1">HOOK</span>
              </div>

              {/* Bullets Clip */}
              <div
                onClick={() => setEditingClip("bullets")}
                className="h-full bg-amber-900/50 border border-amber-600/40 text-amber-100 px-2.5 flex items-center justify-between text-[10px] font-bold hover:border-amber-400 hover:bg-amber-850/60 cursor-pointer transition-colors"
                style={{ width: "55%" }}
                title="Click to edit Body Bullets"
              >
                <div className="truncate flex items-center gap-1.5">
                  <span className="truncate">{videoProps?.bodyText ? videoProps.bodyText.replace(/\n/g, " • ") : "3 Value Points"}</span>
                </div>
                <span className="text-[9px] text-amber-400 font-mono shrink-0 ml-1">BULLETS</span>
              </div>
            </div>

            {/* Track 2: BACKGROUND Lane (Theme Gradient) */}
            <div
              className="h-14 border-b border-neutral-900 px-1 py-1.5 relative cursor-pointer group"
              onClick={() => setEditingClip("background")}
              title="Click to edit background theme"
            >
              <div
                className="h-full bg-emerald-950/70 border border-emerald-500/60 text-emerald-200 px-3 flex items-center justify-between text-[10px] font-bold group-hover:border-emerald-400 transition-colors"
                style={{ width: "100%" }}
              >
                <div className="flex items-center gap-2 truncate">
                  <Layers className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="truncate">THEME: {videoProps?.themeColor?.toUpperCase() || "EMERALD"} GRADIENT</span>
                </div>
                <span className="text-[9px] text-emerald-400 font-mono shrink-0">FULL STAGE</span>
              </div>
            </div>

            {/* Track 3: AUDIO Lane (Soundtrack Waveform) */}
            <div
              className="h-14 border-b border-neutral-900 px-1 py-1.5 relative cursor-pointer group"
              onClick={() => setEditingClip("audio")}
              title="Click to edit audio settings"
            >
              <div
                className="h-full bg-cyan-950/70 border border-cyan-500/60 text-cyan-200 px-3 flex items-center justify-between text-[10px] font-bold relative overflow-hidden group-hover:border-cyan-400 transition-colors"
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
                <div className="flex items-center gap-2 z-10 truncate">
                  <Music className="w-3 h-3 text-cyan-400 shrink-0" />
                  <span className="truncate">SOUNDTRACK: LO-FI FOCUS BEATS (128 BPM)</span>
                </div>
                <span className="text-[9px] text-cyan-400 font-mono z-10 shrink-0">
                  {!trackVisibility.audio ? "MUTED" : `${draftVolume}%`}
                </span>
              </div>
            </div>

            {/* RED PLAYHEAD SCRUBBER LINE */}
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

      {/* 3. CENTER SCREEN MANUAL CLIP EDITING MODAL (1/1 Individual Clip Editing) */}
      {editingClip && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-950 border border-neutral-700 shadow-2xl p-4 font-mono text-xs flex flex-col gap-3">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <div className="flex items-center gap-2 font-bold text-white text-[11px] uppercase tracking-wider">
                <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  {editingClip === "hook"
                    ? "EDIT HOOK HEADLINE"
                    : editingClip === "bullets"
                    ? "EDIT VALUE BULLETS"
                    : editingClip === "background"
                    ? "EDIT BACKGROUND THEME"
                    : "EDIT AUDIO TRACK"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditingClip(null)}
                className="text-neutral-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 1/1 Modal Body: Hook Headline Only */}
            {editingClip === "hook" && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-neutral-400 block mb-1 uppercase font-bold">
                    Hook Title (Main Headline)
                  </label>
                  <input
                    type="text"
                    value={draftHook}
                    onChange={(e) => setDraftHook(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-white font-mono text-xs focus:border-white focus:outline-none"
                    placeholder="Enter viral hook..."
                    autoFocus
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2 border-t border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setEditingClip(null)}
                    className="px-3 py-1.5 bg-neutral-900 border border-neutral-700 text-neutral-300 hover:text-white cursor-pointer"
                  >
                    CANCEL
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyHook}
                    className="px-4 py-1.5 bg-white text-black font-bold flex items-center gap-1.5 hover:bg-neutral-200 cursor-pointer"
                  >
                    <Check className="w-3 h-3" />
                    <span>APPLY TO STAGE</span>
                  </button>
                </div>
              </div>
            )}

            {/* 1/1 Modal Body: Body Bullets Only */}
            {editingClip === "bullets" && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-neutral-400 block mb-1 uppercase font-bold">
                    Body Bullets (3 Points, separated by newlines)
                  </label>
                  <textarea
                    rows={5}
                    value={draftBody}
                    onChange={(e) => setDraftBody(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-white font-mono text-xs focus:border-white focus:outline-none resize-none leading-relaxed"
                    placeholder="1. First point&#10;2. Second point&#10;3. Third point"
                    autoFocus
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2 border-t border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setEditingClip(null)}
                    className="px-3 py-1.5 bg-neutral-900 border border-neutral-700 text-neutral-300 hover:text-white cursor-pointer"
                  >
                    CANCEL
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyBullets}
                    className="px-4 py-1.5 bg-white text-black font-bold flex items-center gap-1.5 hover:bg-neutral-200 cursor-pointer"
                  >
                    <Check className="w-3 h-3" />
                    <span>APPLY TO STAGE</span>
                  </button>
                </div>
              </div>
            )}

            {/* 1/1 Modal Body: Background Theme Only */}
            {editingClip === "background" && (
              <div className="space-y-3">
                <label className="text-[10px] text-neutral-400 block uppercase font-bold">
                  Select Color Theme Gradient
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["emerald", "violet", "rose", "amber", "cyan"] as NexusVideoProps["themeColor"][]).map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => handleApplyBackground(col)}
                      className={`p-2.5 border text-left flex items-center justify-between uppercase font-bold transition-none cursor-pointer ${
                        draftTheme === col
                          ? "bg-neutral-800 border-white text-white"
                          : "bg-neutral-900 border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 inline-block"
                          style={{
                            backgroundColor:
                              col === "emerald"
                                ? "#10b981"
                                : col === "violet"
                                ? "#a855f7"
                                : col === "rose"
                                ? "#f43f5e"
                                : col === "amber"
                                ? "#f59e0b"
                                : "#06b6d4",
                          }}
                        />
                        <span>{col}</span>
                      </div>
                      {draftTheme === col && <Check className="w-3 h-3 text-white" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 1/1 Modal Body: Audio Settings Only */}
            {editingClip === "audio" && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-neutral-400 block mb-1 uppercase font-bold">
                    Master Soundtrack Volume ({draftVolume}%)
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={draftVolume}
                    onChange={(e) => setDraftVolume(parseInt(e.target.value, 10))}
                    className="w-full bg-neutral-800 accent-white cursor-pointer"
                  />
                </div>

                <div className="pt-2">
                  <label className="text-[10px] text-neutral-400 block mb-1 uppercase font-bold">
                    Active Audio Track
                  </label>
                  <div className="p-2.5 bg-neutral-900 border border-neutral-700 text-white font-bold flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Music className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Lo-Fi Focus Beats (128 BPM)</span>
                    </div>
                    <span className="text-[9px] text-emerald-400 font-mono">SELECTED</span>
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2 border-t border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setEditingClip(null)}
                    className="px-4 py-1.5 bg-white text-black font-bold flex items-center gap-1.5 hover:bg-neutral-200 cursor-pointer"
                  >
                    <Check className="w-3 h-3" />
                    <span>DONE</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

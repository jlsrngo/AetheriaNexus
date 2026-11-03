import React from "react";
import { Download, Video } from "lucide-react";

export type CanvasRatio = "9:16" | "16:9" | "1:1";
export type CanvasFps = 30 | 60;
export type CanvasDuration = 5 | 15 | 30 | 60;

interface StudioPlayerHeaderProps {
  ratio: CanvasRatio;
  onRatioChange: (ratio: CanvasRatio) => void;
  fps: CanvasFps;
  onFpsChange: (fps: CanvasFps) => void;
  duration: CanvasDuration;
  onDurationChange: (duration: CanvasDuration) => void;
  onRender: () => void;
  isRendering?: boolean;
  renderProgress?: number;
}

export const StudioPlayerHeader: React.FC<StudioPlayerHeaderProps> = ({
  ratio,
  onRatioChange,
  fps,
  onFpsChange,
  duration,
  onDurationChange,
  onRender,
  isRendering = false,
  renderProgress = 0,
}) => {
  const getResolutionText = () => {
    switch (ratio) {
      case "16:9":
        return "1920 × 1080 PX";
      case "1:1":
        return "1080 × 1080 PX";
      case "9:16":
      default:
        return "1080 × 1920 PX";
    }
  };

  return (
    <div className="w-full bg-neutral-950 border-b border-neutral-800 px-3 py-2 flex flex-wrap items-center justify-between gap-3 font-mono text-[11px] select-none z-20">
      {/* Left: Viewport Status & Active Resolution */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-400 inline-block animate-pulse"></span>
          <span className="text-white font-bold tracking-wider uppercase flex items-center gap-1.5 text-xs">
            <Video className="w-3.5 h-3.5 text-emerald-400" />
            LIVE STAGE
          </span>
        </div>
        <span className="text-neutral-700">|</span>
        <div className="text-[10px] text-neutral-400 font-mono tracking-wider uppercase">
          RES: <span className="text-neutral-200 font-bold">{getResolutionText()}</span>
        </div>
      </div>

      {/* Center: Controls for Ratio, FPS, Duration (Swiss Brutalist HUD) */}
      <div className="flex items-center gap-3">
        {/* Ratio Selector */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-semibold mr-1">
            RATIO:
          </span>
          <div className="inline-flex border border-neutral-800 bg-neutral-900 rounded-none overflow-hidden">
            {(["9:16", "16:9", "1:1"] as CanvasRatio[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onRatioChange(r)}
                className={`px-2.5 py-1 text-[10px] font-mono font-bold tracking-wider transition-colors border-r last:border-r-0 border-neutral-800 ${
                  ratio === r
                    ? "bg-white text-black font-extrabold"
                    : "text-neutral-400 hover:text-white hover:bg-neutral-800/80"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* FPS Selector */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-semibold mr-1">
            FPS:
          </span>
          <div className="inline-flex border border-neutral-800 bg-neutral-900 rounded-none overflow-hidden">
            {([30, 60] as CanvasFps[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => onFpsChange(f)}
                className={`px-2 py-1 text-[10px] font-mono font-bold tracking-wider transition-colors border-r last:border-r-0 border-neutral-800 ${
                  fps === f
                    ? "bg-white text-black font-extrabold"
                    : "text-neutral-400 hover:text-white hover:bg-neutral-800/80"
                }`}
              >
                {f} FPS
              </button>
            ))}
          </div>
        </div>

        {/* Duration Selector */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-semibold mr-1">
            TIME:
          </span>
          <div className="inline-flex border border-neutral-800 bg-neutral-900 rounded-none overflow-hidden">
            {([5, 15, 30, 60] as CanvasDuration[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onDurationChange(d)}
                className={`px-2 py-1 text-[10px] font-mono font-bold tracking-wider transition-colors border-r last:border-r-0 border-neutral-800 ${
                  duration === d
                    ? "bg-white text-black font-extrabold"
                    : "text-neutral-400 hover:text-white hover:bg-neutral-800/80"
                }`}
              >
                {d}S
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Render Action Button */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRender}
          disabled={isRendering}
          className="relative inline-flex items-center gap-2 px-3 py-1.5 bg-neutral-100 hover:bg-white text-neutral-950 font-bold font-mono text-[10px] tracking-wider uppercase border border-white transition-all disabled:opacity-50 disabled:cursor-not-allowed rounded-none active:translate-y-0.5 shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          {isRendering ? `RENDERING ${renderProgress}%...` : "RENDER KE STOK"}
        </button>
      </div>
    </div>
  );
};

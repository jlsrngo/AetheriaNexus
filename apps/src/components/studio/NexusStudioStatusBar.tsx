import React from "react";

interface NexusStudioStatusBarProps {
  status?: string;
  isRendering?: boolean;
  renderPercent?: number;
  activePath?: string;
}

export const NexusStudioStatusBar: React.FC<NexusStudioStatusBarProps> = ({
  status = "IDLE",
  isRendering = false,
  renderPercent = 0,
  activePath = "E:\\Videos\\NexusVault",
}) => {
  return (
    <footer className="h-6 bg-neutral-950 border-t border-neutral-800 px-3 flex items-center justify-between text-[11px] font-mono text-neutral-400 shrink-0 select-none z-20">
      {/* Left System Telemetry */}
      <div className="flex items-center gap-3 overflow-hidden">
        <span className="truncate">
          <span className="text-neutral-500 uppercase">STORAGE:</span>{" "}
          <span className="text-neutral-300">{activePath}</span>
        </span>
        <span className="text-neutral-700">|</span>
        <span className="shrink-0">
          <span className="text-neutral-500 uppercase">ENGINE:</span>{" "}
          <span className="text-emerald-400 font-bold">LOCAL GPU (NVENC/H.264) // RP 0 CLOUD</span>
        </span>
        <span className="text-neutral-700">|</span>
        <span className="shrink-0 hidden sm:inline">
          <span className="text-neutral-500 uppercase">STOCK BUFFER:</span>{" "}
          <span className="text-neutral-300">15 VIDEOS READY</span>
        </span>
      </div>

      {/* Right Engine Status */}
      <div className="flex items-center gap-2 shrink-0">
        <span
          className={`w-2 h-2 rounded-full ${
            isRendering ? "bg-amber-400 animate-ping" : "bg-emerald-400"
          }`}
        />
        <span className="text-neutral-300 font-bold uppercase tracking-wider">
          STATUS: {isRendering ? `RENDERING ${renderPercent}%` : status}
        </span>
      </div>
    </footer>
  );
};

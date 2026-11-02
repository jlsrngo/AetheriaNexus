import React from "react";
import { Search } from "lucide-react";
import { WindowControls } from "./WindowControls";

export const Header: React.FC = () => {
  return (
    <header
      data-tauri-drag-region
      className="h-9 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between px-3 shrink-0 z-50 select-none cursor-move"
    >
      {/* Left: App Logo & VS Code Style Menu */}
      <div data-tauri-drag-region className="flex items-center gap-3">
        <div data-tauri-drag-region className="flex items-center gap-2">
          <span className="w-4 h-4 bg-white text-black font-mono font-black text-[10px] flex items-center justify-center">
            ⚡
          </span>
          <span data-tauri-drag-region className="font-mono font-bold text-xs text-white tracking-wide">
            ArunakiNexus
          </span>
        </div>

        <nav data-tauri-drag-region className="hidden md:flex items-center gap-1 font-mono text-[11px] text-neutral-400 ml-2">
          {["File", "Edit", "View", "Studio", "Help"].map((item) => (
            <button
              key={item}
              type="button"
              className="px-2 py-0.5 hover:text-white hover:bg-neutral-900 text-neutral-400 transition-colors"
            >
              {item}
            </button>
          ))}
        </nav>
      </div>

      {/* Center: VS Code Command Center Title Bar */}
      <div
        data-tauri-drag-region
        className="flex-1 max-w-md mx-4 hidden sm:flex items-center justify-center"
      >
        <div
          data-tauri-drag-region
          className="w-full bg-neutral-900/70 border border-neutral-800/80 px-3 py-0.5 text-[11px] font-mono text-neutral-400 flex items-center justify-center gap-2"
        >
          <Search className="w-3 h-3 text-neutral-500 shrink-0" />
          <span data-tauri-drag-region className="truncate">
            ArunakiNexus — TikTok Video Studio
          </span>
        </div>
      </div>

      {/* Right: Window Controls */}
      <div className="flex items-center h-full">
        <WindowControls />
      </div>
    </header>
  );
};

import React from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";

export const WindowControls: React.FC = () => {
  const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

  const handleMinimize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isTauri) {
      try {
        const win = getCurrentWindow();
        await win.minimize();
      } catch (err) {
        console.warn("Minimize error:", err);
      }
    }
  };

  const handleMaximize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isTauri) {
      try {
        const win = getCurrentWindow();
        await win.toggleMaximize();
      } catch (err) {
        console.warn("Maximize error:", err);
      }
    }
  };

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isTauri) {
      try {
        const win = getCurrentWindow();
        await win.close();
      } catch (err) {
        console.warn("Close error:", err);
      }
    }
  };

  return (
    <div className="flex items-center h-full shrink-0 select-none">
      <button
        onClick={handleMinimize}
        className="w-11 h-full flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
        title="Minimize Window"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={handleMaximize}
        className="w-11 h-full flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
        title="Maximize / Restore Window"
      >
        <Square className="w-3 h-3" />
      </button>
      <button
        onClick={handleClose}
        className="w-11 h-full flex items-center justify-center text-neutral-400 hover:text-white hover:bg-rose-600 transition-colors"
        title="Close Application"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

import React, { memo, useCallback } from "react";
import { Minus, Square, X } from "lucide-react";

const invokeTauri = async (cmd: string, pluginCmd?: string): Promise<boolean> => {
  const tauri = (window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__;
  if (tauri?.invoke) {
    try {
      await tauri.invoke(cmd);
      return true;
    } catch {
      if (pluginCmd) {
        try {
          await tauri.invoke(pluginCmd);
          return true;
        } catch {}
      }
    }
  }
  return false;
};

export const WindowControls: React.FC<{ className?: string }> = memo(function WindowControls({
  className = "",
}) {
  const handleMinimize = useCallback(async () => {
    if ((window as any).aetheriaDesktop?.minimize) {
      (window as any).aetheriaDesktop.minimize();
      return;
    }
    await invokeTauri("window_minimize", "plugin:window|minimize");
  }, []);

  const handleMaximize = useCallback(async () => {
    if ((window as any).aetheriaDesktop?.maximize) {
      (window as any).aetheriaDesktop.maximize();
      return;
    }
    await invokeTauri("window_toggle_maximize", "plugin:window|toggle_maximize");
  }, []);

  const handleClose = useCallback(async () => {
    if ((window as any).aetheriaDesktop?.close) {
      (window as any).aetheriaDesktop.close();
      return;
    }
    await invokeTauri("window_close", "plugin:window|close");
  }, []);

  return (
    <div
      className={`flex items-center gap-0.5 shrink-0 ${className}`}
      data-tauri-drag-region="false"
      style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
    >
      <button
        type="button"
        onClick={handleMinimize}
        className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-800 transition-none cursor-pointer rounded-none"
        title="Minimize"
        aria-label="Minimize"
      >
        <Minus className="w-3 h-3" />
      </button>
      <button
        type="button"
        onClick={handleMaximize}
        className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-800 transition-none cursor-pointer rounded-none"
        title="Maximize / Restore"
        aria-label="Maximize"
      >
        <Square className="w-2.5 h-2.5" />
      </button>
      <button
        type="button"
        onClick={handleClose}
        className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-rose-600 transition-none cursor-pointer rounded-none"
        title="Close"
        aria-label="Close"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
});

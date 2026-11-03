import { memo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { User, Minus, Square, X } from "lucide-react";
import { ArunakiLogo } from "../common/ArunakiLogo";
import { TopMenuBar } from "./TopMenuBar";

interface AppHeaderProps {
  activeFolder: string;
  onOpenFolder: () => void;
  onCloseFolder: () => void;
}

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

export const AppHeader = memo(function AppHeader({
  activeFolder,
  onOpenFolder,
  onCloseFolder,
}: AppHeaderProps) {
  const navigate = useNavigate();

  const handleNavigateWorkstation = useCallback(() => {
    const savedFolder = localStorage.getItem("arunaki_active_folder") || "";
    const savedChatId = savedFolder
      ? localStorage.getItem(`arunaki_active_chat_id_${savedFolder}`) || ""
      : localStorage.getItem("arunaki_active_chat_id") || "";
    const params = new URLSearchParams();
    if (savedFolder) params.set("folder", savedFolder);
    if (savedChatId) params.set("chatId", savedChatId);
    const query = params.toString();
    navigate(query ? `/?${query}` : "/");
  }, [navigate]);

  const handleMinimize = useCallback(async () => {
    if ((window as any).arunakiDesktop?.minimize) {
      (window as any).arunakiDesktop.minimize();
      return;
    }
    await invokeTauri("window_minimize", "plugin:window|minimize");
  }, []);

  const handleMaximize = useCallback(async () => {
    if ((window as any).arunakiDesktop?.maximize) {
      (window as any).arunakiDesktop.maximize();
      return;
    }
    await invokeTauri("window_toggle_maximize", "plugin:window|toggle_maximize");
  }, []);

  const handleClose = useCallback(async () => {
    if ((window as any).arunakiDesktop?.close) {
      (window as any).arunakiDesktop.close();
      return;
    }
    await invokeTauri("window_close", "plugin:window|close");
  }, []);

  const handleHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[style*="no-drag"], [data-tauri-drag-region="false"], button, nav, a, input')) return;
    invokeTauri("plugin:window|start_dragging");
    (window as any).arunakiDesktop?.startDrag?.();
  }, []);

  const handleHeaderDoubleClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[style*="no-drag"], [data-tauri-drag-region="false"], button, nav, a, input')) return;
    handleMaximize();
  }, [handleMaximize]);

  return (
    <header
      data-tauri-drag-region
      onMouseDown={handleHeaderMouseDown}
      onDoubleClick={handleHeaderDoubleClick}
      className="h-10 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between px-3 shrink-0 transition-none select-none z-30 font-mono text-xs"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* Left side: Brand Logo + Remotion-style Breadcrumbs + Dropdown Menus */}
      <div className="flex items-center gap-3" data-tauri-drag-region="false">
        <div
          className="flex items-center gap-2 cursor-pointer pr-2 border-r border-neutral-800"
          onClick={handleNavigateWorkstation}
          data-tauri-drag-region="false"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <ArunakiLogo size={18} />
          <span className="font-extrabold text-[11px] tracking-wider text-white uppercase">
            ARUNAKI NEXUS
          </span>
        </div>

        {/* Dropdown Menus */}
        <div
          className="flex items-center gap-1"
          data-tauri-drag-region="false"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <TopMenuBar
            activeFolder={activeFolder}
            onOpenFolder={onOpenFolder}
            onCloseFolder={onCloseFolder}
          />
        </div>
      </div>

      {/* Right side: Settings + Technical Window Controls */}
      <div
        className="flex items-center gap-2 h-full"
        data-tauri-drag-region="false"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >

        <button
          type="button"
          onClick={() => navigate("/settings")}
          data-tauri-drag-region="false"
          className="h-7 px-2 bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700 transition-none cursor-pointer flex items-center gap-1.5 text-[10px] uppercase font-mono rounded-none"
          title="Settings"
        >
          <User className="w-3 h-3 text-neutral-400" />
          <span>SETTINGS</span>
        </button>

        {/* Seamless Technical Window Controls (90° Sharp Edge) */}
        <div
          data-tauri-drag-region="false"
          className="flex items-center h-full ml-1 border-l border-neutral-800"
        >
          <button
            type="button"
            onClick={handleMinimize}
            data-tauri-drag-region="false"
            className="w-10 h-full flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-850 transition-none cursor-pointer border-r border-neutral-800 rounded-none"
            title="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleMaximize}
            data-tauri-drag-region="false"
            className="w-10 h-full flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-850 transition-none cursor-pointer border-r border-neutral-800 rounded-none"
            title="Maximize / Restore"
          >
            <Square className="w-2.5 h-2.5" />
          </button>
          <button
            type="button"
            onClick={handleClose}
            data-tauri-drag-region="false"
            className="w-10 h-full flex items-center justify-center text-neutral-400 hover:text-white hover:bg-rose-600 transition-none cursor-pointer rounded-none"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
});

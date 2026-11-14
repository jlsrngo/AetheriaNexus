import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { toggleStoredWordWrap } from "../../../../lib/wordWrap";

interface UseAppCommandsOptions {
  onOpenFolder?: () => void;
  onCloseFolder?: () => void;
  onOpenShortcuts?: () => void;
  onOpenAbout?: () => void;
}

export function useAppCommands({
  onOpenFolder,
  onCloseFolder,
  onOpenShortcuts,
  onOpenAbout,
}: UseAppCommandsOptions = {}) {
  const navigate = useNavigate();

  const undo = useCallback(() => {
    document.execCommand("undo");
  }, []);

  const redo = useCallback(() => {
    document.execCommand("redo");
  }, []);

  const cut = useCallback(() => {
    document.execCommand("cut");
  }, []);

  const copy = useCallback(() => {
    document.execCommand("copy");
  }, []);

  const paste = useCallback(async () => {
    try {
      // Rely on native browser/WebView paste command without async navigator.clipboard.readText()
      // so WebView2 does not show a recurring "See text and images copied to the clipboard" prompt.
      document.execCommand("paste");
    } catch {
      // Ignore if native execCommand("paste") is unsupported in current context
    }
  }, []);

  const selectAll = useCallback(() => {
    document.execCommand("selectAll");
  }, []);

  const newSession = useCallback(() => {
    window.dispatchEvent(new CustomEvent("aetheria-new-chat"));
  }, []);

  const saveFile = useCallback(() => {
    window.dispatchEvent(new CustomEvent("aetheria-save-file"));
  }, []);

  const findSession = useCallback(() => {
    window.dispatchEvent(new CustomEvent("aetheria-search-session"));
  }, []);

  const quickOpenFile = useCallback(() => {
    navigate("/");
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("aetheria-quick-open-file"));
    }, 10);
  }, [navigate]);

  const workspaceSearch = useCallback(() => {
    navigate("/");
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("aetheria-workspace-search"));
    }, 10);
  }, [navigate]);

  const toggleExplorer = useCallback(() => {
    window.dispatchEvent(new CustomEvent("aetheria-toggle-explorer"));
  }, []);

  const toggleChat = useCallback(() => {
    window.dispatchEvent(new CustomEvent("aetheria-toggle-chat"));
  }, []);

  const toggleWordWrap = useCallback(() => {
    toggleStoredWordWrap();
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const resetZoom = useCallback(() => {
    const desktop = typeof window !== "undefined" ? (window as any).aetheriaDesktop : null;
    if (desktop?.resetZoom) {
      void desktop.resetZoom();
    }
  }, []);

  const backupWorkspace = useCallback(async () => {
    const desktop = typeof window !== "undefined" && (window as any).aetheriaDesktop;
    if (desktop?.backupFolder) {
      try {
        const res = await desktop.backupFolder();
        if (res?.success) {
          toast.success(`Backup created: ${res.path}`);
        } else {
          toast.error(res?.error || "Failed to create backup");
        }
      } catch (err: any) {
        toast.error(err?.message || "Backup failed");
      }
    } else {
      toast.info("Workspace backup is active in Desktop mode.");
    }
  }, []);

  const exitApp = useCallback(() => {
    const desktop = typeof window !== "undefined" ? (window as any).aetheriaDesktop : undefined;
    if (desktop?.quit) {
      desktop.quit().catch(() => window.close());
      return;
    }
    if (typeof window !== "undefined" && window.close) {
      window.close();
    }
  }, []);

  const openSettings = useCallback(() => {
    navigate("/settings");
  }, [navigate]);

  const openKnowledge = useCallback(() => {
    navigate("/knowledge");
  }, [navigate]);

  const openApp = useCallback((app: "gridcraft" | "wordcraft" | "pdfcraft" | "deckcraft") => {
    navigate("/");
    window.dispatchEvent(new CustomEvent("aetheria:open-app", { detail: { app } }));
  }, [navigate]);

  return {
    undo,
    redo,
    cut,
    copy,
    paste,
    selectAll,
    newSession,
    saveFile,
    findSession,
    quickOpenFile,
    workspaceSearch,
    toggleExplorer,
    toggleChat,
    toggleWordWrap,
    toggleFullscreen,
    resetZoom,
    backupWorkspace,
    exitApp,
    openSettings,
    openKnowledge,
    openApp,
    openFolder: onOpenFolder,
    closeFolder: onCloseFolder,
    openShortcuts: onOpenShortcuts,
    openAbout: onOpenAbout,
  };
}

export type AppCommands = ReturnType<typeof useAppCommands>;

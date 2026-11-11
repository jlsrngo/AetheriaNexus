import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { tauriPickFolder } from "../../../lib/api";
import { syncWorkspaceScaffold } from "../../../lib/desktopBridge";

export function useActiveFolderSync() {
  const navigate = useNavigate();

  const [activeFolder, setActiveFolder] = useState<string>(() => {
    return localStorage.getItem("aetheria_active_folder") || "";
  });

  useEffect(() => {
    function loadActiveFolder() {
      setActiveFolder(localStorage.getItem("aetheria_active_folder") || "");
    }

    window.addEventListener("aetheria-folder-change", loadActiveFolder);
    window.addEventListener("storage", loadActiveFolder);
    return () => {
      window.removeEventListener("aetheria-folder-change", loadActiveFolder);
      window.removeEventListener("storage", loadActiveFolder);
    };
  }, []);

  useEffect(() => {
    if (activeFolder) {
      void syncWorkspaceScaffold(activeFolder);
    }
  }, [activeFolder]);

  const handleOpenFolder = useCallback(async () => {
    try {
      const selectedPath = await tauriPickFolder();
      if (selectedPath) {
        await syncWorkspaceScaffold(selectedPath);
        localStorage.setItem("aetheria_active_folder", selectedPath);
        setActiveFolder(selectedPath);

        // Strictly isolate active chat per folder
        const folderChatId =
          localStorage.getItem(`aetheria_active_chat_id_${selectedPath}`) || "";
        if (folderChatId) {
          localStorage.setItem("aetheria_active_chat_id", folderChatId);
        } else {
          localStorage.removeItem("aetheria_active_chat_id");
        }

        window.dispatchEvent(new Event("aetheria-folder-change"));
        window.dispatchEvent(new Event("aetheria-session-change"));

        const params = new URLSearchParams();
        params.set("folder", selectedPath);
        if (folderChatId) params.set("chatId", folderChatId);
        navigate(`/?${params.toString()}`);
      }
    } catch (err) {
      console.error("[useActiveFolderSync] Open folder error:", err);
    }
  }, [navigate]);

  const handleCloseFolder = useCallback(() => {
    localStorage.removeItem("aetheria_active_folder");
    localStorage.removeItem("aetheria_active_chat_id");
    setActiveFolder("");
    window.dispatchEvent(new Event("aetheria-folder-change"));
    window.dispatchEvent(new Event("aetheria-session-change"));
    navigate("/");
    toast.info("Folder closed. Agent is now in sandbox mode.");
  }, [navigate]);

  return {
    activeFolder,
    setActiveFolder,
    handleOpenFolder,
    handleCloseFolder,
  };
}

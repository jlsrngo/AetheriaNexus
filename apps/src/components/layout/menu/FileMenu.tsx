import { memo } from "react";
import {
  Film,
  FolderOpen,
  Upload,
  Video,
  Save,
  FolderX,
  Settings,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../../../lib/utils";
import { useI18n } from "../../../lib/i18n";
import { BaseMenuProps } from "./types";
import { getEffectiveShortcut } from "./shortcutsConfig";
import { menuAutoFocus, menuKeyDown, menuTriggerProps } from "./menuA11y";
import { MenuItem } from "./items/MenuItem";
import { MenuSeparator } from "./items/MenuSeparator";
import { AppCommands } from "./hooks/useAppCommands";
import { useStudioStore } from "../../../hooks/useStudioStore";
import { apiFetch, API_BASE } from "../../../lib/api";

interface FileMenuProps extends BaseMenuProps {
  activeFolder: string;
  commands: AppCommands;
}

export const FileMenu = memo(function FileMenu({
  isOpen,
  onToggle,
  onMouseEnter,
  onClose,
  activeFolder,
  commands,
}: FileMenuProps) {
  const { t } = useI18n();
  const { activeComposition, actions } = useStudioStore();

  const handleSaveProps = async () => {
    try {
      await apiFetch(`${API_BASE}/save-default-props`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          compositionId: activeComposition.id,
          props: activeComposition.props,
        }),
      });
    } catch {}
    toast.success(`Saved defaultProps for "${activeComposition.name}"`);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        onMouseEnter={onMouseEnter}
        {...menuTriggerProps(isOpen)}
        className={cn(
          "text-[var(--text-muted)] hover:text-[var(--text-primary)] text-[13px] font-medium px-3 py-1.5 rounded-md transition-colors cursor-pointer",
          isOpen && "bg-[var(--bg-hover)] text-[var(--text-primary)]"
        )}
      >
        {t("file", "File")}
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label={t("file", "File")}
          onKeyDown={menuKeyDown}
          ref={menuAutoFocus}
          className="absolute top-full left-0 mt-1 min-w-[255px] max-w-[300px] bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl py-1.5 z-50 max-h-[70vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 duration-100"
        >
          <MenuItem
            icon={Film}
            label="New Video Composition"
            shortcut={getEffectiveShortcut("new-session") || "Ctrl+N"}
            onClick={() => {
              const created = actions.createComposition({
                name: `Scene-${Date.now().toString().slice(-3)}`,
                ratio: "9:16",
              });
              window.dispatchEvent(
                new CustomEvent("arunaki-open-sidebar-view", { detail: "compositions" })
              );
              toast.success(`Created composition "${created.name}"`);
              onClose();
            }}
          />

          <MenuItem
            icon={FolderOpen}
            label={t("openFolder", "Open Project Folder...")}
            shortcut={getEffectiveShortcut("open-folder") || "Ctrl+O"}
            onClick={() => {
              onClose();
              commands.openFolder?.();
            }}
          />

          <MenuItem
            icon={Upload}
            label="Manage Media Assets (public/)"
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("arunaki-open-sidebar-view", { detail: "explorer" })
              );
              onClose();
            }}
          />

          <MenuItem
            icon={Save}
            label="Save Default Props"
            shortcut={getEffectiveShortcut("save-file") || "Ctrl+S"}
            onClick={() => {
              void handleSaveProps();
              onClose();
            }}
          />

          <MenuItem
            icon={Video}
            label="Render / Export MP4..."
            shortcut="Ctrl+E"
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("arunaki-open-sidebar-view", { detail: "renders" })
              );
              onClose();
            }}
          />

          <MenuSeparator />

          <MenuItem
            icon={FolderX}
            label={t("closeFolder", "Close Project Folder")}
            disabled={!activeFolder}
            onClick={() => {
              onClose();
              commands.closeFolder?.();
            }}
          />

          <MenuSeparator />

          <MenuItem
            icon={Settings}
            label={t("preferencesSettings", "Preferences & Settings...")}
            shortcut={getEffectiveShortcut("settings") || "Ctrl+,"}
            onClick={() => {
              onClose();
              commands.openSettings();
            }}
          />

          <MenuItem
            icon={LogOut}
            label={t("exitWindow", "Exit Arunaki")}
            className="text-rose-400 hover:text-white hover:bg-rose-600"
            onClick={() => {
              onClose();
              commands.exitApp();
            }}
          />
        </div>
      )}
    </div>
  );
});

import { memo } from "react";
import {
  Film,
  FolderOpen,
  Video,
  Save,
  FolderX,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { useI18n } from "../../../lib/i18n";
import { BaseMenuProps } from "./types";
import { getEffectiveShortcut } from "./shortcutsConfig";
import { menuAutoFocus, menuKeyDown, menuTriggerProps } from "./menuA11y";
import { MenuItem } from "./items/MenuItem";
import { MenuSeparator } from "./items/MenuSeparator";
import { AppCommands } from "./hooks/useAppCommands";

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

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        onMouseEnter={onMouseEnter}
        {...menuTriggerProps(isOpen)}
        className={cn(
          "text-neutral-400 hover:text-white hover:bg-neutral-900 text-xs font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-none border border-transparent hover:border-neutral-800 transition-none cursor-pointer",
          isOpen && "bg-neutral-900 text-white border-neutral-700"
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
          className="absolute top-full left-0 mt-1 min-w-[260px] bg-neutral-950 border border-neutral-800 rounded-none py-1 z-50 shadow-2xl font-mono text-xs animate-in fade-in zoom-in-95 duration-100"
        >
          <MenuItem
            icon={Film}
            label="New Video Composition"
            shortcut={getEffectiveShortcut("new-session") || "Ctrl+N"}
            onClick={() => {
              commands.newSession();
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
            icon={Video}
            label="Render / Export MP4"
            shortcut="Ctrl+E"
            onClick={() => {
              onClose();
              window.dispatchEvent(new CustomEvent("arunaki-trigger-render"));
            }}
          />

          <MenuItem
            icon={Save}
            label="Save Composition Draft"
            shortcut={getEffectiveShortcut("save-file") || "Ctrl+S"}
            onClick={() => {
              commands.saveFile();
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
            label={t("preferencesSettings", "Preferences / Settings")}
            shortcut={getEffectiveShortcut("settings") || "Ctrl+,"}
            onClick={() => {
              onClose();
              commands.openSettings();
            }}
          />

          <MenuItem
            icon={LogOut}
            label={t("exitWindow", "Exit Window")}
            className="text-rose-400 hover:text-white hover:bg-rose-900/60 hover:border-l-rose-500"
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

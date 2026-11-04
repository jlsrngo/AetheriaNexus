import { memo } from "react";
import {
  SlidersHorizontal,
  FolderKanban,
  Bot,
  Maximize,
  RotateCcw,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { useI18n } from "../../../lib/i18n";
import { BaseMenuProps } from "./types";
import { menuAutoFocus, menuKeyDown, menuTriggerProps } from "./menuA11y";
import { MenuItem } from "./items/MenuItem";
import { MenuSeparator } from "./items/MenuSeparator";
import { AppCommands } from "./hooks/useAppCommands";

interface ViewMenuProps extends BaseMenuProps {
  commands: AppCommands;
}

export const ViewMenu = memo(function ViewMenu({
  isOpen,
  onToggle,
  onMouseEnter,
  onClose,
  commands,
}: ViewMenuProps) {
  const { t } = useI18n();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        onMouseEnter={onMouseEnter}
        {...menuTriggerProps(isOpen)}
        className={cn(
          "text-neutral-300 hover:text-white hover:bg-neutral-800/80 text-xs font-mono font-medium px-2 py-1 transition-none cursor-pointer",
          isOpen && "bg-neutral-800 text-white"
        )}
      >
        {t("view", "View")}
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label={t("view", "View")}
          onKeyDown={menuKeyDown}
          ref={menuAutoFocus}
          className="absolute top-full left-0 mt-1 min-w-[260px] bg-neutral-950 border border-neutral-800 rounded-none py-1 z-50 shadow-2xl font-mono text-xs animate-in fade-in zoom-in-95 duration-100"
        >
          <MenuItem
            icon={SlidersHorizontal}
            label="Toggle Timeline (Open / Collapse)"
            shortcut="Ctrl+T"
            onClick={() => {
              onClose();
              window.dispatchEvent(new CustomEvent("arunaki-toggle-timeline"));
            }}
          />

          <MenuItem
            icon={FolderKanban}
            label="Toggle Project Assets Sidebar"
            shortcut="Ctrl+B"
            onClick={() => {
              onClose();
              commands.toggleExplorer();
            }}
          />

          <MenuItem
            icon={Bot}
            label="Toggle Creative Script Assistant"
            shortcut="Ctrl+J"
            onClick={() => {
              onClose();
              commands.toggleChat();
            }}
          />

          <MenuSeparator />

          <MenuItem
            icon={RotateCcw}
            label="Reset Video Preview Zoom"
            onClick={() => {
              onClose();
              window.dispatchEvent(new CustomEvent("arunaki-reset-zoom"));
            }}
          />

          <MenuItem
            icon={Maximize}
            label="Toggle Fullscreen"
            shortcut="F11"
            onClick={() => {
              onClose();
              commands.toggleFullscreen();
            }}
          />
        </div>
      )}
    </div>
  );
});

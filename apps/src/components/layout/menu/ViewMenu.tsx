import { memo } from "react";
import {
  SlidersHorizontal,
  FolderKanban,
  Bot,
  Maximize,
  ZoomIn,
  ShieldAlert,
  Grid,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { useI18n } from "../../../lib/i18n";
import { BaseMenuProps } from "./types";
import { menuAutoFocus, menuKeyDown, menuTriggerProps } from "./menuA11y";
import { MenuItem } from "./items/MenuItem";
import { MenuSeparator } from "./items/MenuSeparator";
import { AppCommands } from "./hooks/useAppCommands";
import { useStudioStore } from "../../../hooks/useStudioStore";

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
  const { canvas, actions } = useStudioStore();

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
        {t("view", "View")}
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label={t("view", "View")}
          onKeyDown={menuKeyDown}
          ref={menuAutoFocus}
          className="absolute top-full left-0 mt-1 min-w-[260px] max-w-[310px] bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl py-1.5 z-50 max-h-[70vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 duration-100"
        >
          <MenuItem
            icon={ZoomIn}
            label={`Canvas Zoom: Fit (${canvas.zoom === "fit" ? "Active" : "Set"})`}
            onClick={() => {
              actions.updateCanvas({ zoom: "fit" });
              onClose();
            }}
          />

          <MenuItem
            icon={ZoomIn}
            label={`Canvas Zoom: 100% (${canvas.zoom === 1 ? "Active" : "1:1"})`}
            onClick={() => {
              actions.updateCanvas({ zoom: 1 });
              onClose();
            }}
          />

          <MenuItem
            icon={ShieldAlert}
            label={`${canvas.showGuides ? "Hide" : "Show"} TikTok Safe Zone Guides`}
            onClick={() => {
              actions.updateCanvas({ showGuides: !canvas.showGuides });
              onClose();
            }}
          />

          <MenuItem
            icon={Grid}
            label={`${canvas.showCheckerboard ? "Hide" : "Show"} Transparency Checkerboard`}
            onClick={() => {
              actions.updateCanvas({ showCheckerboard: !canvas.showCheckerboard });
              onClose();
            }}
          />

          <MenuSeparator />

          <MenuItem
            icon={SlidersHorizontal}
            label={`${canvas.showTimeline ? "Hide" : "Show"} Sequence Timeline`}
            shortcut="Ctrl+T"
            onClick={() => {
              actions.updateCanvas({ showTimeline: !canvas.showTimeline });
              onClose();
            }}
          />

          <MenuItem
            icon={FolderKanban}
            label="Toggle Left Studio Sidebar"
            shortcut="Ctrl+B"
            onClick={() => {
              onClose();
              commands.toggleExplorer();
            }}
          />

          <MenuItem
            icon={Bot}
            label="Toggle AI Creative Director"
            shortcut="Ctrl+J"
            onClick={() => {
              onClose();
              commands.toggleChat();
            }}
          />

          <MenuSeparator />

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

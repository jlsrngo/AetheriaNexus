import { memo } from "react";
import {
  BookOpen,
  Keyboard,
  Cpu,
  Info,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { useI18n } from "../../../lib/i18n";
import { BaseMenuProps } from "./types";
import { getEffectiveShortcut } from "./shortcutsConfig";
import { menuAutoFocus, menuKeyDown, menuTriggerProps } from "./menuA11y";
import { MenuItem } from "./items/MenuItem";
import { MenuSeparator } from "./items/MenuSeparator";
import { AppCommands } from "./hooks/useAppCommands";

interface HelpMenuProps extends BaseMenuProps {
  commands: AppCommands;
}

export const HelpMenu = memo(function HelpMenu({
  isOpen,
  onToggle,
  onMouseEnter,
  onClose,
  commands,
}: HelpMenuProps) {
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
        {t("help", "Help")}
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label={t("help", "Help")}
          onKeyDown={menuKeyDown}
          ref={menuAutoFocus}
          className="absolute top-full left-0 mt-1 min-w-[260px] bg-neutral-950 border border-neutral-800 rounded-none py-1 z-50 shadow-2xl font-mono text-xs animate-in fade-in zoom-in-95 duration-100"
        >
          <MenuItem
            icon={BookOpen}
            label="Nexus Documentation"
            onClick={() => {
              onClose();
              window.open("https://github.com/juliosiringo/arunaki", "_blank");
            }}
          />

          <MenuItem
            icon={Keyboard}
            label={t("keyboardShortcuts", "Keyboard Shortcuts")}
            shortcut={getEffectiveShortcut("keyboard-shortcuts") || "Ctrl+/"}
            onClick={() => {
              onClose();
              commands.openShortcuts?.();
            }}
          />

          <MenuItem
            icon={Cpu}
            label="System Telemetry & Engine Status"
            onClick={() => {
              onClose();
              commands.openSettings();
            }}
          />

          <MenuSeparator />

          <MenuItem
            icon={Info}
            label={t("aboutArunaki", "About Nexus")}
            onClick={() => {
              onClose();
              commands.openAbout?.();
            }}
          />
        </div>
      )}
    </div>
  );
});

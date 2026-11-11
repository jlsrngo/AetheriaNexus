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
          "text-[var(--text-muted)] hover:text-[var(--text-primary)] text-[13px] font-medium px-3 py-1.5 rounded-md transition-colors cursor-pointer",
          isOpen && "bg-[var(--bg-hover)] text-[var(--text-primary)]"
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
          className="absolute top-full left-0 mt-1 min-w-[250px] max-w-[300px] bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl py-1.5 z-50 max-h-[70vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 duration-100"
        >
          <MenuItem
            icon={BookOpen}
            label="Aetheria HTML Motion Studio Docs"
            onClick={() => {
              onClose();
              window.dispatchEvent(
                new CustomEvent("aetheria-open-sidebar-view", { detail: "help" })
              );
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
            label="GPU & Render Engine Telemetry"
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("aetheria-open-sidebar-view", { detail: "renders" })
              );
              onClose();
            }}
          />

          <MenuSeparator />

          <MenuItem
            icon={Info}
            label={t("aboutAetheria", "About Aetheria")}
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

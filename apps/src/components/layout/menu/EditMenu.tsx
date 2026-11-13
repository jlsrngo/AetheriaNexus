import { memo } from "react";
import {
  Undo2,
  Redo2,
  SlidersHorizontal,
  Captions,
  Palette,
  Copy,
  RotateCcw,
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
import type { NexusVideoProps } from "../../../types/video";

interface EditMenuProps extends BaseMenuProps {
  commands: AppCommands;
}

const THEME_ORDER: Array<NexusVideoProps["themeColor"]> = [
  "orange",
  "indigo",
  "violet",
  "rose",
  "amber",
  "cyan",
];

export const EditMenu = memo(function EditMenu({
  isOpen,
  onToggle,
  onMouseEnter,
  onClose,
}: EditMenuProps) {
  const { t } = useI18n();
  const { activeComposition, undoStack, redoStack, actions } = useStudioStore();

  const handleCycleTheme = () => {
    const idx = THEME_ORDER.indexOf(activeComposition.props.themeColor);
    const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
    actions.updateActiveProps({ themeColor: next });
    toast.success(`Switched theme accent to ${next}`);
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
        {t("edit", "Edit")}
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label={t("edit", "Edit")}
          onKeyDown={menuKeyDown}
          ref={menuAutoFocus}
          className="absolute top-full left-0 mt-1 min-w-[255px] max-w-[300px] bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl py-1.5 z-50 max-h-[70vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 duration-100"
        >
          <MenuItem
            icon={Undo2}
            label="Undo Prop Change"
            shortcut={getEffectiveShortcut("undo") || "Ctrl+Z"}
            disabled={undoStack.length === 0}
            onClick={() => {
              actions.undoProps();
              onClose();
            }}
          />

          <MenuItem
            icon={Redo2}
            label="Redo Prop Change"
            shortcut={getEffectiveShortcut("redo") || "Ctrl+Y"}
            disabled={redoStack.length === 0}
            onClick={() => {
              actions.redoProps();
              onClose();
            }}
          />

          <MenuSeparator />

          <MenuItem
            icon={SlidersHorizontal}
            label="Edit Default Props (Inspector)"
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("aetheria-open-sidebar-view", { detail: "inspector" })
              );
              onClose();
            }}
          />

          <MenuItem
            icon={Captions}
            label="Elements & Auto-Captions"
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("aetheria-open-sidebar-view", { detail: "elements" })
              );
              onClose();
            }}
          />

          <MenuItem
            icon={Palette}
            label={`Cycle Theme Accent (${activeComposition.props.themeColor})`}
            onClick={() => {
              handleCycleTheme();
              onClose();
            }}
          />

          <MenuSeparator />

          <MenuItem
            icon={Copy}
            label="Copy Default Props JSON"
            shortcut="Ctrl+Shift+C"
            onClick={() => {
              void navigator.clipboard?.writeText(
                JSON.stringify(activeComposition.props, null, 2)
              );
              toast.success("Copied defaultProps JSON to clipboard");
              onClose();
            }}
          />

          <MenuItem
            icon={RotateCcw}
            label="Reset Props to Default"
            onClick={() => {
              actions.resetActiveProps();
              toast.info("Reset composition props to defaults");
              onClose();
            }}
          />
        </div>
      )}
    </div>
  );
});

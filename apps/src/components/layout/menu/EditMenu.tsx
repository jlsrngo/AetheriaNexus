import { memo } from "react";
import {
  Undo2,
  Redo2,
  Type,
  ListOrdered,
  Palette,
  Volume2,
  Scissors,
  Copy,
  Clipboard,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { useI18n } from "../../../lib/i18n";
import { BaseMenuProps } from "./types";
import { getEffectiveShortcut } from "./shortcutsConfig";
import { menuAutoFocus, menuKeyDown, menuTriggerProps } from "./menuA11y";
import { MenuItem } from "./items/MenuItem";
import { MenuSeparator } from "./items/MenuSeparator";
import { AppCommands } from "./hooks/useAppCommands";

interface EditMenuProps extends BaseMenuProps {
  commands: AppCommands;
}

export const EditMenu = memo(function EditMenu({
  isOpen,
  onToggle,
  onMouseEnter,
  onClose,
  commands,
}: EditMenuProps) {
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
        {t("edit", "Edit")}
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label={t("edit", "Edit")}
          onKeyDown={menuKeyDown}
          ref={menuAutoFocus}
          className="absolute top-full left-0 mt-1 min-w-[260px] bg-neutral-950 border border-neutral-800 rounded-none py-1 z-50 shadow-2xl font-mono text-xs animate-in fade-in zoom-in-95 duration-100"
        >
          <MenuItem
            icon={Undo2}
            label={t("undo", "Undo")}
            shortcut={getEffectiveShortcut("undo") || "Ctrl+Z"}
            onClick={() => {
              commands.undo();
              onClose();
            }}
          />

          <MenuItem
            icon={Redo2}
            label={t("redo", "Redo")}
            shortcut={getEffectiveShortcut("redo") || "Ctrl+Y"}
            onClick={() => {
              commands.redo();
              onClose();
            }}
          />

          <MenuSeparator />

          <MenuItem
            icon={Type}
            label="Edit Hook Title"
            onClick={() => {
              onClose();
              window.dispatchEvent(new CustomEvent("arunaki-edit-track", { detail: "hook" }));
            }}
          />

          <MenuItem
            icon={ListOrdered}
            label="Edit Body Bullets"
            onClick={() => {
              onClose();
              window.dispatchEvent(new CustomEvent("arunaki-edit-track", { detail: "bullets" }));
            }}
          />

          <MenuItem
            icon={Palette}
            label="Select Color Theme"
            onClick={() => {
              onClose();
              window.dispatchEvent(new CustomEvent("arunaki-edit-track", { detail: "background" }));
            }}
          />

          <MenuItem
            icon={Volume2}
            label="Soundtrack & Audio"
            onClick={() => {
              onClose();
              window.dispatchEvent(new CustomEvent("arunaki-edit-track", { detail: "audio" }));
            }}
          />

          <MenuSeparator />

          <MenuItem
            icon={Scissors}
            label={t("cut", "Cut")}
            shortcut="Ctrl+X"
            onClick={() => {
              commands.cut();
              onClose();
            }}
          />

          <MenuItem
            icon={Copy}
            label={t("copy", "Copy")}
            shortcut="Ctrl+C"
            onClick={() => {
              commands.copy();
              onClose();
            }}
          />

          <MenuItem
            icon={Clipboard}
            label={t("paste", "Paste")}
            shortcut="Ctrl+V"
            onClick={() => {
              void commands.paste();
              onClose();
            }}
          />
        </div>
      )}
    </div>
  );
});

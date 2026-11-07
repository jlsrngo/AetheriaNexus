import { memo } from "react";
import {
  Clapperboard,
  CopyPlus,
  Smartphone,
  Square,
  Monitor,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../../../lib/utils";
import { BaseMenuProps } from "./types";
import { menuAutoFocus, menuKeyDown, menuTriggerProps } from "./menuA11y";
import { MenuItem } from "./items/MenuItem";
import { MenuSeparator } from "./items/MenuSeparator";
import { useStudioStore } from "../../../hooks/useStudioStore";

export const CompositionMenu = memo(function CompositionMenu({
  isOpen,
  onToggle,
  onMouseEnter,
  onClose,
}: BaseMenuProps) {
  const { activeComposition, currentFrame, actions } = useStudioStore();

  const setRatio = (ratio: "9:16" | "1:1" | "16:9") => {
    const dims =
      ratio === "1:1"
        ? { width: 1080, height: 1080 }
        : ratio === "16:9"
        ? { width: 1920, height: 1080 }
        : { width: 1080, height: 1920 };
    actions.updateActiveMetadata({ ratio, ...dims });
    toast.success(`Switched "${activeComposition.name}" to ${ratio} (${dims.width}×${dims.height})`);
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
        Composition
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Composition"
          onKeyDown={menuKeyDown}
          ref={menuAutoFocus}
          className="absolute top-full left-0 mt-1 min-w-[265px] max-w-[310px] bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl py-1.5 z-50 max-h-[70vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 duration-100"
        >
          <MenuItem
            icon={Clapperboard}
            label="Render Video (MP4 / WebM)..."
            shortcut="Ctrl+E"
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("aetheria-open-sidebar-view", { detail: "renders" })
              );
              onClose();
            }}
          />

          <MenuItem
            icon={CopyPlus}
            label="Duplicate Active Composition"
            shortcut="Ctrl+D"
            onClick={() => {
              const dup = actions.duplicateComposition();
              if (dup) toast.success(`Duplicated as "${dup.name}"`);
              onClose();
            }}
          />

          <MenuSeparator />

          <MenuItem
            icon={Smartphone}
            label={`Ratio 9:16 Vertical (1080×1920)${activeComposition.ratio === "9:16" ? " ✓" : ""}`}
            onClick={() => {
              setRatio("9:16");
              onClose();
            }}
          />

          <MenuItem
            icon={Square}
            label={`Ratio 1:1 Square (1080×1080)${activeComposition.ratio === "1:1" ? " ✓" : ""}`}
            onClick={() => {
              setRatio("1:1");
              onClose();
            }}
          />

          <MenuItem
            icon={Monitor}
            label={`Ratio 16:9 Landscape (1920×1080)${activeComposition.ratio === "16:9" ? " ✓" : ""}`}
            onClick={() => {
              setRatio("16:9");
              onClose();
            }}
          />

          <MenuSeparator />

          <MenuItem
            icon={RotateCcw}
            label={`Set In Point at Frame ${currentFrame}`}
            shortcut="I"
            onClick={() => {
              actions.updateCanvas({ inFrame: currentFrame });
              toast.info(`Set In point at frame ${currentFrame}`);
              onClose();
            }}
          />

          <MenuItem
            icon={RotateCcw}
            label={`Set Out Point at Frame ${currentFrame}`}
            shortcut="O"
            onClick={() => {
              actions.updateCanvas({ outFrame: currentFrame });
              toast.info(`Set Out point at frame ${currentFrame}`);
              onClose();
            }}
          />

          <MenuItem
            icon={RotateCcw}
            label="Clear In / Out Trim Points"
            onClick={() => {
              actions.updateCanvas({ inFrame: null, outFrame: null });
              onClose();
            }}
          />
        </div>
      )}
    </div>
  );
});

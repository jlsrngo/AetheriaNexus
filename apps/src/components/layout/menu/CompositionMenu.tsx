import { memo } from "react";
import {
  Film,
  MonitorPlay,
  RotateCcw,
  Video,
  Smartphone,
  Square,
  Tv,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { BaseMenuProps } from "./types";
import { menuAutoFocus, menuKeyDown, menuTriggerProps } from "./menuA11y";
import { MenuItem } from "./items/MenuItem";
import { MenuSeparator } from "./items/MenuSeparator";

export const CompositionMenu = memo(function CompositionMenu({
  isOpen,
  onToggle,
  onMouseEnter,
  onClose,
}: BaseMenuProps) {
  const handleSelectComp = (id: string, ratio: "9:16" | "1:1" | "16:9") => {
    window.dispatchEvent(new CustomEvent("nexus-select-composition", { detail: { id, ratio } }));
    onClose();
  };

  const handleSetRatio = (ratio: "9:16" | "1:1" | "16:9") => {
    window.dispatchEvent(new CustomEvent("nexus-set-ratio", { detail: { ratio } }));
    onClose();
  };

  const handleResetProps = () => {
    window.dispatchEvent(new CustomEvent("nexus-reset-props"));
    onClose();
  };

  const handleTriggerRender = () => {
    window.dispatchEvent(new CustomEvent("arunaki-trigger-render"));
    onClose();
  };

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
        Composition
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Composition"
          onKeyDown={menuKeyDown}
          ref={menuAutoFocus}
          className="absolute top-full left-0 mt-1 min-w-[270px] bg-neutral-950 border border-neutral-800 rounded-none py-1 z-50 shadow-2xl font-mono text-xs animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Active Composition Selectors */}
          <div className="px-3 py-1 text-[10px] text-neutral-500 font-bold uppercase tracking-wider">
            Available Compositions
          </div>
          <MenuItem
            icon={Film}
            label="NexusEditorialVideo (9:16 TikTok)"
            onClick={() => handleSelectComp("NexusEditorialVideo", "9:16")}
          />
          <MenuItem
            icon={MonitorPlay}
            label="TikTokVideo (1080x1920 30FPS)"
            onClick={() => handleSelectComp("TikTokVideo", "9:16")}
          />
          <MenuItem
            icon={Film}
            label="NexusCorporate (16:9 Landscape)"
            onClick={() => handleSelectComp("NexusCorporate", "16:9")}
          />

          <MenuSeparator />

          {/* Canvas Aspect Ratios */}
          <div className="px-3 py-1 text-[10px] text-neutral-500 font-bold uppercase tracking-wider">
            Aspect Ratio
          </div>
          <MenuItem
            icon={Smartphone}
            label="9:16 Vertical (TikTok / Reels / Shorts)"
            onClick={() => handleSetRatio("9:16")}
          />
          <MenuItem
            icon={Square}
            label="1:1 Square (Instagram Feed / Carousel)"
            onClick={() => handleSetRatio("1:1")}
          />
          <MenuItem
            icon={Tv}
            label="16:9 Landscape (YouTube / Desktop)"
            onClick={() => handleSetRatio("16:9")}
          />

          <MenuSeparator />

          <MenuItem
            icon={RotateCcw}
            label="Reset Composition Props"
            shortcut="Ctrl+R"
            onClick={handleResetProps}
          />
          <MenuItem
            icon={Video}
            label="Render / Export MP4..."
            shortcut="Ctrl+E"
            onClick={handleTriggerRender}
          />
        </div>
      )}
    </div>
  );
});

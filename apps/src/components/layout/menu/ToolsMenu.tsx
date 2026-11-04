import { memo } from "react";
import {
  Sparkles,
  Subtitles,
  Database,
  Cpu,
  Calendar,
  ExternalLink,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { BaseMenuProps } from "./types";
import { menuAutoFocus, menuKeyDown, menuTriggerProps } from "./menuA11y";
import { MenuItem } from "./items/MenuItem";
import { MenuSeparator } from "./items/MenuSeparator";

export const ToolsMenu = memo(function ToolsMenu({
  isOpen,
  onToggle,
  onMouseEnter,
  onClose,
}: BaseMenuProps) {
  const handleOpenTool = (toolName: string) => {
    window.dispatchEvent(new CustomEvent("nexus-open-tool", { detail: { tool: toolName } }));
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
          "text-neutral-300 hover:text-white hover:bg-neutral-800/80 text-xs font-mono font-medium px-2 py-1 transition-none cursor-pointer",
          isOpen && "bg-neutral-800 text-white"
        )}
      >
        Tools
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Tools"
          onKeyDown={menuKeyDown}
          ref={menuAutoFocus}
          className="absolute top-full left-0 mt-1 min-w-[280px] bg-neutral-950 border border-neutral-800 rounded-none py-1 z-50 shadow-2xl font-mono text-xs animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-3 py-1 text-[10px] text-neutral-500 font-bold uppercase tracking-wider">
            Heavy Rust Studio Engines
          </div>
          <MenuItem
            icon={Subtitles}
            label="Whisper AI Subtitle Generator"
            onClick={() => handleOpenTool("subtitles")}
          />
          <MenuItem
            icon={Database}
            label="Media Vault Scanner (Local Disk)"
            onClick={() => handleOpenTool("vault")}
          />
          <MenuItem
            icon={Cpu}
            label="GPU Hardware Telemetry"
            onClick={() => handleOpenTool("gpu")}
          />
          <MenuItem
            icon={Sparkles}
            label="AI Script & Hook Engine"
            shortcut="Ctrl+J"
            onClick={() => handleOpenTool("ai-script")}
          />
          <MenuItem
            icon={Calendar}
            label="Auto-Posting Scheduler Daemon"
            onClick={() => handleOpenTool("scheduler")}
          />

          <MenuSeparator />

          <MenuItem
            icon={ExternalLink}
            label="Open Remotion Dev Studio (:3333)"
            onClick={() => {
              window.open("http://localhost:3333", "_blank");
              onClose();
            }}
          />
        </div>
      )}
    </div>
  );
});


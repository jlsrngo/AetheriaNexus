import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { Film, Folder, Settings } from "lucide-react";
import { cn } from "../../../lib/utils";

export type SidebarView = "assets";

interface WorkstationActivityBarProps {
  activeView: SidebarView | string;
  isCollapsed: boolean;
  onSelectView: (view: SidebarView) => void;
  activeFolderName?: string;
  onOpenFolder?: () => void;
}

export const WorkstationActivityBar = memo(function WorkstationActivityBar({
  isCollapsed,
  onSelectView,
  activeFolderName,
  onOpenFolder,
}: WorkstationActivityBarProps) {
  const navigate = useNavigate();

  return (
    <aside
      className="w-12 h-full bg-neutral-950 border-r border-neutral-800 flex flex-col justify-between shrink-0 select-none z-10"
      aria-label="Activity Bar"
    >
      {/* Top Navigation: Unified Video Assets & Compositions */}
      <div className="flex flex-col items-center py-2 gap-1.5 w-full">
        <button
          type="button"
          onClick={() => onSelectView("assets")}
          className={cn(
            "w-9 h-9 rounded-none flex items-center justify-center transition-none cursor-pointer relative border",
            !isCollapsed
              ? "bg-white text-black border-white"
              : "bg-neutral-900/60 text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-600"
          )}
          title="PROJECT ASSETS & COMPOSITIONS (Ctrl+B)"
          aria-label="Project Assets & Compositions"
        >
          <Film className="w-4 h-4 stroke-[1.8]" />
        </button>
      </div>

      {/* Bottom Actions: Active Folder & System Settings */}
      <div className="flex flex-col items-center py-2 gap-1.5 w-full border-t border-neutral-900">
        {activeFolderName && (
          <button
            type="button"
            onClick={onOpenFolder}
            className="w-9 h-9 rounded-none flex items-center justify-center text-emerald-400 hover:text-white bg-neutral-900/60 border border-neutral-800 hover:border-neutral-600 transition-none cursor-pointer"
            title={`Active Folder: ${activeFolderName}`}
            aria-label="Active Folder"
          >
            <Folder className="w-4 h-4 text-emerald-400 stroke-[1.8]" />
          </button>
        )}

        <button
          type="button"
          onClick={() => navigate("/settings")}
          className="w-9 h-9 rounded-none flex items-center justify-center text-neutral-400 hover:text-white bg-neutral-900/60 border border-neutral-800 hover:border-neutral-600 transition-none cursor-pointer"
          title="SETTINGS // SYSTEM & AI"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4 stroke-[1.8]" />
        </button>
      </div>
    </aside>
  );
});

import { memo } from "react";
import { Files, Film, Search, Folder } from "lucide-react";
import { cn } from "../../../lib/utils";

export type SidebarView = "explorer" | "compositions" | "search";

interface WorkstationActivityBarProps {
  activeView: SidebarView;
  isCollapsed: boolean;
  onSelectView: (view: SidebarView) => void;
  activeFolderName?: string;
  onOpenFolder?: () => void;
}

export const WorkstationActivityBar = memo(function WorkstationActivityBar({
  activeView,
  isCollapsed,
  onSelectView,
  activeFolderName,
  onOpenFolder,
}: WorkstationActivityBarProps) {
  const isTabActive = (view: SidebarView) => !isCollapsed && activeView === view;

  return (
    <aside
      className="w-12 h-full bg-neutral-950 border-r border-neutral-800 flex flex-col justify-between shrink-0 select-none z-10"
      aria-label="Activity Bar"
    >
      {/* Top Navigation Icons */}
      <div className="flex flex-col items-center py-2 gap-1.5 w-full">
        {/* Workspace Explorer Files Button */}
        <button
          type="button"
          onClick={() => onSelectView("explorer")}
          className={cn(
            "w-9 h-9 rounded-none flex items-center justify-center transition-none cursor-pointer relative border",
            isTabActive("explorer")
              ? "bg-white text-black border-white"
              : "bg-neutral-900/60 text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-600"
          )}
          title="EXPLORER // FILES & DRAFTS"
          aria-label="Explorer"
        >
          <Files className="w-4 h-4 stroke-[1.8]" />
        </button>

        {/* Video Compositions & Assets Button */}
        <button
          type="button"
          onClick={() => onSelectView("compositions")}
          className={cn(
            "w-9 h-9 rounded-none flex items-center justify-center transition-none cursor-pointer relative border",
            isTabActive("compositions")
              ? "bg-white text-black border-white"
              : "bg-neutral-900/60 text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-600"
          )}
          title="COMPOSITIONS & ASSETS"
          aria-label="Compositions"
        >
          <Film className="w-4 h-4 stroke-[1.8]" />
        </button>

        {/* Search Button */}
        <button
          type="button"
          onClick={() => onSelectView("search")}
          className={cn(
            "w-9 h-9 rounded-none flex items-center justify-center transition-none cursor-pointer relative border",
            isTabActive("search")
              ? "bg-white text-black border-white"
              : "bg-neutral-900/60 text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-600"
          )}
          title="SEARCH // ASSETS & SCRIPTS"
          aria-label="Search"
        >
          <Search className="w-4 h-4 stroke-[1.8]" />
        </button>
      </div>

      {/* Bottom Folder Indicator Button */}
      {activeFolderName && (
        <div className="p-1.5 flex flex-col items-center">
          <button
            type="button"
            onClick={onOpenFolder}
            className="w-9 h-9 rounded-none flex items-center justify-center text-neutral-400 hover:text-white bg-neutral-900/80 border border-neutral-800 hover:border-neutral-600 transition-none cursor-pointer"
            title={`Active Folder: ${activeFolderName}`}
          >
            <Folder className="w-4 h-4 text-emerald-400 stroke-[1.8]" />
          </button>
        </div>
      )}
    </aside>
  );
});

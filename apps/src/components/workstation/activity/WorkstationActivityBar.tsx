import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { Files, Film, Video, Calendar, TrendingUp, Search, Folder, Settings } from "lucide-react";
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
  const navigate = useNavigate();
  const isTabActive = (view: SidebarView) => !isCollapsed && activeView === view;

  return (
    <aside
      className="w-12 h-full bg-neutral-950 border-r border-neutral-800 flex flex-col justify-between shrink-0 select-none z-10"
      aria-label="Activity Bar"
    >
      {/* Top Navigation Icons (Nexus Video Studio Architecture) */}
      <div className="flex flex-col items-center py-2 gap-1.5 w-full">
        {/* 1. Workspace Explorer (Scripts, Canvases, Drafts) */}
        <button
          type="button"
          onClick={() => onSelectView("explorer")}
          className={cn(
            "w-9 h-9 rounded-none flex items-center justify-center transition-none cursor-pointer relative border",
            isTabActive("explorer")
              ? "bg-white text-black border-white"
              : "bg-neutral-900/60 text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-600"
          )}
          title="EXPLORER // SCRIPTS & CANVASES"
          aria-label="Explorer"
        >
          <Files className="w-4 h-4 stroke-[1.8]" />
        </button>

        {/* 2. Video Studio Compositions & Templates */}
        <button
          type="button"
          onClick={() => onSelectView("compositions")}
          className={cn(
            "w-9 h-9 rounded-none flex items-center justify-center transition-none cursor-pointer relative border",
            isTabActive("compositions")
              ? "bg-white text-black border-white"
              : "bg-neutral-900/60 text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-600"
          )}
          title="COMPOSITIONS & TEMPLATES"
          aria-label="Compositions"
        >
          <Film className="w-4 h-4 stroke-[1.8]" />
        </button>

        {/* 3. Video Stock Vault Inventory */}
        <button
          type="button"
          onClick={() => navigate("/stock")}
          className="w-9 h-9 rounded-none flex items-center justify-center transition-none cursor-pointer relative border bg-neutral-900/60 text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-600"
          title="STOCK VAULT // B-ROLL INVENTORY"
          aria-label="Stock Vault"
        >
          <Video className="w-4 h-4 stroke-[1.8]" />
        </button>

        {/* 4. Content Posting Schedule */}
        <button
          type="button"
          onClick={() => navigate("/schedule")}
          className="w-9 h-9 rounded-none flex items-center justify-center transition-none cursor-pointer relative border bg-neutral-900/60 text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-600"
          title="SCHEDULE // POSTING CALENDAR"
          aria-label="Schedule"
        >
          <Calendar className="w-4 h-4 stroke-[1.8]" />
        </button>

        {/* 5. TikTok Account Performance Analytics */}
        <button
          type="button"
          onClick={() => navigate("/analytics")}
          className="w-9 h-9 rounded-none flex items-center justify-center transition-none cursor-pointer relative border bg-neutral-900/60 text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-600"
          title="ANALYTICS // TIKTOK METRICS"
          aria-label="Analytics"
        >
          <TrendingUp className="w-4 h-4 stroke-[1.8]" />
        </button>

        {/* 6. Search Scripts & Assets */}
        <button
          type="button"
          onClick={() => onSelectView("search")}
          className={cn(
            "w-9 h-9 rounded-none flex items-center justify-center transition-none cursor-pointer relative border",
            isTabActive("search")
              ? "bg-white text-black border-white"
              : "bg-neutral-900/60 text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-600"
          )}
          title="SEARCH // SCRIPTS & TEMPLATES"
          aria-label="Search"
        >
          <Search className="w-4 h-4 stroke-[1.8]" />
        </button>
      </div>

      {/* Bottom Actions: Active Folder & System Settings */}
      <div className="flex flex-col items-center py-2 gap-1.5 w-full border-t border-neutral-900">
        {activeFolderName && (
          <button
            type="button"
            onClick={onOpenFolder}
            className="w-9 h-9 rounded-none flex items-center justify-center text-neutral-400 hover:text-white bg-neutral-900/80 border border-neutral-800 hover:border-neutral-600 transition-none cursor-pointer"
            title={`Active Folder: ${activeFolderName}`}
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

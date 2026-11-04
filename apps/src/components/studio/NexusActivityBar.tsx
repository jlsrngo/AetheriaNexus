import React from "react";
import {
  Sliders,
  Film,
  Music,
  Clock,
  Settings,
} from "lucide-react";

export type ActivityTab = "explorer" | "compositions" | "media" | "jobs";

interface NexusActivityBarProps {
  activeTab: ActivityTab;
  onSelectTab: (tab: ActivityTab) => void;
  onOpenSettings?: () => void;
  activeJobCount?: number;
}

export const NexusActivityBar: React.FC<NexusActivityBarProps> = ({
  activeTab,
  onSelectTab,
  onOpenSettings,
  activeJobCount = 0,
}) => {
  return (
    <aside className="w-12 bg-neutral-950 border-r border-neutral-800 flex flex-col items-center py-2 shrink-0 select-none z-20">
      {/* Top Nexus Hex/Dot Emblem */}
      <div className="w-8 h-8 flex items-center justify-center border border-neutral-800 bg-neutral-900 mb-3 text-emerald-400 font-mono font-black text-xs">
        ▲
      </div>

      {/* Navigation Icon Stack */}
      <div className="flex flex-col gap-1 w-full items-center">
        {/* Explorer: Assets & Dynamic Props */}
        <button
          type="button"
          onClick={() => onSelectTab("explorer")}
          title="Assets & Props Explorer"
          className={`w-10 h-10 flex items-center justify-center border-l-2 transition-none cursor-pointer relative ${
            activeTab === "explorer"
              ? "text-emerald-400 border-emerald-400 bg-neutral-900"
              : "text-neutral-400 border-transparent hover:text-white hover:bg-neutral-900/60"
          }`}
        >
          <Sliders className="w-4 h-4" />
        </button>

        {/* Compositions Templates */}
        <button
          type="button"
          onClick={() => onSelectTab("compositions")}
          title="Compositions (Templates)"
          className={`w-10 h-10 flex items-center justify-center border-l-2 transition-none cursor-pointer relative ${
            activeTab === "compositions"
              ? "text-emerald-400 border-emerald-400 bg-neutral-900"
              : "text-neutral-400 border-transparent hover:text-white hover:bg-neutral-900/60"
          }`}
        >
          <Film className="w-4 h-4" />
        </button>

        {/* Media Assets Vault */}
        <button
          type="button"
          onClick={() => onSelectTab("media")}
          title="Stock Media & Audio Vault"
          className={`w-10 h-10 flex items-center justify-center border-l-2 transition-none cursor-pointer relative ${
            activeTab === "media"
              ? "text-emerald-400 border-emerald-400 bg-neutral-900"
              : "text-neutral-400 border-transparent hover:text-white hover:bg-neutral-900/60"
          }`}
        >
          <Music className="w-4 h-4" />
        </button>

        {/* Jobs & Render Queue */}
        <button
          type="button"
          onClick={() => onSelectTab("jobs")}
          title="Jobs & Render Queue"
          className={`w-10 h-10 flex items-center justify-center border-l-2 transition-none cursor-pointer relative ${
            activeTab === "jobs"
              ? "text-emerald-400 border-emerald-400 bg-neutral-900"
              : "text-neutral-400 border-transparent hover:text-white hover:bg-neutral-900/60"
          }`}
        >
          <Clock className="w-4 h-4" />
          {activeJobCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-400 rounded-full" />
          )}
        </button>
      </div>

      {/* Bottom Settings Button */}
      <div className="mt-auto flex flex-col gap-1 w-full items-center">
        <button
          type="button"
          onClick={onOpenSettings}
          title="Engine Settings"
          className="w-10 h-10 flex items-center justify-center text-neutral-500 hover:text-white hover:bg-neutral-900/60 transition-none cursor-pointer"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};

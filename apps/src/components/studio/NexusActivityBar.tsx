import React from "react";
import {
  Film,
  Sliders,
  FolderOpen,
  Clock,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

export type ActivityTab = "compositions" | "props" | "assets" | "jobs";

interface NexusActivityBarProps {
  activeTab: ActivityTab;
  isOpen: boolean;
  onSelectTab: (tab: ActivityTab) => void;
  onToggleCollapse: () => void;
  onOpenSettings?: () => void;
  activeJobCount?: number;
}

export const NexusActivityBar: React.FC<NexusActivityBarProps> = ({
  activeTab,
  isOpen,
  onSelectTab,
  onToggleCollapse,
  onOpenSettings,
  activeJobCount = 0,
}) => {
  const handleTabClick = (tab: ActivityTab) => {
    if (activeTab === tab) {
      // Toggle collapse if clicking already active tab (like VSCode)
      onToggleCollapse();
    } else {
      onSelectTab(tab);
    }
  };

  return (
    <aside className="w-12 bg-neutral-950 border-r border-neutral-800 flex flex-col items-center py-2 shrink-0 select-none z-20 font-mono">
      {/* Top Toggle Collapse Button */}
      <button
        type="button"
        onClick={onToggleCollapse}
        title={isOpen ? "Collapse Sidebar (Ctrl+B)" : "Expand Sidebar (Ctrl+B)"}
        className="w-8 h-8 flex items-center justify-center border border-neutral-800 bg-neutral-900 mb-3 text-neutral-400 hover:text-white hover:border-neutral-600 transition-none cursor-pointer"
      >
        {isOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
      </button>

      {/* Navigation Icon Stack */}
      <div className="flex flex-col gap-1 w-full items-center">
        {/* 1. Compositions (Templates List) */}
        <button
          type="button"
          onClick={() => handleTabClick("compositions")}
          title="Compositions (Templates)"
          className={`w-10 h-10 flex items-center justify-center border-l-2 transition-none cursor-pointer relative ${
            isOpen && activeTab === "compositions"
              ? "text-emerald-400 border-emerald-400 bg-neutral-900"
              : "text-neutral-400 border-transparent hover:text-white hover:bg-neutral-900/60"
          }`}
        >
          <Film className="w-4 h-4" />
        </button>

        {/* 2. Dynamic Props & Inspector */}
        <button
          type="button"
          onClick={() => handleTabClick("props")}
          title="Dynamic Props & Inspector"
          className={`w-10 h-10 flex items-center justify-center border-l-2 transition-none cursor-pointer relative ${
            isOpen && activeTab === "props"
              ? "text-emerald-400 border-emerald-400 bg-neutral-900"
              : "text-neutral-400 border-transparent hover:text-white hover:bg-neutral-900/60"
          }`}
        >
          <Sliders className="w-4 h-4" />
        </button>

        {/* 3. Media Vault & Assets */}
        <button
          type="button"
          onClick={() => handleTabClick("assets")}
          title="Media Assets & Vault"
          className={`w-10 h-10 flex items-center justify-center border-l-2 transition-none cursor-pointer relative ${
            isOpen && activeTab === "assets"
              ? "text-emerald-400 border-emerald-400 bg-neutral-900"
              : "text-neutral-400 border-transparent hover:text-white hover:bg-neutral-900/60"
          }`}
        >
          <FolderOpen className="w-4 h-4" />
        </button>

        {/* 4. Jobs & Render Queue */}
        <button
          type="button"
          onClick={() => handleTabClick("jobs")}
          title="Jobs & Render Queue"
          className={`w-10 h-10 flex items-center justify-center border-l-2 transition-none cursor-pointer relative ${
            isOpen && activeTab === "jobs"
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

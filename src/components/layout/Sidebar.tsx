import React from "react";
import { TabType } from "../../types";
import { Video, Layers, Calendar, BarChart3, Settings } from "lucide-react";

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  readyStockCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  readyStockCount,
}) => {
  const navItems: { id: TabType; label: string; code: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "studio", label: "Studio Editor", code: "01", icon: <Video className="w-4 h-4" /> },
    { id: "stock", label: "Stok Video", code: "02", icon: <Layers className="w-4 h-4" />, badge: readyStockCount },
    { id: "schedule", label: "Jadwal Posting", code: "03", icon: <Calendar className="w-4 h-4" /> },
    { id: "analytics", label: "Analitik TikTok", code: "04", icon: <BarChart3 className="w-4 h-4" /> },
  ];

  return (
    <aside className="w-60 bg-neutral-950 border-r border-neutral-800 flex flex-col justify-between shrink-0 select-none">
      <div>
        {/* Sidebar Header: VS Code Section Header style */}
        <div className="h-9 px-4 border-b border-neutral-800 flex items-center justify-between font-mono text-[11px] text-neutral-400 font-bold uppercase tracking-wider">
          <span>Explorer</span>
          <span className="text-[10px] text-neutral-600">// MODULES</span>
        </div>

        {/* Main Navigation list (01 - 04) */}
        <nav className="p-2 space-y-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2 text-xs font-mono font-bold transition-colors rounded-none border ${
                  isActive
                    ? "bg-white text-black border-white"
                    : "bg-transparent text-neutral-400 border-transparent hover:text-white hover:bg-neutral-900 hover:border-neutral-800"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={`text-[10px] ${isActive ? "text-neutral-600" : "text-neutral-500"}`}>
                    {item.code}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 font-mono font-bold ${
                      isActive ? "bg-black text-white" : "bg-neutral-800 text-neutral-300 border border-neutral-700"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer: Settings moved to footer (VS Code style) */}
      <div className="p-2 border-t border-neutral-800">
        <button
          onClick={() => setActiveTab("settings")}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-mono font-bold transition-colors rounded-none border ${
            activeTab === "settings"
              ? "bg-white text-black border-white"
              : "bg-transparent text-neutral-400 border-transparent hover:text-white hover:bg-neutral-900 hover:border-neutral-800"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Settings className="w-4 h-4" />
            <span>Pengaturan</span>
          </div>
          <span className={`text-[10px] ${activeTab === "settings" ? "text-neutral-600" : "text-neutral-500"}`}>
            05
          </span>
        </button>
      </div>
    </aside>
  );
};

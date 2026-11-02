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
    { id: "settings", label: "Pengaturan", code: "05", icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <aside className="w-64 bg-neutral-950 border-r border-neutral-800 flex flex-col justify-between shrink-0 select-none">
      <div>
        {/* Logo / Header Branding */}
        <div className="p-5 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 bg-white text-black font-black flex items-center justify-center font-mono text-xs">
              ⚡
            </div>
            <div>
              <div className="font-mono font-black text-sm tracking-tight text-white uppercase">
                Arunaki<span className="text-neutral-500">Nexus</span>
              </div>
              <div className="hud-label text-[9px] text-neutral-500">v0.2.0 // BRUTAL_HUD</div>
            </div>
          </div>
        </div>

        {/* Section Label */}
        <div className="px-5 pt-4 pb-2 hud-label text-[9px]">
          [NAVIGATION_MODULES]
        </div>

        {/* Navigation list */}
        <nav className="p-2 space-y-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-mono font-bold transition-colors rounded-none border ${
                  isActive
                    ? "bg-white text-black border-white"
                    : "bg-transparent text-neutral-400 border-transparent hover:text-white hover:bg-neutral-900 hover:border-neutral-800"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] ${isActive ? "text-neutral-600" : "text-neutral-600"}`}>
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

      {/* Footer System Telemetry */}
      <div className="p-4 border-t border-neutral-800 font-mono text-[10px] space-y-1 text-neutral-500">
        <div className="flex justify-between">
          <span>ENGINE:</span>
          <span className="text-neutral-300">REMOTION_4</span>
        </div>
        <div className="flex justify-between">
          <span>HOST:</span>
          <span className="text-neutral-300">TAURI_RUST_V2</span>
        </div>
        <div className="flex justify-between">
          <span>RENDER_COST:</span>
          <span className="text-emerald-400 font-bold">RP 0 (LOCAL)</span>
        </div>
      </div>
    </aside>
  );
};


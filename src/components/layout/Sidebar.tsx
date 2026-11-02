import React, { useState } from "react";
import { TabType } from "../../types";
import { Video, Layers, Calendar, BarChart3, Settings, PanelLeftClose, PanelLeft } from "lucide-react";
import { useI18n } from "../../lib/i18n";

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
  const { t } = useI18n();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("arunaki_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("arunaki_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  const navItems: { id: TabType; label: string; code: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "studio", label: t("studioEditor"), code: "01", icon: <Video className="w-4 h-4" /> },
    { id: "stock", label: t("videoStock"), code: "02", icon: <Layers className="w-4 h-4" />, badge: readyStockCount },
    { id: "schedule", label: t("postingSchedule"), code: "03", icon: <Calendar className="w-4 h-4" /> },
    { id: "analytics", label: t("tiktokAnalytics"), code: "04", icon: <BarChart3 className="w-4 h-4" /> },
  ];

  return (
    <aside
      className={`bg-neutral-950 border-r border-neutral-800 flex flex-col justify-between shrink-0 select-none transition-all duration-200 ${
        isCollapsed ? "w-14" : "w-60"
      }`}
    >
      <div>
        {/* Sidebar Header: Section Header with Collapse Button */}
        <div className="h-10 px-3 border-b border-neutral-800 flex items-center justify-between font-mono text-[11px] text-neutral-400 font-bold uppercase tracking-wider">
          {!isCollapsed && (
            <>
              <span>{t("explorer")}</span>
              <span className="text-[10px] text-neutral-600">// {t("modules")}</span>
            </>
          )}
          <button
            type="button"
            onClick={toggleCollapse}
            className={`p-1 hover:text-white hover:bg-neutral-900 border border-transparent hover:border-neutral-800 transition-colors ${
              isCollapsed ? "mx-auto" : ""
            }`}
            title={isCollapsed ? "Buka Sidebar (Expand)" : "Tutup Sidebar (Collapse)"}
          >
            {isCollapsed ? <PanelLeft className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Main Navigation list (01 - 04) */}
        <nav className="p-1.5 space-y-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                title={item.label}
                className={`w-full flex items-center text-xs font-mono font-bold transition-colors rounded-none border ${
                  isCollapsed ? "justify-center py-2.5 px-0" : "justify-between px-3.5 py-2"
                } ${
                  isActive
                    ? "bg-white text-black border-white"
                    : "bg-transparent text-neutral-400 border-transparent hover:text-white hover:bg-neutral-900 hover:border-neutral-800"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {!isCollapsed && (
                    <span className={`text-[10px] ${isActive ? "text-neutral-600" : "text-neutral-500"}`}>
                      {item.code}
                    </span>
                  )}
                  <span className="shrink-0">{item.icon}</span>
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </div>

                {!isCollapsed && item.badge !== undefined && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 font-mono font-bold ${
                      isActive ? "bg-black text-white" : "bg-neutral-800 text-neutral-300 border border-neutral-700"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}

                {isCollapsed && item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer: Settings at footer */}
      <div className="p-1.5 border-t border-neutral-800">
        <button
          onClick={() => setActiveTab("settings")}
          title={t("settings")}
          className={`w-full flex items-center text-xs font-mono font-bold transition-colors rounded-none border ${
            isCollapsed ? "justify-center py-2.5 px-0" : "justify-between px-3.5 py-2.5"
          } ${
            activeTab === "settings"
              ? "bg-white text-black border-white"
              : "bg-transparent text-neutral-400 border-transparent hover:text-white hover:bg-neutral-900 hover:border-neutral-800"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Settings className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>{t("settings")}</span>}
          </div>
          {!isCollapsed && (
            <span className={`text-[10px] ${activeTab === "settings" ? "text-neutral-600" : "text-neutral-500"}`}>
              05
            </span>
          )}
        </button>
      </div>
    </aside>
  );
};

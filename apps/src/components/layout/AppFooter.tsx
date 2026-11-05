import { memo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Video,
  Film,
  Calendar,
  BarChart3,
  Settings,
  Folder,
  Wifi,
  WifiOff,
} from "lucide-react";
import { cn } from "../../lib/utils";

interface AppFooterProps {
  activeFolder: string;
  isOnline: boolean;
  onOpenFolder?: () => void;
}

export const AppFooter = memo(function AppFooter({
  activeFolder,
  isOnline,
  onOpenFolder,
}: AppFooterProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { label: "STUDIO", path: "/", icon: Video },
    { label: "STOCK", path: "/stock", icon: Film },
    { label: "SCHEDULE", path: "/schedule", icon: Calendar },
    { label: "ANALYTICS", path: "/analytics", icon: BarChart3 },
    { label: "SETTINGS", path: "/settings", icon: Settings },
  ];

  const handleNavigateStudio = useCallback(() => {
    const savedFolder = localStorage.getItem("arunaki_active_folder") || "";
    const savedChatId = savedFolder
      ? localStorage.getItem(`arunaki_active_chat_id_${savedFolder}`) || ""
      : localStorage.getItem("arunaki_active_chat_id") || "";
    const params = new URLSearchParams();
    if (savedFolder) params.set("folder", savedFolder);
    if (savedChatId) params.set("chatId", savedChatId);
    const query = params.toString();
    navigate(query ? `/?${query}` : "/");
  }, [navigate]);

  return (
    <footer className="h-11 bg-neutral-950 px-3 flex items-center justify-between shrink-0 border-t border-neutral-800 transition-none select-none text-xs font-mono">
      {/* Left: Active Folder Display */}
      <div className="flex items-center gap-2 min-w-0 max-w-[280px] sm:max-w-[340px]">
        <button
          type="button"
          onClick={onOpenFolder}
          title={
            activeFolder
              ? `Active Workspace: ${activeFolder} (Click to switch)`
              : "No workspace connected (Click to open)"
          }
          className="flex items-center gap-2 px-2.5 py-1 rounded-none bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white transition-none cursor-pointer truncate max-w-full"
        >
          <Folder className="w-3.5 h-3.5 shrink-0 text-neutral-400" />
          <span className="text-[11px] font-mono uppercase tracking-wider truncate">
            {activeFolder
              ? activeFolder.split(/[\\/]/).filter(Boolean).pop() || activeFolder
              : "NO WORKSPACE CONNECTED"}
          </span>
        </button>
      </div>

      {/* Center: Navigation Hub */}
      <div className="flex items-center gap-1 p-0.5 bg-neutral-900 border border-neutral-800 rounded-none">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.path === "/"
              ? location.pathname === "/" || location.pathname.startsWith("/workspace")
              : location.pathname === item.path;
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => {
                if (item.path === "/") {
                  handleNavigateStudio();
                } else {
                  navigate(item.path);
                }
              }}
              title={item.label}
              className={cn(
                "flex items-center gap-2 px-3 py-1 rounded-none text-[11px] font-mono tracking-wider transition-none cursor-pointer border",
                isActive
                  ? "bg-white text-black font-extrabold border-white shadow-sm"
                  : "bg-transparent text-neutral-400 border-transparent hover:text-white hover:bg-neutral-800/80"
              )}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={isActive ? 2.2 : 1.75} />
              <span className="leading-none">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Right: Technical Telemetry Status (Bridge & Engine Port 20288/4196) */}
      <div className="flex items-center gap-2 min-w-0 max-w-[280px] sm:max-w-[340px] justify-end">
        <div
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-none text-[10px] font-mono uppercase tracking-wider border select-none",
            isOnline
              ? "bg-neutral-900 border-neutral-800 text-neutral-300"
              : "bg-rose-950 border-rose-800 text-rose-300 font-bold"
          )}
          title={
            isOnline
              ? "Local CLI Bridge connected on Port 20288 | Engine Port 4196"
              : "Local CLI Bridge Offline"
          }
        >
          {isOnline ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
              <Wifi className="w-3 h-3 shrink-0 text-emerald-400" />
              <span>ONLINE 20288</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 text-rose-400 shrink-0" />
              <span>OFFLINE</span>
            </>
          )}
        </div>
      </div>
    </footer>
  );
});

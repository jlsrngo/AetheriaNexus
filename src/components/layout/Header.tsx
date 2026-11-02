import React from "react";
import { Badge } from "../ui/Badge";
import { Layers } from "lucide-react";

interface HeaderProps {
  readyStockCount: number;
}

export const Header: React.FC<HeaderProps> = ({ readyStockCount }) => {
  return (
    <header className="h-14 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between px-6 shrink-0 z-20">
      {/* Telemetry breadcrumb */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 font-mono text-[11px] text-neutral-400">
          <span className="text-white font-bold tracking-wider">// ARUNAKI_NEXUS</span>
          <span className="text-neutral-600">/</span>
          <span className="hud-label">TELEMETRY_STUDIO</span>
          <span className="text-neutral-600">/</span>
          <span className="text-emerald-400 font-bold">READY</span>
        </div>
      </div>

      {/* Right HUD metrics */}
      <div className="flex items-center gap-4">
        {/* Stock pill */}
        <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 px-3 py-1 font-mono text-xs">
          <Layers className="w-3.5 h-3.5 text-neutral-400" />
          <span className="text-neutral-400 text-[11px]">STOCK_BUFFER:</span>
          <span className="text-white font-bold">{readyStockCount} VIDEOS</span>
          <Badge variant={readyStockCount >= 3 ? "emerald" : "amber"}>
            {readyStockCount >= 3 ? "OPTIMAL" : "LOW"}
          </Badge>
        </div>

        {/* Account indicator */}
        <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 px-3 py-1 font-mono text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-neutral-300 font-bold">@arunaki.creator</span>
          <span className="text-[10px] text-neutral-500 font-bold">[TIKTOK_AUTH]</span>
        </div>
      </div>
    </header>
  );
};


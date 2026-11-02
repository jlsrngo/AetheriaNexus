import React from "react";
import { Panel } from "../ui/Panel";
import { Badge } from "../ui/Badge";
import { Clock, Plus } from "lucide-react";

interface ScheduleViewProps {
  onNavigateToStock: () => void;
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({ onNavigateToStock }) => {
  return (
    <div className="p-8 flex-1 overflow-y-auto blueprint-grid">
      <div className="mb-8 pb-4 border-b border-neutral-800">
        <div className="hud-label">// AUTOMATED_SCHEDULER</div>
        <h2 className="font-mono text-xl font-black text-white uppercase tracking-tight mt-1">
          KALENDER PENJADWALAN POSTING TIKTOK
        </h2>
        <p className="font-mono text-xs text-neutral-400 mt-1">
          Alokasi slot jam tayang prime-time FYP TikTok harian.
        </p>
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-2 font-mono text-xs text-neutral-300">
          <Clock className="w-4 h-4 text-white" />
          <span className="font-bold">SLOT JAM TAYANG HARI INI:</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Panel className="p-5">
            <div className="flex justify-between items-center mb-2">
              <span className="hud-label">SLOT_01 // LUNCHTIME</span>
              <Badge variant="emerald">12:00 WIB</Badge>
            </div>
            <div className="font-sans font-bold text-sm text-white mb-2">
              "3 Kebiasaan Pagi Orang Sukses"
            </div>
            <div className="font-mono text-[11px] text-neutral-400">
              STATUS: AUTOMATED_DISPATCH_ARMED
            </div>
          </Panel>

          <Panel className="p-5">
            <div className="flex justify-between items-center mb-2">
              <span className="hud-label">SLOT_02 // EVENING</span>
              <Badge variant="amber">18:00 WIB</Badge>
            </div>
            <div className="font-sans font-bold text-sm text-white mb-2">
              "Stop Lakukan Ini Kalau Mau Disiplin"
            </div>
            <div className="font-mono text-[11px] text-neutral-400">
              STATUS: QUEUED_READY
            </div>
          </Panel>

          <Panel
            className="p-5 border-dashed border-neutral-700 flex flex-col items-center justify-center text-center cursor-pointer hover:border-white transition-colors"
            onClick={onNavigateToStock}
          >
            <div className="hud-label mb-2">SLOT_03 // PRIMETIME</div>
            <Badge variant="neutral" className="mb-3">21:00 WIB</Badge>
            <button className="font-mono text-xs font-bold text-white hover:underline flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              <span>PASANG DARI STOK VIDEO</span>
            </button>
          </Panel>
        </div>
      </div>
    </div>
  );
};


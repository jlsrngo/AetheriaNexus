import React from "react";
import { StockVideoItem } from "../../types";
import { Panel } from "../ui/Panel";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Plus, Share2, Calendar } from "lucide-react";

interface StockViewProps {
  stock: StockVideoItem[];
  onUpload: (item: StockVideoItem) => void;
  onNavigateToSchedule: () => void;
  onNavigateToStudio: () => void;
}

export const StockView: React.FC<StockViewProps> = ({
  stock,
  onUpload,
  onNavigateToSchedule,
  onNavigateToStudio,
}) => {
  const readyCount = stock.filter((s) => s.status === "ready").length;

  return (
    <div className="p-8 flex-1 overflow-y-auto blueprint-grid">
      {/* Header section */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-neutral-800">
        <div>
          <div className="hud-label">// INVENTORY_VAULT</div>
          <h2 className="font-mono text-xl font-black text-white uppercase tracking-tight mt-1">
            STOK PERSEDIAAN KONTEN TIKTOK
          </h2>
          <p className="font-mono text-xs text-neutral-400 mt-1">
            Persediaan video lokal yang telah terkompilasi dan siap tayang otomatis.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant={readyCount >= 3 ? "emerald" : "amber"}>
            STATUS_BUFFER: {readyCount} VIDEO TERSEDIA
          </Badge>
          <Button variant="primary" size="sm" onClick={onNavigateToStudio}>
            <Plus className="w-3.5 h-3.5" />
            <span>RENDER VIDEO BARU</span>
          </Button>
        </div>
      </div>

      {/* Grid of Video Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stock.map((item) => (
          <Panel
            key={item.id}
            className="p-5 flex flex-col justify-between hover:border-neutral-600 transition-colors"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="hud-label">{item.category}</span>
                <Badge
                  variant={
                    item.status === "ready"
                      ? "emerald"
                      : item.status === "scheduled"
                      ? "amber"
                      : "cyan"
                  }
                >
                  {item.status === "ready"
                    ? "READY_IN_STOCK"
                    : item.status === "scheduled"
                    ? "SCHEDULED"
                    : "PUBLISHED"}
                </Badge>
              </div>

              <h3 className="font-sans font-bold text-sm text-white leading-snug mb-3">
                {item.title}
              </h3>

              <div className="font-mono text-[10px] text-neutral-400 space-y-1">
                <div>DURATION: {item.duration} (30 FPS)</div>
                <div>RENDERED_AT: {item.renderedAt}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-6 pt-4 border-t border-neutral-800">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={() => onUpload(item)}
              >
                <Share2 className="w-3.5 h-3.5 text-white" />
                <span>UPLOAD TIKTOK</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onNavigateToSchedule}
                title="Jadwalkan"
              >
                <Calendar className="w-3.5 h-3.5" />
              </Button>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
};


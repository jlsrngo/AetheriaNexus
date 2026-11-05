import { memo, useState } from "react";
import { Film, CheckCircle2 } from "lucide-react";
import { CornerCrosses } from "../components/ui/CornerCrosses";
import { cn } from "../lib/utils";

interface StockVideoItem {
  id: string;
  title: string;
  hook: string;
  ratio: "9:16" | "16:9" | "1:1";
  durationSec: number;
  niche: string;
  status: "ready" | "scheduled" | "draft" | "published";
  renderedAt: string;
  fileSize: string;
  resolution: string;
}

const INITIAL_STOCK: StockVideoItem[] = [
  {
    id: "vid-001",
    title: "3 Morning Habits of High Performers",
    hook: "The first 60 minutes decide your next 10 years. Stop doing this.",
    ratio: "9:16",
    durationSec: 5,
    niche: "PRODUCTIVITY",
    status: "ready",
    renderedAt: "2026-11-03 14:15",
    fileSize: "14.2 MB",
    resolution: "1080x1920",
  },
  {
    id: "vid-002",
    title: "Why 99% Of People Fail At Compound Interest",
    hook: "If you invest $100 today, here is what banks do not tell you.",
    ratio: "9:16",
    durationSec: 15,
    niche: "FINANCE",
    status: "scheduled",
    renderedAt: "2026-11-03 11:20",
    fileSize: "38.5 MB",
    resolution: "1080x1920",
  },
  {
    id: "vid-003",
    title: "The 2-Minute Dopamine Reset Rule",
    hook: "Feeling constantly exhausted? Reset your receptors right now.",
    ratio: "9:16",
    durationSec: 30,
    niche: "PSYCHOLOGY",
    status: "ready",
    renderedAt: "2026-11-02 18:40",
    fileSize: "62.1 MB",
    resolution: "1080x1920",
  },
];

export const StockVaultPage = memo(function StockVaultPage() {
  const [filter, setFilter] = useState<"all" | "ready" | "scheduled" | "published">("all");
  const [stock] = useState<StockVideoItem[]>(INITIAL_STOCK);

  const readyCount = stock.filter((v) => v.status === "ready").length;
  const daysCoverage = Math.floor(readyCount / 3); // 3 videos/day posting target

  const filtered = filter === "all" ? stock : stock.filter((v) => v.status === filter);

  return (
    <div className="flex-1 flex flex-col h-full w-full bg-neutral-950 text-neutral-100 overflow-y-auto select-none p-6">
      <div className="max-w-6xl w-full mx-auto flex-1 flex flex-col min-h-0 space-y-6">
        {/* Header */}
        <div className="border-b border-neutral-800 pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] text-emerald-400 uppercase tracking-widest mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
              INVENTORY VAULT | LOCAL MP4 STORAGE
            </div>
            <h1 className="text-2xl font-mono font-extrabold uppercase tracking-tight text-white">
              VIDEO STOCK & CONTENT VAULT
            </h1>
            <p className="text-xs font-mono text-neutral-400 mt-1">
              Zero cloud costs. Local MP4 video inventory ready for scheduled automated TikTok publishing.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-neutral-900 border border-neutral-800 px-4 py-2 font-mono text-xs">
              <span className="text-neutral-400">READY IN VAULT: </span>
              <span className="text-white font-extrabold">{readyCount} VIDEOS</span>
              <span className="text-neutral-500 mx-2">|</span>
              <span className="text-emerald-400 font-bold">~{daysCoverage} DAYS BUFFER</span>
            </div>
          </div>
        </div>

        {/* Telemetry Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative bg-neutral-900/80 border border-neutral-800 p-4 font-mono">
            <CornerCrosses size="sm" className="text-neutral-600" />
            <div className="text-[10px] text-neutral-500 uppercase tracking-widest">Stock Health</div>
            <div className="text-xl font-bold text-emerald-400 mt-1 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              OPTIMAL BUFFER
            </div>
            <div className="text-[10px] text-neutral-400 mt-1">Target: 3 posts / day</div>
          </div>

          <div className="relative bg-neutral-900/80 border border-neutral-800 p-4 font-mono">
            <CornerCrosses size="sm" className="text-neutral-600" />
            <div className="text-[10px] text-neutral-500 uppercase tracking-widest">Total Rendered</div>
            <div className="text-xl font-bold text-white mt-1">{stock.length} VIDEOS</div>
            <div className="text-[10px] text-neutral-400 mt-1">114.8 MB on disk</div>
          </div>

          <div className="relative bg-neutral-900/80 border border-neutral-800 p-4 font-mono">
            <CornerCrosses size="sm" className="text-neutral-600" />
            <div className="text-[10px] text-neutral-500 uppercase tracking-widest">Upcoming Uploads</div>
            <div className="text-xl font-bold text-amber-400 mt-1">1 SCHEDULED</div>
            <div className="text-[10px] text-neutral-400 mt-1">Next: Today 18:00 WIB</div>
          </div>

          <div className="relative bg-neutral-900/80 border border-neutral-800 p-4 font-mono">
            <CornerCrosses size="sm" className="text-neutral-600" />
            <div className="text-[10px] text-neutral-500 uppercase tracking-widest">Hardware Engine</div>
            <div className="text-xl font-bold text-neutral-200 mt-1">LOCAL H.264</div>
            <div className="text-[10px] text-emerald-400 mt-1">Rp 0 Cloud Rendering</div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3 font-mono">
          <div className="flex items-center gap-1">
            {(["all", "ready", "scheduled", "published"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={cn(
                  "px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider border cursor-pointer transition-none",
                  filter === tab
                    ? "bg-white text-black border-white font-bold"
                    : "bg-neutral-900/50 text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-700"
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          <span className="text-[11px] text-neutral-500 font-mono">
            SHOWING {filtered.length} OF {stock.length} ASSETS
          </span>
        </div>

        {/* Video Inventory Table / Grid */}
        <div className="flex-1 space-y-2">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="relative bg-neutral-900/90 border border-neutral-800 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono hover:border-neutral-600 transition-none"
            >
              <CornerCrosses size="sm" className="text-neutral-700" />

              <div className="flex items-start gap-3.5">
                <div className="w-12 h-16 bg-black border border-neutral-700 flex flex-col items-center justify-center shrink-0 text-neutral-400">
                  <Film className="w-5 h-5 text-neutral-300 mb-1" />
                  <span className="text-[9px] text-neutral-500 font-bold">{item.ratio}</span>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] px-2 py-0.5 border border-neutral-700 bg-neutral-800 text-neutral-300 font-bold uppercase tracking-wider">
                      {item.niche}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] px-2 py-0.5 border font-bold uppercase tracking-wider",
                        item.status === "ready"
                          ? "border-emerald-500/40 text-emerald-400 bg-emerald-950/30"
                          : item.status === "scheduled"
                          ? "border-amber-500/40 text-amber-400 bg-amber-950/30"
                          : "border-neutral-700 text-neutral-400 bg-neutral-800"
                      )}
                    >
                      STATUS: {item.status}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white uppercase">{item.title}</h3>
                  <p className="text-xs text-neutral-400 mt-1 max-w-2xl line-clamp-1 italic">
                    "{item.hook}"
                  </p>
                </div>
              </div>

              {/* Metadata & Actions */}
              <div className="flex items-center gap-6 text-xs text-neutral-400 shrink-0">
                <div className="text-right hidden sm:block">
                  <div className="text-neutral-200">{item.durationSec}s // {item.resolution}</div>
                  <div className="text-[10px] text-neutral-500">{item.fileSize} // {item.renderedAt}</div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white text-[11px] font-mono uppercase tracking-wider cursor-pointer"
                  >
                    PREVIEW
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 bg-white hover:bg-neutral-200 text-black border border-white text-[11px] font-mono font-bold uppercase tracking-wider cursor-pointer"
                  >
                    POST
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});


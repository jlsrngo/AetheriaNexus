import { memo, useState } from "react";
import {
  Film,
  Folder,
  Search,
  Video,
  Music,
  FileText,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { cn } from "../../lib/utils";

interface StudioAssetsPanelProps {
  activeCompositionId: string;
  onSelectComposition: (id: string) => void;
  width?: string;
}

export const StudioAssetsPanel = memo(function StudioAssetsPanel({
  activeCompositionId,
  onSelectComposition,
  width = "256px",
}: StudioAssetsPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    templates: true,
    audio: false,
  });

  const toggleFolder = (key: string) => {
    setOpenFolders((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const compositions = [
    { id: "nexus-vertical", name: "NexusVertical (9:16)", type: "tiktok", resolution: "1080x1920", tag: "P0 TIKTOK" },
    { id: "nexus-square", name: "SquarePost (1:1)", type: "feed", resolution: "1080x1080", tag: "CAROUSEL" },
    { id: "nexus-landscape", name: "LandscapeShort (16:9)", type: "youtube", resolution: "1920x1080", tag: "SHORTS" },
  ];

  const templates = [
    { id: "tmpl-1", name: "3 Morning Habits (High Pacing)", cat: "Productivity", duration: "5s" },
    { id: "tmpl-2", name: "Why 99% Fail (Finance)", cat: "Finance", duration: "15s" },
    { id: "tmpl-3", name: "2-Min Dopamine Reset (Hook)", cat: "Psychology", duration: "30s" },
  ];

  const assets = [
    { name: "lofi_focus_beat.mp3", type: "audio", size: "3.4 MB" },
    { name: "brand_telemetry_hud.png", type: "image", size: "1.2 MB" },
    { name: "hooks_library_2026.json", type: "data", size: "48 KB" },
  ];

  return (
    <aside
      className="h-full bg-neutral-950 border-r border-neutral-800 flex flex-col shrink-0 select-none font-mono text-xs overflow-hidden"
      style={{ width }}
    >
      {/* 1. Header (Swiss Brutalism - Unified Studio Assets) */}
      <div className="h-9 bg-neutral-900/90 border-b border-neutral-800 px-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-white font-bold text-[11px] uppercase tracking-wider">
          <Film className="w-3.5 h-3.5 text-emerald-400" />
          <span>STUDIO ASSETS</span>
        </div>
        <span className="text-[9px] text-neutral-500 font-mono">NEXUS</span>
      </div>

      {/* 2. Quick Search Bar */}
      <div className="p-2 border-b border-neutral-800 bg-neutral-950 shrink-0">
        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-neutral-900 border border-neutral-800 text-neutral-300">
          <Search className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates or assets..."
            className="w-full bg-transparent text-white font-mono text-[11px] placeholder:text-neutral-600 focus:outline-none"
          />
        </div>
      </div>

      {/* 3. Items Tree View */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {/* Primary Compositions Section */}
        <div>
          <div className="text-[9px] uppercase tracking-widest text-neutral-500 font-bold px-2 py-1 mb-1">
            ACTIVE COMPOSITIONS
          </div>
          <div className="space-y-1">
            {compositions.map((comp) => {
              const isSelected = activeCompositionId === comp.id;
              return (
                <button
                  key={comp.id}
                  type="button"
                  onClick={() => onSelectComposition(comp.id)}
                  className={cn(
                    "w-full px-2.5 py-2 text-left flex items-center justify-between border cursor-pointer transition-none",
                    isSelected
                      ? "bg-neutral-900 border-neutral-700 text-white font-bold"
                      : "bg-transparent border-transparent text-neutral-400 hover:bg-neutral-900/60 hover:text-neutral-200"
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Film className={cn("w-3.5 h-3.5 shrink-0", isSelected ? "text-emerald-400" : "text-neutral-500")} />
                    <span className="truncate text-[11px]">{comp.name}</span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.2 border border-neutral-700 text-neutral-400 font-mono">
                    {comp.tag}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Folder: Video Templates */}
        <div>
          <button
            type="button"
            onClick={() => toggleFolder("templates")}
            className="w-full flex items-center justify-between px-2 py-1 text-[9px] uppercase tracking-widest text-neutral-400 font-bold hover:text-white cursor-pointer"
          >
            <div className="flex items-center gap-1.5">
              {openFolders.templates ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <Folder className="w-3.5 h-3.5 text-amber-400" />
              <span>VIRAL HOOK TEMPLATES</span>
            </div>
            <span className="text-neutral-600 font-mono">3</span>
          </button>

          {openFolders.templates && (
            <div className="pl-4 pr-1 py-1 space-y-1">
              {templates.map((tmpl) => (
                <div
                  key={tmpl.id}
                  className="px-2 py-1.5 bg-neutral-900/40 hover:bg-neutral-900 border border-neutral-850 hover:border-neutral-700 text-neutral-300 flex items-center justify-between cursor-pointer"
                >
                  <div className="truncate">
                    <div className="text-[10px] font-bold text-white truncate">{tmpl.name}</div>
                    <div className="text-[9px] text-neutral-500">{tmpl.cat}</div>
                  </div>
                  <span className="text-[9px] text-emerald-400 font-mono">{tmpl.duration}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Assets Section */}
        <div>
          <div className="text-[9px] uppercase tracking-widest text-neutral-500 font-bold px-2 py-1 mb-1">
            LOCAL MEDIA & SOUND
          </div>
          <div className="space-y-1">
            {assets.map((asset) => (
              <div
                key={asset.name}
                className="px-2.5 py-2 bg-neutral-900/40 border border-neutral-800 text-neutral-300 flex items-center justify-between hover:border-neutral-700 cursor-pointer"
              >
                <div className="flex items-center gap-2 truncate">
                  {asset.type === "audio" ? (
                    <Music className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  ) : asset.type === "image" ? (
                    <Video className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  )}
                  <span className="truncate text-[11px] text-white">{asset.name}</span>
                </div>
                <span className="text-[9px] text-neutral-500 font-mono">{asset.size}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Bottom Footer Info: Nexus Engine Version */}
      <div className="p-2 border-t border-neutral-800 bg-neutral-900/90 flex items-center justify-between text-[10px] text-neutral-400 shrink-0">
        <span className="text-emerald-400">NEXUS ENGINE v4.0</span>
        <span className="text-neutral-500">1080x1920 PX</span>
      </div>
    </aside>
  );
});

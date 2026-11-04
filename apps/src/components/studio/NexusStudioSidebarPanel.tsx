import React, { useState } from "react";
import {
  Film,
  Music,
  Video,
  Image as ImageIcon,
  FileText,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  PanelLeftClose,
  Check,
  Clock,
} from "lucide-react";
import { NexusVideoProps } from "../../remotion/types";
import { CompositionPreset, NexusStaticFile, RenderJob } from "../../lib/nexusStudioBridge";
import { ActivityTab } from "./NexusActivityBar";

interface NexusStudioSidebarPanelProps {
  activeTab: ActivityTab;
  isOpen: boolean;
  onClose: () => void;
  videoProps: NexusVideoProps;
  onChangeProps: (props: Partial<NexusVideoProps>) => void;
  compositions: CompositionPreset[];
  activeCompositionId: string;
  onSelectComposition: (preset: CompositionPreset) => void;
  staticFiles: NexusStaticFile[];
  onSelectMediaFile: (file: NexusStaticFile) => void;
  onRefreshFiles: () => void;
  renderJobs?: RenderJob[];
}

export const NexusStudioSidebarPanel: React.FC<NexusStudioSidebarPanelProps> = ({
  activeTab,
  isOpen,
  onClose,
  videoProps,
  onChangeProps,
  compositions,
  activeCompositionId,
  onSelectComposition,
  staticFiles,
  onSelectMediaFile,
  onRefreshFiles,
  renderJobs = [],
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [assetFilter, setAssetFilter] = useState<"all" | "video" | "audio" | "image">("all");

  // Dynamic prop sliders
  const [textScale, setTextScale] = useState(100);
  const [glowIntensity, setGlowIntensity] = useState(75);
  const [bgDarkness, setBgDarkness] = useState(90);
  const [audioVolume, setAudioVolume] = useState(80);

  // Accordion states
  const [section1Open, setSection1Open] = useState(true);

  if (!isOpen) return null;

  const THEMES: Array<{ key: NexusVideoProps["themeColor"]; label: string; color: string }> = [
    { key: "emerald", label: "Emerald (Growth)", color: "#10b981" },
    { key: "amber", label: "Amber (Finance)", color: "#f59e0b" },
    { key: "cyan", label: "Cyan (Tech)", color: "#06b6d4" },
    { key: "rose", label: "Rose (Urgent)", color: "#f43f5e" },
    { key: "violet", label: "Violet (Luxury)", color: "#a855f7" },
  ];

  const filteredComps = compositions.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAssets = staticFiles
    .filter((f) => assetFilter === "all" || f.type === assetFilter)
    .filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const titles: Record<ActivityTab, string> = {
    compositions: "COMPOSITIONS // TEMPLATES",
    props: "DYNAMIC PROPS & INSPECTOR",
    assets: "MEDIA VAULT & ASSETS",
    jobs: "JOBS & RENDER QUEUE",
  };

  return (
    <aside className="w-72 bg-neutral-950 border-r border-neutral-800 flex flex-col shrink-0 select-none font-mono text-xs overflow-hidden z-10">
      {/* 1. Header Bar with Collapse Button */}
      <div className="h-8 px-3 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/80 font-bold text-neutral-300">
        <span className="truncate uppercase text-[11px] font-black tracking-wider text-white">
          {titles[activeTab]}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onRefreshFiles}
            title="Refresh list"
            className="p-1 hover:text-white text-neutral-400 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Collapse sidebar"
            className="p-1 hover:text-white text-neutral-400 cursor-pointer"
          >
            <PanelLeftClose className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Search / Filter Header */}
      {activeTab !== "props" && (
        <div className="p-2 border-b border-neutral-800 bg-neutral-950 space-y-1.5">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${activeTab}...`}
            className="w-full bg-neutral-900 border border-neutral-800 px-2 py-1 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-neutral-600 rounded-none transition-none"
          />

          {/* Media Vault Sub-filters */}
          {activeTab === "assets" && (
            <div className="flex items-center gap-1 text-[10px]">
              {(["all", "video", "audio", "image"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setAssetFilter(filter)}
                  className={`px-2 py-0.5 border uppercase cursor-pointer ${
                    assetFilter === filter
                      ? "border-emerald-500 text-emerald-400 bg-neutral-900 font-bold"
                      : "border-neutral-800 text-neutral-400 hover:text-white"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. Dynamic Switchable Panel Views */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {/* =================================================================== */}
        {/* VIEW 1: COMPOSITIONS */}
        {/* =================================================================== */}
        {activeTab === "compositions" && (
          <div className="space-y-3">
            {/* Short-form Compositions */}
            <div>
              <button
                type="button"
                onClick={() => setSection1Open(!section1Open)}
                className="w-full flex items-center justify-between text-[10px] tracking-widest text-neutral-500 font-bold mb-1 uppercase text-left cursor-pointer"
              >
                <div className="flex items-center gap-1">
                  {section1Open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  <span>SHORT-FORM VIDEO (9:16)</span>
                </div>
                <span>{filteredComps.length}</span>
              </button>

              {section1Open && (
                <div className="space-y-1">
                  {filteredComps.map((comp) => {
                    const isActive = activeCompositionId === comp.id;
                    return (
                      <div
                        key={comp.id}
                        onClick={() => onSelectComposition(comp)}
                        className={`p-2 border flex items-center justify-between cursor-pointer transition-none ${
                          isActive
                            ? "border-emerald-500 bg-neutral-900 text-white font-bold"
                            : "border-neutral-800/80 bg-neutral-950 hover:bg-neutral-900/60 text-neutral-300"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Film className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-emerald-400" : "text-neutral-500"}`} />
                          <div className="truncate">
                            <div className="truncate text-[11px]">{comp.name}</div>
                            <div className="text-[9px] text-neutral-500 font-normal">
                              {comp.ratio} • {comp.duration}s • {comp.fps || 30}fps
                            </div>
                          </div>
                        </div>

                        {isActive && (
                          <span className="text-[9px] bg-emerald-500 text-black px-1 font-bold">
                            ACTIVE
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* VIEW 2: DYNAMIC PROPS & INSPECTOR */}
        {/* =================================================================== */}
        {activeTab === "props" && (
          <div className="space-y-3">
            {/* Target Template Info Box */}
            <div className="p-2.5 bg-neutral-900/60 border border-neutral-800">
              <div className="text-[10px] text-neutral-500 uppercase font-bold mb-0.5">
                Active Template
              </div>
              <div className="font-bold text-emerald-400 text-xs truncate">
                NexusEditorialVideo (9:16)
              </div>
              <div className="text-[10px] text-neutral-400 mt-1">
                1080 × 1920 px // 30 FPS // 150 Frames
              </div>
            </div>

            {/* Sliders (Matching user mockup aesthetic) */}
            <div className="space-y-2.5 bg-neutral-900/40 p-2.5 border border-neutral-800">
              <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                Video Dynamic Sliders
              </div>

              <div>
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="text-neutral-400">Scale (Dynamic Prop 1)</span>
                  <span className="text-emerald-400 font-mono">{textScale}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={textScale}
                  onChange={(e) => setTextScale(Number(e.target.value))}
                  className="w-full h-1 bg-neutral-800 accent-emerald-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="text-neutral-400">Glow Intensity (Dynamic Prop 2)</span>
                  <span className="text-emerald-400 font-mono">{glowIntensity}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={glowIntensity}
                  onChange={(e) => setGlowIntensity(Number(e.target.value))}
                  className="w-full h-1 bg-neutral-800 accent-emerald-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="text-neutral-400">Backdrop Darkness (Dynamic Prop 3)</span>
                  <span className="text-emerald-400 font-mono">{bgDarkness}%</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="100"
                  value={bgDarkness}
                  onChange={(e) => setBgDarkness(Number(e.target.value))}
                  className="w-full h-1 bg-neutral-800 accent-emerald-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="text-neutral-400">Audio Volume (Dynamic Prop 4)</span>
                  <span className="text-emerald-400 font-mono">{audioVolume}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={audioVolume}
                  onChange={(e) => setAudioVolume(Number(e.target.value))}
                  className="w-full h-1 bg-neutral-800 accent-emerald-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Hook Text Input */}
            <div>
              <label className="text-[10px] uppercase font-bold text-neutral-400 block mb-1">
                Hook Text (0 - 3s)
              </label>
              <textarea
                rows={2}
                value={videoProps.hookText}
                onChange={(e) => onChangeProps({ hookText: e.target.value })}
                className="w-full bg-neutral-900 border border-neutral-800 p-2 text-xs text-white resize-none focus:outline-none focus:border-emerald-500 rounded-none transition-none"
              />
            </div>

            {/* Body Points Input */}
            <div>
              <label className="text-[10px] uppercase font-bold text-neutral-400 block mb-1">
                Body Points (Content)
              </label>
              <textarea
                rows={4}
                value={videoProps.bodyText}
                onChange={(e) => onChangeProps({ bodyText: e.target.value })}
                className="w-full bg-neutral-900 border border-neutral-800 p-2 text-xs text-white resize-none focus:outline-none focus:border-emerald-500 rounded-none transition-none"
              />
            </div>

            {/* Author Handle */}
            <div>
              <label className="text-[10px] uppercase font-bold text-neutral-400 block mb-1">
                Author Handle
              </label>
              <input
                type="text"
                value={videoProps.authorHandle}
                onChange={(e) => onChangeProps({ authorHandle: e.target.value })}
                className="w-full bg-neutral-900 border border-neutral-800 px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 rounded-none transition-none"
              />
            </div>

            {/* Theme Color Picker */}
            <div>
              <label className="text-[10px] uppercase font-bold text-neutral-400 block mb-1.5">
                Theme Palette
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {THEMES.map((th) => (
                  <button
                    key={th.key}
                    type="button"
                    onClick={() => onChangeProps({ themeColor: th.key })}
                    title={th.label}
                    style={{ backgroundColor: th.color }}
                    className={`h-6 rounded-none flex items-center justify-center cursor-pointer transition-none ${
                      videoProps.themeColor === th.key
                        ? "ring-2 ring-white ring-offset-1 ring-offset-black"
                        : "opacity-80 hover:opacity-100"
                    }`}
                  >
                    {videoProps.themeColor === th.key && (
                      <Check className="w-3.5 h-3.5 text-black stroke-[3]" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* VIEW 3: ASSETS & MEDIA VAULT */}
        {/* =================================================================== */}
        {activeTab === "assets" && (
          <div className="space-y-3">
            <div className="text-[10px] tracking-widest text-neutral-500 font-bold uppercase flex items-center justify-between">
              <span>VAULT ASSETS ({filteredAssets.length})</span>
            </div>

            {filteredAssets.length === 0 ? (
              <div className="p-4 border border-neutral-800 text-center text-neutral-500 text-[11px]">
                No media assets match your search
              </div>
            ) : (
              <div className="space-y-1">
                {filteredAssets.map((file) => (
                  <div
                    key={file.id}
                    onClick={() => onSelectMediaFile(file)}
                    className="p-2 bg-neutral-950 border border-neutral-800 hover:border-neutral-600 hover:bg-neutral-900 flex items-center justify-between cursor-pointer transition-none group"
                  >
                    <div className="flex items-center gap-2 truncate">
                      {file.type === "audio" && <Music className="w-4 h-4 text-emerald-400 shrink-0" />}
                      {file.type === "video" && <Video className="w-4 h-4 text-cyan-400 shrink-0" />}
                      {file.type === "image" && <ImageIcon className="w-4 h-4 text-purple-400 shrink-0" />}
                      {file.type === "data" && <FileText className="w-4 h-4 text-amber-400 shrink-0" />}

                      <div className="truncate">
                        <div className="text-[11px] text-neutral-200 truncate font-bold group-hover:text-white">
                          {file.name}
                        </div>
                        <div className="text-[9px] text-neutral-500 uppercase">{file.type}</div>
                      </div>
                    </div>

                    <span className="text-[10px] text-neutral-500 font-mono shrink-0">
                      {file.size}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* VIEW 4: JOBS & RENDER QUEUE */}
        {/* =================================================================== */}
        {activeTab === "jobs" && (
          <div className="space-y-3">
            <div className="text-[10px] tracking-widest text-neutral-500 font-bold uppercase">
              ACTIVE RENDER WORKERS
            </div>

            {renderJobs.length === 0 ? (
              <div className="p-4 bg-neutral-900/40 border border-neutral-800 text-center text-neutral-500 text-[11px] space-y-1">
                <Clock className="w-5 h-5 mx-auto text-neutral-600 mb-1" />
                <p>No active render jobs in queue.</p>
                <p className="text-[9px] text-neutral-600">
                  Click [⚡ EXPORT MP4] on the timeline to start a local GPU render.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {renderJobs.map((job) => (
                  <div key={job.renderId} className="p-2.5 bg-neutral-950 border border-neutral-800 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-white">
                      <span className="truncate">{job.renderId}</span>
                      <span className="text-emerald-400">{job.percent}%</span>
                    </div>
                    <div className="w-full bg-neutral-800 h-1.5">
                      <div
                        className="bg-emerald-400 h-1.5 transition-all"
                        style={{ width: `${job.percent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-neutral-500">
                      <span>Status: {job.status}</span>
                      <span>{job.renderedFrames}/{job.totalFrames} frames</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Quick Render Info */}
            <div className="p-2 bg-neutral-900/60 border border-neutral-800 text-[10px] text-neutral-400 space-y-1">
              <div className="font-bold text-white uppercase">GPU Hardware Engine</div>
              <div className="text-emerald-400">Hardware Acceleration: NVENC / AMF / QSV</div>
              <div className="text-neutral-500">Zero Cloud Fees (Rp 0 Cost)</div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

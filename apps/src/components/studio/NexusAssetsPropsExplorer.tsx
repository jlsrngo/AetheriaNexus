import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Grid,
  Music,
  Video,
  Image as ImageIcon,
  FileText,
  Check,
} from "lucide-react";
import { NexusVideoProps } from "../../remotion/types";
import { NexusStaticFile } from "../../lib/nexusStudioBridge";

interface NexusAssetsPropsExplorerProps {
  videoProps: NexusVideoProps;
  onChangeProps: (props: Partial<NexusVideoProps>) => void;
  staticFiles: NexusStaticFile[];
  onSelectMediaFile?: (file: NexusStaticFile) => void;
  onRefreshFiles?: () => void;
}

export const NexusAssetsPropsExplorer: React.FC<NexusAssetsPropsExplorerProps> = ({
  videoProps,
  onChangeProps,
  staticFiles,
  onSelectMediaFile,
  onRefreshFiles,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [assetsOpen, setAssetsOpen] = useState(true);
  const [propsOpen, setPropsOpen] = useState(true);

  // Sliders for dynamic props (from user's mockup)
  const [textScale, setTextScale] = useState(100);
  const [glowIntensity, setGlowIntensity] = useState(75);
  const [bgDarkness, setBgDarkness] = useState(90);
  const [audioVolume, setAudioVolume] = useState(80);

  const THEMES: Array<{ key: NexusVideoProps["themeColor"]; label: string; color: string }> = [
    { key: "emerald", label: "Emerald (Growth)", color: "#10b981" },
    { key: "amber", label: "Amber (Finance)", color: "#f59e0b" },
    { key: "cyan", label: "Cyan (Tech)", color: "#06b6d4" },
    { key: "rose", label: "Rose (Urgent)", color: "#f43f5e" },
    { key: "violet", label: "Violet (Luxury)", color: "#a855f7" },
  ];

  const filteredFiles = staticFiles.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside className="w-72 bg-neutral-950 border-r border-neutral-800 flex flex-col shrink-0 select-none font-mono text-xs overflow-hidden z-10">
      {/* Header */}
      <div className="h-9 px-3 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/60 font-bold tracking-wider text-neutral-300">
        <span className="truncate uppercase text-[11px] font-black tracking-widest text-white">
          ASSETS & PROPS EXPLORER
        </span>
        <div className="flex items-center gap-1.5 text-neutral-400">
          <button
            type="button"
            onClick={onRefreshFiles}
            title="Refresh assets"
            className="p-1 hover:text-white cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Grid view"
            className="p-1 hover:text-white cursor-pointer"
          >
            <Grid className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="p-2 border-b border-neutral-800/80 bg-neutral-950">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search..."
          className="w-full bg-neutral-900 border border-neutral-800 px-2 py-1 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-neutral-600 rounded-none transition-none"
        />
      </div>

      {/* Explorer Tree Content */}
      <div className="flex-1 overflow-y-auto divide-y divide-neutral-900 p-1 space-y-2">
        {/* SECTION 1: ASSETS */}
        <div>
          <button
            type="button"
            onClick={() => setAssetsOpen(!assetsOpen)}
            className="w-full flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold text-neutral-400 hover:text-white uppercase tracking-wider text-left cursor-pointer"
          >
            {assetsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <span>Assets ({filteredFiles.length})</span>
          </button>

          {assetsOpen && (
            <div className="pl-3 pr-1 py-1 space-y-0.5">
              {filteredFiles.length === 0 ? (
                <div className="px-2 py-2 text-[10px] text-neutral-600 italic">
                  No media assets found in vault
                </div>
              ) : (
                filteredFiles.map((file) => (
                  <div
                    key={file.id}
                    onClick={() => onSelectMediaFile?.(file)}
                    className="flex items-center justify-between px-2 py-1 hover:bg-neutral-900 cursor-pointer text-neutral-300 group transition-none"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {file.type === "audio" && (
                        <Music className="w-3 h-3 text-emerald-400 shrink-0" />
                      )}
                      {file.type === "video" && (
                        <Video className="w-3 h-3 text-cyan-400 shrink-0" />
                      )}
                      {file.type === "image" && (
                        <ImageIcon className="w-3 h-3 text-purple-400 shrink-0" />
                      )}
                      {file.type === "data" && (
                        <FileText className="w-3 h-3 text-amber-400 shrink-0" />
                      )}
                      <span className="truncate text-[11px]">{file.name}</span>
                    </div>
                    <span className="text-[10px] text-neutral-600 group-hover:text-neutral-400 shrink-0 font-mono">
                      {file.size}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* SECTION 2: DYNAMIC PROPS (Remotion Sliders & Text Inputs) */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setPropsOpen(!propsOpen)}
            className="w-full flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold text-neutral-400 hover:text-white uppercase tracking-wider text-left cursor-pointer"
          >
            {propsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <span>Dynamic Props</span>
          </button>

          {propsOpen && (
            <div className="pl-2 pr-2 py-1 space-y-3">
              {/* Sliders (Matching user mockup aesthetic) */}
              <div className="space-y-2 bg-neutral-900/40 p-2 border border-neutral-900">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-neutral-400">Dynamic prop 1 (Scale)</span>
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

                <div className="flex items-center justify-between text-[10px] pt-1">
                  <span className="text-neutral-400">Dynamic prop 2 (Glow)</span>
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

                <div className="flex items-center justify-between text-[10px] pt-1">
                  <span className="text-neutral-400">Dynamic prop 3 (Backdrop)</span>
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

                <div className="flex items-center justify-between text-[10px] pt-1">
                  <span className="text-neutral-400">Dynamic prop 4 (Audio Vol)</span>
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
        </div>
      </div>
    </aside>
  );
};

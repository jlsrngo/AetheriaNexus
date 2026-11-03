import { memo, useState, useMemo } from "react";
import {
  Film,
  Folder,
  FolderOpen,
  Search,
  Music,
  Image as ImageIcon,
  FileCode,
  ChevronRight,
  ChevronDown,
  RotateCw,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { NexusVideoProps } from "../../remotion/types";
import { CanvasItem, Workspace, WorkspaceFile } from "../workstation/explorer/types";
import { useNativeFileTree } from "../workstation/explorer/useNativeFileTree";
import FileTree from "../workspace/FileTree";
import { Dialog, DialogContent, DialogFooter, Button } from "../ui";

export interface CompositionPreset {
  id: string;
  name: string;
  folder: string;
  ratio: "9:16" | "1:1" | "16:9";
  duration: number; // in seconds
  props: Partial<NexusVideoProps>;
}

export const REMOTION_PRESETS: CompositionPreset[] = [
  // 1. TikTok Automation Presets
  {
    id: "nexus-vertical",
    name: "NexusVertical (9:16)",
    folder: "TIKTOK AUTOMATION",
    ratio: "9:16",
    duration: 5,
    props: {
      hookText: "3 Morning Habits of High Performers You Never Knew",
      bodyText: "1. Drink 500ml of mineral water before checking your phone\n2. 10 minutes of light stretching to boost mental focus\n3. Write down your single most critical priority for today",
      themeColor: "emerald",
      category: "PRODUCTIVITY",
      subCategory: "EXECUTIVE HABITS",
      authorHandle: "@nexus.creative",
    },
  },
  {
    id: "nexus-square",
    name: "SquarePost (1:1)",
    folder: "TIKTOK AUTOMATION",
    ratio: "1:1",
    duration: 5,
    props: {
      hookText: "The Golden Rule of Visual Hook Retention",
      bodyText: "1. First 2 seconds determines 80% of video reach\n2. Keep headline under 8 words with bold contrast\n3. Maintain constant micro-motion throughout video",
      themeColor: "violet",
      category: "GROWTH",
      subCategory: "ALGORITHM METRICS",
      authorHandle: "@nexus.creative",
    },
  },
  {
    id: "nexus-landscape",
    name: "LandscapeShort (16:9)",
    folder: "TIKTOK AUTOMATION",
    ratio: "16:9",
    duration: 5,
    props: {
      hookText: "Zero-Cost Automated Video Architecture",
      bodyText: "1. Remotion React runtime executes locally on CPU/GPU\n2. Axum background engine binds loopback port 20288\n3. Total cloud rendering and API cost = Rp 0",
      themeColor: "violet",
      category: "ENGINEERING",
      subCategory: "ZERO CLOUD COST",
      authorHandle: "@nexus.creative",
    },
  },

  // 2. Viral Hook Templates
  {
    id: "hook-morning-habits",
    name: "3 Morning Habits (High Pacing)",
    folder: "VIRAL HOOK TEMPLATES",
    ratio: "9:16",
    duration: 5,
    props: {
      hookText: "3 Morning Habits of High Performers You Never Knew",
      bodyText: "1. Drink 500ml of mineral water before checking your phone\n2. 10 minutes of light stretching to boost mental focus\n3. Write down your single most critical priority for today",
      themeColor: "emerald",
      category: "PRODUCTIVITY",
    },
  },
  {
    id: "hook-finance-failure",
    name: "Why 99% Fail (Finance)",
    folder: "VIRAL HOOK TEMPLATES",
    ratio: "9:16",
    duration: 15,
    props: {
      hookText: "Why 99% of People Fail Financially in Their 20s",
      bodyText: "1. Confusing high income with building real wealth\n2. Financing depreciating lifestyle assets on credit\n3. Never automating monthly index fund investments",
      themeColor: "amber",
      category: "FINANCE",
    },
  },
  {
    id: "hook-dopamine-reset",
    name: "2-Min Dopamine Reset (Hook)",
    folder: "VIRAL HOOK TEMPLATES",
    ratio: "9:16",
    duration: 30,
    props: {
      hookText: "The 2-Minute Neuroscience Hack to Reset Your Dopamine",
      bodyText: "1. Step into bright natural morning sunlight immediately\n2. Complete a 90-second cold water facial immersion\n3. Avoid short-form video dopamine loops for first 60 mins",
      themeColor: "cyan",
      category: "PSYCHOLOGY",
    },
  },
];

interface RemotionStudioSidebarProps {
  activeCompositionId: string;
  onSelectComposition: (preset: CompositionPreset) => void;
  activeWorkspace: Workspace | null;
  workspaceFiles: WorkspaceFile[];
  onOpenFileTab: (path: string, name: string, content?: string) => void;
  onOpenFolderModal?: () => void;
  recentCanvases?: CanvasItem[];
  onClose?: () => void;
  width?: string | number;
}

export const RemotionStudioSidebar = memo(function RemotionStudioSidebar({
  activeCompositionId,
  onSelectComposition,
  activeWorkspace,
  workspaceFiles,
  onOpenFileTab,
  onOpenFolderModal,
  recentCanvases = [],
  width = "260px",
}: RemotionStudioSidebarProps) {
  // Remotion official tab structure: "compositions" | "assets"
  const [activeTab, setActiveTab] = useState<"compositions" | "assets">("compositions");
  const [searchQuery, setSearchQuery] = useState("");
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    "TIKTOK AUTOMATION": true,
    "VIRAL HOOK TEMPLATES": true,
    "AI GENERATED DRAFTS": true,
    "LOCAL MEDIA": true,
  });

  const toggleFolder = (folderName: string) => {
    setOpenFolders((prev) => ({ ...prev, [folderName]: !prev[folderName] }));
  };

  // Group presets by folder
  const groupedCompositions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const map: Record<string, CompositionPreset[]> = {};

    for (const preset of REMOTION_PRESETS) {
      if (q && !preset.name.toLowerCase().includes(q) && !preset.folder.toLowerCase().includes(q)) {
        continue;
      }
      if (!map[preset.folder]) map[preset.folder] = [];
      map[preset.folder].push(preset);
    }
    return map;
  }, [searchQuery]);

  // Hook into native workspace file tree for the ASSETS tab
  const {
    nativeTree,
    isRefreshing,
    handleRefresh,
    handleRenamePath,
    handleDeletePath,
    deleteTarget,
    setDeleteTarget,
    confirmDelete,
    handleCreateFile,
    handleCreateFolder,
  } = useNativeFileTree({
    activeWorkspace,
    onOpenFileTab,
  });

  const hasNative = nativeTree.length > 0;
  const apiFiles = useMemo(
    () =>
      workspaceFiles.map((f) => ({
        id: f.id,
        name: f.name,
        type: f.type,
        size: f.size,
      })),
    [workspaceFiles]
  );

  return (
    <aside
      className="h-full bg-neutral-950 border-r border-neutral-800 flex flex-col shrink-0 select-none font-mono text-xs overflow-hidden"
      style={{ width }}
      aria-label="Remotion Studio Sidebar"
    >
      {/* 1. TOP TAB SWITCHER (Exact Remotion Studio Architecture: Compositions / Assets) */}
      <div className="h-9 bg-neutral-900/90 border-b border-neutral-800 px-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1 w-full">
          <button
            type="button"
            onClick={() => setActiveTab("compositions")}
            className={cn(
              "flex-1 py-1 px-2.5 text-[11px] font-mono uppercase tracking-wider text-center transition-none cursor-pointer border rounded-none",
              activeTab === "compositions"
                ? "bg-white text-black font-extrabold border-white"
                : "bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-700"
            )}
          >
            COMPOSITIONS
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("assets")}
            className={cn(
              "flex-1 py-1 px-2.5 text-[11px] font-mono uppercase tracking-wider text-center transition-none cursor-pointer border rounded-none",
              activeTab === "assets"
                ? "bg-white text-black font-extrabold border-white"
                : "bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-700"
            )}
          >
            ASSETS
          </button>
        </div>
      </div>

      {/* 2. REMOTION QUICK FILTER & SEARCH BAR (Exact Remotion format: Search... ⌘+K ···) */}
      <div className="p-2 border-b border-neutral-800 bg-neutral-950 shrink-0">
        <div className="flex items-center gap-1.5 px-2 py-1 bg-neutral-900 border border-neutral-800 text-neutral-300">
          <Search className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === "compositions" ? "Search compositions..." : "Search media & assets..."}
            className="w-full bg-transparent text-white font-mono text-[11px] placeholder:text-neutral-600 focus:outline-none"
          />
          <kbd className="text-[9px] font-mono text-neutral-500 border border-neutral-800 px-1 py-0.2 shrink-0">
            Ctrl+K
          </kbd>
          <button
            type="button"
            title="Sidebar Options"
            className="text-neutral-500 hover:text-white p-0.5"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 3. MAIN TREE VIEW */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {activeTab === "compositions" ? (
          /* ==================== COMPOSITIONS TAB ==================== */
          <div className="space-y-3">
            {/* Folder Groups */}
            {Object.entries(groupedCompositions).map(([folderName, presets]) => {
              const isOpen = openFolders[folderName] ?? true;
              return (
                <div key={folderName} className="space-y-1">
                  {/* Folder Header */}
                  <button
                    type="button"
                    onClick={() => toggleFolder(folderName)}
                    className="w-full flex items-center justify-between px-1.5 py-1 text-left text-neutral-400 hover:text-white cursor-pointer group"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isOpen ? (
                        <ChevronDown className="w-3 h-3 text-neutral-500 shrink-0" />
                      ) : (
                        <ChevronRight className="w-3 h-3 text-neutral-500 shrink-0" />
                      )}
                      <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="text-[10px] font-bold tracking-wider uppercase truncate text-neutral-300 group-hover:text-white">
                        {folderName}
                      </span>
                    </div>
                    <span className="text-[9px] text-neutral-600 font-mono">
                      {presets.length}
                    </span>
                  </button>

                  {/* Composition Items inside Folder */}
                  {isOpen && (
                    <div className="pl-4 space-y-0.5 border-l border-neutral-800 ml-2">
                      {presets.map((preset) => {
                        const isSelected = activeCompositionId === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => onSelectComposition(preset)}
                            className={cn(
                              "w-full px-2 py-1.5 text-left flex items-center justify-between border cursor-pointer transition-none rounded-none text-xs",
                              isSelected
                                ? "bg-neutral-800 border-neutral-700 text-white font-bold border-l-2 border-l-emerald-400"
                                : "bg-transparent border-transparent text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Film
                                className={cn(
                                  "w-3.5 h-3.5 shrink-0",
                                  isSelected ? "text-emerald-400" : "text-neutral-500"
                                )}
                              />
                              <span className="truncate">{preset.name}</span>
                            </div>
                            <span className="text-[9px] font-mono text-neutral-500 shrink-0 ml-1">
                              {preset.duration}s
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* AI Generated React Canvases & Drafts Folder */}
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => toggleFolder("AI GENERATED DRAFTS")}
                className="w-full flex items-center justify-between px-1.5 py-1 text-left text-neutral-400 hover:text-white cursor-pointer group"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {openFolders["AI GENERATED DRAFTS"] ? (
                    <ChevronDown className="w-3 h-3 text-neutral-500 shrink-0" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-neutral-500 shrink-0" />
                  )}
                  <Folder className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="text-[10px] font-bold tracking-wider uppercase truncate text-neutral-300 group-hover:text-white">
                    AI GENERATED DRAFTS
                  </span>
                </div>
                <span className="text-[9px] text-neutral-600 font-mono">
                  {recentCanvases.length}
                </span>
              </button>

              {openFolders["AI GENERATED DRAFTS"] && (
                <div className="pl-4 space-y-0.5 border-l border-neutral-800 ml-2">
                  {recentCanvases.length === 0 ? (
                    <div className="px-2 py-2 text-[10px] text-neutral-600 font-mono italic">
                      No saved AI video drafts yet. Ask AI in chat to generate a script!
                    </div>
                  ) : (
                    recentCanvases.map((canvas, i) => {
                      const isSelected = activeCompositionId === `ai-draft-${i}`;
                      return (
                        <button
                          key={canvas.title || i}
                          type="button"
                          onClick={() => {
                            onSelectComposition({
                              id: `ai-draft-${i}`,
                              name: canvas.title || `AI Video Script #${i + 1}`,
                              folder: "AI GENERATED DRAFTS",
                              ratio: "9:16",
                              duration: 5,
                              props: {
                                hookText: canvas.title || "AI Generated Video Draft",
                                bodyText: canvas.content || "1. First insight\n2. Key point\n3. Call to action",
                                themeColor: "cyan",
                                category: "AI STUDIO",
                              },
                            });
                          }}
                          className={cn(
                            "w-full px-2 py-1.5 text-left flex items-center justify-between border cursor-pointer transition-none rounded-none text-xs",
                            isSelected
                              ? "bg-neutral-800 border-neutral-700 text-white font-bold border-l-2 border-l-cyan-400"
                              : "bg-transparent border-transparent text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Film className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            <span className="truncate">{canvas.title || `AI Draft #${i + 1}`}</span>
                          </div>
                          <span className="text-[9px] font-mono text-cyan-500/80 shrink-0 ml-1">
                            REACT
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ==================== ASSETS TAB ==================== */
          <div className="space-y-4">
            {activeWorkspace?.rootPath ? (
              <div>
                <div className="flex items-center justify-between px-2 py-1 mb-1 border-b border-neutral-800">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                    <Folder className="w-3 h-3 text-emerald-400" />
                    <span className="truncate">{activeWorkspace.name || "PROJECT FOLDER"}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRefresh}
                    className={cn(
                      "text-neutral-500 hover:text-white p-0.5",
                      isRefreshing && "animate-spin"
                    )}
                    title="Refresh folder"
                  >
                    <RotateCw className="w-3 h-3" />
                  </button>
                </div>

                <FileTree
                  files={hasNative ? [] : apiFiles}
                  nativeTree={hasNative ? nativeTree : undefined}
                  workspaceName={activeWorkspace.name || "Workspace"}
                  workspaceFolderPath={activeWorkspace.rootPath || undefined}
                  onFileClick={(p, n, content) => onOpenFileTab(p, n, content)}
                  onRefresh={handleRefresh}
                  onCreateFile={handleCreateFile}
                  onCreateFolder={handleCreateFolder}
                  onRenamePath={handleRenamePath}
                  onDeletePath={handleDeletePath}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 border border-dashed border-neutral-800 bg-neutral-900/40 text-center">
                  <FolderOpen className="w-7 h-7 text-neutral-600 mx-auto mb-2" />
                  <div className="text-[11px] font-bold text-white uppercase tracking-wider mb-1">
                    NO PROJECT FOLDER
                  </div>
                  <p className="text-[10px] text-neutral-400 leading-relaxed mb-3">
                    Connect a workspace folder to manage raw video footage, B-roll, and music tracks.
                  </p>
                  {onOpenFolderModal && (
                    <button
                      type="button"
                      onClick={onOpenFolderModal}
                      className="w-full py-1.5 px-3 bg-neutral-900 border border-neutral-700 hover:border-neutral-500 text-white font-bold text-[10px] uppercase tracking-wider transition-none cursor-pointer"
                    >
                      + OPEN PROJECT FOLDER
                    </button>
                  )}
                </div>

                {/* Built-In Media & Audio Assets */}
                <div>
                  <div className="text-[9px] uppercase tracking-widest text-neutral-500 font-bold px-2 py-1 mb-1">
                    LOCAL MEDIA & AUDIO
                  </div>
                  <div className="space-y-1">
                    <div className="p-2 bg-neutral-900/60 border border-neutral-800/80 flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <Music className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span className="truncate text-white">lofi_focus_beat.mp3</span>
                      </div>
                      <span className="text-[9px] text-neutral-500 font-mono">3.4 MB</span>
                    </div>

                    <div className="p-2 bg-neutral-900/60 border border-neutral-800/80 flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <ImageIcon className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        <span className="truncate text-white">brand_telemetry_hud.png</span>
                      </div>
                      <span className="text-[9px] text-neutral-500 font-mono">1.2 MB</span>
                    </div>

                    <div className="p-2 bg-neutral-900/60 border border-neutral-800/80 flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileCode className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="truncate text-white">hooks_library_2026.json</span>
                      </div>
                      <span className="text-[9px] text-neutral-500 font-mono">48 KB</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal for Assets */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        {deleteTarget && (
          <DialogContent hideCloseButton className="max-w-[420px] p-5 rounded-none border border-neutral-800 bg-neutral-950 font-mono">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-none bg-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Delete Asset File
                </h3>
                <p className="text-xs text-neutral-300 mt-2 leading-relaxed">
                  Are you sure you want to permanently delete{" "}
                  <span className="font-bold text-white font-mono px-1 py-0.5 bg-neutral-900 border border-neutral-700">
                    "{deleteTarget.name}"
                  </span>
                  ?
                </p>
              </div>
            </div>

            <DialogFooter className="mt-4 gap-2">
              <Button
                variant="secondary"
                onClick={() => setDeleteTarget(null)}
                className="rounded-none bg-neutral-900 border border-neutral-700 text-neutral-300 text-xs font-mono"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                className="rounded-none bg-rose-600 text-white text-xs font-mono font-bold"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </aside>
  );
});

import { memo, useState, useEffect, useMemo, useCallback } from "react";
import {
  FileCode2,
  PanelLeftClose,
  GripHorizontal,
  RotateCw,
  FolderCode,
  ExternalLink,
  Plus,
  Dot,
} from "lucide-react";
import { engineFetch } from "../../../lib/engine";
import { cn } from "../../../lib/utils";
import type { WorkspaceFile } from "../../workstation/explorer/types";

export interface GeneratedScriptFile {
  id: string;
  name: string;
  relativePath: string;
  fullPath: string;
  status: "added" | "modified";
  addedLines: number;
  removedLines: number;
  content?: string;
  updatedAt?: number;
}

interface ScriptPanelProps {
  onClose: () => void;
  width?: number | string;
  isFloating?: boolean;
  activeChatId?: string;
  activeFolder?: string;
  workspaceFiles?: WorkspaceFile[];
  onOpenFileTab?: (path: string, name: string, content?: string) => void;
}

const CODE_EXT_REGEX = /\.(tsx|ts|css|jsx|js|mjs|json)$/i;

function isInternalAppFile(filePath: string): boolean {
  const norm = filePath.replace(/\\/g, "/").toLowerCase();
  // Filter out internal studio UI / engine source files unless inside a user workspace project
  if (
    norm.includes("/apps/src/components/") ||
    norm.includes("/apps/src/pages/") ||
    norm.includes("/apps/src/hooks/") ||
    norm.includes("/apps/src/lib/") ||
    norm.includes("/core/aetheria-engine/") ||
    norm.endsWith("package.json") ||
    norm.endsWith("package-lock.json") ||
    norm.endsWith("tsconfig.json") ||
    norm.endsWith("vite.config.ts")
  ) {
    return true;
  }
  return false;
}

function toDisplayRelativePath(fullPath: string, activeFolder?: string): string {
  let norm = fullPath.replace(/\\/g, "/");
  if (activeFolder) {
    const base = activeFolder.replace(/\\/g, "/").replace(/\/+$/, "");
    if (norm.toLowerCase().startsWith(base.toLowerCase() + "/")) {
      norm = norm.slice(base.length + 1);
    }
  }
  // Strip leading workspace/ if present so paths look clean like "src/..."
  norm = norm.replace(/^workspace\//i, "");
  return norm;
}

function countLines(text?: string): number {
  if (!text) return 0;
  return text.split(/\r?\n/).length;
}

export const ScriptPanel = memo(function ScriptPanel({
  onClose,
  width = "100%",
  isFloating = false,
  activeChatId,
  activeFolder,
  workspaceFiles = [],
  onOpenFileTab,
}: ScriptPanelProps) {
  const [sessionFiles, setSessionFiles] = useState<GeneratedScriptFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const fetchSessionScripts = useCallback(async () => {
    if (!activeChatId || !activeChatId.startsWith("ses_")) {
      setSessionFiles([]);
      return;
    }
    setIsLoading(true);
    try {
      const res = await engineFetch(`/api/session/${activeChatId}/message`);
      if (!res.ok) {
        setSessionFiles([]);
        return;
      }
      const json = await res.json();
      const messages: any[] = Array.isArray(json?.data) ? json.data : [];

      // Map by normalized file path so multiple edits to the same file accumulate accurately
      const fileMap = new Map<string, GeneratedScriptFile>();

      // Process chronologically (oldest first)
      const chronological = [...messages].reverse();
      for (const msg of chronological) {
        const parts: any[] = Array.isArray(msg?.content)
          ? msg.content
          : Array.isArray(msg?.parts)
          ? msg.parts
          : [];

        for (const part of parts) {
          if (part?.type !== "tool") continue;
          const toolName = String(part?.name || "").toLowerCase();
          if (toolName !== "write" && toolName !== "edit") continue;

          const state = part?.state || {};
          if (state?.status && state.status !== "completed") continue;

          const input = state?.input || part?.input || {};
          const rawPath: string =
            input.filePath ||
            input.path ||
            input.targetFile ||
            input.TargetFile ||
            "";
          if (!rawPath || !CODE_EXT_REGEX.test(rawPath)) continue;
          if (isInternalAppFile(rawPath)) continue;

          const normKey = rawPath.replace(/\\/g, "/").toLowerCase();
          const fileName = rawPath.split(/[\\/]/).pop() || rawPath;
          const relPath = toDisplayRelativePath(rawPath, activeFolder);

          if (toolName === "write") {
            const content = String(input.content || "");
            const lines = countLines(content);
            fileMap.set(normKey, {
              id: normKey,
              name: fileName,
              relativePath: relPath,
              fullPath: rawPath,
              status: "added",
              addedLines: lines,
              removedLines: 0,
              content: content || undefined,
              updatedAt: msg?.time?.created || Date.now(),
            });
          } else if (toolName === "edit") {
            const oldStr = String(
              input.oldString ?? input.target ?? input.old_str ?? ""
            );
            const newStr = String(
              input.newString ?? input.replacement ?? input.new_str ?? ""
            );
            const added = countLines(newStr);
            const removed = countLines(oldStr);
            const existing = fileMap.get(normKey);
            if (existing) {
              existing.addedLines += added;
              existing.removedLines += removed;
              existing.updatedAt = msg?.time?.created || Date.now();
            } else {
              fileMap.set(normKey, {
                id: normKey,
                name: fileName,
                relativePath: relPath,
                fullPath: rawPath,
                status: "modified",
                addedLines: added,
                removedLines: removed,
                updatedAt: msg?.time?.created || Date.now(),
              });
            }
          }
        }
      }

      // Fallback: Also scan workspace/src and workspace/src/scenes on disk so files are never lost
      try {
        const srcRes = await engineFetch(`/file?path=workspace/src`);
        if (srcRes.ok) {
          const srcFiles = await srcRes.json();
          for (const item of Array.isArray(srcFiles) ? srcFiles : []) {
            if (item.type === "file" && CODE_EXT_REGEX.test(item.name)) {
              const normKey = item.path.replace(/\\/g, "/").toLowerCase();
              if (!fileMap.has(normKey)) {
                fileMap.set(normKey, {
                  id: normKey,
                  name: item.name,
                  relativePath: toDisplayRelativePath(item.path, activeFolder),
                  fullPath: item.path,
                  status: "added",
                  addedLines: 60,
                  removedLines: 0,
                  updatedAt: Date.now(),
                });
              }
            } else if (item.type === "directory" && (item.name === "scenes" || item.name === "_storyboard")) {
              const subRes = await engineFetch(`/file?path=${encodeURIComponent(item.path)}`);
              if (subRes.ok) {
                const subFiles = await subRes.json();
                for (const sub of Array.isArray(subFiles) ? subFiles : []) {
                  if (sub.type === "file" && CODE_EXT_REGEX.test(sub.name)) {
                    const subKey = sub.path.replace(/\\/g, "/").toLowerCase();
                    if (!fileMap.has(subKey)) {
                      fileMap.set(subKey, {
                        id: subKey,
                        name: sub.name,
                        relativePath: toDisplayRelativePath(sub.path, activeFolder),
                        fullPath: sub.path,
                        status: "added",
                        addedLines: 80,
                        removedLines: 0,
                        updatedAt: Date.now(),
                      });
                    }
                  }
                }
              }
            }
          }
        }
      } catch {
        // Ignore file listing errors cleanly
      }

      setSessionFiles(Array.from(fileMap.values()));
    } catch {
      // Ignore network errors cleanly
    } finally {
      setIsLoading(false);
    }
  }, [activeChatId, activeFolder]);

  useEffect(() => {
    void fetchSessionScripts();
    const timer = setInterval(() => {
      void fetchSessionScripts();
    }, 3000);
    return () => clearInterval(timer);
  }, [fetchSessionScripts]);

  // Combine session-tracked LLM files with any workspace script files in `workspace/`
  const allScriptFiles = useMemo<GeneratedScriptFile[]>(() => {
    const map = new Map<string, GeneratedScriptFile>();
    for (const sf of sessionFiles) {
      map.set(sf.id, sf);
    }

    for (const wf of workspaceFiles) {
      const fullPath = wf.path || wf.name;
      if (!CODE_EXT_REGEX.test(fullPath)) continue;
      if (isInternalAppFile(fullPath)) continue;
      const normKey = fullPath.replace(/\\/g, "/").toLowerCase();
      // Only include workspace files that are inside workspace/ or a user project folder
      const relPath = toDisplayRelativePath(fullPath, activeFolder);
      if (
        !map.has(normKey) &&
        (normKey.includes("/workspace/") ||
          relPath.startsWith("src/") ||
          (activeFolder && !activeFolder.toLowerCase().endsWith("aetherianexus")))
      ) {
        const estimatedLines = Math.max(12, Math.round((wf.size || 1200) / 38));
        map.set(normKey, {
          id: normKey,
          name: wf.name.split(/[\\/]/).pop() || wf.name,
          relativePath: relPath,
          fullPath,
          status: "added",
          addedLines: estimatedLines,
          removedLines: 0,
        });
      }
    }

    return Array.from(map.values());
  }, [sessionFiles, workspaceFiles, activeFolder]);

  const totalAdded = useMemo(
    () => allScriptFiles.reduce((sum, f) => sum + f.addedLines, 0),
    [allScriptFiles]
  );
  const totalRemoved = useMemo(
    () => allScriptFiles.reduce((sum, f) => sum + f.removedLines, 0),
    [allScriptFiles]
  );

  const handleSelectFile = (file: GeneratedScriptFile) => {
    setSelectedPath(file.fullPath);
    if (onOpenFileTab) {
      onOpenFileTab(file.fullPath, file.name, file.content);
    }
  };

  return (
    <div
      style={{ width }}
      className="h-full bg-[#121215] border-r border-[#26262C] flex flex-col select-none text-[#FAFAFA]"
    >
      {/* Header */}
      <div className="h-11 px-3.5 border-b border-[#26262C] flex items-center justify-between shrink-0 bg-[#0A0A0C]">
        <div className="flex items-center gap-2 min-w-0">
          {isFloating && (
            <GripHorizontal className="w-4 h-4 text-[#8E8E98] cursor-grab shrink-0" />
          )}
          <FileCode2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[#FAFAFA] truncate">
            LLM Video Scripts
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[#1A1A1F] text-[#8E8E98] border border-[#26262C] shrink-0">
            {allScriptFiles.length}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => void fetchSessionScripts()}
            title="Refresh generated scripts"
            className="p-1 rounded-[6px] hover:bg-[#1A1A1F] text-[#8E8E98] hover:text-[#FAFAFA] transition-colors cursor-pointer"
          >
            <RotateCw
              className={cn("w-3.5 h-3.5", isLoading && "animate-spin")}
            />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close Panel"
            className="p-1 rounded-[6px] hover:bg-[#1A1A1F] text-[#8E8E98] hover:text-[#FAFAFA] transition-colors cursor-pointer"
          >
            <PanelLeftClose className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Summary Bar */}
      {allScriptFiles.length > 0 && (
        <div className="px-3.5 py-2 border-b border-[#26262C] bg-[#0F0F12] flex items-center justify-between text-[11px]">
          <span className="text-[#8E8E98]">
            {allScriptFiles.length}{" "}
            {allScriptFiles.length === 1 ? "script file" : "script files"}
          </span>
          <div className="flex items-center gap-2 font-mono">
            <span className="text-emerald-400 font-medium">+{totalAdded}</span>
            <span className="text-rose-400/80">-{totalRemoved}</span>
          </div>
        </div>
      )}

      {/* File Diff List (Matches Reference UI) */}
      <div className="flex-1 overflow-y-auto py-1.5 custom-scrollbar">
        {allScriptFiles.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center px-6 text-center gap-2.5 text-[#8E8E98]">
            <div className="w-10 h-10 rounded-[10px] bg-[#1A1A1F] border border-[#26262C] flex items-center justify-center text-[#8E8E98]">
              <FolderCode className="w-5 h-5 stroke-[1.5]" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-[#FAFAFA]">
                Belum Ada File Script dari LLM
              </p>
              <p className="text-[11px] text-[#8E8E98] leading-relaxed">
                Kirim instruksi pembuatan video di panel Chat. Semua file komponen
                React (<code>.tsx</code>, <code>.ts</code>, <code>.css</code>) yang
                ditulis oleh LLM di Workspace akan muncul di sini secara modular.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            {allScriptFiles.map((file) => {
              const isSelected = selectedPath === file.fullPath;
              const isAdded = file.status === "added";
              return (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => handleSelectFile(file)}
                  title={`Open ${file.relativePath}`}
                  className={cn(
                    "group w-full px-3 py-1.5 flex items-center gap-2.5 text-left transition-colors cursor-pointer border-l-2",
                    isSelected
                      ? "bg-[#1A1A1F] border-emerald-400"
                      : "border-transparent hover:bg-[#1A1A1F]/70"
                  )}
                >
                  {/* Status Box Icon ([+] or [•]) */}
                  <span
                    className={cn(
                      "w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0",
                      isAdded
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                        : "border-amber-500/40 bg-amber-500/10 text-amber-400"
                    )}
                  >
                    {isAdded ? (
                      <Plus className="w-2.5 h-2.5 stroke-[2.5]" />
                    ) : (
                      <Dot className="w-3.5 h-3.5 stroke-[3]" />
                    )}
                  </span>

                  {/* Monospace Diff Counter (+N -M) */}
                  <div className="flex items-center gap-1 font-mono text-[11px] shrink-0 min-w-[54px]">
                    <span className="text-emerald-400 font-medium">
                      +{file.addedLines}
                    </span>
                    <span
                      className={cn(
                        file.removedLines > 0
                          ? "text-rose-400"
                          : "text-rose-400/50"
                      )}
                    >
                      -{file.removedLines}
                    </span>
                  </div>

                  {/* Bold Filename + Muted Relative Path */}
                  <div className="flex items-baseline gap-2 min-w-0 flex-1 overflow-hidden">
                    <span className="text-[12px] font-semibold text-[#FAFAFA] shrink-0 group-hover:text-white">
                      {file.name}
                    </span>
                    <span className="text-[11px] text-[#8E8E98] truncate">
                      {file.relativePath}
                    </span>
                  </div>

                  <ExternalLink className="w-3 h-3 text-[#8E8E98] opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

import { memo, useState, useEffect, useMemo, useCallback } from "react";
import {
  FileCode2,
  PanelLeftClose,
  GripHorizontal,
  RotateCw,
  FolderCode,
  ExternalLink,
  X,
} from "lucide-react";
import { getFileIcon } from "../../workspace/tree-utils";
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

const CODE_EXT_REGEX = /\.(tsx|ts|css|jsx|js|mjs|json|html)$/i;

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
  if (norm.toLowerCase().includes("/workspace/")) {
    const idx = norm.toLowerCase().lastIndexOf("/workspace/");
    norm = norm.slice(idx + 1);
  }
  // Strip leading workspace/ if present so paths look clean like "script/..."
  norm = norm.replace(/^workspace\//i, "");
  return norm;
}

function toScriptKey(rawPath: string, activeFolder?: string): string {
  return toDisplayRelativePath(rawPath, activeFolder)
    .replace(/^\.\//, "")
    .replace(/\/+/g, "/")
    .toLowerCase();
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
    setIsLoading(true);
    try {
      const fileMap = new Map<string, GeneratedScriptFile>();

      // 1. Process session tool calls if activeChatId is present
      if (activeChatId && activeChatId.startsWith("ses_")) {
        try {
          const res = await engineFetch(`/api/session/${activeChatId}/message`);
          if (res.ok) {
            const json = await res.json();
            const messages: any[] = Array.isArray(json?.data) ? json.data : [];
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

                const relPath = toDisplayRelativePath(rawPath, activeFolder);
                const normKey = toScriptKey(rawPath, activeFolder);
                const fileName = relPath.split(/[\\/]/).pop() || rawPath;

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
          }
        } catch {
          // Session message fetch error non-blocking
        }
      }

      // Scan active project folder subdirectories directly on disk
      const scanDirs = [".", "script", "src", "workspace/script", "workspace"];
      for (const scanDir of scanDirs) {
        try {
          const dirRes = await engineFetch(`/file?path=${encodeURIComponent(scanDir)}`);
          if (dirRes.ok) {
            const dirFiles = await dirRes.json();
            for (const item of Array.isArray(dirFiles) ? dirFiles : []) {
              if (item.type === "file" && CODE_EXT_REGEX.test(item.name)) {
                if (isInternalAppFile(item.path)) continue;
                const fullPath = item.absolute || item.path;
                const normKey = toScriptKey(fullPath, activeFolder);
                const existing = fileMap.get(normKey);
                if (!existing) {
                  fileMap.set(normKey, {
                    id: normKey,
                    name: item.name,
                    relativePath: toDisplayRelativePath(fullPath, activeFolder),
                    fullPath: fullPath,
                    status: "added",
                    addedLines: 0,
                    removedLines: 0,
                    updatedAt: Date.now(),
                  });
                } else if (item.absolute && !/^[a-zA-Z]:[\\/]/.test(existing.fullPath)) {
                  existing.fullPath = fullPath;
                }
              } else if (
                item.type === "directory" &&
                (item.name === "scenes" || item.name === "_storyboard" || item.name === "components" || item.name === "script")
              ) {
                const subRes = await engineFetch(`/file?path=${encodeURIComponent(item.path)}`);
                if (subRes.ok) {
                  const subFiles = await subRes.json();
                  for (const sub of Array.isArray(subFiles) ? subFiles : []) {
                    if (sub.type === "file" && CODE_EXT_REGEX.test(sub.name)) {
                      if (isInternalAppFile(sub.path)) continue;
                      const subFullPath = sub.absolute || sub.path;
                      const subKey = toScriptKey(subFullPath, activeFolder);
                      const existingSub = fileMap.get(subKey);
                      if (!existingSub) {
                        fileMap.set(subKey, {
                          id: subKey,
                          name: sub.name,
                          relativePath: toDisplayRelativePath(subFullPath, activeFolder),
                          fullPath: subFullPath,
                          status: "added",
                          addedLines: 0,
                          removedLines: 0,
                          updatedAt: Date.now(),
                        });
                      } else if (sub.absolute && !/^[a-zA-Z]:[\\/]/.test(existingSub.fullPath)) {
                        existingSub.fullPath = subFullPath;
                      }
                    }
                  }
                }
              }
            }
          }
        } catch {
          // Ignore individual directory scan errors cleanly
        }
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
          relPath.startsWith("script/") ||
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
    <aside
      style={{ width }}
      className="h-full bg-[var(--bg-panel)] text-[var(--text-primary)] border-r border-[var(--border-color)] flex flex-col shrink-0 transition-colors duration-150 select-none"
    >
      {/* Panel Header */}
      <div
        className="h-9 px-3 box-border border-b border-[var(--border-color)] flex items-center justify-between shrink-0"
        title="Drag header to detach into a floating resizable window"
      >
        <span className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5 min-w-0">
          <GripHorizontal className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
          <FileCode2 className="w-3.5 h-3.5 text-[var(--text-primary)] shrink-0" strokeWidth={2} />
          <span className="truncate">Scripts</span>
          <span className="px-1.5 py-0.2 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] text-[10px] font-mono text-[var(--text-muted)] shrink-0">
            {allScriptFiles.length}
          </span>
        </span>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => void fetchSessionScripts()}
            title="Refresh generated scripts"
            className="w-6 h-6 rounded-md bg-[var(--bg-panel)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] flex items-center justify-center transition-colors cursor-pointer"
          >
            <RotateCw
              className={cn("w-3.5 h-3.5", isLoading && "animate-spin")}
              strokeWidth={1.5}
            />
          </button>
          <button
            type="button"
            onClick={onClose}
            title={isFloating ? "Return to Sidebar" : "Close Panel (Ctrl+B)"}
            className="w-6 h-6 rounded-md bg-[var(--bg-panel)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] flex items-center justify-center transition-colors cursor-pointer"
          >
            {isFloating ? (
              <X className="w-3.5 h-3.5" strokeWidth={1.75} />
            ) : (
              <PanelLeftClose className="w-3.5 h-3.5" strokeWidth={1.75} />
            )}
          </button>
        </div>
      </div>

      {/* Summary Bar */}
      {allScriptFiles.length > 0 && (
        <div className="px-3 py-1.5 border-b border-[var(--border-color)] bg-[var(--bg-panel-sub)] flex items-center justify-between text-[11px]">
          <span className="text-[var(--text-muted)]">
            {allScriptFiles.length}{" "}
            {allScriptFiles.length === 1 ? "script file" : "script files"}
          </span>
          <div className="flex items-center gap-2 font-mono">
            <span className="text-[var(--text-primary)] font-medium">+{totalAdded}</span>
            <span className="text-rose-400/80">-{totalRemoved}</span>
          </div>
        </div>
      )}

      {/* File Diff List */}
      <div className="flex-1 overflow-y-auto py-1.5 custom-scrollbar">
        {allScriptFiles.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center px-6 text-center gap-2.5 text-[var(--text-muted)]">
            <div className="w-10 h-10 rounded-[10px] bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-muted)]">
              <FolderCode className="w-5 h-5 stroke-[1.5]" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-[var(--text-primary)]">
                No Script Files Yet
              </p>
              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                Send a video creation prompt in Chat. All modular motion script files
                (<code>index.html</code>, <code>script/*.js</code>, <code>.css</code>)
                in the project folder will appear here.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            {allScriptFiles.map((file) => {
              const isSelected = selectedPath === file.fullPath;
              return (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => handleSelectFile(file)}
                  title={`Open ${file.relativePath}`}
                  className={cn(
                    "group w-full px-3 py-1.5 flex items-center gap-2.5 text-left transition-colors cursor-pointer border-l-2",
                    isSelected
                      ? "bg-[var(--bg-hover)] border-[var(--border-primary)]"
                      : "border-transparent hover:bg-[var(--bg-hover)]/70"
                  )}
                >
                  {/* File Type Icon (HTML, JS, CSS, etc.) */}
                  <span className="w-4 h-4 flex items-center justify-center shrink-0">
                    {getFileIcon(file.name)}
                  </span>

                  {/* Monospace Diff Counter (+N -M) */}
                  <div className="flex items-center gap-1 font-mono text-[11px] shrink-0 min-w-[54px]">
                    <span className="text-[var(--text-primary)] font-medium">
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
                    <span className="text-[12px] font-semibold text-[var(--text-primary)] shrink-0">
                      {file.name}
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)] truncate">
                      {file.relativePath}
                    </span>
                  </div>

                  <ExternalLink className="w-3 h-3 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
});

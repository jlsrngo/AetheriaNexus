import { memo, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Clapperboard,
  Copy,
  Film,
  GripHorizontal,
  PanelLeftClose,
  Plus,
  RotateCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useStudioStore } from "../../../hooks/useStudioStore";
import { cn } from "../../../lib/utils";
import type { StudioComposition } from "../../../types/studio";

interface CompositionsPanelProps {
  onClose: () => void;
  width?: number | string;
  isFloating?: boolean;
}

export const CompositionsPanel = memo(function CompositionsPanel({
  onClose,
  width = "100%",
  isFloating = false,
}: CompositionsPanelProps) {
  const { compositions, activeComposition, actions } = useStudioStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRatio, setNewRatio] = useState<"9:16" | "1:1" | "16:9">("9:16");
  const [newDuration, setNewDuration] = useState(5);
  const [newFps, setNewFps] = useState(30);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    void actions.syncFromBackend();
  }, [actions]);

  const grouped = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const staleFolders = new Set(["TIKTOK AUTOMATION", "VIRAL HOOK TEMPLATES", "SOCIAL FORMATS"]);
    const filtered = (
      q
        ? compositions.filter(
            (c) =>
              c.name.toLowerCase().includes(q) ||
              c.id.toLowerCase().includes(q) ||
              c.folder.toLowerCase().includes(q)
          )
        : compositions
    ).filter((c) => !staleFolders.has((c.folder || "").toUpperCase()));

    const map = new Map<string, StudioComposition[]>();
    for (const comp of filtered) {
      const folder = comp.folder || "COMPOSITIONS";
      const list = map.get(folder) ?? [];
      list.push(comp);
      map.set(folder, list);
    }
    return Array.from(map.entries());
  }, [compositions, searchQuery]);

  const handleToggleFolder = (folder: string) => {
    setCollapsedFolders((prev) => ({ ...prev, [folder]: !prev[folder] }));
  };

  const handleCreate = () => {
    if (!newName.trim()) {
      toast.error("Please enter a composition name first");
      return;
    }
    const created = actions.createComposition({
      name: newName.trim(),
      ratio: newRatio,
      duration: newDuration,
      fps: newFps,
    });
    setNewName("");
    setShowNewForm(false);
    toast.success(`Created composition "${created.name}"`);
  };

  const handleSync = async () => {
    setIsSyncing(true);
    await actions.syncFromBackend();
    setIsSyncing(false);
    toast.success("Compositions synced with engine");
  };

  return (
    <aside
      className="bg-[var(--bg-panel)] text-[var(--text-primary)] border-r border-[var(--border-color)] flex flex-col shrink-0 transition-colors duration-150 select-none"
      style={{ width }}
    >
      {/* Panel Header */}
      <div
        className="h-9 px-3 box-border border-b border-[var(--border-color)] flex items-center justify-between shrink-0"
        title="Drag header to detach into a floating resizable window"
      >
        <span className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5 min-w-0">
          <GripHorizontal className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
          <Clapperboard className="w-3.5 h-3.5 text-[var(--text-primary)] shrink-0" strokeWidth={2} />
          <span className="truncate">Compositions</span>
          <span className="px-1.5 py-0.2 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] text-[10px] font-mono text-[var(--text-muted)] shrink-0">
            {compositions.length}
          </span>
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setShowNewForm((prev) => !prev)}
            className="w-6 h-6 rounded-md bg-[var(--bg-panel)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] flex items-center justify-center transition-colors cursor-pointer"
            title="New Composition (Ctrl+N)"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={handleSync}
            className={cn(
              "w-6 h-6 rounded-md bg-[var(--bg-panel)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] flex items-center justify-center transition-colors cursor-pointer",
              isSyncing && "animate-spin"
            )}
            title="Sync Compositions from Engine"
          >
            <RotateCw className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 rounded-md bg-[var(--bg-panel)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] flex items-center justify-center transition-colors cursor-pointer"
            title={isFloating ? "Return to Sidebar" : "Close Panel (Ctrl+B)"}
          >
            {isFloating ? (
              <X className="w-3.5 h-3.5" strokeWidth={1.75} />
            ) : (
              <PanelLeftClose className="w-3.5 h-3.5" strokeWidth={1.75} />
            )}
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-2 border-b border-[var(--border-color)] shrink-0">
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] focus-within:border-[var(--border-strong)]">
          <Search className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search compositions..."
            className="w-full bg-transparent text-xs text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none"
          />
        </div>
      </div>

      {/* Inline New Composition Form */}
      {showNewForm && (
        <div className="p-3 border-b border-[var(--border-color)] bg-[var(--bg-card)] space-y-2.5 shrink-0">
          <div className="text-[11px] font-semibold text-[var(--text-primary)] flex items-center justify-between">
            <span>New Nexus Composition</span>
            <button
              type="button"
              onClick={() => setShowNewForm(false)}
              className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              Cancel
            </button>
          </div>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Composition ID / Name..."
            autoFocus
            className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
          />
          <div className="grid grid-cols-3 gap-1.5">
            {(["9:16", "1:1", "16:9"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setNewRatio(r)}
                className={cn(
                  "py-1 rounded-md text-[11px] font-mono border cursor-pointer transition-colors",
                  newRatio === r
                    ? "bg-[var(--bg-hover)] text-[var(--text-primary)] border-[var(--border-strong)] font-semibold"
                    : "bg-[var(--bg-input)] text-[var(--text-muted)] border-[var(--border-color)] hover:text-[var(--text-primary)]"
                )}
              >
                {r}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-[var(--text-muted)] mb-1">Duration (s)</label>
              <input
                type="number"
                min={1}
                max={180}
                value={newDuration}
                onChange={(e) => setNewDuration(Math.max(1, Number(e.target.value) || 5))}
                className="w-full px-2 py-1 rounded-md bg-[var(--bg-input)] border border-[var(--border-color)] text-xs font-mono text-[var(--text-primary)] outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] text-[var(--text-muted)] mb-1">FPS</label>
              <select
                value={newFps}
                onChange={(e) => setNewFps(Number(e.target.value))}
                className="w-full px-2 py-1 rounded-md bg-[var(--bg-input)] border border-[var(--border-color)] text-xs font-mono text-[var(--text-primary)] outline-none"
              >
                <option value={24}>24 FPS</option>
                <option value={30}>30 FPS</option>
                <option value={60}>60 FPS</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleCreate}
              className="h-7 px-3.5 rounded-lg bg-[#cf6613] hover:bg-[#b8580f] border border-[#e07b27] text-white text-xs font-semibold shrink-0 whitespace-nowrap cursor-pointer transition-colors"
            >
              Create Composition
            </button>
          </div>
        </div>
      )}

      {/* Folder Tree List */}
      <div className="flex-1 overflow-y-auto py-1.5 px-1.5 space-y-2">
        {grouped.map(([folder, items]) => {
          const isCollapsed = !!collapsedFolders[folder];
          return (
            <div key={folder} className="space-y-0.5">
              <button
                type="button"
                onClick={() => handleToggleFolder(folder)}
                className="w-full flex items-center justify-between px-2 py-1 rounded-md text-[11px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]/60 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-1.5 truncate">
                  {isCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                  )}
                  <span className="truncate tracking-wide">{folder}</span>
                </span>
                <span className="text-[10px] font-mono text-[var(--text-dim)]">{items.length}</span>
              </button>

              {!isCollapsed && (
                <div className="space-y-0.5 pl-2">
                  {items.map((comp) => {
                    const isSelected = comp.id === activeComposition.id;
                    return (
                      <div
                        key={comp.id}
                        onClick={() => actions.selectComposition(comp.id)}
                        className={cn(
                          "group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-all border",
                          isSelected
                            ? "bg-[var(--bg-hover)] text-[var(--text-primary)] border-[var(--border-strong)] shadow-xs"
                            : "bg-transparent text-[var(--text-secondary)] border-transparent hover:bg-[var(--bg-hover)]/60 hover:text-[var(--text-primary)]"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Film
                            className={cn(
                              "w-3.5 h-3.5 shrink-0",
                              isSelected ? "text-amber-400" : "text-[var(--text-muted)]"
                            )}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium leading-tight">{comp.name}</div>
                            <div className="flex items-center gap-1.5 text-[10px] font-mono text-[var(--text-muted)] mt-0.5">
                              <span>{comp.ratio}</span>
                              <span>·</span>
                              <span>{comp.duration}s</span>
                              <span>·</span>
                              <span>{comp.fps}fps</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const copy = actions.duplicateComposition(comp.id);
                              if (copy) toast.success(`Duplicated "${copy.name}"`);
                            }}
                            title="Duplicate Composition"
                            className="p-1 rounded hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          {compositions.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                actions.deleteComposition(comp.id);
                                toast.info(`Removed "${comp.name}"`);
                              }}
                              title="Delete Composition"
                              className="p-1 rounded hover:bg-rose-500/20 text-[var(--text-muted)] hover:text-rose-400 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Active Composition Summary Footer */}
      <div className="p-2.5 border-t border-[var(--border-color)] bg-[var(--bg-card)] flex items-center justify-between text-[11px] shrink-0">
        <span className="text-[var(--text-muted)] truncate">Active:</span>
        <span className="font-mono text-[var(--text-primary)] font-medium truncate max-w-[160px]">
          {activeComposition.width}×{activeComposition.height} · {Math.round(activeComposition.duration * activeComposition.fps)}f
        </span>
      </div>
    </aside>
  );
});


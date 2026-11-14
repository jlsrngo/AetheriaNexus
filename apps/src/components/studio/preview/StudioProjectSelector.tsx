import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderPlus, Trash2, Check, X } from "lucide-react";
import {
  createStudioProject,
  deleteStudioProject,
  fetchStudioProjects,
  selectStudioProject,
} from "../../../lib/studioProjects";
import { activeDirectory } from "../../../lib/api";

export interface StudioProjectSelectorProps {
  onProjectChanged: () => void;
}

export const StudioProjectSelector: React.FC<StudioProjectSelectorProps> = ({
  onProjectChanged,
}) => {
  const queryClient = useQueryClient();
  const dir = activeDirectory();
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["studio-projects", dir],
    queryFn: fetchStudioProjects,
    refetchInterval: 4000,
  });

  const projects = data?.projects ?? [];
  const activeProject = data?.activeProject ?? null;
  const hasRootLegacy = data?.hasRootLegacyFilm ?? false;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["studio-projects"] });
    onProjectChanged();
  };

  const handleSelect = async (value: string) => {
    setBusy(true);
    setErrorMsg(null);
    setConfirmDelete(false);
    try {
      await selectStudioProject(value);
      await refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      await createStudioProject(title);
      setNewTitle("");
      setCreating(false);
      await refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!activeProject) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      await deleteStudioProject(activeProject);
      setConfirmDelete(false);
      await refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (creating) {
    return (
      <form onSubmit={handleCreate} className="flex items-center gap-1 shrink-0">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Video title..."
          aria-label="New video project title"
          autoFocus
          disabled={busy}
          className="h-6 w-36 px-2 rounded-[var(--radius-control)] bg-[var(--bg-card)] border border-[var(--border-color)] text-[11px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-amber-400"
        />
        <button
          type="submit"
          disabled={busy || !newTitle.trim()}
          aria-label="Create video project"
          className="h-6 px-1.5 rounded-[var(--radius-control)] bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] hover:border-amber-400 disabled:opacity-40 cursor-pointer"
        >
          <Check className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={() => {
            setCreating(false);
            setNewTitle("");
          }}
          aria-label="Cancel new video project"
          className="h-6 px-1.5 rounded-[var(--radius-control)] bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
        >
          <X className="w-3 h-3" />
        </button>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-1 shrink-0" title={errorMsg ?? undefined}>
      {(projects.length > 0 || hasRootLegacy) && (
        <select
          aria-label="Active video project"
          value={activeProject ?? "__root__"}
          disabled={busy}
          onChange={(e) => void handleSelect(e.target.value)}
          className="h-6 max-w-[160px] px-1.5 rounded-[var(--radius-control)] bg-[var(--bg-card)] border border-[var(--border-color)] text-[10px] text-[var(--text-primary)] focus:outline-none focus:border-amber-400 cursor-pointer truncate"
        >
          {projects.map((proj) => (
            <option key={proj.id} value={proj.id}>
              {proj.title} ({proj.sceneCount}s)
            </option>
          ))}
          {hasRootLegacy && <option value="__root__">Root Workspace</option>}
        </select>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setConfirmDelete(false);
          setCreating(true);
        }}
        aria-label="New video project"
        title="New video project subfolder"
        className="h-6 w-6 flex items-center justify-center rounded-[var(--radius-control)] bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-amber-400 cursor-pointer"
      >
        <FolderPlus className="w-3 h-3" />
      </button>

      {activeProject &&
        (confirmDelete ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleDelete()}
              aria-label="Confirm delete active video project"
              className="h-6 px-1.5 rounded-[var(--radius-control)] bg-rose-500/20 border border-rose-500/60 text-rose-300 text-[10px] font-medium hover:bg-rose-500/30 cursor-pointer"
            >
              Delete
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmDelete(false)}
              aria-label="Cancel delete video project"
              className="h-6 w-6 flex items-center justify-center rounded-[var(--radius-control)] bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmDelete(true)}
            aria-label="Delete active video project"
            title={`Delete projects/${activeProject}`}
            className="h-6 w-6 flex items-center justify-center rounded-[var(--radius-control)] bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-rose-400 hover:border-rose-500/50 cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        ))}

      {errorMsg && (
        <span className="text-[10px] text-rose-400 max-w-[120px] truncate">{errorMsg}</span>
      )}
    </div>
  );
};

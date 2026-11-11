import React, { useCallback, useEffect, useState } from "react";
import { createHtmlFilmComponent, loadWorkspaceHtmlFilm } from "../components/studio/HtmlFilmStage";

export interface LoadedFilmDimensions {
  width: number;
  height: number;
  fps: number;
}

export interface UseStudioFilmLoaderResult {
  workspaceComponent: React.ComponentType<Record<string, unknown>> | null;
  workspaceLoadError: string | null;
  workspaceDuration: number | null;
  workspaceDims: LoadedFilmDimensions | null;
  reloadFilm: () => void;
}

/**
 * Loads the currently open folder's HTML5+JS Motion Film dynamically from the Rust backend
 * and reloads automatically on folder switches, film edits, or window focus.
 */
export function useStudioFilmLoader(activeCompositionId: string): UseStudioFilmLoaderResult {
  const [workspaceComponent, setWorkspaceComponent] = useState<React.ComponentType<
    Record<string, unknown>
  > | null>(null);
  const [workspaceLoadError, setWorkspaceLoadError] = useState<string | null>(null);
  const [workspaceDuration, setWorkspaceDuration] = useState<number | null>(null);
  const [workspaceDims, setWorkspaceDims] = useState<LoadedFilmDimensions | null>(null);
  const [retryCounter, setRetryCounter] = useState(0);

  const reloadFilm = useCallback(() => {
    setRetryCounter((c) => c + 1);
  }, []);

  useEffect(() => {
    window.addEventListener("aetheria-folder-change", reloadFilm);
    window.addEventListener("aetheria-film-updated", reloadFilm);
    window.addEventListener("focus", reloadFilm);
    return () => {
      window.removeEventListener("aetheria-folder-change", reloadFilm);
      window.removeEventListener("aetheria-film-updated", reloadFilm);
      window.removeEventListener("focus", reloadFilm);
    };
  }, [reloadFilm]);

  useEffect(() => {
    let isMounted = true;
    async function loadActiveHtmlFilm() {
      setWorkspaceLoadError(null);
      try {
        const htmlFilm = await loadWorkspaceHtmlFilm();
        if (!isMounted) return;
        if (htmlFilm) {
          const htmlComp = createHtmlFilmComponent(htmlFilm, (runtimeErr) => {
            if (isMounted) setWorkspaceLoadError(runtimeErr);
          });
          setWorkspaceComponent(() => htmlComp);
          setWorkspaceDuration(htmlFilm.totalFrames);
          setWorkspaceDims({
            width: htmlFilm.width,
            height: htmlFilm.height,
            fps: htmlFilm.fps,
          });
          return;
        }
        setWorkspaceComponent(null);
        setWorkspaceDuration(null);
        setWorkspaceDims(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn("[useStudioFilmLoader] Active folder film error caught safely:", err);
        if (isMounted) {
          setWorkspaceLoadError(message);
          setWorkspaceComponent(null);
          setWorkspaceDuration(null);
          setWorkspaceDims(null);
        }
      }
    }
    void loadActiveHtmlFilm();
    return () => {
      isMounted = false;
    };
  }, [activeCompositionId, retryCounter]);

  return {
    workspaceComponent,
    workspaceLoadError,
    workspaceDuration,
    workspaceDims,
    reloadFilm,
  };
}


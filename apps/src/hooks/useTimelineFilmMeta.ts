import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import type { FilmMetaResponse } from "../components/studio/timeline/timelineLayerUtils";

/**
 * Fetches `/studio/film-meta` for the active workspace folder so Timeline tracks
 * reflect dynamic HTML motion scenes whenever workspace contents change.
 */
export function useTimelineFilmMeta(compositionId: string): FilmMetaResponse | null {
  const [activeFilmMeta, setActiveFilmMeta] = useState<FilmMetaResponse | null>(null);

  useEffect(() => {
    let active = true;
    const loadMeta = async () => {
      try {
        const res = await apiFetch("/studio/film-meta");
        if (!res.ok || !active) return;
        const json = (await res.json()) as FilmMetaResponse;
        if (active) setActiveFilmMeta(json);
      } catch {
        if (active) setActiveFilmMeta(null);
      }
    };

    void loadMeta();
    window.addEventListener("aetheria-folder-change", loadMeta);
    window.addEventListener("aetheria-film-updated", loadMeta);
    window.addEventListener("focus", loadMeta);
    return () => {
      active = false;
      window.removeEventListener("aetheria-folder-change", loadMeta);
      window.removeEventListener("aetheria-film-updated", loadMeta);
      window.removeEventListener("focus", loadMeta);
    };
  }, [compositionId]);

  return activeFilmMeta;
}


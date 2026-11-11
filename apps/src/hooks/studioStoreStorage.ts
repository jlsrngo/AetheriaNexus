import { defaultNexusVideoProps } from "../types/video";
import type { StudioComposition } from "../types/studio";

export const STUDIO_STORAGE_KEY = "aetheria_nexus_studio_compositions_v6";

const STALE_FOLDERS = new Set([
  "TIKTOK AUTOMATION",
  "VIRAL HOOK TEMPLATES",
  "SOCIAL FORMATS",
  "AI WORKSPACE",
]);

const STALE_DUMMY_IDS = new Set([
  "LinusTorvalds",
  "RustHistory",
  "TikTokVideo",
  "nexus-vertical",
  "nexus-square",
  "nexus-landscape",
  "hook-morning-habits",
  "hook-finance-failure",
  "hook-dopamine-reset",
  "default",
  "TuringVideo",
  "alan-turing-documentary",
  "turing-video",
  "NexusEditorialVideo",
]);

export const DEFAULT_WORKSPACE_COMPOSITION: StudioComposition = {
  id: "empty-html-stage",
  name: "No HTML Film",
  folder: "ACTIVE PROJECT",
  ratio: "9:16",
  duration: 15,
  fps: 30,
  width: 1080,
  height: 1920,
  props: {
    ...defaultNexusVideoProps,
    hookText: "No HTML Motion Film Loaded",
    bodyText: "",
  },
};

export function isStaleComposition(c: { id: string; folder?: string; name?: string }): boolean {
  if (STALE_DUMMY_IDS.has(c.id)) return true;
  if (c.folder && STALE_FOLDERS.has(c.folder.toUpperCase())) return true;
  const lowerId = (c.id || "").toLowerCase();
  const lowerName = (c.name || "").toLowerCase();
  if (lowerId === "default") return true;
  if (lowerId.includes("turing") || lowerName.includes("turing")) return true;
  return false;
}

export function loadStoredCompositions(): StudioComposition[] {
  if (typeof localStorage === "undefined") return [];
  try {
    localStorage.removeItem("aetheria_nexus_studio_compositions_v5");
    localStorage.removeItem("aetheria_nexus_studio_compositions_v4");
    localStorage.removeItem("aetheria_nexus_studio_compositions_v3");
    localStorage.removeItem("aetheria_nexus_studio_compositions_v2");
    localStorage.removeItem("aetheria_nexus_studio_compositions");
    const raw = localStorage.getItem(STUDIO_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StudioComposition[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        const cleaned = parsed.filter((c) => !isStaleComposition(c));
        localStorage.setItem(STUDIO_STORAGE_KEY, JSON.stringify(cleaned));
        return cleaned;
      }
    }
  } catch {
    // Ignore corrupt localStorage entries
  }
  return [];
}

export function saveStoredCompositions(compositions: StudioComposition[]): void {
  try {
    localStorage.setItem(STUDIO_STORAGE_KEY, JSON.stringify(compositions));
  } catch {
    // Ignore storage quota errors
  }
}


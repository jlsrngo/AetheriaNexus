import { useSyncExternalStore } from "react";
import { API_BASE, apiFetch } from "../lib/api";
import { defaultNexusVideoProps, nexusVideoSpec, type NexusVideoProps } from "../remotion/types";
import type {
  StudioCanvasSettings,
  StudioComposition,
  StudioGpuTelemetry,
  StudioRenderJob,
  StudioStaticAsset,
  StudioSubtitleCue,
} from "../types/studio";

const STORAGE_KEY = "aetheria_nexus_studio_compositions_v2";
const DEFAULT_PROPS_SIG_KEY = "aetheria_nexus_default_props_sig_v2";

const DEFAULT_COMPOSITIONS: StudioComposition[] = [
  {
    id: nexusVideoSpec.id,
    name: "NexusEditorialVideo",
    folder: "TIKTOK AUTOMATION",
    ratio: "9:16",
    duration: nexusVideoSpec.durationInFrames / nexusVideoSpec.fps,
    fps: nexusVideoSpec.fps,
    width: nexusVideoSpec.width,
    height: nexusVideoSpec.height,
    props: { ...defaultNexusVideoProps },
  },
  {
    id: "TikTokVideo",
    name: "TikTokVideo Viral Hook",
    folder: "TIKTOK AUTOMATION",
    ratio: "9:16",
    duration: 5,
    fps: 30,
    width: 1080,
    height: 1920,
    props: {
      hookText: "Why 99% of People Fail Financially in Their 20s",
      bodyText:
        "1. Confusing high income with building real wealth\n2. Financing depreciating lifestyle assets on credit\n3. Never automating monthly index fund investments",
      authorHandle: "@nexus.creative",
      themeColor: "amber",
      category: "FINANCE",
      subCategory: "WEALTH ARCHITECTURE",
      showText: true,
      showBackground: true,
      isMuted: false,
    },
  },
  {
    id: "nexus-square",
    name: "SquarePost (1:1)",
    folder: "SOCIAL FORMATS",
    ratio: "1:1",
    duration: 5,
    fps: 30,
    width: 1080,
    height: 1080,
    props: {
      hookText: "The Golden Rule of Visual Hook Retention",
      bodyText:
        "1. First 2 seconds determines 80% of video reach\n2. Keep headline under 8 words with bold contrast\n3. Maintain constant micro-motion throughout video",
      authorHandle: "@nexus.creative",
      themeColor: "violet",
      category: "GROWTH",
      subCategory: "ALGORITHM METRICS",
      showText: true,
      showBackground: true,
      isMuted: false,
    },
  },
  {
    id: "nexus-landscape",
    name: "LandscapeShort (16:9)",
    folder: "SOCIAL FORMATS",
    ratio: "16:9",
    duration: 5,
    fps: 30,
    width: 1920,
    height: 1080,
    props: {
      hookText: "Zero-Cost Automated Video Architecture",
      bodyText:
        "1. Nexus React runtime executes locally on CPU/GPU\n2. Axum background engine renders native MP4\n3. Total cloud rendering and API cost = Rp 0",
      authorHandle: "@nexus.creative",
      themeColor: "cyan",
      category: "ENGINEERING",
      subCategory: "ZERO CLOUD COST",
      showText: true,
      showBackground: true,
      isMuted: false,
    },
  },
];

const DEFAULT_ASSETS: StudioStaticAsset[] = [
  {
    id: "stock-audio-1",
    name: "lofi_focus_beat.mp3",
    type: "audio",
    size: "3.4 MB",
    bytes: 3565158,
    path: "public/lofi_focus_beat.mp3",
    relativePath: "public/lofi_focus_beat.mp3",
  },
  {
    id: "stock-image-1",
    name: "brand_telemetry_hud.png",
    type: "image",
    size: "1.2 MB",
    bytes: 1258291,
    path: "public/brand_telemetry_hud.png",
    relativePath: "public/brand_telemetry_hud.png",
  },
  {
    id: "stock-data-1",
    name: "hooks_library_2026.json",
    type: "data",
    size: "48 KB",
    bytes: 49152,
    path: "public/hooks_library_2026.json",
    relativePath: "public/hooks_library_2026.json",
  },
];

interface StudioStoreState {
  compositions: StudioComposition[];
  activeCompositionId: string;
  currentFrame: number;
  isPlaying: boolean;
  canvas: StudioCanvasSettings;
  assets: StudioStaticAsset[];
  renderJobs: StudioRenderJob[];
  subtitleCues: StudioSubtitleCue[];
  captionStyle: string;
  gpuTelemetry: StudioGpuTelemetry | null;
  undoStack: NexusVideoProps[];
  redoStack: NexusVideoProps[];
}

function loadInitialCompositions(): StudioComposition[] {
  if (typeof localStorage === "undefined") return DEFAULT_COMPOSITIONS;
  try {
    const currentCodeSig = JSON.stringify(defaultNexusVideoProps);
    const savedCodeSig = localStorage.getItem(DEFAULT_PROPS_SIG_KEY);
    const codeChangedByLlm = savedCodeSig !== currentCodeSig;

    if (codeChangedByLlm) {
      localStorage.setItem(DEFAULT_PROPS_SIG_KEY, currentCodeSig);
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StudioComposition[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        const existingIds = new Set(parsed.map((comp) => comp.id));
        const missingDefaults = DEFAULT_COMPOSITIONS.filter((comp) => !existingIds.has(comp.id));
        const combined = [...missingDefaults, ...parsed];

        if (codeChangedByLlm || missingDefaults.length > 0) {
          const updated = combined.map((comp) =>
            comp.id === nexusVideoSpec.id
              ? { ...comp, props: { ...defaultNexusVideoProps } }
              : comp
          );
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          return updated;
        }
        return combined;
      }
    }
  } catch {}
  return DEFAULT_COMPOSITIONS;
}

let state: StudioStoreState = {
  compositions: loadInitialCompositions(),
  activeCompositionId: nexusVideoSpec.id,
  currentFrame: 0,
  isPlaying: false,
  canvas: {
    zoom: "fit",
    panX: 0,
    panY: 0,
    showMinimap: true,
    showGuides: false,
    showRulers: true,
    showGrid: false,
    gridCols: 3,
    gridRows: 3,
    showCheckerboard: false,
    showTimeline: true,
    loop: true,
    playbackRate: 1,
    inFrame: null,
    outFrame: null,
  },
  assets: DEFAULT_ASSETS,
  renderJobs: [],
  subtitleCues: [],
  captionStyle: "#00F2FE",
  gpuTelemetry: null,
  undoStack: [],
  redoStack: [],
};

const listeners = new Set<() => void>();
let storageTimer: ReturnType<typeof setTimeout> | null = null;
let backendSyncTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  listeners.forEach((l) => l());
  if (storageTimer) clearTimeout(storageTimer);
  storageTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.compositions));
    } catch {}
  }, 250);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): StudioStoreState {
  return state;
}

export const studioActions = {
  selectComposition(id: string) {
    if (!state.compositions.some((c) => c.id === id)) return;
    state = {
      ...state,
      activeCompositionId: id,
      currentFrame: 0,
      undoStack: [],
      redoStack: [],
    };
    emit();
  },

  setCurrentFrame(frame: number) {
    if (state.currentFrame === frame) return;
    state = { ...state, currentFrame: frame };
    listeners.forEach((l) => l());
  },

  setIsPlaying(isPlaying: boolean) {
    if (state.isPlaying === isPlaying) return;
    state = { ...state, isPlaying };
    listeners.forEach((l) => l());
  },

  updateActiveProps(
    partial: Partial<NexusVideoProps>,
    options?: { recordHistory?: boolean; customPrevProps?: NexusVideoProps }
  ) {
    const active =
      state.compositions.find((c) => c.id === state.activeCompositionId) ??
      state.compositions[0];
    if (!active) return;
    const recordHistory = options?.recordHistory ?? true;
    const prevProps = options?.customPrevProps
      ? (JSON.parse(JSON.stringify(options.customPrevProps)) as NexusVideoProps)
      : (JSON.parse(JSON.stringify(active.props)) as NexusVideoProps);
    const nextProps: NexusVideoProps = { ...active.props, ...partial };
    const nextComps = state.compositions.map((c) =>
      c.id === active.id ? { ...c, props: nextProps } : c
    );
    state = {
      ...state,
      compositions: nextComps,
      undoStack: recordHistory
        ? [...state.undoStack.slice(-29), prevProps]
        : state.undoStack,
      redoStack: recordHistory ? [] : state.redoStack,
    };
    emit();

    if (backendSyncTimer) clearTimeout(backendSyncTimer);
    backendSyncTimer = setTimeout(() => {
      void apiFetch(`${API_BASE}/update-default-props`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ compositionId: active.id, props: nextProps }),
      }).catch(() => {});
    }, 300);
  },

  updateActiveMetadata(partial: Partial<Pick<StudioComposition, "name" | "folder" | "ratio" | "duration" | "fps" | "width" | "height">>) {
    const active = state.compositions.find((c) => c.id === state.activeCompositionId) ?? state.compositions[0];
    if (!active) return;
    const nextComps = state.compositions.map((c) =>
      c.id === active.id ? { ...c, ...partial } : c
    );
    state = { ...state, compositions: nextComps };
    emit();
  },

  resetActiveProps() {
    this.updateActiveProps({ ...defaultNexusVideoProps });
  },

  undoProps() {
    if (state.undoStack.length === 0) return;
    const active = state.compositions.find((c) => c.id === state.activeCompositionId);
    if (!active) return;
    const prev = state.undoStack[state.undoStack.length - 1];
    const currentCloned = JSON.parse(JSON.stringify(active.props)) as NexusVideoProps;
    state = {
      ...state,
      compositions: state.compositions.map((c) => (c.id === active.id ? { ...c, props: prev } : c)),
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [currentCloned, ...state.redoStack.slice(0, 29)],
    };
    emit();
  },

  redoProps() {
    if (state.redoStack.length === 0) return;
    const active = state.compositions.find((c) => c.id === state.activeCompositionId);
    if (!active) return;
    const next = state.redoStack[0];
    const currentCloned = JSON.parse(JSON.stringify(active.props)) as NexusVideoProps;
    state = {
      ...state,
      compositions: state.compositions.map((c) => (c.id === active.id ? { ...c, props: next } : c)),
      undoStack: [...state.undoStack, currentCloned],
      redoStack: state.redoStack.slice(1),
    };
    emit();
  },

  createComposition(input: {
    name: string;
    folder?: string;
    ratio?: "9:16" | "1:1" | "16:9";
    duration?: number;
    fps?: number;
  }): StudioComposition {
    const ratio = input.ratio ?? "9:16";
    const dims =
      ratio === "1:1"
        ? { width: 1080, height: 1080 }
        : ratio === "16:9"
        ? { width: 1920, height: 1080 }
        : { width: 1080, height: 1920 };
    const cleanId =
      input.name
        .trim()
        .replace(/[^a-zA-Z0-9_-]+/g, "-")
        .replace(/^-|-$/g, "") || `Comp-${Date.now()}`;
    const uniqueId = state.compositions.some((c) => c.id === cleanId)
      ? `${cleanId}-${Date.now().toString().slice(-4)}`
      : cleanId;

    const created: StudioComposition = {
      id: uniqueId,
      name: input.name.trim() || uniqueId,
      folder: (input.folder || "CUSTOM COMPOSITIONS").toUpperCase(),
      ratio,
      duration: input.duration ?? 5,
      fps: input.fps ?? 30,
      width: dims.width,
      height: dims.height,
      props: { ...defaultNexusVideoProps },
    };

    state = {
      ...state,
      compositions: [...state.compositions, created],
      activeCompositionId: created.id,
      currentFrame: 0,
    };
    emit();
    return created;
  },

  duplicateComposition(id?: string): StudioComposition | null {
    const sourceId = id ?? state.activeCompositionId;
    const source = state.compositions.find((c) => c.id === sourceId);
    if (!source) return null;
    const copyId = `${source.id}-copy-${Date.now().toString().slice(-3)}`;
    const copy: StudioComposition = {
      ...source,
      id: copyId,
      name: `${source.name} (Copy)`,
      props: { ...source.props },
    };
    state = {
      ...state,
      compositions: [...state.compositions, copy],
      activeCompositionId: copy.id,
    };
    emit();
    return copy;
  },

  deleteComposition(id: string) {
    if (state.compositions.length <= 1) return;
    const filtered = state.compositions.filter((c) => c.id !== id);
    const nextActive =
      state.activeCompositionId === id ? filtered[0].id : state.activeCompositionId;
    state = {
      ...state,
      compositions: filtered,
      activeCompositionId: nextActive,
    };
    emit();
  },

  updateCanvas(partial: Partial<StudioCanvasSettings>) {
    state = {
      ...state,
      canvas: { ...state.canvas, ...partial },
    };
    emit();
  },

  setAssets(assets: StudioStaticAsset[]) {
    state = { ...state, assets };
    emit();
  },

  setRenderJobs(renderJobs: StudioRenderJob[]) {
    state = { ...state, renderJobs };
    emit();
  },

  upsertRenderJob(job: StudioRenderJob) {
    const exists = state.renderJobs.some((j) => j.renderId === job.renderId);
    const next = exists
      ? state.renderJobs.map((j) => (j.renderId === job.renderId ? { ...j, ...job } : j))
      : [job, ...state.renderJobs];
    state = { ...state, renderJobs: next };
    emit();
  },

  setSubtitleCues(cues: StudioSubtitleCue[], style?: string) {
    state = {
      ...state,
      subtitleCues: cues,
      captionStyle: style ?? state.captionStyle,
    };
    emit();
  },

  setGpuTelemetry(gpuTelemetry: StudioGpuTelemetry) {
    state = { ...state, gpuTelemetry };
    emit();
  },

  async syncFromBackend() {
    try {
      const res = await apiFetch(`${API_BASE}/get-compositions`);
      if (res.ok) {
        const json = (await res.json()) as { success?: boolean; data?: StudioComposition[] };
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          const merged = [...state.compositions];
          for (const item of json.data) {
            if (!merged.some((m) => m.id === item.id)) {
              merged.push({
                ...item,
                ratio: (item.ratio as "9:16" | "1:1" | "16:9") || "9:16",
                props: { ...defaultNexusVideoProps, ...(item.props || {}) },
              });
            }
          }
          state = { ...state, compositions: merged };
          emit();
        }
      }
    } catch {}

    try {
      const res = await apiFetch(`${API_BASE}/get-static-files`);
      if (res.ok) {
        const json = (await res.json()) as { success?: boolean; data?: StudioStaticAsset[] };
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          state = { ...state, assets: json.data };
          emit();
        }
      }
    } catch {}
  },
};

export function useStudioStore() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const activeComposition =
    snap.compositions.find((c) => c.id === snap.activeCompositionId) ?? snap.compositions[0];
  const durationInFrames = Math.max(15, Math.round(activeComposition.duration * activeComposition.fps));

  return {
    ...snap,
    activeComposition,
    durationInFrames,
    actions: studioActions,
  };
}


import { apiFetch } from "./api";
import { NexusVideoProps } from "../remotion/types";

export interface CompositionPreset {
  id: string;
  name: string;
  folder: string;
  ratio: "9:16" | "1:1" | "16:9";
  duration: number; // in seconds
  fps?: number;
  width?: number;
  height?: number;
  props: Partial<NexusVideoProps>;
}

export interface NexusStaticFile {
  id: string;
  name: string;
  type: "video" | "audio" | "image" | "data";
  size: string;
  bytes: number;
  path: string;
  relativePath: string;
}

export interface RenderJob {
  renderId: string;
  compositionId: string;
  status: "pending" | "rendering" | "done" | "error";
  percent: number;
  renderedFrames: number;
  totalFrames: number;
  outputPath?: string;
  error?: string;
  createdAt: number;
}

export interface RenderMediaPayload {
  compositionId?: string;
  props?: Partial<NexusVideoProps>;
  inputProps?: Partial<NexusVideoProps>;
  outputName?: string;
  ratio?: string;
}

export interface RenderMediaResult {
  success: boolean;
  renderId?: string;
  status?: string;
  outputPath?: string;
  message?: string;
  error?: string;
}

/**
 * Fetch all available compositions and presets from the local Rust Axum engine.
 */
export async function fetchNexusCompositions(): Promise<CompositionPreset[]> {
  try {
    const res = await apiFetch("/api/get-compositions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json.data || json || [];
  } catch (err) {
    console.warn("[nexusStudioBridge] Failed to fetch compositions from Rust engine, using default fallback:", err);
    return [];
  }
}

/**
 * Fetch media assets and static files from the local Rust asset vault.
 */
export async function fetchNexusStaticFiles(): Promise<NexusStaticFile[]> {
  try {
    const res = await apiFetch("/api/get-static-files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json.data || json || [];
  } catch (err) {
    console.warn("[nexusStudioBridge] Failed to fetch static files from Rust engine:", err);
    return [];
  }
}

/**
 * Update active composition props in the Rust backend state.
 */
export async function updateNexusProps(
  compositionId: string,
  props: Partial<NexusVideoProps>
): Promise<boolean> {
  try {
    const res = await apiFetch("/api/update-default-props", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ compositionId, props }),
    });
    return res.ok;
  } catch (err) {
    console.error("[nexusStudioBridge] Error updating props:", err);
    return false;
  }
}

/**
 * Save composition props permanently to ~/.arunaki-nexus/nexus_compositions.json.
 */
export async function saveNexusProps(
  compositionId: string,
  props: Partial<NexusVideoProps>
): Promise<{ success: boolean; savedPath?: string }> {
  try {
    const res = await apiFetch("/api/save-default-props", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ compositionId, props }),
    });
    if (!res.ok) return { success: false };
    const json = await res.json();
    return { success: !!json.success, savedPath: json.savedPath };
  } catch (err) {
    console.error("[nexusStudioBridge] Error saving props:", err);
    return { success: false };
  }
}

/**
 * Trigger local GPU hardware-accelerated video rendering via Rust engine.
 */
export async function renderNexusMedia(
  payload: RenderMediaPayload
): Promise<RenderMediaResult> {
  try {
    const res = await apiFetch("/api/render-media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: errText || `HTTP ${res.status}` };
    }
    const json = await res.json();
    return {
      success: json.success ?? true,
      renderId: json.renderId,
      status: json.status,
      outputPath: json.outputPath,
      message: json.message,
    };
  } catch (err: any) {
    console.error("[nexusStudioBridge] Error rendering media:", err);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Query render job status and progress.
 */
export async function getNexusRenderProgress(
  renderId: string
): Promise<RenderJob | null> {
  try {
    const res = await apiFetch(`/api/render-progress?renderId=${encodeURIComponent(renderId)}`);
    if (!res.ok) return null;
    const json = await res.json();
    return json.data || null;
  } catch (err) {
    console.error("[nexusStudioBridge] Error checking render progress:", err);
    return null;
  }
}

/**
 * Save a static asset file to the workspace.
 */
export async function writeNexusStaticFile(
  path: string,
  data: string
): Promise<{ success: boolean; path?: string }> {
  try {
    const res = await apiFetch("/api/write-static-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, data }),
    });
    if (!res.ok) return { success: false };
    const json = await res.json();
    return { success: !!json.success, path: json.path };
  } catch (err) {
    console.error("[nexusStudioBridge] Error writing file:", err);
    return { success: false };
  }
}

/**
 * Delete a static asset file from the workspace.
 */
export async function deleteNexusStaticFile(path: string): Promise<boolean> {
  try {
    const res = await apiFetch("/api/delete-static-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    return res.ok;
  } catch (err) {
    console.error("[nexusStudioBridge] Error deleting file:", err);
    return false;
  }
}

// ============================================================================
// 1. GPU Hardware Telemetry
// ============================================================================

export interface GpuTelemetry {
  success: boolean;
  encoder: string;
  gpuVendor: string;
  gpuName: string;
  hardwareAccelerated: boolean;
  supportedCodecs: string[];
  memoryMb: number;
}

export async function fetchGpuTelemetry(): Promise<GpuTelemetry | null> {
  try {
    const res = await apiFetch("/api/studio/gpu-telemetry");
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("[nexusStudioBridge] Error querying GPU telemetry:", err);
    return null;
  }
}

// ============================================================================
// 2. High-Retention TikTok Subtitle & Caption Engine
// ============================================================================

export interface SubtitleCue {
  id: string;
  startFrame: number;
  endFrame: number;
  startSec: number;
  endSec: number;
  text: string;
  words: string[];
  highlightKeyword?: string;
  color: string;
  scale: number;
}

export async function generateTikTokSubtitles(
  text: string,
  wpm = 200,
  wordsPerChunk = 3,
  fps = 30
): Promise<{ success: boolean; totalCues: number; cues: SubtitleCue[] }> {
  try {
    const res = await apiFetch("/api/studio/generate-subtitles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, wpm, wordsPerChunk, fps }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("[nexusStudioBridge] Subtitle generation failed:", err);
    return { success: false, totalCues: 0, cues: [] };
  }
}

export async function formatTikTokCaptions(
  cues: SubtitleCue[],
  style = "tiktok-bold"
): Promise<{ success: boolean; cues: SubtitleCue[] }> {
  try {
    const res = await apiFetch("/api/studio/format-captions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cues, style }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("[nexusStudioBridge] Caption formatting failed:", err);
    return { success: false, cues };
  }
}

// ============================================================================
// 3. Media Vault Scanner
// ============================================================================

export async function scanMediaVault(
  path?: string,
  fileTypes?: string[]
): Promise<NexusStaticFile[]> {
  try {
    const res = await apiFetch("/api/studio/scan-media-vault", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, fileTypes }),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.assets || [];
  } catch (err) {
    console.error("[nexusStudioBridge] Media vault scan failed:", err);
    return [];
  }
}

// ============================================================================
// 4. Background Task Scheduler & Posting Queue
// ============================================================================

export interface ScheduledPost {
  id: string;
  title: string;
  videoPath: string;
  caption: string;
  tags: string[];
  platform: string;
  scheduledTime: number;
  status: "scheduled" | "publishing" | "published" | "failed";
  error?: string;
  createdAt: number;
}

export async function fetchScheduledPosts(): Promise<ScheduledPost[]> {
  try {
    const res = await apiFetch("/api/studio/schedule-list");
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch (err) {
    console.error("[nexusStudioBridge] Fetch scheduled posts failed:", err);
    return [];
  }
}

export async function schedulePost(post: {
  title: string;
  videoPath: string;
  caption: string;
  tags?: string[];
  platform?: string;
  scheduledTime: number;
}): Promise<{ success: boolean; data?: ScheduledPost }> {
  try {
    const res = await apiFetch("/api/studio/schedule-post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(post),
    });
    if (!res.ok) return { success: false };
    return await res.json();
  } catch (err) {
    console.error("[nexusStudioBridge] Schedule post failed:", err);
    return { success: false };
  }
}

export async function cancelScheduledPost(id: string): Promise<boolean> {
  try {
    const res = await apiFetch("/api/studio/schedule-cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    return res.ok;
  } catch (err) {
    console.error("[nexusStudioBridge] Cancel scheduled post failed:", err);
    return false;
  }
}

// ============================================================================
// 5. Creative AI Script-to-Composition
// ============================================================================

export async function generateScriptPreset(
  topic: string,
  niche?: string,
  duration?: number,
  themeColor?: string
): Promise<{ success: boolean; composition?: CompositionPreset }> {
  try {
    const res = await apiFetch("/api/studio/generate-script", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, niche, duration, themeColor, autoRegister: true }),
    });
    if (!res.ok) return { success: false };
    return await res.json();
  } catch (err) {
    console.error("[nexusStudioBridge] Generate script preset failed:", err);
    return { success: false };
  }
}


import { type HtmlFilmScene, resolveWorkspaceAssetUrl } from "./htmlStageBundle";

export interface ResolvedAudioTrack {
  scene: HtmlFilmScene;
  src: string;
}

/**
 * Resolves scene audio URLs only once engine media auth has settled so `<audio>`
 * never fires a premature unauthenticated request on startup.
 */
export function resolveSceneAudioTracks(
  scenes: HtmlFilmScene[],
  activeDir: string | null | undefined,
  authSettled: boolean,
  resolveUrl: (
    rawPath: string | null | undefined,
    dir: string | null | undefined
  ) => string | null = resolveWorkspaceAssetUrl
): ResolvedAudioTrack[] {
  if (!authSettled) return [];
  return scenes
    .map((scene) => ({
      scene,
      src: resolveUrl(scene.audio, activeDir),
    }))
    .filter((item): item is ResolvedAudioTrack => Boolean(item.src));
}

/** Clamps a normalized audio volume level cleanly to `[0, 1]`. */
export function clampAudioVolume(volume: number | undefined): number {
  if (typeof volume !== "number" || !Number.isFinite(volume)) return 1;
  return Math.max(0, Math.min(1, Math.round(volume * 100) / 100));
}

/** Resolves the effective `<audio>` volume applied to playback elements. */
export function computeEffectiveAudioVolume(
  volume: number | undefined,
  isMuted: boolean
): number {
  if (isMuted) return 0;
  return clampAudioVolume(volume);
}

/** Converts timeline frame offset within a scene into non-negative playback seconds. */
export function computeAudioTargetSeconds(
  frame: number,
  startFrame: number,
  fps: number
): number {
  const safeFps = Math.max(1, fps);
  return Math.max(0, (frame - startFrame) / safeFps);
}

/** Builds an actionable user-facing error message for `<audio>` load/play failures. */
export function formatAudioErrorMessage(
  audioPath: string | null | undefined,
  mediaErrorCode?: number,
  errorName?: string
): string {
  const label = audioPath || "scene audio";
  if (errorName === "NotAllowedError") {
    return `Audio playback (${label}) was blocked by autoplay policy — click Play again.`;
  }
  switch (mediaErrorCode) {
    case 1:
      return `Audio loading aborted (${label}).`;
    case 2:
      return `Audio network error (${label}) — check engine auth token or file availability.`;
    case 3:
      return `Audio decode error (${label}) — file may be corrupt or unsupported.`;
    case 4:
      return `Audio source unavailable (${label}) — file missing or unauthorized (HTTP 401/404).`;
    default:
      return errorName
        ? `Audio playback failed (${label}): ${errorName}.`
        : `Audio failed to load (${label}).`;
  }
}

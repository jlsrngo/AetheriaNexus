import { type HtmlFilmScene, resolveWorkspaceAssetUrl } from "./htmlStageBundle";

export interface ResolvedAudioTrack {
  scene: HtmlFilmScene;
  src: string;
  kind?: "voice" | "sfx";
  volumeScale?: number;
  trackKey?: string;
}

/**
 * Resolves scene audio and optional SFX URLs only once engine media auth has settled so `<audio>`
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
  const tracks: ResolvedAudioTrack[] = [];
  for (const scene of scenes) {
    if (scene.audio) {
      const voiceSrc = resolveUrl(scene.audio, activeDir);
      if (voiceSrc) {
        tracks.push({
          scene,
          src: voiceSrc,
          kind: "voice",
          volumeScale: 1,
          trackKey: `${scene.id}:voice:${scene.startFrame}`,
        });
      }
    }
    if (scene.sfx) {
      const sfxSrc = resolveUrl(scene.sfx, activeDir);
      if (sfxSrc) {
        tracks.push({
          scene,
          src: sfxSrc,
          kind: "sfx",
          volumeScale: 0.45,
          trackKey: `${scene.id}:sfx:${scene.startFrame}`,
        });
      }
    }
  }
  return tracks;
}

/** Clamps a normalized audio volume level cleanly to `[0, 1]`. */
export function clampAudioVolume(volume: number | undefined): number {
  if (typeof volume !== "number" || !Number.isFinite(volume)) return 1;
  return Math.max(0, Math.min(1, Math.round(volume * 100) / 100));
}

/** Resolves the effective `<audio>` volume using a perceptual curve (`v^2`) so 50% feels like half loudness. */
export function computeEffectiveAudioVolume(
  volume: number | undefined,
  isMuted: boolean,
  volumeScale = 1
): number {
  if (isMuted) return 0;
  const master = clampAudioVolume(volume);
  const scale = typeof volumeScale === "number" && Number.isFinite(volumeScale)
    ? Math.max(0, Math.min(1, volumeScale))
    : 1;
  const perceptual = Math.pow(master, 2) * scale;
  return Math.max(0, Math.min(1, Math.round(perceptual * 1000) / 1000));
}

/** Returns true when the scene clock has already reached or passed the audio clip's end. */
export function isAudioTrackFinished(targetSec: number, duration: number): boolean {
  return Number.isFinite(duration) && duration > 0 && targetSec >= duration - 0.02;
}

/** Determines whether `<audio>.currentTime` has drifted enough to warrant a seek. */
export function shouldResyncAudioTime(
  currentTime: number,
  targetSec: number,
  isPlaying: boolean,
  isElementPaused: boolean
): boolean {
  const tolerance = isPlaying && !isElementPaused ? 0.08 : 0.03;
  return Math.abs(currentTime - targetSec) > tolerance;
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

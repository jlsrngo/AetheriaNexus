import type { HtmlFilmScene } from "../HtmlFilmStage";
import type { FilmMetaResponse } from "../timeline/timelineLayerUtils";

/** Identifies modular HTML/JS motion compositions vs legacy Remotion preset templates. */
export function isHtmlMotionComposition(compositionId?: string | null): boolean {
  return compositionId === "HtmlMotionFilm" || compositionId === "empty-html-stage";
}

/** Formats duration in seconds cleanly for compact monospace readouts. */
export function formatDurationSeconds(seconds?: number): string {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) {
    return "0s";
  }
  const rounded = Math.round(seconds * 100) / 100;
  return Number.isInteger(rounded) ? `${rounded}s` : `${rounded.toFixed(2)}s`;
}

/** Clamps inspector duration input to a valid range supporting multi-minute motion films. */
export function sanitizeDurationInput(rawValue: unknown, maxSeconds = 600): number {
  const num = Number(rawValue);
  if (!Number.isFinite(num) || num <= 0) {
    return 5;
  }
  return Math.max(1, Math.min(maxSeconds, Math.round(num * 100) / 100));
}

/** Finds the active HTML film scene containing `frame`, or the nearest prior scene. */
export function resolveSceneAtFrame(
  scenes: HtmlFilmScene[] | undefined,
  frame: number,
): { scene: HtmlFilmScene; index: number } | null {
  if (!scenes || scenes.length === 0) {
    return null;
  }
  for (let i = 0; i < scenes.length; i += 1) {
    const s = scenes[i];
    const endFrame = s.startFrame + Math.max(1, s.durationFrames);
    if (frame >= s.startFrame && frame < endFrame) {
      return { scene: s, index: i };
    }
  }
  if (frame >= scenes[scenes.length - 1].startFrame) {
    return { scene: scenes[scenes.length - 1], index: scenes.length - 1 };
  }
  return { scene: scenes[0], index: 0 };
}

/** Returns short display filename for an audio track path like `/audio/scene1.wav`. */
export function formatAudioTrackLabel(audioPath?: string | null): string {
  if (!audioPath) return "No audio track";
  const parts = audioPath.split("/").filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : audioPath;
}

/** Summarizes static film readiness checks reported by the Rust motion linter. */
export function summarizeFilmReadiness(filmMeta: FilmMetaResponse | null): {
  status: "ready" | "warning" | "empty";
  label: string;
} {
  if (!filmMeta || !filmMeta.exists) {
    return { status: "empty", label: "No HTML film loaded" };
  }
  if (!filmMeta.lint) {
    return { status: "ready", label: "HTML5 Motion Film" };
  }
  if (filmMeta.lint.valid) {
    return { status: "ready", label: "Engine checks passed" };
  }
  const errorCount = filmMeta.lint.issues.filter((i) => i.severity === "error").length;
  if (errorCount > 0) {
    return { status: "warning", label: `${errorCount} lint error${errorCount > 1 ? "s" : ""}` };
  }
  return { status: "ready", label: `${filmMeta.lint.issues.length} lint note(s)` };
}

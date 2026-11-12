import { describe, expect, it } from "vitest";
import {
  formatAudioTrackLabel,
  formatDurationSeconds,
  isHtmlMotionComposition,
  resolveSceneAtFrame,
  sanitizeDurationInput,
  summarizeFilmReadiness,
} from "./htmlFilmInspectorUtils";

describe("htmlFilmInspectorUtils", () => {
  it("identifies modular HTML motion compositions vs Remotion presets", () => {
    expect(isHtmlMotionComposition("HtmlMotionFilm")).toBe(true);
    expect(isHtmlMotionComposition("empty-html-stage")).toBe(true);
    expect(isHtmlMotionComposition("NexusEditorialShort")).toBe(false);
    expect(isHtmlMotionComposition(undefined)).toBe(false);
  });

  it("supports multi-minute HTML film durations without clipping to 60s", () => {
    expect(sanitizeDurationInput("97.77")).toBe(97.77);
    expect(sanitizeDurationInput(180)).toBe(180);
    expect(sanitizeDurationInput(9999)).toBe(600);
    expect(sanitizeDurationInput("0")).toBe(5);
    expect(formatDurationSeconds(97.766)).toBe("97.77s");
  });

  it("resolves active scene synchronized with timeline playhead frame", () => {
    const scenes = [
      { id: "scene1", title: "Selamat Datang", start: 0, duration: 22.8, startFrame: 0, durationFrames: 684, audio: "/audio/s1.wav" },
      { id: "scene2", title: "Pohon Ajaib", start: 22.8, duration: 15.9, startFrame: 684, durationFrames: 477, audio: "/audio/s2.wav" },
      { id: "scene5", title: "Selamat & Berkah", start: 76.93, duration: 20.84, startFrame: 2308, durationFrames: 625, audio: "/audio/s5.wav" },
    ];
    expect(resolveSceneAtFrame(scenes, 2537)?.scene.id).toBe("scene5");
    expect(resolveSceneAtFrame(scenes, 2537)?.index).toBe(2);
    expect(resolveSceneAtFrame(scenes, 684)?.scene.id).toBe("scene2");
    expect(resolveSceneAtFrame([], 100)).toBeNull();
  });

  it("formats audio track filenames and summarizes lint readiness", () => {
    expect(formatAudioTrackLabel("/audio/scene1_narration.wav")).toBe("scene1_narration.wav");
    expect(formatAudioTrackLabel(undefined)).toBe("No audio track");

    expect(summarizeFilmReadiness(null).status).toBe("empty");
    expect(
      summarizeFilmReadiness({
        exists: true,
        lint: { valid: true, hasFilmMeta: true, hasReadyFlag: true, hasRenderAt: true, issues: [] },
      }).status,
    ).toBe("ready");
    expect(
      summarizeFilmReadiness({
        exists: true,
        lint: {
          valid: false,
          hasFilmMeta: true,
          hasReadyFlag: false,
          hasRenderAt: true,
          issues: [{ severity: "error", code: "MISSING_READY", message: "Missing __ready" }],
        },
      }),
    ).toEqual({ status: "warning", label: "1 lint error" });
  });
});

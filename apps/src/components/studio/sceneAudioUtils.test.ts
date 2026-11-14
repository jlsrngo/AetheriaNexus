import { describe, expect, it, vi } from "vitest";
import type { HtmlFilmScene } from "./htmlStageBundle";
import { appendEngineAuthToken } from "../../lib/api";
import {
  clampAudioVolume,
  computeAudioTargetSeconds,
  computeEffectiveAudioVolume,
  formatAudioErrorMessage,
  resolveSceneAudioTracks,
} from "./sceneAudioUtils";

function makeScene(overrides: Partial<HtmlFilmScene> = {}): HtmlFilmScene {
  return {
    id: "scene1_hook",
    title: "Hook",
    start: 0,
    duration: 5,
    startFrame: 0,
    durationFrames: 150,
    audio: "audio/scene1.wav",
    ...overrides,
  };
}

describe("sceneAudioUtils", () => {
  it("defers audio track resolution until engine media auth has settled", () => {
    const resolver = vi.fn(() => "/api/studio/ws-asset/audio/scene1.wav?auth_token=abc");
    const scenes = [makeScene()];

    expect(resolveSceneAudioTracks(scenes, "E:/Work", false, resolver)).toEqual([]);
    expect(resolver).not.toHaveBeenCalled();

    const settled = resolveSceneAudioTracks(scenes, "E:/Work", true, resolver);
    expect(settled).toHaveLength(1);
    expect(settled[0]?.src).toBe("/api/studio/ws-asset/audio/scene1.wav?auth_token=abc");
    expect(resolver).toHaveBeenCalledWith("audio/scene1.wav", "E:/Work");
  });

  it("filters out scenes without resolvable audio URLs", () => {
    const scenes = [
      makeScene({ id: "s1", audio: "audio/scene1.wav" }),
      makeScene({ id: "s2", audio: undefined }),
    ];
    const resolved = resolveSceneAudioTracks(scenes, "E:/Work", true, (raw) =>
      raw ? `/ws/${raw}` : null
    );
    expect(resolved.map((r) => r.scene.id)).toEqual(["s1"]);
  });

  it("resolves both voice and sfx tracks for a scene when sfx is specified", () => {
    const scenes = [
      makeScene({
        id: "s1",
        audio: "audio/scene1.wav",
        sfx: "audio/sfx_wind.wav",
      }),
    ];
    const resolved = resolveSceneAudioTracks(scenes, "E:/Work", true, (raw) =>
      raw ? `/ws/${raw}` : null
    );
    expect(resolved).toHaveLength(2);
    expect(resolved[0]?.kind).toBe("voice");
    expect(resolved[0]?.volumeScale).toBe(1);
    expect(resolved[1]?.kind).toBe("sfx");
    expect(resolved[1]?.volumeScale).toBe(0.45);
  });

  it("computes clamped playback target seconds safely", () => {
    expect(computeAudioTargetSeconds(60, 0, 30)).toBe(2);
    expect(computeAudioTargetSeconds(10, 30, 30)).toBe(0);
    expect(computeAudioTargetSeconds(30, 0, 0)).toBe(30);
  });

  it("formats actionable error messages for media errors and autoplay blocks", () => {
    expect(formatAudioErrorMessage("audio/scene1.wav", 4)).toContain("HTTP 401/404");
    expect(formatAudioErrorMessage("audio/scene2.wav", 2)).toContain("network error");
    expect(formatAudioErrorMessage("audio/scene3.wav", undefined, "NotAllowedError")).toContain(
      "autoplay policy"
    );
  });

  it("serializes query auth_token as URL-safe unpadded base64 without %3D", () => {
    vi.stubGlobal("aetheriaDesktop", {
      credentials: () => ({
        engineUrl: "http://127.0.0.1:4196",
        user: "e2e",
        password: "oV-vDRM8wssFaQvl",
      }),
    });
    const out = appendEngineAuthToken("/api/studio/ws-asset/audio/scene1.wav");
    expect(out).toBe("/api/studio/ws-asset/audio/scene1.wav?auth_token=ZTJlOm9WLXZEUk04d3NzRmFRdmw");
    expect(out).not.toContain("%3D");
    vi.unstubAllGlobals();
  });

  it("clamps volume levels to [0, 1] and zeroes output when muted", () => {
    expect(clampAudioVolume(undefined)).toBe(1);
    expect(clampAudioVolume(Number.NaN)).toBe(1);
    expect(clampAudioVolume(-0.4)).toBe(0);
    expect(clampAudioVolume(1.6)).toBe(1);
    expect(clampAudioVolume(0.375)).toBe(0.38);

    expect(computeEffectiveAudioVolume(0.65, false)).toBe(0.65);
    expect(computeEffectiveAudioVolume(0.65, true)).toBe(0);
  });
});

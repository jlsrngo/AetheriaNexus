import { describe, it, expect } from "vitest";
import {
  prepareInjectedHtml,
  resolveWorkspaceAssetUrl,
  type HtmlFilmDescriptor,
} from "./HtmlFilmStage";

describe("HtmlFilmStage utilities", () => {
  it("resolves workspace-relative audio and image URLs with active directory isolation", () => {
    const url = resolveWorkspaceAssetUrl("/audio/scene1.wav", "D:/Projects/MyVideo");
    expect(url).toBe(
      "/api/studio/ws-asset/audio/scene1.wav?directory=D%3A%2FProjects%2FMyVideo"
    );

    expect(resolveWorkspaceAssetUrl("https://example.com/clip.mp4")).toBe(
      "https://example.com/clip.mp4"
    );
  });

  it("injects runtime asset shim and ordered inline scripts while stripping duplicate external script tags", () => {
    const film: HtmlFilmDescriptor = {
      exists: true,
      activeDir: "D:/Projects/MyVideo",
      filmRoot: "D:/Projects/MyVideo",
      title: "Custom Film",
      width: 1080,
      height: 1920,
      fps: 30,
      duration: 10,
      totalFrames: 300,
      scenes: [],
      rawHtml:
        '<!DOCTYPE html><html><head><script src="/script/scene1.js"></script></head><body><canvas id="c"></canvas></body></html>',
      scripts: [
        {
          name: "scene1.js",
          relativePath: "script/scene1.js",
          code: "window.__sceneLoaded = true;",
        },
      ],
    };

    const html = prepareInjectedHtml(film);
    expect(html).not.toContain('src="/script/scene1.js"');
    expect(html).toContain("window.__resolveAssetUrl");
    expect(html).toContain('data-script="scene1.js"');
    expect(html).toContain("window.__sceneLoaded = true;");
  });
});


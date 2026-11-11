import { describe, expect, it } from "vitest";
import {
  classifyTabPreview,
  getFileExtension,
  isDirectMediaExtension,
  resolveTabMediaUrl,
  toWorkspaceRelativePath,
} from "./fileMediaUtils";

describe("fileMediaUtils", () => {
  it("classifies audio, image, video, svg, pdf, binary, and code files accurately", () => {
    expect(classifyTabPreview({ title: "scene1.wav" })).toBe("audio");
    expect(classifyTabPreview({ title: "music.mp3" })).toBe("audio");
    expect(classifyTabPreview({ title: "christmas_party.jpg" })).toBe("image");
    expect(classifyTabPreview({ title: "photo.WEBP" })).toBe("image");
    expect(classifyTabPreview({ title: "render.mp4" })).toBe("video");
    expect(classifyTabPreview({ title: "logo.svg" })).toBe("svg");
    expect(classifyTabPreview({ title: "brief.pdf", id: "file-brief.pdf" })).toBe("pdf");
    expect(classifyTabPreview({ title: "PdfCraft", id: "app-pdfcraft-1", fileType: "pdf" })).toBe("text");
    expect(classifyTabPreview({ title: "archive.zip", encoding: "base64" })).toBe("binary");
    expect(classifyTabPreview({ title: "scene1.js" })).toBe("text");
    expect(classifyTabPreview({ title: "index.html" })).toBe("text");
  });

  it("identifies direct media extensions without reading raw bytes as UTF-8", () => {
    expect(isDirectMediaExtension(getFileExtension("audio/scene1.wav"))).toBe(true);
    expect(isDirectMediaExtension(getFileExtension("img/hero.png"))).toBe(true);
    expect(isDirectMediaExtension(getFileExtension("output/final.mp4"))).toBe(true);
    expect(isDirectMediaExtension(getFileExtension("script/scene1.js"))).toBe(false);
  });

  it("converts Windows absolute paths inside activeFolder to workspace-relative asset paths", () => {
    expect(
      toWorkspaceRelativePath(
        "E:\\JS\\Aetheria-Workspace\\audio\\scene1.wav",
        "E:\\JS\\Aetheria-Workspace"
      )
    ).toBe("audio/scene1.wav");
    expect(toWorkspaceRelativePath("img/christmas_party.jpg", "E:/JS/Aetheria-Workspace")).toBe(
      "img/christmas_party.jpg"
    );
    expect(
      toWorkspaceRelativePath("D:\\OtherFolder\\secret.png", "E:\\JS\\Aetheria-Workspace")
    ).toBeNull();
  });

  it("resolves workspace streaming URLs and falls back to data URLs for external base64 binaries", () => {
    expect(
      resolveTabMediaUrl({
        path: "E:\\JS\\Aetheria-Workspace\\img\\christmas_party.jpg",
        activeFolder: "E:\\JS\\Aetheria-Workspace",
      })
    ).toContain("/studio/ws-asset/img/christmas_party.jpg?directory=E%3A%2FJS%2FAetheria-Workspace");

    expect(
      resolveTabMediaUrl({
        path: "D:\\Outside\\pic.jpg",
        title: "pic.jpg",
        encoding: "base64",
        content: "AAAA",
        activeFolder: "E:\\JS\\Aetheria-Workspace",
      })
    ).toBe("data:image/jpeg;base64,AAAA");
  });
});


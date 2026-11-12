import { describe, expect, it } from "vitest";
import { defaultNexusVideoProps } from "../types/video";
import type { StudioComposition } from "../types/studio";
import { applyCompositionMutation, mergeBackendCompositions } from "./studioStoreSync";

const FALLBACK: StudioComposition = {
  id: "HtmlMotionFilm",
  name: "Fallback Film",
  folder: "WORKSPACE",
  ratio: "9:16",
  duration: 15,
  fps: 30,
  width: 1080,
  height: 1920,
  props: { ...defaultNexusVideoProps, hookText: "Default Hook" },
};

function makeComp(id: string, hookText: string): StudioComposition {
  return {
    ...FALLBACK,
    id,
    name: id,
    props: { ...defaultNexusVideoProps, hookText },
  };
}

describe("studioStoreSync", () => {
  it("materializes fallback composition on mutation when store started empty (P0-06)", () => {
    const result = applyCompositionMutation([], "HtmlMotionFilm", FALLBACK, (target) => ({
      ...target,
      props: { ...target.props, hookText: "Edited on Empty Storage" },
    }));

    expect(result.mutatedId).toBe("HtmlMotionFilm");
    expect(result.compositions).toHaveLength(1);
    expect(result.compositions[0].props.hookText).toBe("Edited on Empty Storage");
  });

  it("keeps all backend compositions instead of dropping non-first items (P0-07)", () => {
    const remote = [makeComp("CompA", "Hook A"), makeComp("CompB", "Hook B")];
    const merged = mergeBackendCompositions({
      local: [],
      backend: remote,
      dirtyIds: new Set(),
      activeCompositionId: "CompB",
    });

    expect(merged.compositions.map((c) => c.id)).toEqual(["CompA", "CompB"]);
    expect(merged.activeCompositionId).toBe("CompB");
  });

  it("does not overwrite dirty unsaved local edits when focus triggers backend sync (P0-07)", () => {
    const dirtyLocal = makeComp("CompA", "Unsaved User Edit");
    const cleanLocal = makeComp("CompB", "Old B");
    const remote = [makeComp("CompA", "Stale Server A"), makeComp("CompB", "Fresh Server B")];

    const merged = mergeBackendCompositions({
      local: [dirtyLocal, cleanLocal],
      backend: remote,
      dirtyIds: new Set(["CompA"]),
      activeCompositionId: "CompA",
    });

    expect(merged.compositions.find((c) => c.id === "CompA")?.props.hookText).toBe(
      "Unsaved User Edit",
    );
    expect(merged.compositions.find((c) => c.id === "CompB")?.props.hookText).toBe(
      "Fresh Server B",
    );
  });

  it("preserves unsaved dirty local compositions even if absent from backend scan", () => {
    const dirtyNew = makeComp("CustomLocal", "Draft");
    const remote = [makeComp("CompA", "Server A")];

    const merged = mergeBackendCompositions({
      local: [dirtyNew],
      backend: remote,
      dirtyIds: new Set(["CustomLocal"]),
      activeCompositionId: "CustomLocal",
    });

    expect(merged.compositions.map((c) => c.id)).toEqual(["CompA", "CustomLocal"]);
    expect(merged.activeCompositionId).toBe("CustomLocal");
  });

  it("preserves persisted fallback edits across reload when dirtyIds is empty and backend returns empty (P0-06)", () => {
    const persistedFallback: StudioComposition = {
      ...FALLBACK,
      ratio: "16:9",
      width: 1920,
      height: 1080,
      duration: 25,
      fps: 60,
    };

    const merged = mergeBackendCompositions({
      local: [persistedFallback],
      backend: [],
      dirtyIds: new Set(),
      activeCompositionId: persistedFallback.id,
    });

    expect(merged.compositions).toHaveLength(1);
    expect(merged.compositions[0].ratio).toBe("16:9");
    expect(merged.compositions[0].duration).toBe(25);
    expect(merged.compositions[0].fps).toBe(60);
  });
});


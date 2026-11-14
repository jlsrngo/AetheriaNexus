import { describe, expect, it } from "vitest";
import {
  createQueuedPromptItem,
  formatQueuedPromptLabel,
  insertBeforeStreamingAssistant,
} from "./queuedPrompts";
import type { Message } from "./types";

describe("queuedPrompts helpers", () => {
  it("preserves attached files alongside prompt text", () => {
    const file = { name: "ref.png", uri: "data:image/png;base64,AAA", mime: "image/png" };
    const item = createQueuedPromptItem("  buat gini visualnya bisa ga?  ", [file]);
    expect(item).toEqual({
      text: "buat gini visualnya bisa ga?",
      files: [file],
    });
    expect(item?.files).not.toBeUndefined();
  });

  it("queues attachment-only messages when prompt text is empty", () => {
    const file = { name: "style.png", uri: "data:image/png;base64,BBB", mime: "image/png" };
    const item = createQueuedPromptItem("", [file]);
    expect(item).toEqual({
      text: "",
      files: [file],
    });
    expect(formatQueuedPromptLabel(item!)).toBe("style.png");
  });

  it("returns null when both prompt text and attachments are empty", () => {
    expect(createQueuedPromptItem("   ", [])).toBeNull();
    expect(createQueuedPromptItem(undefined, undefined)).toBeNull();
  });

  it("inserts an injected mid-turn user message before the active trailing assistant bubble", () => {
    const u1: Message = { id: "u1", role: "user", content: "first", createdAt: "t1" };
    const a1: Message = { id: "a1", role: "assistant", content: "streaming...", createdAt: "t2" };
    const steer: Message = { id: "u2", role: "user", content: "inject now", createdAt: "t3" };
    expect(insertBeforeStreamingAssistant([u1, a1], steer).map((m) => m.id)).toEqual([
      "u1",
      "u2",
      "a1",
    ]);
  });
});

import { describe, expect, it } from "vitest";
import {
  markPasteEventOnce,
  shouldProbeDesktopClipboardImage,
} from "./clipboardPasteUtils";

describe("clipboardPasteUtils", () => {
  it("claims each native paste event only once across bubbling listeners", () => {
    const seen = new WeakSet<Event>();
    const evt = new Event("paste", { bubbles: true });
    expect(markPasteEventOnce(seen, evt)).toBe(true);
    expect(markPasteEventOnce(seen, evt)).toBe(false);
  });

  it("skips native desktop probe when web clipboard already extracted files or plain text", () => {
    expect(shouldProbeDesktopClipboardImage({ types: ["image/png"] }, 1)).toBe(false);
    expect(shouldProbeDesktopClipboardImage({ types: ["text/plain"] }, 0)).toBe(false);
    expect(shouldProbeDesktopClipboardImage({ types: ["image/png"] }, 0)).toBe(true);
    expect(shouldProbeDesktopClipboardImage({ types: [] }, 0)).toBe(true);
    expect(shouldProbeDesktopClipboardImage(null, 0)).toBe(true);
  });
});

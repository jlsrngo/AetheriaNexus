import { describe, expect, it } from "vitest";
import {
  getDistanceFromBottom,
  isNearChatBottom,
  resolveChatScrollState,
  shouldAutoScrollChat,
} from "./chatScrollUtils";

describe("chatScrollUtils", () => {
  it("computes non-negative distance from bottom", () => {
    expect(
      getDistanceFromBottom({ scrollHeight: 1000, scrollTop: 500, clientHeight: 400 })
    ).toBe(100);
    expect(
      getDistanceFromBottom({ scrollHeight: 300, scrollTop: 0, clientHeight: 400 })
    ).toBe(0);
  });

  it("unpins when user scrolls upward beyond threshold", () => {
    expect(
      isNearChatBottom({ scrollHeight: 2000, scrollTop: 1550, clientHeight: 400 })
    ).toBe(true);
    expect(
      isNearChatBottom({ scrollHeight: 2000, scrollTop: 1400, clientHeight: 400 })
    ).toBe(false);
  });

  it("does not snap back down on idle polling or updates when scrolled up", () => {
    expect(
      shouldAutoScrollChat({
        distanceFromBottom: 420,
        isPinnedToBottom: false,
        forceScroll: false,
      })
    ).toBe(false);
  });

  it("auto-scrolls when pinned to bottom or explicitly forced", () => {
    expect(
      shouldAutoScrollChat({
        distanceFromBottom: 40,
        isPinnedToBottom: true,
        forceScroll: false,
      })
    ).toBe(true);
    expect(
      shouldAutoScrollChat({
        distanceFromBottom: 900,
        isPinnedToBottom: false,
        forceScroll: true,
      })
    ).toBe(true);
  });

  it("stays pinned when message growth increases scrollHeight without upward user scroll, and unpins on upward scroll", () => {
    const pinnedAfterGrowth = resolveChatScrollState(
      { isPinned: true, scrollTop: 1550, scrollHeight: 2000 },
      { scrollHeight: 3200, scrollTop: 1550, clientHeight: 450 }
    );
    expect(pinnedAfterGrowth.isPinned).toBe(true);

    const unpinnedAfterScrollUp = resolveChatScrollState(
      pinnedAfterGrowth,
      { scrollHeight: 3200, scrollTop: 900, clientHeight: 450 }
    );
    expect(unpinnedAfterScrollUp.isPinned).toBe(false);
  });
});

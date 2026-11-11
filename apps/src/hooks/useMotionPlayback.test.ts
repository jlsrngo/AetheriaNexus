import { describe, it, expect } from "vitest";
import { clampFrameRange } from "./useMotionPlayback";

describe("useMotionPlayback clampFrameRange", () => {
  it("clamps negative and overflow frames to valid total bounds", () => {
    expect(clampFrameRange(-10, 120)).toEqual({
      clamped: 0,
      minFrame: 0,
      maxFrame: 119,
    });

    expect(clampFrameRange(500, 120)).toEqual({
      clamped: 119,
      minFrame: 0,
      maxFrame: 119,
    });
  });

  it("respects custom inFrame and outFrame loop range", () => {
    expect(clampFrameRange(5, 300, 30, 90)).toEqual({
      clamped: 30,
      minFrame: 30,
      maxFrame: 90,
    });

    expect(clampFrameRange(150, 300, 30, 90)).toEqual({
      clamped: 90,
      minFrame: 30,
      maxFrame: 90,
    });
  });
});


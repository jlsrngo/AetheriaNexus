import { describe, expect, it } from "vitest";
import { formatToolStepLabel } from "./LiveExecutionBadge";

describe("LiveExecutionBadge formatToolStepLabel", () => {
  it("formats delegated specialist task calls clearly instead of generic Executing task", () => {
    expect(
      formatToolStepLabel(
        "task",
        { subagent_type: "audio-director", description: "Produce voiceover narration" },
        false,
      ),
    ).toBe("Delegating to Audio Producer: Produce voiceover narration");

    expect(
      formatToolStepLabel(
        "task",
        { subagent_type: "motion-designer", description: "Build 5 Three.js scenes" },
        true,
      ),
    ).toBe("Delegated to Motion Engineer: Build 5 Three.js scenes");
  });
});


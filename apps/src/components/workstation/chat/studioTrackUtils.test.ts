import { describe, expect, it } from "vitest";
import type { StepItem } from "../LiveExecutionBadge";
import {
  applySubagentEventToTracks,
  deriveStudioColumns,
  resolveSubagentDisplayTitle,
  shouldShowStudioColumns,
} from "./studioTrackUtils";

describe("studioTrackUtils", () => {
  it("tracks parallel audio-director and motion-designer subagent lifecycle", () => {
    let tracks = applySubagentEventToTracks([], {
      type: "subagent_started",
      data: {
        subagentSessionId: "sub_audio_1",
        subagentType: "audio-director",
        description: "Synthesize 5 scene WAVs",
        timestamp: 1000,
      },
    });
    tracks = applySubagentEventToTracks(tracks, {
      type: "subagent_started",
      data: {
        subagentSessionId: "sub_motion_1",
        subagentType: "motion-designer",
        description: "Write scene1..scene5 Three.js scripts",
        timestamp: 1005,
      },
    });
    tracks = applySubagentEventToTracks(tracks, {
      type: "subagent_tool_called",
      data: {
        subagentSessionId: "sub_audio_1",
        subagentType: "audio-director",
        callID: "c1",
        tool: "voicebox_speak",
        label: "Synthesizing voiceover: scene1.wav",
      },
    });
    tracks = applySubagentEventToTracks(tracks, {
      type: "subagent_tool_completed",
      data: {
        subagentSessionId: "sub_audio_1",
        subagentType: "audio-director",
        callID: "c1",
        tool: "voicebox_speak",
        label: "Synthesized voiceover: scene1.wav",
        ok: true,
      },
    });

    const cols = deriveStudioColumns(
      [{ id: "t0", label: "Updated studio production plan", status: "completed", iconType: "tool", toolName: "todowrite" }],
      tracks,
    );

    expect(cols).toHaveLength(3);
    expect(cols[0].role).toBe("director");
    expect(cols[0].status).toBe("completed");
    expect(cols[1].role).toBe("audio");
    expect(cols[1].sourceLabel).toBe("Subagent");
    expect(cols[1].status).toBe("running");
    expect(cols[1].entries[0].label).toBe("Synthesized voiceover: scene1.wav");
    expect(cols[2].role).toBe("script");
    expect(cols[2].sourceLabel).toBe("Subagent");
    expect(cols[2].status).toBe("running");
  });

  it("hides studio 3-column board for ordinary Q&A steps", () => {
    const plainSteps: StepItem[] = [
      { id: "1", label: "Read README.md", status: "completed", iconType: "tool", toolName: "read_file" },
    ];
    expect(shouldShowStudioColumns(plainSteps, [])).toBe(false);

    const studioSteps: StepItem[] = [
      { id: "2", label: "Delegated to Audio Producer: Voiceover", status: "completed", iconType: "tool", toolName: "task" },
    ];
    expect(shouldShowStudioColumns(studioSteps, [])).toBe(true);
    expect(resolveSubagentDisplayTitle("qa-verifier")).toBe("QA Verifier");
  });
});


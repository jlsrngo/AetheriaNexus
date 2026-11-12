import { describe, expect, it } from "vitest";
import { mapEngineEvent } from "./engine";

describe("mapEngineEvent subagent telemetry", () => {
  it("forwards subagent events scoped via parentSessionId to the active session", () => {
    const started = mapEngineEvent(
      {
        type: "subagent.started",
        data: {
          parentSessionId: "ses_main_1",
          subagentSessionId: "sub_audio_9",
          subagentType: "audio-director",
          description: "Generate scene voiceovers",
        },
      },
      "ses_main_1",
    );
    expect(started).toEqual({
      type: "subagent_started",
      data: {
        parentSessionId: "ses_main_1",
        subagentSessionId: "sub_audio_9",
        subagentType: "audio-director",
        description: "Generate scene voiceovers",
      },
    });

    const toolDone = mapEngineEvent(
      {
        type: "subagent.tool.completed",
        data: {
          parentSessionId: "ses_main_1",
          subagentSessionId: "sub_audio_9",
          subagentType: "audio-director",
          callID: "call_1",
          tool: "voicebox_speak",
          label: "Synthesized voiceover: scene1.wav",
          ok: true,
        },
      },
      "ses_main_1",
    );
    expect(toolDone?.type).toBe("subagent_tool_completed");
  });

  it("drops subagent events belonging to a different parent session", () => {
    const ignored = mapEngineEvent(
      {
        type: "subagent.started",
        data: {
          parentSessionId: "ses_other",
          subagentSessionId: "sub_audio_9",
          subagentType: "audio-director",
        },
      },
      "ses_main_1",
    );
    expect(ignored).toBeNull();
  });
});


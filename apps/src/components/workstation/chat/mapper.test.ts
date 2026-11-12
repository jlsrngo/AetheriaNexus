import { describe, expect, it } from "vitest";
import { mapEngineMessages } from "./mapper";

describe("mapEngineMessages", () => {
  it("maps synthetic subagent completion notifications into structured notice messages without XML leakage", () => {
    const mapped = mapEngineMessages([
      {
        id: "syn-1",
        type: "synthetic",
        role: "user",
        text: '<subagent-notification sessionID="sub_audio_1" type="audio-director" state="completed" description="Generate scene 1 audio">\n<subagent sessionID="sub_audio_1" type="audio-director" state="completed">Done</subagent>\n</subagent-notification>',
        time: { created: 1700000000000 },
      },
    ]);

    expect(mapped).toHaveLength(1);
    expect(mapped[0].agent).toBe("subagent-notice");
    expect(mapped[0].content).toBe("Audio Producer selesai · Generate scene 1 audio");
    expect(mapped[0].notice?.kind).toBe("subagent");
    expect(mapped[0].notice?.notices).toHaveLength(1);
    expect(mapped[0].notice?.notices[0].sessionId).toBe("sub_audio_1");
  });
});


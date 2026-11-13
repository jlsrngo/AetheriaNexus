import { describe, expect, it } from "vitest";
import type { StepItem } from "../LiveExecutionBadge";
import type { SessionJobRecord, SubagentTrackState } from "./types";
import {
  applySubagentEventToTracks,
  deriveStudioColumns,
  partitionSubagentTracks,
  reconcileTracksWithJobs,
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
    expect(cols.map((c) => c.title)).toEqual(["delegating", "audio", "script"]);
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
    const partialCols = deriveStudioColumns(studioSteps, []);
    expect(partialCols[2].role).toBe("script");
    expect(partialCols[2].status).toBe("idle");
    expect(partialCols[2].sourceLabel).toBe("Idle");
    expect(resolveSubagentDisplayTitle("qa-verifier")).toBe("QA Verifier");
  });

  it("transitions subagent tracks cleanly between standby, running, and completed states", () => {
    let tracks = applySubagentEventToTracks([], {
      type: "subagent_started",
      data: {
        subagentSessionId: "sub_m1",
        subagentType: "motion-designer",
        description: "Build scene 1",
        timestamp: 2000,
      },
    });
    tracks = applySubagentEventToTracks(tracks, {
      type: "subagent_tool_called",
      data: {
        subagentSessionId: "sub_m1",
        subagentType: "motion-designer",
        callID: "standby-sub_m1",
        tool: "standby",
        label: "Menunggu giliran API (standby)...",
      },
    });

    expect(tracks[0].status).toBe("standby");
    expect(tracks[0].standbyLabel).toBe("Menunggu giliran API (standby)...");

    const colsStandby = deriveStudioColumns([], tracks);
    expect(colsStandby[2].status).toBe("standby");
    expect(colsStandby[2].sourceLabel).toBe("Standby");

    tracks = applySubagentEventToTracks(tracks, {
      type: "subagent_tool_completed",
      data: {
        subagentSessionId: "sub_m1",
        subagentType: "motion-designer",
        callID: "standby-sub_m1",
        tool: "standby",
        label: "Slot API tersedia, melanjutkan eksekusi",
        ok: true,
      },
    });
    expect(tracks[0].status).toBe("running");
    expect(tracks[0].standbyLabel).toBeUndefined();
  });

  it("reconciles /jobs persistence with live tracks and partitions active vs standby", () => {
    const sseTracks = applySubagentEventToTracks([], {
      type: "subagent_started",
      data: {
        subagentSessionId: "sub_a1",
        subagentType: "audio-director",
        description: "Scene 1 voice",
        timestamp: 100,
      },
    });
    const jobs: SessionJobRecord[] = [
      {
        id: "job_1",
        parent_session_id: "sess_1",
        child_session_id: "sub_a1",
        subagent_type: "audio-director",
        description: "Scene 1 voice",
        status: "running",
        created_at: 100,
        updated_at: 110,
      },
      {
        id: "job_2",
        parent_session_id: "sess_1",
        child_session_id: "sub_m2",
        subagent_type: "motion-designer",
        description: "Scene 2 HTML",
        status: "standby",
        created_at: 105,
        updated_at: 115,
      },
    ];

    const merged = reconcileTracksWithJobs(sseTracks, jobs);
    const parts = partitionSubagentTracks(merged);
    expect(parts.active).toHaveLength(1);
    expect(parts.standby).toHaveLength(1);
    expect(parts.liveCount).toBe(2);
    expect(parts.standby[0].standbyLabel).toContain("Standby");
  });

  it("reconciles Rust camelCase JobRecord payloads to recover missed initial SSE tracks", () => {
    // Simulates subagent 1 starting before /api/event SSE connected while 2..5 arrived over SSE.
    let sseTracks: SubagentTrackState[] = [];
    for (const num of [2, 3, 4, 5]) {
      sseTracks = applySubagentEventToTracks(sseTracks, {
        type: "subagent_started",
        data: {
          subagentSessionId: `sub_burst_${num}`,
          subagentType: num % 2 === 0 ? "audio-director" : "explore",
          description: `Burst subagent ${num}`,
          timestamp: 100 + num,
        },
      });
    }
    sseTracks = applySubagentEventToTracks(sseTracks, {
      type: "subagent_tool_called",
      data: {
        subagentSessionId: "sub_burst_5",
        subagentType: "explore",
        callID: "subagent_standby",
        tool: "standby",
        label: "Standby: waiting",
      },
    });

    const engineJobs: SessionJobRecord[] = [
      {
        id: "sub_burst_1",
        sessionId: "sess_burst",
        childSessionId: "sub_burst_1",
        kind: "subagent",
        subagentType: "explore",
        description: "Burst subagent 1",
        status: "running",
        standby: false,
        createdAt: 101,
        updatedAt: 101,
      },
      {
        id: "sub_burst_2",
        sessionId: "sess_burst",
        childSessionId: "sub_burst_2",
        kind: "subagent",
        subagentType: "audio-director",
        description: "Burst subagent 2",
        status: "running",
        standby: false,
        createdAt: 102,
        updatedAt: 102,
      },
      {
        id: "sub_burst_5",
        sessionId: "sess_burst",
        childSessionId: "sub_burst_5",
        kind: "subagent",
        subagentType: "explore",
        description: "Burst subagent 5",
        status: "running",
        standby: true,
        createdAt: 105,
        updatedAt: 106,
      },
      {
        id: "sub_burst_err",
        sessionId: "sess_burst",
        childSessionId: "sub_burst_err",
        kind: "subagent",
        subagentType: "explore",
        description: "Errored subagent",
        status: "error",
        standby: false,
        createdAt: 107,
        updatedAt: 108,
      },
    ];

    const merged = reconcileTracksWithJobs(sseTracks, engineJobs);
    const parts = partitionSubagentTracks(merged);
    expect(parts.active).toHaveLength(4);
    expect(parts.standby).toHaveLength(1);
    expect(parts.failed).toHaveLength(1);
    expect(merged[0].sessionId).toBe("sub_burst_1");
    expect(merged[0].title).toBe("Research Assistant");
  });
});


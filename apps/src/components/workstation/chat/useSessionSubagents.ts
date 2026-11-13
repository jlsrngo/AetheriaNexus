import { useEffect, useMemo, useState } from "react";
import { useQuery, type QueryClient } from "@tanstack/react-query";
import { getSessionJobs, mapEngineEvent, subscribeEvents } from "../../../lib/engine";
import type { SessionJobRecord, SubagentTrackState } from "./types";
import {
  applySubagentEventToTracks,
  partitionSubagentTracks,
  reconcileTracksWithJobs,
} from "./studioTrackUtils";

interface UseSessionSubagentsOptions {
  activeChatId: string;
  activeFolder?: string;
  isStreaming?: boolean;
  queryClient: QueryClient;
  onSubagentSettled?: () => void;
}

/**
 * Keeps live subagent running + standby telemetry alive for the entire lifetime of `activeChatId`,
 * independent of per-prompt HTTP request aborts, backed by TanStack Query `/api/session/:id/jobs`.
 */
export function useSessionSubagents({
  activeChatId,
  activeFolder,
  isStreaming = false,
  queryClient,
  onSubagentSettled,
}: UseSessionSubagentsOptions): SubagentTrackState[] {
  const [sseTracksBySession, setSseTracksBySession] = useState<
    Record<string, SubagentTrackState[]>
  >({});

  const sseTracks = activeChatId ? sseTracksBySession[activeChatId] ?? [] : [];
  const { liveCount } = partitionSubagentTracks(sseTracks);

  const { data: persistedJobs = [] } = useQuery<SessionJobRecord[]>({
    queryKey: ["session-jobs", activeChatId, activeFolder || ""],
    queryFn: () => getSessionJobs(activeChatId, activeFolder || undefined),
    enabled: Boolean(activeChatId),
    refetchInterval: () => (liveCount > 0 || isStreaming ? 600 : false),
  });

  useEffect(() => {
    if (!activeChatId) return;

    const abortCtrl = new AbortController();
    const jobQueryKey = ["session-jobs", activeChatId, activeFolder || ""];

    const subCtrl = subscribeEvents(
      (rawEvent) => {
        if (abortCtrl.signal.aborted) return;
        const event = mapEngineEvent(rawEvent, activeChatId);
        if (!event) return;

        if (
          event.type === "subagent_started" ||
          event.type === "subagent_tool_called" ||
          event.type === "subagent_tool_completed" ||
          event.type === "subagent_completed"
        ) {
          const payload = (event.data ?? {}) as Record<string, unknown>;
          setSseTracksBySession((prev) => ({
            ...prev,
            [activeChatId]: applySubagentEventToTracks(prev[activeChatId] ?? [], {
              type: event.type,
              data: payload,
            }),
          }));

          if (
            event.type === "subagent_started" ||
            event.type === "subagent_tool_called" ||
            event.type === "subagent_completed"
          ) {
            queryClient.invalidateQueries({ queryKey: jobQueryKey });
          }

          if (event.type === "subagent_completed") {
            queryClient.invalidateQueries({ queryKey: ["chat-messages", activeChatId] });
            onSubagentSettled?.();
          }
        } else if (event.type === "done") {
          queryClient.invalidateQueries({ queryKey: jobQueryKey });
        }
      },
      abortCtrl.signal,
      activeFolder || undefined,
    );

    return () => {
      abortCtrl.abort();
      try {
        subCtrl.abort();
      } catch {}
    };
  }, [activeChatId, activeFolder, queryClient, onSubagentSettled]);

  return useMemo(
    () => reconcileTracksWithJobs(sseTracks, persistedJobs),
    [sseTracks, persistedJobs],
  );
}

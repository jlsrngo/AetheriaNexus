import { StepItem } from "../LiveExecutionBadge";

export interface QuestionOption {
  label: string;
  description?: string;
}

export interface QuestionInfo {
  header?: string;
  question: string;
  options: QuestionOption[];
  multiple?: boolean;
  custom?: boolean;
}

export interface QuestionData {
  id: string; // requestID
  sessionID: string;
  questions: QuestionInfo[];
  selectedAnswer?: string | string[];
  answered?: boolean;
}

export type MessagePart =
  | { type: "thought"; text: string; durationSec?: number; durationMs?: number }
  | { type: "text"; text: string }
  | { type: "tool"; step: StepItem }
  | { type: "question"; data: QuestionData };

export interface MessageFileAttachment {
  name?: string;
  uri: string;
  mime?: string;
  description?: string;
}

export type StudioColumnRole = "director" | "audio" | "script";

export interface SubagentTrackStep {
  id: string;
  label: string;
  status: "standby" | "running" | "completed" | "failed";
  toolName: string;
}

export interface SubagentTrackState {
  sessionId: string;
  subagentType: string;
  role: StudioColumnRole;
  title: string;
  description?: string;
  status: "standby" | "running" | "completed" | "failed";
  standbyLabel?: string;
  tools: SubagentTrackStep[];
  startedAt?: number;
  completedAt?: number;
}

export interface SubagentNoticeItem {
  sessionId?: string;
  childSessionId?: string;
  subagentType: string;
  state: "completed" | "error" | "failed" | "incomplete" | string;
  description?: string;
  remainingStandby?: number;
}

export interface SubagentNoticeMeta {
  kind: "subagent";
  notices: SubagentNoticeItem[];
}

export interface SessionJobRecord {
  id: string;
  parent_session_id: string;
  child_session_id: string;
  subagent_type: string;
  description: string;
  status: "queued" | "standby" | "running" | "completed" | "failed" | "cancelled";
  created_at: number;
  updated_at: number;
  result_summary?: string | null;
  error?: string | null;
}

export interface TokenUsage {
  input: number;
  output: number;
  reasoning: number;
  cache: {
    read: number;
    write: number;
  };
}

export type FinishReason =
  | "stop"
  | "length"
  | "tool-calls"
  | "content-filter"
  | "unknown";

export interface SessionErrorInfo {
  type?: string;
  category?: string;
  message: string;
  retryable?: boolean;
  status?: number | null;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  agent?: string;
  content: string;
  createdAt?: string;
  finish?: FinishReason | string | null;
  tokens?: TokenUsage | null;
  cost?: number | null;
  error?: SessionErrorInfo | null;
  executionSteps?: StepItem[];
  subagentTracks?: SubagentTrackState[];
  notice?: SubagentNoticeMeta;
  thoughtSec?: number;
  thoughtMs?: number;
  metadata?: string | Record<string, any>;
  reasoning?: string;
  parts?: MessagePart[];
  question?: QuestionData;
  files?: MessageFileAttachment[];
  summary?: boolean;
}

export interface AttachedImage {
  id: string;
  name: string;
  url: string;
  dataUrl: string;
  mime: string;
}

export interface WorkspaceFile {
  id: string;
  name: string;
  path: string;
  type: string;
  size: number;
}

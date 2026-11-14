import type { Message } from "./types";

export interface QueuedFileAttachment {
  name: string;
  uri: string;
  mime?: string;
}

export interface QueuedPromptItem {
  text: string;
  files?: QueuedFileAttachment[];
}

export function createQueuedPromptItem(
  text?: string,
  files?: QueuedFileAttachment[]
): QueuedPromptItem | null {
  const trimmedText = (text ?? "").trim();
  const normalizedFiles = files && files.length > 0 ? [...files] : undefined;
  if (!trimmedText && !normalizedFiles) {
    return null;
  }
  return normalizedFiles
    ? { text: trimmedText, files: normalizedFiles }
    : { text: trimmedText };
}

export function formatQueuedPromptLabel(item: QueuedPromptItem): string {
  if (item.text) return item.text;
  const count = item.files?.length ?? 0;
  if (count === 1) return item.files![0]?.name || "1 attached file";
  if (count > 1) return `${count} attached files`;
  return "Queued message";
}

/**
 * Inserts an optimistic mid-turn user message before the active trailing assistant bubble
 * so the conversation stays chronologically ordered while streaming continues.
 */
export function insertBeforeStreamingAssistant(
  messages: Message[],
  injectedUserMsg: Message
): Message[] {
  const last = messages[messages.length - 1];
  if (last && last.role === "assistant") {
    return [...messages.slice(0, -1), injectedUserMsg, last];
  }
  return [...messages, injectedUserMsg];
}

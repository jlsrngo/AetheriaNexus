import { memo } from "react";
import { Clock, Paperclip, X, Zap } from "lucide-react";
import { formatQueuedPromptLabel, type QueuedPromptItem } from "./queuedPrompts";

interface ChatQueuedPromptsProps {
  queuedPrompts: QueuedPromptItem[];
  onRemoveQueuedPrompt?: (index: number) => void;
  onInjectQueuedPrompt?: (index: number) => void;
}

export const ChatQueuedPrompts = memo(function ChatQueuedPrompts({
  queuedPrompts,
  onRemoveQueuedPrompt,
  onInjectQueuedPrompt,
}: ChatQueuedPromptsProps) {
  if (queuedPrompts.length === 0) return null;

  return (
    <div className="mb-2 px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl flex flex-col gap-1.5 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] font-mono">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-[var(--text-primary)] animate-pulse" />
          <span className="font-semibold text-[var(--text-primary)]">
            Message Queue ({queuedPrompts.length})
          </span>
        </div>
        <span className="text-[10px] text-[var(--text-dim)]">Auto-processing</span>
      </div>
      {queuedPrompts.map((promptItem, idx) => {
        const attachmentCount = promptItem.files?.length ?? 0;
        return (
          <div
            key={idx}
            className="flex items-center justify-between gap-2 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg px-2.5 py-1 text-xs text-[var(--text-primary)]"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="truncate max-w-[160px] font-mono text-[11px]">
                {formatQueuedPromptLabel(promptItem)}
              </span>
              {attachmentCount > 0 && (
                <span className="inline-flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-color)] text-[10px] font-mono text-[var(--text-secondary)]">
                  <Paperclip className="w-2.5 h-2.5" />
                  {attachmentCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {onInjectQueuedPrompt && (
                <button
                  type="button"
                  onClick={() => onInjectQueuedPrompt(idx)}
                  aria-label="Inject queued message into active turn"
                  className="text-amber-500 hover:bg-amber-500/15 p-0.5 rounded transition-colors cursor-pointer"
                  title="Inject into active turn now"
                >
                  <Zap className="w-3 h-3" />
                </button>
              )}
              <button
                type="button"
                onClick={() => onRemoveQueuedPrompt?.(idx)}
                aria-label="Cancel queued message"
                className="text-[var(--text-dim)] hover:text-red-500 p-0.5 rounded transition-colors cursor-pointer"
                title="Cancel queued message"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
});

import { memo, useState, useEffect, type KeyboardEvent, type FocusEvent } from "react";
import { Plus, PanelRightClose, Sparkles, Loader2 } from "lucide-react";
import { getSession } from "../../../lib/engine";
import { API_BASE, apiFetch } from "../../../lib/api";
import { useI18n } from "../../../lib/i18n";
import { cn } from "../../../lib/utils";

export function SleekRobotIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Curved antenna */}
      <path d="M12 2v3" />
      <circle cx="12" cy="2" r="1.2" fill="currentColor" stroke="none" />
      {/* Rounded dome visor head filling standard 24x24 icon bounds */}
      <path d="M4.5 12C4.5 7.5 7.8 4.8 12 4.8s7.5 2.7 7.5 7.2c0 3.8-3 6.2-7.5 6.2S4.5 15.8 4.5 12Z" />
      {/* Curved side audio pods */}
      <path d="M2.5 10.8a1.6 1.6 0 0 1 2-1.5v4.4a1.6 1.6 0 0 1-2-1.5v-1.4Z" />
      <path d="M21.5 10.8a1.6 1.6 0 0 0-2-1.5v4.4a1.6 1.6 0 0 0 2-1.5v-1.4Z" />
      {/* Expressive glowing eyes */}
      <circle cx="9.5" cy="11.5" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="11.5" r="1.25" fill="currentColor" stroke="none" />
      {/* Gentle curved smile */}
      <path d="M9.8 14.5c.7.55 1.4.8 2.2.8s1.5-.25 2.2-.8" />
      {/* Sleek curved collar base */}
      <path d="M6.8 21c1.4-1.5 3.1-2.2 5.2-2.2s3.8.7 5.2 2.2" />
    </svg>
  );
}

const isDefaultSessionTitle = (val?: string | null) =>
  !val ||
  val === "New Session" ||
  val === "Chat" ||
  val === "New Chat" ||
  val === "Sesi Baru";

interface WorkstationRightChatHeaderProps {
  activeChatId?: string;
  onNewChat?: () => void;
  onCompactSession?: () => void;
  isCompacting?: boolean;
  isCompacted?: boolean;
  onClose: () => void;
}

export const WorkstationRightChatHeader = memo(function WorkstationRightChatHeader({
  activeChatId,
  onNewChat,
  onCompactSession,
  isCompacting,
  isCompacted,
  onClose,
}: WorkstationRightChatHeaderProps) {
  const { t } = useI18n();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [chatTitle, setChatTitle] = useState("Chat");

  useEffect(() => {
    const fetchTitle = () => {
      if (activeChatId) {
        const saved = localStorage.getItem(`arunaki_chat_name_${activeChatId}`);
        if (saved && !isDefaultSessionTitle(saved)) {
          setChatTitle(saved);
        } else {
          getSession(activeChatId)
            .then((sess) => {
              if (sess?.title && !isDefaultSessionTitle(sess.title)) {
                setChatTitle(sess.title);
                localStorage.setItem(`arunaki_chat_name_${activeChatId}`, sess.title);
              } else {
                setChatTitle("Chat");
              }
            })
            .catch(() => setChatTitle("Chat"));
        }
      } else {
        setChatTitle("New Chat");
      }
    };

    fetchTitle();

    const handleSessionUpdated = (e: any) => {
      const targetId = e.detail?.sessionId || e.detail?.sessionID;
      if (targetId === activeChatId && e.detail?.title) {
        const nextTitle = isDefaultSessionTitle(e.detail.title)
          ? "New Chat"
          : e.detail.title;
        setChatTitle(nextTitle);
        localStorage.setItem(`arunaki_chat_name_${activeChatId}`, nextTitle);
      }
    };

    window.addEventListener("arunaki:session-updated", handleSessionUpdated);
    return () => window.removeEventListener("arunaki:session-updated", handleSessionUpdated);
  }, [activeChatId]);

  const handleTitleSubmit = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  };

  const handleTitleBlur = (e: FocusEvent<HTMLInputElement>) => {
    const newTitle = e.target.value.trim() || "Chat";
    setChatTitle(newTitle);
    setIsEditingTitle(false);
    if (activeChatId) {
      localStorage.setItem(`arunaki_chat_name_${activeChatId}`, newTitle);
      apiFetch(`${API_BASE}/session/${activeChatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      }).catch(() => {});
      window.dispatchEvent(
        new CustomEvent("arunaki:session-updated", {
          detail: { sessionId: activeChatId, title: newTitle },
        })
      );
    }
  };

  const displayTitle = isDefaultSessionTitle(chatTitle)
    ? chatTitle === "New Chat"
      ? "New Chat"
      : "Chat"
    : chatTitle;

  return (
    <div className="h-10 px-3 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-panel)] shrink-0 select-none">
      <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-3">
        <button
          type="button"
          onClick={onClose}
          className="w-6 h-6 rounded-md bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer flex items-center justify-center shrink-0"
          title={t("closePanel", "Collapse Chat Panel")}
        >
          <PanelRightClose className="w-3.5 h-3.5" strokeWidth={1.8} />
        </button>
        <div
          className="w-6 h-6 rounded-md bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-center shrink-0 text-[#f97316]"
          title="AI Video Agent"
        >
          <SleekRobotIcon className="w-3.5 h-3.5" />
        </div>
        {isEditingTitle ? (
          <input
            type="text"
            defaultValue={isDefaultSessionTitle(chatTitle) ? "" : chatTitle}
            placeholder={t("sessionNamePlaceholder", "Session Name...")}
            autoFocus
            onKeyDown={handleTitleSubmit}
            onBlur={handleTitleBlur}
            className="bg-[var(--bg-card)] border border-[var(--border-strong)] outline-none text-xs font-semibold text-[var(--text-primary)] w-full rounded px-1.5 py-0.5 ml-0.5 transition-all placeholder-[var(--text-dim)]"
          />
        ) : (
          <span
            onClick={() => setIsEditingTitle(true)}
            className="text-xs font-semibold text-[var(--text-primary)] truncate cursor-pointer hover:bg-[var(--bg-hover)] px-1.5 py-0.5 rounded transition-colors"
            title={t("clickToRenameSession", "Click to rename session")}
          >
            {displayTitle}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {onCompactSession && (
          <button
            type="button"
            disabled={isCompacting}
            onClick={onCompactSession}
            className={cn(
              "w-6 h-6 rounded-md border flex items-center justify-center transition-colors cursor-pointer shrink-0",
              isCompacted || isCompacting
                ? "bg-[#cf6613] hover:bg-[#b8580f] border-[#e07b27] text-white"
                : "bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
              isCompacting && "opacity-80 cursor-wait"
            )}
            title={
              isCompacting
                ? "Compacting session context..."
                : isCompacted
                ? "Context compacted (/compact active) — Click to disable"
                : t("compactSessionContext", "Compact Context (/compact)")
            }
          >
            {isCompacting ? (
              <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" strokeWidth={1.8} />
            )}
          </button>
        )}
        {onNewChat && (
          <button
            type="button"
            onClick={onNewChat}
            className="w-6 h-6 rounded-md bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer flex items-center justify-center shrink-0"
            title={t("newChatSession", "New Chat Session")}
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={1.8} />
          </button>
        )}
      </div>
    </div>
  );
});

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
      <path d="M12 2.5v2.5" />
      <circle cx="12" cy="2" r="1" fill="currentColor" stroke="none" />
      {/* Rounded dome visor head (non-boxy) */}
      <path d="M5.5 11.5C5.5 7.6 8.4 5 12 5s6.5 2.6 6.5 6.5c0 3.4-2.6 5.5-6.5 5.5s-6.5-2.1-6.5-5.5Z" />
      {/* Curved side audio pods */}
      <path d="M3.5 10.5a1.5 1.5 0 0 1 2-1.4v3.8a1.5 1.5 0 0 1-2-1.4v-1Z" />
      <path d="M20.5 10.5a1.5 1.5 0 0 0-2-1.4v3.8a1.5 1.5 0 0 0 2-1.4v-1Z" />
      {/* Expressive glowing eyes */}
      <circle cx="9.75" cy="11" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="14.25" cy="11" r="1.15" fill="currentColor" stroke="none" />
      {/* Gentle curved smile */}
      <path d="M10 13.75c.65.5 1.3.75 2 .75s1.35-.25 2-.75" />
      {/* Sleek curved collar base */}
      <path d="M7.5 19.5c1.2-1.3 2.7-1.9 4.5-1.9s3.3.6 4.5 1.9" />
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
        <div
          className="w-6 h-6 rounded-md bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-center shrink-0 text-amber-400"
          title="AI Video Agent"
        >
          <SleekRobotIcon className="w-4 h-4" />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-6 h-6 rounded-md bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer flex items-center justify-center shrink-0"
          title={t("closePanel", "Collapse Chat Panel")}
        >
          <PanelRightClose className="w-3.5 h-3.5" />
        </button>
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
              <Loader2 className="w-3 h-3 text-white animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" strokeWidth={1.8} />
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

import { memo, useState, useEffect, type KeyboardEvent, type FocusEvent } from "react";
import { Bot, Plus, PanelRightClose, Sparkles, Loader2 } from "lucide-react";
import { getSession } from "../../../lib/engine";
import { API_BASE, apiFetch } from "../../../lib/api";
import { useI18n } from "../../../lib/i18n";
import { cn } from "../../../lib/utils";
import { WindowControls } from "../../common/WindowControls";

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
        if (saved && saved !== "New Session" && saved !== "Chat") {
          setChatTitle(saved);
        } else {
          getSession(activeChatId).then((sess) => {
            if (sess?.title && sess.title !== "New Session" && sess.title !== "Chat") {
              setChatTitle(sess.title);
              localStorage.setItem(`arunaki_chat_name_${activeChatId}`, sess.title);
            } else {
              setChatTitle("Chat");
            }
          }).catch(() => setChatTitle("Chat"));
        }
      } else {
        setChatTitle("New Chat");
      }
    };

    fetchTitle();

    const handleSessionUpdated = (e: any) => {
      const targetId = e.detail?.sessionId || e.detail?.sessionID;
      if (targetId === activeChatId && e.detail?.title) {
        setChatTitle(e.detail.title);
        localStorage.setItem(`arunaki_chat_name_${activeChatId}`, e.detail.title);
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

  const displayTitle =
    chatTitle === "Chat" || chatTitle === "New Session"
      ? t("chat", "Chat")
      : chatTitle === "New Chat"
      ? t("newChat", "New Chat")
      : chatTitle;

  return (
    <div className="h-[29px] px-2.5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950 shrink-0 select-none font-mono">
      <div className="flex items-center gap-2 flex-1 min-w-0 pr-2">
        <Bot className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        {isEditingTitle ? (
          <input
            type="text"
            defaultValue={chatTitle === "Chat" || chatTitle === "New Chat" ? "" : chatTitle}
            placeholder="SESSION_ID..."
            autoFocus
            onKeyDown={handleTitleSubmit}
            onBlur={handleTitleBlur}
            className="bg-neutral-950 border border-neutral-700 outline-none text-[10px] font-mono text-white w-full rounded-none px-1.5 py-0.5 transition-none placeholder-neutral-600 uppercase tracking-wider"
          />
        ) : (
          <div className="flex items-center gap-2 truncate">
            <span
              onClick={() => setIsEditingTitle(true)}
              className="text-[10px] font-bold text-white truncate cursor-pointer hover:text-emerald-400 transition-none uppercase tracking-wider"
              title={t("clickToRenameSession", "Click to rename session")}
            >
              {displayTitle}
            </span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {onCompactSession && (
          <button
            type="button"
            disabled={isCompacting}
            onClick={onCompactSession}
            className={cn(
              "w-5 h-5 rounded-none border border-neutral-800 flex items-center justify-center transition-none cursor-pointer shrink-0",
              isCompacted || isCompacting
                ? "bg-amber-400 text-black border-amber-400"
                : "bg-neutral-950 text-neutral-400 hover:text-white hover:border-neutral-700",
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
            className="w-5 h-5 rounded-none border border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-white hover:border-neutral-700 transition-none cursor-pointer flex items-center justify-center shrink-0"
            title={t("newChatSession", "New Chat Session")}
          >
            <Plus className="w-3 h-3" strokeWidth={2} />
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="w-5 h-5 rounded-none border border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-white hover:border-neutral-700 transition-none cursor-pointer flex items-center justify-center shrink-0"
          title={t("closePanel", "Close Panel")}
        >
          <PanelRightClose className="w-3 h-3" />
        </button>
        <div className="w-[1px] h-3.5 bg-neutral-800 mx-0.5 shrink-0" />
        <WindowControls />
      </div>
    </div>
  );
});

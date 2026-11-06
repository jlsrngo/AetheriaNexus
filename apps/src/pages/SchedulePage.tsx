import { memo, useState, useMemo } from "react";
import {
  Clock,
  Plus,
  Send,
  X,
  Calendar,
  CheckCircle2,
  Film,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { useScheduleStore } from "../hooks/useScheduleStore";
import { useVideoStock } from "../hooks/useVideoStock";
import type { ScheduledPost, ScheduleStatus } from "../types/schedule";

export const SchedulePage = memo(function SchedulePage() {
  const { schedule, queuePost, updatePostTime, cancelPost, markPublished, autoScheduleStock } =
    useScheduleStore();
  const { stock, updateStockStatus } = useVideoStock();

  const [statusFilter, setStatusFilter] = useState<"all" | ScheduleStatus>("all");
  const [editingPost, setEditingPost] = useState<ScheduledPost | null>(null);
  const [isQueueModalOpen, setIsQueueModalOpen] = useState(false);

  // Edit time state
  const [editDate, setEditDate] = useState("TODAY");
  const [editTime, setEditTime] = useState("18:00 WIB (Peak Audience)");

  // Queue from stock state
  const [selectedStockId, setSelectedStockId] = useState<string>("");
  const [newPostDate, setNewPostDate] = useState("TODAY");
  const [newPostTime, setNewPostTime] = useState("18:00 WIB (Peak Audience)");

  const readyStockVideos = useMemo(
    () => stock.filter((v) => v.status === "ready"),
    [stock]
  );

  const filteredSchedule = useMemo(() => {
    if (statusFilter === "all") return schedule;
    return schedule.filter((p) => p.status === statusFilter);
  }, [schedule, statusFilter]);

  const queuedCount = schedule.filter((p) => p.status === "queued").length;
  const postedCount = schedule.filter((p) => p.status === "posted").length;

  const handleOpenEdit = (post: ScheduledPost) => {
    setEditingPost(post);
    setEditDate(post.scheduledDate);
    setEditTime(post.scheduledTime);
  };

  const handleSaveEditTime = () => {
    if (!editingPost) return;
    updatePostTime(editingPost.id, editDate, editTime);
    toast.success(`Updated schedule for "${editingPost.videoTitle}"!`);
    setEditingPost(null);
  };

  const handleCancel = (post: ScheduledPost) => {
    cancelPost(post.id);
    if (post.stockId) {
      updateStockStatus(post.stockId, "ready");
    }
    toast.info(`Cancelled scheduled post "${post.videoTitle}"`);
  };

  const handlePublishNow = (post: ScheduledPost) => {
    toast.loading(`Publishing "${post.videoTitle}" to TikTok...`, { id: `pub-${post.id}` });
    setTimeout(() => {
      markPublished(post.id);
      if (post.stockId) {
        updateStockStatus(post.stockId, "published");
      }
      toast.success(`Published to TikTok successfully!`, { id: `pub-${post.id}` });
    }, 1200);
  };

  const handleAutoFill = () => {
    if (readyStockVideos.length === 0) {
      toast.error("No ready videos found in Stock Vault! Ingest or render videos first.");
      return;
    }
    const added = autoScheduleStock(readyStockVideos);
    readyStockVideos.slice(0, added.length).forEach((item) => {
      updateStockStatus(item.id, "scheduled");
    });
    toast.success(`Auto-scheduled ${added.length} videos into peak audience slots!`);
  };

  const handleQueueFromStockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const stockItem = stock.find((v) => v.id === selectedStockId);
    if (!stockItem) {
      toast.error("Please select a video from stock");
      return;
    }

    queuePost({
      stockId: stockItem.id,
      videoTitle: stockItem.title,
      hook: stockItem.hook,
      scheduledDate: newPostDate,
      scheduledTime: newPostTime,
      platform: "TikTok (P0)",
      status: "queued",
      caption: stockItem.caption,
      tags: stockItem.tags,
      privacy: "public",
      allowComments: true,
      allowDuet: true,
      allowStitch: true,
    });

    updateStockStatus(stockItem.id, "scheduled");
    toast.success(`Queued "${stockItem.title}" for ${newPostDate} @ ${newPostTime}!`);
    setIsQueueModalOpen(false);
    setSelectedStockId("");
  };

  return (
    <div className="flex-1 flex flex-col h-full w-full bg-[var(--bg-app)] text-[var(--text-primary)] select-none overflow-hidden">
      {/* 1. PINNED COMPACT HEADER (Never scrolls, not full height, no emerald green) */}
      <div className="shrink-0 border-b border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-2.5 z-20">
        <div className="max-w-4xl mx-auto space-y-2">
          {/* Row 1: Title, Quick Telemetry, Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-[var(--text-primary)] truncate">
                Posting Schedule & Queue
              </h1>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] text-amber-400">
                {queuedCount} Queued
              </span>
              <span className="hidden sm:inline-block text-[10px] font-mono text-[var(--text-muted)]">
                • {postedCount} Published Today • 3 Posts / Day
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleAutoFill}
                className="h-7 px-2.5 rounded-lg bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer text-amber-400"
                title="Auto-distribute ready stock videos into peak slots"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Auto-Schedule 3/Day</span>
              </button>
              <button
                type="button"
                onClick={() => setIsQueueModalOpen(true)}
                className="h-7 px-3 rounded-lg bg-[#cf6613] hover:bg-[#b8580f] text-white text-xs font-semibold flex items-center gap-1.5 transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Queue Video</span>
              </button>
            </div>
          </div>

          {/* Row 2: Filter Status Pills */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-1 overflow-x-auto">
              {(["all", "queued", "posted", "failed"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setStatusFilter(tab)}
                  className={cn(
                    "h-6 px-2.5 rounded-full text-[11px] font-semibold capitalize transition-colors cursor-pointer shrink-0",
                    statusFilter === tab
                      ? "bg-[#cf6613] text-white"
                      : "bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-white border border-[var(--border-color)]"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            <span className="text-[10px] text-[var(--text-muted)] font-mono">
              {filteredSchedule.length} of {schedule.length} queued
            </span>
          </div>
        </div>
      </div>

      {/* 2. SCROLLABLE QUEUE LIST (Reduced width max-w-4xl, no emerald green) */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5">
        <div className="max-w-4xl mx-auto space-y-2.5">
          {filteredSchedule.length === 0 ? (
            <div className="p-8 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-center text-xs text-[var(--text-muted)] space-y-2">
              <Clock className="w-8 h-8 mx-auto text-[var(--text-muted)] opacity-50" />
              <div>No scheduled posts in this filter category.</div>
            </div>
          ) : (
            filteredSchedule.map((post) => (
              <div
                key={post.id}
                className="p-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--border-strong)] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                {/* Left: Timing & Video info */}
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-secondary)] font-bold uppercase tracking-wider">
                      {post.platform}
                    </span>

                    <span className="text-xs text-amber-300 font-semibold flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>{post.scheduledDate} @ {post.scheduledTime}</span>
                    </span>

                    <span
                      className={cn(
                        "text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ml-auto sm:ml-0 flex items-center gap-1",
                        post.status === "queued"
                          ? "bg-amber-500/15 border border-amber-500/30 text-amber-400"
                          : post.status === "posted"
                          ? "bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-secondary)]"
                          : "bg-rose-500/15 border border-rose-500/30 text-rose-400"
                      )}
                    >
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          post.status === "queued"
                            ? "bg-amber-400 animate-pulse"
                            : post.status === "posted"
                            ? "bg-white/80"
                            : "bg-rose-400"
                        )}
                      />
                      <span>{post.status}</span>
                    </span>
                  </div>

                  <h3 className="text-xs sm:text-sm font-semibold text-[var(--text-primary)]">
                    {post.videoTitle}
                  </h3>
                  <p className="text-[11px] text-[var(--text-muted)] italic line-clamp-1">
                    "{post.hook}"
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)] line-clamp-1">
                    {post.caption}
                  </p>

                  <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                    {post.tags.slice(0, 5).map((t) => (
                      <span key={t} className="text-[9.5px] font-mono text-[var(--text-muted)]">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                  {post.status === "queued" && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(post)}
                        className="h-7 px-2.5 rounded-lg bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)] text-xs text-[var(--text-secondary)] hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                        title="Change Scheduled Date & Time Slot"
                      >
                        <Calendar className="w-3.5 h-3.5 text-amber-400" />
                        <span>Edit Time</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePublishNow(post)}
                        className="h-7 px-3 rounded-lg bg-[#cf6613] hover:bg-[#b8580f] text-white text-xs font-semibold flex items-center gap-1 transition-transform hover:scale-105 active:scale-95 cursor-pointer shadow-sm"
                        title="Publish Immediately to TikTok"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Publish Now</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCancel(post)}
                        className="h-7 px-2.5 rounded-lg bg-[var(--bg-input)] hover:bg-rose-950/40 border border-[var(--border-color)] hover:border-rose-500/50 text-[var(--text-muted)] hover:text-rose-400 text-xs transition-colors cursor-pointer"
                        title="Cancel Scheduled Post & Return to Stock"
                      >
                        Cancel
                      </button>
                    </>
                  )}

                  {post.status === "posted" && (
                    <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] font-semibold px-2.5 py-1 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-white/80" />
                      <span>Live on TikTok</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* --- EDIT TIME MODAL --- */}
      {editingPost && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setEditingPost(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[var(--bg-panel)] border border-[var(--border-strong)] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-[var(--text-primary)]"
          >
            <div className="h-11 px-4 border-b border-[var(--border-color)] bg-[var(--bg-card)] flex items-center justify-between">
              <span className="text-xs font-semibold">
                Edit Schedule: {editingPost.videoTitle}
              </span>
              <button
                type="button"
                onClick={() => setEditingPost(null)}
                className="w-7 h-7 rounded-lg bg-[var(--bg-input)] text-[var(--text-secondary)] hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3.5 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                  Posting Day
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {["TODAY", "TOMORROW", "DAY AFTER"].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setEditDate(d)}
                      className={cn(
                        "h-8 rounded-lg border text-xs font-semibold transition-colors cursor-pointer",
                        editDate === d
                          ? "bg-[#cf6613] border-[#e07b27] text-white"
                          : "bg-[var(--bg-input)] border-[var(--border-color)] text-[var(--text-secondary)] hover:text-white"
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                  Peak Time Slot (WIB)
                </label>
                <div className="space-y-1.5">
                  {[
                    "18:00 WIB (Peak Audience)",
                    "20:30 WIB (Night Prime)",
                    "12:30 WIB (Lunch Break)",
                  ].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setEditTime(t)}
                      className={cn(
                        "w-full p-2.5 rounded-lg border text-left transition-colors cursor-pointer flex items-center justify-between",
                        editTime === t
                          ? "bg-[#cf6613]/15 border-[#cf6613] text-amber-300"
                          : "bg-[var(--bg-input)] border-[var(--border-color)] text-[var(--text-secondary)] hover:text-white"
                      )}
                    >
                      <span className="font-semibold">{t}</span>
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setEditingPost(null)}
                  className="h-8 px-3 rounded-lg bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)] text-xs text-[var(--text-secondary)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditTime}
                  className="h-8 px-4 rounded-lg bg-[#cf6613] hover:bg-[#b8580f] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- QUEUE FROM STOCK MODAL --- */}
      {isQueueModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setIsQueueModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-[var(--bg-panel)] border border-[var(--border-strong)] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-[var(--text-primary)]"
          >
            <div className="h-11 px-4 border-b border-[var(--border-color)] bg-[var(--bg-card)] flex items-center justify-between">
              <span className="text-xs font-semibold">
                Select Video from Stock Vault to Queue
              </span>
              <button
                type="button"
                onClick={() => setIsQueueModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-[var(--bg-input)] text-[var(--text-secondary)] hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQueueFromStockSubmit} className="p-4 space-y-3.5 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                  Ready Stock Videos ({readyStockVideos.length} Available)
                </label>
                {readyStockVideos.length === 0 ? (
                  <div className="p-4 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-center text-[var(--text-muted)]">
                    No ready videos in stock vault. Ingest or render videos first.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {readyStockVideos.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => setSelectedStockId(item.id)}
                        className={cn(
                          "p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-colors",
                          selectedStockId === item.id
                            ? "bg-[#cf6613]/20 border-[#cf6613] text-amber-300"
                            : "bg-[var(--bg-input)] border-[var(--border-color)] text-[var(--text-secondary)] hover:text-white"
                        )}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-semibold text-xs text-[var(--text-primary)] truncate">
                            {item.title}
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)] font-mono">
                            {item.niche} • {item.durationSec}s
                          </div>
                        </div>
                        <Film className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                    Posting Day
                  </label>
                  <select
                    value={newPostDate}
                    onChange={(e) => setNewPostDate(e.target.value)}
                    className="w-full px-2.5 h-8 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] outline-none cursor-pointer"
                  >
                    <option value="TODAY">TODAY</option>
                    <option value="TOMORROW">TOMORROW</option>
                    <option value="DAY AFTER">DAY AFTER</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                    Peak Audience Slot
                  </label>
                  <select
                    value={newPostTime}
                    onChange={(e) => setNewPostTime(e.target.value)}
                    className="w-full px-2.5 h-8 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] outline-none cursor-pointer"
                  >
                    <option value="18:00 WIB (Peak Audience)">18:00 WIB (Peak Audience)</option>
                    <option value="20:30 WIB (Night Prime)">20:30 WIB (Night Prime)</option>
                    <option value="12:30 WIB (Lunch Break)">12:30 WIB (Lunch Break)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setIsQueueModalOpen(false)}
                  className="h-8 px-3 rounded-lg bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)] text-xs text-[var(--text-secondary)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedStockId}
                  className="h-8 px-4 rounded-lg bg-[#cf6613] hover:bg-[#b8580f] disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add to Queue</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
});

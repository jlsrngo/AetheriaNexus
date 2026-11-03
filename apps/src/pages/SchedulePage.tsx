import { memo, useState } from "react";
import { Clock, Plus } from "lucide-react";
import { CornerCrosses } from "../components/ui/CornerCrosses";
import { cn } from "../lib/utils";

interface ScheduledPost {
  id: string;
  videoTitle: string;
  hook: string;
  scheduledTime: string;
  scheduledDate: string;
  platform: "TikTok (P0)" | "Instagram Reels" | "YouTube Shorts";
  status: "queued" | "posted" | "failed";
  caption: string;
  tags: string[];
}

const INITIAL_SCHEDULE: ScheduledPost[] = [
  {
    id: "sched-1",
    videoTitle: "3 Morning Habits of High Performers",
    hook: "The first 60 minutes decide your next 10 years.",
    scheduledDate: "2026-11-03 (TODAY)",
    scheduledTime: "18:00 WIB (Peak Audience)",
    platform: "TikTok (P0)",
    status: "queued",
    caption: "The morning blueprint top 1% use daily. Save this before tomorrow morning! ⚡",
    tags: ["#productivity", "#habits", "#successmindset", "#fyp"],
  },
  {
    id: "sched-2",
    videoTitle: "Why 99% Fail At Compound Interest",
    hook: "If you invest $100 today, here is what banks hide.",
    scheduledDate: "2026-11-04 (TOMORROW)",
    scheduledTime: "12:30 WIB (Lunch Break)",
    platform: "TikTok (P0)",
    status: "queued",
    caption: "The hidden truth about compound growth. Share with someone who needs this!",
    tags: ["#finance", "#investing", "#wealth", "#moneytok"],
  },
  {
    id: "sched-3",
    videoTitle: "The 2-Minute Dopamine Reset",
    hook: "Feeling constantly exhausted? Reset right now.",
    scheduledDate: "2026-11-02 (YESTERDAY)",
    scheduledTime: "20:00 WIB",
    platform: "TikTok (P0)",
    status: "posted",
    caption: "Instant brain reset for chronic doom-scrollers.",
    tags: ["#psychology", "#focus", "#dopaminedetox"],
  },
];

export const SchedulePage = memo(function SchedulePage() {
  const [schedule] = useState<ScheduledPost[]>(INITIAL_SCHEDULE);

  return (
    <div className="flex-1 flex flex-col h-full w-full bg-neutral-950 text-neutral-100 overflow-y-auto select-none p-6">
      <div className="max-w-6xl w-full mx-auto flex-1 flex flex-col min-h-0 space-y-6">
        {/* Header */}
        <div className="border-b border-neutral-800 pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] text-emerald-400 uppercase tracking-widest mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
              AUTO-SCHEDULER // DISTRIBUTION ENGINE
            </div>
            <h1 className="text-2xl font-mono font-extrabold uppercase tracking-tight text-white">
              TIKTOK POSTING SCHEDULE & QUEUE
            </h1>
            <p className="text-xs font-mono text-neutral-400 mt-1">
              Automated video publication queue timed at peak Indonesian audience hours (12:00, 18:00, 20:30 WIB).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-4 py-2 bg-white text-black font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-2 border border-white cursor-pointer hover:bg-neutral-200 transition-none"
            >
              <Plus className="w-3.5 h-3.5" />
              QUEUE NEXT VIDEO
            </button>
          </div>
        </div>

        {/* Schedule Queue Cards */}
        <div className="space-y-3">
          {schedule.map((post) => (
            <div
              key={post.id}
              className="relative bg-neutral-900/90 border border-neutral-800 p-5 font-mono flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-neutral-600 transition-none"
            >
              <CornerCrosses size="sm" className="text-neutral-700" />

              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] px-2 py-0.5 border border-emerald-500/40 text-emerald-400 bg-emerald-950/30 font-bold uppercase tracking-wider">
                    {post.platform}
                  </span>
                  <span className="text-xs text-neutral-300 flex items-center gap-1.5 font-bold">
                    <Clock className="w-3.5 h-3.5 text-neutral-400" />
                    {post.scheduledDate} @ {post.scheduledTime}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] px-2 py-0.5 border font-bold uppercase tracking-wider ml-auto md:ml-0",
                      post.status === "queued"
                        ? "border-amber-500/40 text-amber-400 bg-amber-950/30"
                        : "border-neutral-700 text-neutral-400 bg-neutral-800"
                    )}
                  >
                    STATUS: {post.status}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-white uppercase">{post.videoTitle}</h3>
                <p className="text-xs text-neutral-400 italic">"{post.hook}"</p>
                <div className="text-[11px] text-neutral-500 line-clamp-1">{post.caption}</div>
                <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-mono">
                  {post.tags.map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white text-[11px] font-mono uppercase tracking-wider cursor-pointer"
                >
                  EDIT TIME
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 bg-neutral-800 hover:bg-rose-950 text-neutral-300 hover:text-rose-400 border border-neutral-700 hover:border-rose-800 text-[11px] font-mono uppercase tracking-wider cursor-pointer"
                >
                  CANCEL
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});


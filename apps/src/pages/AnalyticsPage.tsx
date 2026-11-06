import { memo, useState } from "react";
import {
  TrendingUp,
  Eye,
  Heart,
  Users,
  ArrowUpRight,
  Sparkles,
  CheckCircle2,
  Award,
} from "lucide-react";
import { cn } from "../lib/utils";

type TimeRange = "7d" | "30d" | "90d" | "all";

export const AnalyticsPage = memo(function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");

  // Dynamic metrics depending on selected range
  const metrics = {
    "7d": {
      views: "64,280",
      viewsGrowth: "+31.2%",
      likes: "4,910",
      engagementRate: "19.4%",
      followers: "+940",
      totalFollowers: "28.4K",
      retention: "81.2%",
    },
    "30d": {
      views: "248,920",
      viewsGrowth: "+24.5%",
      likes: "18,430",
      engagementRate: "18.2%",
      followers: "+3,820",
      totalFollowers: "28.4K",
      retention: "78.4%",
    },
    "90d": {
      views: "682,100",
      viewsGrowth: "+42.8%",
      likes: "51,200",
      engagementRate: "17.6%",
      followers: "+11,400",
      totalFollowers: "28.4K",
      retention: "76.9%",
    },
    all: {
      views: "1,240,500",
      viewsGrowth: "+115.4%",
      likes: "94,300",
      engagementRate: "18.0%",
      followers: "+28,400",
      totalFollowers: "28.4K",
      retention: "77.5%",
    },
  }[timeRange];

  // Daily views activity distribution
  const activityDays = [
    { day: "Mon", height: "45%", views: "28.4K" },
    { day: "Tue", height: "60%", views: "36.2K" },
    { day: "Wed", height: "55%", views: "32.1K" },
    { day: "Thu", height: "78%", views: "48.9K" },
    { day: "Fri", height: "92%", views: "58.4K", isPeak: true },
    { day: "Sat", height: "85%", views: "52.8K" },
    { day: "Sun", height: "70%", views: "44.1K" },
  ];

  return (
    <div className="flex-1 flex flex-col h-full w-full bg-[var(--bg-app)] text-[var(--text-primary)] overflow-y-auto select-none p-4 sm:p-6">
      <div className="max-w-6xl w-full mx-auto flex-1 flex flex-col min-h-0 space-y-5">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border-color)] pb-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-400 font-semibold uppercase tracking-wider mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>TIKTOK TELEMETRY | AUDIENCE & ENGAGEMENT ANALYTICS</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              Account Analytics & Audience Insights
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Track video watch time retention curves, FYP velocity, and audience conversion.
            </p>
          </div>

          {/* Time Range Selector */}
          <div className="flex items-center gap-1 p-1 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)]">
            {(
              [
                { id: "7d", label: "7 Days" },
                { id: "30d", label: "30 Days" },
                { id: "90d", label: "90 Days" },
                { id: "all", label: "All Time" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTimeRange(opt.id)}
                className={cn(
                  "h-7 px-3 rounded-full text-xs font-semibold transition-colors cursor-pointer",
                  timeRange === opt.id
                    ? "bg-[#cf6613] text-white"
                    : "text-[var(--text-secondary)] hover:text-white"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 4 KPI Telemetry Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Card 1: Total Views */}
          <div className="p-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span className="font-medium">Total Video Views</span>
              <Eye className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold font-mono text-[var(--text-primary)]">
                {metrics.views}
              </div>
              <div className="text-[11px] text-emerald-400 font-semibold mt-0.5 flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3" />
                <span>{metrics.viewsGrowth} vs last cycle</span>
              </div>
            </div>
          </div>

          {/* Card 2: Likes & Engagement */}
          <div className="p-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span className="font-medium">Likes & Saves</span>
              <Heart className="w-3.5 h-3.5 text-rose-500" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold font-mono text-[var(--text-primary)]">
                {metrics.likes}
              </div>
              <div className="text-[11px] text-emerald-400 font-semibold mt-0.5 flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3" />
                <span>{metrics.engagementRate} engagement</span>
              </div>
            </div>
          </div>

          {/* Card 3: Followers Growth */}
          <div className="p-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span className="font-medium">Follower Growth</span>
              <Users className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold font-mono text-[var(--text-primary)]">
                {metrics.followers}
              </div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                Total Audience: {metrics.totalFollowers}
              </div>
            </div>
          </div>

          {/* Card 4: Avg Retention */}
          <div className="p-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span className="font-medium">Avg Completion Rate</span>
              <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold font-mono text-amber-400">
                {metrics.retention}
              </div>
              <div className="text-[11px] text-emerald-400 mt-0.5 font-medium">
                High TikTok viral benchmark
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section: Views Distribution + Traffic Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Weekly Velocity Chart */}
          <div className="md:col-span-2 p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Weekly Views Velocity
                </h3>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Peak viewing hours concentrated between 18:00 - 21:00 WIB
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-mono text-amber-400 font-semibold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                <Sparkles className="w-3 h-3" />
                <span>Peak: Friday</span>
              </div>
            </div>

            {/* Visual Bar Chart */}
            <div className="h-44 pt-6 pb-2 px-2 flex items-end justify-between gap-3">
              {activityDays.map((item) => (
                <div key={item.day} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                  <span className="text-[10px] font-mono font-bold text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.views}
                  </span>
                  <div className="w-full bg-[var(--bg-input)] rounded-t-lg overflow-hidden h-full flex items-end">
                    <div
                      style={{ height: item.height }}
                      className={cn(
                        "w-full rounded-t-lg transition-all duration-500",
                        item.isPeak
                          ? "bg-gradient-to-t from-[#cf6613] to-amber-400 shadow-md shadow-orange-950/40"
                          : "bg-gradient-to-t from-neutral-700 to-neutral-500 group-hover:from-[#cf6613]/70 group-hover:to-amber-400/70"
                      )}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-[var(--text-muted)] font-semibold">
                    {item.day}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Traffic Source Breakdown */}
          <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Traffic Sources
              </h3>
              <p className="text-[11px] text-[var(--text-muted)]">
                Algorithmic FYP distribution ratio
              </p>
            </div>

            <div className="space-y-2.5 pt-1">
              {[
                { label: "For You Page (FYP)", pct: 88, color: "bg-emerald-400" },
                { label: "Personal Profile", pct: 6, color: "bg-amber-400" },
                { label: "Following Feed", pct: 4, color: "bg-sky-400" },
                { label: "Search & Sound", pct: 2, color: "bg-purple-400" },
              ].map((src) => (
                <div key={src.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-secondary)]">{src.label}</span>
                    <span className="font-mono font-bold text-[var(--text-primary)]">
                      {src.pct}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-[var(--bg-input)] overflow-hidden">
                    <div
                      style={{ width: `${src.pct}%` }}
                      className={cn("h-full rounded-full", src.color)}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 leading-relaxed mt-2 flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-400" />
              <span>
                88% FYP ratio indicates strong algorithmic push and hook retention rate.
              </span>
            </div>
          </div>
        </div>

        {/* Top Performing Videos Leaderboard */}
        <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              <span>Top Performing TikTok Videos</span>
            </h3>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">
              Ranked by total views & watch completion
            </span>
          </div>

          <div className="space-y-2">
            {[
              {
                rank: "01",
                title: "3 Morning Habits of High Performers",
                niche: "PRODUCTIVITY",
                views: "142.8K",
                likes: "12.4K",
                shares: "3.2K",
                retention: "84.2%",
              },
              {
                rank: "02",
                title: "The 2-Minute Dopamine Reset Rule",
                niche: "PSYCHOLOGY",
                views: "78.2K",
                likes: "6.8K",
                shares: "1.8K",
                retention: "76.1%",
              },
              {
                rank: "03",
                title: "5 Rules for Deep Work and Zero Burnout",
                niche: "PRODUCTIVITY",
                views: "45.1K",
                likes: "3.9K",
                shares: "980",
                retention: "71.5%",
              },
              {
                rank: "04",
                title: "Why 99% Fail At Compound Interest",
                niche: "FINANCE",
                views: "27.9K",
                likes: "1.9K",
                shares: "540",
                retention: "69.4%",
              },
            ].map((v) => (
              <div
                key={v.rank}
                className="p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] hover:border-[var(--border-strong)] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0",
                      v.rank === "01"
                        ? "bg-amber-400/20 text-amber-300 border border-amber-400/40"
                        : v.rank === "02"
                        ? "bg-neutral-300/20 text-neutral-200 border border-neutral-300/30"
                        : "bg-orange-900/30 text-orange-300 border border-orange-700/30"
                    )}
                  >
                    #{v.rank}
                  </span>

                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-[var(--bg-card)] text-[var(--text-muted)] font-mono font-bold">
                        {v.niche}
                      </span>
                      <h4 className="text-xs font-semibold text-[var(--text-primary)] truncate">
                        {v.title}
                      </h4>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-5 text-xs font-mono shrink-0 self-end sm:self-center">
                  <div className="text-right">
                    <span className="text-[var(--text-primary)] font-bold">{v.views}</span>
                    <span className="text-[10px] text-[var(--text-muted)] ml-1">views</span>
                  </div>

                  <div className="text-right">
                    <span className="text-[var(--text-primary)] font-bold">{v.likes}</span>
                    <span className="text-[10px] text-[var(--text-muted)] ml-1">likes</span>
                  </div>

                  <div className="text-right min-w-20">
                    <span className="text-emerald-400 font-bold">{v.retention}</span>
                    <span className="text-[10px] text-[var(--text-muted)] ml-1">retention</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

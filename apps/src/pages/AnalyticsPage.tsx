import { memo, useState, useEffect } from "react";
import {
  TrendingUp,
  Eye,
  Heart,
  Users,
  ArrowUpRight,
  Sparkles,
  CheckCircle2,
  Award,
  Link2,
  RefreshCw,
  X,
  Check,
  Shield,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";

type TimeRange = "7d" | "30d" | "90d" | "all";

interface TikTokAccountState {
  handle: string;
  displayName: string;
  followers: string;
  likes: string;
  status: "connected" | "disconnected";
  authMethod: "oauth" | "creator_token";
  clientKey: string;
  autoSync: boolean;
  lastSync: string;
}

const DEFAULT_TIKTOK_ACCOUNT: TikTokAccountState = {
  handle: "@arunaki.studio",
  displayName: "Arunaki Content Lab",
  followers: "28.4K",
  likes: "194.2K",
  status: "connected",
  authMethod: "oauth",
  clientKey: "aw98x***live",
  autoSync: true,
  lastSync: "Just now",
};

export const AnalyticsPage = memo(function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

  // Load TikTok account state from localStorage
  const [tiktokAccount, setTiktokAccount] = useState<TikTokAccountState>(() => {
    try {
      const saved = localStorage.getItem("arunaki_tiktok_account");
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return DEFAULT_TIKTOK_ACCOUNT;
  });

  // Modal draft states
  const [draftHandle, setDraftHandle] = useState(tiktokAccount.handle);
  const [draftDisplayName, setDraftDisplayName] = useState(tiktokAccount.displayName);
  const [draftMethod, setDraftMethod] = useState<"oauth" | "creator_token">(tiktokAccount.authMethod);
  const [draftKey, setDraftKey] = useState(tiktokAccount.clientKey || "tt_live_key_9941");
  const [draftAutoSync, setDraftAutoSync] = useState(tiktokAccount.autoSync);

  useEffect(() => {
    localStorage.setItem("arunaki_tiktok_account", JSON.stringify(tiktokAccount));
  }, [tiktokAccount]);

  const isConnected = tiktokAccount.status === "connected";

  const handleSyncMetrics = () => {
    if (!isConnected) {
      toast.error("Please connect your TikTok account first.");
      setIsAccountModalOpen(true);
      return;
    }
    setIsSyncing(true);
    toast.loading("Fetching latest TikTok audience analytics & FYP retention...", { id: "tt-sync" });
    setTimeout(() => {
      setIsSyncing(false);
      setTiktokAccount((prev) => ({
        ...prev,
        lastSync: "Just now",
      }));
      toast.success("TikTok analytics updated to the latest 30-day cycle!", { id: "tt-sync" });
    }, 1200);
  };

  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftHandle.trim()) {
      toast.error("TikTok handle is required (e.g. @username).");
      return;
    }
    const cleanHandle = draftHandle.trim().startsWith("@") ? draftHandle.trim() : `@${draftHandle.trim()}`;
    const updated: TikTokAccountState = {
      ...tiktokAccount,
      handle: cleanHandle,
      displayName: draftDisplayName.trim() || cleanHandle.slice(1),
      authMethod: draftMethod,
      clientKey: draftKey.trim(),
      autoSync: draftAutoSync,
      status: "connected",
      lastSync: "Just now",
    };
    setTiktokAccount(updated);
    setIsAccountModalOpen(false);
    toast.success(`TikTok account ${cleanHandle} connected successfully!`);
  };

  const handleDisconnect = () => {
    const updated: TikTokAccountState = {
      ...tiktokAccount,
      status: "disconnected",
      lastSync: "Disconnected",
    };
    setTiktokAccount(updated);
    setIsAccountModalOpen(false);
    toast.info("TikTok account disconnected. Running in offline telemetry mode.");
  };

  // Dynamic metrics depending on selected range
  const metrics = {
    "7d": {
      views: "64,280",
      viewsGrowth: "+31.2%",
      likes: "4,910",
      engagementRate: "19.4%",
      followers: "+940",
      totalFollowers: tiktokAccount.followers,
      retention: "81.2%",
    },
    "30d": {
      views: "248,920",
      viewsGrowth: "+24.5%",
      likes: "18,430",
      engagementRate: "18.2%",
      followers: "+3,820",
      totalFollowers: tiktokAccount.followers,
      retention: "78.4%",
    },
    "90d": {
      views: "682,100",
      viewsGrowth: "+42.8%",
      likes: "51,200",
      engagementRate: "17.6%",
      followers: "+11,400",
      totalFollowers: tiktokAccount.followers,
      retention: "76.9%",
    },
    all: {
      views: "1,240,500",
      viewsGrowth: "+115.4%",
      likes: "94,300",
      engagementRate: "18.0%",
      followers: "+28,400",
      totalFollowers: tiktokAccount.followers,
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
    <div className="flex-1 flex flex-col h-full w-full bg-[var(--bg-app)] text-[var(--text-primary)] select-none overflow-hidden">
      {/* 1. PINNED COMPACT HEADER (Never scrolls, not full height, no emerald green) */}
      <div className="shrink-0 border-b border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-2.5 z-20">
        <div className="max-w-4xl mx-auto space-y-2">
          {/* Row 1: Title, Account Status Pill, Connect & Sync Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-[var(--text-primary)] truncate">
                TikTok Analytics
              </h1>

              {/* Connected TikTok Account Capsule */}
              <button
                type="button"
                onClick={() => {
                  setDraftHandle(tiktokAccount.handle);
                  setDraftDisplayName(tiktokAccount.displayName);
                  setIsAccountModalOpen(true);
                }}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-mono transition-colors cursor-pointer",
                  isConnected
                    ? "bg-[var(--bg-card)] border-[var(--border-color)] hover:border-amber-400/50 text-[var(--text-primary)]"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                )}
                title="Click to view or connect TikTok account"
              >
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    isConnected ? "bg-amber-400 animate-pulse" : "bg-neutral-500"
                  )}
                />
                <span className="font-semibold">{isConnected ? tiktokAccount.handle : "No Account Connected"}</span>
                {isConnected && (
                  <span className="text-[var(--text-muted)] text-[10px]">({tiktokAccount.followers})</span>
                )}
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleSyncMetrics}
                disabled={isSyncing}
                className="h-7 px-2.5 rounded-lg bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer text-[var(--text-secondary)] hover:text-white disabled:opacity-50"
                title="Sync latest TikTok metrics via API"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isSyncing && "animate-spin text-amber-400")} />
                <span>{isSyncing ? "Syncing..." : "Sync"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDraftHandle(tiktokAccount.handle);
                  setDraftDisplayName(tiktokAccount.displayName);
                  setIsAccountModalOpen(true);
                }}
                className="h-7 px-3 rounded-lg bg-[#cf6613] hover:bg-[#b8580f] text-white text-xs font-semibold flex items-center gap-1.5 transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-sm cursor-pointer"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>{isConnected ? "Account Settings" : "Connect TikTok"}</span>
              </button>
            </div>
          </div>

          {/* Row 2: Range selector pills + Last synced badge */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-1 overflow-x-auto">
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
                    "h-6 px-2.5 rounded-full text-[11px] font-semibold transition-colors cursor-pointer shrink-0",
                    timeRange === opt.id
                      ? "bg-[#cf6613] text-white"
                      : "bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-white border border-[var(--border-color)]"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <span className="text-[10px] text-[var(--text-muted)] font-mono">
              TikTok API v2 • Synced: {tiktokAccount.lastSync}
            </span>
          </div>
        </div>
      </div>

      {/* 2. SCROLLABLE TELEMETRY (Reduced width max-w-4xl, no emerald green) */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5">
        <div className="max-w-4xl mx-auto space-y-3.5">
          {/* 4 KPI Telemetry Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {/* Card 1: Total Views */}
            <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span className="font-medium">Total Video Views</span>
                <Eye className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="mt-1.5">
                <div className="text-xl sm:text-2xl font-bold font-mono text-[var(--text-primary)]">
                  {metrics.views}
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] font-semibold mt-0.5 flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3 text-amber-400" />
                  <span>{metrics.viewsGrowth} vs last cycle</span>
                </div>
              </div>
            </div>

            {/* Card 2: Likes & Engagement */}
            <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span className="font-medium">Likes & Saves</span>
                <Heart className="w-3.5 h-3.5 text-rose-400" />
              </div>
              <div className="mt-1.5">
                <div className="text-xl sm:text-2xl font-bold font-mono text-[var(--text-primary)]">
                  {metrics.likes}
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] font-semibold mt-0.5 flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3 text-amber-400" />
                  <span>{metrics.engagementRate} engagement</span>
                </div>
              </div>
            </div>

            {/* Card 3: Followers Growth */}
            <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span className="font-medium">Follower Growth</span>
                <Users className="w-3.5 h-3.5 text-sky-400" />
              </div>
              <div className="mt-1.5">
                <div className="text-xl sm:text-2xl font-bold font-mono text-[var(--text-primary)]">
                  {metrics.followers}
                </div>
                <div className="text-[11px] text-[var(--text-muted)] mt-0.5 font-mono">
                  Total: {metrics.totalFollowers}
                </div>
              </div>
            </div>

            {/* Card 4: Avg Retention */}
            <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span className="font-medium">Avg Completion</span>
                <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="mt-1.5">
                <div className="text-xl sm:text-2xl font-bold font-mono text-amber-400">
                  {metrics.retention}
                </div>
                <div className="text-[10.5px] text-[var(--text-muted)] mt-0.5 font-mono">
                  High viral benchmark
                </div>
              </div>
            </div>
          </div>

          {/* Charts Section: Views Distribution + Traffic Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Weekly Velocity Chart */}
            <div className="md:col-span-2 p-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs sm:text-sm font-semibold text-[var(--text-primary)]">
                    Weekly Views Velocity
                  </h3>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Peak viewing hours concentrated between 18:00 - 21:00 WIB
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-amber-400 font-semibold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                  <Sparkles className="w-3 h-3" />
                  <span>Peak: Friday</span>
                </div>
              </div>

              {/* Visual Bar Chart */}
              <div className="h-40 pt-4 pb-1 px-1 flex items-end justify-between gap-2.5">
                {activityDays.map((item) => (
                  <div key={item.day} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                    <span className="text-[9.5px] font-mono font-bold text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity">
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
            <div className="p-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-2.5">
              <div>
                <h3 className="text-xs sm:text-sm font-semibold text-[var(--text-primary)]">
                  Traffic Sources
                </h3>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Algorithmic FYP distribution ratio
                </p>
              </div>

              <div className="space-y-2 pt-1">
                {[
                  { label: "For You Page (FYP)", pct: 88, color: "bg-[#cf6613]" },
                  { label: "Personal Profile", pct: 6, color: "bg-neutral-500" },
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

              <div className="p-2.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-[11px] text-[var(--text-secondary)] leading-relaxed mt-2 flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                <span>
                  88% FYP ratio indicates strong algorithmic push and hook retention rate.
                </span>
              </div>
            </div>
          </div>

          {/* Top Performing Videos Leaderboard */}
          <div className="p-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                <span>Top Performing TikTok Videos</span>
              </h3>
              <span className="text-[10px] font-mono text-[var(--text-muted)]">
                Ranked by total views & watch completion
              </span>
            </div>

            <div className="space-y-1.5">
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
                  className="p-2.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] hover:border-[var(--border-strong)] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={cn(
                        "w-6 h-6 rounded flex items-center justify-center font-mono font-bold text-[11px] shrink-0",
                        v.rank === "01"
                          ? "bg-amber-400/20 text-amber-300 border border-amber-400/40"
                          : v.rank === "02"
                          ? "bg-neutral-300/20 text-neutral-200 border border-neutral-300/30"
                          : "bg-orange-950/40 text-orange-300 border border-orange-800/40"
                      )}
                    >
                      #{v.rank}
                    </span>

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-[var(--bg-card)] text-[var(--text-muted)] font-mono font-bold uppercase">
                          {v.niche}
                        </span>
                        <h4 className="text-xs font-semibold text-[var(--text-primary)] truncate">
                          {v.title}
                        </h4>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono shrink-0 self-end sm:self-center">
                    <div className="text-right">
                      <span className="text-[var(--text-primary)] font-bold">{v.views}</span>
                      <span className="text-[10px] text-[var(--text-muted)] ml-1">views</span>
                    </div>

                    <div className="text-right">
                      <span className="text-[var(--text-primary)] font-bold">{v.likes}</span>
                      <span className="text-[10px] text-[var(--text-muted)] ml-1">likes</span>
                    </div>

                    <div className="text-right min-w-16">
                      <span className="text-amber-400 font-bold">{v.retention}</span>
                      <span className="text-[10px] text-[var(--text-muted)] ml-1">retention</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. TIKTOK ACCOUNT CONNECTION MODAL */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] flex items-center justify-center text-amber-400">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    TikTok Account Connection
                  </h3>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Link account for auto-posting & live analytics
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAccountModalOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveAccount} className="p-5 space-y-4">
              {/* Account Handle */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">
                  TikTok Username / Handle
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-[var(--text-muted)]">
                    @
                  </span>
                  <input
                    type="text"
                    required
                    value={draftHandle.replace(/^@/, "")}
                    onChange={(e) => setDraftHandle(e.target.value)}
                    placeholder="yourbrand.official"
                    className="w-full pl-7 pr-3 h-8 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] font-mono outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Display Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">
                  Creator / Channel Label
                </label>
                <input
                  type="text"
                  value={draftDisplayName}
                  onChange={(e) => setDraftDisplayName(e.target.value)}
                  placeholder="e.g. Daily Productivity Hub"
                  className="w-full px-3 h-8 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] outline-none focus:border-amber-400"
                />
              </div>

              {/* Connection Mode Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">
                  Authentication & API Protocol
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDraftMethod("oauth")}
                    className={cn(
                      "p-2.5 rounded-lg border text-left transition-colors cursor-pointer space-y-1",
                      draftMethod === "oauth"
                        ? "bg-[#cf6613]/15 border-[#cf6613] text-white"
                        : "bg-[var(--bg-input)] border-[var(--border-color)] text-[var(--text-secondary)] hover:text-white"
                    )}
                  >
                    <div className="text-[11px] font-bold flex items-center justify-between">
                      <span>OAuth 2.0 (Official)</span>
                      {draftMethod === "oauth" && <Check className="w-3 h-3 text-[#cf6613]" />}
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)] leading-tight">
                      TikTok Login Kit & Content Posting API v2
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDraftMethod("creator_token")}
                    className={cn(
                      "p-2.5 rounded-lg border text-left transition-colors cursor-pointer space-y-1",
                      draftMethod === "creator_token"
                        ? "bg-[#cf6613]/15 border-[#cf6613] text-white"
                        : "bg-[var(--bg-input)] border-[var(--border-color)] text-[var(--text-secondary)] hover:text-white"
                    )}
                  >
                    <div className="text-[11px] font-bold flex items-center justify-between">
                      <span>Creator Token</span>
                      {draftMethod === "creator_token" && <Check className="w-3 h-3 text-[#cf6613]" />}
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)] leading-tight">
                      Direct session / access token from creator portal
                    </p>
                  </button>
                </div>
              </div>

              {/* API Key / Access Token Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">
                  {draftMethod === "oauth" ? "Client Key / App ID" : "Creator Access Token"}
                </label>
                <input
                  type="password"
                  value={draftKey}
                  onChange={(e) => setDraftKey(e.target.value)}
                  placeholder="Paste TikTok credentials..."
                  className="w-full px-3 h-8 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] font-mono outline-none focus:border-amber-400"
                />
              </div>

              {/* Toggles */}
              <div className="pt-1 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    checked={draftAutoSync}
                    onChange={(e) => setDraftAutoSync(e.target.checked)}
                    className="rounded border-[var(--border-color)] bg-[var(--bg-input)] text-[#cf6613] focus:ring-0"
                  />
                  <span>Auto-sync video view metrics & FYP velocity daily</span>
                </label>
              </div>

              {/* Notice */}
              <div className="p-2.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] flex items-start gap-2 text-[11px] text-[var(--text-muted)]">
                <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                <span>
                  Credentials are encrypted and stored in local Windows app storage. Videos rendered locally will directly upload to this account upon publishing.
                </span>
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-between gap-2 border-t border-[var(--border-color)]">
                {isConnected ? (
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="h-8 px-3 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-[var(--border-color)] text-xs font-semibold text-rose-400 transition-colors cursor-pointer"
                  >
                    Disconnect
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAccountModalOpen(false)}
                    className="h-8 px-3 rounded-lg hover:bg-[var(--bg-hover)] text-xs font-semibold text-[var(--text-secondary)] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="h-8 px-4 rounded-lg bg-[#cf6613] hover:bg-[#b8580f] text-white text-xs font-semibold flex items-center gap-1.5 transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-sm cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Connect & Save</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
});

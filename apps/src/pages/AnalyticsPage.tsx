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
  RefreshCw,
  X,
  Check,
  Shield,
  Smartphone,
  Camera,
  ExternalLink,
  Video,
  Radio,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";

type TimeRange = "7d" | "30d" | "90d" | "all";
type SocialPlatform = "tiktok" | "reels" | "shorts";

interface SocialAccountState {
  platform: SocialPlatform;
  handle: string;
  displayName: string;
  bio: string;
  followers: string;
  following: string;
  likes: string;
  totalVideos: number;
  status: "connected" | "disconnected";
  authMethod: "oauth" | "creator_token";
  clientKey: string;
  autoSync: boolean;
  lastSync: string;
  avatarUrl: string;
}

const DEFAULT_AVATARS: Record<SocialPlatform, string> = {
  tiktok:
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='50' fill='%231a1a1f'/><circle cx='50' cy='38' r='20' fill='%23cf6613'/><path d='M20 85 C20 62, 35 56, 50 56 C65 56, 80 62, 80 85 Z' fill='%23cf6613'/></svg>",
  reels:
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='50' fill='%231a1a1f'/><circle cx='50' cy='38' r='20' fill='%23d946ef'/><path d='M20 85 C20 62, 35 56, 50 56 C65 56, 80 62, 80 85 Z' fill='%23d946ef'/></svg>",
  shorts:
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='50' fill='%231a1a1f'/><circle cx='50' cy='38' r='20' fill='%23ef4444'/><path d='M20 85 C20 62, 35 56, 50 56 C65 56, 80 62, 80 85 Z' fill='%23ef4444'/></svg>",
};

const DEFAULT_ACCOUNTS: Record<SocialPlatform, SocialAccountState> = {
  tiktok: {
    platform: "tiktok",
    handle: "@aetheria.studio",
    displayName: "Aetheria Content Lab",
    bio: "Automated high-retention short-form videos with Remotion • 3 posts daily",
    followers: "28.4K",
    following: "142",
    likes: "194.2K",
    totalVideos: 48,
    status: "connected",
    authMethod: "oauth",
    clientKey: "aw98x***live",
    autoSync: true,
    lastSync: "Just now",
    avatarUrl: DEFAULT_AVATARS.tiktok,
  },
  reels: {
    platform: "reels",
    handle: "@aetheria.creativelab",
    displayName: "Aetheria Creative Lab",
    bio: "Visual storytelling, design systems & aesthetic motion clips",
    followers: "14.8K",
    following: "88",
    likes: "82.6K",
    totalVideos: 32,
    status: "connected",
    authMethod: "oauth",
    clientKey: "ig_meta_graph_9941",
    autoSync: true,
    lastSync: "Today 11:30",
    avatarUrl: DEFAULT_AVATARS.reels,
  },
  shorts: {
    platform: "shorts",
    handle: "@AetheriaShorts",
    displayName: "Aetheria Shorts Network",
    bio: "Bite-sized productivity blueprints & tech insights in 60s",
    followers: "9.2K",
    following: "24",
    likes: "45.1K",
    totalVideos: 27,
    status: "connected",
    authMethod: "oauth",
    clientKey: "yt_data_v3_session",
    autoSync: true,
    lastSync: "Yesterday",
    avatarUrl: DEFAULT_AVATARS.shorts,
  },
};

export const AnalyticsPage = memo(function AnalyticsPage() {
  const [activePlatform, setActivePlatform] = useState<SocialPlatform>("tiktok");
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [isSyncing, setIsSyncing] = useState(false);

  // Modals state
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileModalTab, setProfileModalTab] = useState<"profile" | "settings">("profile");

  // Load all accounts from localStorage
  const [accounts, setAccounts] = useState<Record<SocialPlatform, SocialAccountState>>(() => {
    try {
      const saved = localStorage.getItem("aetheria_social_accounts");
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_ACCOUNTS, ...parsed };
      }
    } catch {
      // fallback
    }
    return DEFAULT_ACCOUNTS;
  });

  // Current active account
  const currentAccount = accounts[activePlatform];

  // Draft state for modal editing
  const [draftHandle, setDraftHandle] = useState(currentAccount.handle);
  const [draftDisplayName, setDraftDisplayName] = useState(currentAccount.displayName);
  const [draftBio, setDraftBio] = useState(currentAccount.bio);
  const [draftAvatarUrl, setDraftAvatarUrl] = useState(currentAccount.avatarUrl);
  const [draftMethod, setDraftMethod] = useState<"oauth" | "creator_token">(currentAccount.authMethod);
  const [draftKey, setDraftKey] = useState(currentAccount.clientKey);
  const [draftAutoSync, setDraftAutoSync] = useState(currentAccount.autoSync);

  // Sync draft states when active platform changes
  useEffect(() => {
    setDraftHandle(currentAccount.handle);
    setDraftDisplayName(currentAccount.displayName);
    setDraftBio(currentAccount.bio);
    setDraftAvatarUrl(currentAccount.avatarUrl);
    setDraftMethod(currentAccount.authMethod);
    setDraftKey(currentAccount.clientKey);
    setDraftAutoSync(currentAccount.autoSync);
  }, [activePlatform, currentAccount]);

  // Persist accounts state
  useEffect(() => {
    localStorage.setItem("aetheria_social_accounts", JSON.stringify(accounts));
  }, [accounts]);

  const isConnected = currentAccount.status === "connected";

  const handleSyncMetrics = () => {
    if (!isConnected) {
      toast.error(`Please connect your ${getPlatformLabel(activePlatform)} account first.`);
      setIsProfileModalOpen(true);
      return;
    }
    setIsSyncing(true);
    toast.loading(`Fetching latest ${getPlatformLabel(activePlatform)} telemetry...`, { id: "sync-toast" });
    setTimeout(() => {
      setIsSyncing(false);
      setAccounts((prev) => ({
        ...prev,
        [activePlatform]: {
          ...prev[activePlatform],
          lastSync: "Just now",
        },
      }));
      toast.success(`${getPlatformLabel(activePlatform)} metrics updated!`, { id: "sync-toast" });
    }, 1100);
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Avatar image must be under 5 MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        setDraftAvatarUrl(result);
        toast.success("Profile photo preview updated. Click 'Save Profile' to apply.");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftHandle.trim()) {
      toast.error("Handle username is required (e.g. @username).");
      return;
    }
    const cleanHandle = draftHandle.trim().startsWith("@") ? draftHandle.trim() : `@${draftHandle.trim()}`;
    const updated: SocialAccountState = {
      ...currentAccount,
      handle: cleanHandle,
      displayName: draftDisplayName.trim() || cleanHandle.slice(1),
      bio: draftBio.trim(),
      avatarUrl: draftAvatarUrl || DEFAULT_AVATARS[activePlatform],
      authMethod: draftMethod,
      clientKey: draftKey.trim(),
      autoSync: draftAutoSync,
      status: "connected",
      lastSync: "Just now",
    };

    setAccounts((prev) => ({
      ...prev,
      [activePlatform]: updated,
    }));

    setIsProfileModalOpen(false);
    toast.success(`${getPlatformLabel(activePlatform)} profile for ${cleanHandle} saved successfully!`);
  };

  const handleDisconnect = () => {
    setAccounts((prev) => ({
      ...prev,
      [activePlatform]: {
        ...prev[activePlatform],
        status: "disconnected",
        lastSync: "Disconnected",
      },
    }));
    setIsProfileModalOpen(false);
    toast.info(`${getPlatformLabel(activePlatform)} account disconnected.`);
  };

  function getPlatformLabel(p: SocialPlatform) {
    switch (p) {
      case "tiktok":
        return "TikTok";
      case "reels":
        return "Instagram Reels";
      case "shorts":
        return "YouTube Shorts";
    }
  }

  function getPlatformExternalUrl(p: SocialPlatform, handle: string) {
    const clean = handle.replace(/^@/, "");
    switch (p) {
      case "tiktok":
        return `https://www.tiktok.com/@${clean}`;
      case "reels":
        return `https://www.instagram.com/${clean}`;
      case "shorts":
        return `https://www.youtube.com/@${clean}`;
    }
  }

  // Dynamic metrics per platform & range
  const metricsData = {
    tiktok: {
      "7d": { views: "64,280", viewsGrowth: "+31.2%", likes: "4,910", engagementRate: "19.4%", followers: "+940", retention: "81.2%" },
      "30d": { views: "248,920", viewsGrowth: "+24.5%", likes: "18,430", engagementRate: "18.2%", followers: "+3,820", retention: "78.4%" },
      "90d": { views: "682,100", viewsGrowth: "+42.8%", likes: "51,200", engagementRate: "17.6%", followers: "+11,400", retention: "76.9%" },
      all: { views: "1,240,500", viewsGrowth: "+115.4%", likes: "94,300", engagementRate: "18.0%", followers: "+28,400", retention: "77.5%" },
    },
    reels: {
      "7d": { views: "41,100", viewsGrowth: "+18.4%", likes: "3,150", engagementRate: "16.8%", followers: "+520", retention: "72.4%" },
      "30d": { views: "162,400", viewsGrowth: "+21.1%", likes: "12,900", engagementRate: "17.1%", followers: "+2,140", retention: "70.8%" },
      "90d": { views: "448,000", viewsGrowth: "+35.5%", likes: "36,200", engagementRate: "16.5%", followers: "+6,800", retention: "69.2%" },
      all: { views: "812,000", viewsGrowth: "+88.0%", likes: "65,400", engagementRate: "16.9%", followers: "+14,800", retention: "71.0%" },
    },
    shorts: {
      "7d": { views: "29,400", viewsGrowth: "+22.9%", likes: "2,040", engagementRate: "14.2%", followers: "+310", retention: "74.8%" },
      "30d": { views: "118,500", viewsGrowth: "+26.4%", likes: "8,750", engagementRate: "15.0%", followers: "+1,450", retention: "73.2%" },
      "90d": { views: "325,000", viewsGrowth: "+41.2%", likes: "24,800", engagementRate: "14.8%", followers: "+4,600", retention: "72.0%" },
      all: { views: "594,000", viewsGrowth: "+94.5%", likes: "45,100", engagementRate: "14.9%", followers: "+9,200", retention: "72.8%" },
    },
  }[activePlatform][timeRange];

  // Platform traffic sources breakdown
  const trafficSources = {
    tiktok: [
      { label: "For You Page (FYP)", pct: 88, color: "bg-[#cf6613]" },
      { label: "Personal Profile", pct: 6, color: "bg-neutral-500" },
      { label: "Following Feed", pct: 4, color: "bg-sky-400" },
      { label: "Search & Sound", pct: 2, color: "bg-purple-400" },
    ],
    reels: [
      { label: "Reels Tab Discovery", pct: 76, color: "bg-[#cf6613]" },
      { label: "Explore Grid", pct: 14, color: "bg-neutral-500" },
      { label: "Feed / Home", pct: 7, color: "bg-sky-400" },
      { label: "Audio Page", pct: 3, color: "bg-purple-400" },
    ],
    shorts: [
      { label: "Shorts Algorithm Feed", pct: 84, color: "bg-[#cf6613]" },
      { label: "YouTube Search", pct: 9, color: "bg-neutral-500" },
      { label: "Channel Pages", pct: 5, color: "bg-sky-400" },
      { label: "Suggested Videos", pct: 2, color: "bg-purple-400" },
    ],
  }[activePlatform];

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
          {/* Row 1: Platform Switcher, Account Pill with Avatar, Sync & Profile Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 min-w-0 flex-wrap sm:flex-nowrap">
              {/* Platform Tabs Pill */}
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] shrink-0">
                <button
                  type="button"
                  onClick={() => setActivePlatform("tiktok")}
                  className={cn(
                    "px-2 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer",
                    activePlatform === "tiktok"
                      ? "bg-[#cf6613] text-white shadow-sm"
                      : "text-[var(--text-secondary)] hover:text-white"
                  )}
                  title="TikTok (P0 Priority Focus)"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>TikTok (P0)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActivePlatform("reels")}
                  className={cn(
                    "px-2 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer",
                    activePlatform === "reels"
                      ? "bg-[#cf6613] text-white shadow-sm"
                      : "text-[var(--text-secondary)] hover:text-white"
                  )}
                  title="Instagram Reels"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Reels</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActivePlatform("shorts")}
                  className={cn(
                    "px-2 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer",
                    activePlatform === "shorts"
                      ? "bg-[#cf6613] text-white shadow-sm"
                      : "text-[var(--text-secondary)] hover:text-white"
                  )}
                  title="YouTube Shorts"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Shorts</span>
                </button>
              </div>

              {/* Connected Account Capsule with Real Avatar Photo */}
              <button
                type="button"
                onClick={() => {
                  setProfileModalTab("profile");
                  setIsProfileModalOpen(true);
                }}
                className={cn(
                  "flex items-center gap-1.5 pl-1 pr-2.5 py-0.5 rounded-full border text-[11px] font-mono transition-colors cursor-pointer shrink-0 max-w-[220px]",
                  isConnected
                    ? "bg-[var(--bg-card)] border-[var(--border-color)] hover:border-amber-400/50 text-[var(--text-primary)]"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                )}
                title="Click to view creator profile card and photo"
              >
                {/* Circular Profile Avatar Photo */}
                <div className="w-5 h-5 rounded-full overflow-hidden border border-[var(--border-color)] bg-[var(--bg-input)] shrink-0 flex items-center justify-center">
                  {currentAccount.avatarUrl ? (
                    <img
                      src={currentAccount.avatarUrl}
                      alt={currentAccount.handle}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[9px] font-bold text-[var(--text-secondary)]">
                      {currentAccount.handle.slice(1, 2).toUpperCase()}
                    </span>
                  )}
                </div>

                <span className="font-semibold truncate">{isConnected ? currentAccount.handle : "No Account"}</span>
                {isConnected && (
                  <span className="text-[var(--text-muted)] text-[10px] shrink-0">({currentAccount.followers})</span>
                )}
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleSyncMetrics}
                disabled={isSyncing}
                className="h-7 px-2.5 rounded-lg bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer text-[var(--text-secondary)] hover:text-white disabled:opacity-50"
                title="Sync latest live telemetry via API"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isSyncing && "animate-spin text-amber-400")} />
                <span>{isSyncing ? "Syncing..." : "Sync"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setProfileModalTab("profile");
                  setIsProfileModalOpen(true);
                }}
                className="h-7 px-3 rounded-lg bg-[#cf6613] hover:bg-[#b8580f] text-white text-xs font-semibold flex items-center gap-1.5 transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-sm cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                <span>View Profile</span>
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
              {getPlatformLabel(activePlatform)} API v2 • Synced: {currentAccount.lastSync}
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
                  {metricsData.views}
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] font-semibold mt-0.5 flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3 text-amber-400" />
                  <span>{metricsData.viewsGrowth} vs last cycle</span>
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
                  {metricsData.likes}
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] font-semibold mt-0.5 flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3 text-amber-400" />
                  <span>{metricsData.engagementRate} engagement</span>
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
                  {metricsData.followers}
                </div>
                <div className="text-[11px] text-[var(--text-muted)] mt-0.5 font-mono">
                  Total: {currentAccount.followers}
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
                  {metricsData.retention}
                </div>
                <div className="text-[10.5px] text-[var(--text-muted)] mt-0.5 font-mono">
                  {activePlatform === "tiktok" ? "High TikTok FYP benchmark" : "High short-form retention"}
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
                    Weekly Views Velocity ({getPlatformLabel(activePlatform)})
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
                  Algorithmic discovery distribution ratio
                </p>
              </div>

              <div className="space-y-2 pt-1">
                {trafficSources.map((src) => (
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
                  High recommendation ratio confirms viral hook retention and watch completion on {getPlatformLabel(activePlatform)}.
                </span>
              </div>
            </div>
          </div>

          {/* Top Performing Videos Leaderboard */}
          <div className="p-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                <span>Top Performing {getPlatformLabel(activePlatform)} Videos</span>
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

      {/* 3. CREATOR PROFILE CARD & ACCOUNT MODAL */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header Cover with Profile Photo */}
            <div className="relative bg-gradient-to-r from-neutral-900 via-neutral-850 to-neutral-900 border-b border-[var(--border-color)] pt-8 pb-4 px-6">
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(false)}
                className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-black/40 hover:bg-black/70 text-[var(--text-muted)] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Profile Avatar & Details */}
              <div className="flex items-start gap-4">
                {/* Large Avatar Photo with Camera Picker */}
                <div className="relative group shrink-0">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-amber-400/80 bg-black shadow-lg">
                    {draftAvatarUrl ? (
                      <img
                        src={draftAvatarUrl}
                        alt={draftHandle}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl font-bold text-white bg-neutral-800">
                        {draftHandle.slice(1, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Camera Upload Overlay */}
                  <label
                    className="absolute inset-0 rounded-full bg-black/60 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-[10px] font-semibold"
                    title="Upload custom profile photo from computer"
                  >
                    <Camera className="w-5 h-5 mb-0.5" />
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarFileChange}
                    />
                  </label>
                </div>

                {/* Profile Identity */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-bold text-white truncate">
                      {draftDisplayName || "Creator"}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 text-[10px] font-bold font-mono uppercase flex items-center gap-1">
                      <Radio className="w-2.5 h-2.5 animate-pulse text-amber-400" />
                      <span>{getPlatformLabel(activePlatform)} Verified</span>
                    </span>
                  </div>

                  <p className="text-xs font-mono text-[var(--text-secondary)] font-semibold">
                    {draftHandle}
                  </p>

                  <p className="text-[11px] text-[var(--text-muted)] line-clamp-2 leading-relaxed">
                    {draftBio}
                  </p>
                </div>
              </div>

              {/* 4 Profile Metric Counters */}
              <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-[var(--border-color)] text-center">
                <div className="p-1.5 rounded-lg bg-black/40 border border-white/5">
                  <div className="text-xs sm:text-sm font-bold font-mono text-white">
                    {currentAccount.followers}
                  </div>
                  <div className="text-[9.5px] text-[var(--text-muted)] uppercase tracking-wider">
                    Followers
                  </div>
                </div>

                <div className="p-1.5 rounded-lg bg-black/40 border border-white/5">
                  <div className="text-xs sm:text-sm font-bold font-mono text-white">
                    {currentAccount.likes}
                  </div>
                  <div className="text-[9.5px] text-[var(--text-muted)] uppercase tracking-wider">
                    Likes
                  </div>
                </div>

                <div className="p-1.5 rounded-lg bg-black/40 border border-white/5">
                  <div className="text-xs sm:text-sm font-bold font-mono text-white">
                    {currentAccount.following}
                  </div>
                  <div className="text-[9.5px] text-[var(--text-muted)] uppercase tracking-wider">
                    Following
                  </div>
                </div>

                <div className="p-1.5 rounded-lg bg-black/40 border border-white/5">
                  <div className="text-xs sm:text-sm font-bold font-mono text-amber-400">
                    {currentAccount.totalVideos}
                  </div>
                  <div className="text-[9.5px] text-[var(--text-muted)] uppercase tracking-wider">
                    Videos
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Tabs Navigation */}
            <div className="flex border-b border-[var(--border-color)] bg-[var(--bg-panel)] px-6 pt-2 shrink-0">
              <button
                type="button"
                onClick={() => setProfileModalTab("profile")}
                className={cn(
                  "pb-2 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer",
                  profileModalTab === "profile"
                    ? "border-[#cf6613] text-white"
                    : "border-transparent text-[var(--text-muted)] hover:text-white"
                )}
              >
                Profile & Bio
              </button>
              <button
                type="button"
                onClick={() => setProfileModalTab("settings")}
                className={cn(
                  "pb-2 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer",
                  profileModalTab === "settings"
                    ? "border-[#cf6613] text-white"
                    : "border-transparent text-[var(--text-muted)] hover:text-white"
                )}
              >
                API & Auto-Publish Settings
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveProfile} className="p-6 overflow-y-auto space-y-4">
              {profileModalTab === "profile" ? (
                <>
                  {/* Handle & Display Name */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[var(--text-secondary)]">
                        Account Handle
                      </label>
                      <input
                        type="text"
                        required
                        value={draftHandle}
                        onChange={(e) => setDraftHandle(e.target.value)}
                        placeholder="@username"
                        className="w-full px-3 h-8 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] font-mono outline-none focus:border-amber-400"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[var(--text-secondary)]">
                        Channel / Creator Name
                      </label>
                      <input
                        type="text"
                        value={draftDisplayName}
                        onChange={(e) => setDraftDisplayName(e.target.value)}
                        placeholder="e.g. Daily Tech Blueprint"
                        className="w-full px-3 h-8 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  {/* Bio */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--text-secondary)]">
                      Bio / Profile Description
                    </label>
                    <textarea
                      rows={2}
                      value={draftBio}
                      onChange={(e) => setDraftBio(e.target.value)}
                      placeholder="Short bio shown on channel..."
                      className="w-full p-2.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] outline-none focus:border-amber-400 resize-none leading-relaxed"
                    />
                  </div>

                  {/* Direct Link to View Online Profile */}
                  <div className="p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-[var(--text-primary)]">
                        Live Profile on {getPlatformLabel(activePlatform)}
                      </div>
                      <div className="text-[11px] font-mono text-[var(--text-muted)] truncate max-w-[280px]">
                        {getPlatformExternalUrl(activePlatform, draftHandle)}
                      </div>
                    </div>

                    <a
                      href={getPlatformExternalUrl(activePlatform, draftHandle)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-7 px-2.5 rounded-lg bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)] text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5 transition-colors shrink-0"
                    >
                      <span>Open Link</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </>
              ) : (
                <>
                  {/* Protocol Selection */}
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
                          Content Posting API & Audience Telemetry v2
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
                          Direct creator session token from portal
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* API Key */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--text-secondary)]">
                      {draftMethod === "oauth" ? "Client Key / App ID" : "Creator Access Token"}
                    </label>
                    <input
                      type="password"
                      value={draftKey}
                      onChange={(e) => setDraftKey(e.target.value)}
                      placeholder="Paste API credentials..."
                      className="w-full px-3 h-8 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] font-mono outline-none focus:border-amber-400"
                    />
                  </div>

                  {/* Auto-sync */}
                  <div className="pt-1">
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

                  <div className="p-2.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] flex items-start gap-2 text-[11px] text-[var(--text-muted)]">
                    <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                    <span>
                      Credentials stored locally on this machine. Videos rendered in Stock Vault will publish directly to this connected channel.
                    </span>
                  </div>
                </>
              )}

              {/* Actions Footer */}
              <div className="pt-3 flex items-center justify-between gap-2 border-t border-[var(--border-color)]">
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
                    onClick={() => setIsProfileModalOpen(false)}
                    className="h-8 px-3 rounded-lg hover:bg-[var(--bg-hover)] text-xs font-semibold text-[var(--text-secondary)] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="h-8 px-4 rounded-lg bg-[#cf6613] hover:bg-[#b8580f] text-white text-xs font-semibold flex items-center gap-1.5 transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-sm cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Profile</span>
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

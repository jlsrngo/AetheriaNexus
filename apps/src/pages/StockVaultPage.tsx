import { memo, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Film,
  Play,
  CheckCircle2,
  Clock,
  Trash2,
  Send,
  Calendar,
  Search,
  Sparkles,
  Plus,
  X,
  AlertTriangle,
  HardDrive,
  Cpu,
  Eye,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { useVideoStock } from "../hooks/useVideoStock";
import { useScheduleStore } from "../hooks/useScheduleStore";
import type { StockVideoItem, StockVideoStatus } from "../types/stock";

export const StockVaultPage = memo(function StockVaultPage() {
  const navigate = useNavigate();
  const { stock, addStockItem, updateStockStatus, deleteStockItem } = useVideoStock();
  const { queuePost } = useScheduleStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | StockVideoStatus>("all");
  const [selectedNiche, setSelectedNiche] = useState<string>("all");

  // Modals state
  const [previewItem, setPreviewItem] = useState<StockVideoItem | null>(null);
  const [schedulingItem, setSchedulingItem] = useState<StockVideoItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  // Quick schedule form state
  const [schedDate, setSchedDate] = useState("TODAY");
  const [schedTime, setSchedTime] = useState("18:00 WIB (Peak Audience)");

  // Add video modal form state
  const [newTitle, setNewTitle] = useState("");
  const [newHook, setNewHook] = useState("");
  const [newNiche, setNewNiche] = useState("PRODUCTIVITY");
  const [newCaption, setNewCaption] = useState("");
  const [newTags, setNewTags] = useState("#fyp #viral #trending");
  const [newDuration, setNewDuration] = useState(15);

  const readyVideos = useMemo(() => stock.filter((v) => v.status === "ready"), [stock]);
  const readyCount = readyVideos.length;
  const daysCoverage = (readyCount / 3).toFixed(1); // 3 videos/day target
  const isLowStock = readyCount < 3;

  const niches = useMemo(() => {
    const set = new Set<string>();
    stock.forEach((v) => set.add(v.niche));
    return Array.from(set);
  }, [stock]);

  const filteredStock = useMemo(() => {
    return stock.filter((item) => {
      const matchSearch =
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.hook.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.niche.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = statusFilter === "all" || item.status === statusFilter;
      const matchNiche = selectedNiche === "all" || item.niche === selectedNiche;
      return matchSearch && matchStatus && matchNiche;
    });
  }, [stock, searchQuery, statusFilter, selectedNiche]);

  const handleOpenScheduleModal = (item: StockVideoItem) => {
    setSchedulingItem(item);
    setSchedDate("TODAY");
    setSchedTime("18:00 WIB (Peak Audience)");
  };

  const handleConfirmSchedule = () => {
    if (!schedulingItem) return;
    queuePost({
      stockId: schedulingItem.id,
      videoTitle: schedulingItem.title,
      hook: schedulingItem.hook,
      scheduledDate: schedDate,
      scheduledTime: schedTime,
      platform: "TikTok (P0)",
      status: "queued",
      caption: schedulingItem.caption,
      tags: schedulingItem.tags,
      privacy: "public",
      allowComments: true,
      allowDuet: true,
      allowStitch: true,
    });
    updateStockStatus(schedulingItem.id, "scheduled");
    toast.success(`Scheduled "${schedulingItem.title}" for ${schedDate} @ ${schedTime}!`);
    setSchedulingItem(null);
  };

  const handleInstantPublish = (item: StockVideoItem) => {
    toast.loading(`Publishing "${item.title}" to TikTok...`, { id: `pub-${item.id}` });
    setTimeout(() => {
      updateStockStatus(item.id, "published");
      toast.success(`Published to TikTok successfully!`, { id: `pub-${item.id}` });
    }, 1200);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const tagArray = newTags
      .split(/[\s,]+/)
      .filter((t) => t.startsWith("#") || t.length > 0)
      .map((t) => (t.startsWith("#") ? t : `#${t}`));

    addStockItem({
      title: newTitle.trim(),
      hook: newHook.trim() || newTitle.trim(),
      ratio: "9:16",
      durationSec: newDuration,
      niche: newNiche.toUpperCase(),
      status: "ready",
      fileSize: `${(newDuration * 1.8).toFixed(1)} MB`,
      resolution: "1080×1920",
      outputPath: `out/${newTitle.toLowerCase().replace(/[^a-z0-9]/g, "-")}.mp4`,
      caption: newCaption.trim() || newTitle.trim(),
      tags: tagArray.length > 0 ? tagArray : ["#fyp", "#video"],
    });

    toast.success(`Added "${newTitle}" to video stock vault!`);
    setIsAddModalOpen(false);
    setNewTitle("");
    setNewHook("");
    setNewCaption("");
  };

  return (
    <div className="flex-1 flex flex-col h-full w-full bg-[var(--bg-app)] text-[var(--text-primary)] overflow-y-auto select-none p-4 sm:p-6">
      <div className="max-w-6xl w-full mx-auto flex-1 flex flex-col min-h-0 space-y-5">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border-color)] pb-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-400 font-semibold uppercase tracking-wider mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>INVENTORY VAULT | LOCAL MP4 REPOSITORY</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              Video Stock & Content Vault
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Zero cloud cost. Local MP4 video inventory ready for scheduled automated TikTok publishing.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="h-8 px-3 rounded-lg bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer text-[var(--text-primary)]"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>Add Stock Asset</span>
            </button>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="h-8 px-3.5 rounded-lg bg-[#cf6613] hover:bg-[#b8580f] text-white text-xs font-semibold flex items-center gap-1.5 transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-sm cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Open Studio Editor</span>
            </button>
          </div>
        </div>

        {/* Telemetry Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Card 1: Buffer Health */}
          <div className="p-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span className="font-medium">Buffer Coverage</span>
              {isLowStock ? (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              )}
            </div>
            <div className="mt-2">
              <div className="text-xl font-bold font-mono text-[var(--text-primary)]">
                {readyCount} VIDEOS
              </div>
              <div className="text-[11px] font-medium text-emerald-400 mt-0.5">
                ~{daysCoverage} Days Coverage (3/day)
              </div>
            </div>
          </div>

          {/* Card 2: Total Inventory */}
          <div className="p-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span className="font-medium">Total Inventory</span>
              <HardDrive className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <div className="mt-2">
              <div className="text-xl font-bold font-mono text-[var(--text-primary)]">
                {stock.length} FILES
              </div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                Local Drive (Rp 0 Cost)
              </div>
            </div>
          </div>

          {/* Card 3: Scheduled Queue */}
          <div className="p-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span className="font-medium">Upcoming Queue</span>
              <Clock className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="mt-2">
              <div className="text-xl font-bold font-mono text-amber-400">
                {stock.filter((v) => v.status === "scheduled").length} SCHEDULED
              </div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                Next: Today 18:00 WIB
              </div>
            </div>
          </div>

          {/* Card 4: Local Render Engine */}
          <div className="p-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span className="font-medium">Hardware Engine</span>
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="mt-2">
              <div className="text-xl font-bold font-mono text-[var(--text-primary)]">
                LOCAL H.264
              </div>
              <div className="text-[11px] text-emerald-400 mt-0.5 font-medium">
                GPU Accelerated (Offline)
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search video title, hook, or niche..."
              className="w-full pl-9 pr-3 h-8 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-amber-400"
            />
          </div>

          {/* Status Pills */}
          <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto">
            {(["all", "ready", "scheduled", "published"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={cn(
                  "h-7 px-3 rounded-full text-xs font-semibold capitalize transition-colors cursor-pointer shrink-0",
                  statusFilter === tab
                    ? "bg-[#cf6613] text-white"
                    : "bg-[var(--bg-input)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)]"
                )}
              >
                {tab}
              </button>
            ))}

            {niches.length > 0 && (
              <div className="flex items-center gap-1 pl-2 border-l border-[var(--border-color)]">
                <SlidersHorizontal className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
                <select
                  value={selectedNiche}
                  onChange={(e) => setSelectedNiche(e.target.value)}
                  className="h-7 px-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-[11px] font-semibold text-[var(--text-secondary)] outline-none cursor-pointer"
                >
                  <option value="all">All Niches</option>
                  {niches.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Video Stock Inventory List */}
        <div className="space-y-2.5">
          {filteredStock.length === 0 ? (
            <div className="p-8 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-center text-xs text-[var(--text-muted)] space-y-2">
              <Film className="w-8 h-8 mx-auto text-[var(--text-muted)] opacity-50" />
              <div>No videos matched the current filters.</div>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setSelectedNiche("all");
                }}
                className="text-xs text-amber-400 hover:underline cursor-pointer"
              >
                Reset filters
              </button>
            </div>
          ) : (
            filteredStock.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--border-strong)] transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group"
              >
                {/* Left: Thumbnail & Details */}
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  {/* 9:16 Mockup Thumbnail */}
                  <div
                    onClick={() => setPreviewItem(item)}
                    className="w-14 h-20 rounded-lg bg-black border border-[var(--border-color)] relative flex flex-col items-center justify-center shrink-0 cursor-pointer overflow-hidden group/thumb shadow-sm"
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <Film className="w-4 h-4 text-amber-400 relative z-10 group-hover/thumb:scale-110 transition-transform" />
                    <span className="text-[8px] font-mono text-[var(--text-muted)] font-bold relative z-10 mt-1">
                      {item.ratio}
                    </span>
                    <div className="absolute bottom-1 right-1 text-[8px] font-mono font-bold text-white px-1 rounded bg-black/60">
                      {item.durationSec}s
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9.5px] px-2 py-0.5 rounded-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-secondary)] font-bold uppercase tracking-wider">
                        {item.niche}
                      </span>

                      <span
                        className={cn(
                          "text-[9.5px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1",
                          item.status === "ready"
                            ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                            : item.status === "scheduled"
                            ? "bg-amber-500/15 border border-amber-500/30 text-amber-400"
                            : "bg-sky-500/15 border border-sky-500/30 text-sky-400"
                        )}
                      >
                        <span
                          className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            item.status === "ready"
                              ? "bg-emerald-400"
                              : item.status === "scheduled"
                              ? "bg-amber-400 animate-pulse"
                              : "bg-sky-400"
                          )}
                        />
                        <span>{item.status}</span>
                      </span>

                      <span className="text-[10px] font-mono text-[var(--text-muted)]">
                        {item.fileSize} • {item.resolution}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      {item.title}
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] italic line-clamp-1">
                      "{item.hook}"
                    </p>

                    <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                      {item.tags.slice(0, 4).map((tag) => (
                        <span key={tag} className="text-[10px] font-mono text-emerald-400/80">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  <button
                    type="button"
                    onClick={() => setPreviewItem(item)}
                    className="h-7 px-2.5 rounded-lg bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)] text-xs text-[var(--text-secondary)] hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                    title="Watch Preview Player"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview</span>
                  </button>

                  {item.status !== "published" && (
                    <button
                      type="button"
                      onClick={() => handleOpenScheduleModal(item)}
                      className="h-7 px-2.5 rounded-lg bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)] text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors cursor-pointer"
                      title="Schedule Video for TikTok Queue"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Schedule</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleInstantPublish(item)}
                    className="h-7 px-3 rounded-lg bg-[#cf6613] hover:bg-[#b8580f] text-white text-xs font-semibold flex items-center gap-1 transition-transform hover:scale-105 active:scale-95 cursor-pointer shadow-sm"
                    title="1-Click Direct Post to TikTok"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Post Now</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      deleteStockItem(item.id);
                      toast.info(`Deleted "${item.title}" from stock`);
                    }}
                    className="w-7 h-7 rounded-lg bg-[var(--bg-input)] hover:bg-rose-950/40 border border-[var(--border-color)] hover:border-rose-500/50 text-[var(--text-muted)] hover:text-rose-400 flex items-center justify-center transition-colors cursor-pointer"
                    title="Delete Video from Vault"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* --- PREVIEW MODAL --- */}
      {previewItem && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => {
            setPreviewItem(null);
            setIsPreviewPlaying(false);
          }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-[var(--bg-panel)] border border-[var(--border-strong)] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-[var(--text-primary)]"
          >
            {/* Header */}
            <div className="h-11 px-4 border-b border-[var(--border-color)] bg-[var(--bg-card)] flex items-center justify-between">
              <span className="text-xs font-semibold truncate">
                Preview: {previewItem.title}
              </span>
              <button
                type="button"
                onClick={() => {
                  setPreviewItem(null);
                  setIsPreviewPlaying(false);
                }}
                className="w-7 h-7 rounded-lg bg-[var(--bg-input)] text-[var(--text-secondary)] hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Video Canvas Simulation */}
            <div className="p-4 flex flex-col items-center bg-black/50">
              <div className="w-56 h-96 rounded-xl bg-neutral-900 border border-[var(--border-strong)] relative overflow-hidden flex flex-col justify-between p-4 shadow-xl">
                {/* Simulated Content */}
                <div className="space-y-1">
                  <div className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold inline-block">
                    {previewItem.niche}
                  </div>
                  <h4 className="text-sm font-bold text-white leading-tight">
                    {previewItem.title}
                  </h4>
                </div>

                <div className="p-2.5 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10 text-center">
                  <p className="text-xs text-amber-300 font-medium italic">
                    "{previewItem.hook}"
                  </p>
                </div>

                {/* Footer author */}
                <div className="flex items-center justify-between text-[10px] text-white/70">
                  <span>@nexus.creative</span>
                  <span>{previewItem.durationSec}s // 1080×1920</span>
                </div>

                {/* Play/Pause Overlay Button */}
                <button
                  type="button"
                  onClick={() => setIsPreviewPlaying((v) => !v)}
                  className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-[#cf6613]/90 hover:bg-[#cf6613] text-white flex items-center justify-center shadow-lg transition-transform hover:scale-110 cursor-pointer"
                >
                  <Play className={cn("w-5 h-5 fill-current", isPreviewPlaying && "opacity-60")} />
                </button>
              </div>
            </div>

            {/* Caption & Post Details */}
            <div className="p-4 space-y-3 text-xs border-t border-[var(--border-color)]">
              <div>
                <span className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                  TikTok Caption & Trending Hashtags
                </span>
                <div className="p-2.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] leading-relaxed">
                  {previewItem.caption}
                  <div className="text-emerald-400 mt-1 font-mono">
                    {previewItem.tags.join(" ")}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    handleOpenScheduleModal(previewItem);
                    setPreviewItem(null);
                  }}
                  className="h-8 px-3 rounded-lg bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)] text-amber-400 font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Schedule</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleInstantPublish(previewItem);
                    setPreviewItem(null);
                  }}
                  className="h-8 px-4 rounded-lg bg-[#cf6613] hover:bg-[#b8580f] text-white font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Publish to TikTok</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- QUICK SCHEDULE MODAL --- */}
      {schedulingItem && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setSchedulingItem(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[var(--bg-panel)] border border-[var(--border-strong)] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-[var(--text-primary)]"
          >
            <div className="h-11 px-4 border-b border-[var(--border-color)] bg-[var(--bg-card)] flex items-center justify-between">
              <span className="text-xs font-semibold">
                Schedule Video: {schedulingItem.title}
              </span>
              <button
                type="button"
                onClick={() => setSchedulingItem(null)}
                className="w-7 h-7 rounded-lg bg-[var(--bg-input)] text-[var(--text-secondary)] hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3.5 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                  Select Posting Day
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {["TODAY", "TOMORROW", "DAY AFTER"].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setSchedDate(d)}
                      className={cn(
                        "h-8 rounded-lg border text-xs font-semibold transition-colors cursor-pointer",
                        schedDate === d
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
                  Peak Indonesian Audience Hours (WIB)
                </label>
                <div className="space-y-1.5">
                  {[
                    { label: "18:00 WIB (Peak Audience)", sub: "Prime Time // Highest Algorithm Reach" },
                    { label: "20:30 WIB (Night Prime)", sub: "Late Night Scroll // High Watch Time" },
                    { label: "12:30 WIB (Lunch Break)", sub: "Midday Break // Fast Initial Velocity" },
                  ].map((slot) => (
                    <button
                      key={slot.label}
                      type="button"
                      onClick={() => setSchedTime(slot.label)}
                      className={cn(
                        "w-full p-2.5 rounded-lg border text-left transition-colors cursor-pointer flex items-center justify-between",
                        schedTime === slot.label
                          ? "bg-[#cf6613]/15 border-[#cf6613] text-amber-300"
                          : "bg-[var(--bg-input)] border-[var(--border-color)] text-[var(--text-secondary)] hover:text-white"
                      )}
                    >
                      <div>
                        <div className="font-semibold text-xs text-[var(--text-primary)]">
                          {slot.label}
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] font-mono">
                          {slot.sub}
                        </div>
                      </div>
                      <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setSchedulingItem(null)}
                  className="h-8 px-3 rounded-lg bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)] text-xs text-[var(--text-secondary)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSchedule}
                  className="h-8 px-4 rounded-lg bg-[#cf6613] hover:bg-[#b8580f] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Confirm Schedule</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- ADD / INGEST ASSET MODAL --- */}
      {isAddModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setIsAddModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[var(--bg-panel)] border border-[var(--border-strong)] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-[var(--text-primary)]"
          >
            <div className="h-11 px-4 border-b border-[var(--border-color)] bg-[var(--bg-card)] flex items-center justify-between">
              <span className="text-xs font-semibold">
                Ingest New Video to Stock Vault
              </span>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-[var(--bg-input)] text-[var(--text-secondary)] hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-4 space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                  Video Title
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. 3 Morning Habits of Peak Performers"
                  className="w-full px-3 h-8 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                  Hook Statement (First 3 Seconds)
                </label>
                <input
                  type="text"
                  value={newHook}
                  onChange={(e) => setNewHook(e.target.value)}
                  placeholder="e.g. Stop doing this the moment you wake up."
                  className="w-full px-3 h-8 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                    Niche / Category
                  </label>
                  <select
                    value={newNiche}
                    onChange={(e) => setNewNiche(e.target.value)}
                    className="w-full px-2.5 h-8 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] outline-none cursor-pointer"
                  >
                    <option value="PRODUCTIVITY">Productivity</option>
                    <option value="FINANCE">Finance</option>
                    <option value="PSYCHOLOGY">Psychology</option>
                    <option value="MARKETING">Marketing</option>
                    <option value="TECH">Technology</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                    Duration (Seconds)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={60}
                    value={newDuration}
                    onChange={(e) => setNewDuration(Number(e.target.value) || 15)}
                    className="w-full px-3 h-8 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-xs font-mono text-[var(--text-primary)] outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                  Default Caption
                </label>
                <textarea
                  rows={2}
                  value={newCaption}
                  onChange={(e) => setNewCaption(e.target.value)}
                  placeholder="Enter TikTok video caption..."
                  className="w-full p-2.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] outline-none focus:border-amber-400 resize-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                  Hashtags
                </label>
                <input
                  type="text"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  placeholder="#fyp #viral #mindset"
                  className="w-full px-3 h-8 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-xs font-mono text-emerald-400 outline-none focus:border-amber-400"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="h-8 px-3 rounded-lg bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)] text-xs text-[var(--text-secondary)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-8 px-4 rounded-lg bg-[#cf6613] hover:bg-[#b8580f] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add to Vault</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
});

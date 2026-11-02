import React, { useState } from "react";
import { Player } from "@remotion/player";
import { TikTokVideo } from "./remotion/TikTokVideo";
import { TikTokVideoProps, defaultTikTokProps } from "./remotion/types";
import {
  Video,
  Layers,
  Calendar,
  BarChart3,
  Settings,
  Sparkles,
  Download,
  Share2,
  Clock,
  CheckCircle2,
  TrendingUp,
  Eye,
  Heart,
  Users,
  Flame,
  Plus,
} from "lucide-react";

type TabType = "studio" | "stock" | "schedule" | "analytics" | "settings";

interface StockVideoItem {
  id: string;
  title: string;
  category: string;
  duration: string;
  renderedAt: string;
  status: "ready" | "scheduled" | "published";
  theme: TikTokVideoProps["themeColor"];
}

const INITIAL_STOCK: StockVideoItem[] = [
  {
    id: "v-01",
    title: "3 Kebiasaan Pagi Orang Sukses",
    category: "Produktivitas",
    duration: "00:05",
    renderedAt: "Hari ini, 11:30",
    status: "ready",
    theme: "emerald",
  },
  {
    id: "v-02",
    title: "Stop Lakukan Ini Kalau Mau Disiplin",
    category: "Mindset",
    duration: "00:05",
    renderedAt: "Hari ini, 10:15",
    status: "scheduled",
    theme: "rose",
  },
  {
    id: "v-03",
    title: "5 Tools AI Gratis yang Jarang Diketahui",
    category: "Teknologi",
    duration: "00:05",
    renderedAt: "Kemarin, 19:40",
    status: "published",
    theme: "cyan",
  },
  {
    id: "v-04",
    title: "Cara Atur Gaji UMR Biar Punya Tabungan",
    category: "Finansial",
    duration: "00:05",
    renderedAt: "Kemarin, 16:10",
    status: "ready",
    theme: "amber",
  },
];

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>("studio");
  const [props, setProps] = useState<TikTokVideoProps>(defaultTikTokProps);
  const [stock, setStock] = useState<StockVideoItem[]>(INITIAL_STOCK);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const handleAiGenerate = () => {
    const aiIdeas = [
      {
        hook: "3 Tanda Kamu Punya Mental Kuat Walau Sering Overthinking",
        body: "1. Selalu mencari solusi bukan alasan\n2. Mampu berkata 'tidak' tanpa rasa bersalah\n3. Tidak membandingkan proses diri dengan orang lain",
        category: "Psikologi & Mental",
        theme: "violet" as const,
      },
      {
        hook: "Rahasia FYP TikTok 2026: Hook 3 Detik Pertama",
        body: "1. Mulai dengan pertanyaan kontroversial\n2. Tunjukkan visual sebelum audio\n3. Buat rasa penasaran di detik ke-2",
        category: "Tips Konten",
        theme: "cyan" as const,
      },
      {
        hook: "Aturan 2 Menit yang Akan Mengubah Hidupmu",
        body: "1. Jika butuh waktu < 2 menit, lakukan SEKARANG\n2. Memulai hal sulit hanya untuk 2 menit pertama\n3. Konsistensi kecil mengalahkan motivasi besar",
        category: "Produktivitas",
        theme: "emerald" as const,
      },
    ];

    const randomIdea = aiIdeas[Math.floor(Math.random() * aiIdeas.length)];
    setProps({
      ...props,
      hookText: randomIdea.hook,
      bodyText: randomIdea.body,
      category: randomIdea.category,
      themeColor: randomIdea.theme,
    });
    showNotification("✨ AI berhasil membuat naskah & hook baru!");
  };

  const handleRenderToStock = () => {
    setIsRendering(true);
    setRenderProgress(10);

    const interval = setInterval(() => {
      setRenderProgress((prev) => {
        if (prev >= 95) {
          clearInterval(interval);
          setTimeout(() => {
            setIsRendering(false);
            setRenderProgress(0);
            const newItem: StockVideoItem = {
              id: `v-${Date.now().toString().slice(-4)}`,
              title: props.hookText,
              category: props.category,
              duration: "00:05",
              renderedAt: "Baru saja",
              status: "ready",
              theme: props.themeColor,
            };
            setStock((prevStock) => [newItem, ...prevStock]);
            showNotification("🎉 Video berhasil dirender dan masuk ke Stok Video!");
          }, 400);
          return 100;
        }
        return prev + 15;
      });
    }, 250);
  };

  const readyStockCount = stock.filter((s) => s.status === "ready").length;

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-64 bg-slate-900/90 border-r border-slate-800 flex flex-col justify-between shrink-0">
        <div>
          {/* Brand Logo */}
          <div className="p-5 border-b border-slate-800/80 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-rose-500 to-amber-400 p-[2px] flex items-center justify-center shadow-lg shadow-rose-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center font-black text-rose-400">
                ⚡
              </div>
            </div>
            <div>
              <h1 className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
                Arunaki<span className="text-rose-500">Nexus</span>
              </h1>
              <p className="text-[11px] text-slate-400 font-medium">TikTok Automation Studio</p>
            </div>
          </div>

          {/* Account Indicator */}
          <div className="mx-3 mt-4 p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-400 font-medium">Akun Aktif:</span>
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Connected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-rose-500 flex items-center justify-center text-xs font-bold">
                TT
              </div>
              <div className="truncate">
                <div className="text-xs font-bold text-white truncate">@arunaki.creator</div>
                <div className="text-[10px] text-slate-400">TikTok Business Official</div>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <nav className="p-3 space-y-1.5 mt-2">
            <button
              onClick={() => setActiveTab("studio")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === "studio"
                  ? "bg-rose-500 text-white shadow-lg shadow-rose-500/25"
                  : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
              }`}
            >
              <Video className="w-4 h-4" />
              <span>Studio Video</span>
            </button>

            <button
              onClick={() => setActiveTab("stock")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === "stock"
                  ? "bg-rose-500 text-white shadow-lg shadow-rose-500/25"
                  : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <Layers className="w-4 h-4" />
                <span>Stok Video</span>
              </div>
              <span className="bg-slate-800 text-xs px-2 py-0.5 rounded-full font-bold text-rose-300 border border-slate-700">
                {readyStockCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("schedule")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === "schedule"
                  ? "bg-rose-500 text-white shadow-lg shadow-rose-500/25"
                  : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Jadwal Posting</span>
            </button>

            <button
              onClick={() => setActiveTab("analytics")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === "analytics"
                  ? "bg-rose-500 text-white shadow-lg shadow-rose-500/25"
                  : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Analitik TikTok</span>
            </button>

            <button
              onClick={() => setActiveTab("settings")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === "settings"
                  ? "bg-rose-500 text-white shadow-lg shadow-rose-500/25"
                  : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Pengaturan</span>
            </button>
          </nav>
        </div>

        {/* Footer Info */}
        <div className="p-4 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
          <span>Engine: Remotion v4</span>
          <span className="font-mono text-emerald-400">Desktop v0.1</span>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden relative">
        {/* Notification Toast */}
        {notification && (
          <div className="absolute top-5 right-6 z-50 bg-slate-800 border border-emerald-500/50 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{notification}</span>
          </div>
        )}

        {/* TAB 1: STUDIO (EDITOR & REMOTION PLAYER) */}
        {activeTab === "studio" && (
          <div className="flex-1 flex h-full overflow-hidden">
            {/* Left/Middle: Live Remotion Player Preview */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-950 relative border-r border-slate-800/80">
              <div className="w-full flex items-center justify-between mb-3 px-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Live Remotion Canvas
                  </span>
                  <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-md font-mono">
                    9:16 Vertical (1080x1920)
                  </span>
                </div>
                <div className="text-xs text-slate-400">FPS: 30 | 5 Detik</div>
              </div>

              {/* Remotion Player Container */}
              <div className="w-full max-w-[340px] aspect-[9/16] rounded-2xl overflow-hidden shadow-2xl shadow-rose-950/30 border-2 border-slate-800 bg-black flex items-center justify-center">
                <Player
                  component={TikTokVideo}
                  inputProps={props}
                  durationInFrames={150}
                  fps={30}
                  compositionWidth={1080}
                  compositionHeight={1920}
                  style={{
                    width: "100%",
                    height: "100%",
                  }}
                  controls
                  loop
                  autoPlay
                />
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-2 mt-4">
                <span className="text-xs text-slate-400 font-medium">Tema:</span>
                {(["emerald", "violet", "rose", "amber", "cyan"] as const).map((color) => (
                  <button
                    key={color}
                    onClick={() => setProps({ ...props, themeColor: color })}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${
                      props.themeColor === color
                        ? "scale-125 border-white shadow-lg"
                        : "border-transparent opacity-70 hover:opacity-100"
                    }`}
                    style={{
                      background:
                        color === "emerald"
                          ? "#10b981"
                          : color === "violet"
                          ? "#a855f7"
                          : color === "rose"
                          ? "#f43f5e"
                          : color === "amber"
                          ? "#f59e0b"
                          : "#06b6d4",
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Right: Inspector / Props Editor */}
            <div className="w-96 bg-slate-900/60 p-6 flex flex-col justify-between overflow-y-auto">
              <div className="space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Editor Konten
                  </h2>
                  <button
                    onClick={handleAiGenerate}
                    className="flex items-center gap-1.5 text-xs font-bold text-cyan-400 bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-800/60 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Auto AI</span>
                  </button>
                </div>

                {/* Form: Category */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Kategori / Badge:
                  </label>
                  <input
                    type="text"
                    value={props.category}
                    onChange={(e) => setProps({ ...props, category: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-rose-500 font-medium"
                  />
                </div>

                {/* Form: Hook Text */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Hook Utama (Teks Pembuka):
                  </label>
                  <textarea
                    rows={3}
                    value={props.hookText}
                    onChange={(e) => setProps({ ...props, hookText: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500 font-medium resize-none leading-relaxed"
                  />
                </div>

                {/* Form: Body Lines */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Poin Konten (Satu baris per poin):
                  </label>
                  <textarea
                    rows={4}
                    value={props.bodyText}
                    onChange={(e) => setProps({ ...props, bodyText: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500 font-mono resize-none leading-relaxed"
                  />
                </div>

                {/* Form: Author Handle */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Akun TikTok Watermark:
                  </label>
                  <input
                    type="text"
                    value={props.authorHandle}
                    onChange={(e) => setProps({ ...props, authorHandle: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-rose-500 font-medium"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-5 border-t border-slate-800 space-y-3">
                {isRendering ? (
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-300">Merender Frame MP4...</span>
                      <span className="text-rose-400 font-mono">{renderProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-rose-500 h-full transition-all duration-200"
                        style={{ width: `${renderProgress}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleRenderToStock}
                    className="w-full bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-bold py-3 px-4 rounded-xl text-sm shadow-xl shadow-rose-500/25 flex items-center justify-center gap-2 transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span>Render & Masukkan ke Stok Video</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: STOK VIDEO (CONTENT VAULT) */}
        {activeTab === "stock" && (
          <div className="p-8 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-black text-white">Stok Persediaan Video (Content Vault)</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Kumpulan video yang sudah dirender dan siap dipublikasikan ke TikTok.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Stok Aman ({readyStockCount} Video Siap)</span>
                </div>
                <button
                  onClick={() => setActiveTab("studio")}
                  className="bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-colors shadow-lg shadow-rose-500/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Video Baru</span>
                </button>
              </div>
            </div>

            {/* Video Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {stock.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-0.5 rounded-lg">
                        {item.category}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          item.status === "ready"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                            : item.status === "scheduled"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                            : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                        }`}
                      >
                        {item.status === "ready"
                          ? "Siap Upload"
                          : item.status === "scheduled"
                          ? "Terjadwal"
                          : "Published"}
                      </span>
                    </div>

                    <h3 className="font-bold text-sm text-white line-clamp-2 leading-snug mb-2">
                      {item.title}
                    </h3>
                    <div className="text-[11px] text-slate-400 flex items-center gap-3">
                      <span>⏱ {item.duration}</span>
                      <span>•</span>
                      <span>Dirender: {item.renderedAt}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-5 pt-4 border-t border-slate-800/80">
                    <button
                      onClick={() => showNotification(`Memilih "${item.title}" untuk diupload!`)}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Share2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>Upload TikTok</span>
                    </button>
                    <button
                      onClick={() => setActiveTab("schedule")}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white p-2 rounded-xl transition-colors"
                      title="Jadwalkan"
                    >
                      <Calendar className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: JADWAL POSTING (SCHEDULER) */}
        {activeTab === "schedule" && (
          <div className="p-8 flex-1 overflow-y-auto">
            <div className="mb-6">
              <h2 className="text-xl font-black text-white">Kalender Penjadwalan TikTok</h2>
              <p className="text-xs text-slate-400 mt-1">
                Jadwalkan publikasi video di jam-jam prime time TikTok agar jangkauan FYP maksimal.
              </p>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-rose-400" />
                <span>Slot Jadwal Otomatis (Rekomendasi FYP):</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl">
                  <div className="text-xs font-bold text-rose-400 mb-1">Slot Siang: 12:00 WIB</div>
                  <div className="text-xs text-slate-300 font-semibold mb-2">
                    "3 Kebiasaan Pagi Orang Sukses"
                  </div>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                    Siap Tayang Hari Ini
                  </span>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl">
                  <div className="text-xs font-bold text-amber-400 mb-1">Slot Sore: 18:00 WIB</div>
                  <div className="text-xs text-slate-300 font-semibold mb-2">
                    "Stop Lakukan Ini Kalau Mau Disiplin"
                  </div>
                  <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full font-bold">
                    Terjadwal Otomatis
                  </span>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl border-dashed flex flex-col items-center justify-center text-center p-6">
                  <div className="text-xs font-bold text-slate-400 mb-2">Slot Malam: 21:00 WIB</div>
                  <button
                    onClick={() => setActiveTab("stock")}
                    className="text-xs font-bold text-rose-400 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Pilih dari Stok Video
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: ANALITIK TIKTOK (VIEWS & LIKES MONITORING) */}
        {activeTab === "analytics" && (
          <div className="p-8 flex-1 overflow-y-auto space-y-6">
            <div>
              <h2 className="text-xl font-black text-white">Monitoring Akun & Performa TikTok</h2>
              <p className="text-xs text-slate-400 mt-1">
                Data real-time interaksi, tayangan video, dan pertumbuhan followers akun Anda.
              </p>
            </div>

            {/* Metric KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
                <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-2">
                  <span>Total Views Video</span>
                  <Eye className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="text-2xl font-black text-white">482.5K</div>
                <div className="text-[11px] text-emerald-400 font-bold mt-1.5 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  <span>+18.4% minggu ini</span>
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
                <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-2">
                  <span>Total Likes</span>
                  <Heart className="w-4 h-4 text-rose-500" />
                </div>
                <div className="text-2xl font-black text-white">39.2K</div>
                <div className="text-[11px] text-emerald-400 font-bold mt-1.5 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  <span>+12.1% minggu ini</span>
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
                <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-2">
                  <span>Followers Akun</span>
                  <Users className="w-4 h-4 text-violet-400" />
                </div>
                <div className="text-2xl font-black text-white">14.8K</div>
                <div className="text-[11px] text-emerald-400 font-bold mt-1.5 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  <span>+620 follower baru</span>
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
                <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-2">
                  <span>Status Algoritma FYP</span>
                  <Flame className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-black text-amber-400">High Score</div>
                <div className="text-[11px] text-slate-400 mt-1.5">Posting konsisten aktif</div>
              </div>
            </div>

            {/* Performance Breakdown Table */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-sm font-bold text-white mb-4">Tabel Performa Video Terbit</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                      <th className="pb-3">Judul Konten</th>
                      <th className="pb-3">Tanggal Tayang</th>
                      <th className="pb-3">Views</th>
                      <th className="pb-3">Likes</th>
                      <th className="pb-3">Status FYP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    <tr>
                      <td className="py-3 font-bold text-white">5 Tools AI Gratis yang Jarang Diketahui</td>
                      <td className="py-3 text-slate-400">2 Nov 2026</td>
                      <td className="py-3 font-mono text-cyan-400 font-bold">142,800</td>
                      <td className="py-3 font-mono text-rose-400">18,400</td>
                      <td className="py-3">
                        <span className="bg-rose-500/10 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          🔥 Trending FYP
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 font-bold text-white">Cara Atur Gaji UMR Biar Punya Tabungan</td>
                      <td className="py-3 text-slate-400">1 Nov 2026</td>
                      <td className="py-3 font-mono text-cyan-400 font-bold">89,200</td>
                      <td className="py-3 font-mono text-rose-400">9,150</td>
                      <td className="py-3">
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          Normal
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: SETTINGS */}
        {activeTab === "settings" && (
          <div className="p-8 flex-1 overflow-y-auto">
            <h2 className="text-xl font-black text-white mb-2">Pengaturan Desktop</h2>
            <p className="text-xs text-slate-400 mb-6">
              Konfigurasi penyimpanan lokal, akun TikTok resmi, dan AI API Keys.
            </p>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 max-w-xl space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Folder Penyimpanan Video (Lokal):
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value="E:\Videos\ArunakiNexus"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 font-mono"
                  />
                  <button className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-xl font-semibold">
                    Ubah Folder
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Google Gemini API Key (Opsional untuk AI Auto-Script):
                </label>
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};


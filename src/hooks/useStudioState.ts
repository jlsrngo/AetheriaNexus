import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { TikTokVideoProps, defaultTikTokProps } from "../remotion/types";
import {
  StockVideoItem,
  TabType,
  TikTokAccountMetrics,
  TikTokVideoMetric,
  ModelProvider,
  CliItemStatus,
} from "../types";
import { INITIAL_PROVIDERS } from "../constants/providers";
import { generateContentScript } from "../services/aiService";

const FALLBACK_STOCK: StockVideoItem[] = [
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
];

const DEFAULT_METRICS: TikTokAccountMetrics = {
  total_views: 482500,
  total_likes: 39200,
  followers: 14800,
  fyp_score: "HIGH_94/100",
  weekly_growth_percent: 18.4,
  connected_account: "@arunaki.creator",
  auth_status: "ACTIVE_CONNECTED",
};

const DEFAULT_FEED: TikTokVideoMetric[] = [
  {
    id: "tt-01",
    title: "5 Tools AI Gratis yang Jarang Diketahui",
    published_date: "02.11.2026",
    views: 142800,
    likes: 18400,
    comments: 420,
    shares: 1280,
    fyp_status: "FYP_VIRAL",
  },
  {
    id: "tt-02",
    title: "Cara Atur Gaji UMR Biar Punya Tabungan",
    published_date: "01.11.2026",
    views: 89200,
    likes: 9150,
    comments: 195,
    shares: 512,
    fyp_status: "OPTIMAL",
  },
];

export function useStudioState() {
  const [activeTab, setActiveTab] = useState<TabType>("studio");
  const [props, setProps] = useState<TikTokVideoProps>(defaultTikTokProps);
  const [stock, setStock] = useState<StockVideoItem[]>(FALLBACK_STOCK);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [outputDir, setOutputDir] = useState("E:\\Videos\\ArunakiNexus");
  const [metrics, setMetrics] = useState<TikTokAccountMetrics>(DEFAULT_METRICS);
  const [feed, setFeed] = useState<TikTokVideoMetric[]>(DEFAULT_FEED);
  const [providers, setProviders] = useState<ModelProvider[]>(INITIAL_PROVIDERS);
  const [cliStatus, setCliStatus] = useState<Record<string, CliItemStatus>>({});

  const loadPersistentData = useCallback(async () => {
    const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    if (!isTauri) return;

    try {
      const records = await invoke<
        Array<{
          id: string;
          title: string;
          category: string;
          duration: string;
          rendered_at: string;
          status: "ready" | "scheduled" | "published";
          theme: TikTokVideoProps["themeColor"];
          file_path?: string;
        }>
      >("get_stock_videos");

      if (records && records.length > 0) {
        setStock(
          records.map((r) => ({
            id: r.id,
            title: r.title,
            category: r.category,
            duration: r.duration,
            renderedAt: r.rendered_at,
            status: r.status,
            theme: r.theme,
            filePath: r.file_path,
          }))
        );
      }

      // Load saved providers
      const savedProviders = await invoke<string | null>("get_setting", { key: "ai_providers_json" });
      if (savedProviders) {
        try {
          const parsed = JSON.parse(savedProviders);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setProviders(parsed);
          }
        } catch {}
      } else {
        // Migration: check legacy gemini_api_key
        const legacyKey = await invoke<string | null>("get_setting", { key: "gemini_api_key" });
        if (legacyKey) {
          setProviders((prev) =>
            prev.map((p) => (p.type === "gemini" ? { ...p, apiKey: legacyKey } : p))
          );
        }
      }

      // Detect local CLIs via Rust
      const clis = await invoke<Record<string, CliItemStatus>>("detect_local_clis");
      if (clis) setCliStatus(clis);

      const dir = await invoke<string | null>("get_setting", { key: "output_directory" });
      if (dir) setOutputDir(dir);

      // Fetch TikTok telemetry from Rust
      const rustMetrics = await invoke<TikTokAccountMetrics>("get_tiktok_account_metrics");
      if (rustMetrics) setMetrics(rustMetrics);

      const rustFeed = await invoke<TikTokVideoMetric[]>("get_tiktok_feed_metrics");
      if (rustFeed) setFeed(rustFeed);
    } catch (e) {
      console.warn("Tauri Rust loader skipped or error:", e);
    }
  }, []);

  const handleRefreshClis = async () => {
    const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    if (isTauri) {
      try {
        const clis = await invoke<Record<string, CliItemStatus>>("detect_local_clis");
        if (clis) setCliStatus(clis);
      } catch (e) {
        console.warn("CLI scan error:", e);
      }
    }
  };

  const handleSaveProviders = async (updated: ModelProvider[]) => {
    setProviders(updated);
    const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    if (isTauri) {
      try {
        await invoke("save_setting", {
          key: "ai_providers_json",
          value: JSON.stringify(updated),
        });
      } catch (e) {
        console.warn("Save providers failed:", e);
      }
    }
  };

  useEffect(() => {
    loadPersistentData();

    let unlistenProgress: (() => void) | undefined;
    let unlistenScheduler: (() => void) | undefined;

    listen<{ percent: number; message: string }>("render-progress", (event) => {
      setRenderProgress(event.payload.percent);
    }).then((fn) => {
      unlistenProgress = fn;
    }).catch(() => {});

    listen<{ message: string; video_id: string; title: string }>(
      "tiktok-scheduled-dispatch",
      () => {
        loadPersistentData();
      }
    ).then((fn) => {
      unlistenScheduler = fn;
    }).catch(() => {});

    return () => {
      if (unlistenProgress) unlistenProgress();
      if (unlistenScheduler) unlistenScheduler();
    };
  }, [loadPersistentData]);

  const handleAiGenerate = async (topic?: string) => {
    const activeP = providers.find((p) => p.active) || providers[0];
    const script = await generateContentScript(topic, activeP);
    setProps((prev) => ({
      ...prev,
      hookText: script.hook,
      bodyText: script.body,
      category: script.category,
      themeColor: script.theme,
    }));
  };

  const handleRenderToStock = async () => {
    setIsRendering(true);
    setRenderProgress(5);

    try {
      const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

      if (isTauri) {
        const result = await invoke<{ success: boolean; output_path: string }>("render_tiktok_video", {
          propsJson: JSON.stringify(props),
          outputPath: null,
        });

        const newItem: StockVideoItem = {
          id: `v-${Date.now().toString().slice(-4)}`,
          title: props.hookText,
          category: props.category,
          duration: "00:05",
          renderedAt: "Baru saja",
          status: "ready",
          theme: props.themeColor,
          filePath: result.output_path,
        };

        await invoke("save_stock_video", {
          item: {
            id: newItem.id,
            title: newItem.title,
            category: newItem.category,
            duration: newItem.duration,
            rendered_at: newItem.renderedAt,
            status: newItem.status,
            theme: newItem.theme,
            file_path: newItem.filePath,
          },
        });

        setStock((prev) => [newItem, ...prev]);
      } else {
        let current = 10;
        const interval = setInterval(() => {
          current += 15;
          setRenderProgress(Math.min(100, current));
          if (current >= 100) {
            clearInterval(interval);
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
          }
        }, 250);
        return;
      }
    } catch (err) {
      console.warn("Render error:", err);
    } finally {
      setIsRendering(false);
      setRenderProgress(0);
    }
  };

  const handlePublishToTikTok = async (item: StockVideoItem) => {
    const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    if (isTauri) {
      try {
        await invoke<{ success: boolean; message: string; post_url: string }>(
          "publish_to_tiktok",
          {
            id: item.id,
            title: item.title,
            filePath: item.filePath || null,
          }
        );
        setStock((prev) =>
          prev.map((s) => (s.id === item.id ? { ...s, status: "published" } : s))
        );
      } catch (e) {
        console.warn("TikTok upload error:", e);
      }
    } else {
      setStock((prev) =>
        prev.map((s) => (s.id === item.id ? { ...s, status: "published" } : s))
      );
    }
  };

  const handleScheduleVideo = async (id: string, slotTime: string) => {
    const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    if (isTauri) {
      try {
        await invoke("schedule_video", { id, slotTime });
        setStock((prev) =>
          prev.map((s) => (s.id === id ? { ...s, status: "scheduled" } : s))
        );
      } catch (e) {
        console.warn("Schedule error:", e);
      }
    } else {
      setStock((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: "scheduled" } : s))
      );
    }
  };

  const handleSaveOutputDir = async (dir: string) => {
    setOutputDir(dir);
    const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    if (isTauri) {
      try {
        await invoke("save_setting", { key: "output_directory", value: dir });
      } catch (e) {
        console.warn("Save output directory error:", e);
      }
    }
  };

  const handleDeleteStock = async (id: string) => {
    const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    if (isTauri) {
      try {
        await invoke("delete_stock_video", { id });
      } catch (e) {
        console.warn("Delete stock video failed:", e);
      }
    }
    setStock((prev) => prev.filter((item) => item.id !== id));
  };

  const readyStockCount = stock.filter((s) => s.status === "ready").length;

  return {
    activeTab,
    setActiveTab,
    props,
    setProps,
    stock,
    isRendering,
    renderProgress,
    handleAiGenerate,
    handleRenderToStock,
    handlePublishToTikTok,
    handleScheduleVideo,
    handleDeleteStock,
    outputDir,
    handleSaveOutputDir,
    metrics,
    feed,
    readyStockCount,
    providers,
    handleSaveProviders,
    cliStatus,
    handleRefreshClis,
  };
}

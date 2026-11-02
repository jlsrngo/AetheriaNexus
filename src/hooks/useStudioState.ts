import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { TikTokVideoProps, defaultTikTokProps } from "../remotion/types";
import { StockVideoItem, TabType } from "../types";

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

export function useStudioState() {
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

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    // Listen to Tauri progress event if inside Tauri desktop window
    listen<{ percent: number; message: string }>("render-progress", (event) => {
      setRenderProgress(event.payload.percent);
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {
        // Not in Tauri environment or error listening
      });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

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

  const handleRenderToStock = async () => {
    setIsRendering(true);
    setRenderProgress(5);

    try {
      // Check if Tauri runtime is available
      const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

      if (isTauri) {
        showNotification("⚙️ Memicu render MP4 via Tauri Rust engine...");
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

        setStock((prev) => [newItem, ...prev]);
        showNotification(`🎉 Render sukses! Tersimpan di: ${result.output_path}`);
      } else {
        // Fallback simulation for browser dev mode
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
            showNotification("🎉 Video berhasil dirender dan masuk ke Stok Video!");
          }
        }, 250);
        return;
      }
    } catch (err) {
      showNotification(`❌ Error render: ${err}`);
    } finally {
      setIsRendering(false);
      setRenderProgress(0);
    }
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
    notification,
    showNotification,
    handleAiGenerate,
    handleRenderToStock,
    readyStockCount,
  };
}

import { useState, useEffect, useCallback } from "react";
import type { StockVideoItem, StockVideoStatus } from "../types/stock";

const STORAGE_KEY = "arunaki_video_stock_inventory";

export const DEFAULT_STOCK_ITEMS: StockVideoItem[] = [
  {
    id: "vid-rust-001",
    title: "How an Elevator Crash Created Rust Language",
    hook: "In 2006, an elevator crash forced Graydon Hoare to build the safest language in tech.",
    ratio: "9:16",
    durationSec: 5,
    niche: "ENGINEERING",
    status: "ready",
    renderedAt: "2026-11-06 15:10",
    fileSize: "16.8 MB",
    resolution: "1080×1920",
    outputPath: "output/rust-origin-blueprint.mp4",
    caption: "The architectural origin of Rust: from a Vancouver elevator crash to the Linux Kernel & Windows Core. Architectural blueprint HUD style. ⚙ #rustlang #coding #systemdesign #techtok",
    tags: ["#rustlang", "#coding", "#systemarchitecture", "#blueprint", "#techtok"],
    views: 89400,
    likes: 9200,
  },
  {
    id: "vid-001",
    title: "3 Morning Habits of High Performers",
    hook: "The first 60 minutes decide your next 10 years. Stop doing this.",
    ratio: "9:16",
    durationSec: 5,
    niche: "PRODUCTIVITY",
    status: "ready",
    renderedAt: "2026-11-06 10:15",
    fileSize: "14.2 MB",
    resolution: "1080×1920",
    outputPath: "out/vid-001.mp4",
    caption: "The morning blueprint top 1% use daily. Save this before tomorrow morning! ⚡",
    tags: ["#productivity", "#habits", "#mindset", "#fyp", "#morningroutine"],
    views: 142800,
    likes: 12400,
  },
  {
    id: "vid-002",
    title: "Why 99% Fail At Compound Interest",
    hook: "If you invest $100 today, here is what banks do not tell you.",
    ratio: "9:16",
    durationSec: 15,
    niche: "FINANCE",
    status: "scheduled",
    renderedAt: "2026-11-06 09:30",
    fileSize: "38.5 MB",
    resolution: "1080×1920",
    outputPath: "out/vid-002.mp4",
    caption: "The hidden truth about compound growth. Share with someone who needs this!",
    tags: ["#finance", "#investing", "#wealth", "#moneytok", "#passiveincome"],
    views: 27900,
    likes: 1900,
  },
  {
    id: "vid-003",
    title: "The 2-Minute Dopamine Reset Rule",
    hook: "Feeling constantly exhausted? Reset your receptors right now.",
    ratio: "9:16",
    durationSec: 30,
    niche: "PSYCHOLOGY",
    status: "ready",
    renderedAt: "2026-11-05 18:40",
    fileSize: "62.1 MB",
    resolution: "1080×1920",
    outputPath: "out/vid-003.mp4",
    caption: "Instant brain reset for chronic doom-scrollers. Try this before sleeping.",
    tags: ["#psychology", "#focus", "#dopaminedetox", "#mentalhealth", "#fyp"],
    views: 78200,
    likes: 6800,
  },
  {
    id: "vid-004",
    title: "5 Rules for Deep Work and Zero Burnout",
    hook: "How to get 8 hours of focused output done in just 90 minutes.",
    ratio: "9:16",
    durationSec: 20,
    niche: "PRODUCTIVITY",
    status: "ready",
    renderedAt: "2026-11-05 14:10",
    fileSize: "44.8 MB",
    resolution: "1080×1920",
    outputPath: "out/vid-004.mp4",
    caption: "Cal Newport's secret deep work protocol adapted for high-stress founders.",
    tags: ["#deepwork", "#productivity", "#career", "#focus", "#worksmart"],
    views: 45100,
    likes: 3950,
  },
  {
    id: "vid-005",
    title: "The Secret Psychology of Luxury Branding",
    hook: "Why rich people buy silence and minimal logos while others buy hype.",
    ratio: "9:16",
    durationSec: 25,
    niche: "MARKETING",
    status: "published",
    renderedAt: "2026-11-04 16:50",
    fileSize: "51.3 MB",
    resolution: "1080×1920",
    outputPath: "out/vid-005.mp4",
    caption: "Quiet luxury is not a trend, it is a defensive signaling mechanism.",
    tags: ["#branding", "#marketing", "#luxury", "#business", "#psychology"],
    views: 189400,
    likes: 16700,
  },
];

export function useVideoStock() {
  const [stock, setStock] = useState<StockVideoItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_STOCK_ITEMS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stock));
    } catch {}
  }, [stock]);

  const addStockItem = useCallback((item: Omit<StockVideoItem, "id" | "renderedAt">) => {
    const newItem: StockVideoItem = {
      ...item,
      id: `vid-${Date.now().toString(36)}`,
      renderedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
    };
    setStock((prev) => [newItem, ...prev]);
    return newItem;
  }, []);

  const updateStockStatus = useCallback((id: string, status: StockVideoStatus) => {
    setStock((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status } : item))
    );
  }, []);

  const deleteStockItem = useCallback((id: string) => {
    setStock((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const resetToDefaults = useCallback(() => {
    setStock(DEFAULT_STOCK_ITEMS);
  }, []);

  return {
    stock,
    addStockItem,
    updateStockStatus,
    deleteStockItem,
    resetToDefaults,
  };
}


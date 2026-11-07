import { useState, useEffect, useCallback } from "react";
import type { ScheduledPost } from "../types/schedule";
import type { StockVideoItem } from "../types/stock";

const STORAGE_KEY = "aetheria_schedule_posts";

export const DEFAULT_SCHEDULED_POSTS: ScheduledPost[] = [
  {
    id: "sched-1",
    stockId: "vid-002",
    videoTitle: "Why 99% Fail At Compound Interest",
    hook: "If you invest $100 today, here is what banks do not tell you.",
    scheduledDate: "TODAY",
    scheduledTime: "18:00 WIB (Peak Audience)",
    platform: "TikTok (P0)",
    status: "queued",
    caption: "The hidden truth about compound growth. Share with someone who needs this!",
    tags: ["#finance", "#investing", "#wealth", "#moneytok", "#passiveincome"],
    privacy: "public",
    allowComments: true,
    allowDuet: true,
    allowStitch: true,
  },
  {
    id: "sched-2",
    stockId: "vid-001",
    videoTitle: "3 Morning Habits of High Performers",
    hook: "The first 60 minutes decide your next 10 years. Stop doing this.",
    scheduledDate: "TOMORROW",
    scheduledTime: "12:30 WIB (Lunch Break)",
    platform: "TikTok (P0)",
    status: "queued",
    caption: "The morning blueprint top 1% use daily. Save this before tomorrow morning! ⚡",
    tags: ["#productivity", "#habits", "#mindset", "#fyp", "#morningroutine"],
    privacy: "public",
    allowComments: true,
    allowDuet: true,
    allowStitch: true,
  },
  {
    id: "sched-3",
    stockId: "vid-005",
    videoTitle: "The Secret Psychology of Luxury Branding",
    hook: "Why rich people buy silence and minimal logos while others buy hype.",
    scheduledDate: "YESTERDAY",
    scheduledTime: "20:00 WIB",
    platform: "TikTok (P0)",
    status: "posted",
    postedAt: "2026-11-05 20:00",
    caption: "Quiet luxury is not a trend, it is a defensive signaling mechanism.",
    tags: ["#branding", "#marketing", "#luxury", "#business", "#psychology"],
    privacy: "public",
    allowComments: true,
    allowDuet: true,
    allowStitch: true,
  },
];

export function useScheduleStore() {
  const [schedule, setSchedule] = useState<ScheduledPost[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_SCHEDULED_POSTS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(schedule));
    } catch {}
  }, [schedule]);

  const queuePost = useCallback((post: Omit<ScheduledPost, "id">) => {
    const newPost: ScheduledPost = {
      ...post,
      id: `sched-${Date.now().toString(36)}`,
    };
    setSchedule((prev) => [newPost, ...prev]);
    return newPost;
  }, []);

  const updatePostTime = useCallback((id: string, date: string, time: string) => {
    setSchedule((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, scheduledDate: date, scheduledTime: time } : item
      )
    );
  }, []);

  const cancelPost = useCallback((id: string) => {
    setSchedule((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const markPublished = useCallback((id: string) => {
    setSchedule((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "posted",
              postedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
            }
          : item
      )
    );
  }, []);

  const autoScheduleStock = useCallback((readyItems: StockVideoItem[]) => {
    const slots = [
      { date: "TODAY", time: "18:00 WIB (Peak Audience)" },
      { date: "TODAY", time: "20:30 WIB (Prime Night)" },
      { date: "TOMORROW", time: "12:30 WIB (Lunch Break)" },
      { date: "TOMORROW", time: "18:00 WIB (Peak Audience)" },
      { date: "TOMORROW", time: "20:30 WIB (Prime Night)" },
    ];

    const newPosts: ScheduledPost[] = readyItems.slice(0, slots.length).map((item, idx) => ({
      id: `sched-auto-${Date.now()}-${idx}`,
      stockId: item.id,
      videoTitle: item.title,
      hook: item.hook,
      scheduledDate: slots[idx].date,
      scheduledTime: slots[idx].time,
      platform: "TikTok (P0)",
      status: "queued",
      caption: item.caption,
      tags: item.tags,
      privacy: "public",
      allowComments: true,
      allowDuet: true,
      allowStitch: true,
    }));

    setSchedule((prev) => [...newPosts, ...prev]);
    return newPosts;
  }, []);

  return {
    schedule,
    queuePost,
    updatePostTime,
    cancelPost,
    markPublished,
    autoScheduleStock,
  };
}


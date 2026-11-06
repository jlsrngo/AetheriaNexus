export type SchedulePlatform = "TikTok (P0)" | "Instagram Reels" | "YouTube Shorts";
export type ScheduleStatus = "queued" | "posted" | "failed";

export interface ScheduledPost {
  id: string;
  stockId?: string;
  videoTitle: string;
  hook: string;
  scheduledTime: string;
  scheduledDate: string;
  platform: SchedulePlatform;
  status: ScheduleStatus;
  caption: string;
  tags: string[];
  privacy: "public" | "friends" | "private";
  allowComments: boolean;
  allowDuet: boolean;
  allowStitch: boolean;
  postedAt?: string;
}

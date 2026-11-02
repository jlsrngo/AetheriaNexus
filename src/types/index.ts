import { TikTokVideoProps } from "../remotion/types";

export type TabType = "studio" | "stock" | "schedule" | "analytics" | "settings";

export interface StockVideoItem {
  id: string;
  title: string;
  category: string;
  duration: string;
  renderedAt: string;
  status: "ready" | "scheduled" | "published";
  theme: TikTokVideoProps["themeColor"];
  filePath?: string;
}

export interface TikTokMetricKPI {
  totalViews: string;
  totalLikes: string;
  followers: string;
  fypScore: string;
}


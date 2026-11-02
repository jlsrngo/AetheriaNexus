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

export interface TikTokAccountMetrics {
  total_views: number;
  total_likes: number;
  followers: number;
  fyp_score: string;
  weekly_growth_percent: number;
  connected_account: string;
  auth_status: string;
}

export interface TikTokVideoMetric {
  id: string;
  title: string;
  published_date: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  fyp_status: string;
}

export interface ModelProvider {
  id: string;
  name: string;
  type: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  active: boolean;
}

export interface CliItemStatus {
  id: string;
  name: string;
  vendor?: string;
  installed: boolean;
  path?: string;
  logged_in: boolean;
  credential_path?: string;
  account_email?: string;
  default_model: string;
  available_models: string[];
  docs_url?: string;
  login_command?: string;
  entitlement?: string;
  note?: string;
}


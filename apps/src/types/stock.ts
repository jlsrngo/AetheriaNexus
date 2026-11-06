export type StockVideoStatus = "ready" | "scheduled" | "published" | "draft";

export interface StockVideoItem {
  id: string;
  title: string;
  hook: string;
  ratio: "9:16" | "16:9" | "1:1";
  durationSec: number;
  niche: string;
  status: StockVideoStatus;
  renderedAt: string;
  fileSize: string;
  resolution: string;
  outputPath?: string;
  caption: string;
  tags: string[];
  views?: number;
  likes?: number;
}

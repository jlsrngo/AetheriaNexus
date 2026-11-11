export interface CenterTab {
  id: string;
  type: "file" | "canvas" | "stage" | "app" | "diff";
  title: string;
  path?: string;
  fileType?: string;
  content?: string;
  encoding?: "utf-8" | "base64";
  mimeType?: string;
  mediaUrl?: string;
  originalContent?: string;
  beforeContent?: string;
  afterContent?: string;
  createdAt?: string;
  timeStr?: string;
}

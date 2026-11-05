import { NexusVideoProps } from "../remotion/types";

export type StudioThemeColor = "orange" | "emerald" | "violet" | "rose" | "amber" | "cyan";

export interface StudioComposition {
  id: string;
  name: string;
  folder: string;
  ratio: "9:16" | "1:1" | "16:9";
  duration: number; // in seconds
  fps: number;
  width: number;
  height: number;
  props: NexusVideoProps;
}

export interface StudioStaticAsset {
  id: string;
  name: string;
  type: "video" | "audio" | "image" | "data";
  size: string;
  bytes: number;
  path: string;
  relativePath: string;
}

export interface StudioRenderJob {
  renderId: string;
  compositionId: string;
  status: "pending" | "rendering" | "done" | "error";
  percent: number;
  renderedFrames: number;
  totalFrames: number;
  outputPath?: string;
  error?: string;
  createdAt: number;
}

export interface StudioSubtitleCue {
  id: string;
  startFrame: number;
  endFrame: number;
  startSec: number;
  endSec: number;
  text: string;
  words: string[];
  highlightKeyword?: string | null;
  color: string;
  scale: number;
}

export interface StudioGpuTelemetry {
  encoder: string;
  gpuVendor: string;
  gpuName: string;
  hardwareAccelerated: boolean;
  supportedCodecs: string[];
  memoryMb: number;
}

export interface StudioCanvasSettings {
  zoom: "fit" | 0.5 | 0.75 | 1 | 1.5;
  showGuides: boolean;
  showRulers: boolean;
  showGrid: boolean;
  gridCols: number;
  gridRows: number;
  showCheckerboard: boolean;
  showTimeline: boolean;
  loop: boolean;
  playbackRate: 0.5 | 1 | 1.5 | 2;
  inFrame: number | null;
  outFrame: number | null;
}


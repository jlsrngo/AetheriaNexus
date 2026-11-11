import { resolveWorkspaceAssetUrl } from "../../studio/htmlStageBundle";

export type TabPreviewKind =
  | "image"
  | "svg"
  | "audio"
  | "video"
  | "pdf"
  | "binary"
  | "text";

const IMAGE_EXTS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "bmp",
  "ico",
  "tiff",
  "avif",
]);

const AUDIO_EXTS = new Set([
  "wav",
  "mp3",
  "ogg",
  "m4a",
  "aac",
  "flac",
  "opus",
]);

const VIDEO_EXTS = new Set(["mp4", "mov", "webm", "mkv", "avi", "m4v"]);

const OTHER_BINARY_EXTS = new Set([
  "zip",
  "rar",
  "7z",
  "tar",
  "gz",
  "bz2",
  "exe",
  "dll",
  "bin",
  "wasm",
  "xlsx",
  "xls",
  "xlsm",
  "docx",
  "doc",
  "pptx",
  "ppt",
]);

export function getFileExtension(nameOrPath?: string | null): string {
  if (!nameOrPath) return "";
  const base = nameOrPath.split(/[\\/]/).pop() || "";
  const idx = base.lastIndexOf(".");
  return idx >= 0 ? base.slice(idx + 1).toLowerCase() : "";
}

export function isDirectMediaExtension(ext: string): boolean {
  const e = ext.toLowerCase();
  return IMAGE_EXTS.has(e) || AUDIO_EXTS.has(e) || VIDEO_EXTS.has(e) || e === "pdf";
}

export function isKnownBinaryExtension(ext: string): boolean {
  const e = ext.toLowerCase();
  return isDirectMediaExtension(e) || OTHER_BINARY_EXTS.has(e);
}

export function inferMimeType(ext: string): string {
  switch (ext.toLowerCase()) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "bmp":
      return "image/bmp";
    case "ico":
      return "image/x-icon";
    case "svg":
      return "image/svg+xml";
    case "avif":
      return "image/avif";
    case "wav":
      return "audio/wav";
    case "mp3":
      return "audio/mpeg";
    case "ogg":
    case "opus":
      return "audio/ogg";
    case "m4a":
      return "audio/mp4";
    case "aac":
      return "audio/aac";
    case "flac":
      return "audio/flac";
    case "mp4":
    case "m4v":
      return "video/mp4";
    case "mov":
      return "video/quicktime";
    case "webm":
      return "video/webm";
    case "mkv":
      return "video/x-matroska";
    case "avi":
      return "video/x-msvideo";
    case "pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}

/**
 * Classifies a center tab into its visual previewer or code editor mode.
 * Never renders binary or base64-encoded media payloads in the plain text editor.
 */
export function classifyTabPreview(params: {
  title?: string;
  path?: string;
  fileType?: string;
  encoding?: string;
  id?: string;
}): TabPreviewKind {
  const ext = getFileExtension(params.path || params.title) || (params.fileType || "").toLowerCase();
  const isSyntheticAppTab =
    Boolean(params.id?.startsWith("app-")) && params.encoding !== "base64";

  if (IMAGE_EXTS.has(ext)) return "image";
  if (ext === "svg") return "svg";
  if (AUDIO_EXTS.has(ext)) return "audio";
  if (VIDEO_EXTS.has(ext)) return "video";
  if (ext === "pdf" && !isSyntheticAppTab) return "pdf";
  if (params.encoding === "base64") return "binary";
  if (OTHER_BINARY_EXTS.has(ext) && !isSyntheticAppTab) return "binary";
  return "text";
}

/**
 * Converts a workspace file path (relative or absolute) to a normalized forward-slash
 * relative path when inside `activeFolder`, or null if outside `activeFolder`.
 */
export function toWorkspaceRelativePath(
  filePath: string,
  activeFolder?: string | null
): string | null {
  const cleanFile = filePath.trim().replace(/\\/g, "/");
  if (!cleanFile) return null;

  const isAbs = /^[a-zA-Z]:\//.test(cleanFile) || cleanFile.startsWith("/");
  if (!isAbs) {
    return cleanFile.replace(/^\.?\//, "");
  }

  if (!activeFolder) return null;
  const cleanRoot = activeFolder.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  if (!cleanRoot) return null;

  if (cleanFile.toLowerCase().startsWith(`${cleanRoot.toLowerCase()}/`)) {
    return cleanFile.slice(cleanRoot.length + 1);
  }
  return null;
}

/**
 * Resolves a playable/displayable URL for a media or binary workspace tab.
 */
export function resolveTabMediaUrl(params: {
  path?: string;
  title?: string;
  fileType?: string;
  mediaUrl?: string;
  mimeType?: string;
  content?: string;
  encoding?: string;
  activeFolder?: string | null;
}): string | null {
  if (params.mediaUrl) return params.mediaUrl;

  const target = params.path || params.title || "";
  const rel = target ? toWorkspaceRelativePath(target, params.activeFolder) : null;
  if (rel) {
    const cleanDir = params.activeFolder
      ? params.activeFolder.trim().replace(/\\/g, "/").replace(/\/+$/, "")
      : params.activeFolder;
    const wsUrl = resolveWorkspaceAssetUrl(rel, cleanDir);
    if (wsUrl) return wsUrl;
  }

  if (params.encoding === "base64" && params.content) {
    const mime =
      params.mimeType && params.mimeType !== "application/octet-stream"
        ? params.mimeType
        : inferMimeType(getFileExtension(target) || params.fileType || "");
    return `data:${mime};base64,${params.content}`;
  }

  return null;
}


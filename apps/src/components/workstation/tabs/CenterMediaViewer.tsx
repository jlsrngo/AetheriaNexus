import { memo, useState, type ReactNode } from "react";
import {
  Code2,
  ExternalLink,
  Eye,
  FileWarning,
  Film,
  Music,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { apiFetch } from "../../../lib/api";
import { cn } from "../../../lib/utils";
import { getFileIcon } from "../../workspace/tree-utils";
import { CenterTab } from "./types";
import {
  getFileExtension,
  inferMimeType,
  resolveTabMediaUrl,
  type TabPreviewKind,
} from "./fileMediaUtils";

interface CenterMediaViewerProps {
  tab: CenterTab;
  kind: Exclude<TabPreviewKind, "text">;
  activeFolder?: string;
  renderSvgEditor?: () => ReactNode;
}

export const CenterMediaViewer = memo(function CenterMediaViewer({
  tab,
  kind,
  activeFolder,
  renderSvgEditor,
}: CenterMediaViewerProps) {
  const [svgSourceMode, setSvgSourceMode] = useState(false);
  const [imageZoom, setImageZoom] = useState<"fit" | number>("fit");
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const src = resolveTabMediaUrl({
    path: tab.path,
    title: tab.title,
    fileType: tab.fileType,
    mediaUrl: tab.mediaUrl,
    mimeType: tab.mimeType,
    content: tab.content,
    encoding: tab.encoding,
    activeFolder,
  });

  const ext = (getFileExtension(tab.path || tab.title) || tab.fileType || "").toUpperCase();
  const mime =
    tab.mimeType || inferMimeType(getFileExtension(tab.path || tab.title) || tab.fileType || "");

  const handleOpenExternal = async () => {
    const target = tab.path || tab.title;
    if (!target) return;
    try {
      await apiFetch("/api/desktop/open-path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath: target }),
      });
    } catch {
      // Non-fatal fallback
    }
  };

  if (kind === "svg" && svgSourceMode && renderSvgEditor) {
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg-editor)]">
        <div className="h-8 px-3 border-b border-[var(--border-color)] bg-[var(--bg-panel)] flex items-center justify-between text-[11px] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {getFileIcon(tab.title)}
            <span className="truncate font-medium text-[var(--text-primary)]">{tab.title}</span>
            <span className="px-1.5 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-color)] font-mono text-[10px] text-[var(--text-muted)]">
              SVG Source
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSvgSourceMode(false)}
            className="px-2 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-color)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] flex items-center gap-1 cursor-pointer"
          >
            <Eye className="w-3 h-3" />
            <span>Preview</span>
          </button>
        </div>
        {renderSvgEditor()}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0A0A0C] text-[var(--text-primary)]">
      {/* Header Bar */}
      <div className="h-8 px-3 border-b border-[var(--border-color)] bg-[var(--bg-panel)] flex items-center justify-between gap-2 text-[11px] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {getFileIcon(tab.title)}
          <span className="font-medium truncate">{tab.title}</span>
          {ext && (
            <span className="px-1.5 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-color)] font-mono text-[10px] text-[var(--text-muted)] shrink-0">
              {ext}
            </span>
          )}
          {imgDims && (kind === "image" || kind === "svg") && (
            <span className="font-mono text-[10px] text-[var(--text-muted)] shrink-0">
              {imgDims.w}×{imgDims.h} px
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {(kind === "image" || kind === "svg") && (
            <div className="flex items-center gap-1 px-1.5 h-6 rounded-md bg-[var(--bg-card)] border border-[var(--border-color)]">
              <button
                type="button"
                onClick={() => setImageZoom("fit")}
                className={cn(
                  "px-1.5 h-4 rounded text-[10px] font-mono cursor-pointer transition-colors",
                  imageZoom === "fit"
                    ? "bg-[var(--bg-hover)] text-[var(--text-primary)] font-semibold"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                )}
              >
                Fit
              </button>
              <button
                type="button"
                onClick={() =>
                  setImageZoom((z) =>
                    Math.max(0.25, Number(((typeof z === "number" ? z : 1) * 0.8).toFixed(2)))
                  )
                }
                title="Zoom Out"
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5 cursor-pointer"
              >
                <ZoomOut className="w-3 h-3" />
              </button>
              <span className="font-mono text-[10px] text-[var(--text-secondary)] min-w-[34px] text-center">
                {imageZoom === "fit" ? "Fit" : `${Math.round(imageZoom * 100)}%`}
              </span>
              <button
                type="button"
                onClick={() =>
                  setImageZoom((z) =>
                    Math.min(4, Number(((typeof z === "number" ? z : 1) * 1.25).toFixed(2)))
                  )
                }
                title="Zoom In"
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5 cursor-pointer"
              >
                <ZoomIn className="w-3 h-3" />
              </button>
            </div>
          )}

          {kind === "svg" && renderSvgEditor && (
            <button
              type="button"
              onClick={() => setSvgSourceMode(true)}
              className="h-6 px-2 rounded-md bg-[var(--bg-card)] border border-[var(--border-color)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 cursor-pointer"
            >
              <Code2 className="w-3 h-3" />
              <span>Code</span>
            </button>
          )}

          {tab.path && (
            <button
              type="button"
              onClick={() => void handleOpenExternal()}
              title="Open with default application"
              className="h-6 px-2 rounded-md bg-[var(--bg-card)] border border-[var(--border-color)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 cursor-pointer"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Open</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Stage */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-4 overflow-auto">
        {loadFailed || (!src && kind !== "binary") ? (
          <div className="max-w-sm w-full rounded-[12px] bg-[#121215] border border-[#26262C] p-5 text-center space-y-3">
            <div className="w-10 h-10 mx-auto rounded-[10px] bg-[#1A1A1F] border border-[#26262C] flex items-center justify-center text-amber-400">
              <FileWarning className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-[#FAFAFA]">Preview Unavailable</p>
              <p className="text-[11px] text-[#8E8E98] break-all">{tab.path || tab.title}</p>
            </div>
            {tab.path && (
              <button
                type="button"
                onClick={() => void handleOpenExternal()}
                className="px-3 py-1.5 rounded-[8px] bg-[#1A1A1F] border border-[#26262C] hover:bg-[var(--bg-hover)] text-xs text-[#FAFAFA] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in Default App</span>
              </button>
            )}
          </div>
        ) : kind === "image" || kind === "svg" ? (
          <div
            className={cn(
              "flex items-center justify-center rounded-[12px] border border-[#26262C] bg-[#121215] p-3",
              imageZoom === "fit" ? "max-w-full max-h-full" : ""
            )}
            style={{
              backgroundImage:
                "linear-gradient(45deg, #16161B 25%, transparent 25%), linear-gradient(-45deg, #16161B 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #16161B 75%), linear-gradient(-45deg, transparent 75%, #16161B 75%)",
              backgroundSize: "16px 16px",
              backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
            }}
          >
            <img
              src={src!}
              alt={tab.title}
              onLoad={(e) => {
                const img = e.currentTarget;
                setImgDims({ w: img.naturalWidth, h: img.naturalHeight });
                setLoadFailed(false);
              }}
              onError={() => setLoadFailed(true)}
              style={
                imageZoom === "fit"
                  ? undefined
                  : imgDims
                  ? { width: imgDims.w * imageZoom, height: imgDims.h * imageZoom }
                  : { transform: `scale(${imageZoom})` }
              }
              className={cn(
                "rounded object-contain select-none",
                imageZoom === "fit" ? "max-w-full max-h-[calc(100vh-14rem)]" : ""
              )}
            />
          </div>
        ) : kind === "audio" ? (
          <div className="max-w-md w-full rounded-[12px] bg-[#121215] border border-[#26262C] p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-[10px] bg-[#1A1A1F] border border-[#26262C] flex items-center justify-center text-[var(--text-primary)] shrink-0">
                <Music className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#FAFAFA] truncate">{tab.title}</p>
                <p className="text-[11px] font-mono text-[#8E8E98] truncate">{mime}</p>
              </div>
            </div>
            <audio
              key={src}
              controls
              preload="metadata"
              src={src!}
              onError={() => setLoadFailed(true)}
              className="w-full"
            />
          </div>
        ) : kind === "video" ? (
          <div className="max-w-4xl w-full flex flex-col items-center gap-2">
            <video
              key={src}
              controls
              preload="metadata"
              src={src!}
              onError={() => setLoadFailed(true)}
              className="max-w-full max-h-[calc(100vh-12rem)] rounded-[12px] border border-[#26262C] bg-black"
            />
            <div className="flex items-center gap-2 text-[11px] font-mono text-[#8E8E98]">
              <Film className="w-3.5 h-3.5 text-sky-400" />
              <span>{tab.title}</span>
            </div>
          </div>
        ) : kind === "pdf" ? (
          <iframe
            src={src!}
            title={tab.title}
            className="w-full h-full min-h-[420px] rounded-[10px] border border-[#26262C] bg-white"
          />
        ) : (
          <div className="max-w-sm w-full rounded-[12px] bg-[#121215] border border-[#26262C] p-6 text-center space-y-3">
            <div className="w-11 h-11 mx-auto rounded-[10px] bg-[#1A1A1F] border border-[#26262C] flex items-center justify-center">
              {getFileIcon(tab.title)}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[#FAFAFA] truncate">{tab.title}</p>
              <p className="text-[11px] text-[#8E8E98]">
                Binary file ({ext || "BIN"}) cannot be edited in the code editor.
              </p>
            </div>
            {tab.path && (
              <button
                type="button"
                onClick={() => void handleOpenExternal()}
                className="px-3 py-1.5 rounded-[8px] bg-[#1A1A1F] border border-[#26262C] hover:bg-[var(--bg-hover)] text-xs text-[#FAFAFA] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in Default App</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

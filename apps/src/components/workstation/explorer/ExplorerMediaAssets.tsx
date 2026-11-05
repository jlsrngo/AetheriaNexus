import { useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Film,
  Music,
  Image as ImageIcon,
  FileText,
  Upload,
  Trash2,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { useStudioStore } from "../../../hooks/useStudioStore";
import { apiFetch, API_BASE } from "../../../lib/api";
import type { StudioStaticAsset } from "../../../types/studio";

export function ExplorerMediaAssets() {
  const { assets, actions } = useStudioStore();
  const [isOpen, setIsOpen] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const inferType = (name: string): StudioStaticAsset["type"] => {
    const ext = name.split(".").pop()?.toLowerCase() || "";
    if (["mp4", "webm", "mov", "mkv"].includes(ext)) return "video";
    if (["mp3", "wav", "ogg", "m4a"].includes(ext)) return "audio";
    if (["png", "jpg", "jpeg", "webp", "svg", "gif"].includes(ext)) return "image";
    return "data";
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const relativePath = `public/${file.name}`;
    const newAsset: StudioStaticAsset = {
      id: `asset-${Date.now()}`,
      name: file.name,
      type: inferType(file.name),
      size: formatBytes(file.size),
      bytes: file.size,
      path: relativePath,
      relativePath,
    };

    actions.setAssets([newAsset, ...assets.filter((a) => a.path !== relativePath)]);

    try {
      const textContent = file.size < 200_000 ? await file.text() : `[Binary Asset: ${file.name}]`;
      await apiFetch(`${API_BASE}/write-static-file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath: relativePath, contents: textContent }),
      });
    } catch {}

    toast.success(`Imported staticFile("${file.name}")`);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDeleteAsset = async (asset: StudioStaticAsset) => {
    actions.setAssets(assets.filter((a) => a.path !== asset.path));
    try {
      await apiFetch(`${API_BASE}/delete-static-file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath: asset.path }),
      });
    } catch {}
    toast.info(`Removed ${asset.name}`);
  };

  const handleCopyStaticFile = (asset: StudioStaticAsset) => {
    const snippet = `staticFile("${asset.name}")`;
    void navigator.clipboard?.writeText(snippet);
    toast.success(`Copied ${snippet} to clipboard`);
  };

  const renderIcon = (cat: StudioStaticAsset["type"]) => {
    switch (cat) {
      case "video":
        return <Film className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
      case "audio":
        return <Music className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      case "image":
        return <ImageIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
    }
  };

  return (
    <div className="border-t border-[var(--border-color)] shrink-0">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,audio/*,image/*,.json,.srt,.vtt"
        className="hidden"
        onChange={handleUploadChange}
      />

      {/* Section Header */}
      <div className="h-7 px-2.5 flex items-center justify-between bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] transition-colors">
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
        >
          {isOpen ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
          <span>Media Assets (public/)</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] text-[9px] font-mono text-[var(--text-secondary)]">
            {assets.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="text-[var(--text-muted)] hover:text-emerald-400 p-1 rounded hover:bg-[var(--bg-card)] transition-colors cursor-pointer"
          title="Import Media Asset into public/ (staticFile)"
        >
          <Upload className="w-3 h-3" />
        </button>
      </div>

      {/* Assets List */}
      {isOpen && (
        <div className="max-h-44 overflow-y-auto px-1.5 pb-2 space-y-0.5">
          {assets.map((asset) => (
            <div
              key={asset.path}
              className="group flex items-center justify-between gap-1.5 px-2 py-1 rounded-md hover:bg-[var(--bg-hover)] transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                {renderIcon(asset.type)}
                <span className="text-xs text-[var(--text-primary)] truncate">
                  {asset.name}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[10px] font-mono text-[var(--text-muted)] group-hover:hidden">
                  {asset.size}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyStaticFile(asset)}
                  className="hidden group-hover:flex p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] cursor-pointer"
                  title={`Copy staticFile("${asset.name}")`}
                >
                  <Copy className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteAsset(asset)}
                  className="hidden group-hover:flex p-1 rounded text-[var(--text-muted)] hover:text-rose-400 hover:bg-[var(--bg-card)] cursor-pointer"
                  title="Delete Asset"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

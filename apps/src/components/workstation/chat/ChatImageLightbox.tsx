import { memo, useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import {
  fetchWorkspaceImageDataUrl,
  resolveWorkspaceAssetUrl,
} from "../../studio/htmlStageBundle";

interface ChatImageLightboxProps {
  url: string | null;
  onClose: () => void;
}

export const ChatImageLightbox = memo(function ChatImageLightbox({
  url,
  onClose,
}: ChatImageLightboxProps) {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const [triedFallback, setTriedFallback] = useState(false);

  useEffect(() => {
    setTriedFallback(false);
    if (!url) {
      setResolvedSrc(null);
      return;
    }
    setResolvedSrc(resolveWorkspaceAssetUrl(url) || url);
  }, [url]);

  if (!url) return null;

  return (
    <div
      className="absolute inset-0 z-50 bg-[var(--bg-card)]/95 backdrop-blur-sm flex flex-col p-3 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--border-color)] shrink-0 select-none">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <span className="text-xs font-semibold text-[var(--text-primary)]">Image Preview</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="w-6 h-6 rounded-full bg-[var(--bg-hover)] hover:bg-[var(--bg-panel)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors cursor-pointer border border-[var(--border-color)]"
          title="Close preview"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div
        className="flex-1 min-h-0 flex items-center justify-center overflow-auto p-1 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-color)]"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={resolvedSrc || url}
          alt="Preview"
          className="max-w-full max-h-full rounded-lg object-contain"
          onError={() => {
            if (triedFallback) return;
            setTriedFallback(true);
            void fetchWorkspaceImageDataUrl(url).then((dataUrl) => {
              if (dataUrl) setResolvedSrc(dataUrl);
            });
          }}
        />
      </div>
    </div>
  );
});

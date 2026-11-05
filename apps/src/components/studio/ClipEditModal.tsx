import React, { useState, useEffect } from "react";
import { X, Save, Eye, EyeOff, Clock, Trash2, Layers } from "lucide-react";
import { cn } from "../../lib/utils";
import type { VideoLayerSpec } from "../../remotion/types";

export interface ClipEditModalProps {
  isOpen: boolean;
  layer: VideoLayerSpec | null;
  durationInFrames: number;
  fps: number;
  onClose: () => void;
  onSaveContent: (layer: VideoLayerSpec, newContent: string) => void;
  onSaveTiming: (layer: VideoLayerSpec, from: number, duration: number) => void;
  onToggleVisibility?: (layer: VideoLayerSpec) => void;
  onDeleteCustom?: (layerId: string) => void;
}

export const ClipEditModal: React.FC<ClipEditModalProps> = ({
  isOpen,
  layer,
  durationInFrames,
  fps,
  onClose,
  onSaveContent,
  onSaveTiming,
  onToggleVisibility,
  onDeleteCustom,
}) => {
  const [contentDraft, setContentDraft] = useState("");
  const [fromDraft, setFromDraft] = useState(0);
  const [durationDraft, setDurationDraft] = useState(30);

  useEffect(() => {
    if (layer) {
      setContentDraft(layer.content ?? layer.label);
      setFromDraft(layer.from);
      setDurationDraft(layer.durationInFrames);
    }
  }, [layer]);

  if (!isOpen || !layer) return null;

  const endFrame = fromDraft + durationDraft;
  const startSec = (fromDraft / fps).toFixed(2);
  const endSec = (endFrame / fps).toFixed(2);

  const handleSave = () => {
    const trimmed = contentDraft.trim();
    if (trimmed.length > 0) {
      onSaveContent(layer, trimmed);
    }
    const safeFrom = Math.max(0, Math.min(durationInFrames - 5, fromDraft));
    const safeDur = Math.max(5, Math.min(durationInFrames - safeFrom, durationDraft));
    onSaveTiming(layer, safeFrom, safeDur);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[var(--bg-panel)] border border-[var(--border-strong)] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[var(--text-primary)]"
      >
        {/* Header */}
        <div className="h-11 px-4 border-b border-[var(--border-color)] bg-[var(--bg-card)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#cf6613] text-white shrink-0">
              {layer.trackCode}
            </span>
            <span className="text-xs font-semibold truncate text-[var(--text-primary)]">
              Edit Clip: {layer.label}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-4 space-y-3.5 text-xs">
          {/* Content / Label text */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-[var(--text-secondary)] block">
              Clip Content / Display Text
            </label>
            <textarea
              rows={3}
              autoFocus
              value={contentDraft}
              onChange={(e) => setContentDraft(e.target.value)}
              placeholder="Enter clip content text..."
              className="w-full p-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] outline-none focus:border-amber-400 resize-none font-sans"
            />
          </div>

          {/* Timing Section */}
          <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Timeline Timing & Position</span>
              </span>
              <span className="text-[10px] font-mono text-amber-400">
                {startSec}s – {endSec}s
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-[var(--text-muted)] block mb-1">
                  Start Frame
                </label>
                <input
                  type="number"
                  min={0}
                  max={durationInFrames - 5}
                  value={fromDraft}
                  onChange={(e) =>
                    setFromDraft(
                      Math.max(0, Math.min(durationInFrames - 5, Number(e.target.value) || 0))
                    )
                  }
                  className="w-full h-7 px-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-xs font-mono text-[var(--text-primary)] outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-[10px] text-[var(--text-muted)] block mb-1">
                  Duration (Frames)
                </label>
                <input
                  type="number"
                  min={5}
                  max={durationInFrames - fromDraft}
                  value={durationDraft}
                  onChange={(e) =>
                    setDurationDraft(
                      Math.max(5, Math.min(durationInFrames - fromDraft, Number(e.target.value) || 5))
                    )
                  }
                  className="w-full h-7 px-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-xs font-mono text-[var(--text-primary)] outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-[10px] text-[var(--text-muted)] block mb-1">
                  End Frame
                </label>
                <input
                  type="number"
                  min={fromDraft + 5}
                  max={durationInFrames}
                  value={endFrame}
                  onChange={(e) => {
                    const nextEnd = Number(e.target.value) || fromDraft + 5;
                    setDurationDraft(
                      Math.max(5, Math.min(durationInFrames - fromDraft, nextEnd - fromDraft))
                    );
                  }}
                  className="w-full h-7 px-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-xs font-mono text-[var(--text-primary)] outline-none focus:border-amber-400"
                />
              </div>
            </div>
          </div>

          {/* Quick Layer Settings */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)]">
            <div className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                Layer Visibility in Video
              </span>
            </div>
            <button
              type="button"
              onClick={() => onToggleVisibility?.(layer)}
              className={cn(
                "h-6 px-2.5 rounded-lg border text-[10px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer",
                layer.visible
                  ? "bg-[#0284c7] border-[#38bdf8] text-white"
                  : "bg-[var(--bg-input)] border-[var(--border-color)] text-[var(--text-muted)]"
              )}
            >
              {layer.visible ? (
                <>
                  <Eye className="w-3 h-3" />
                  <span>Visible</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3 h-3" />
                  <span>Hidden</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[var(--border-color)] bg-[var(--bg-card)] flex items-center justify-between gap-2 shrink-0">
          <div>
            {layer.isCustom && onDeleteCustom && (
              <button
                type="button"
                onClick={() => {
                  onDeleteCustom(layer.id);
                  onClose();
                }}
                className="h-7 px-2.5 rounded-lg bg-[var(--bg-input)] hover:bg-rose-950/60 border border-[var(--border-color)] hover:border-rose-500 text-rose-400 text-xs flex items-center gap-1 transition-colors cursor-pointer"
                title="Delete this dynamic layer track"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-7 px-3 rounded-lg bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="h-7 px-3.5 rounded-lg bg-[#cf6613] hover:bg-[#b8580f] border border-[#e07b27] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

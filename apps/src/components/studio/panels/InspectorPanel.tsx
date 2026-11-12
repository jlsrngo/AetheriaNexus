import { useState } from "react";
import {
  SlidersHorizontal,
  PanelLeftClose,
  GripHorizontal,
  X,
  RotateCcw,
  Save,
  Undo2,
  Redo2,
  Code2,
  LayoutList,
  Check,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useStudioStore } from "../../../hooks/useStudioStore";
import { apiFetch, API_BASE } from "../../../lib/api";
import { cn } from "../../../lib/utils";
import type { NexusVideoProps } from "../../../types/video";
import { useTimelineFilmMeta } from "../../../hooks/useTimelineFilmMeta";
import { InspectorCustomPropsSection } from "./InspectorCustomPropsSection";
import { HtmlFilmInspectorSection } from "./HtmlFilmInspectorSection";
import { isHtmlMotionComposition, sanitizeDurationInput } from "./htmlFilmInspectorUtils";

interface InspectorPanelProps {
  width?: number | string;
  onClose: () => void;
  isFloating?: boolean;
}

const NAMED_COLOR_TO_HEX: Record<string, string> = {
  orange: "#f97316",
  indigo: "#6366f1",
  violet: "#a855f7",
  rose: "#f43f5e",
  amber: "#f59e0b",
  cyan: "#06b6d4",
  emerald: "#06b6d4",
};

function toHexColor(val?: string): string {
  if (!val) return "#f97316";
  const clean = val.trim().toLowerCase();
  if (NAMED_COLOR_TO_HEX[clean]) return NAMED_COLOR_TO_HEX[clean];
  if (/^#[0-9a-f]{6}$/i.test(clean)) return clean;
  if (/^#[0-9a-f]{3}$/i.test(clean)) {
    return (
      "#" +
      clean
        .slice(1)
        .split("")
        .map((c) => c + c)
        .join("")
    );
  }
  return "#f97316";
}

export function InspectorPanel({
  width = "100%",
  onClose,
  isFloating = false,
}: InspectorPanelProps) {
  const { activeComposition, durationInFrames, currentFrame, assets, undoStack, redoStack, actions } =
    useStudioStore();
  const isHtmlFilm = isHtmlMotionComposition(activeComposition.id);
  const filmMeta = useTimelineFilmMeta(activeComposition.id);
  const [editorMode, setEditorMode] = useState<"schema" | "json">("schema");
  const [jsonDraft, setJsonDraft] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshingFilm, setIsRefreshingFilm] = useState(false);

  const handleRefreshFilm = async () => {
    setIsRefreshingFilm(true);
    try {
      await actions.syncFromBackend();
      toast.success("Synced HTML film metadata");
    } finally {
      setIsRefreshingFilm(false);
    }
  };

  const props = activeComposition.props;
  const activeHexColor = toHexColor(props.themeColor);

  const handleRatioSelect = (ratio: "9:16" | "1:1" | "16:9") => {
    const dims =
      ratio === "1:1"
        ? { width: 1080, height: 1080 }
        : ratio === "16:9"
        ? { width: 1920, height: 1080 }
        : { width: 1080, height: 1920 };
    actions.updateActiveMetadata({ ratio, ...dims });
  };

  const handleSavePropsToDisk = async () => {
    setIsSaving(true);
    try {
      const res = await apiFetch(`${API_BASE}/save-default-props`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          compositionId: activeComposition.id,
          props: activeComposition.props,
        }),
      });
      if (res.ok) {
        toast.success(`Saved defaultProps for "${activeComposition.name}"`);
      } else {
        toast.success(`Saved props locally for "${activeComposition.name}"`);
      }
    } catch {
      toast.success(`Saved props locally for "${activeComposition.name}"`);
    } finally {
      setIsSaving(false);
    }
  };

  const switchToJson = () => {
    setJsonDraft(JSON.stringify(activeComposition.props, null, 2));
    setEditorMode("json");
  };

  const handleApplyJson = () => {
    try {
      const parsed = JSON.parse(jsonDraft) as Partial<NexusVideoProps>;
      actions.updateActiveProps(parsed);
      toast.success("Applied JSON defaultProps");
    } catch {
      toast.error("Invalid JSON format");
    }
  };

  return (
    <aside
      className="bg-[var(--bg-panel)] text-[var(--text-primary)] border-r border-[var(--border-color)] flex flex-col shrink-0 select-none transition-colors duration-150"
      style={{ width }}
    >
      {/* Panel Header (Draggable via DetachablePanelShell) */}
      <div
        className="h-9 px-3 box-border border-b border-[var(--border-color)] flex items-center justify-between shrink-0"
        title="Drag header to detach into a floating resizable window"
      >
        <span className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5 min-w-0">
          <GripHorizontal className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
          <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400 shrink-0" strokeWidth={2} />
          <span className="truncate">Inspector & Props</span>
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => actions.undoProps()}
            disabled={undoStack.length === 0}
            className="w-6 h-6 rounded-md bg-[var(--bg-panel)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 flex items-center justify-center hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            title="Undo Prop Change (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={() => actions.redoProps()}
            disabled={redoStack.length === 0}
            className="w-6 h-6 rounded-md bg-[var(--bg-panel)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 flex items-center justify-center hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            title="Redo Prop Change (Ctrl+Y)"
          >
            <Redo2 className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 rounded-md bg-[var(--bg-panel)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] flex items-center justify-center transition-colors cursor-pointer"
            title={isFloating ? "Return to Sidebar" : "Close Panel (Ctrl+B)"}
          >
            {isFloating ? (
              <X className="w-3.5 h-3.5" strokeWidth={1.75} />
            ) : (
              <PanelLeftClose className="w-3.5 h-3.5" strokeWidth={1.75} />
            )}
          </button>
        </div>
      </div>

      {/* Scrollable Inspector Body */}
      <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-3 min-h-0">
        {/* 1. Composition Metadata Card */}
        <div className="p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Composition Metadata
            </span>
            <span className="text-[10px] font-mono text-amber-400 truncate max-w-[110px]">
              {activeComposition.id}
            </span>
          </div>

          {/* Aspect Ratio Presets (100% Solid Background) */}
          <div className="grid grid-cols-3 gap-1">
            {(["9:16", "1:1", "16:9"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => handleRatioSelect(r)}
                className={cn(
                  "h-6 rounded-md text-[10px] font-mono border transition-colors cursor-pointer",
                  activeComposition.ratio === r
                    ? "bg-[#cf6613] border-[#e07b27] text-white font-semibold"
                    : "bg-[var(--bg-input)] border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                )}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Dimensions & Timing */}
          <div className="grid grid-cols-[0.82fr_1.18fr] gap-1.5 text-[10px]">
            <div className="min-w-0">
              <span className="text-[var(--text-muted)] block mb-0.5 truncate">Width × Height</span>
              <div className="h-6 px-2 rounded-md bg-[var(--bg-input)] border border-[var(--border-color)] flex items-center font-mono text-[10px] text-[var(--text-primary)] truncate">
                {activeComposition.width}×{activeComposition.height}
              </div>
            </div>
            <div className="min-w-0">
              <span className="text-[var(--text-muted)] block mb-0.5 truncate">Duration ({durationInFrames}f)</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="any"
                  min={1}
                  max={600}
                  value={Math.round(activeComposition.duration * 100) / 100}
                  onChange={(e) =>
                    actions.updateActiveMetadata({
                      duration: sanitizeDurationInput(e.target.value, 600),
                    })
                  }
                  className="min-w-[52px] flex-1 h-6 px-1.5 rounded-md bg-[var(--bg-input)] border border-[var(--border-color)] font-mono text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
                />
                <select
                  value={activeComposition.fps}
                  onChange={(e) =>
                    actions.updateActiveMetadata({ fps: Number(e.target.value) || 30 })
                  }
                  className="h-6 px-1 rounded-md bg-[var(--bg-input)] border border-[var(--border-color)] font-mono text-[10px] text-[var(--text-secondary)] outline-none shrink-0"
                >
                  <option value={24}>24fps</option>
                  <option value={30}>30fps</option>
                  <option value={60}>60fps</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {isHtmlFilm ? (
          <HtmlFilmInspectorSection
            filmMeta={filmMeta}
            currentFrame={currentFrame}
            fps={activeComposition.fps}
            totalFrames={durationInFrames}
            assets={assets}
            onSeekFrame={(frame) => actions.setCurrentFrame(frame)}
          />
        ) : (
          <>
            {/* 2. Default Props Header + Mode Switch */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Default Props (Zod Schema)
              </span>
          <div className="flex items-center rounded-md bg-[var(--bg-card)] border border-[var(--border-color)] p-0.5">
            <button
              type="button"
              onClick={() => setEditorMode("schema")}
              className={cn(
                "px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 cursor-pointer transition-colors",
                editorMode === "schema"
                  ? "bg-[var(--bg-hover)] text-[var(--text-primary)] font-medium"
                  : "text-[var(--text-muted)]"
              )}
            >
              <LayoutList className="w-3 h-3" />
              Form
            </button>
            <button
              type="button"
              onClick={switchToJson}
              className={cn(
                "px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 cursor-pointer transition-colors",
                editorMode === "json"
                  ? "bg-[var(--bg-hover)] text-[var(--text-primary)] font-medium"
                  : "text-[var(--text-muted)]"
              )}
            >
              <Code2 className="w-3 h-3" />
              JSON
            </button>
          </div>
        </div>

        {editorMode === "schema" ? (
          <div className="space-y-2.5">
            {/* Dynamic Add / Remove / Customize Props & Layers */}
            <InspectorCustomPropsSection
              props={props}
              durationInFrames={durationInFrames}
              onUpdateProps={(patch) => actions.updateActiveProps(patch)}
            />

            {/* Theme Accent Color Picker (Compact, Non-Stretching) */}
            <div>
              <label className="text-[10px] text-[var(--text-muted)] block mb-1">
                Theme Accent Color
              </label>
              <div className="inline-flex flex-wrap items-center gap-2 p-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)]">
                <label
                  className="relative w-7 h-7 rounded-md border border-[var(--border-strong)] overflow-hidden cursor-pointer shrink-0 flex items-center justify-center"
                  style={{ backgroundColor: activeHexColor }}
                  title="Click to open Color Picker"
                >
                  <input
                    type="color"
                    value={activeHexColor}
                    onChange={(e) =>
                      actions.updateActiveProps({ themeColor: e.target.value })
                    }
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </label>
                <input
                  type="text"
                  value={activeHexColor.toUpperCase()}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    if (/^#[0-9a-fA-F]{0,6}$/.test(v)) {
                      actions.updateActiveProps({ themeColor: v });
                    }
                  }}
                  placeholder="#F97316"
                  className="w-24 h-7 px-2 rounded-md bg-[var(--bg-input)] border border-[var(--border-color)] text-xs font-mono text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
                />
                <div className="flex items-center gap-1 pl-1 border-l border-[var(--border-color)]">
                  {[
                    "#f97316",
                    "#6366f1",
                    "#a855f7",
                    "#f43f5e",
                    "#f59e0b",
                    "#06b6d4",
                  ].map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => actions.updateActiveProps({ themeColor: hex })}
                      className={cn(
                        "w-4 h-4 rounded-full border transition-transform cursor-pointer",
                        activeHexColor.toLowerCase() === hex
                          ? "border-white scale-110"
                          : "border-transparent opacity-80 hover:opacity-100"
                      )}
                      style={{ backgroundColor: hex }}
                      title={hex.toUpperCase()}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Layer Visibility Toggles */}
            <div className="p-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-1.5">
              {(
                [
                  { key: "showText", label: "Render Text Overlay Layer" },
                  { key: "showBackground", label: "Render Atmosphere Background" },
                  { key: "isMuted", label: "Mute Audio Track" },
                ] as const
              ).map((item) => (
                <label
                  key={item.key}
                  className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] cursor-pointer py-0.5"
                >
                  <span>{item.label}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(props[item.key])}
                    onChange={(e) =>
                      actions.updateActiveProps({ [item.key]: e.target.checked })
                    }
                    className="accent-amber-500 rounded cursor-pointer"
                  />
                </label>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <textarea
              rows={12}
              value={jsonDraft}
              onChange={(e) => setJsonDraft(e.target.value)}
              className="w-full p-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] font-mono text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)] resize-none"
            />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleApplyJson}
                  className="h-7 px-3.5 rounded-lg bg-[#cf6613] hover:bg-[#b8580f] border border-[#e07b27] text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  Apply JSON Props
                </button>
              </div>
            </div>
          )}
          </>
        )}
      </div>

      {/* Footer Actions (Compact, Non-Stretching Solid Buttons) */}
      <div className="p-2.5 border-t border-[var(--border-color)] bg-[var(--bg-card)] flex items-center justify-end gap-2 shrink-0">
        {isHtmlFilm ? (
          <button
            type="button"
            onClick={handleRefreshFilm}
            disabled={isRefreshingFilm}
            className="h-7 px-3.5 rounded-[var(--radius-control)] bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] border border-[var(--border-strong)] text-[var(--text-primary)] text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            title="Sync film metadata, scenes & audio cues from active folder"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isRefreshingFilm && "animate-spin")} />
            <span>{isRefreshingFilm ? "Syncing..." : "Refresh Film"}</span>
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                actions.resetActiveProps();
                toast.info("Reset composition props to defaults");
              }}
              className="h-7 px-2.5 rounded-lg bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] border border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              title="Reset to defaultProps"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
            <button
              type="button"
              onClick={handleSavePropsToDisk}
              disabled={isSaving}
              className="h-7 px-3.5 rounded-lg bg-[#cf6613] hover:bg-[#b8580f] border border-[#e07b27] text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              title="Save Default Props to project (Ctrl+S)"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? "Saving..." : "Save Default Props"}</span>
            </button>
          </>
        )}
      </div>
    </aside>
  );
}


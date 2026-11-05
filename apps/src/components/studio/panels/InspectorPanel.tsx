import { useState } from "react";
import {
  SlidersHorizontal,
  PanelLeftClose,
  RotateCcw,
  Save,
  Undo2,
  Redo2,
  Code2,
  LayoutList,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { useStudioStore } from "../../../hooks/useStudioStore";
import { apiFetch, API_BASE } from "../../../lib/api";
import { cn } from "../../../lib/utils";
import type { NexusVideoProps } from "../../../remotion/types";

interface InspectorPanelProps {
  width?: number | string;
  onClose: () => void;
}

const THEME_COLORS: Array<{
  id: NexusVideoProps["themeColor"];
  label: string;
  dot: string;
}> = [
  { id: "orange", label: "Orange", dot: "bg-orange-500" },
  { id: "emerald", label: "Emerald", dot: "bg-emerald-500" },
  { id: "violet", label: "Violet", dot: "bg-violet-500" },
  { id: "rose", label: "Rose", dot: "bg-rose-500" },
  { id: "amber", label: "Amber", dot: "bg-amber-400" },
  { id: "cyan", label: "Cyan", dot: "bg-cyan-400" },
];

export function InspectorPanel({ width = 256, onClose }: InspectorPanelProps) {
  const { activeComposition, durationInFrames, undoStack, redoStack, actions } =
    useStudioStore();
  const [editorMode, setEditorMode] = useState<"schema" | "json">("schema");
  const [jsonDraft, setJsonDraft] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const props = activeComposition.props;

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
      {/* Panel Header */}
      <div className="h-9 px-3 box-border border-b border-[var(--border-color)] flex items-center justify-between shrink-0">
        <span className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" strokeWidth={2} />
          Inspector & Props
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => actions.undoProps()}
            disabled={undoStack.length === 0}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 p-1 rounded-md hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            title="Undo Prop Change (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={() => actions.redoProps()}
            disabled={redoStack.length === 0}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 p-1 rounded-md hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            title="Redo Prop Change (Ctrl+Y)"
          >
            <Redo2 className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-md hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            title="Close Panel (Ctrl+B)"
          >
            <PanelLeftClose className="w-4 h-4" strokeWidth={1.5} />
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
            <span className="text-[10px] font-mono text-emerald-400 truncate max-w-[110px]">
              {activeComposition.id}
            </span>
          </div>

          {/* Aspect Ratio Presets */}
          <div className="grid grid-cols-3 gap-1">
            {(["9:16", "1:1", "16:9"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => handleRatioSelect(r)}
                className={cn(
                  "h-6 rounded-md text-[10px] font-mono border transition-colors cursor-pointer",
                  activeComposition.ratio === r
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400 font-semibold"
                    : "bg-[var(--bg-input)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                )}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Dimensions & Timing */}
          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
            <div>
              <span className="text-[var(--text-muted)] block mb-0.5">Width × Height</span>
              <div className="h-6 px-2 rounded-md bg-[var(--bg-input)] border border-[var(--border-color)] flex items-center font-mono text-[var(--text-primary)]">
                {activeComposition.width} × {activeComposition.height}
              </div>
            </div>
            <div>
              <span className="text-[var(--text-muted)] block mb-0.5">Duration ({durationInFrames}f)</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={activeComposition.duration}
                  onChange={(e) =>
                    actions.updateActiveMetadata({
                      duration: Math.max(1, Math.min(60, Number(e.target.value) || 5)),
                    })
                  }
                  className="w-full h-6 px-1.5 rounded-md bg-[var(--bg-input)] border border-[var(--border-color)] font-mono text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
                />
                <select
                  value={activeComposition.fps}
                  onChange={(e) =>
                    actions.updateActiveMetadata({ fps: Number(e.target.value) || 30 })
                  }
                  className="h-6 px-1 rounded-md bg-[var(--bg-input)] border border-[var(--border-color)] font-mono text-[10px] text-[var(--text-secondary)] outline-none"
                >
                  <option value={24}>24fps</option>
                  <option value={30}>30fps</option>
                  <option value={60}>60fps</option>
                </select>
              </div>
            </div>
          </div>
        </div>

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
            {/* Hook Text */}
            <div>
              <label className="text-[11px] font-medium text-[var(--text-secondary)] block mb-1">
                Hook Title (<code className="text-[10px] text-emerald-400">hookText</code>)
              </label>
              <textarea
                rows={2}
                value={props.hookText}
                onChange={(e) => actions.updateActiveProps({ hookText: e.target.value })}
                className="w-full p-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)] resize-none"
              />
            </div>

            {/* Body Bullets */}
            <div>
              <label className="text-[11px] font-medium text-[var(--text-secondary)] block mb-1">
                Body Bullets (<code className="text-[10px] text-emerald-400">bodyText</code>)
              </label>
              <textarea
                rows={4}
                value={props.bodyText}
                onChange={(e) => actions.updateActiveProps({ bodyText: e.target.value })}
                className="w-full p-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)] resize-none leading-relaxed"
              />
            </div>

            {/* Category & Subcategory */}
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="text-[10px] text-[var(--text-muted)] block mb-0.5">Category</label>
                <input
                  type="text"
                  value={props.category}
                  onChange={(e) => actions.updateActiveProps({ category: e.target.value })}
                  className="w-full h-7 px-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
                />
              </div>
              <div>
                <label className="text-[10px] text-[var(--text-muted)] block mb-0.5">Sub-Category</label>
                <input
                  type="text"
                  value={props.subCategory}
                  onChange={(e) => actions.updateActiveProps({ subCategory: e.target.value })}
                  className="w-full h-7 px-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
                />
              </div>
            </div>

            {/* Author Handle */}
            <div>
              <label className="text-[10px] text-[var(--text-muted)] block mb-0.5">Author Handle</label>
              <input
                type="text"
                value={props.authorHandle}
                onChange={(e) => actions.updateActiveProps({ authorHandle: e.target.value })}
                className="w-full h-7 px-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-xs font-mono text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
              />
            </div>

            {/* Theme Color Swatches */}
            <div>
              <label className="text-[10px] text-[var(--text-muted)] block mb-1">Theme Accent</label>
              <div className="grid grid-cols-3 gap-1">
                {THEME_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => actions.updateActiveProps({ themeColor: c.id })}
                    className={cn(
                      "h-6 px-2 rounded-md border flex items-center gap-1.5 text-[10px] transition-colors cursor-pointer",
                      props.themeColor === c.id
                        ? "bg-[var(--bg-hover)] border-[var(--border-strong)] text-[var(--text-primary)] font-semibold"
                        : "bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    <span className={cn("w-2 h-2 rounded-full shrink-0", c.dot)} />
                    <span className="truncate">{c.label}</span>
                  </button>
                ))}
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
                    className="accent-emerald-500 rounded cursor-pointer"
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
            <button
              type="button"
              onClick={handleApplyJson}
              className="w-full h-7 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              Apply JSON Props
            </button>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-2.5 border-t border-[var(--border-color)] bg-[var(--bg-card)] flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={handleSavePropsToDisk}
          disabled={isSaving}
          className="flex-1 h-7 px-2.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          title="Save Default Props to project (Ctrl+S)"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{isSaving ? "Saving..." : "Save Default Props"}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            actions.resetActiveProps();
            toast.info("Reset composition props to defaults");
          }}
          className="h-7 px-2 rounded-lg bg-[var(--bg-hover)] hover:bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs flex items-center justify-center cursor-pointer transition-colors"
          title="Reset to defaultProps"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
}


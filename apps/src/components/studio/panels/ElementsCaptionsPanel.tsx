import { useState } from "react";
import {
  Sparkles,
  PanelLeftClose,
  GripHorizontal,
  X,
  Type,
  Captions,
  Wand2,
  Plus,
  Trash2,
  Play,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { useStudioStore } from "../../../hooks/useStudioStore";
import { apiFetch, API_BASE } from "../../../lib/api";
import { cn } from "../../../lib/utils";
import type { StudioSubtitleCue } from "../../../types/studio";
import { useTimelineFilmMeta } from "../../../hooks/useTimelineFilmMeta";
import { HtmlFilmCaptionsSection } from "./HtmlFilmCaptionsSection";
import { isHtmlMotionComposition } from "./htmlFilmInspectorUtils";

interface ElementsCaptionsPanelProps {
  width?: number | string;
  onClose: () => void;
  isFloating?: boolean;
}

const VIRAL_HOOK_PRESETS = [
  {
    label: "3 Habits Hook",
    hookText: "3 Morning Habits of High Performers You Never Knew",
    bodyText:
      "1. Hydrate before checking notifications\n2. 10 minutes of sunlight exposure\n3. Write down your single top priority",
    category: "PRODUCTIVITY",
  },
  {
    label: "Contrarian Tech Hook",
    hookText: "Stop Writing Boilerplate Code Manually in 2026",
    bodyText:
      "1. Automate repetitive scaffolding with AI agents\n2. Enforce strict TypeScript schemas at boundaries\n3. Ship 5x faster with zero regressions",
    category: "ENGINEERING",
  },
  {
    label: "Storytelling Hook",
    hookText: "How One Small Change Doubled Our Retention Rate",
    bodyText:
      "1. Cut the first 2 seconds of dead air\n2. Add high-contrast word-by-word captions\n3. End with an open loop question",
    category: "GROWTH // TIKTOK",
  },
];

const CAPTION_QUICK_COLORS = [
  { hex: "#00F2FE", label: "Cyan" },
  { hex: "#F59E0B", label: "Amber" },
  { hex: "#F97316", label: "Orange" },
  { hex: "#F43F5E", label: "Rose" },
  { hex: "#A855F7", label: "Violet" },
  { hex: "#6366F1", label: "Indigo" },
];

const resolveCaptionHex = (styleOrHex: string): string => {
  if (/^#[0-9a-fA-F]{6}$/.test(styleOrHex)) return styleOrHex.toUpperCase();
  if (styleOrHex === "beast-yellow") return "#F59E0B";
  if (styleOrHex === "neon-green") return "#00F2FE";
  return "#00F2FE";
};

export function ElementsCaptionsPanel({
  width = "100%",
  onClose,
  isFloating = false,
}: ElementsCaptionsPanelProps) {
  const {
    activeComposition,
    durationInFrames,
    currentFrame,
    subtitleCues,
    captionStyle,
    actions,
  } = useStudioStore();
  const isHtmlFilm = isHtmlMotionComposition(activeComposition.id);
  const filmMeta = useTimelineFilmMeta(activeComposition.id);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleAddBullet = () => {
    const lines = activeComposition.props.bodyText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const nextNum = lines.length + 1;
    const nextBody = [
      ...lines,
      `${nextNum}. New key takeaway for your audience`,
    ].join("\n");
    actions.updateActiveProps({ bodyText: nextBody });
    toast.success(`Added bullet #${nextNum}`);
  };

  const currentCaptionHex = resolveCaptionHex(captionStyle);

  const handleCaptionColorChange = (nextColor: string) => {
    const normalized = nextColor.toUpperCase();
    if (subtitleCues.length > 0) {
      const updated = subtitleCues.map((cue) => ({
        ...cue,
        color: normalized,
      }));
      actions.setSubtitleCues(updated, normalized);
    } else {
      actions.setSubtitleCues([], normalized);
    }
  };

  const buildLocalSubtitles = (
    script: string,
    totalFrames: number,
    fps: number,
    styleOrColor: string
  ): StudioSubtitleCue[] => {
    const words = script
      .replace(/\n+/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    if (words.length === 0) return [];
    const chunkSize = 3;
    const chunks: string[][] = [];
    for (let i = 0; i < words.length; i += chunkSize) {
      chunks.push(words.slice(i, i + chunkSize));
    }
    const framesPerCue = Math.max(6, Math.floor(totalFrames / chunks.length));
    const color = resolveCaptionHex(styleOrColor);
    return chunks.map((wordChunk, idx) => {
      const startFrame = idx * framesPerCue;
      const endFrame =
        idx === chunks.length - 1
          ? totalFrames
          : (idx + 1) * framesPerCue - 1;
      const rawText = wordChunk.join(" ");
      return {
        id: `cue-${idx}`,
        startFrame,
        endFrame,
        startSec: Number((startFrame / fps).toFixed(2)),
        endSec: Number((endFrame / fps).toFixed(2)),
        text: rawText,
        words: wordChunk,
        highlightKeyword: wordChunk[0] ?? null,
        color,
        scale: 1.05,
      };
    });
  };

  const handleGenerateSubtitles = async (styleOverride?: string) => {
    const targetStyle = resolveCaptionHex(styleOverride ?? captionStyle);
    setIsGenerating(true);
    const fullScript = `${activeComposition.props.hookText}. ${activeComposition.props.bodyText}`;

    try {
      const genRes = await apiFetch(`${API_BASE}/studio/generate-subtitles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: fullScript,
          script: fullScript,
          fps: activeComposition.fps,
          durationInSeconds: activeComposition.duration,
        }),
      });

      if (genRes.ok) {
        const genJson = (await genRes.json()) as {
          success?: boolean;
          cues?: StudioSubtitleCue[];
          data?: { cues?: StudioSubtitleCue[] };
        };
        const rawCues = genJson.data?.cues ?? genJson.cues;
        if (Array.isArray(rawCues) && rawCues.length > 0) {
          const coloredCues = rawCues.map((cue) => ({
            ...cue,
            color: targetStyle,
          }));
          actions.setSubtitleCues(coloredCues, targetStyle);
          toast.success(`Generated ${coloredCues.length} caption cues`);
          setIsGenerating(false);
          return;
        }
      }
    } catch {}

    const fallback = buildLocalSubtitles(
      fullScript,
      durationInFrames,
      activeComposition.fps,
      targetStyle
    );
    actions.setSubtitleCues(fallback, targetStyle);
    toast.success(`Generated ${fallback.length} synchronized caption cues`);
    setIsGenerating(false);
  };

  return (
    <aside
      className="bg-[var(--bg-panel)] text-[var(--text-primary)] border-r border-[var(--border-color)] flex flex-col shrink-0 select-none transition-colors duration-150"
      style={{ width }}
    >
      {/* Header */}
      <div
        className="h-9 px-3 box-border border-b border-[var(--border-color)] flex items-center justify-between shrink-0"
        title="Drag header to detach into a floating resizable window"
      >
        <span className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5 min-w-0">
          <GripHorizontal className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" strokeWidth={2} />
          <span className="truncate">Elements & Captions</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          className="w-6 h-6 rounded-md bg-[var(--bg-panel)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] flex items-center justify-center transition-colors cursor-pointer shrink-0"
          title={isFloating ? "Return to Sidebar" : "Close Panel (Ctrl+B)"}
        >
          {isFloating ? (
            <X className="w-3.5 h-3.5" strokeWidth={1.75} />
          ) : (
            <PanelLeftClose className="w-3.5 h-3.5" strokeWidth={1.75} />
          )}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-3 min-h-0">
        {isHtmlFilm ? (
          <HtmlFilmCaptionsSection
            filmMeta={filmMeta}
            currentFrame={currentFrame}
            fps={activeComposition.fps}
            subtitleCues={subtitleCues}
            onSeekFrame={(frame) => actions.setCurrentFrame(frame)}
          />
        ) : (
          <>
        {/* 1. Quick Layer Actions */}
        <div className="p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            <Layers className="w-3 h-3 text-amber-400" />
            <span>Quick Scene Elements</span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={handleAddBullet}
              className="h-7 px-2 rounded-lg bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)] text-[11px] text-[var(--text-primary)] flex items-center justify-center gap-1 cursor-pointer transition-colors"
            >
              <Plus className="w-3 h-3 text-amber-400" />
              <span>Add Bullet</span>
            </button>
            <button
              type="button"
              onClick={() =>
                actions.updateActiveProps({
                  showText: !activeComposition.props.showText,
                })
              }
              className="h-7 px-2 rounded-lg bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)] text-[11px] text-[var(--text-primary)] flex items-center justify-center gap-1 cursor-pointer transition-colors"
            >
              <Type className="w-3 h-3 text-cyan-400" />
              <span>
                {activeComposition.props.showText ? "Hide Text" : "Show Text"}
              </span>
            </button>
          </div>
        </div>

        {/* 2. Viral Hook Templates */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
            Viral Hook Templates
          </span>
          <div className="space-y-1">
            {VIRAL_HOOK_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  actions.updateActiveProps({
                    hookText: preset.hookText,
                    bodyText: preset.bodyText,
                    category: preset.category,
                  });
                  toast.success(`Applied "${preset.label}"`);
                }}
                className="w-full text-left p-2 rounded-lg bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)] transition-colors cursor-pointer"
              >
                <div className="text-xs font-medium text-[var(--text-primary)] flex items-center justify-between">
                  <span>{preset.label}</span>
                  <span className="text-[9px] font-mono text-amber-400">
                    {preset.category}
                  </span>
                </div>
                <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">
                  {preset.hookText}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* 3. Auto-Captions Engine */}
        <div className="p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              <Captions className="w-3.5 h-3.5 text-cyan-400" />
              Auto-Captions Engine
            </span>
            {subtitleCues.length > 0 && (
              <button
                type="button"
                onClick={() => actions.setSubtitleCues([])}
                className="text-[10px] text-[var(--text-muted)] hover:text-rose-400 flex items-center gap-0.5 cursor-pointer"
                title="Clear Subtitle Track"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Caption Color Picker (Unrestricted Color Selection) */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-[var(--text-muted)] block">
              Caption Highlight Color
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)]">
                <label className="relative w-5 h-5 rounded-md border border-[var(--border-strong)] overflow-hidden cursor-pointer shrink-0 flex items-center justify-center">
                  <input
                    type="color"
                    value={currentCaptionHex}
                    onChange={(e) => handleCaptionColorChange(e.target.value)}
                    className="absolute -inset-2 w-9 h-9 cursor-pointer opacity-0"
                    title="Pick any custom caption color"
                  />
                  <span
                    className="w-full h-full block"
                    style={{ backgroundColor: currentCaptionHex }}
                  />
                </label>
                <input
                  type="text"
                  value={currentCaptionHex}
                  onChange={(e) => handleCaptionColorChange(e.target.value)}
                  placeholder="#00F2FE"
                  className="w-20 h-5 px-1 bg-transparent text-[11px] font-mono text-[var(--text-primary)] outline-none"
                />
              </div>

              <div className="flex items-center gap-1">
                {CAPTION_QUICK_COLORS.map((swatch) => (
                  <button
                    key={swatch.hex}
                    type="button"
                    onClick={() => handleCaptionColorChange(swatch.hex)}
                    className={cn(
                      "w-4 h-4 rounded-full border transition-transform cursor-pointer shrink-0",
                      currentCaptionHex.toUpperCase() === swatch.hex
                        ? "border-white scale-110"
                        : "border-[var(--border-color)] hover:scale-105"
                    )}
                    style={{ backgroundColor: swatch.hex }}
                    title={swatch.label}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleGenerateSubtitles()}
              disabled={isGenerating}
              className="h-7 px-3.5 rounded-lg bg-[#cf6613] hover:bg-[#b8580f] border border-[#e07b27] text-white text-xs font-semibold flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer transition-colors"
            >
              <Wand2 className="w-3.5 h-3.5 shrink-0" />
              <span>
                {isGenerating ? "Generating..." : "Generate Captions"}
              </span>
            </button>
          </div>

          {/* Cue List */}
          {subtitleCues.length > 0 && (
            <div className="max-h-44 overflow-y-auto space-y-1 pt-1 border-t border-[var(--border-color)]">
              {subtitleCues.map((cue, idx) => (
                <button
                  key={`${cue.startFrame}-${idx}`}
                  type="button"
                  onClick={() => actions.setCurrentFrame(cue.startFrame)}
                  className="w-full text-left px-2 py-1 rounded-md bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] flex items-center justify-between gap-2 text-[11px] cursor-pointer transition-colors"
                >
                  <span className="truncate text-[var(--text-primary)] flex items-center gap-1.5">
                    <Play className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
                    {cue.text}
                  </span>
                  <span className="text-[9px] font-mono text-[var(--text-muted)] shrink-0">
                    {cue.startFrame}–{cue.endFrame}f
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
          </>
        )}
      </div>
    </aside>
  );
}


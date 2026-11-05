import { useState } from "react";
import {
  Sparkles,
  PanelLeftClose,
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

interface ElementsCaptionsPanelProps {
  width?: number | string;
  onClose: () => void;
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

const CAPTION_STYLES: Array<{
  id: "tiktok-bold" | "beast-yellow" | "neon-green";
  label: string;
  color: string;
}> = [
  { id: "tiktok-bold", label: "TikTok Cyan", color: "#00F2FE" },
  { id: "beast-yellow", label: "Beast Yellow", color: "#FFD700" },
  { id: "neon-green", label: "Neon Green", color: "#10B981" },
];

export function ElementsCaptionsPanel({
  width = 256,
  onClose,
}: ElementsCaptionsPanelProps) {
  const {
    activeComposition,
    durationInFrames,
    subtitleCues,
    captionStyle,
    actions,
  } = useStudioStore();
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

  const buildLocalSubtitles = (
    script: string,
    totalFrames: number,
    fps: number,
    style: "tiktok-bold" | "beast-yellow" | "neon-green"
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
    const color =
      style === "beast-yellow"
        ? "#FFD700"
        : style === "neon-green"
        ? "#10B981"
        : "#00F2FE";
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
        text: style === "beast-yellow" ? rawText.toUpperCase() : rawText,
        words: wordChunk,
        highlightKeyword: wordChunk[0] ?? null,
        color,
        scale: style === "beast-yellow" ? 1.15 : 1.0,
      };
    });
  };

  const handleGenerateSubtitles = async (
    styleOverride?: "tiktok-bold" | "beast-yellow" | "neon-green"
  ) => {
    const targetStyle = styleOverride ?? captionStyle;
    setIsGenerating(true);
    const fullScript = `${activeComposition.props.hookText}. ${activeComposition.props.bodyText}`;

    try {
      const genRes = await apiFetch(`${API_BASE}/studio/generate-subtitles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: fullScript,
          fps: activeComposition.fps,
          durationInSeconds: activeComposition.duration,
        }),
      });

      if (genRes.ok) {
        const genJson = (await genRes.json()) as {
          success?: boolean;
          data?: { cues?: StudioSubtitleCue[] };
        };
        const rawCues = genJson.data?.cues;
        if (Array.isArray(rawCues) && rawCues.length > 0) {
          const fmtRes = await apiFetch(`${API_BASE}/studio/format-captions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cues: rawCues, style: targetStyle }),
          });
          if (fmtRes.ok) {
            const fmtJson = (await fmtRes.json()) as {
              data?: { cues?: StudioSubtitleCue[] };
            };
            if (Array.isArray(fmtJson.data?.cues)) {
              actions.setSubtitleCues(fmtJson.data!.cues!, targetStyle);
              toast.success(
                `Generated ${fmtJson.data!.cues!.length} caption cues`
              );
              setIsGenerating(false);
              return;
            }
          }
          actions.setSubtitleCues(rawCues, targetStyle);
          toast.success(`Generated ${rawCues.length} caption cues`);
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
      <div className="h-9 px-3 box-border border-b border-[var(--border-color)] flex items-center justify-between shrink-0">
        <span className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" strokeWidth={2} />
          Elements & Captions
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-md hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
          title="Close Panel (Ctrl+B)"
        >
          <PanelLeftClose className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-3 min-h-0">
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

        {/* 3. Auto-Captions Engine (@remotion/captions) */}
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

          {/* Style Selector */}
          <div className="grid grid-cols-3 gap-1">
            {CAPTION_STYLES.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => {
                  if (subtitleCues.length > 0) {
                    void handleGenerateSubtitles(st.id);
                  } else {
                    actions.setSubtitleCues([], st.id);
                  }
                }}
                className={cn(
                  "h-6 px-1.5 rounded-md border text-[10px] flex items-center justify-center gap-1 cursor-pointer transition-colors",
                  captionStyle === st.id
                    ? "bg-[var(--bg-hover)] border-[var(--border-strong)] text-[var(--text-primary)] font-semibold"
                    : "bg-[var(--bg-input)] border-[var(--border-color)] text-[var(--text-muted)]"
                )}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: st.color }}
                />
                <span className="truncate">{st.label.split(" ")[1]}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void handleGenerateSubtitles()}
            disabled={isGenerating}
            className="w-full h-7 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>
              {isGenerating
                ? "Generating Word Cues..."
                : "Generate Synchronized Captions"}
            </span>
          </button>

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
      </div>
    </aside>
  );
}


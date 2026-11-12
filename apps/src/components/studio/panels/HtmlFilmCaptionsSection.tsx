import React from "react";
import { Captions, Music2, Play, Sparkles } from "lucide-react";
import type { StudioSubtitleCue } from "../../../types/studio";
import type { FilmMetaResponse } from "../timeline/timelineLayerUtils";
import { formatAudioTrackLabel, formatDurationSeconds, resolveSceneAtFrame } from "./htmlFilmInspectorUtils";

interface HtmlFilmCaptionsSectionProps {
  filmMeta: FilmMetaResponse | null;
  currentFrame: number;
  fps: number;
  subtitleCues: StudioSubtitleCue[];
  onSeekFrame: (frame: number) => void;
}

/** Displays real per-scene narration audio cues & word timestamps for modular HTML motion films. */
export const HtmlFilmCaptionsSection: React.FC<HtmlFilmCaptionsSectionProps> = ({
  filmMeta,
  currentFrame,
  fps,
  subtitleCues,
  onSeekFrame,
}) => {
  const scenes = filmMeta?.scenes ?? [];
  const activeEntry = resolveSceneAtFrame(scenes, currentFrame);
  const effectiveFps = filmMeta?.fps || fps || 30;

  return (
    <div className="space-y-3">
      {/* Audio-Synced Subtitles Note */}
      <div className="p-2.5 rounded-[var(--radius-card)] bg-[var(--bg-card)] border border-[var(--border-color)] space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" />
            HTML Audio & Word Sync
          </span>
          <span className="font-mono text-[9px] text-[var(--text-muted)]">
            {scenes.length} scene{scenes.length === 1 ? "" : "s"}
          </span>
        </div>
        <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
          Subtitle & timing kata mengikuti audio <code className="font-mono text-[10px]">*.wav</code> &{" "}
          <code className="font-mono text-[10px]">*.words.json</code> di folder proyek ini, bukan template bullet Remotion.
        </p>
      </div>

      {/* Per-Scene Narration & Cue List */}
      <div className="p-2.5 rounded-[var(--radius-card)] bg-[var(--bg-card)] border border-[var(--border-color)] space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
            <Music2 className="w-3 h-3 text-emerald-400" />
            Scene Audio Cues
          </span>
          <span className="font-mono text-[9px] text-[var(--text-muted)]">{effectiveFps} fps</span>
        </div>

        {scenes.length === 0 ? (
          <div className="text-[11px] text-[var(--text-muted)] py-2">
            Belum ada metadata scene audio terdeteksi di <code className="font-mono">index.html</code>.
          </div>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto pr-0.5">
            {scenes.map((scene, idx) => {
              const isCurrent = activeEntry?.scene.id === scene.id;
              const endFrame = scene.startFrame + scene.durationFrames;
              const sec = scene.durationFrames / effectiveFps;
              return (
                <button
                  key={`${scene.id}-${idx}`}
                  type="button"
                  onClick={() => onSeekFrame(scene.startFrame)}
                  className={`w-full text-left p-2 rounded-[var(--radius-control)] border transition-colors cursor-pointer ${
                    isCurrent
                      ? "bg-emerald-500/10 border-emerald-500/35 text-[var(--text-primary)]"
                      : "bg-[var(--bg-input)] border-[var(--border-color)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate font-medium flex items-center gap-1.5 text-[var(--text-primary)]">
                      <Play className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                      {idx + 1}. {scene.title || scene.id}
                    </span>
                    <span className="font-mono text-[9px] text-[var(--text-muted)] shrink-0">
                      {formatDurationSeconds(sec)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2 font-mono text-[9px] text-[var(--text-muted)]">
                    <span className="truncate">{formatAudioTrackLabel(scene.audio)}</span>
                    <span className="shrink-0">
                      {scene.startFrame}–{endFrame}f
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Stored Timeline Subtitle Cues (if populated) */}
      {subtitleCues.length > 0 && (
        <div className="p-2.5 rounded-[var(--radius-card)] bg-[var(--bg-card)] border border-[var(--border-color)] space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            <span className="flex items-center gap-1.5">
              <Captions className="w-3 h-3 text-emerald-400" />
              Active Word / Caption Cues
            </span>
            <span className="font-mono">{subtitleCues.length}</span>
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {subtitleCues.map((cue, idx) => (
              <button
                key={`${cue.startFrame}-${idx}`}
                type="button"
                onClick={() => onSeekFrame(cue.startFrame)}
                className="w-full text-left px-2 py-1 rounded-[var(--radius-control)] bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] flex items-center justify-between gap-2 text-[11px] cursor-pointer transition-colors"
              >
                <span className="truncate text-[var(--text-primary)]">{cue.text}</span>
                <span className="text-[9px] font-mono text-[var(--text-muted)] shrink-0">
                  {cue.startFrame}–{cue.endFrame}f
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

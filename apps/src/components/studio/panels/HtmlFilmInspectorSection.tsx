import React, { useState } from "react";
import { CheckCircle2, AlertTriangle, Code2, Film, Music2, Sparkles, Clock } from "lucide-react";
import type { StudioStaticAsset } from "../../../types/studio";
import type { FilmMetaResponse } from "../timeline/timelineLayerUtils";
import {
  formatAudioTrackLabel,
  formatDurationSeconds,
  resolveSceneAtFrame,
  summarizeFilmReadiness,
} from "./htmlFilmInspectorUtils";

interface HtmlFilmInspectorSectionProps {
  filmMeta: FilmMetaResponse | null;
  currentFrame: number;
  fps: number;
  totalFrames: number;
  assets: StudioStaticAsset[];
  onSeekFrame: (frame: number) => void;
}

/** Inspector body tailored for modular HTML5/JS motion films (real scenes, audio cues, lint). */
export const HtmlFilmInspectorSection: React.FC<HtmlFilmInspectorSectionProps> = ({
  filmMeta,
  currentFrame,
  fps,
  totalFrames,
  assets,
  onSeekFrame,
}) => {
  const [showMetaJson, setShowMetaJson] = useState(false);
  const scenes = filmMeta?.scenes ?? [];
  const activeEntry = resolveSceneAtFrame(scenes, currentFrame);
  const readiness = summarizeFilmReadiness(filmMeta);

  const audioAssetsCount = assets.filter((a) => a.type === "audio").length;
  const scriptAssetsCount = assets.filter(
    (a) => a.relativePath.startsWith("script/") || a.name.toLowerCase().endsWith(".js"),
  ).length;
  const displayFps = filmMeta?.fps || fps || 30;

  return (
    <div className="space-y-3">
      {/* Header + Meta JSON Toggle */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
          HTML Film Production
        </span>
        <button
          type="button"
          onClick={() => setShowMetaJson((v) => !v)}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-pill)] text-[10px] font-medium border transition-colors ${
            showMetaJson
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          <Code2 className="w-2.5 h-2.5" />
          {showMetaJson ? "Visual" : "Meta JSON"}
        </button>
      </div>

      {showMetaJson ? (
        <pre className="w-full max-h-[360px] overflow-auto rounded-[var(--radius-card)] bg-[var(--bg-input)] border border-[var(--border-color)] p-2.5 font-mono text-[10px] leading-relaxed text-[var(--text-secondary)]">
          {JSON.stringify(filmMeta ?? { exists: false }, null, 2)}
        </pre>
      ) : (
        <>
          {/* Engine Readiness & Static Specs */}
          <div className="p-2.5 rounded-[var(--radius-card)] bg-[var(--bg-card)] border border-[var(--border-color)] space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                {readiness.status === "warning" ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                )}
                <span className="text-[11px] font-medium text-[var(--text-primary)] truncate">
                  {readiness.label}
                </span>
              </div>
              <span className="px-1.5 py-0.5 rounded-[var(--radius-pill)] bg-[var(--bg-input)] border border-[var(--border-color)] font-mono text-[9px] text-[var(--text-secondary)] shrink-0">
                {filmMeta?.engine || "html"}
              </span>
            </div>

            {filmMeta?.lint && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {[
                  { label: "__filmMeta", ok: filmMeta.lint.hasFilmMeta },
                  { label: "renderAt", ok: filmMeta.lint.hasRenderAt },
                  { label: "__ready", ok: filmMeta.lint.hasReadyFlag },
                ].map((chk) => (
                  <span
                    key={chk.label}
                    className={`px-1.5 py-0.5 rounded-[var(--radius-control)] border font-mono text-[9px] ${
                      chk.ok
                        ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                        : "bg-amber-500/10 border-amber-500/25 text-amber-300"
                    }`}
                  >
                    {chk.ok ? "OK" : "!"} {chk.label}
                  </span>
                ))}
              </div>
            )}

            <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-[var(--border-color)] text-[10px]">
              <div>
                <span className="text-[9px] text-[var(--text-muted)] block">Scenes</span>
                <span className="font-mono text-[var(--text-primary)]">{scenes.length}</span>
              </div>
              <div>
                <span className="text-[9px] text-[var(--text-muted)] block">Audio</span>
                <span className="font-mono text-[var(--text-primary)]">{audioAssetsCount}</span>
              </div>
              <div>
                <span className="text-[9px] text-[var(--text-muted)] block">Scripts</span>
                <span className="font-mono text-[var(--text-primary)]">{scriptAssetsCount}</span>
              </div>
            </div>
          </div>

          {/* Now Playing Scene synced with Playhead */}
          {activeEntry ? (
            <div className="p-2.5 rounded-[var(--radius-card)] bg-[var(--bg-card)] border border-emerald-500/25 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />
                  Now Playing · Scene {activeEntry.index + 1}
                </span>
                <span className="font-mono text-[9px] text-[var(--text-muted)]">
                  {activeEntry.scene.startFrame}f–{activeEntry.scene.startFrame + activeEntry.scene.durationFrames}f
                </span>
              </div>
              <p className="text-[11px] font-medium text-[var(--text-primary)] leading-snug">
                {activeEntry.scene.title || activeEntry.scene.id}
              </p>
              <div className="flex items-center justify-between gap-2 text-[10px] text-[var(--text-muted)]">
                <span className="flex items-center gap-1 truncate font-mono">
                  <Music2 className="w-3 h-3 text-emerald-400/80 shrink-0" />
                  {formatAudioTrackLabel(activeEntry.scene.audio)}
                </span>
                <span className="font-mono shrink-0">
                  {formatDurationSeconds(activeEntry.scene.durationFrames / displayFps)}
                </span>
              </div>
            </div>
          ) : null}

          {/* Scene Breakdown List (Click to Seek) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
                <Film className="w-3 h-3" />
                Scene Breakdown ({scenes.length})
              </span>
              <span className="font-mono text-[9px] text-[var(--text-muted)]">
                {totalFrames}f @ {displayFps}fps
              </span>
            </div>

            {scenes.length === 0 ? (
              <div className="p-2.5 rounded-[var(--radius-card)] bg-[var(--bg-card)] border border-[var(--border-color)] text-[10px] text-[var(--text-muted)]">
                Belum ada scene di <code className="font-mono">index.html</code> (`window.__filmMeta`).
              </div>
            ) : (
              <div className="space-y-1 max-h-[240px] overflow-y-auto pr-0.5">
                {scenes.map((scene, idx) => {
                  const isCurrent = activeEntry?.scene.id === scene.id;
                  const endFrame = scene.startFrame + scene.durationFrames;
                  const sceneSeconds = scene.durationFrames / displayFps;
                  return (
                    <button
                      key={`${scene.id}-${idx}`}
                      type="button"
                      onClick={() => onSeekFrame(scene.startFrame)}
                      className={`w-full text-left p-2 rounded-[var(--radius-card)] border transition-colors ${
                        isCurrent
                          ? "bg-emerald-500/10 border-emerald-500/35 text-[var(--text-primary)]"
                          : "bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium truncate">
                          {idx + 1}. {scene.title || scene.id}
                        </span>
                        <span className="font-mono text-[9px] text-[var(--text-muted)] shrink-0 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {formatDurationSeconds(sceneSeconds)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2 text-[9px] text-[var(--text-muted)] font-mono">
                        <span className="truncate">{formatAudioTrackLabel(scene.audio)}</span>
                        <span className="shrink-0">
                          {scene.startFrame}f–{endFrame}f
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

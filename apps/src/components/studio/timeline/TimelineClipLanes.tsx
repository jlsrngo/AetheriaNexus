import type { Dispatch, RefObject, SetStateAction } from "react";
import { cn } from "../../../lib/utils";
import type { StudioSubtitleCue } from "../../../types/studio";
import type { VideoLayerSpec } from "../../../types/video";
import { getLayerPalette } from "./timelineLayerUtils";
import { TimelineRulerTicks } from "./TimelineRulerTicks";

interface TimelineClipLanesProps {
  layers: VideoLayerSpec[];
  subtitles: StudioSubtitleCue[];
  selectedLayerId: string | null;
  layerColors?: Record<string, string>;
  durationInFrames: number;
  lastFrame: number;
  fps: number;
  progress: number;
  zoomMultiplier: number;
  rulerWidth: number;
  inPercent: number | null;
  outPercent: number | null;
  rulerRef: RefObject<HTMLDivElement | null>;
  leftScrollRef: RefObject<HTMLDivElement | null>;
  rightScrollRef: RefObject<HTMLDivElement | null>;
  setTimelineZoom: Dispatch<SetStateAction<number>>;
  onSeek: (frame: number) => void;
  onSeekFromClientX: (clientX: number) => void;
  onStartClipDrag: (
    e: React.MouseEvent,
    layer: VideoLayerSpec,
    mode: "move" | "trim-start" | "trim-end"
  ) => void;
  onEditLayer: (layer: VideoLayerSpec) => void;
}

export const TimelineClipLanes: React.FC<TimelineClipLanesProps> = ({
  layers,
  subtitles,
  selectedLayerId,
  layerColors,
  durationInFrames,
  lastFrame,
  fps,
  progress,
  zoomMultiplier,
  rulerWidth,
  inPercent,
  outPercent,
  rulerRef,
  leftScrollRef,
  rightScrollRef,
  setTimelineZoom,
  onSeek,
  onSeekFromClientX,
  onStartClipDrag,
  onEditLayer,
}) => {
  return (
    <div
      className="flex-1 relative flex flex-col min-h-0 overflow-x-auto overflow-y-hidden bg-[#0A0A0C]"
      onWheel={(e) => {
        if (e.ctrlKey || e.altKey) {
          e.preventDefault();
          const delta = e.deltaY < 0 ? 5 : -5;
          setTimelineZoom((z) => Math.max(-100, Math.min(100, z + delta)));
        }
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && zoomMultiplier < 1) {
          onSeek(lastFrame);
        }
      }}
    >
      <div
        className={cn(
          "relative flex-1 flex flex-col min-h-0",
          zoomMultiplier < 1 && "border-r-2 border-amber-500/60 shadow-lg"
        )}
        style={{
          width: `${zoomMultiplier * 100}%`,
          minWidth: zoomMultiplier >= 1 ? "100%" : `${zoomMultiplier * 100}%`,
        }}
      >
        {(inPercent !== null || outPercent !== null) && (
          <div
            className="absolute top-0 bottom-0 bg-[#23190B] border-x border-[#D97706] pointer-events-none z-0"
            style={{
              left: `${inPercent ?? 0}%`,
              width: `${Math.max(0, (outPercent ?? 100) - (inPercent ?? 0))}%`,
            }}
          />
        )}

        <TimelineRulerTicks
          rulerRef={rulerRef}
          durationInFrames={durationInFrames}
          lastFrame={lastFrame}
          fps={fps}
          rulerWidth={rulerWidth}
          onSeekFromClientX={onSeekFromClientX}
        />

        <div
          ref={rightScrollRef}
          onScroll={(e) => {
            if (leftScrollRef.current) {
              leftScrollRef.current.scrollTop = e.currentTarget.scrollTop;
            }
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              onSeekFromClientX(e.clientX);
            }
          }}
          className="flex-1 overflow-y-auto divide-y divide-[var(--border-color)]/40 relative"
        >
          {layers.map((layer, idx) => {
            const leftPct = Math.min(
              100,
              (layer.from / Math.max(1, durationInFrames)) * 100
            );
            const widthPct = Math.max(
              0.1,
              (layer.durationInFrames / Math.max(1, durationInFrames)) * 100
            );
            const isSelected = layer.id === selectedLayerId;
            const palette = getLayerPalette(layer, idx, layerColors);

            return (
              <div
                key={layer.id}
                onMouseDown={(e) => {
                  if (e.target === e.currentTarget) {
                    onSeekFromClientX(e.clientX);
                  }
                }}
                className="h-7 relative flex items-center"
              >
                <div
                  style={{
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                    ...(palette.customHex && layer.visible
                      ? {
                          backgroundColor: `${palette.customHex}33`,
                          borderColor: `${palette.customHex}99`,
                          boxShadow: isSelected
                            ? `0 0 0 1px ${palette.customHex}`
                            : undefined,
                        }
                      : {}),
                  }}
                  onMouseDown={(e) => onStartClipDrag(e, layer, "move")}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onEditLayer(layer);
                  }}
                  className={cn(
                    "group absolute top-1 bottom-1 rounded border flex items-center justify-between overflow-hidden select-none transition-colors cursor-grab active:cursor-grabbing",
                    !layer.visible
                      ? "bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-muted)] opacity-50"
                      : cn(palette.clip, isSelected && palette.selected)
                  )}
                  title={`${layer.trackCode} ${layer.label} (${layer.from}f – ${
                    layer.from + layer.durationInFrames
                  }f) • Double-click clip to open editor popup, drag center to move, drag edges to trim`}
                >
                  <div
                    onMouseDown={(e) => onStartClipDrag(e, layer, "trim-start")}
                    className={cn(
                      "w-1.5 h-full cursor-ew-resize shrink-0 transition-colors",
                      palette.handle
                    )}
                    title="Trim Start Frame"
                  />

                  <div className="px-1.5 flex items-center justify-between gap-2 min-w-0 flex-1">
                    <span className="text-[10px] font-medium truncate flex items-center gap-1.5">
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full shrink-0",
                          layer.visible ? palette.dot : "bg-[var(--text-muted)]"
                        )}
                        style={
                          palette.customHex && layer.visible
                            ? { backgroundColor: palette.customHex }
                            : undefined
                        }
                      />
                      {layer.content ?? layer.label}
                    </span>
                    <span className="text-[9px] font-mono opacity-80 shrink-0">
                      {layer.from}f–{layer.from + layer.durationInFrames}f
                    </span>
                  </div>

                  <div
                    onMouseDown={(e) => onStartClipDrag(e, layer, "trim-end")}
                    className={cn(
                      "w-1.5 h-full cursor-ew-resize shrink-0 transition-colors",
                      palette.handle
                    )}
                    title="Trim End Frame"
                  />
                </div>
              </div>
            );
          })}

          {subtitles.length > 0 && (
            <div className="h-7 relative">
              {subtitles.map((cue, idx) => {
                const startPct = Math.min(
                  100,
                  (cue.startFrame / Math.max(1, lastFrame)) * 100
                );
                const widthPct = Math.max(
                  1.5,
                  ((cue.endFrame - cue.startFrame) / Math.max(1, lastFrame)) * 100
                );
                return (
                  <div
                    key={`${cue.startFrame}-${idx}`}
                    style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                    className="absolute top-1 bottom-1 bg-[#5C2D0C] border border-[#F59E0B] rounded px-1 flex items-center overflow-hidden"
                    title={`${cue.text} (${cue.startFrame}f - ${cue.endFrame}f)`}
                  >
                    <span className="text-[9px] font-mono text-[#FEF3C7] truncate">
                      {cue.text}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Playhead Vertical Line */}
        <div
          className="absolute top-0 bottom-0 w-px bg-amber-500 pointer-events-none z-20"
          style={{ left: `${progress * 100}%` }}
        >
          <div className="absolute top-0 -left-[4px] w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-black" />
        </div>
      </div>
    </div>
  );
};

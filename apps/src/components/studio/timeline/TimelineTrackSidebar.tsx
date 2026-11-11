import type { RefObject } from "react";
import {
  Eye,
  EyeOff,
  Layers,
  Sparkles,
  Type,
  Award,
  Captions,
  Trash2,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import type { StudioSubtitleCue } from "../../../types/studio";
import type { VideoLayerSpec } from "../../../types/video";
import { getLayerPalette } from "./timelineLayerUtils";

interface TimelineTrackSidebarProps {
  layers: VideoLayerSpec[];
  subtitles: StudioSubtitleCue[];
  selectedLayerId: string | null;
  layerColors?: Record<string, string>;
  leftScrollRef: RefObject<HTMLDivElement | null>;
  rightScrollRef: RefObject<HTMLDivElement | null>;
  onSelectLayer: (layer: VideoLayerSpec) => void;
  onEditLayer: (layer: VideoLayerSpec) => void;
  onToggleVisibility: (layer: VideoLayerSpec) => void;
  onRemoveCustomLayer: (layerId: string) => void;
}

function LayerKindIcon({
  kind,
  iconClass,
}: {
  kind: VideoLayerSpec["kind"];
  iconClass: string;
}) {
  switch (kind) {
    case "background":
      return <Layers className={cn("w-3 h-3 shrink-0", iconClass)} />;
    case "pattern":
    case "media":
      return <Sparkles className={cn("w-3 h-3 shrink-0", iconClass)} />;
    case "icon":
    case "badge":
      return <Award className={cn("w-3 h-3 shrink-0", iconClass)} />;
    case "text":
    default:
      return <Type className={cn("w-3 h-3 shrink-0", iconClass)} />;
  }
}

export const TimelineTrackSidebar: React.FC<TimelineTrackSidebarProps> = ({
  layers,
  subtitles,
  selectedLayerId,
  layerColors,
  leftScrollRef,
  rightScrollRef,
  onSelectLayer,
  onEditLayer,
  onToggleVisibility,
  onRemoveCustomLayer,
}) => {
  return (
    <div className="w-[245px] shrink-0 border-r border-[var(--border-color)] bg-[var(--bg-panel)] flex flex-col min-h-0">
      <div className="h-6 px-2.5 border-b border-[var(--border-color)] flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] shrink-0">
        <span>Track / Component Layer</span>
        <span>Visibility</span>
      </div>

      <div
        ref={leftScrollRef}
        onScroll={(e) => {
          if (rightScrollRef.current) {
            rightScrollRef.current.scrollTop = e.currentTarget.scrollTop;
          }
        }}
        className="flex-1 overflow-y-auto divide-y divide-[var(--border-color)]/50"
      >
        {layers.map((layer, idx) => {
          const isSelected = layer.id === selectedLayerId;
          const palette = getLayerPalette(layer, idx, layerColors);
          return (
            <div
              key={layer.id}
              onClick={() => onSelectLayer(layer)}
              onDoubleClick={() => onEditLayer(layer)}
              className={cn(
                "h-7 px-2 flex items-center justify-between gap-1.5 transition-colors cursor-pointer",
                isSelected
                  ? "bg-[var(--bg-hover)]"
                  : "hover:bg-[var(--bg-hover)]/60"
              )}
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span
                  className={cn(
                    "w-7 text-[9px] font-mono font-bold border rounded px-1 py-0.5 text-center shrink-0",
                    layer.visible
                      ? palette.badge
                      : "text-[var(--text-muted)] bg-[var(--bg-card)] border-[var(--border-color)] opacity-50"
                  )}
                  style={
                    palette.customHex && layer.visible
                      ? {
                          backgroundColor: `${palette.customHex}25`,
                          borderColor: `${palette.customHex}80`,
                          color: palette.customHex,
                        }
                      : undefined
                  }
                >
                  {layer.trackCode}
                </span>
                <LayerKindIcon
                  kind={layer.kind}
                  iconClass={
                    layer.visible ? palette.icon : "text-[var(--text-muted)]"
                  }
                />
                <span
                  className={cn(
                    "text-[11px] truncate",
                    layer.visible
                      ? "text-[var(--text-primary)] font-medium"
                      : "text-[var(--text-muted)] line-through"
                  )}
                >
                  {layer.label}
                </span>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                {layer.isCustom && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveCustomLayer(layer.id);
                    }}
                    className="p-1 rounded text-[var(--text-muted)] hover:text-rose-400 hover:bg-[var(--bg-card)] transition-colors cursor-pointer"
                    title="Delete Dynamic Layer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleVisibility(layer);
                  }}
                  className={cn(
                    "p-1 rounded hover:bg-[var(--bg-card)] transition-colors cursor-pointer shrink-0",
                    layer.visible ? palette.icon : "text-[var(--text-muted)]"
                  )}
                  title={layer.visible ? "Hide Layer" : "Show Layer"}
                >
                  {layer.visible ? (
                    <Eye className="w-3 h-3" />
                  ) : (
                    <EyeOff className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>
          );
        })}

        {subtitles.length > 0 && (
          <div className="h-7 px-2 flex items-center justify-between gap-1.5 bg-[var(--bg-card)]">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-7 text-[9px] font-mono font-bold text-amber-400 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded px-1 py-0.5 text-center shrink-0">
                SUB
              </span>
              <Captions className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="text-[11px] text-[var(--text-primary)] font-medium truncate">
                Auto-Captions ({subtitles.length} cues)
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

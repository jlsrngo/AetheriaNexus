import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useStudioStore } from "../../hooks/useStudioStore";
import { useTimelineFilmMeta } from "../../hooks/useTimelineFilmMeta";
import { useTimelineActions } from "../../hooks/useTimelineActions";
import { useTimelineInteractions } from "../../hooks/useTimelineInteractions";
import { buildCompositionLayers, type VideoLayerSpec } from "../../types/video";
import { ClipEditModal } from "./ClipEditModal";
import { TimelineHeaderToolbar } from "./timeline/TimelineHeaderToolbar";
import { TimelineTrackSidebar } from "./timeline/TimelineTrackSidebar";
import { TimelineClipLanes } from "./timeline/TimelineClipLanes";
import { buildDynamicHtmlSceneLayers } from "./timeline/timelineLayerUtils";

interface TimelineProps {
  compositionId: string;
  durationInFrames: number;
  fps: number;
  currentFrame: number;
  isPlaying: boolean;
  onSeek: (frame: number) => void;
  onTogglePlay: () => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  durationInFrames,
  fps,
  currentFrame,
  isPlaying,
  onSeek,
  onTogglePlay,
}) => {
  const {
    activeComposition,
    canvas,
    subtitleCues,
    renderJobs,
    undoStack,
    redoStack,
    actions,
  } = useStudioStore();

  const [isTimelineCollapsed, setIsTimelineCollapsed] = useState<boolean>(false);
  const [timelineZoom, setTimelineZoom] = useState<number>(0);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>("text-hook");
  const [modalLayer, setModalLayer] = useState<VideoLayerSpec | null>(null);
  const [isSnapping, setIsSnapping] = useState<boolean>(true);

  const activeFilmMeta = useTimelineFilmMeta(activeComposition.id);
  const lastFrame = Math.max(0, durationInFrames - 1);
  const progress = lastFrame === 0 ? 0 : currentFrame / lastFrame;

  const baseLayers = useMemo(() => {
    const dynamicLayers = buildDynamicHtmlSceneLayers(activeFilmMeta, durationInFrames);
    if (dynamicLayers && dynamicLayers.length > 0) {
      return dynamicLayers;
    }
    return buildCompositionLayers(activeComposition.props, durationInFrames);
  }, [activeFilmMeta, activeComposition.props, durationInFrames]);

  const timelineActions = useTimelineActions({
    activeComposition,
    canvas,
    renderJobs,
    actions,
    layers: baseLayers,
    durationInFrames,
    lastFrame,
    currentFrame,
    selectedLayerId,
    setSelectedLayerId,
  });

  const interactions = useTimelineInteractions({
    durationInFrames,
    lastFrame,
    currentFrame,
    timelineZoom,
    isSnapping,
    canvas,
    layers: baseLayers,
    layerStartFrame: activeComposition.props.layerStartFrame,
    layerDuration: activeComposition.props.layerDuration,
    onSeek,
    setSelectedLayerId,
    updateActiveProps: actions.updateActiveProps,
    onUndo: actions.undoProps,
    onRedo: actions.redoProps,
    onDuplicateLayer: timelineActions.handleDuplicateLayer,
    onSplitClip: timelineActions.handleSplitClip,
    onDeleteSelectedLayer: timelineActions.handleDeleteSelectedLayer,
  });

  // Merge local 60fps drag override so dragging never re-renders the player on every pixel
  const layers = useMemo(() => {
    if (!interactions.dragOverride) return baseLayers;
    const override = interactions.dragOverride;
    return baseLayers.map((l) =>
      l.id === override.id
        ? { ...l, from: override.from, durationInFrames: override.durationInFrames }
        : l
    );
  }, [baseLayers, interactions.dragOverride]);

  const selectedLayer = useMemo(
    () => layers.find((l) => l.id === selectedLayerId) ?? null,
    [layers, selectedLayerId]
  );

  const step = (delta: number) =>
    onSeek(Math.min(lastFrame, Math.max(0, currentFrame + delta)));

  const inPercent =
    canvas.inFrame !== null && lastFrame > 0
      ? (canvas.inFrame / lastFrame) * 100
      : null;
  const outPercent =
    canvas.outFrame !== null && lastFrame > 0
      ? (canvas.outFrame / lastFrame) * 100
      : null;

  return (
    <section
      className="shrink-0 border-t border-[var(--border-color)] bg-[var(--bg-app)] flex flex-col select-none relative transition-all duration-150"
      style={{ height: isTimelineCollapsed ? "auto" : interactions.timelineHeight }}
    >
      {!isTimelineCollapsed && (
        <div
          onMouseDown={interactions.startResizeHeight}
          className="h-1 w-full cursor-row-resize hover:bg-[#cf6613] transition-colors shrink-0"
          title="Drag to resize Timeline height"
        />
      )}

      <TimelineHeaderToolbar
        currentFrame={currentFrame}
        durationInFrames={durationInFrames}
        fps={fps}
        isPlaying={isPlaying}
        playbackRate={canvas.playbackRate}
        timelineZoom={timelineZoom}
        isSnapping={isSnapping}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        activeRatio={activeComposition.ratio}
        selectedLayer={selectedLayer}
        isExporting={timelineActions.isExporting}
        isCollapsed={isTimelineCollapsed}
        onToggleCollapse={() => setIsTimelineCollapsed((c) => !c)}
        onTogglePlay={onTogglePlay}
        onStep={step}
        onUndo={() => {
          actions.undoProps();
          toast.info("Undo: Reverted change", { duration: 1200 });
        }}
        onRedo={() => {
          actions.redoProps();
          toast.info("Redo: Reapplied change", { duration: 1200 });
        }}
        onRatioChange={timelineActions.handleRatioChange}
        onFpsChange={(newFps) => {
          actions.updateActiveMetadata({ fps: newFps });
          toast.success(`Frame rate: ${newFps} FPS`);
        }}
        onFit={() => setTimelineZoom(0)}
        onTrimIn={() => {
          actions.updateCanvas({
            inFrame: canvas.inFrame === currentFrame ? null : currentFrame,
          });
          toast.info(`In-point: ${currentFrame}f`);
        }}
        onTrimOut={() => {
          actions.updateCanvas({
            outFrame: canvas.outFrame === currentFrame ? null : currentFrame,
          });
          toast.info(`Out-point: ${currentFrame}f`);
        }}
        onSplit={timelineActions.handleSplitClip}
        onSpeedChange={(speed) => {
          actions.updateCanvas({ playbackRate: speed });
          toast.info(`Playback speed: ${speed}x`);
        }}
        onDuplicate={timelineActions.handleDuplicateLayer}
        onDelete={timelineActions.handleDeleteSelectedLayer}
        onToggleSnap={() => setIsSnapping((s) => !s)}
        onAddLayer={timelineActions.handleAddCustomLayer}
        onExport={() => void timelineActions.handleQuickExport()}
        onShare={() => {
          navigator.clipboard?.writeText(
            JSON.stringify(activeComposition.props, null, 2)
          );
          toast.success("JSON konfigurasi komposisi disalin ke clipboard!");
        }}
        onZoomChange={setTimelineZoom}
      />

      {!isTimelineCollapsed && (
        <div className="flex-1 flex min-h-0 overflow-hidden">
          <TimelineTrackSidebar
            layers={layers}
            subtitles={subtitleCues}
            selectedLayerId={selectedLayerId}
            layerColors={activeComposition.props.layerColors}
            leftScrollRef={interactions.leftScrollRef}
            rightScrollRef={interactions.rightScrollRef}
            onSelectLayer={(layer) => {
              setSelectedLayerId(layer.id);
              onSeek(layer.from);
            }}
            onEditLayer={(layer) => {
              setSelectedLayerId(layer.id);
              setModalLayer(layer);
            }}
            onToggleVisibility={timelineActions.handleToggleLayerVisibility}
            onRemoveCustomLayer={timelineActions.handleRemoveCustomLayer}
          />

          <TimelineClipLanes
            layers={layers}
            subtitles={subtitleCues}
            selectedLayerId={selectedLayerId}
            layerColors={activeComposition.props.layerColors}
            durationInFrames={durationInFrames}
            lastFrame={lastFrame}
            fps={fps}
            progress={progress}
            zoomMultiplier={interactions.zoomMultiplier}
            rulerWidth={interactions.rulerWidth}
            inPercent={inPercent}
            outPercent={outPercent}
            rulerRef={interactions.rulerRef}
            leftScrollRef={interactions.leftScrollRef}
            rightScrollRef={interactions.rightScrollRef}
            setTimelineZoom={setTimelineZoom}
            onSeek={onSeek}
            onSeekFromClientX={interactions.seekFromClientX}
            onStartClipDrag={interactions.startClipDrag}
            onEditLayer={(layer) => {
              setSelectedLayerId(layer.id);
              setModalLayer(layer);
            }}
          />
        </div>
      )}

      {modalLayer && (
        <ClipEditModal
          isOpen={Boolean(modalLayer)}
          layer={modalLayer}
          onClose={() => setModalLayer(null)}
          onSaveContent={timelineActions.handleUpdateLayerContent}
          onSaveTiming={timelineActions.handleUpdateLayerTiming}
          onSaveColor={timelineActions.handleUpdateLayerColor}
          onToggleVisibility={timelineActions.handleToggleLayerVisibility}
          onDeleteCustom={timelineActions.handleRemoveCustomLayer}
          durationInFrames={durationInFrames}
          fps={fps}
        />
      )}
    </section>
  );
};

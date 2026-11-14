import React, { useCallback, useEffect, useRef, useState } from "react";
import { useStudioCanvasInteractions } from "../../hooks/useStudioCanvasInteractions";
import { useStudioFilmLoader } from "../../hooks/useStudioFilmLoader";
import { useStudioStore } from "../../hooks/useStudioStore";
import { activeDirectory } from "../../lib/api";
import { cn } from "../../lib/utils";
import { buildCompositionLayers, type VideoLayerSpec } from "../../types/video";
import { ErrorBoundary } from "../common/ErrorBoundary";
import { CanvasMinimap } from "./CanvasMinimap";
import { ClipEditModal } from "./ClipEditModal";
import { EmptyHtmlStage } from "./HtmlFilmStage";
import { HtmlMotionPlayer, type MotionPlayerHandle } from "./HtmlMotionPlayer";
import {
  CanvasGridOverlay,
  HorizontalRuler,
  SafeZoneGuideOverlay,
  VerticalRuler,
} from "./preview/CanvasRulersAndGrid";
import {
  buildCustomLayerRemovalPatch,
  buildLayerColorPatch,
  buildLayerContentPatch,
  buildLayerOffsetResetPatch,
  buildLayerTimingPatch,
  buildLayerVisibilityPatch,
} from "./preview/layerPropMutations";
import { SelectedLayerOverlay } from "./preview/SelectedLayerOverlay";
import { StudioPreviewHeader } from "./preview/StudioPreviewHeader";
import { WorkspaceFilmErrorBanner } from "./preview/WorkspaceFilmErrorBanner";
import { Timeline } from "./Timeline";

export const StudioPreview: React.FC = () => {
  const playerRef = useRef<MotionPlayerHandle>(null);
  const lastFrameSyncRef = useRef<number>(0);
  const [modalLayer, setModalLayer] = useState<VideoLayerSpec | null>(null);

  const {
    activeComposition,
    durationInFrames,
    currentFrame,
    isPlaying,
    canvas,
    actions,
  } = useStudioStore();

  useEffect(() => {
    void actions.syncFromBackend();
  }, [actions]);

  const {
    workspaceComponent,
    workspaceLoadError,
    workspaceDuration,
    workspaceDims,
    reloadFilm,
  } = useStudioFilmLoader(activeComposition.id);

  const handleSeek = useCallback(
    (frame: number) => {
      playerRef.current?.seekTo(frame);
      actions.setCurrentFrame(frame);
    },
    [actions]
  );

  const handleTogglePlay = useCallback(() => {
    playerRef.current?.toggle();
  }, []);

  const handlePlayerFrameUpdate = useCallback(
    (frame: number) => {
      if (playerRef.current?.isPlaying()) {
        const now = performance.now();
        if (now - lastFrameSyncRef.current >= 50) {
          lastFrameSyncRef.current = now;
          actions.setCurrentFrame(frame);
        }
      } else {
        actions.setCurrentFrame(frame);
      }
    },
    [actions]
  );

  const handlePlayerPlayChange = useCallback(
    (playing: boolean) => {
      actions.setIsPlaying(playing);
      if (!playing && playerRef.current) {
        actions.setCurrentFrame(playerRef.current.getCurrentFrame());
      }
    },
    [actions]
  );

  const handlePlayerSeeked = useCallback(
    (frame: number) => {
      actions.setCurrentFrame(frame);
    },
    [actions]
  );

  const stageWidth = workspaceDims?.width ?? activeComposition.width;
  const stageHeight = workspaceDims?.height ?? activeComposition.height;

  const {
    viewportRef,
    viewportDim,
    cursorPos,
    setCursorPos,
    isPanning,
    isZoomed,
    numericZoom,
    panX,
    panY,
    effectiveScale,
    fitW,
    fitH,
    renderedW,
    renderedH,
    canvasOriginX,
    canvasOriginY,
    selectedLayerId,
    setSelectedLayerId,
    selectedLayerBox,
    handleCanvasWheel,
    handleCanvasMouseDown,
    handleCanvasDoubleClick,
  } = useStudioCanvasInteractions({
    activeComposition,
    stageWidth,
    stageHeight,
    durationInFrames,
    currentFrame,
    canvas,
    updateCanvas: actions.updateCanvas,
    updateActiveProps: actions.updateActiveProps,
    undoProps: actions.undoProps,
    redoProps: actions.redoProps,
    onTogglePlay: handleTogglePlay,
    onOpenLayerModal: setModalLayer,
  });

  const gridCols = Math.max(1, Math.min(64, canvas.gridCols || 3));
  const gridRows = Math.max(1, Math.min(64, canvas.gridRows || 3));

  const scaleStyle: React.CSSProperties =
    canvas.zoom === "fit"
      ? {
          width: `${fitW}px`,
          height: `${fitH}px`,
          willChange: "transform",
          transform: "translateZ(0)",
        }
      : {
          width: `${fitW}px`,
          height: `${fitH}px`,
          transform: `translate(${panX}px, ${panY}px) scale(${numericZoom}) translateZ(0)`,
          transformOrigin: "center center",
          transition: isPanning ? "none" : "transform 0.05s ease-out",
          willChange: "transform",
        };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg-app)]">
      <StudioPreviewHeader
        activeComposition={activeComposition}
        canvas={canvas}
        numericZoom={numericZoom}
        gridCols={gridCols}
        gridRows={gridRows}
        onUpdateCanvas={actions.updateCanvas}
        onRequestFullscreen={() => playerRef.current?.requestFullscreen()}
        onProjectChanged={() => {
          void actions.syncFromBackend();
          reloadFilm();
        }}
      />

      {canvas.showRulers && (
        <HorizontalRuler
          position="top"
          width={viewportDim.w}
          originX={canvasOriginX}
          effectiveScale={effectiveScale}
          cursorX={cursorPos?.x ?? null}
        />
      )}

      <div className="flex-1 min-h-0 flex flex-row overflow-hidden relative">
        {canvas.showRulers && (
          <VerticalRuler
            position="left"
            height={viewportDim.h}
            originY={canvasOriginY}
            effectiveScale={effectiveScale}
            cursorY={cursorPos?.y ?? null}
          />
        )}

        <div
          ref={viewportRef}
          onWheel={handleCanvasWheel}
          onMouseDown={handleCanvasMouseDown}
          onDoubleClick={handleCanvasDoubleClick}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          }}
          onMouseLeave={() => setCursorPos(null)}
          className={cn(
            "flex-1 min-h-0 flex items-center justify-center p-3 relative overflow-hidden bg-[#0A0A0C]",
            isPanning ? "cursor-grabbing" : isZoomed ? "cursor-grab" : "cursor-default"
          )}
        >
          <CanvasGridOverlay
            visible={canvas.showGrid}
            viewportW={viewportDim.w}
            viewportH={viewportDim.h}
            renderedW={renderedW}
            renderedH={renderedH}
            originX={canvasOriginX}
            originY={canvasOriginY}
            gridCols={gridCols}
            gridRows={gridRows}
          />

          <ErrorBoundary
            fullScreen={false}
            fallbackTitle="Preview renderer failed"
            onReset={reloadFilm}
          >
            <div className="w-full h-full flex items-center justify-center relative select-none">
              <HtmlMotionPlayer
                key={`${activeComposition.id}-${workspaceDims?.width ?? activeComposition.width}x${workspaceDims?.height ?? activeComposition.height}-${workspaceDims?.fps ?? activeComposition.fps}`}
                ref={playerRef}
                component={workspaceComponent ?? EmptyHtmlStage}
                inputProps={
                  workspaceComponent
                    ? activeComposition.props
                    : { activeFolder: activeDirectory() ?? null }
                }
                durationInFrames={workspaceDuration ?? durationInFrames}
                fps={workspaceDims?.fps ?? activeComposition.fps}
                compositionWidth={workspaceDims?.width ?? activeComposition.width}
                compositionHeight={workspaceDims?.height ?? activeComposition.height}
                playbackRate={canvas.playbackRate}
                volume={canvas.volume ?? 1}
                isMuted={Boolean(canvas.isMuted || activeComposition.props.isMuted)}
                inFrame={canvas.inFrame}
                outFrame={canvas.outFrame}
                loop={canvas.loop}
                style={scaleStyle}
                onFrameUpdate={handlePlayerFrameUpdate}
                onPlayChange={handlePlayerPlayChange}
                onSeeked={handlePlayerSeeked}
              />

              <WorkspaceFilmErrorBanner error={workspaceLoadError} onReload={reloadFilm} />

              <SafeZoneGuideOverlay
                visible={canvas.showGuides}
                originX={canvasOriginX}
                originY={canvasOriginY}
                renderedW={renderedW}
                renderedH={renderedH}
                ratio={activeComposition.ratio}
              />
            </div>
          </ErrorBoundary>

          <SelectedLayerOverlay
            box={selectedLayerBox}
            selectedLayerId={selectedLayerId}
            offsetX={
              selectedLayerId
                ? (activeComposition.props.layerOffsets?.[selectedLayerId]?.x ?? 0)
                : 0
            }
            offsetY={
              selectedLayerId
                ? (activeComposition.props.layerOffsets?.[selectedLayerId]?.y ?? 0)
                : 0
            }
            onDoubleClickLayer={() => {
              if (!selectedLayerId) return;
              const target = buildCompositionLayers(
                activeComposition.props,
                durationInFrames
              ).find((l) => l.id === selectedLayerId);
              if (target) setModalLayer(target);
            }}
            onResetOffset={() => {
              if (!selectedLayerId) return;
              actions.updateActiveProps(
                buildLayerOffsetResetPatch(activeComposition.props, selectedLayerId)
              );
            }}
            onDeselect={() => setSelectedLayerId(null)}
          />

          {canvas.showMinimap !== false && (
            <CanvasMinimap
              compositionWidth={stageWidth}
              compositionHeight={stageHeight}
              ratio={activeComposition.ratio}
              zoom={canvas.zoom}
              panX={panX}
              panY={panY}
              viewportWidth={viewportDim.w}
              viewportHeight={viewportDim.h}
              effectiveScale={effectiveScale}
              onPanChange={(px, py) => actions.updateCanvas({ panX: px, panY: py })}
              onResetZoom={() => actions.updateCanvas({ zoom: "fit", panX: 0, panY: 0 })}
              onClose={() => actions.updateCanvas({ showMinimap: false })}
            />
          )}
        </div>

        {canvas.showRulers && (
          <VerticalRuler
            position="right"
            height={viewportDim.h}
            originY={canvasOriginY}
            effectiveScale={effectiveScale}
            cursorY={cursorPos?.y ?? null}
          />
        )}
      </div>

      {canvas.showRulers && (
        <HorizontalRuler
          position="bottom"
          width={viewportDim.w}
          originX={canvasOriginX}
          effectiveScale={effectiveScale}
          cursorX={cursorPos?.x ?? null}
        />
      )}

      {canvas.showTimeline && (
        <Timeline
          compositionId={activeComposition.id}
          durationInFrames={workspaceDuration ?? durationInFrames}
          fps={workspaceDims?.fps ?? activeComposition.fps}
          currentFrame={currentFrame}
          isPlaying={isPlaying}
          onSeek={handleSeek}
          onTogglePlay={handleTogglePlay}
        />
      )}

      {modalLayer && (
        <ClipEditModal
          isOpen={Boolean(modalLayer)}
          layer={modalLayer}
          onClose={() => setModalLayer(null)}
          onSaveContent={(layer, nextValue) => {
            const patch = buildLayerContentPatch(activeComposition.props, layer, nextValue);
            if (patch) actions.updateActiveProps(patch);
          }}
          onSaveTiming={(layer, nextFrom, nextDur) =>
            actions.updateActiveProps(
              buildLayerTimingPatch(activeComposition.props, layer, nextFrom, nextDur)
            )
          }
          onSaveColor={(layer, newColor) =>
            actions.updateActiveProps(
              buildLayerColorPatch(activeComposition.props, layer, newColor)
            )
          }
          onToggleVisibility={(layer) =>
            actions.updateActiveProps(
              buildLayerVisibilityPatch(activeComposition.props, layer)
            )
          }
          onDeleteCustom={(layerId) => {
            actions.updateActiveProps(
              buildCustomLayerRemovalPatch(activeComposition.props, layerId)
            );
            setModalLayer(null);
          }}
          durationInFrames={durationInFrames}
          fps={activeComposition.fps}
        />
      )}
    </div>
  );
};

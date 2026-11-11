import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { StudioCanvasSettings, StudioComposition } from "../types/studio";
import {
  buildCompositionLayers,
  type NexusVideoProps,
  type VideoLayerSpec,
} from "../types/video";

export interface SelectedLayerBox {
  left: number;
  top: number;
  width: number;
  height: number;
  layerName: string;
}

interface UseStudioCanvasInteractionsArgs {
  activeComposition: StudioComposition;
  durationInFrames: number;
  currentFrame: number;
  canvas: StudioCanvasSettings;
  updateCanvas: (partial: Partial<StudioCanvasSettings>) => void;
  updateActiveProps: (
    partial: Partial<NexusVideoProps>,
    options?: { recordHistory?: boolean; customPrevProps?: NexusVideoProps }
  ) => void;
  undoProps: () => void;
  redoProps: () => void;
  onTogglePlay: () => void;
  onOpenLayerModal: (layer: VideoLayerSpec) => void;
}

/**
 * Encapsulates viewport resize tracking, pan/zoom math, layer dragging, bounding-box sync,
 * and Studio preview keyboard shortcuts.
 */
export function useStudioCanvasInteractions({
  activeComposition,
  durationInFrames,
  currentFrame,
  canvas,
  updateCanvas,
  updateActiveProps,
  undoProps,
  redoProps,
  onTogglePlay,
  onOpenLayerModal,
}: UseStudioCanvasInteractionsArgs) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportDim, setViewportDim] = useState<{ w: number; h: number }>({ w: 800, h: 600 });
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [selectedLayerBox, setSelectedLayerBox] = useState<SelectedLayerBox | null>(null);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setViewportDim({ w: entry.contentRect.width, h: entry.contentRect.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const handleGlobalSpaceKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        e.stopPropagation();
        onTogglePlay();
      }
    };
    window.addEventListener("keydown", handleGlobalSpaceKey, { capture: true });
    return () => window.removeEventListener("keydown", handleGlobalSpaceKey, { capture: true });
  }, [onTogglePlay]);

  const numericZoom = canvas.zoom === "fit" ? 1 : Math.max(0.25, Math.min(10, canvas.zoom));
  const isZoomed = canvas.zoom !== "fit" && numericZoom > 1.05;
  const panX = canvas.panX ?? 0;
  const panY = canvas.panY ?? 0;

  const compW = activeComposition.width;
  const compH = activeComposition.height;
  const fitRatio = Math.min(
    Math.max(1, viewportDim.w - 32) / compW,
    Math.max(1, viewportDim.h - 32) / compH
  );
  const effectiveScale = canvas.zoom === "fit" ? fitRatio : fitRatio * numericZoom;
  const renderedW = compW * effectiveScale;
  const renderedH = compH * effectiveScale;
  const canvasOriginX = (viewportDim.w - renderedW) / 2 + (canvas.zoom === "fit" ? 0 : panX);
  const canvasOriginY = (viewportDim.h - renderedH) / 2 + (canvas.zoom === "fit" ? 0 : panY);

  const handleCanvasWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mouseRelX = e.clientX - rect.left - rect.width / 2;
      const mouseRelY = e.clientY - rect.top - rect.height / 2;
      const currentZoomVal = canvas.zoom === "fit" ? 1 : canvas.zoom;
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      const nextZoom = Math.max(
        0.25,
        Math.min(10.0, Number((currentZoomVal * factor).toFixed(2)))
      );
      const curPanX = canvas.zoom === "fit" ? 0 : panX;
      const curPanY = canvas.zoom === "fit" ? 0 : panY;
      const zoomRatio = nextZoom / currentZoomVal;
      updateCanvas({
        zoom: nextZoom,
        panX: Math.round(mouseRelX - (mouseRelX - curPanX) * zoomRatio),
        panY: Math.round(mouseRelY - (mouseRelY - curPanY) * zoomRatio),
      });
    },
    [canvas.zoom, panX, panY, updateCanvas]
  );

  const updateBoundingBox = useCallback(() => {
    if (!selectedLayerId || !viewportRef.current) {
      setSelectedLayerBox(null);
      return;
    }
    const el = viewportRef.current.querySelector(
      `[data-nexus-layer-id="${selectedLayerId}"]`
    ) as HTMLElement | null;
    if (!el) {
      setSelectedLayerBox(null);
      return;
    }
    const elRect = el.getBoundingClientRect();
    const vpRect = viewportRef.current.getBoundingClientRect();
    setSelectedLayerBox({
      left: elRect.left - vpRect.left,
      top: elRect.top - vpRect.top,
      width: elRect.width,
      height: elRect.height,
      layerName: el.getAttribute("data-nexus-layer-name") || selectedLayerId,
    });
  }, [selectedLayerId]);

  useEffect(() => {
    updateBoundingBox();
    const frameId = requestAnimationFrame(updateBoundingBox);
    return () => cancelAnimationFrame(frameId);
  }, [updateBoundingBox, numericZoom, panX, panY, currentFrame, activeComposition.props]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      if (isCtrlOrMeta && !e.shiftKey && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        undoProps();
        toast.info("Undo: Reverted change", { duration: 1200 });
        return;
      }
      if (
        (isCtrlOrMeta && (e.key === "y" || e.key === "Y")) ||
        (isCtrlOrMeta && e.shiftKey && (e.key === "z" || e.key === "Z"))
      ) {
        e.preventDefault();
        redoProps();
        toast.info("Redo: Reapplied change", { duration: 1200 });
        return;
      }
      if (e.key === "Escape") {
        setSelectedLayerId(null);
        return;
      }
      if (!selectedLayerId) return;
      const step = e.shiftKey ? 10 : 1;
      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowLeft") dx = -step;
      else if (e.key === "ArrowRight") dx = step;
      else if (e.key === "ArrowUp") dy = -step;
      else if (e.key === "ArrowDown") dy = step;
      else return;

      e.preventDefault();
      const currentOffsets = activeComposition.props.layerOffsets || {};
      const cur = currentOffsets[selectedLayerId] || { x: 0, y: 0 };
      updateActiveProps({
        layerOffsets: {
          ...currentOffsets,
          [selectedLayerId]: { x: cur.x + dx, y: cur.y + dy },
        },
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeComposition.props.layerOffsets, redoProps, selectedLayerId, undoProps, updateActiveProps]);

  const startViewportPan = (startClientX: number, startClientY: number) => {
    setIsPanning(true);
    const origPanX = canvas.panX ?? 0;
    const origPanY = canvas.panY ?? 0;

    const onMove = (moveEvent: PointerEvent) => {
      updateCanvas({
        panX: Math.round(origPanX + (moveEvent.clientX - startClientX)),
        panY: Math.round(origPanY + (moveEvent.clientY - startClientY)),
      });
    };
    const onUp = () => {
      setIsPanning(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const startLayerDrag = (layerId: string, startClientX: number, startClientY: number) => {
    setSelectedLayerId(layerId);
    const initialProps = JSON.parse(JSON.stringify(activeComposition.props)) as NexusVideoProps;
    const orig = (activeComposition.props.layerOffsets || {})[layerId] || { x: 0, y: 0 };
    let rafId: number | null = null;
    let latestX = orig.x;
    let latestY = orig.y;

    const onMove = (moveEvent: PointerEvent) => {
      latestX = Math.round(orig.x + (moveEvent.clientX - startClientX) / effectiveScale);
      latestY = Math.round(orig.y + (moveEvent.clientY - startClientY) / effectiveScale);
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          updateActiveProps(
            {
              layerOffsets: {
                ...activeComposition.props.layerOffsets,
                [layerId]: { x: latestX, y: latestY },
              },
            },
            { recordHistory: false }
          );
        });
      }
    };
    const onUp = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (latestX !== orig.x || latestY !== orig.y) {
        updateActiveProps(
          {
            layerOffsets: {
              ...activeComposition.props.layerOffsets,
              [layerId]: { x: latestX, y: latestY },
            },
          },
          { recordHistory: true, customPrevProps: initialProps }
        );
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      startViewportPan(e.clientX, e.clientY);
      return;
    }
    if (e.button !== 0) return;

    const clickedLayerEl = (e.target as HTMLElement).closest(
      "[data-nexus-layer-id]"
    ) as HTMLElement | null;
    const clickedLayerId = clickedLayerEl?.getAttribute("data-nexus-layer-id");
    if (clickedLayerId) {
      e.preventDefault();
      e.stopPropagation();
      startLayerDrag(clickedLayerId, e.clientX, e.clientY);
      return;
    }

    const clickedBoundingBox = (e.target as HTMLElement).closest(
      "[data-nexus-bounding-box]"
    ) as HTMLElement | null;
    if (clickedBoundingBox && selectedLayerId) {
      e.preventDefault();
      e.stopPropagation();
      startLayerDrag(selectedLayerId, e.clientX, e.clientY);
      return;
    }

    setSelectedLayerId(null);
    e.preventDefault();
    startViewportPan(e.clientX, e.clientY);
  };

  const handleCanvasDoubleClick = (e: React.MouseEvent) => {
    const clickedLayerEl = (e.target as HTMLElement).closest(
      "[data-nexus-layer-id]"
    ) as HTMLElement | null;
    const layerId = clickedLayerEl?.getAttribute("data-nexus-layer-id") || selectedLayerId;
    if (!layerId) return;
    const target = buildCompositionLayers(activeComposition.props, durationInFrames).find(
      (l) => l.id === layerId
    );
    if (target) onOpenLayerModal(target);
  };

  return {
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
  };
}


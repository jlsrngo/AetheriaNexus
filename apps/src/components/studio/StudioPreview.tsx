import { useCallback, useEffect, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import {
  Compass,
  Film,
  Grid,
  Maximize2,
  Repeat,
  RotateCcw,
  Ruler,
  ShieldAlert,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { useStudioStore } from "../../hooks/useStudioStore";
import { cn } from "../../lib/utils";
import { NexusVideoComposition } from "../../remotion/NexusVideoComposition";
import {
  buildCompositionLayers,
  type NexusVideoProps,
  type VideoLayerSpec,
} from "../../remotion/types";
import { ErrorBoundary } from "../common/ErrorBoundary";
import { CanvasMinimap } from "./CanvasMinimap";
import { ClipEditModal } from "./ClipEditModal";
import { Timeline } from "./Timeline";

const GRID_PRESETS = [
  { label: "2×2", cols: 2, rows: 2 },
  { label: "3×3", cols: 3, rows: 3 },
  { label: "4×4", cols: 4, rows: 4 },
  { label: "6×6", cols: 6, rows: 6 },
  { label: "8×8", cols: 8, rows: 8 },
  { label: "12×12", cols: 12, rows: 12 },
  { label: "16×16", cols: 16, rows: 16 },
  { label: "24×24", cols: 24, rows: 24 },
  { label: "9×16", cols: 9, rows: 16 },
  { label: "16×9", cols: 16, rows: 9 },
];

export const StudioPreview: React.FC = () => {
  const playerRef = useRef<PlayerRef>(null);
  const [playerInstance, setPlayerInstance] = useState<PlayerRef | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportDim, setViewportDim] = useState<{ w: number; h: number }>({
    w: 800,
    h: 600,
  });
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(
    null
  );

  // Canvas Viewport Pan & Hand Tool State
  const [isPanning, setIsPanning] = useState(false);

  // Selected Layer & Interactive Canvas Drag State (Corel / Photoshop style)
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [selectedLayerBox, setSelectedLayerBox] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
    layerName: string;
  } | null>(null);

  // Double-Click Popup Layer Edit Modal
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

  // Keep track of viewport container dimensions for 1:1 ruler tracking
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setViewportDim({
          w: entry.contentRect.width,
          h: entry.contentRect.height,
        });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  // Synchronize Remotion Player playback events with global Studio store & timeline
  useEffect(() => {
    if (!playerInstance) return;

    const handleFrame = (event: { detail: { frame: number } }) => {
      actions.setCurrentFrame(event.detail.frame);
    };
    const handlePlay = () => actions.setIsPlaying(true);
    const handlePause = () => actions.setIsPlaying(false);

    playerInstance.addEventListener("frameupdate", handleFrame as any);
    playerInstance.addEventListener("play", handlePlay);
    playerInstance.addEventListener("pause", handlePause);
    playerInstance.addEventListener("seeked", handleFrame as any);

    return () => {
      playerInstance.removeEventListener("frameupdate", handleFrame as any);
      playerInstance.removeEventListener("play", handlePlay);
      playerInstance.removeEventListener("pause", handlePause);
      playerInstance.removeEventListener("seeked", handleFrame as any);
    };
  }, [playerInstance, actions]);

  // Global Video Player Spacebar Shortcut (Universal Play/Pause UX)
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
        handleTogglePlay();
      }
    };

    window.addEventListener("keydown", handleGlobalSpaceKey, { capture: true });
    return () => window.removeEventListener("keydown", handleGlobalSpaceKey, { capture: true });
  }, [handleTogglePlay]);

  const numericZoom =
    canvas.zoom === "fit" ? 1 : Math.max(0.25, Math.min(10, canvas.zoom));
  const isZoomed = canvas.zoom !== "fit" && numericZoom > 1.05;
  const panX = canvas.panX ?? 0;
  const panY = canvas.panY ?? 0;

  // Compute exact canvas coordinate space relative to viewport
  const compW = activeComposition.width;
  const compH = activeComposition.height;
  const fitRatio = Math.min(
    Math.max(1, viewportDim.w - 32) / compW,
    Math.max(1, viewportDim.h - 32) / compH
  );
  const effectiveScale =
    canvas.zoom === "fit" ? fitRatio : fitRatio * numericZoom;
  const renderedW = compW * effectiveScale;
  const renderedH = compH * effectiveScale;
  const canvasOriginX =
    (viewportDim.w - renderedW) / 2 + (canvas.zoom === "fit" ? 0 : panX);
  const canvasOriginY =
    (viewportDim.h - renderedH) / 2 + (canvas.zoom === "fit" ? 0 : panY);

  // Zoom to Mouse Cursor (Smooth anchored zoom like Figma / Photoshop)
  const handleCanvasWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Mouse coordinate relative to the center of viewport
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

    // Shift pan offset so the point directly beneath cursor remains pinned
    const zoomRatio = nextZoom / currentZoomVal;
    const newPanX = Math.round(mouseRelX - (mouseRelX - curPanX) * zoomRatio);
    const newPanY = Math.round(mouseRelY - (mouseRelY - curPanY) * zoomRatio);

    actions.updateCanvas({
      zoom: nextZoom,
      panX: newPanX,
      panY: newPanY,
    });
  };

  // Synchronize Bounding Box with selected layer's DOM element
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
  }, [
    updateBoundingBox,
    numericZoom,
    panX,
    panY,
    currentFrame,
    activeComposition.props,
  ]);

  // Global Shortcuts: Undo (Ctrl+Z), Redo (Ctrl+Y / Ctrl+Shift+Z), Keyboard Nudge, Esc to deselect
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

      // Ctrl+Z (Undo)
      if (isCtrlOrMeta && !e.shiftKey && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        actions.undoProps();
        toast.info("Undo: Reverted change", { duration: 1200 });
        return;
      }

      // Ctrl+Y or Ctrl+Shift+Z (Redo)
      if (
        (isCtrlOrMeta && (e.key === "y" || e.key === "Y")) ||
        (isCtrlOrMeta && e.shiftKey && (e.key === "z" || e.key === "Z"))
      ) {
        e.preventDefault();
        actions.redoProps();
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
      actions.updateActiveProps({
        layerOffsets: {
          ...currentOffsets,
          [selectedLayerId]: {
            x: cur.x + dx,
            y: cur.y + dy,
          },
        },
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [actions, activeComposition.props.layerOffsets, selectedLayerId]);

  // Start smooth viewport panning with pointer tracking
  const startViewportPan = (startClientX: number, startClientY: number) => {
    setIsPanning(true);
    const origPanX = canvas.panX ?? 0;
    const origPanY = canvas.panY ?? 0;

    const onMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startClientX;
      const dy = moveEvent.clientY - startClientY;
      actions.updateCanvas({
        panX: Math.round(origPanX + dx),
        panY: Math.round(origPanY + dy),
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

  // Start interactive layer drag with precision scaling & single undo step
  const startLayerDrag = (
    layerId: string,
    startClientX: number,
    startClientY: number
  ) => {
    setSelectedLayerId(layerId);
    const initialProps = JSON.parse(
      JSON.stringify(activeComposition.props)
    ) as NexusVideoProps;
    const currentOffsets = activeComposition.props.layerOffsets || {};
    const orig = currentOffsets[layerId] || { x: 0, y: 0 };
    const startOffX = orig.x;
    const startOffY = orig.y;

    let rafId: number | null = null;
    let latestX = startOffX;
    let latestY = startOffY;

    const onMove = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startClientX) / effectiveScale;
      const dy = (moveEvent.clientY - startClientY) / effectiveScale;
      latestX = Math.round(startOffX + dx);
      latestY = Math.round(startOffY + dy);

      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          actions.updateActiveProps(
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
      if (latestX !== startOffX || latestY !== startOffY) {
        actions.updateActiveProps(
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

  // Unified Canvas Pointer Interaction
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // 1. Hand tool active (Middle mouse button OR Alt key) -> Viewport Pan
    if (e.button === 1 || e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      startViewportPan(e.clientX, e.clientY);
      return;
    }

    if (e.button !== 0) return; // Only left-click below

    // 2. Clicked on an interactive layer element
    const clickedLayerEl = (e.target as HTMLElement).closest(
      "[data-nexus-layer-id]"
    ) as HTMLElement | null;
    if (clickedLayerEl) {
      const layerId = clickedLayerEl.getAttribute("data-nexus-layer-id");
      if (layerId) {
        e.preventDefault();
        e.stopPropagation();
        startLayerDrag(layerId, e.clientX, e.clientY);
        return;
      }
    }

    // 3. Clicked on the active Bounding Box overlay or its position pill
    const clickedBoundingBox = (e.target as HTMLElement).closest(
      "[data-nexus-bounding-box]"
    ) as HTMLElement | null;
    if (clickedBoundingBox && selectedLayerId) {
      e.preventDefault();
      e.stopPropagation();
      startLayerDrag(selectedLayerId, e.clientX, e.clientY);
      return;
    }

    // 4. Clicked on canvas background / empty area:
    // A) Immediately deselect the active layer!
    setSelectedLayerId(null);

    // B) Smoothly start panning the canvas viewport
    e.preventDefault();
    startViewportPan(e.clientX, e.clientY);
  };

  // Double click anywhere on canvas to open popup editor
  const handleCanvasDoubleClick = (e: React.MouseEvent) => {
    const clickedLayerEl = (e.target as HTMLElement).closest(
      "[data-nexus-layer-id]"
    ) as HTMLElement | null;
    const layerId =
      clickedLayerEl?.getAttribute("data-nexus-layer-id") || selectedLayerId;
    if (layerId) {
      const layers = buildCompositionLayers(
        activeComposition.props,
        durationInFrames
      );
      const target = layers.find((l) => l.id === layerId);
      if (target) {
        setModalLayer(target);
      }
    }
  };

  const handleResetLayerOffset = (layerId: string) => {
    const currentOffsets = { ...(activeComposition.props.layerOffsets || {}) };
    delete currentOffsets[layerId];
    actions.updateActiveProps({ layerOffsets: currentOffsets });
  };

  const handleUpdateLayerContent = (
    layer: VideoLayerSpec,
    nextValue: string
  ) => {
    const props = activeComposition.props;
    if (layer.id === "text-hook") {
      actions.updateActiveProps({ hookText: nextValue });
      return;
    }
    if (layer.id === "hud-category") {
      actions.updateActiveProps({ category: nextValue });
      return;
    }
    if (layer.id === "hud-subcategory") {
      actions.updateActiveProps({ subCategory: nextValue });
      return;
    }
    if (layer.id === "footer-author") {
      actions.updateActiveProps({ authorHandle: nextValue });
      return;
    }
    if (layer.id === "footer-tag") {
      actions.updateActiveProps({ editorialTag: nextValue });
      return;
    }
    if (layer.id.startsWith("text-bullet-")) {
      const bulletIdx = Number(layer.id.replace("text-bullet-", ""));
      const lines = (props.bodyText || "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      if (
        !Number.isNaN(bulletIdx) &&
        bulletIdx >= 0 &&
        bulletIdx < lines.length
      ) {
        lines[bulletIdx] = nextValue;
        actions.updateActiveProps({ bodyText: lines.join("\n") });
      }
      return;
    }
    if (layer.isCustom) {
      const currentCustom = Array.isArray(props.customLayers)
        ? props.customLayers
        : [];
      actions.updateActiveProps({
        customLayers: currentCustom.map((item) =>
          item.id === layer.id
            ? { ...item, content: nextValue, label: nextValue }
            : item
        ),
      });
      return;
    }
    actions.updateActiveProps({
      layerLabels: {
        ...(props.layerLabels || {}),
        [layer.id]: nextValue,
      },
    });
  };

  const handleUpdateLayerTiming = (
    layer: VideoLayerSpec,
    nextFrom: number,
    nextDur: number
  ) => {
    const props = activeComposition.props;
    if (layer.isCustom) {
      const currentCustom = Array.isArray(props.customLayers)
        ? props.customLayers
        : [];
      actions.updateActiveProps({
        customLayers: currentCustom.map((item) =>
          item.id === layer.id
            ? { ...item, from: nextFrom, durationInFrames: nextDur }
            : item
        ),
      });
      return;
    }
    actions.updateActiveProps({
      layerTimings: {
        ...(props.layerTimings || {}),
        [layer.id]: { from: nextFrom, durationInFrames: nextDur },
      },
    });
  };

  const handleUpdateLayerColor = (layer: VideoLayerSpec, newColor: string) => {
    const currentColors = { ...(activeComposition.props.layerColors || {}) };
    currentColors[layer.id] = newColor;
    if (layer.isCustom) {
      const currentCustom = Array.isArray(activeComposition.props.customLayers)
        ? activeComposition.props.customLayers
        : [];
      actions.updateActiveProps({
        layerColors: currentColors,
        customLayers: currentCustom.map((item) =>
          item.id === layer.id ? { ...item, color: newColor } : item
        ),
      });
      return;
    }
    actions.updateActiveProps({ layerColors: currentColors });
  };

  const handleToggleLayerVisibility = (layer: VideoLayerSpec) => {
    const currentVis = { ...(activeComposition.props.layerVisibility || {}) };
    currentVis[layer.id] = !layer.visible;
    if (layer.isCustom) {
      const currentCustom = Array.isArray(activeComposition.props.customLayers)
        ? activeComposition.props.customLayers
        : [];
      actions.updateActiveProps({
        layerVisibility: currentVis,
        customLayers: currentCustom.map((item) =>
          item.id === layer.id ? { ...item, visible: !layer.visible } : item
        ),
      });
      return;
    }
    actions.updateActiveProps({ layerVisibility: currentVis });
  };

  const handleRemoveCustomLayer = (layerId: string) => {
    const currentCustom = Array.isArray(activeComposition.props.customLayers)
      ? activeComposition.props.customLayers
      : [];
    actions.updateActiveProps({
      customLayers: currentCustom.filter((item) => item.id !== layerId),
    });
    setModalLayer(null);
  };

  const scaleStyle: React.CSSProperties =
    canvas.zoom === "fit"
      ? { width: "100%", height: "100%" }
      : {
          width: "100%",
          height: "100%",
          transform: `translate(${panX}px, ${panY}px) scale(${numericZoom})`,
          transformOrigin: "center center",
          transition: isPanning ? "none" : "transform 0.05s ease-out",
        };

  const gridCols = Math.max(1, Math.min(64, canvas.gridCols || 3));
  const gridRows = Math.max(1, Math.min(64, canvas.gridRows || 3));

  // Full-Canvas Custom Grid Lines across the entire viewport (including black area)
  const renderFullViewportGrid = () => {
    if (!canvas.showGrid || viewportDim.w <= 0 || viewportDim.h <= 0) return null;

    const stepX = Math.max(8, renderedW / gridCols);
    const stepY = Math.max(8, renderedH / gridRows);

    // Calculate start positions so lines align with composition edges
    let startX = canvasOriginX % stepX;
    while (startX > 0) startX -= stepX;

    let startY = canvasOriginY % stepY;
    while (startY > 0) startY -= stepY;

    const vLines: Array<{ x: number; isCompositionEdge: boolean }> = [];
    const maxLines = 150;
    let countX = 0;
    for (
      let x = startX;
      x <= viewportDim.w && countX < maxLines;
      x += stepX, countX++
    ) {
      const roundedX = Math.round(x);
      const isCompositionEdge =
        Math.abs(roundedX - Math.round(canvasOriginX)) <= 1 ||
        Math.abs(roundedX - Math.round(canvasOriginX + renderedW)) <= 1;
      vLines.push({ x: roundedX, isCompositionEdge });
    }

    const hLines: Array<{ y: number; isCompositionEdge: boolean }> = [];
    let countY = 0;
    for (
      let y = startY;
      y <= viewportDim.h && countY < maxLines;
      y += stepY, countY++
    ) {
      const roundedY = Math.round(y);
      const isCompositionEdge =
        Math.abs(roundedY - Math.round(canvasOriginY)) <= 1 ||
        Math.abs(roundedY - Math.round(canvasOriginY + renderedH)) <= 1;
      hLines.push({ y: roundedY, isCompositionEdge });
    }

    return (
      <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden select-none">
        {vLines.map(({ x, isCompositionEdge }) => (
          <div
            key={`v-${x}`}
            className={cn(
              "absolute top-0 bottom-0 w-px",
              isCompositionEdge ? "bg-amber-400/70 z-10" : "bg-amber-400/35"
            )}
            style={{ left: `${x}px` }}
          />
        ))}
        {hLines.map(({ y, isCompositionEdge }) => (
          <div
            key={`h-${y}`}
            className={cn(
              "absolute left-0 right-0 h-px",
              isCompositionEdge ? "bg-amber-400/70 z-10" : "bg-amber-400/35"
            )}
            style={{ top: `${y}px` }}
          />
        ))}
        <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-[var(--bg-panel)]/90 border border-[var(--border-strong)] font-mono text-[9px] text-amber-400 shadow">
          GRID {gridCols}×{gridRows}
        </span>
      </div>
    );
  };

  // Dynamic Photoshop / CorelDRAW Style Horizontal Ruler (Full Edge-to-Edge)
  const renderHorizontalRuler = (position: "top" | "bottom") => {
    const width = viewportDim.w;
    if (width <= 0) return null;

    const safeScale = Math.max(0.0001, effectiveScale);
    const minStepDocUnits = 65 / safeScale;
    const CANDIDATE_STEPS = [
      1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000,
    ];
    const step = CANDIDATE_STEPS.find((s) => s >= minStepDocUnits) || 1000;
    const minorStep = step <= 5 ? 1 : step / 5;

    // Convert screen boundaries (0 and width) to document units
    const startDocX = (0 - canvasOriginX) / safeScale;
    const endDocX = (width - canvasOriginX) / safeScale;

    const firstDocX = Math.floor(startDocX / minorStep) * minorStep;
    const lastDocX = Math.ceil(endDocX / minorStep) * minorStep;

    const ticks: Array<{
      val: number;
      screenX: number;
      isMajor: boolean;
      isOrigin: boolean;
    }> = [];

    const maxTicks = 600;
    let count = 0;
    for (
      let docX = firstDocX;
      docX <= lastDocX && count < maxTicks;
      docX += minorStep, count++
    ) {
      const screenX = Math.round(canvasOriginX + docX * safeScale);
      if (screenX >= -1 && screenX <= width + 1) {
        const isMajor =
          Math.abs(docX % step) < 0.001 || Math.abs(docX) < 0.001;
        const isOrigin = Math.abs(docX) < 0.001;
        ticks.push({ val: Math.round(docX), screenX, isMajor, isOrigin });
      }
    }

    return (
      <div
        className={cn(
          "h-5 bg-[var(--bg-panel)] relative select-none shrink-0 overflow-hidden font-mono",
          position === "top"
            ? "border-b border-[var(--border-color)]"
            : "border-t border-[var(--border-color)]"
        )}
      >
        <div className="relative w-full h-full">
          {ticks.map(({ val, screenX, isMajor, isOrigin }) => (
            <div
              key={`${val}-${screenX}`}
              className="absolute top-0 bottom-0 pointer-events-none flex flex-col justify-between"
              style={{ left: `${screenX}px` }}
            >
              <div
                className={cn(
                  "w-px",
                  position === "top" ? "mt-auto" : "mb-auto",
                  isOrigin
                    ? "h-full bg-amber-400 z-10"
                    : isMajor
                    ? "h-2 bg-[var(--text-secondary)]"
                    : "h-1 bg-[var(--border-strong)]"
                )}
              />
              {isMajor && (
                <span
                  className={cn(
                    "absolute text-[8px] whitespace-nowrap",
                    isOrigin
                      ? "text-amber-400 font-bold"
                      : "text-[var(--text-muted)]",
                    position === "top" ? "top-0.5" : "bottom-0.5",
                    val === 0 ? "left-1" : "-translate-x-1/2"
                  )}
                >
                  {val}
                </span>
              )}
            </div>
          ))}

          {cursorPos && (
            <div
              className="absolute top-0 bottom-0 w-px bg-amber-400/80 pointer-events-none z-20"
              style={{ left: `${cursorPos.x}px` }}
            />
          )}
        </div>
      </div>
    );
  };

  // Dynamic Photoshop / CorelDRAW Style Vertical Ruler (Full Edge-to-Edge)
  const renderVerticalRuler = (position: "left" | "right") => {
    const height = viewportDim.h;
    if (height <= 0) return null;

    const safeScale = Math.max(0.0001, effectiveScale);
    const minStepDocUnits = 65 / safeScale;
    const CANDIDATE_STEPS = [
      1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000,
    ];
    const step = CANDIDATE_STEPS.find((s) => s >= minStepDocUnits) || 1000;
    const minorStep = step <= 5 ? 1 : step / 5;

    // Convert screen boundaries (0 and height) to document units
    const startDocY = (0 - canvasOriginY) / safeScale;
    const endDocY = (height - canvasOriginY) / safeScale;

    const firstDocY = Math.floor(startDocY / minorStep) * minorStep;
    const lastDocY = Math.ceil(endDocY / minorStep) * minorStep;

    const ticks: Array<{
      val: number;
      screenY: number;
      isMajor: boolean;
      isOrigin: boolean;
    }> = [];

    const maxTicks = 600;
    let count = 0;
    for (
      let docY = firstDocY;
      docY <= lastDocY && count < maxTicks;
      docY += minorStep, count++
    ) {
      const screenY = Math.round(canvasOriginY + docY * safeScale);
      if (screenY >= -1 && screenY <= height + 1) {
        const isMajor =
          Math.abs(docY % step) < 0.001 || Math.abs(docY) < 0.001;
        const isOrigin = Math.abs(docY) < 0.001;
        ticks.push({ val: Math.round(docY), screenY, isMajor, isOrigin });
      }
    }

    return (
      <div
        className={cn(
          "w-7 bg-[var(--bg-panel)] relative select-none shrink-0 overflow-hidden font-mono",
          position === "left"
            ? "border-r border-[var(--border-color)]"
            : "border-l border-[var(--border-color)]"
        )}
      >
        <div className="relative w-full h-full">
          {ticks.map(({ val, screenY, isMajor, isOrigin }) => (
            <div
              key={`${val}-${screenY}`}
              className="absolute left-0 right-0 pointer-events-none flex items-center justify-between"
              style={{ top: `${screenY}px` }}
            >
              <div
                className={cn(
                  "h-px",
                  position === "left" ? "ml-auto" : "mr-auto",
                  isOrigin
                    ? "w-full bg-amber-400 z-10"
                    : isMajor
                    ? "w-2 bg-[var(--text-secondary)]"
                    : "w-1 bg-[var(--border-strong)]"
                )}
              />
              {isMajor && (
                <span
                  className={cn(
                    "absolute text-[7px] whitespace-nowrap",
                    isOrigin
                      ? "text-amber-400 font-bold"
                      : "text-[var(--text-muted)]",
                    position === "left" ? "left-0.5" : "right-0.5",
                    val === 0 ? "top-1" : "-translate-y-1/2"
                  )}
                >
                  {val}
                </span>
              )}
            </div>
          ))}

          {cursorPos && (
            <div
              className="absolute left-0 right-0 h-px bg-amber-400/80 pointer-events-none z-20"
              style={{ top: `${cursorPos.y}px` }}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg-app)]">
      {/* Unified Nexus Canvas Header */}
      <div className="h-9 px-3 border-b border-[var(--border-color)] bg-[var(--bg-panel)] flex items-center justify-between gap-2 text-[11px] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)] shrink-0">
            <Film className="w-3.5 h-3.5 text-[#f97316] shrink-0" />
            <span>Nexus Canvas</span>
          </span>
          <span className="text-[var(--text-muted)] shrink-0">•</span>
          <span className="font-medium text-[var(--text-secondary)] truncate">
            {activeComposition.name.replace(/\s*\(\d+:\d+\)/g, "")}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-color)] font-mono text-[10px] text-amber-400 font-semibold shrink-0 whitespace-nowrap">
            {activeComposition.width}×{activeComposition.height} ({activeComposition.ratio})
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Canvas Zoom Slider Bar */}
          <div className="flex items-center gap-1 px-1.5 h-6 rounded-md bg-[var(--bg-card)] border border-[var(--border-strong)]">
            <button
              type="button"
              onClick={() => {
                if (canvas.zoom === "fit") {
                  actions.updateCanvas({ zoom: 1, panX: 0, panY: 0 });
                } else {
                  actions.updateCanvas({ zoom: "fit", panX: 0, panY: 0 });
                }
              }}
              className={cn(
                "px-1 h-4 rounded text-[9px] font-mono cursor-pointer transition-colors",
                canvas.zoom === "fit"
                  ? "bg-[#cf6613] text-white font-bold"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
              title="Toggle Fit to Screen"
            >
              Fit
            </button>

            <button
              type="button"
              onClick={() => {
                const next = Math.max(
                  0.25,
                  Number((numericZoom * 0.8).toFixed(2))
                );
                actions.updateCanvas({ zoom: next });
              }}
              className="text-[var(--text-muted)] hover:text-amber-400 cursor-pointer p-0.5"
              title="Zoom Out Canvas"
            >
              <ZoomOut className="w-3 h-3" />
            </button>

            <input
              type="range"
              min={0.25}
              max={10.0}
              step={0.05}
              value={numericZoom}
              onChange={(e) =>
                actions.updateCanvas({ zoom: Number(e.target.value) })
              }
              className="w-16 sm:w-24 h-1 accent-[#cf6613] bg-[var(--bg-input)] rounded-lg cursor-ew-resize outline-none"
              title={`Canvas Zoom: ${Math.round(
                numericZoom * 100
              )}% (Scroll canvas to zoom freely)`}
            />

            <button
              type="button"
              onClick={() => {
                const next = Math.min(
                  10.0,
                  Number((numericZoom * 1.25).toFixed(2))
                );
                actions.updateCanvas({ zoom: next });
              }}
              className="text-[var(--text-muted)] hover:text-amber-400 cursor-pointer p-0.5"
              title="Zoom In Canvas"
            >
              <ZoomIn className="w-3 h-3" />
            </button>

            <span
              onClick={() =>
                actions.updateCanvas({ zoom: "fit", panX: 0, panY: 0 })
              }
              className="font-mono text-[9px] text-amber-400 font-semibold cursor-pointer shrink-0 pl-0.5"
              title="Click to reset to Fit"
            >
              {canvas.zoom === "fit"
                ? "Fit"
                : `${Math.round(numericZoom * 100)}%`}
            </span>
          </div>

          {/* Canvas Minimap Toggle (Icon-only) */}
          <button
            type="button"
            onClick={() =>
              actions.updateCanvas({ showMinimap: !canvas.showMinimap })
            }
            title="Toggle Canvas Viewport Minimap"
            className={cn(
              "h-6 px-1.5 rounded-md border flex items-center justify-center cursor-pointer transition-colors",
              canvas.showMinimap !== false
                ? "bg-[#cf6613] text-white border-[#e07b27]"
                : "bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-strong)] hover:text-[var(--text-primary)]"
            )}
          >
            <Compass className="w-3.5 h-3.5 shrink-0" />
          </button>

          {/* 4-Sided Rulers Toggle (Icon-only) */}
          <button
            type="button"
            onClick={() =>
              actions.updateCanvas({ showRulers: !canvas.showRulers })
            }
            title="Toggle Dynamic Photoshop/Corel Style Rulers"
            className={cn(
              "h-6 px-1.5 rounded-md border flex items-center justify-center cursor-pointer transition-colors",
              canvas.showRulers
                ? "bg-[#cf6613] text-white border-[#e07b27]"
                : "bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-strong)] hover:text-[var(--text-primary)]"
            )}
          >
            <Ruler className="w-3.5 h-3.5 shrink-0" />
          </button>

          {/* Safe Zone Guides Toggle (Icon-only) */}
          <button
            type="button"
            onClick={() =>
              actions.updateCanvas({ showGuides: !canvas.showGuides })
            }
            title="Toggle TikTok Safe Zone Guides"
            className={cn(
              "h-6 px-1.5 rounded-md border flex items-center justify-center cursor-pointer transition-colors",
              canvas.showGuides
                ? "bg-[#cf6613] text-white border-[#e07b27]"
                : "bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-strong)] hover:text-[var(--text-primary)]"
            )}
          >
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
          </button>

          {/* Full-Canvas Custom Grid (Mau Berapa Kali Berapa Bisa) */}
          <div className="flex items-center rounded-md bg-[var(--bg-card)] border border-[var(--border-strong)] overflow-hidden">
            <button
              type="button"
              onClick={() =>
                actions.updateCanvas({ showGrid: !canvas.showGrid })
              }
              title="Toggle Custom Grid Lines"
              className={cn(
                "h-6 px-1.5 flex items-center justify-center cursor-pointer transition-colors",
                canvas.showGrid
                  ? "bg-[#cf6613] text-white"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              <Grid className="w-3.5 h-3.5 shrink-0" />
            </button>

            {/* Direct Editable Columns × Rows (Berapa kali berapa bisa) */}
            <div className="flex items-center gap-0.5 px-1 bg-[var(--bg-panel)] border-l border-[var(--border-strong)] text-[10px] font-mono">
              <input
                type="number"
                min={1}
                max={64}
                value={gridCols}
                onChange={(e) => {
                  const val = Math.max(
                    1,
                    Math.min(64, Number(e.target.value) || 1)
                  );
                  actions.updateCanvas({ showGrid: true, gridCols: val });
                }}
                className="w-6 text-center bg-[var(--bg-card)] border border-[var(--border-color)] rounded text-[9px] text-[var(--text-primary)] outline-none focus:border-amber-400"
                title="Grid Columns (Vertical Lines) - Enter any number"
              />
              <span className="text-[var(--text-muted)] text-[9px]">×</span>
              <input
                type="number"
                min={1}
                max={64}
                value={gridRows}
                onChange={(e) => {
                  const val = Math.max(
                    1,
                    Math.min(64, Number(e.target.value) || 1)
                  );
                  actions.updateCanvas({ showGrid: true, gridRows: val });
                }}
                className="w-6 text-center bg-[var(--bg-card)] border border-[var(--border-color)] rounded text-[9px] text-[var(--text-primary)] outline-none focus:border-amber-400"
                title="Grid Rows (Horizontal Lines) - Enter any number"
              />
            </div>

            {/* Presets Quick Selector */}
            <select
              value={`${gridCols}x${gridRows}`}
              onChange={(e) => {
                const [c, r] = e.target.value.split("x").map(Number);
                if (c && r) {
                  actions.updateCanvas({
                    showGrid: true,
                    gridCols: c,
                    gridRows: r,
                  });
                }
              }}
              className="h-6 px-1 bg-[var(--bg-panel)] border-l border-[var(--border-color)] text-[10px] font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] outline-none cursor-pointer"
              title="Select Grid Preset"
            >
              {GRID_PRESETS.map((p) => (
                <option key={p.label} value={`${p.cols}x${p.rows}`}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Loop Toggle */}
          <button
            type="button"
            onClick={() => actions.updateCanvas({ loop: !canvas.loop })}
            title="Toggle Playback Loop"
            className={cn(
              "h-6 px-1.5 rounded-md border flex items-center justify-center text-[10px] cursor-pointer transition-colors",
              canvas.loop
                ? "bg-[#cf6613] text-white border-[#e07b27]"
                : "bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-strong)] hover:text-[var(--text-primary)]"
            )}
          >
            <Repeat className="w-3 h-3" />
          </button>

          {/* Fullscreen */}
          <button
            type="button"
            onClick={() => playerRef.current?.requestFullscreen()}
            title="Fullscreen Preview"
            className="h-6 px-1.5 rounded-md bg-[var(--bg-card)] border border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer transition-colors"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Top Dynamic Horizontal Ruler */}
      {canvas.showRulers && renderHorizontalRuler("top")}

      {/* Middle Row: Left Dynamic Vertical Ruler | Canvas Viewport & Minimap | Right Ruler */}
      <div className="flex-1 min-h-0 flex flex-row overflow-hidden relative">
        {canvas.showRulers && renderVerticalRuler("left")}

        {/* Main Video Canvas Viewport */}
        <div
          ref={viewportRef}
          onWheel={handleCanvasWheel}
          onMouseDown={handleCanvasMouseDown}
          onDoubleClick={handleCanvasDoubleClick}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setCursorPos({
              x: e.clientX - rect.left,
              y: e.clientY - rect.top,
            });
          }}
          onMouseLeave={() => setCursorPos(null)}
          className={cn(
            "flex-1 min-h-0 flex items-center justify-center p-3 relative overflow-hidden bg-[#0A0A0C]",
            isPanning
              ? "cursor-grabbing"
              : isZoomed
              ? "cursor-grab"
              : "cursor-default"
          )}
        >
          {/* Full-Canvas Custom N×M Grid Lines across the entire viewport (including black area) */}
          {renderFullViewportGrid()}

          <ErrorBoundary
            fullScreen={false}
            fallbackTitle="Preview renderer failed"
            onReset={() => {}}
          >
            <div className="w-full h-full flex items-center justify-center relative select-none">
              <Player
                key={`${activeComposition.id}-${activeComposition.width}x${activeComposition.height}-${activeComposition.fps}`}
                ref={(ref) => {
                  playerRef.current = ref;
                  if (ref !== playerInstance) {
                    setPlayerInstance(ref);
                  }
                }}
                component={NexusVideoComposition}
                inputProps={activeComposition.props}
                durationInFrames={durationInFrames}
                fps={activeComposition.fps}
                compositionWidth={activeComposition.width}
                compositionHeight={activeComposition.height}
                playbackRate={canvas.playbackRate}
                inFrame={canvas.inFrame}
                outFrame={canvas.outFrame}
                controls={false}
                loop={canvas.loop}
                doubleClickToFullscreen={false}
                acknowledgeRemotionLicense
                style={scaleStyle}
              />

              {/* TikTok / Reels Safe Zone Guide Overlay */}
              {canvas.showGuides && (
                <div
                  className="pointer-events-none absolute border border-dashed border-cyan-400 rounded-lg flex flex-col justify-between p-2 z-10"
                  style={{
                    left: `${canvasOriginX + renderedW * 0.05}px`,
                    top: `${canvasOriginY + renderedH * 0.05}px`,
                    width: `${renderedW * 0.9}px`,
                    height: `${renderedH * 0.9}px`,
                  }}
                >
                  <div className="flex justify-between text-[9px] font-mono text-cyan-300 uppercase">
                    <span className="px-1.5 py-0.5 rounded bg-[var(--bg-panel)] border border-[var(--border-color)]">
                      Safe Zone Top
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-[var(--bg-panel)] border border-[var(--border-color)]">
                      {activeComposition.ratio}
                    </span>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="px-1.5 py-0.5 rounded bg-[var(--bg-panel)] border border-[var(--border-color)] text-[9px] font-mono text-cyan-300">
                      Caption Safe Area
                    </span>
                    <div className="w-12 h-28 bg-[var(--bg-panel)]/90 border border-dashed border-rose-400 rounded flex items-center justify-center text-[8px] font-mono text-rose-300 text-center p-1">
                      UI Icons
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ErrorBoundary>

          {/* Refined Bounding Box Overlay on Selected Element */}
          {selectedLayerBox && selectedLayerId && (
            <div
              data-nexus-bounding-box="true"
              style={{
                left: `${selectedLayerBox.left}px`,
                top: `${selectedLayerBox.top}px`,
                width: `${selectedLayerBox.width}px`,
                height: `${selectedLayerBox.height}px`,
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                const layers = buildCompositionLayers(
                  activeComposition.props,
                  durationInFrames
                );
                const target = layers.find((l) => l.id === selectedLayerId);
                if (target) setModalLayer(target);
              }}
              className="absolute pointer-events-auto border border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.35)] select-none z-30 cursor-move"
              title="Drag to move, double-click to edit, arrow keys to nudge, Esc to deselect"
            >
              {/* Corner Handles (Sleek 8px squares with dark center and crisp white outline) */}
              <div className="absolute -top-1 -left-1 w-2 h-2 bg-black border border-white rounded-[1px] pointer-events-none shadow" />
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-black border border-white rounded-[1px] pointer-events-none shadow" />
              <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-black border border-white rounded-[1px] pointer-events-none shadow" />
              <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-black border border-white rounded-[1px] pointer-events-none shadow" />

              {/* Edge Midpoint Handles: Only shown when element has enough space (width >= 70 && height >= 36) */}
              {selectedLayerBox.width >= 70 &&
                selectedLayerBox.height >= 36 && (
                  <>
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-black border border-white rounded-[1px] pointer-events-none shadow" />
                    <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-black border border-white rounded-[1px] pointer-events-none shadow" />
                    <div className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-2 bg-black border border-white rounded-[1px] pointer-events-none shadow" />
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-black border border-white rounded-[1px] pointer-events-none shadow" />
                  </>
                )}

              {/* Center Crosshair + */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/70 text-[10px] font-mono pointer-events-none leading-none">
                +
              </div>

              {/* Floating Position & Action Pill */}
              <div
                className="absolute -top-7 left-0 flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#0A0A0C]/95 border border-amber-400 text-[10px] font-mono text-white shadow-xl whitespace-nowrap z-40 select-none cursor-move"
                title="Drag to reposition layer"
              >
                <span className="text-amber-400 font-bold">
                  {selectedLayerBox.layerName}
                </span>
                <span className="text-[var(--text-muted)]">•</span>
                <span>
                  X:{" "}
                  {activeComposition.props.layerOffsets?.[selectedLayerId]?.x ??
                    0}
                  px
                </span>
                <span>
                  Y:{" "}
                  {activeComposition.props.layerOffsets?.[selectedLayerId]?.y ??
                    0}
                  px
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleResetLayerOffset(selectedLayerId);
                  }}
                  className="ml-0.5 p-0.5 text-amber-400 hover:text-white cursor-pointer transition-colors"
                  title="Reset Position (0, 0)"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedLayerId(null);
                  }}
                  className="p-0.5 text-[var(--text-muted)] hover:text-rose-400 cursor-pointer transition-colors"
                  title="Deselect (Esc)"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          )}

          {/* Floating Canvas Viewport Minimap */}
          {canvas.showMinimap !== false && (
            <CanvasMinimap
              compositionWidth={activeComposition.width}
              compositionHeight={activeComposition.height}
              ratio={activeComposition.ratio}
              zoom={canvas.zoom}
              panX={panX}
              panY={panY}
              viewportWidth={viewportDim.w}
              viewportHeight={viewportDim.h}
              effectiveScale={effectiveScale}
              onPanChange={(px, py) =>
                actions.updateCanvas({ panX: px, panY: py })
              }
              onResetZoom={() =>
                actions.updateCanvas({ zoom: "fit", panX: 0, panY: 0 })
              }
              onClose={() => actions.updateCanvas({ showMinimap: false })}
            />
          )}
        </div>

        {canvas.showRulers && renderVerticalRuler("right")}
      </div>

      {/* Bottom Dynamic Horizontal Ruler */}
      {canvas.showRulers && renderHorizontalRuler("bottom")}

      {canvas.showTimeline && (
        <Timeline
          compositionId={activeComposition.id}
          durationInFrames={durationInFrames}
          fps={activeComposition.fps}
          currentFrame={currentFrame}
          isPlaying={isPlaying}
          onSeek={handleSeek}
          onTogglePlay={handleTogglePlay}
        />
      )}

      {/* Floating Clip Edit Modal (Triggered on Double-Click on Canvas Element) */}
      {modalLayer && (
        <ClipEditModal
          isOpen={Boolean(modalLayer)}
          layer={modalLayer}
          onClose={() => setModalLayer(null)}
          onSaveContent={handleUpdateLayerContent}
          onSaveTiming={handleUpdateLayerTiming}
          onSaveColor={handleUpdateLayerColor}
          onToggleVisibility={handleToggleLayerVisibility}
          onDeleteCustom={handleRemoveCustomLayer}
          durationInFrames={durationInFrames}
          fps={activeComposition.fps}
        />
      )}
    </div>
  );
};

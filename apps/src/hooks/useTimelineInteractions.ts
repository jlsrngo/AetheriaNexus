import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { StudioCanvasSettings } from "../types/studio";
import type { NexusVideoProps, VideoLayerSpec } from "../types/video";
import type { TimelineDragOverride } from "../components/studio/timeline/timelineLayerUtils";

interface UseTimelineInteractionsParams {
  durationInFrames: number;
  lastFrame: number;
  currentFrame: number;
  timelineZoom: number;
  isSnapping: boolean;
  canvas: StudioCanvasSettings;
  layers: VideoLayerSpec[];
  layerStartFrame?: Record<string, number>;
  layerDuration?: Record<string, number>;
  onSeek: (frame: number) => void;
  setSelectedLayerId: (id: string | null) => void;
  updateActiveProps: (patch: Partial<NexusVideoProps>) => void;
  onUndo: () => void;
  onRedo: () => void;
  onDuplicateLayer: () => void;
  onSplitClip: () => void;
  onDeleteSelectedLayer: () => void;
}

/**
 * Manages timeline DOM measurements, scrubbing, vertical panel resize,
 * 60fps requestAnimationFrame clip drag/trim with snapping, and hotkeys.
 */
export function useTimelineInteractions({
  durationInFrames,
  lastFrame,
  currentFrame,
  timelineZoom,
  isSnapping,
  canvas,
  layers,
  layerStartFrame,
  layerDuration,
  onSeek,
  setSelectedLayerId,
  updateActiveProps,
  onUndo,
  onRedo,
  onDuplicateLayer,
  onSplitClip,
  onDeleteSelectedLayer,
}: UseTimelineInteractionsParams) {
  const [timelineHeight, setTimelineHeight] = useState<number>(280);
  const [rulerWidth, setRulerWidth] = useState<number>(1000);
  const [dragOverride, setDragOverride] = useState<TimelineDragOverride | null>(null);

  const rulerRef = useRef<HTMLDivElement>(null);
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);

  // Zoom scale: negative = compact frames (down to 0.15x), 0% = 1.0x (fit), positive = stretch up to 25.0x
  const zoomMultiplier =
    timelineZoom >= 0
      ? 1 + (timelineZoom / 100) * 24
      : Math.max(0.15, 1 + (timelineZoom / 100) * 0.85);

  useEffect(() => {
    const el = rulerRef.current;
    if (!el) return;
    const updateWidth = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setRulerWidth(w);
    };
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const el = rulerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      onSeek(Math.round(ratio * lastFrame));
    },
    [lastFrame, onSeek]
  );

  // Keep latest handlers in a ref so the global keydown listener stays fresh
  const hotkeyHandlersRef = useRef({
    onUndo,
    onRedo,
    onDuplicateLayer,
    onSplitClip,
    onDeleteSelectedLayer,
  });
  hotkeyHandlersRef.current = {
    onUndo,
    onRedo,
    onDuplicateLayer,
    onSplitClip,
    onDeleteSelectedLayer,
  };

  useEffect(() => {
    const handleTimelineKeys = (e: KeyboardEvent) => {
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
        hotkeyHandlersRef.current.onUndo();
        toast.info("Undo: Reverted change", { duration: 1200 });
        return;
      }

      if (
        (isCtrlOrMeta && (e.key === "y" || e.key === "Y")) ||
        (isCtrlOrMeta && e.shiftKey && (e.key === "z" || e.key === "Z"))
      ) {
        e.preventDefault();
        hotkeyHandlersRef.current.onRedo();
        toast.info("Redo: Reapplied change", { duration: 1200 });
        return;
      }

      if (isCtrlOrMeta && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        hotkeyHandlersRef.current.onDuplicateLayer();
        return;
      }

      if (
        !isCtrlOrMeta &&
        (e.key === "s" || e.key === "S" || e.key === "c" || e.key === "C")
      ) {
        e.preventDefault();
        hotkeyHandlersRef.current.onSplitClip();
        return;
      }

      if (e.key === "Delete") {
        e.preventDefault();
        hotkeyHandlersRef.current.onDeleteSelectedLayer();
      }
    };

    window.addEventListener("keydown", handleTimelineKeys);
    return () => window.removeEventListener("keydown", handleTimelineKeys);
  }, []);

  const startClipDrag = useCallback(
    (
      e: React.MouseEvent,
      layer: VideoLayerSpec,
      mode: "move" | "trim-start" | "trim-end"
    ) => {
      e.stopPropagation();
      e.preventDefault();
      setSelectedLayerId(layer.id);

      const trackEl = rulerRef.current;
      if (!trackEl) return;
      const trackWidth = Math.max(1, trackEl.getBoundingClientRect().width);
      const startX = e.clientX;
      const origFrom = layer.from;
      const origDur = layer.durationInFrames;
      const origEnd = origFrom + origDur;

      let latestFrom = origFrom;
      let latestDur = origDur;
      let rafId: number | null = null;

      const snapCandidates: number[] = [0, currentFrame, lastFrame];
      if (canvas.inFrame !== null) snapCandidates.push(canvas.inFrame);
      if (canvas.outFrame !== null) snapCandidates.push(canvas.outFrame);
      layers.forEach((l) => {
        if (l.id !== layer.id) {
          snapCandidates.push(l.from);
          snapCandidates.push(l.from + l.durationInFrames);
        }
      });

      const snapVal = (val: number, threshold = 2): number => {
        if (!isSnapping) return val;
        for (const t of snapCandidates) {
          if (Math.abs(val - t) <= threshold) return t;
        }
        return val;
      };

      const onMove = (moveEvent: MouseEvent) => {
        const deltaPx = moveEvent.clientX - startX;
        const deltaFrames = Math.round((deltaPx / trackWidth) * durationInFrames);

        if (mode === "move") {
          let candidateFrom = Math.max(
            0,
            Math.min(durationInFrames - origDur, origFrom + deltaFrames)
          );
          candidateFrom = snapVal(candidateFrom);
          const snappedEnd = snapVal(candidateFrom + origDur);
          if (snappedEnd !== candidateFrom + origDur) {
            candidateFrom = Math.max(0, snappedEnd - origDur);
          }
          latestFrom = candidateFrom;
          latestDur = origDur;
        } else if (mode === "trim-start") {
          let candidateFrom = Math.max(0, Math.min(origEnd - 1, origFrom + deltaFrames));
          candidateFrom = snapVal(candidateFrom);
          latestFrom = candidateFrom;
          latestDur = Math.max(1, origEnd - latestFrom);
        } else {
          latestFrom = origFrom;
          let candidateEnd = origEnd + deltaFrames;
          candidateEnd = snapVal(candidateEnd);
          latestDur = Math.max(
            1,
            Math.min(durationInFrames - origFrom, candidateEnd - origFrom)
          );
        }

        if (rafId === null) {
          rafId = requestAnimationFrame(() => {
            rafId = null;
            setDragOverride({
              id: layer.id,
              from: latestFrom,
              durationInFrames: latestDur,
            });
          });
        }
      };

      const onUp = () => {
        if (rafId !== null) cancelAnimationFrame(rafId);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        setDragOverride(null);

        if (latestFrom !== origFrom || latestDur !== origDur) {
          updateActiveProps({
            layerStartFrame: { ...(layerStartFrame || {}), [layer.id]: latestFrom },
            layerDuration: { ...(layerDuration || {}), [layer.id]: latestDur },
          });
        }
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [
      canvas.inFrame,
      canvas.outFrame,
      currentFrame,
      durationInFrames,
      isSnapping,
      lastFrame,
      layerDuration,
      layerStartFrame,
      layers,
      setSelectedLayerId,
      updateActiveProps,
    ]
  );

  const startResizeHeight = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startH = timelineHeight;

      const onMove = (moveEvent: MouseEvent) => {
        const delta = startY - moveEvent.clientY;
        setTimelineHeight(Math.max(180, Math.min(460, startH + delta)));
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [timelineHeight]
  );

  return {
    timelineHeight,
    rulerWidth,
    zoomMultiplier,
    dragOverride,
    rulerRef,
    leftScrollRef,
    rightScrollRef,
    seekFromClientX,
    startClipDrag,
    startResizeHeight,
  };
}

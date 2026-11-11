import { useCallback, useEffect, useRef, useState } from "react";

export interface UseMotionPlaybackOptions {
  durationInFrames: number;
  fps: number;
  playbackRate: number;
  inFrame?: number | null;
  outFrame?: number | null;
  loop?: boolean;
  onFrameUpdate?: (frame: number) => void;
  onPlayChange?: (playing: boolean) => void;
  onSeeked?: (frame: number) => void;
  onEnded?: () => void;
}

export interface MotionPlayerHandle {
  seekTo: (frame: number) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  getCurrentFrame: () => number;
  isPlaying: () => boolean;
  isMuted: () => boolean;
  mute: () => void;
  unmute: () => void;
  requestFullscreen: () => void;
}

export function clampFrameRange(
  frame: number,
  durationInFrames: number,
  inFrame?: number | null,
  outFrame?: number | null
): { clamped: number; minFrame: number; maxFrame: number } {
  const safeTotal = Math.max(1, Math.round(durationInFrames));
  const minFrame =
    typeof inFrame === "number" && Number.isFinite(inFrame)
      ? Math.max(0, Math.min(safeTotal - 1, Math.round(inFrame)))
      : 0;
  const maxFrame =
    typeof outFrame === "number" && Number.isFinite(outFrame)
      ? Math.max(minFrame, Math.min(safeTotal - 1, Math.round(outFrame)))
      : safeTotal - 1;
  const clamped = Math.max(minFrame, Math.min(maxFrame, Math.round(frame)));
  return { clamped, minFrame, maxFrame };
}

export function useMotionPlayback(opts: UseMotionPlaybackOptions) {
  const {
    durationInFrames,
    fps,
    playbackRate,
    inFrame,
    outFrame,
    loop = true,
    onFrameUpdate,
    onPlayChange,
    onSeeked,
    onEnded,
  } = opts;

  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const frameFloatRef = useRef(0);
  const lastEmitFrameRef = useRef(0);
  const isPlayingRef = useRef(false);
  const lastTsRef = useRef<number | null>(null);

  const callbacksRef = useRef({
    onFrameUpdate,
    onPlayChange,
    onSeeked,
    onEnded,
  });
  callbacksRef.current = { onFrameUpdate, onPlayChange, onSeeked, onEnded };

  const setPlayingState = useCallback((next: boolean) => {
    isPlayingRef.current = next;
    setIsPlaying(next);
    callbacksRef.current.onPlayChange?.(next);
  }, []);

  const seekTo = useCallback(
    (target: number) => {
      const { clamped } = clampFrameRange(
        target,
        durationInFrames,
        inFrame,
        outFrame
      );
      frameFloatRef.current = clamped;
      lastEmitFrameRef.current = clamped;
      setCurrentFrame(clamped);
      callbacksRef.current.onFrameUpdate?.(clamped);
      callbacksRef.current.onSeeked?.(clamped);
    },
    [durationInFrames, inFrame, outFrame]
  );

  const play = useCallback(() => {
    const { minFrame, maxFrame } = clampFrameRange(
      frameFloatRef.current,
      durationInFrames,
      inFrame,
      outFrame
    );
    if (frameFloatRef.current >= maxFrame) {
      frameFloatRef.current = minFrame;
      lastEmitFrameRef.current = minFrame;
      setCurrentFrame(minFrame);
      callbacksRef.current.onFrameUpdate?.(minFrame);
    }
    lastTsRef.current = null;
    setPlayingState(true);
  }, [durationInFrames, inFrame, outFrame, setPlayingState]);

  const pause = useCallback(() => {
    lastTsRef.current = null;
    setPlayingState(false);
  }, [setPlayingState]);

  const toggle = useCallback(() => {
    if (isPlayingRef.current) {
      pause();
    } else {
      play();
    }
  }, [pause, play]);

  useEffect(() => {
    const { clamped } = clampFrameRange(
      frameFloatRef.current,
      durationInFrames,
      inFrame,
      outFrame
    );
    if (clamped !== lastEmitFrameRef.current) {
      frameFloatRef.current = clamped;
      lastEmitFrameRef.current = clamped;
      setCurrentFrame(clamped);
      callbacksRef.current.onFrameUpdate?.(clamped);
    }
  }, [durationInFrames, inFrame, outFrame]);

  useEffect(() => {
    if (!isPlaying) return;

    let rafId = 0;
    const safeFps = Math.max(1, fps);
    const rate = Math.max(0.1, playbackRate);

    const tick = (ts: number) => {
      if (!isPlayingRef.current) return;
      if (lastTsRef.current === null) {
        lastTsRef.current = ts;
      } else {
        const dtSec = Math.min(0.1, Math.max(0, (ts - lastTsRef.current) / 1000));
        lastTsRef.current = ts;
        const { minFrame, maxFrame } = clampFrameRange(
          frameFloatRef.current,
          durationInFrames,
          inFrame,
          outFrame
        );

        let nextFloat = frameFloatRef.current + dtSec * safeFps * rate;
        if (nextFloat > maxFrame) {
          if (loop) {
            const span = Math.max(1, maxFrame - minFrame + 1);
            nextFloat = minFrame + ((nextFloat - minFrame) % span);
          } else {
            frameFloatRef.current = maxFrame;
            lastEmitFrameRef.current = maxFrame;
            setCurrentFrame(maxFrame);
            callbacksRef.current.onFrameUpdate?.(maxFrame);
            setPlayingState(false);
            callbacksRef.current.onEnded?.();
            return;
          }
        }
        frameFloatRef.current = nextFloat;
        const rounded = Math.max(minFrame, Math.min(maxFrame, Math.floor(nextFloat)));
        if (rounded !== lastEmitFrameRef.current) {
          lastEmitFrameRef.current = rounded;
          setCurrentFrame(rounded);
          callbacksRef.current.onFrameUpdate?.(rounded);
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, fps, playbackRate, durationInFrames, inFrame, outFrame, loop, setPlayingState]);

  return {
    currentFrame,
    isPlaying,
    isMuted,
    setIsMuted,
    seekTo,
    play,
    pause,
    toggle,
    getCurrentFrame: () => lastEmitFrameRef.current,
    getIsPlaying: () => isPlayingRef.current,
  };
}


import React, {
  Component,
  forwardRef,
  useImperativeHandle,
  useRef,
  type ErrorInfo,
} from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { MotionProvider } from "./MotionContext";
import { clampAudioVolume } from "./sceneAudioUtils";
import {
  type MotionPlayerHandle,
  useMotionPlayback,
} from "../../hooks/useMotionPlayback";

export type { MotionPlayerHandle };

interface StageBoundaryProps {
  children: React.ReactNode;
}

interface StageBoundaryState {
  error: Error | null;
}

class StageErrorBoundary extends Component<
  StageBoundaryProps,
  StageBoundaryState
> {
  state: StageBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): StageBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("[HtmlMotionPlayer] Stage render error isolated:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-[#121215] text-[#FAFAFA] text-center gap-3">
          <AlertTriangle className="w-8 h-8 text-amber-400" />
          <p className="text-sm font-semibold">Preview stage error isolated</p>
          <p className="text-xs text-[#8E8E98] max-w-md break-words">
            {this.state.error.message}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1A1A1F] border border-[#26262C] text-xs font-medium hover:bg-[#23232A]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Remount Player
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export interface HtmlMotionPlayerProps<
  TProps extends Record<string, unknown> = Record<string, unknown>
> {
  component: React.ComponentType<TProps>;
  inputProps?: TProps;
  durationInFrames: number;
  fps: number;
  compositionWidth: number;
  compositionHeight: number;
  playbackRate?: number;
  volume?: number;
  isMuted?: boolean;
  inFrame?: number | null;
  outFrame?: number | null;
  loop?: boolean;
  style?: React.CSSProperties;
  className?: string;
  onFrameUpdate?: (frame: number) => void;
  onPlayChange?: (playing: boolean) => void;
  onSeeked?: (frame: number) => void;
  onEnded?: () => void;
}

export const HtmlMotionPlayer = forwardRef<
  MotionPlayerHandle,
  HtmlMotionPlayerProps
>(function HtmlMotionPlayer(
  {
    component: StageComponent,
    inputProps,
    durationInFrames,
    fps,
    compositionWidth,
    compositionHeight,
    playbackRate = 1,
    volume: volumeProp,
    isMuted: isMutedProp,
    inFrame = null,
    outFrame = null,
    loop = true,
    style,
    className,
    onFrameUpdate,
    onPlayChange,
    onSeeked,
    onEnded,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);

  const playback = useMotionPlayback({
    durationInFrames,
    fps,
    playbackRate,
    inFrame,
    outFrame,
    loop,
    onFrameUpdate,
    onPlayChange,
    onSeeked,
    onEnded,
  });

  useImperativeHandle(
    ref,
    () => ({
      seekTo: playback.seekTo,
      play: playback.play,
      pause: playback.pause,
      toggle: playback.toggle,
      getCurrentFrame: playback.getCurrentFrame,
      isPlaying: playback.getIsPlaying,
      isMuted: () => playback.isMuted,
      mute: () => playback.setIsMuted(true),
      unmute: () => playback.setIsMuted(false),
      requestFullscreen: () => {
        const el = containerRef.current;
        if (el && el.requestFullscreen) {
          void el.requestFullscreen();
        }
      },
    }),
    [playback]
  );

  return (
    <div
      ref={containerRef}
      data-html-motion-player="true"
      className={className}
      style={{
        position: "relative",
        overflow: "hidden",
        backgroundColor: "#0A0A0C",
        ...style,
      }}
    >
      <StageErrorBoundary>
        <MotionProvider
          value={{
            currentFrame: playback.currentFrame,
            fps: Math.max(1, fps),
            durationInFrames: Math.max(1, durationInFrames),
            width: compositionWidth,
            height: compositionHeight,
            isPlaying: playback.isPlaying,
            playbackRate,
            volume: clampAudioVolume(volumeProp ?? playback.volume),
            isMuted: isMutedProp ?? playback.isMuted,
          }}
        >
          <div className="w-full h-full relative">
            <StageComponent {...(inputProps ?? {})} />
          </div>
        </MotionProvider>
      </StageErrorBoundary>
    </div>
  );
});


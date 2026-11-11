import React, { createContext, useContext } from "react";

export interface MotionPlaybackConfig {
  currentFrame: number;
  fps: number;
  durationInFrames: number;
  width: number;
  height: number;
  isPlaying: boolean;
  playbackRate: number;
  isMuted: boolean;
}

const DEFAULT_CONFIG: MotionPlaybackConfig = {
  currentFrame: 0,
  fps: 30,
  durationInFrames: 1,
  width: 1080,
  height: 1920,
  isPlaying: false,
  playbackRate: 1,
  isMuted: false,
};

const MotionContext = createContext<MotionPlaybackConfig>(DEFAULT_CONFIG);

export const MotionProvider: React.FC<{
  value: MotionPlaybackConfig;
  children: React.ReactNode;
}> = ({ value, children }) => (
  <MotionContext.Provider value={value}>{children}</MotionContext.Provider>
);

export function useMotionFrame(): number {
  return useContext(MotionContext).currentFrame;
}

export function useMotionConfig(): MotionPlaybackConfig {
  return useContext(MotionContext);
}


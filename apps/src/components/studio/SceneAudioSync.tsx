import React, { useEffect, useMemo, useRef } from "react";
import { useMotionConfig, useMotionFrame } from "./MotionContext";
import { type HtmlFilmScene, resolveWorkspaceAssetUrl } from "./htmlStageBundle";

export interface SceneAudioSyncProps {
  scenes: HtmlFilmScene[];
  activeDir: string | null;
}

/**
 * Synchronizes native HTMLAudioElement scene narration tracks with the custom motion clock.
 */
export const SceneAudioSync: React.FC<SceneAudioSyncProps> = ({ scenes, activeDir }) => {
  const frame = useMotionFrame();
  const { fps, isPlaying, playbackRate, isMuted } = useMotionConfig();
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  const resolvedTracks = useMemo(
    () =>
      scenes
        .map((s) => ({
          scene: s,
          src: resolveWorkspaceAssetUrl(s.audio, activeDir),
        }))
        .filter((item): item is { scene: HtmlFilmScene; src: string } => Boolean(item.src)),
    [scenes, activeDir]
  );

  useEffect(() => {
    const safeFps = Math.max(1, fps);
    for (const { scene } of resolvedTracks) {
      const el = audioRefs.current.get(scene.id);
      if (!el) continue;
      el.muted = isMuted;
      el.playbackRate = Math.max(0.25, Math.min(4, playbackRate));

      const endFrame = scene.startFrame + scene.durationFrames;
      const inRange = frame >= scene.startFrame && frame < endFrame;
      if (!inRange) {
        if (!el.paused) el.pause();
        continue;
      }

      const targetSec = Math.max(0, (frame - scene.startFrame) / safeFps);
      if (Math.abs(el.currentTime - targetSec) > (isPlaying ? 0.18 : 0.04)) {
        try {
          el.currentTime = targetSec;
        } catch {
          // Audio metadata may still be loading
        }
      }

      if (isPlaying && el.paused) {
        void el.play().catch(() => {});
      } else if (!isPlaying && !el.paused) {
        el.pause();
      }
    }
  }, [frame, fps, isPlaying, playbackRate, isMuted, resolvedTracks]);

  useEffect(() => {
    const mapSnapshot = audioRefs.current;
    return () => {
      for (const el of mapSnapshot.values()) {
        el.pause();
      }
    };
  }, [resolvedTracks]);

  return (
    <div style={{ display: "none" }} aria-hidden="true">
      {resolvedTracks.map(({ scene, src }) => (
        <audio
          key={`${scene.id}-${src}`}
          preload="auto"
          src={src}
          ref={(el) => {
            if (el) {
              audioRefs.current.set(scene.id, el);
            } else {
              audioRefs.current.delete(scene.id);
            }
          }}
        />
      ))}
    </div>
  );
};


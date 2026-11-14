import React, { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useMotionConfig, useMotionFrame } from "./MotionContext";
import { type HtmlFilmScene } from "./htmlStageBundle";
import {
  getEngineMediaAuthToken,
  initEngineMediaAuth,
  isEngineMediaAuthSettled,
  subscribeEngineMediaAuth,
} from "../../lib/api";
import {
  computeAudioTargetSeconds,
  computeEffectiveAudioVolume,
  formatAudioErrorMessage,
  resolveSceneAudioTracks,
} from "./sceneAudioUtils";

export interface SceneAudioSyncProps {
  scenes: HtmlFilmScene[];
  activeDir: string | null;
  onAudioError?: (error: string | null) => void;
}

/**
 * Synchronizes native HTMLAudioElement scene narration tracks with the custom motion clock.
 */
export const SceneAudioSync: React.FC<SceneAudioSyncProps> = ({
  scenes,
  activeDir,
  onAudioError,
}) => {
  const frame = useMotionFrame();
  const { fps, isPlaying, playbackRate, volume, isMuted } = useMotionConfig();
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const failedTracksRef = useRef<Map<string, string>>(new Map());

  const authToken = useSyncExternalStore(
    subscribeEngineMediaAuth,
    getEngineMediaAuthToken,
    () => null
  );
  const authSettled = useSyncExternalStore(
    subscribeEngineMediaAuth,
    isEngineMediaAuthSettled,
    () => true
  );

  useEffect(() => {
    void initEngineMediaAuth();
  }, []);

  const latestClockRef = useRef({ frame, fps, isPlaying, playbackRate, volume, isMuted });
  latestClockRef.current = { frame, fps, isPlaying, playbackRate, volume, isMuted };

  const resolvedTracks = useMemo(() => {
    // Re-resolve track URLs once Tauri runtimeAuthToken arrives.
    void authToken;
    return resolveSceneAudioTracks(scenes, activeDir, authSettled);
  }, [scenes, activeDir, authSettled, authToken]);

  const emitFirstTrackError = useCallback(() => {
    const first = failedTracksRef.current.values().next();
    onAudioError?.(first.done ? null : first.value);
  }, [onAudioError]);

  useEffect(() => {
    failedTracksRef.current.clear();
    onAudioError?.(null);
  }, [resolvedTracks, onAudioError]);

  const syncSingleElement = useCallback(
    (scene: HtmlFilmScene, el: HTMLAudioElement, volumeScale = 1, keyId = scene.id, labelPath = scene.audio) => {
      const clock = latestClockRef.current;
      const effectiveVolume = computeEffectiveAudioVolume(
        (clock.volume ?? 1) * volumeScale,
        clock.isMuted
      );
      el.muted = clock.isMuted || effectiveVolume <= 0;
      el.volume = effectiveVolume;
      el.playbackRate = Math.max(0.25, Math.min(4, clock.playbackRate));

      const endFrame = scene.startFrame + scene.durationFrames;
      const inRange = clock.frame >= scene.startFrame && clock.frame < endFrame;
      if (!inRange) {
        if (!el.paused) el.pause();
        return;
      }

      const targetSec = computeAudioTargetSeconds(clock.frame, scene.startFrame, clock.fps);
      if (Math.abs(el.currentTime - targetSec) > (clock.isPlaying ? 0.18 : 0.04)) {
        try {
          el.currentTime = targetSec;
        } catch {
          // Audio metadata may still be loading; onLoadedMetadata will resync
        }
      }

      if (clock.isPlaying && el.paused) {
        void el.play().catch((err: unknown) => {
          const errName = err instanceof DOMException ? err.name : err instanceof Error ? err.name : undefined;
          if (errName === "AbortError") return;
          const msg = formatAudioErrorMessage(labelPath, el.error?.code, errName);
          console.error("[SceneAudioSync] play failed:", msg, err);
          failedTracksRef.current.set(keyId, msg);
          emitFirstTrackError();
        });
      } else if (!clock.isPlaying && !el.paused) {
        el.pause();
      }
    },
    [emitFirstTrackError]
  );

  useEffect(() => {
    for (const track of resolvedTracks) {
      const keyId = track.trackKey || `${track.scene.id}:${track.kind || "voice"}`;
      const el = audioRefs.current.get(keyId);
      if (el) {
        syncSingleElement(
          track.scene,
          el,
          track.volumeScale ?? 1,
          keyId,
          track.kind === "sfx" ? track.scene.sfx : track.scene.audio
        );
      }
    }
  }, [frame, fps, isPlaying, playbackRate, volume, isMuted, resolvedTracks, syncSingleElement]);

  useEffect(() => {
    const map = audioRefs.current;
    return () => {
      for (const el of map.values()) {
        el.pause();
      }
    };
  }, []);

  if (resolvedTracks.length === 0) return null;

  return (
    <div style={{ display: "none" }} aria-hidden="true">
      {resolvedTracks.map((track) => {
        const { scene, src } = track;
        const keyId = track.trackKey || `${scene.id}:${track.kind || "voice"}`;
        const labelPath = track.kind === "sfx" ? scene.sfx : scene.audio;
        return (
          <audio
            key={`${keyId}-${src}`}
            preload="auto"
            src={src}
            onLoadedMetadata={(e) => {
              syncSingleElement(scene, e.currentTarget, track.volumeScale ?? 1, keyId, labelPath);
            }}
            onCanPlay={(e) => {
              if (failedTracksRef.current.delete(keyId)) {
                emitFirstTrackError();
              }
              syncSingleElement(scene, e.currentTarget, track.volumeScale ?? 1, keyId, labelPath);
            }}
            onError={(e) => {
              const msg = formatAudioErrorMessage(labelPath, e.currentTarget.error?.code);
              console.error("[SceneAudioSync] media error:", msg);
              failedTracksRef.current.set(keyId, msg);
              emitFirstTrackError();
            }}
            ref={(el) => {
              if (el) {
                audioRefs.current.set(keyId, el);
              } else {
                audioRefs.current.delete(keyId);
              }
            }}
          />
        );
      })}
    </div>
  );
};

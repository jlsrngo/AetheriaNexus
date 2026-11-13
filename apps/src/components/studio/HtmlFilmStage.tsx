import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Film, FolderOpen } from "lucide-react";
import { useMotionConfig, useMotionFrame } from "./MotionContext";
import { SceneAudioSync } from "./SceneAudioSync";
import {
  type HtmlFilmDescriptor,
  prepareInjectedHtml,
  resolveWorkspaceAssetUrl,
} from "./htmlStageBundle";
import { apiFetch } from "../../lib/api";
import {
  STAGE_MSG_ASSET_REQUEST,
  STAGE_MSG_ASSET_RESPONSE,
  STAGE_MSG_ERROR,
  STAGE_MSG_READY,
  STAGE_MSG_RENDER_AT,
  isTrustedStageMessageSource,
  normalizeSandboxedAssetPath,
} from "./htmlStageBridge";

export {
  type HtmlFilmScene,
  type HtmlFilmScriptAsset,
  type HtmlFilmDescriptor,
  resolveWorkspaceAssetUrl,
  loadWorkspaceHtmlFilm,
  prepareInjectedHtml,
} from "./htmlStageBundle";

export interface HtmlFilmStageProps {
  film: HtmlFilmDescriptor;
  onRuntimeError?: (err: string | null) => void;
}

/**
 * Sandboxed HTML5+JS Motion Engine iframe stage synchronized via `window.renderAt(t)`.
 */
export const HtmlFilmStage: React.FC<HtmlFilmStageProps> = ({
  film,
  onRuntimeError,
}) => {
  const stageErrorRef = useRef<string | null>(null);
  const audioErrorRef = useRef<string | null>(null);

  const reportStageError = useCallback(
    (err: string | null) => {
      stageErrorRef.current = err;
      onRuntimeError?.(stageErrorRef.current ?? audioErrorRef.current);
    },
    [onRuntimeError]
  );

  const reportAudioError = useCallback(
    (err: string | null) => {
      audioErrorRef.current = err;
      onRuntimeError?.(stageErrorRef.current ?? audioErrorRef.current);
    },
    [onRuntimeError]
  );
  const frame = useMotionFrame();
  const { fps, width, height } = useMotionConfig();
  const stageBoxRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeReady, setIframeReady] = useState(false);
  const [boxSize, setBoxSize] = useState<{ w: number; h: number }>({
    w: width,
    h: height,
  });

  const srcDoc = useMemo(() => prepareInjectedHtml(film), [film]);

  useLayoutEffect(() => {
    const el = stageBoxRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) {
        setBoxSize({ w, h });
      }
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect && rect.width > 0 && rect.height > 0) {
        setBoxSize({ w: rect.width, h: rect.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setIframeReady(false);
  }, [srcDoc]);

  const frameRef = useRef(frame);
  const fpsRef = useRef(fps);
  frameRef.current = frame;
  fpsRef.current = fps;

  useEffect(() => {
    const handleMessage = (event: MessageEvent<unknown>) => {
      const targetWin = iframeRef.current?.contentWindow;
      if (!isTrustedStageMessageSource(event.source, targetWin)) return;
      if (!event.data || typeof event.data !== "object") return;
      const msg = event.data as Record<string, unknown>;

      if (msg.type === STAGE_MSG_READY) {
        setIframeReady(true);
        reportStageError(null);
        targetWin?.postMessage(
          {
            type: STAGE_MSG_RENDER_AT,
            timeSec: frameRef.current / Math.max(1, fpsRef.current),
          },
          "*",
        );
        return;
      }

      if (msg.type === STAGE_MSG_ERROR) {
        const message = typeof msg.message === "string" ? msg.message : "Stage script error";
        reportStageError(message);
        return;
      }

      if (msg.type === STAGE_MSG_ASSET_REQUEST) {
        const requestId = msg.id;
        const safeRel = normalizeSandboxedAssetPath(msg.path);
        const resolvedUrl = safeRel ? resolveWorkspaceAssetUrl(safeRel, film.activeDir) : null;
        if (!resolvedUrl) {
          targetWin?.postMessage(
            {
              type: STAGE_MSG_ASSET_RESPONSE,
              id: requestId,
              ok: false,
              status: 403,
              contentType: "text/plain",
              buffer: new ArrayBuffer(0),
            },
            "*",
          );
          return;
        }
        void apiFetch(resolvedUrl)
          .then(async (res) => {
            const buffer = await res.arrayBuffer();
            const contentType = res.headers.get("content-type") || "application/octet-stream";
            targetWin?.postMessage(
              {
                type: STAGE_MSG_ASSET_RESPONSE,
                id: requestId,
                ok: res.ok,
                status: res.status,
                contentType,
                buffer,
              },
              "*",
              [buffer],
            );
          })
          .catch(() => {
            targetWin?.postMessage(
              {
                type: STAGE_MSG_ASSET_RESPONSE,
                id: requestId,
                ok: false,
                status: 500,
                contentType: "text/plain",
                buffer: new ArrayBuffer(0),
              },
              "*",
            );
          });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [film.activeDir, reportStageError]);

  useEffect(() => {
    if (!iframeReady) return;
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: STAGE_MSG_RENDER_AT,
        timeSec: frame / Math.max(1, fps),
      },
      "*",
    );
  }, [frame, fps, iframeReady]);

  const safeW = Math.max(1, width);
  const safeH = Math.max(1, height);
  const stageScale = Math.min(boxSize.w / safeW, boxSize.h / safeH);

  return (
    <div
      ref={stageBoxRef}
      className="relative w-full h-full bg-[#0A0A0C] overflow-hidden select-none flex items-center justify-center"
    >
      <SceneAudioSync
        scenes={film.scenes}
        activeDir={film.activeDir}
        onAudioError={reportAudioError}
      />
      <div
        style={{
          width: `${safeW}px`,
          height: `${safeH}px`,
          transform: `scale(${stageScale})`,
          transformOrigin: "center center",
          flexShrink: 0,
        }}
      >
        <iframe
          ref={iframeRef}
          title={film.title || "Aetheria HTML Film"}
          srcDoc={srcDoc}
          sandbox="allow-scripts"
          style={{
            width: `${safeW}px`,
            height: `${safeH}px`,
            border: "none",
            display: "block",
            pointerEvents: "none",
            background: "#0A0A0C",
          }}
        />
      </div>
    </div>
  );
};

export interface EmptyHtmlStageProps {
  activeFolder?: string | null;
}

/**
 * Empty IDE stage placeholder shown when no folder or HTML film is loaded.
 */
export const EmptyHtmlStage: React.FC<EmptyHtmlStageProps> = ({
  activeFolder,
}) => (
  <div className="w-full h-full flex flex-col items-center justify-center bg-[#0A0A0C] text-[#FAFAFA] px-10 text-center select-none border border-[#26262C]">
    <div className="w-16 h-16 rounded-2xl bg-[#121215] border border-[#26262C] flex items-center justify-center mb-5">
      {activeFolder ? (
        <Film className="w-7 h-7 text-[#FAFAFA]" />
      ) : (
        <FolderOpen className="w-7 h-7 text-[#8E8E98]" />
      )}
    </div>
    <p className="text-xl font-semibold tracking-tight text-[#FAFAFA] mb-2">
      {activeFolder ? "No HTML Motion Film in Active Folder" : "No Project Folder Open"}
    </p>
    <p className="text-sm text-[#8E8E98] max-w-md leading-relaxed">
      {activeFolder
        ? `Create index.html + script/scene1.js inside "${activeFolder}", or ask the AI assistant in Chat to generate your HTML5 + JS video.`
        : "Open a project folder from the Explorer or File menu. Each project stays cleanly isolated from the Aetheria IDE."}
    </p>
  </div>
);

export function createHtmlFilmComponent(
  film: HtmlFilmDescriptor,
  onRuntimeError?: (err: string | null) => void
): React.FC<Record<string, unknown>> {
  const BoundHtmlFilmStage: React.FC<Record<string, unknown>> = () => (
    <HtmlFilmStage film={film} onRuntimeError={onRuntimeError} />
  );
  BoundHtmlFilmStage.displayName = "BoundHtmlFilmStage";
  return BoundHtmlFilmStage;
}

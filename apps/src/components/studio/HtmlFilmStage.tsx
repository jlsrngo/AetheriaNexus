import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Film, FolderOpen } from "lucide-react";
import { useMotionConfig, useMotionFrame } from "./MotionContext";
import { SceneAudioSync } from "./SceneAudioSync";
import {
  type HtmlFilmDescriptor,
  prepareInjectedHtml,
} from "./htmlStageBundle";

export {
  type HtmlFilmScene,
  type HtmlFilmScriptAsset,
  type HtmlFilmDescriptor,
  resolveWorkspaceAssetUrl,
  loadWorkspaceHtmlFilm,
  prepareInjectedHtml,
} from "./htmlStageBundle";

interface FrameWindow extends Window {
  renderAt?: (t: number) => void;
  __ready?: boolean;
  __aetheriaHostTime?: number;
  __aetheriaInHostCall?: boolean;
}

export interface HtmlFilmStageProps {
  film: HtmlFilmDescriptor;
  onRuntimeError?: (err: string | null) => void;
}

function invokeHostRenderAt(win: FrameWindow, timeSec: number): void {
  if (typeof win.renderAt !== "function") return;
  win.__aetheriaHostTime = timeSec;
  win.__aetheriaInHostCall = true;
  try {
    win.renderAt(timeSec);
  } finally {
    win.__aetheriaInHostCall = false;
  }
}

/**
 * Sandboxed HTML5+JS Motion Engine iframe stage synchronized via `window.renderAt(t)`.
 */
export const HtmlFilmStage: React.FC<HtmlFilmStageProps> = ({
  film,
  onRuntimeError,
}) => {
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

  useEffect(() => {
    if (!iframeReady) return;
    const win = iframeRef.current?.contentWindow as FrameWindow | null;
    if (!win || typeof win.renderAt !== "function") return;
    try {
      invokeHostRenderAt(win, frame / Math.max(1, fps));
      onRuntimeError?.(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onRuntimeError?.(msg);
    }
  }, [frame, fps, iframeReady, onRuntimeError]);

  const handleLoad = () => {
    const win = iframeRef.current?.contentWindow as FrameWindow | null;
    const syncFrame = () => {
      if (win && typeof win.renderAt === "function") {
        setIframeReady(true);
        try {
          invokeHostRenderAt(win, frame / Math.max(1, fps));
          onRuntimeError?.(null);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          onRuntimeError?.(msg);
        }
      }
    };

    if (win?.__ready && typeof win.renderAt === "function") {
      syncFrame();
      return;
    }

    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      if (win && (win.__ready || typeof win.renderAt === "function")) {
        window.clearInterval(timer);
        syncFrame();
      } else if (tries > 50) {
        window.clearInterval(timer);
        setIframeReady(true);
      }
    }, 100);
  };

  const safeW = Math.max(1, width);
  const safeH = Math.max(1, height);
  const stageScale = Math.min(boxSize.w / safeW, boxSize.h / safeH);

  return (
    <div
      ref={stageBoxRef}
      className="relative w-full h-full bg-[#0A0A0C] overflow-hidden select-none flex items-center justify-center"
    >
      <SceneAudioSync scenes={film.scenes} activeDir={film.activeDir} />
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
          onLoad={handleLoad}
          sandbox="allow-scripts allow-same-origin"
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
        <Film className="w-7 h-7 text-emerald-400" />
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

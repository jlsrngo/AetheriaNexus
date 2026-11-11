import React, { useEffect, useMemo, useRef, useState } from "react";
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
}

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
  const frame = useMotionFrame();
  const { fps, width, height } = useMotionConfig();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeReady, setIframeReady] = useState(false);

  const srcDoc = useMemo(() => prepareInjectedHtml(film), [film]);

  useEffect(() => {
    setIframeReady(false);
  }, [srcDoc]);

  useEffect(() => {
    if (!iframeReady) return;
    const win = iframeRef.current?.contentWindow as FrameWindow | null;
    if (!win || typeof win.renderAt !== "function") return;
    try {
      win.renderAt(frame / Math.max(1, fps));
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
          win.renderAt(frame / Math.max(1, fps));
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

  return (
    <div className="relative w-full h-full bg-[#0A0A0C] overflow-hidden select-none">
      <SceneAudioSync scenes={film.scenes} activeDir={film.activeDir} />
      <iframe
        ref={iframeRef}
        title={film.title || "Aetheria HTML Film"}
        srcDoc={srcDoc}
        onLoad={handleLoad}
        sandbox="allow-scripts allow-same-origin"
        style={{
          width: `${width}px`,
          height: `${height}px`,
          border: "none",
          display: "block",
          pointerEvents: "none",
          background: "#0A0A0C",
        }}
      />
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

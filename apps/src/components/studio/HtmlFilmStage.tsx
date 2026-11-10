import React, { useEffect, useMemo, useRef, useState } from "react";
import { Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

export interface HtmlFilmScene {
  id: string;
  title: string;
  startFrame: number;
  durationFrames: number;
  audio?: string;
  words?: string;
}

export interface HtmlFilmDescriptor {
  html: string;
  title: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  scenes: HtmlFilmScene[];
}

export const DEFAULT_HTML_SCENES: HtmlFilmScene[] = [
  {
    id: "scene1_hook",
    title: "Scene 1 · Hook (Kota Gelap → Terang)",
    startFrame: 0,
    durationFrames: 427,
    audio: "audio/scene1_hook.wav",
    words: "/audio/scene1_hook.words.json",
  },
  {
    id: "scene2_rahasia_alam",
    title: "Scene 2 · Rahasia Alam & Batu Amber",
    startFrame: 427,
    durationFrames: 654,
    audio: "audio/scene2_rahasia_alam.wav",
    words: "/audio/scene2_rahasia_alam.words.json",
  },
  {
    id: "scene3_langit_laboratorium",
    title: "Scene 3 · Badai Petir Benjamin Franklin (1752)",
    startFrame: 1081,
    durationFrames: 803,
    audio: "audio/scene3_langit_laboratorium.wav",
    words: "/audio/scene3_langit_laboratorium.words.json",
  },
  {
    id: "scene4_volta_baterai",
    title: "Scene 4 · Baterai Alessandro Volta (1800)",
    startFrame: 1884,
    durationFrames: 554,
    audio: "audio/scene4_volta_baterai.wav",
    words: "/audio/scene4_volta_baterai.words.json",
  },
  {
    id: "scene5_faraday_generator",
    title: "Scene 5 · Induksi & Generator Faraday (1831)",
    startFrame: 2438,
    durationFrames: 470,
    audio: "audio/scene5_faraday_generator.wav",
    words: "/audio/scene5_faraday_generator.words.json",
  },
  {
    id: "scene6_twist_penutup",
    title: "Scene 6 · Twist / Kota Modern Penuh Cahaya",
    startFrame: 2908,
    durationFrames: 708,
    audio: "audio/scene6_twist_penutup.wav",
    words: "/audio/scene6_twist_penutup.words.json",
  },
];

// Lazy raw loader for HTML films in workspace/index.html + modular scene scripts in workspace/script/*.js
const workspaceHtmlLoaders = import.meta.glob<string>(
  "../../../../workspace/index.html",
  { query: "?raw", import: "default" }
);

const workspaceScriptLoaders = import.meta.glob<string>(
  "../../../../workspace/script/*.js",
  { query: "?raw", import: "default" }
);

function extractNumber(raw: string, key: string, fallback: number): number {
  const regex = new RegExp(`\\b${key}\\s*:\\s*([0-9]+(?:\\.[0-9]+)?)`);
  const match = raw.match(regex);
  if (!match) return fallback;
  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function extractString(raw: string, key: string, fallback: string): string {
  const regex = new RegExp(`\\b${key}\\s*:\\s*["']([^"']+)["']`);
  const match = raw.match(regex);
  return match?.[1]?.trim() || fallback;
}

export async function loadWorkspaceHtmlFilm(): Promise<HtmlFilmDescriptor | null> {
  const paths = Object.keys(workspaceHtmlLoaders);
  if (paths.length === 0) return null;
  const loader = workspaceHtmlLoaders[paths[0]];
  if (!loader) return null;
  const rawHtml = await loader();
  if (!rawHtml || typeof rawHtml !== "string" || !rawHtml.trim()) return null;

  // Load and sort workspace/script/*.js (aetheria-motion.js first, then scene1..N.js)
  const scriptEntries = await Promise.all(
    Object.entries(workspaceScriptLoaders).map(async ([filePath, loadScript]) => {
      const fileName = filePath.split("/").pop() || filePath;
      const code = await loadScript();
      return { fileName, code };
    })
  );

  scriptEntries.sort((a, b) => {
    if (a.fileName === "aetheria-motion.js") return -1;
    if (b.fileName === "aetheria-motion.js") return 1;
    return a.fileName.localeCompare(b.fileName, undefined, { numeric: true });
  });

  // Strip external <script src=".../script/..."></script> tags that we inline directly from workspace/script/
  let html = rawHtml.replace(
    /<script\b[^>]*\bsrc=["'][^"']*\/?(?:script\/[^"']+|aetheria-motion\.js)["'][^>]*>\s*<\/script>/gi,
    ""
  );

  const inlinedScripts = scriptEntries
    .map(
      (entry) =>
        `<!-- [inlined:${entry.fileName}] -->\n<script>\n${entry.code}\n</script>`
    )
    .join("\n");

  if (html.includes("</head>")) {
    html = html.replace("</head>", `${inlinedScripts}\n</head>`);
  } else {
    html = `${inlinedScripts}\n${html}`;
  }

  const width = Math.round(extractNumber(rawHtml, "width", 1080));
  const height = Math.round(extractNumber(rawHtml, "height", 1920));
  const fps = Math.round(extractNumber(rawHtml, "fps", 30));
  const durationSec = extractNumber(rawHtml, "duration", 120.533);
  const explicitFrames = extractNumber(rawHtml, "durationInFrames", 0);
  const durationInFrames =
    explicitFrames > 0 ? Math.round(explicitFrames) : Math.max(1, Math.round(durationSec * fps));
  const title = extractString(rawHtml, "title", "Sejarah Lahirnya Listrik");

  return {
    html,
    title,
    width,
    height,
    fps,
    durationInFrames,
    scenes: DEFAULT_HTML_SCENES,
  };
}

function prepareFilmSrcDoc(rawHtml: string): string {
  const baseUrl = typeof window !== "undefined" ? window.location.origin + "/" : "/";
  const hasInlinedRuntime = rawHtml.includes("[inlined:aetheria-motion.js]");
  const injection = hasInlinedRuntime
    ? `<base href="${baseUrl}" />\n`
    : `<base href="${baseUrl}" />\n<script src="${baseUrl}script/aetheria-motion.js"></script>\n`;
  if (rawHtml.includes("</head>")) {
    return rawHtml.replace("</head>", `${injection}</head>`);
  }
  return `${injection}${rawHtml}`;
}

export function createHtmlFilmComponent(descriptor: HtmlFilmDescriptor): React.FC {
  const preparedHtml = prepareFilmSrcDoc(descriptor.html);
  const scenes = descriptor.scenes.length > 0 ? descriptor.scenes : DEFAULT_HTML_SCENES;

  const AetheriaHtmlFilmStage: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const frameRef = useRef<number>(frame);
    const [runtimeError, setRuntimeError] = useState<string | null>(null);

    frameRef.current = frame;

    const syncFrameToIframe = (targetFrame: number) => {
      const win = iframeRef.current?.contentWindow as
        | (Window & {
            renderAt?: (t: number) => void;
            __ready?: boolean;
          })
        | null
        | undefined;
      if (!win || typeof win.renderAt !== "function") return;
      try {
        win.renderAt(targetFrame / fps);
      } catch (err: any) {
        setRuntimeError(err?.message || String(err));
      }
    };

    // Drive deterministic frame updates on every seek/play tick
    useEffect(() => {
      syncFrameToIframe(frame);
    }, [frame, fps]);

    // Ensure initial frame + async asset readiness (e.g. .words.json fetch) re-renders frame
    const handleIframeLoad = () => {
      syncFrameToIframe(frameRef.current);
      let attempts = 0;
      const pollReady = () => {
        attempts++;
        const win = iframeRef.current?.contentWindow as
          | (Window & { __ready?: boolean; renderAt?: (t: number) => void })
          | null
          | undefined;
        if (win && typeof win.renderAt === "function") {
          syncFrameToIframe(frameRef.current);
          if (win.__ready === true || attempts > 40) return;
        }
        if (attempts <= 40) {
          setTimeout(pollReady, 50);
        }
      };
      setTimeout(pollReady, 40);
    };

    const audioNodes = useMemo(
      () =>
        scenes
          .filter((s) => Boolean(s.audio))
          .map((s) => {
            const cleanSrc = String(s.audio).replace(/^\/+/, "");
            return (
              <Sequence
                key={s.id}
                from={s.startFrame}
                durationInFrames={s.durationFrames}
              >
                <Audio src={staticFile(cleanSrc)} />
              </Sequence>
            );
          }),
      []
    );

    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          backgroundColor: "#0D0D1A",
          overflow: "hidden",
        }}
      >
        <iframe
          ref={iframeRef}
          title={descriptor.title}
          srcDoc={preparedHtml}
          onLoad={handleIframeLoad}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            display: "block",
            pointerEvents: "none",
            backgroundColor: "#0D0D1A",
          }}
        />
        {audioNodes}
        {runtimeError && (
          <div
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              padding: "6px 12px",
              borderRadius: 8,
              backgroundColor: "rgba(244, 63, 94, 0.2)",
              border: "1px solid rgba(244, 63, 94, 0.45)",
              color: "#FDA4AF",
              fontSize: 12,
              fontFamily: "monospace",
              pointerEvents: "none",
            }}
          >
            renderAt warning: {runtimeError}
          </div>
        )}
      </div>
    );
  };

  return AetheriaHtmlFilmStage;
}


import { API_BASE, activeDirectory, apiFetch } from "../../lib/api";

export interface HtmlFilmScene {
  id: string;
  title: string;
  start: number;
  duration: number;
  startFrame: number;
  durationFrames: number;
  audio?: string | null;
  words?: string | null;
}

export interface HtmlFilmScriptAsset {
  name: string;
  relativePath: string;
  code: string;
}

export interface HtmlFilmDescriptor {
  exists: boolean;
  activeDir: string | null;
  filmRoot: string | null;
  title: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  totalFrames: number;
  scenes: HtmlFilmScene[];
  rawHtml: string;
  scripts: HtmlFilmScriptAsset[];
}

interface FilmBundleApiPayload {
  exists: boolean;
  activeDir?: string | null;
  filmRoot?: string | null;
  rawHtml?: string;
  scripts?: HtmlFilmScriptAsset[];
  meta?: {
    exists?: boolean;
    title?: string;
    width?: number;
    height?: number;
    fps?: number;
    duration?: number;
    totalFrames?: number;
    scenes?: HtmlFilmScene[];
  };
}

/**
 * Resolves a relative film asset path against the active project folder endpoint.
 */
export function resolveWorkspaceAssetUrl(
  rawUrl: string | null | undefined,
  dirOverride?: string | null
): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }
  const clean = trimmed.replace(/^(\.\/|\/)+/, "").replace(/\\/g, "/");
  const dir = dirOverride ?? activeDirectory();
  const baseUrl = `${API_BASE}/studio/ws-asset/${clean}`;
  return dir ? `${baseUrl}?directory=${encodeURIComponent(dir)}` : baseUrl;
}

/**
 * Fetches the active project folder's HTML film bundle from the isolated Rust engine API.
 * Never bundles repo-local `workspace/` assets at Vite compile time.
 */
export async function loadWorkspaceHtmlFilm(): Promise<HtmlFilmDescriptor | null> {
  const res = await apiFetch(`${API_BASE}/studio/film-bundle`);
  if (!res.ok) {
    throw new Error(`Engine returned HTTP ${res.status} while loading film bundle.`);
  }
  const rawText = await res.text();
  let data: FilmBundleApiPayload;
  try {
    data = JSON.parse(rawText) as FilmBundleApiPayload;
  } catch {
    const preview = rawText.trim().slice(0, 80);
    throw new Error(
      `Invalid JSON from /api/studio/film-bundle (${res.status}): ${preview || "<empty>"}`
    );
  }
  if (!data.exists || !data.rawHtml) {
    return null;
  }

  const meta = data.meta ?? {};
  const fps = Math.max(1, meta.fps ?? 30);
  const duration = Math.max(0.5, meta.duration ?? 15);
  const totalFrames = Math.max(
    1,
    meta.totalFrames ?? Math.round(duration * fps)
  );

  return {
    exists: true,
    activeDir: data.activeDir ?? activeDirectory() ?? null,
    filmRoot: data.filmRoot ?? null,
    title: meta.title || "HTML Motion Film",
    width: Math.max(16, meta.width ?? 1080),
    height: Math.max(16, meta.height ?? 1920),
    fps,
    duration,
    totalFrames,
    scenes: Array.isArray(meta.scenes) ? meta.scenes : [],
    rawHtml: data.rawHtml,
    scripts: Array.isArray(data.scripts) ? data.scripts : [],
  };
}

function escapeJsString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildAssetShimScript(activeDir: string | null): string {
  const safeApiBase = escapeJsString(API_BASE);
  const safeDir = escapeJsString(activeDir ?? "");
  return `<script>
(function () {
  var apiBase = "${safeApiBase}";
  var activeDir = "${safeDir}";
  function rewriteAssetUrl(url) {
    if (typeof url !== "string") return url;
    var trimmed = url.trim();
    if (!trimmed || /^https?:\\/\\//i.test(trimmed) || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
      return url;
    }
    if (trimmed.startsWith("/api/")) {
      return apiBase.replace(/\\/api$/, "") + trimmed;
    }
    var clean = trimmed.replace(/^(\\.\\/|\\/)+/, "");
    if (/^(audio|img|public|script|assets|sfx|fonts)\\//i.test(clean)) {
      var target = apiBase + "/studio/ws-asset/" + clean;
      return activeDir ? target + "?directory=" + encodeURIComponent(activeDir) : target;
    }
    return url;
  }
  window.__resolveAssetUrl = rewriteAssetUrl;
  var origFetch = window.fetch;
  if (typeof origFetch === "function") {
    window.fetch = function (input, init) {
      if (typeof input === "string") {
        input = rewriteAssetUrl(input);
      } else if (input && typeof input.url === "string") {
        input = new Request(rewriteAssetUrl(input.url), input);
      }
      return origFetch.call(this, input, init);
    };
  }
  var imgProto = window.HTMLImageElement && window.HTMLImageElement.prototype;
  if (imgProto) {
    var desc = Object.getOwnPropertyDescriptor(imgProto, "src");
    if (desc && typeof desc.set === "function") {
      Object.defineProperty(imgProto, "src", {
        configurable: true,
        enumerable: true,
        get: function () { return desc.get ? desc.get.call(this) : ""; },
        set: function (val) { desc.set.call(this, rewriteAssetUrl(String(val))); }
      });
    }
  }
  var rawRenderAt = null;
  try {
    Object.defineProperty(window, "renderAt", {
      configurable: true,
      enumerable: true,
      get: function () {
        if (typeof rawRenderAt !== "function") return rawRenderAt;
        return function (t) {
          var targetT = t;
          if (
            !window.__aetheriaInHostCall &&
            typeof window.__aetheriaHostTime === "number" &&
            targetT === 0 &&
            window.__aetheriaHostTime !== 0
          ) {
            targetT = window.__aetheriaHostTime;
          }
          return rawRenderAt.call(this, targetT);
        };
      },
      set: function (fn) {
        rawRenderAt = typeof fn === "function" ? fn : null;
      }
    });
  } catch (e) {}
})();
</script><style data-aetheria-stage-chrome>
#loading, #controls, .aetheria-standalone-controls, [data-aetheria-standalone-chrome] {
  display: none !important;
  opacity: 0 !important;
  visibility: hidden !important;
  pointer-events: none !important;
}
html, body {
  margin: 0 !important;
  padding: 0 !important;
  width: 100% !important;
  height: 100% !important;
  overflow: hidden !important;
  background: #0A0A0C !important;
}
</style>`;
}

/**
 * Injects asset URL rewriting and inlined scene scripts into raw stage HTML.
 */
export function prepareInjectedHtml(film: HtmlFilmDescriptor): string {
  let html = film.rawHtml;

  // Strip local external script tags already resolved via film.scripts
  html = html.replace(
    /<script\b[^>]*src=["'](?:\.?\/)?(?:script|public\/script)\/[^"']+["'][^>]*>\s*<\/script>/gi,
    ""
  );
  if (film.scripts.some((s) => s.name.toLowerCase() === "three.min.js")) {
    html = html.replace(
      /<script\b[^>]*src=["'](?:https?:)?\/\/[^"']*three(?:\.min)?\.js(?:\?[^"']*)?["'][^>]*>\s*<\/script>/gi,
      ""
    );
  }

  const shimTag = buildAssetShimScript(film.activeDir);
  const inlineScripts = film.scripts
    .map((s) => `<script data-script="${s.name}">\n${s.code}\n</script>`)
    .join("\n");

  const payloadBlock = `${shimTag}\n${inlineScripts}\n`;

  if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/<head[^>]*>/i, (m) => `${m}\n${shimTag}\n`);
  } else {
    html = `${shimTag}\n${html}`;
  }

  if (html.includes("</head>")) {
    html = html.replace("</head>", `${inlineScripts}\n</head>`);
  } else if (html.includes("</body>")) {
    html = html.replace("</body>", `${inlineScripts}\n</body>`);
  } else {
    html = `${payloadBlock}${html}`;
  }

  return html;
}


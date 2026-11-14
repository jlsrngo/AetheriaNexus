/**
 * PostMessage protocol and asset-relay utilities for the sandboxed (`allow-scripts`,
 * opaque `null` origin) HTML preview iframe. No parent origin, storage, desktop bridge,
 * or engine auth token is ever exposed to user/AI film HTML.
 */

export const STAGE_MSG_READY = "aetheria:ready" as const;
export const STAGE_MSG_RENDER_AT = "aetheria:renderAt" as const;
export const STAGE_MSG_HOT_SWAP_SCRIPT = "aetheria:hotSwapScript" as const;
export const STAGE_MSG_ERROR = "aetheria:error" as const;
export const STAGE_MSG_ASSET_REQUEST = "aetheria:assetRequest" as const;
export const STAGE_MSG_ASSET_RESPONSE = "aetheria:assetResponse" as const;

const WORKSPACE_ASSET_PREFIXES = [
  "audio/",
  "img/",
  "images/",
  "public/",
  "script/",
  "assets/",
  "sfx/",
  "fonts/",
  "media/",
] as const;

export function isTrustedStageMessageSource(
  source: unknown,
  expectedWindow: Window | null | undefined,
): boolean {
  return Boolean(expectedWindow && source === expectedWindow);
}

/**
 * Validates and normalizes an asset path requested by the sandboxed iframe over `postMessage`.
 * Rejects path traversal (`..`), absolute external URLs, and arbitrary `/api/*` paths so user
 * HTML cannot use the parent window as a confused-deputy API/SSRF proxy.
 */
export function normalizeSandboxedAssetPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let cleaned = raw.trim();
  if (!cleaned || cleaned.length > 512) return null;
  if (/[\0\r\n]/.test(cleaned)) return null;

  const qIdx = cleaned.indexOf("?");
  if (qIdx >= 0) {
    cleaned = cleaned.slice(0, qIdx);
  }
  const hIdx = cleaned.indexOf("#");
  if (hIdx >= 0) {
    cleaned = cleaned.slice(0, hIdx);
  }

  cleaned = cleaned.replace(/\\/g, "/");
  if (cleaned.startsWith("/api/studio/ws-asset/")) {
    cleaned = cleaned.slice("/api/studio/ws-asset/".length);
  } else if (/^[a-z]+:/i.test(cleaned) || cleaned.startsWith("//")) {
    return null;
  }

  cleaned = cleaned.replace(/^(\.\/)+/, "").replace(/^\/+/, "");
  if (!cleaned || cleaned.includes("..")) return null;

  const segments = cleaned.split("/");
  if (segments.some((s) => s === "" || s === "." || s === "..")) {
    return null;
  }

  const lower = cleaned.toLowerCase();
  const allowedPrefix = WORKSPACE_ASSET_PREFIXES.some((prefix) =>
    lower.startsWith(prefix),
  );
  if (!allowedPrefix) {
    return null;
  }

  return cleaned;
}

/**
 * Builds the in-iframe bootstrap script injected into `<head>` for `sandbox="allow-scripts"`.
 * - Forwards `aetheria:renderAt` commands from `window.parent`
 * - Reports runtime errors and readiness back via `postMessage`
 * - Relays workspace asset fetches (`fetch`, `Image`, `Audio`, media DOM nodes) via `postMessage`
 */
export function buildSandboxStageBridgeScript(): string {
  return `<script>
(function(){
  if (window.__aetheriaStageBridgeInstalled) return;
  window.__aetheriaStageBridgeInstalled = true;
  // Block rogue free-running requestAnimationFrame loops inside film HTML so the canvas
  // never advances on its own while the Studio timeline playhead is paused.
  window.requestAnimationFrame = function() { return 0; };
  window.cancelAnimationFrame = function() {};
  var pendingAssets = Object.create(null);
  var reqCounter = 0;
  var repaintTimer = null;

  function scheduleHostRepaint() {
    if (repaintTimer) clearTimeout(repaintTimer);
    repaintTimer = setTimeout(function() {
      repaintTimer = null;
      if (typeof window.renderAt === "function") {
        var t = typeof window.__aetheriaHostTime === "number" ? window.__aetheriaHostTime : 0;
        window.__aetheriaInHostCall = true;
        try {
          window.renderAt(t);
        } catch (_) {
        } finally {
          window.__aetheriaInHostCall = false;
        }
      }
    }, 24);
  }

  function toCleanRelPath(raw) {
    if (!raw || typeof raw !== "string") return null;
    var s = raw.trim();
    if (!s || s.indexOf("data:") === 0 || s.indexOf("blob:") === 0) return null;
    var apiPrefix = "/api/studio/ws-asset/";
    var apiIdx = s.indexOf(apiPrefix);
    if (apiIdx !== -1) {
      s = s.slice(apiIdx + apiPrefix.length);
    } else if (/^https?:\\/\\//i.test(s) || s.indexOf("//") === 0) {
      return null;
    }
    var q = s.indexOf("?");
    if (q !== -1) s = s.slice(0, q);
    var h = s.indexOf("#");
    if (h !== -1) s = s.slice(0, h);
    s = s.replace(/\\\\/g, "/").replace(/^(\\.\\/)+/, "").replace(/^\\/+/, "");
    if (!s || s.indexOf("..") !== -1) return null;
    if (/^(audio|img|images|public|script|assets|sfx|fonts|media)\\//i.test(s)) return s;
    return null;
  }
  window.__resolveAssetUrl = function(raw) {
    return toCleanRelPath(raw) || raw;
  };

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
  } catch (_) {}

  function requestParentAsset(relPath) {
    return new Promise(function(resolve) {
      var id = ++reqCounter;
      var timer = setTimeout(function() {
        if (pendingAssets[id]) {
          delete pendingAssets[id];
          resolve({ ok: false, status: 504, contentType: "application/octet-stream", buffer: new ArrayBuffer(0) });
        }
      }, 15000);
      pendingAssets[id] = function(payload) {
        clearTimeout(timer);
        resolve(payload);
        setTimeout(scheduleHostRepaint, 16);
      };
      window.parent.postMessage({ type: "${STAGE_MSG_ASSET_REQUEST}", id: id, path: relPath }, "*");
    });
  }

  function fetchWorkspaceBlobUrl(relPath) {
    return requestParentAsset(relPath).then(function(res) {
      if (!res || !res.ok || !res.buffer) return "";
      var blob = new Blob([res.buffer], { type: res.contentType || "application/octet-stream" });
      return URL.createObjectURL(blob);
    });
  }

  var origFetch = typeof window.fetch === "function" ? window.fetch.bind(window) : null;
  if (origFetch) {
    window.fetch = function(input, init) {
      var raw = typeof input === "string" ? input : (input && input.url) || "";
      var rel = toCleanRelPath(raw);
      if (rel) {
        return requestParentAsset(rel).then(function(res) {
          return new Response(res.buffer || new ArrayBuffer(0), {
            status: res.status || (res.ok ? 200 : 404),
            headers: { "Content-Type": res.contentType || "application/octet-stream" }
          });
        });
      }
      return origFetch(input, init);
    };
  }

  try {
    var imgProto = window.HTMLImageElement && window.HTMLImageElement.prototype;
    var desc = imgProto && Object.getOwnPropertyDescriptor(imgProto, "src");
    if (desc && desc.set) {
      Object.defineProperty(imgProto, "src", {
        configurable: true,
        enumerable: true,
        get: function() { return desc.get.call(this); },
        set: function(val) {
          var self = this;
          var rel = toCleanRelPath(val);
          if (rel) {
            fetchWorkspaceBlobUrl(rel).then(function(blobUrl) {
              if (blobUrl) desc.set.call(self, blobUrl);
            });
            return;
          }
          return desc.set.call(this, val);
        }
      });
    }
  } catch (_) {}

  var NativeAudio = window.Audio;
  if (typeof NativeAudio === "function") {
    window.Audio = function(src) {
      var audio = new NativeAudio();
      if (src) {
        var rel = toCleanRelPath(src);
        if (rel) {
          fetchWorkspaceBlobUrl(rel).then(function(blobUrl) {
            if (blobUrl) audio.src = blobUrl;
          });
        } else {
          audio.src = src;
        }
      }
      return audio;
    };
    window.Audio.prototype = NativeAudio.prototype;
  }

  function rewriteStaticDomAssets() {
    var nodes = document.querySelectorAll("img[src], audio[src], video[src], source[src]");
    for (var i = 0; i < nodes.length; i++) {
      (function(el) {
        var raw = el.getAttribute("src");
        var rel = toCleanRelPath(raw);
        if (!rel) return;
        fetchWorkspaceBlobUrl(rel).then(function(blobUrl) {
          if (blobUrl) el.setAttribute("src", blobUrl);
        });
      })(nodes[i]);
    }
  }

  window.addEventListener("error", function(ev) {
    var msg = (ev && (ev.message || (ev.error && ev.error.message))) || "Runtime script error";
    window.parent.postMessage({ type: "${STAGE_MSG_ERROR}", message: String(msg) }, "*");
  });

  window.addEventListener("unhandledrejection", function(ev) {
    var reason = ev && ev.reason;
    var msg = reason && reason.message ? reason.message : String(reason || "Unhandled promise rejection");
    window.parent.postMessage({ type: "${STAGE_MSG_ERROR}", message: String(msg) }, "*");
  });

  window.addEventListener("message", function(ev) {
    if (ev.source !== window.parent || !ev.data || typeof ev.data !== "object") return;
    if (ev.data.type === "${STAGE_MSG_ASSET_RESPONSE}") {
      var cb = pendingAssets[ev.data.id];
      if (cb) {
        delete pendingAssets[ev.data.id];
        cb(ev.data);
      }
      return;
    }
    if (ev.data.type === "${STAGE_MSG_HOT_SWAP_SCRIPT}") {
      try {
        var scriptCode = String(ev.data.code || "");
        if (scriptCode.trim()) {
          var runner = new Function(scriptCode);
          runner();
        }
        if (typeof window.renderAt === "function") {
          var swapTime = typeof ev.data.timeSec === "number"
            ? ev.data.timeSec
            : (typeof window.__aetheriaHostTime === "number" ? window.__aetheriaHostTime : 0);
          window.__aetheriaHostTime = swapTime;
          window.__aetheriaInHostCall = true;
          try {
            window.renderAt(swapTime);
          } finally {
            window.__aetheriaInHostCall = false;
          }
        }
      } catch (_) {
        // Ignore transient syntax errors while the user is mid-keystroke in the editor
      }
      return;
    }
    if (ev.data.type === "${STAGE_MSG_RENDER_AT}") {
      try {
        if (typeof window.renderAt === "function") {
          var nextTime = Number(ev.data.timeSec) || 0;
          window.__aetheriaHostTime = nextTime;
          window.__aetheriaInHostCall = true;
          try {
            window.renderAt(nextTime);
          } finally {
            window.__aetheriaInHostCall = false;
          }
        }
      } catch (err) {
        var msg = err && err.message ? err.message : String(err);
        window.parent.postMessage({ type: "${STAGE_MSG_ERROR}", message: msg }, "*");
      }
    }
  });

  var readySent = false;
  function emitReadyIfPossible() {
    if (readySent) return true;
    if (typeof window.renderAt === "function") {
      readySent = true;
      window.parent.postMessage({ type: "${STAGE_MSG_READY}", hasRenderAt: true }, "*");
      return true;
    }
    return false;
  }

  function scheduleReadyChecks() {
    rewriteStaticDomAssets();
    if (emitReadyIfPossible()) return;
    var tries = 0;
    var iv = setInterval(function() {
      tries++;
      if (emitReadyIfPossible() || tries >= 120) {
        clearInterval(iv);
        if (!readySent) {
          readySent = true;
          window.parent.postMessage({ type: "${STAGE_MSG_READY}", hasRenderAt: typeof window.renderAt === "function" }, "*");
        }
      }
    }, 50);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", rewriteStaticDomAssets);
    window.addEventListener("load", scheduleReadyChecks);
  } else {
    scheduleReadyChecks();
  }
})();
</script>`;
}

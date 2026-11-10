/**
 * Aetheria Motion Engine Runtime (v2.1 — Modular Per-Scene Architecture)
 * Deterministic 2D/SVG/Canvas Motion Graphics Toolkit for AI Film Generation.
 *
 * Every function in this runtime is a pure function of time `t` (seconds) and `seed`.
 * Exposed globally as `window.AetheriaMotion` and `window.AM`.
 */
(function (global) {
  "use strict";

  const TAU = Math.PI * 2;
  const SCENE_REGISTRY = Object.create(null);

  // ============================================================================
  // 1. Core Math & Interpolation
  // ============================================================================

  function clamp(v, min = 0, max = 1) {
    return v < min ? min : v > max ? max : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function invLerp(a, b, v) {
    if (Math.abs(b - a) < 1e-9) return 0;
    return clamp((v - a) / (b - a), 0, 1);
  }

  function remap(v, inMin, inMax, outMin, outMax, easeFn) {
    const u = invLerp(inMin, inMax, v);
    const k = typeof easeFn === "function" ? easeFn(u) : u;
    return lerp(outMin, outMax, k);
  }

  function smoothstep(edge0, edge1, x) {
    const t = invLerp(edge0, edge1, x);
    return t * t * (3 - 2 * t);
  }

  // ============================================================================
  // 2. Deterministic Seeded PRNG & Procedural Noise (Zero Math.random)
  // ============================================================================

  function hashUint32(seed) {
    let x = (seed | 0) + 0x9e3779b9;
    x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
    x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
    return (x ^ (x >>> 16)) >>> 0;
  }

  function rand(seed) {
    return hashUint32(Math.floor(seed * 100003) ^ 0x6d2b79f5) / 4294967296;
  }

  function rng(seed = 1) {
    let state = hashUint32(seed) || 1;
    return {
      next() {
        state = hashUint32(state);
        return state / 4294967296;
      },
      range(min, max) {
        return min + (max - min) * this.next();
      },
      pick(arr) {
        if (!arr || !arr.length) return undefined;
        return arr[Math.floor(this.next() * arr.length)];
      },
    };
  }

  function noise1D(x, seed = 0) {
    const i = Math.floor(x);
    const f = x - i;
    const u = f * f * (3 - 2 * f);
    const a = rand(i + seed * 1337) * 2 - 1;
    const b = rand(i + 1 + seed * 1337) * 2 - 1;
    return lerp(a, b, u);
  }

  function noise2D(x, y, seed = 0) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const h = (dx, dy) => rand((ix + dx) * 374761 + (iy + dy) * 668265 + seed * 982451) * 2 - 1;
    const n00 = h(0, 0);
    const n10 = h(1, 0);
    const n01 = h(0, 1);
    const n11 = h(1, 1);
    return lerp(lerp(n00, n10, ux), lerp(n01, n11, ux), uy);
  }

  // ============================================================================
  // 3. Studio-Grade Easing & Spring Physics
  // ============================================================================

  const ease = {
    linear: (t) => clamp(t, 0, 1),
    inQuad: (t) => {
      const x = clamp(t, 0, 1);
      return x * x;
    },
    outQuad: (t) => {
      const x = clamp(t, 0, 1);
      return 1 - (1 - x) * (1 - x);
    },
    inOutQuad: (t) => {
      const x = clamp(t, 0, 1);
      return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
    },
    inCubic: (t) => {
      const x = clamp(t, 0, 1);
      return x * x * x;
    },
    outCubic: (t) => {
      const x = clamp(t, 0, 1);
      return 1 - Math.pow(1 - x, 3);
    },
    inOutCubic: (t) => {
      const x = clamp(t, 0, 1);
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    },
    outQuart: (t) => {
      const x = clamp(t, 0, 1);
      return 1 - Math.pow(1 - x, 4);
    },
    outExpo: (t) => {
      const x = clamp(t, 0, 1);
      return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
    },
    inOutExpo: (t) => {
      const x = clamp(t, 0, 1);
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      return x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2;
    },
    outBack: (t, overshoot = 1.70158) => {
      const x = clamp(t, 0, 1);
      const c3 = overshoot + 1;
      return 1 + c3 * Math.pow(x - 1, 3) + overshoot * Math.pow(x - 1, 2);
    },
    outElastic: (t) => {
      const x = clamp(t, 0, 1);
      if (x <= 0 || x >= 1) return x;
      const c4 = (2 * Math.PI) / 3;
      return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
    },
    outBounce: (t) => {
      let x = clamp(t, 0, 1);
      const n1 = 7.5625;
      const d1 = 2.75;
      if (x < 1 / d1) return n1 * x * x;
      if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
      if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
      return n1 * (x -= 2.625 / d1) * x + 0.984375;
    },
  };

  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1;
    const bx = 3 * (x2 - x1) - cx;
    const ax = 1 - cx - bx;
    const cy = 3 * y1;
    const by = 3 * (y2 - y1) - cy;
    const ay = 1 - cy - by;
    const sx = (t) => ((ax * t + bx) * t + cx) * t;
    const sy = (t) => ((ay * t + by) * t + cy) * t;
    const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return (u) => {
      if (u <= 0) return 0;
      if (u >= 1) return 1;
      let t = u;
      for (let i = 0; i < 10; i++) {
        const d = dx(t);
        if (Math.abs(d) < 1e-6) break;
        t = clamp(t - (sx(t) - u) / d, 0, 1);
      }
      return sy(t);
    };
  }

  ease.pop = bezier(0.34, 1.56, 0.64, 1);

  // Shorthand easing table E (compatible with 01-flat-vector / aetheria-motion demos)
  const E = {
    inQ: ease.inQuad,
    outQ: ease.outQuad,
    ioQ: ease.inOutQuad,
    inC: ease.inCubic,
    outC: ease.outCubic,
    ioC: ease.inOutCubic,
    outQt: ease.outQuart,
    ioQt: ease.inOutQuart,
    outX: ease.outExpo,
    outB: ease.outBack,
    inB: (u, s = 1.70158) => {
      const x = clamp(u, 0, 1);
      return (s + 1) * x * x * x - s * x * x;
    },
    pop: ease.pop,
  };

  /**
   * Closed-form damped spring (0 -> 1).
   * Supports both (t, f = 2, z = 0.4) from aetheria-motion AND (t, { stiffness, damping, mass }).
   */
  function spring(t, fOrOpts = 2, z = 0.4) {
    if (t <= 0) return 0;
    if (typeof fOrOpts === "number") {
      const f = fOrOpts;
      const zeta = clamp(z, 0.01, 0.999);
      const w = 2 * Math.PI * f;
      const a = zeta * w;
      const b = w * Math.sqrt(1 - zeta * zeta);
      return 1 - Math.exp(-a * t) * (Math.cos(b * t) + (a / b) * Math.sin(b * t));
    }
    const opts = fOrOpts || {};
    const stiffness = opts.stiffness || 220;
    const damping = opts.damping || 16;
    const mass = opts.mass || 1;
    const w0 = Math.sqrt(stiffness / mass);
    const zeta = damping / (2 * Math.sqrt(stiffness * mass));
    if (zeta < 1) {
      const wd = w0 * Math.sqrt(1 - zeta * zeta);
      return (
        1 -
        Math.exp(-zeta * w0 * t) *
          (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t))
      );
    }
    return 1 - (1 + w0 * t) * Math.exp(-w0 * t);
  }

  /**
   * Closed-form derivative (velocity) of damped spring (f in Hz, damping ratio z).
   */
  function springV(t, f = 2, z = 0.4) {
    if (t <= 0) return 0;
    const zeta = clamp(z, 0.01, 0.999);
    const w = 2 * Math.PI * f;
    const a = zeta * w;
    const b = w * Math.sqrt(1 - zeta * zeta);
    return Math.exp(-a * t) * ((w * w) / b) * Math.sin(b * t);
  }

  /**
   * Damped impulse wave (0 -> peak -> 0) starting at t0.
   * Ideal for camera impact shake, head nod, hair bounce, and landing thuds.
   */
  function kick(t, t0 = 0, f = 3, z = 0.35) {
    if (t <= t0) return 0;
    const zeta = clamp(z, 0.01, 0.999);
    const w = 2 * Math.PI * f;
    const tt = t - t0;
    return Math.exp(-zeta * w * tt) * Math.sin(w * Math.sqrt(1 - zeta * zeta) * tt);
  }

  /**
   * Spring pop with automatic velocity-driven squash & stretch [s, k].
   * Residual is pinned to [1, 0] after `pin` seconds so there is zero sub-pixel drift under camera zoom.
   */
  function pop(t, t0 = 0, f = 2.4, z = 0.42, amt = 0.12, pin = 0.9) {
    const tt = t - t0;
    let s = spring(tt, f, z);
    let k = clamp((springV(tt, f, z) / (2 * Math.PI * f)) * amt * 2, -0.3, 0.3);
    const w = E.ioQ(invLerp(pin * 0.7, pin, tt));
    s = lerp(s, 1, w);
    k = lerp(k, 0, w);
    return [s, k];
  }

  /**
   * Parabolic arc 0 -> 1 -> 0 for u in [0, 1].
   */
  function hump(u) {
    const x = clamp(u, 0, 1);
    return 4 * x * (1 - x);
  }

  /**
   * Frame-quantized selective shutter so flat wipe edges stay razor-sharp.
   */
  function crisp(t, k = 0.08, fps = 30) {
    const f0 = Math.round(t * fps) / fps;
    return f0 + (t - f0) * k;
  }

  /**
   * Quadratic Bezier jump arc between P0 and P1 with apex height H.
   */
  function arcP(P0, P1, H, q) {
    const u = clamp(q, 0, 1);
    const cx = (P0.x + P1.x) / 2;
    const cy = Math.min(P0.y, P1.y) - H;
    return {
      x: (1 - u) * (1 - u) * P0.x + 2 * (1 - u) * u * cx + u * u * P1.x,
      y: (1 - u) * (1 - u) * P0.y + 2 * (1 - u) * u * cy + u * u * P1.y,
    };
  }

  function anticipation(p, dip = 0.12) {
    const x = clamp(p, 0, 1);
    if (x < 0.18) {
      const u = x / 0.18;
      return -dip * Math.sin(u * Math.PI);
    }
    const u = (x - 0.18) / 0.82;
    return ease.outBack(u, 1.85);
  }

  function stagger(t, index, startTime = 0, stepDelay = 0.08, duration = 0.45, easeFn) {
    const local = (t - (startTime + index * stepDelay)) / Math.max(0.001, duration);
    const u = clamp(local, 0, 1);
    return typeof easeFn === "function" ? easeFn(u) : ease.outBack(u);
  }

  function squashStretch(v, amount = 0.12) {
    const stretch = 1 + clamp(v, -1, 1) * amount;
    const squash = 1 / Math.max(0.5, stretch);
    return { scaleX: squash, scaleY: stretch };
  }

  // ============================================================================
  // 3B. SVG Scene-Graph & Accent Primitives (from 01-flat-vector)
  // ============================================================================
  const SVG_NS = "http://www.w3.org/2000/svg";
  const f3 = (v) => Math.round(v * 1000) / 1000;

  function el(tag, attrs, parent) {
    if (typeof document === "undefined") return null;
    const node = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      for (const k in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, k)) {
          node.setAttribute(k, attrs[k]);
        }
      }
    }
    if (parent) parent.appendChild(node);
    return node;
  }

  function G(parent, attrs) {
    return el("g", attrs, parent);
  }

  function tf(node, x, y, sx = 1, sy = sx, r = 0) {
    if (!node) return;
    if (Math.abs(sx) < 1e-4 || Math.abs(sy) < 1e-4) {
      sx = 0;
      sy = 0;
    }
    node.setAttribute(
      "transform",
      `translate(${f3(x)} ${f3(y)}) rotate(${f3(r)}) scale(${sx.toFixed(5)} ${sy.toFixed(5)})`
    );
  }

  function vis(node, visible) {
    if (!node || !node.style) return;
    node.style.display = visible ? "" : "none";
  }

  function burstLine(ln, cx, cy, a, r0, r1, t, t0, dur = 10 / 30) {
    const h = E.outC(invLerp(t0, t0 + dur * 0.7, t));
    const tl = E.outC(invLerp(t0 + dur * 0.3, t0 + dur, t));
    if (t < t0 || tl >= 1) {
      vis(ln, false);
      return;
    }
    vis(ln, true);
    const ra = lerp(r0, r1, tl);
    const rb = lerp(r0, r1, h);
    ln.setAttribute("x1", cx + Math.cos(a) * ra);
    ln.setAttribute("y1", cy + Math.sin(a) * ra);
    ln.setAttribute("x2", cx + Math.cos(a) * rb);
    ln.setAttribute("y2", cy + Math.sin(a) * rb);
  }

  function ring(c, t, t0, r0, r1, w0, dur = 12 / 30) {
    const u = invLerp(t0, t0 + dur, t);
    if (t < t0 || u >= 1) {
      vis(c, false);
      return;
    }
    vis(c, true);
    const w = w0 * Math.pow(1 - u, 1.15);
    if (w < 1.5) {
      vis(c, false);
      return;
    }
    c.setAttribute("r", lerp(r0, r1, E.outQ(u)));
    c.setAttribute("stroke-width", w);
  }

  function mixHex(a, b, k) {
    const parse = (h) => [1, 3, 5].map((i) => parseInt(String(h || "#000000").slice(i, i + 2), 16) || 0);
    const A = parse(a);
    const B = parse(b);
    return (
      "#" +
      A.map((v, i) => Math.round(v + (B[i] - v) * clamp(k, 0, 1)).toString(16).padStart(2, "0")).join("")
    );
  }

  /**
   * Canvas 2D equivalent of burstLine(): draws radial impact lines whose head shoots out and tail chases.
   */
  function drawBurstLines(ctx, cx, cy, count, r0, r1, t, t0, dur = 0.35, color = "#FFC62B", lineWidth = 8) {
    const h = E.outC(invLerp(t0, t0 + dur * 0.7, t));
    const tl = E.outC(invLerp(t0 + dur * 0.3, t0 + dur, t));
    if (t < t0 || tl >= 1) return;
    const ra = lerp(r0, r1, tl);
    const rb = lerp(r0, r1, h);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * ra, cy + Math.sin(a) * ra);
      ctx.lineTo(cx + Math.cos(a) * rb, cy + Math.sin(a) * rb);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Canvas 2D equivalent of ring(): draws an expanding shockwave ring whose stroke-width thins to 0.
   */
  function drawShockRing(ctx, cx, cy, t, t0, r0, r1, w0 = 16, dur = 0.4, color = "#FF5A4E") {
    const u = invLerp(t0, t0 + dur, t);
    if (t < t0 || u >= 1) return;
    const w = w0 * Math.pow(1 - u, 1.15);
    if (w < 1.2) return;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, lerp(r0, r1, E.outQ(u)), 0, TAU);
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.stroke();
    ctx.restore();
  }

  // ============================================================================
  // 4. Modular Scene Registry & Multi-Scene Timeline Router
  // ============================================================================

  /**
   * Registers a modular scene renderer function from `workspace/script/sceneN.js`.
   * Resilient to naming variations (`"scene1_hook"`, `"scene1"`, `1`, `0`).
   */
  function registerScene(idOrIndex, renderFn) {
    if (typeof renderFn !== "function") return;
    const key = String(idOrIndex).trim();
    SCENE_REGISTRY[key] = renderFn;
    const m = key.match(/^scene[_-]?(\d+)/i);
    if (m) {
      const num = Number(m[1]);
      if (!SCENE_REGISTRY[`scene${num}`]) SCENE_REGISTRY[`scene${num}`] = renderFn;
      if (!SCENE_REGISTRY[String(num - 1)]) SCENE_REGISTRY[String(num - 1)] = renderFn;
    }
  }

  function getSceneRenderer(sceneId, index) {
    if (sceneId && SCENE_REGISTRY[sceneId]) return SCENE_REGISTRY[sceneId];
    const byOneBased = SCENE_REGISTRY[`scene${index + 1}`];
    if (byOneBased) return byOneBased;
    const byZeroIndex = SCENE_REGISTRY[String(index)];
    if (byZeroIndex) return byZeroIndex;
    if (sceneId) {
      const prefixKey = Object.keys(SCENE_REGISTRY).find(
        (k) => sceneId.startsWith(k) || k.startsWith(`scene${index + 1}`)
      );
      if (prefixKey) return SCENE_REGISTRY[prefixKey];
    }
    return null;
  }

  function resolveScene(t, scenes) {
    if (!Array.isArray(scenes) || scenes.length === 0) {
      return { scene: null, index: 0, localTime: t, duration: 10, progress: clamp(t / 10, 0, 1) };
    }
    let cursor = 0;
    for (let i = 0; i < scenes.length; i++) {
      const s = scenes[i];
      const start = typeof s.start === "number" ? s.start : cursor;
      const dur =
        typeof s.duration === "number"
          ? s.duration
          : typeof s.end === "number"
          ? s.end - start
          : 5;
      const end = start + dur;
      cursor = end;
      if (t < end || i === scenes.length - 1) {
        const localTime = clamp(t - start, 0, dur);
        return {
          scene: s,
          index: i,
          start,
          end,
          duration: dur,
          localTime,
          progress: dur > 0 ? clamp(localTime / dur, 0, 1) : 0,
        };
      }
    }
    const last = scenes[scenes.length - 1];
    return { scene: last, index: scenes.length - 1, localTime: 0, duration: 1, progress: 1 };
  }

  // ============================================================================
  // 5. Studio Canvas Drawing Primitives & Shared Layout Zones
  // ============================================================================

  function roundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function hexAlpha(hex, alpha) {
    const clean = String(hex || "#FFC62B").replace("#", "");
    const r = parseInt(clean.substring(0, 2), 16) || 255;
    const g = parseInt(clean.substring(2, 4), 16) || 200;
    const b = parseInt(clean.substring(4, 6), 16) || 50;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function drawGridBackdrop(ctx, t, accentColor, bgTop, bgBottom, W = 1080, H = 1920) {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, bgTop || "#131836");
    grad.addColorStop(1, bgBottom || "#090D1A");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    ctx.lineWidth = 1;
    const step = 90;
    const offset = (t * 18) % step;
    for (let x = 0; x <= W; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = -step + offset; y <= H; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    const rad = ctx.createRadialGradient(W / 2, 720, 40, W / 2, 720, 520);
    rad.addColorStop(0, hexAlpha(accentColor, 0.22));
    rad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rad;
    ctx.fillRect(0, 180, W, 1080);
    ctx.restore();
  }

  function drawTopHeader(ctx, scene, localTimeOrIdx, globalTime) {
    const lt = typeof localTimeOrIdx === "number" ? localTimeOrIdx : 0.5;
    const gt = typeof globalTime === "number" ? globalTime : lt;
    const enter = spring(lt + 0.25, { stiffness: 240, damping: 18 });
    const accent = scene.accent || "#FFC62B";
    const secondary = scene.secondary || "#38BDF8";
    ctx.save();
    ctx.translate(0, (1 - enter) * -60);

    roundRect(ctx, 64, 72, 260, 54, 27);
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#151433";
    ctx.stroke();

    ctx.font = "800 22px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#151433";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(scene.code || scene.tag || `SCENE ${scene.index || scene.id || ""}`, 64 + 130, 99);

    roundRect(ctx, 344, 72, 672, 54, 27);
    ctx.fillStyle = "rgba(21, 20, 51, 0.85)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = hexAlpha(accent, 0.55);
    ctx.stroke();

    ctx.font = "700 21px 'Inter', sans-serif";
    ctx.fillStyle = "#FFF6E9";
    ctx.textAlign = "left";
    ctx.fillText(scene.era || scene.title || scene.headline || "", 374, 99);

    const pulse = 0.5 + 0.5 * Math.sin(gt * 6);
    ctx.beginPath();
    ctx.arc(976, 99, 8 + pulse * 3, 0, TAU);
    ctx.fillStyle = secondary;
    ctx.fill();
    ctx.restore();
  }

  function drawHeadlinePlaque(ctx, scene, localTime) {
    const pop = spring(Math.max(0.05, localTime + 0.15), { stiffness: 210, damping: 17 });
    const accent = scene.accent || "#FFC62B";
    ctx.save();
    ctx.translate(540, 1285);
    ctx.scale(0.85 + 0.15 * pop, 0.85 + 0.15 * pop);

    const cardW = 952;
    const cardH = 196;
    ctx.fillStyle = "#07070E";
    roundRect(ctx, -cardW / 2 + 10, -cardH / 2 + 12, cardW, cardH, 26);
    ctx.fill();

    ctx.fillStyle = "#151433";
    roundRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, 26);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = accent;
    ctx.stroke();

    ctx.fillStyle = accent;
    roundRect(ctx, -cardW / 2 + 28, -cardH / 2 + 20, 180, 10, 5);
    ctx.fill();

    const mainTitle = scene.headline || scene.title || "";
    const subTitle = scene.subheadline || scene.subtitle || "";

    ctx.font = "900 42px 'Inter', sans-serif";
    ctx.fillStyle = "#FFF6E9";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(mainTitle, 0, -18);

    if (subTitle) {
      ctx.font = "600 25px 'Inter', sans-serif";
      ctx.fillStyle = "#CBD5E1";
      ctx.fillText(subTitle, 0, 42);
    }

    ctx.restore();
  }

  function drawElectricBolt(ctx, x1, y1, x2, y2, segments, jitterAmp, seed, color, width) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    for (let i = 1; i < segments; i++) {
      const u = i / segments;
      const bx = lerp(x1, x2, u);
      const by = lerp(y1, y2, u);
      const nx = -(y2 - y1);
      const ny = x2 - x1;
      const len = Math.hypot(nx, ny) || 1;
      const n = noise1D(i * 2.3 + seed * 11.7, seed) * jitterAmp;
      ctx.lineTo(bx + (nx / len) * n, by + (ny / len) * n);
    }
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color || "#38BDF8";
    ctx.lineWidth = width || 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = color || "#38BDF8";
    ctx.shadowBlur = 18;
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Applies a 2D studio camera transform (zoom `s`, focus center `cx`, `cy`, rotation `rot`) on Canvas 2D.
   */
  function applyCamera(ctx, cam, W = 1080, H = 1920) {
    if (!ctx || !cam) return;
    const s = typeof cam.s === "number" ? cam.s : 1;
    const cx = typeof cam.cx === "number" ? cam.cx : W / 2;
    const cy = typeof cam.cy === "number" ? cam.cy : H / 2;
    const rot = ((cam.rot || 0) * Math.PI) / 180;
    ctx.translate(W / 2, H / 2);
    if (rot !== 0) ctx.rotate(rot);
    ctx.scale(s, s);
    ctx.translate(-cx, -cy);
  }

  /**
   * Multi-layer Flat-Vector Shape Wipe transition (from 01-flat-vector W1 -> W2 -> W3):
   * Layer 1: Expanding circle from (originX, originY)
   * Layer 2: Rotating capsule sweep
   * Layer 3: Slamming half-disc with kick overshoot
   */
  function drawShapeWipe(ctx, t, tStart, dur = 0.65, colors, originX = 540, originY = 660, W = 1080, H = 1920) {
    const tc = crisp(t, 0.08);
    if (tc < tStart || tc > tStart + dur + 0.35) return;
    const palette = Array.isArray(colors) && colors.length >= 3 ? colors : ["#FF5A4E", "#2EE6A8", "#FFF6E9"];

    // W1: Expanding circle
    const u1 = invLerp(tStart, tStart + dur * 0.55, tc);
    if (u1 > 0 && u1 < 1) {
      const r1 = 48 * Math.exp(lerp(Math.log(1), Math.log(48), E.ioQ(u1)));
      ctx.save();
      ctx.fillStyle = palette[0];
      ctx.beginPath();
      ctx.arc(lerp(originX, W / 2, u1), lerp(originY, H / 2, u1), r1, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // W2: Rotating capsule
    const t2 = tStart + dur * 0.22;
    const u2 = invLerp(t2, t2 + dur * 0.55, tc);
    if (u2 > 0 && u2 < 1) {
      const k = Math.exp(lerp(Math.log(0.04), Math.log(1.35), E.ioQ(u2)));
      ctx.save();
      ctx.translate(lerp(originX, W / 2, E.outQ(u2)), lerp(originY, H / 2, E.outQ(u2)));
      ctx.rotate(((25 * (1 - E.outB(u2, 1.6))) * Math.PI) / 180);
      ctx.scale(k, k);
      ctx.fillStyle = palette[1];
      roundRect(ctx, -1200, -900, 2400, 1800, 900);
      ctx.fill();
      ctx.restore();
    }

    // W3: Half-disc slam with kick
    const t3 = tStart + dur * 0.45;
    const sl = tStart + dur * 0.85;
    const u3 = invLerp(t3, sl, tc);
    if (u3 > 0 && tc < sl + 0.25) {
      const kk = kick(tc, sl, 3.5, 0.4);
      const fadeOut = 1 - invLerp(sl + 0.05, sl + 0.25, tc);
      ctx.save();
      ctx.globalAlpha = fadeOut;
      ctx.translate(W / 2, H / 2 - 2200 * (1 - E.inQ(u3)) + 40 * kk);
      ctx.rotate(((7 * (1 - u3)) * Math.PI) / 180);
      ctx.scale(1, 1 - 0.06 * kk);
      ctx.fillStyle = palette[2];
      ctx.beginPath();
      ctx.arc(0, 0, 1700, Math.PI, 0, false);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  /**
   * Articulated Flat-Vector Character Rig (from 01-flat-vector CH -> neck -> head -> eyes/brows/mouth + shoulders/elbows/hands).
   * Gives any scene an expressive living character with automatic breathing, blinking, head nod, and reaching arms.
   */
  function drawCharacterRig(ctx, t, opts = {}) {
    const x = opts.x !== undefined ? opts.x : 540;
    const y = opts.y !== undefined ? opts.y : 780;
    const scale = opts.scale !== undefined ? opts.scale : 1;
    const coatColor = opts.coatColor || "#2EE6A8";
    const coatShade = opts.coatShade || "#1FC28C";
    const skinColor = opts.skinColor || "#FFB48C";
    const hairColor = opts.hairColor || "#151433";
    const reactTime = opts.reactTime !== undefined ? opts.reactTime : 1.8;
    const reachTime = opts.reachTime !== undefined ? opts.reachTime : 2.4;

    const [enterS, enterK] = pop(t + 0.25, 0, 2.4, 0.42, 0.18);
    const hs = pop(t, reactTime, 2.6, 0.35, 0, 1.4)[0];
    const lean = 3.5 * pop(t, reactTime, 2.0, 0.4)[0];
    const nod = 6 * Math.pow(1 - Math.abs(Math.sin(TAU * t)), 4);
    const blink = Math.max(
      hump(invLerp(1.1, 1.24, t % 3.2)),
      hump(invLerp(reactTime - 0.1, reactTime + 0.05, t))
    );
    const rch = E.outB(invLerp(reachTime, reachTime + 0.35, t), 1.8);
    const surprised = t > reactTime && t < reachTime + 0.35;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(( scale * enterS) / (1 + enterK), scale * enterS * (1 + enterK));
    ctx.rotate((lean * Math.PI) / 180);

    // Torso
    ctx.fillStyle = coatColor;
    roundRect(ctx, -170, -200, 340, 280, 85);
    ctx.fill();
    ctx.fillStyle = coatShade;
    roundRect(ctx, 90, -195, 80, 275, 40);
    ctx.fill();

    // Collar V-neck
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.moveTo(-36, -200);
    ctx.lineTo(0, -152);
    ctx.lineTo(36, -200);
    ctx.closePath();
    ctx.fill();

    // Left Arm (Shoulder -> Upper -> Forearm -> Hand)
    ctx.save();
    ctx.translate(-142, -148);
    ctx.rotate(((14 + 3 * Math.sin(t * 5.5)) * Math.PI) / 180);
    ctx.strokeStyle = coatShade;
    ctx.lineWidth = 56;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 112);
    ctx.stroke();
    ctx.translate(0, 112);
    ctx.rotate(((-92 + 7 * Math.sin(t * 5.5)) * Math.PI) / 180);
    ctx.strokeStyle = skinColor;
    ctx.lineWidth = 38;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 96);
    ctx.stroke();
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.arc(0, 102, 24, 0, TAU);
    ctx.fill();
    ctx.restore();

    // Right Arm (Reaches out on reachTime)
    ctx.save();
    ctx.translate(142, -148);
    const shAngle = lerp(-14 + 3 * Math.sin(t * 5.5 + 2), -78, rch);
    ctx.rotate((shAngle * Math.PI) / 180);
    ctx.strokeStyle = coatShade;
    ctx.lineWidth = 56;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 112);
    ctx.stroke();
    ctx.translate(0, 112);
    const foAngle = lerp(92 + 7 * Math.sin(t * 5.5 + 2), 14, rch);
    ctx.rotate((foAngle * Math.PI) / 180);
    ctx.strokeStyle = skinColor;
    ctx.lineWidth = 38;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 96);
    ctx.stroke();
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.arc(0, 102, 24, 0, TAU);
    ctx.fill();
    ctx.restore();

    // Neck & Head Group
    ctx.save();
    const hr = 10 * Math.max(hs, 0) * (t > reactTime ? 1 : 0);
    ctx.translate(8 * hs * (t > reactTime ? 1 : 0), -200 + nod * 0.4);
    ctx.rotate(((hr * 0.35) * Math.PI) / 180);
    ctx.fillStyle = skinColor;
    ctx.fillRect(-25, -40, 50, 56);

    ctx.translate(0, -86 + nod);
    ctx.rotate(((hr * 0.65) * Math.PI) / 180);

    // Ears & Head base
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.arc(-90, 12, 18, 0, TAU);
    ctx.arc(90, 12, 18, 0, TAU);
    ctx.arc(0, 0, 94, 0, TAU);
    ctx.fill();

    // Hair bun with secondary follow-through kick
    ctx.save();
    const bunRot = -8 * kick(t, reactTime, 2.4, 0.3);
    ctx.rotate((bunRot * Math.PI) / 180);
    ctx.fillStyle = hairColor;
    ctx.beginPath();
    ctx.arc(34, -116, 36, 0, TAU);
    ctx.fill();
    ctx.restore();

    // Hair cap
    ctx.fillStyle = hairColor;
    ctx.beginPath();
    ctx.arc(0, -14, 96, Math.PI * 1.05, Math.PI * 1.95);
    ctx.fill();

    // Cheek blush
    ctx.fillStyle = "#FF8C82";
    ctx.beginPath();
    ctx.arc(-52, 38, 13, 0, TAU);
    ctx.arc(52, 38, 13, 0, TAU);
    ctx.fill();

    // Eyes with blink & look shift
    const look = t > reactTime ? 8 * hs : 0;
    const eyeRy = Math.max(1.5, 12 * (1 - 0.9 * blink));
    ctx.fillStyle = hairColor;
    [-34, 34].forEach((ex) => {
      ctx.beginPath();
      ctx.ellipse(ex + look, 10, 9, eyeRy, 0, 0, TAU);
      ctx.fill();
    });

    // Glasses
    ctx.strokeStyle = hairColor;
    ctx.lineWidth = 6;
    [-34, 34].forEach((gx) => {
      ctx.beginPath();
      ctx.arc(gx, 10, 27, 0, TAU);
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.moveTo(-7, 6);
    ctx.quadraticCurveTo(0, 0, 7, 6);
    ctx.stroke();

    // Eyebrows
    const browLift = t > reactTime ? -10 * hs : 0;
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    [-1, 1].forEach((s) => {
      ctx.beginPath();
      ctx.moveTo(s * 20, -28 + browLift);
      ctx.lineTo(s * 46, -24 + browLift);
      ctx.stroke();
    });

    // Mouth (Smile vs Surprised O-mouth)
    if (surprised) {
      ctx.fillStyle = hairColor;
      ctx.beginPath();
      ctx.ellipse(look * 0.5, 52, 10, 13, 0, 0, TAU);
      ctx.fill();
    } else {
      ctx.strokeStyle = hairColor;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-18 + look * 0.5, 45);
      ctx.quadraticCurveTo(look * 0.5, 59, 18 + look * 0.5, 45);
      ctx.stroke();
    }

    ctx.restore();
    ctx.restore();
  }

  // ============================================================================
  // 6. Kinetic Subtitles (Canvas 2D & SVG) synced with Voicebox .words.json
  // ============================================================================

  function drawSubtitles(ctx, words, localTime, opts) {
    if (!ctx || !Array.isArray(words) || words.length === 0) return;
    const normalizedOpts =
      typeof opts === "string" ? { activeColor: opts } : opts || {};
    const options = Object.assign(
      {
        x: 540,
        y: 1600,
        maxWidth: 920,
        wordsPerGroup: 5,
        fontSize: 56,
        fontFamily: "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif",
        activeColor: "#FFDE59",
        pastColor: "#FFFFFF",
        upcomingColor: "rgba(255,255,255,0.6)",
        bgColor: "rgba(12, 12, 20, 0.86)",
        borderColor: "rgba(255, 255, 255, 0.14)",
      },
      normalizedOpts
    );

    let activeIdx = -1;
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (localTime >= w.start && localTime <= w.end + 0.18) {
        activeIdx = i;
        break;
      }
      if (localTime >= w.start) {
        activeIdx = i;
      }
    }
    if (activeIdx < 0) return;

    const lastWord = words[words.length - 1];
    if (localTime > (lastWord.end || 0) + 0.6) return;

    const groupIndex = Math.floor(activeIdx / options.wordsPerGroup);
    const startIdx = groupIndex * options.wordsPerGroup;
    const chunk = words.slice(startIdx, startIdx + options.wordsPerGroup);
    if (!chunk.length) return;

    ctx.save();
    ctx.font = `800 ${options.fontSize}px ${options.fontFamily}`;
    ctx.textBaseline = "middle";

    const spaceW = options.fontSize * 0.34;
    const metrics = chunk.map((w) => ({
      text: String(w.word || "").trim(),
      width: ctx.measureText(String(w.word || "").trim()).width,
      start: w.start,
      end: w.end,
    }));

    const lines = [];
    let currentLine = [];
    let currentW = 0;
    for (let i = 0; i < metrics.length; i++) {
      const m = metrics[i];
      const nextW = currentLine.length === 0 ? m.width : currentW + spaceW + m.width;
      if (nextW > options.maxWidth && currentLine.length > 0) {
        lines.push({ items: currentLine, width: currentW });
        currentLine = [{ ...m, globalIdx: startIdx + i }];
        currentW = m.width;
      } else {
        currentLine.push({ ...m, globalIdx: startIdx + i });
        currentW = nextW;
      }
    }
    if (currentLine.length > 0) {
      lines.push({ items: currentLine, width: currentW });
    }

    const lineH = options.fontSize * 1.32;
    const totalH = lines.length * lineH;
    const maxLineW = Math.max(...lines.map((l) => l.width), 160);
    const padX = 36;
    const padY = 24;
    const boxW = Math.min(options.maxWidth + padX * 2, maxLineW + padX * 2);
    const boxH = totalH + padY * 2;
    const boxX = options.x - boxW / 2;
    const boxY = options.y - boxH / 2;

    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    roundRect(ctx, boxX + 6, boxY + 8, boxW, boxH, 22);
    ctx.fill();

    ctx.fillStyle = options.bgColor;
    roundRect(ctx, boxX, boxY, boxW, boxH, 22);
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.strokeStyle = options.borderColor;
    ctx.stroke();

    lines.forEach((line, lineIdx) => {
      let cursorX = options.x - line.width / 2;
      const lineY = boxY + padY + lineH * (lineIdx + 0.5);

      line.items.forEach((item) => {
        const isCurrent = item.globalIdx === activeIdx;
        const isPast = item.globalIdx < activeIdx;
        const wordElapsed = Math.max(0, localTime - item.start);
        const popScale = isCurrent ? 1 + 0.14 * Math.exp(-wordElapsed * 10) * Math.sin(wordElapsed * 24) : 1;

        ctx.save();
        const wordCenterX = cursorX + item.width / 2;
        ctx.translate(wordCenterX, lineY);
        ctx.scale(popScale, popScale);

        if (isCurrent) {
          ctx.fillStyle = "rgba(255, 222, 89, 0.18)";
          roundRect(ctx, -item.width / 2 - 10, -options.fontSize * 0.56, item.width + 20, options.fontSize * 1.12, 12);
          ctx.fill();
        }

        ctx.font = `800 ${options.fontSize}px ${options.fontFamily}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillText(item.text, 2, 3);

        ctx.fillStyle = isCurrent
          ? options.activeColor
          : isPast
          ? options.pastColor
          : options.upcomingColor;
        ctx.fillText(item.text, 0, 0);
        ctx.restore();

        cursorX += item.width + spaceW;
      });
    });

    ctx.restore();
  }

  const API = {
    TAU,
    clamp,
    lerp,
    invLerp,
    inv: invLerp,
    remap,
    smoothstep,
    rand,
    rng,
    noise1D,
    noise2D,
    bezier,
    ease,
    E,
    spring,
    springV,
    kick,
    pop,
    hump,
    crisp,
    arcP,
    anticipation,
    stagger,
    squashStretch,
    f3,
    el,
    G,
    tf,
    vis,
    burstLine,
    ring,
    mixHex,
    drawBurstLines,
    drawShockRing,
    applyCamera,
    drawShapeWipe,
    drawCharacterRig,
    registerScene,
    getSceneRenderer,
    resolveScene,
    roundRect,
    hexAlpha,
    drawGridBackdrop,
    drawTopHeader,
    drawHeadlinePlaque,
    drawElectricBolt,
    drawSubtitles,
  };

  global.AetheriaMotion = API;
  global.AM = API;
})(typeof window !== "undefined" ? window : globalThis);

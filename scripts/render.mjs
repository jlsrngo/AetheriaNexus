import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { bundle } from "@remotion/bundler";
import { getCompositions, openBrowser, renderMedia } from "@remotion/renderer";

function resolveBundledFfmpeg() {
  const candidates = [
    path.resolve(process.cwd(), "node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe"),
    path.resolve(process.cwd(), "node_modules/@remotion/compositor-linux-x64-gnu/ffmpeg"),
    path.resolve(process.cwd(), "node_modules/@remotion/compositor-linux-arm64-gnu/ffmpeg"),
    path.resolve(process.cwd(), "node_modules/@remotion/compositor-darwin-arm64/ffmpeg"),
    path.resolve(process.cwd(), "node_modules/@remotion/compositor-darwin-x64/ffmpeg"),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

// Bridge between the Rust backend and the Remotion engine. Rust computes the bundle stamp,
// multi-core concurrency, codec, frame range, and browser executable path; this script
// only executes Remotion with those pre-computed parameters.
const emit = (payload) => console.log(JSON.stringify(payload));

function parseArgs(argv) {
  const parsed = {
    props: "{}",
    output: "",
    composition: "",
    entry: "",
    bundleDir: "",
    bundleStamp: "",
    concurrency: "4",
    codec: "h264",
    frames: "",
    browser: "",
    shards: "",
  };
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i + 1];
    if (value === undefined) break;
    if (argv[i] === "--props") parsed.props = value;
    else if (argv[i] === "--output") parsed.output = value;
    else if (argv[i] === "--composition") parsed.composition = value;
    else if (argv[i] === "--entry") parsed.entry = value;
    else if (argv[i] === "--bundle-dir") parsed.bundleDir = value;
    else if (argv[i] === "--bundle-stamp") parsed.bundleStamp = value;
    else if (argv[i] === "--concurrency") parsed.concurrency = value;
    else if (argv[i] === "--shards") parsed.shards = value;
    else if (argv[i] === "--codec") parsed.codec = value;
    else if (argv[i] === "--frames") parsed.frames = value;
    else if (argv[i] === "--browser-executable") parsed.browser = value;
    else continue;
    i++;
  }
  return parsed;
}

async function resolveServeUrl(entryPoint, bundleDir, rustStamp) {
  const publicDirCandidates = [
    path.resolve(process.cwd(), "workspace/public"),
    path.resolve(process.cwd(), "apps/public"),
    path.resolve(process.cwd(), "public"),
  ];
  const publicDir = publicDirCandidates.find((p) => fs.existsSync(p));

  if (!bundleDir) {
    emit({ type: "status", message: `Bundling ${path.basename(entryPoint)}...` });
    return await bundle({ entryPoint, ...(publicDir ? { publicDir } : {}) });
  }

  const stampFile = path.join(bundleDir, ".stamp");
  const stamp = rustStamp || String(fs.statSync(entryPoint).mtimeMs);
  const cached =
    fs.existsSync(path.join(bundleDir, "index.html")) &&
    fs.existsSync(stampFile) &&
    fs.readFileSync(stampFile, "utf8") === stamp &&
    (!publicDir || fs.existsSync(path.join(bundleDir, "public")));

  if (cached) {
    emit({ type: "status", message: "Reusing Rust-verified cached bundle..." });
    return bundleDir;
  }

  emit({ type: "status", message: `Bundling ${path.basename(entryPoint)}...` });
  const serveUrl = await bundle({ entryPoint, outDir: bundleDir, ...(publicDir ? { publicDir } : {}) });
  fs.writeFileSync(stampFile, stamp);
  return serveUrl;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  let inputProps = {};
  try {
    inputProps = JSON.parse(args.props);
  } catch (err) {
    emit({ type: "status", message: `Invalid props JSON (${err.message}), falling back to defaultProps` });
  }

  let outputLocation = args.output;
  if (!outputLocation) {
    const outputDir = path.resolve(process.cwd(), "output");
    fs.mkdirSync(outputDir, { recursive: true });
    outputLocation = path.join(outputDir, `nexus-${Date.now()}.mp4`);
  } else {
    fs.mkdirSync(path.dirname(path.resolve(outputLocation)), { recursive: true });
  }

  const workspaceEntryCandidates = [
    path.resolve(process.cwd(), "workspace/src/entry.ts"),
    path.resolve(process.cwd(), "workspace/src/index.ts"),
    path.resolve(process.cwd(), "workspace/entry.ts"),
  ];
  const detectedWorkspaceEntry = workspaceEntryCandidates.find((p) => fs.existsSync(p));
  const entryPoint = args.entry
    ? path.resolve(args.entry)
    : detectedWorkspaceEntry || path.resolve(process.cwd(), "apps/src/remotion/entry.ts");

  if (!fs.existsSync(entryPoint)) {
    throw new Error(`Remotion entry point not found: ${entryPoint}`);
  }

  const detectedBrowser = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].find((p) => fs.existsSync(p));

  const browserExecutable = args.browser || detectedBrowser || null;
  const concurrency = Math.max(1, Math.min(16, Number.parseInt(args.concurrency, 10) || 4));
  const validCodecs = ["h264", "h265", "vp8", "vp9", "gif", "prores"];
  const codec = validCodecs.includes(args.codec) ? args.codec : "h264";

  let frameRange = undefined;
  if (args.frames && args.frames.includes("-")) {
    const [s, e] = args.frames.split("-").map((n) => Number.parseInt(n, 10));
    if (!Number.isNaN(s) && !Number.isNaN(e) && e >= s) {
      frameRange = [s, e];
    }
  }

  emit({
    type: "status",
    message: browserExecutable
      ? `Browser: ${path.basename(browserExecutable)} (${concurrency} threads, ${codec})`
      : "No local browser found, Remotion may download one",
  });

  const serveUrl = await resolveServeUrl(
    entryPoint,
    args.bundleDir ? path.resolve(args.bundleDir) : "",
    args.bundleStamp,
  );

  const puppeteerInstance = await openBrowser("chrome", {
    browserExecutable,
    chromiumOptions: {
      gl: "angle",
    },
  });

  try {
    const compositions = await getCompositions(serveUrl, {
      inputProps,
      browserExecutable,
      puppeteerInstance,
    });
    const composition = args.composition
      ? compositions.find((c) => c.id === args.composition)
      : compositions[0];

    if (!composition) {
      const available = compositions.map((c) => c.id).join(", ") || "(none)";
      throw new Error(`Composition "${args.composition}" not found in Root.tsx. Available compositions: [${available}]`);
    }

    const startFrame = frameRange ? frameRange[0] : 0;
    const endFrame = frameRange ? frameRange[1] : composition.durationInFrames - 1;
    const targetFrames = endFrame - startFrame + 1;
    const ffmpegBin = resolveBundledFfmpeg();
    const explicitShards = args.shards ? Number.parseInt(args.shards, 10) : null;
    // Sweet spot formula: min(4, max(2, floor(concurrency / 2)))
    // Exactly allocates 1 Chromium browser per physical core (caps at 4 to prevent CPU thrashing/RAM exhaustion)
    const shardCount =
      explicitShards && explicitShards >= 1
        ? explicitShards
        : ffmpegBin && codec === "h264" && targetFrames >= 120
          ? Math.min(4, Math.max(2, Math.floor(concurrency / 2)))
          : 1;

    emit({
      type: "status",
      message: `Rendering ${composition.id} (${shardCount} parallel browser shards)...`,
      compositionId: composition.id,
      totalFrames: targetFrames,
      fps: composition.fps,
    });

    if (shardCount > 1) {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-shards-"));
      const extraBrowsers = [];
      try {
        for (let i = 1; i < shardCount; i++) {
          extraBrowsers.push(
            await openBrowser("chrome", {
              browserExecutable,
              chromiumOptions: { gl: "angle" },
            }),
          );
        }
        const allBrowsers = [puppeteerInstance, ...extraBrowsers];
        const perShard = Math.ceil(targetFrames / shardCount);
        const shardProgress = new Array(shardCount).fill(0);
        const shardFiles = new Array(shardCount);

        await Promise.all(
          allBrowsers.map(async (browserInst, idx) => {
            const s = startFrame + idx * perShard;
            const e = Math.min(endFrame, startFrame + (idx + 1) * perShard - 1);
            const shardOut = path.join(tmpDir, `shard-${idx}.mp4`);
            shardFiles[idx] = shardOut;

            await renderMedia({
              composition,
              serveUrl,
              puppeteerInstance: browserInst,
              codec,
              concurrency: 1,
              frameRange: [s, e],
              outputLocation: shardOut,
              inputProps,
              browserExecutable,
              timeoutInMilliseconds: 120000,
              imageFormat: "jpeg",
              jpegQuality: 82,
              x264Preset: "veryfast",
              chromiumOptions: {
                gl: "angle",
              },
              onProgress: ({ renderedFrames }) => {
                shardProgress[idx] = renderedFrames;
                const totalRendered = shardProgress.reduce((a, b) => a + b, 0);
                const percent = Math.min(100, Math.round((totalRendered / targetFrames) * 100));
                emit({
                  type: "progress",
                  percent,
                  renderedFrames: totalRendered,
                  totalFrames: targetFrames,
                });
              },
            });
          }),
        );

        const listPath = path.join(tmpDir, "concat.txt");
        fs.writeFileSync(
          listPath,
          shardFiles.map((f) => `file '${f.replace(/\\/g, "/")}'`).join("\n"),
          "utf8",
        );
        execFileSync(ffmpegBin, [
          "-y",
          "-hide_banner",
          "-loglevel",
          "error",
          "-f",
          "concat",
          "-safe",
          "0",
          "-i",
          listPath,
          "-c",
          "copy",
          path.resolve(outputLocation),
        ]);
      } finally {
        await Promise.all(
          extraBrowsers.map((b) => b.close({ silent: true }).catch(() => {})),
        );
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    } else {
      await renderMedia({
        composition,
        serveUrl,
        puppeteerInstance,
        codec,
        concurrency: Math.min(2, concurrency),
        frameRange,
        outputLocation,
        inputProps,
        browserExecutable,
        timeoutInMilliseconds: 120000,
        imageFormat: "jpeg",
        jpegQuality: 80,
        x264Preset: "ultrafast",
        chromiumOptions: {
          gl: "angle",
        },
        onProgress: ({ renderedFrames }) => {
          const percent = Math.min(100, Math.round((renderedFrames / targetFrames) * 100));
          emit({ type: "progress", percent, renderedFrames, totalFrames: targetFrames });
        },
      });
    }

    emit({ type: "done", compositionId: composition.id, outputPath: outputLocation });
  } finally {
    await puppeteerInstance.close({ silent: true }).catch(() => {});
  }
}

main().catch((err) => {
  emit({ type: "error", error: err.message || String(err) });
  process.exit(1);
});

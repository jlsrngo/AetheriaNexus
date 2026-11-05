import path from "node:path";
import fs from "node:fs";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia } from "@remotion/renderer";

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
    else if (argv[i] === "--codec") parsed.codec = value;
    else if (argv[i] === "--frames") parsed.frames = value;
    else if (argv[i] === "--browser-executable") parsed.browser = value;
    else continue;
    i++;
  }
  return parsed;
}

async function resolveServeUrl(entryPoint, bundleDir, rustStamp) {
  if (!bundleDir) {
    emit({ type: "status", message: `Bundling ${path.basename(entryPoint)}...` });
    return await bundle({ entryPoint });
  }

  const stampFile = path.join(bundleDir, ".stamp");
  const stamp = rustStamp || String(fs.statSync(entryPoint).mtimeMs);
  const cached =
    fs.existsSync(path.join(bundleDir, "index.html")) &&
    fs.existsSync(stampFile) &&
    fs.readFileSync(stampFile, "utf8") === stamp;

  if (cached) {
    emit({ type: "status", message: "Reusing Rust-verified cached bundle..." });
    return bundleDir;
  }

  emit({ type: "status", message: `Bundling ${path.basename(entryPoint)}...` });
  const serveUrl = await bundle({ entryPoint, outDir: bundleDir });
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

  const entryPoint = args.entry
    ? path.resolve(args.entry)
    : path.resolve(process.cwd(), "apps/src/remotion/entry.ts");

  if (!fs.existsSync(entryPoint)) {
    throw new Error(`Remotion entry point not found: ${entryPoint}`);
  }

  const browserExecutable = args.browser || null;
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

  const compositions = await getCompositions(serveUrl, { inputProps, browserExecutable });
  const composition = args.composition
    ? compositions.find((c) => c.id === args.composition) || compositions[0]
    : compositions[0];

  if (!composition) {
    const available = compositions.map((c) => c.id).join(", ") || "(none)";
    throw new Error(`Composition "${args.composition}" not found. Available: ${available}`);
  }

  emit({
    type: "status",
    message: `Rendering ${composition.id}...`,
    compositionId: composition.id,
    totalFrames: composition.durationInFrames,
    fps: composition.fps,
  });

  await renderMedia({
    composition,
    serveUrl,
    codec,
    concurrency,
    frameRange,
    outputLocation,
    inputProps,
    browserExecutable,
    chromiumOptions: {
      gl: "angle",
    },
    onProgress: ({ renderedFrames }) => {
      const percent = Math.min(100, Math.round((renderedFrames / composition.durationInFrames) * 100));
      emit({ type: "progress", percent, renderedFrames, totalFrames: composition.durationInFrames });
    },
  });

  emit({ type: "done", compositionId: composition.id, outputPath: outputLocation });
}

main().catch((err) => {
  emit({ type: "error", error: err.message || String(err) });
  process.exit(1);
});

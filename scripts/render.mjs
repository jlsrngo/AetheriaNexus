import path from "node:path";
import fs from "node:fs";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia } from "@remotion/renderer";

// Bridge between the Rust backend and the Remotion engine. Rust passes every path it
// owns (bundle cache, browser executable); this script only orchestrates Remotion.
// shortcut: apps/src/remotion and this script are not shipped by tauri.conf.json yet,
// so a packaged installer cannot render. Upgrade when packaging is finished.
const emit = (payload) => console.log(JSON.stringify(payload));

function parseArgs(argv) {
  const parsed = {
    props: "{}",
    output: "",
    composition: "",
    entry: "",
    bundleDir: "",
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
    else if (argv[i] === "--browser-executable") parsed.browser = value;
    else continue;
    i++;
  }
  return parsed;
}

function newestMtime(dir) {
  let newest = 0;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    newest = Math.max(newest, stat.isDirectory() ? newestMtime(full) : stat.mtimeMs);
  }
  return newest;
}

async function resolveServeUrl(entryPoint, bundleDir) {
  // shortcut: two renders started at the same time share one bundle dir and can
  // interleave webpack output. Upgrade to a lock file if concurrent renders happen.
  if (!bundleDir) {
    emit({ type: "status", message: `Bundling ${path.basename(entryPoint)}...` });
    return await bundle({ entryPoint });
  }

  const stampFile = path.join(bundleDir, ".stamp");
  const stamp = String(newestMtime(path.dirname(entryPoint)));
  const cached =
    fs.existsSync(path.join(bundleDir, "index.html")) &&
    fs.existsSync(stampFile) &&
    fs.readFileSync(stampFile, "utf8") === stamp;

  if (cached) {
    emit({ type: "status", message: "Reusing cached bundle..." });
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

  // null lets Remotion fall back to downloading a browser; Rust only omits this
  // when neither Edge nor Chrome exists on the machine.
  const browserExecutable = args.browser || null;
  emit({
    type: "status",
    message: browserExecutable
      ? `Browser: ${path.basename(browserExecutable)}`
      : "No local browser found, Remotion may download one",
  });

  const serveUrl = await resolveServeUrl(
    entryPoint,
    args.bundleDir ? path.resolve(args.bundleDir) : "",
  );

  const compositions = await getCompositions(serveUrl, { inputProps, browserExecutable });
  const composition = args.composition
    ? compositions.find((c) => c.id === args.composition)
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
    codec: "h264",
    outputLocation,
    inputProps,
    browserExecutable,
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

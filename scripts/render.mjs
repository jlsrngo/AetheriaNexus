import path from "node:path";
import fs from "node:fs";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia } from "@remotion/renderer";

// shortcut: bundle() re-runs on every render (~15s) and this script plus apps/src/remotion
// are not shipped by tauri.conf.json / prepare-bundle.cjs, so packaged builds cannot render.
// Upgrade when render latency or installer parity matters: serve a cached bundle and add both as tauri resources.
const emit = (payload) => console.log(JSON.stringify(payload));

function parseArgs(argv) {
  const parsed = { props: "{}", output: "", composition: "", entry: "" };
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i + 1];
    if (value === undefined) break;
    if (argv[i] === "--props") parsed.props = value;
    else if (argv[i] === "--output") parsed.output = value;
    else if (argv[i] === "--composition") parsed.composition = value;
    else if (argv[i] === "--entry") parsed.entry = value;
    else continue;
    i++;
  }
  return parsed;
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

  emit({ type: "status", message: `Bundling ${path.basename(entryPoint)}...` });
  const serveUrl = await bundle({ entryPoint });

  const compositions = await getCompositions(serveUrl, { inputProps });
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

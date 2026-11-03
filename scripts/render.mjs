import path from "node:path";
import fs from "node:fs";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

async function main() {
  const args = process.argv.slice(2);
  let propsJson = "{}";
  let outputLocation = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--props" && args[i + 1]) {
      propsJson = args[i + 1];
      i++;
    } else if (args[i] === "--output" && args[i + 1]) {
      outputLocation = args[i + 1];
      i++;
    }
  }

  let inputProps = {};
  try {
    inputProps = JSON.parse(propsJson);
  } catch (err) {
    console.warn("Could not parse props JSON, using empty object:", err);
  }

  if (!outputLocation) {
    const outputDir = path.resolve(process.cwd(), "output");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    outputLocation = path.join(outputDir, `nexus-${Date.now()}.mp4`);
  } else {
    const parentDir = path.dirname(outputLocation);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
  }

  console.log(JSON.stringify({ type: "status", message: "Bundling Nexus Editorial composition..." }));

  const entryPoint = path.resolve(process.cwd(), "apps/src/remotion/index.ts");
  const bundleLocation = await bundle({
    entryPoint,
    webpackOverride: (config) => config,
  });

  console.log(JSON.stringify({ type: "status", message: "Selecting composition..." }));

  let composition;
  try {
    composition = await selectComposition({
      serveUrl: bundleLocation,
      id: "NexusEditorialVideo",
      inputProps,
    });
  } catch {
    composition = await selectComposition({
      serveUrl: bundleLocation,
      id: "TikTokVideo",
      inputProps,
    });
  }

  console.log(
    JSON.stringify({
      type: "status",
      message: "Starting render...",
      totalFrames: composition.durationInFrames,
      fps: composition.fps,
    })
  );

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation,
    inputProps,
    onProgress: ({ renderedFrames }) => {
      const percent = Math.min(100, Math.round((renderedFrames / composition.durationInFrames) * 100));
      console.log(
        JSON.stringify({
          type: "progress",
          percent,
          renderedFrames,
          totalFrames: composition.durationInFrames,
        })
      );
    },
  });

  console.log(JSON.stringify({ type: "done", outputPath: outputLocation }));
}

main().catch((err) => {
  console.error(JSON.stringify({ type: "error", error: err.message || String(err) }));
  process.exit(1);
});


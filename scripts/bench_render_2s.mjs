import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";

console.log("--- Starting 2-second Remotion render benchmark (120 frames @ 60 FPS) ---");
const t0 = performance.now();
const child = spawn("node", [
  "scripts/render.mjs",
  "--entry", "workspace/src/entry.ts",
  "--composition", "LinusTorvalds",
  "--frames", "0-119",
  "--output", "output/linus_2s_test.mp4",
  "--concurrency", "4"
], { stdio: "inherit" });

child.on("close", (code) => {
  const durSec = ((performance.now() - t0) / 1000).toFixed(2);
  console.log(`\n========================================`);
  console.log(`TOTAL RENDER TIME: ${durSec} seconds (exit code ${code})`);
  console.log(`========================================\n`);
});


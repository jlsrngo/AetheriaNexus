import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ffmpeg = path.resolve("node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe");

const w = 1080, h = 1920, fps = 60, dur = 2;
const totalFrames = fps * dur; // 120 frames
const frameSize = w * h * 4;
const buf = Buffer.alloc(frameSize);

// Render gradient frame in RAM
for (let y = 0; y < h; y++) {
  const r = Math.floor((y / h) * 255);
  const b = Math.floor((1 - y / h) * 255);
  for (let x = 0; x < w; x++) {
    const idx = (y * w + x) * 4;
    buf[idx] = r;
    buf[idx + 1] = 40;
    buf[idx + 2] = b;
    buf[idx + 3] = 255;
  }
}

console.log(`Starting Direct Native Pipeline benchmark for ${totalFrames} frames (2.0s @ 60 FPS, 1080x1920)...`);
const t0 = performance.now();

const ff = spawn(ffmpeg, [
  "-y",
  "-f", "image2pipe",
  "-vcodec", "rawvideo",
  "-pix_fmt", "rgba",
  "-s", "1080x1920",
  "-r", "60",
  "-i", "-",
  "-c:v", "libx264",
  "-pix_fmt", "yuv420p",
  "-preset", "veryfast",
  "output/bench_native_2s.mp4"
]);

let errLog = "";
ff.stderr.on("data", (d) => {
  errLog += d.toString();
});

ff.stdin.on("error", (err) => {
  console.log("STDIN_ERROR:", err.message);
  console.log("FFMPEG_STDERR:", errLog);
});

let framesWritten = 0;
function pump() {
  while (framesWritten < totalFrames) {
    framesWritten++;
    const ok = ff.stdin.write(buf);
    if (!ok) {
      ff.stdin.once("drain", pump);
      return;
    }
  }
  ff.stdin.end();
}

pump();

ff.on("close", (code) => {
  const elapsedMs = performance.now() - t0;
  const elapsedSec = elapsedMs / 1000;
  const renderedFps = totalFrames / elapsedSec;

  if (code !== 0) {
    console.error("FFMPEG FAILED with code", code, errLog.slice(-500));
    return;
  }

  const stat = fs.statSync("output/bench_native_2s.mp4");
  console.log("=== BENCHMARK RESULT ===");
  console.log(`Duration: 2.0s (120 frames @ 60 FPS)`);
  console.log(`Resolution: 1080x1920 (Vertical 9:16)`);
  console.log(`Render Time: ${elapsedSec.toFixed(2)} seconds (${elapsedMs.toFixed(0)} ms)`);
  console.log(`Render Speed: ${renderedFps.toFixed(1)} FPS (${(renderedFps / 60).toFixed(2)}x Realtime!)`);
  console.log(`Output File: output/bench_native_2s.mp4 (${(stat.size / 1024).toFixed(1)} KB)`);
});

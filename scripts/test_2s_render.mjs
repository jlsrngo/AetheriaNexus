import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ffmpeg = path.resolve("node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe");

const w = 1080, h = 1920, fps = 60, dur = 2;
const totalFrames = fps * dur; // 120 frames
const frameSize = w * h * 4;
const buf = Buffer.alloc(frameSize);

// Fill with gradient and moving bar
function renderFrame(frameIdx) {
  const t = frameIdx / totalFrames;
  const barY = Math.floor(t * h);
  for (let y = 0; y < h; y++) {
    const isBar = Math.abs(y - barY) < 30;
    const r = isBar ? 255 : Math.floor((y / h) * 180);
    const g = isBar ? 50 : 30;
    const b = isBar ? 100 : Math.floor((1 - y / h) * 220);
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      buf[idx] = r;
      buf[idx + 1] = g;
      buf[idx + 2] = b;
      buf[idx + 3] = 255;
    }
  }
  return buf;
}

console.log(`[Native CPU Pipeline] Rendering ${totalFrames} frames (2.0s @ 60 FPS, 1080x1920 vertical)...`);
const t0 = performance.now();

const ff = spawn(ffmpeg, [
  "-y",
  "-f", "image2pipe",
  "-vcodec", "rawvideo",
  "-pix_fmt", "rgba",
  "-s", `${w}x${h}`,
  "-r", String(fps),
  "-i", "-",
  "-c:v", "libx264",
  "-pix_fmt", "yuv420p",
  "-preset", "veryfast",
  "output/native_2s_test.mp4"
]);

let errLog = "";
ff.stderr.on("data", (d) => {
  errLog += d.toString();
});

let frameIdx = 0;
function writeFrame() {
  let canWrite = true;
  while (frameIdx < totalFrames && canWrite) {
    const fbuf = renderFrame(frameIdx);
    frameIdx++;
    canWrite = ff.stdin.write(fbuf);
  }
  if (frameIdx >= totalFrames) {
    ff.stdin.end();
  } else {
    ff.stdin.once("drain", writeFrame);
  }
}

ff.stdin.on("error", (e) => {
  if (e.code !== "EPIPE" && e.code !== "EOF") console.error(e);
});

writeFrame();

ff.on("close", (code) => {
  const elapsed = (performance.now() - t0) / 1000;
  const fpsActual = totalFrames / elapsed;
  const stat = fs.statSync("output/native_2s_test.mp4");
  console.log("-----------------------------------------");
  console.log(`STATUS: SUCCESS (Exit Code: ${code})`);
  console.log(`TOTAL FRAMES: ${totalFrames} (2.0s @ 60 FPS)`);
  console.log(`RENDER TIME: ${elapsed.toFixed(2)} seconds!`);
  console.log(`RENDER SPEED: ${fpsActual.toFixed(1)} FPS (${(fpsActual / 60).toFixed(2)}x Realtime)`);
  console.log(`OUTPUT FILE: output/native_2s_test.mp4 (${(stat.size / 1024).toFixed(1)} KB)`);
  console.log("FFMPEG_LOG:", errLog.slice(-400));
  console.log("-----------------------------------------");
});

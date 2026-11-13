import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { startLiveStack, type LiveStack } from "./live-stack.mjs";

function buildSilentPcmWav(durationSec = 1.2, sampleRate = 8000): Buffer {
  const numSamples = Math.max(1, Math.round(durationSec * sampleRate));
  const dataBytes = numSamples * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16); // PCM chunk size
  buf.writeUInt16LE(1, 20); // PCM format
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write("data", 36);
  buf.writeUInt32LE(dataBytes, 40);
  return buf;
}

function createTestFilmFixture(targetDir: string) {
  fs.mkdirSync(path.join(targetDir, "audio"), { recursive: true });
  const wavBytes = buildSilentPcmWav(1.2);
  const scenes = [1, 2, 3, 4, 5].map((idx) => {
    const audioRel = `audio/scene${idx}.wav`;
    fs.writeFileSync(path.join(targetDir, audioRel), wavBytes);
    return {
      id: `scene${idx}`,
      title: `Scene ${idx}`,
      duration: 1.2,
      audio: audioRel,
    };
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>E2E Audio Test Film</title>
  <style>
    html, body { margin: 0; padding: 0; background: #0a0a0c; width: 100%; height: 100%; }
    canvas#stage { display: block; width: 100%; height: 100%; }
  </style>
</head>
<body>
  <canvas id="stage" width="1080" height="1920"></canvas>
  <script>
    window.__filmMeta = ${JSON.stringify({
      title: "Penumpang E2E",
      width: 1080,
      height: 1920,
      fps: 30,
      duration: 6,
      durationInFrames: 180,
      scenes,
    })};
    const canvas = document.getElementById("stage");
    const ctx = canvas.getContext("2d");
    window.renderFrame = function(frame) {
      if (!ctx) return;
      ctx.fillStyle = "#141418";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#f59e0b";
      ctx.fillRect(100, 100 + (frame % 180) * 4, 240, 240);
    };
    window.renderFrame(0);
  </script>
</body>
</html>`;
  fs.writeFileSync(path.join(targetDir, "index.html"), html, "utf8");
}

test.describe("Studio Audio & Penumpang Stage E2E (Real Engine + Browser)", () => {
  let stack: LiveStack;

  test.beforeEach(async () => {
    stack = await startLiveStack();
    createTestFilmFixture(stack.workspaceDir);
  });

  test.afterEach(async () => {
    await stack?.stop();
  });

  test("loads Penumpang 5 WAV tracks cleanly with auth, plays audio, and renders across all themes", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    const failedAudioResponses: string[] = [];

    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });
    page.on("response", (res) => {
      if (res.url().includes("/api/studio/ws-asset/audio/") && res.status() >= 400) {
        failedAudioResponses.push(`${res.status()} ${res.url()} ct=${res.headers()["content-type"] || ""}`);
      }
    });

    await page.addInitScript(
      ({ workspaceDir }: { workspaceDir: string }) => {
        if (window !== window.top) return;
        localStorage.setItem("aetheria_active_folder", workspaceDir);
        localStorage.setItem("aetheria_theme", "dark");
      },
      { workspaceDir: stack.workspaceDir }
    );

    await page.goto(`/?folder=${encodeURIComponent(stack.workspaceDir)}`);

    // Verify sandbox iframe loads cleanly and has zero #playgate black overlay
    const stageIframe = page.locator('iframe[sandbox="allow-scripts"]');
    await expect(stageIframe).toBeVisible({ timeout: 20_000 });

    const iframeDoc = page.frameLocator('iframe[sandbox="allow-scripts"]');
    await expect(iframeDoc.locator("#playgate")).toHaveCount(0);
    await expect(iframeDoc.locator("canvas#stage")).toBeVisible({ timeout: 15_000 });

    // Verify all <audio> tracks mount in Studio with valid duration & readyState >= 1
    await expect(async () => {
      const audioStats = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll("audio"));
        return els.map((el) => ({
          src: el.getAttribute("src") || "",
          readyState: el.readyState,
          duration: el.duration,
          volume: el.volume,
          muted: el.muted,
          errorCode: el.error ? el.error.code : null,
        }));
      });
      expect(audioStats.length).toBeGreaterThanOrEqual(5);
      for (const stat of audioStats) {
        expect(stat.src).toContain("/api/studio/ws-asset/audio/");
        expect(stat.errorCode).toBeNull();
        expect(stat.readyState).toBeGreaterThanOrEqual(1);
        expect(stat.duration).toBeGreaterThan(0.4);
      }
    }).toPass({ timeout: 20_000 });

    // Verify Timeline Volume slider and Mute toggle control real <audio> elements
    const volumeSlider = page.getByLabel("Audio volume percentage");
    await expect(volumeSlider).toBeVisible({ timeout: 10_000 });
    await volumeSlider.fill("35");
    await expect(async () => {
      const vols = await page.evaluate(() =>
        Array.from(document.querySelectorAll("audio")).map((el) => ({
          volume: Number(el.volume.toFixed(2)),
          muted: el.muted,
        }))
      );
      expect(vols.length).toBeGreaterThanOrEqual(5);
      for (const v of vols) {
        expect(v.volume).toBe(0.35);
        expect(v.muted).toBe(false);
      }
    }).toPass({ timeout: 10_000 });

    await page.getByLabel("Mute Audio").click();
    await expect(async () => {
      const mutedStates = await page.evaluate(() =>
        Array.from(document.querySelectorAll("audio")).map((el) => el.muted)
      );
      expect(mutedStates.every(Boolean)).toBe(true);
    }).toPass({ timeout: 10_000 });

    await page.getByLabel("Unmute Audio").click();
    await expect(async () => {
      const unmutedStates = await page.evaluate(() =>
        Array.from(document.querySelectorAll("audio")).map((el) => ({
          muted: el.muted,
          volume: Number(el.volume.toFixed(2)),
        }))
      );
      for (const s of unmutedStates) {
        expect(s.muted).toBe(false);
        expect(s.volume).toBe(0.35);
      }
    }).toPass({ timeout: 10_000 });

    expect(failedAudioResponses).toEqual([]);

    // Click Play button and verify scene 1 audio actually starts playing
    const playBtn = page.getByTitle("Play Video (Space)");
    await expect(playBtn).toBeVisible({ timeout: 10_000 });
    await playBtn.click();

    await expect(async () => {
      const playingState = await page.evaluate(() => {
        const first = document.querySelector("audio");
        return first ? { paused: first.paused, currentTime: first.currentTime } : null;
      });
      expect(playingState).not.toBeNull();
      expect(playingState?.paused).toBe(false);
    }).toPass({ timeout: 10_000 });

    // Pause back via Pause button
    const pauseBtn = page.getByTitle("Pause (Space)");
    await pauseBtn.click();

    // Verify all 3 themes render cleanly with visible canvas stage and no error banner
    await expect(page.getByText("Video Script Warning (Sandbox Workspace)")).toHaveCount(0);

    for (const theme of ["dark", "light", "neobrutalism"] as const) {
      await page.evaluate((t) => {
        document.documentElement.setAttribute("data-theme", t);
        document.documentElement.classList.remove("light", "dark", "neobrutalism");
        if (t === "neobrutalism") {
          document.documentElement.classList.add("light", "neobrutalism");
        } else {
          document.documentElement.classList.add(t);
        }
      }, theme);
      const box = await stageIframe.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThan(120);
      expect(box?.height ?? 0).toBeGreaterThan(150);
      if (stack.screenshotDir) {
        await page.screenshot({
          path: path.join(stack.screenshotDir, `penumpang-studio-${theme}.png`),
          fullPage: false,
        });
      }
    }

    expect(pageErrors).toEqual([]);
  });

  test("surfaces an actionable error banner instead of silent failure when scene audio is missing", async ({
    page,
  }) => {
    const htmlPath = path.join(stack.workspaceDir, "index.html");
    const brokenHtml = fs
      .readFileSync(htmlPath, "utf8")
      .replace(/audio\/[^"']+\.wav/i, "audio/missing_track.wav");
    fs.writeFileSync(htmlPath, brokenHtml, "utf8");

    await page.addInitScript(
      ({ workspaceDir }: { workspaceDir: string }) => {
        if (window !== window.top) return;
        localStorage.setItem("aetheria_active_folder", workspaceDir);
      },
      { workspaceDir: stack.workspaceDir }
    );

    await page.goto(`/?folder=${encodeURIComponent(stack.workspaceDir)}`);

    await expect(page.getByText("Video Script Warning (Sandbox Workspace)")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/audio\/missing_track\.wav/i)).toBeVisible({
      timeout: 10_000,
    });
  });
});


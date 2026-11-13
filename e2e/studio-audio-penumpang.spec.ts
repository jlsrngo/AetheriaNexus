import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { startLiveStack, type LiveStack } from "./live-stack.mjs";

const SOURCE_WORKSPACE = "E:\\JS\\Aetheria-Workspace";

function copyPenumpangProject(targetDir: string) {
  fs.mkdirSync(path.join(targetDir, "script"), { recursive: true });
  fs.mkdirSync(path.join(targetDir, "audio"), { recursive: true });

  fs.copyFileSync(
    path.join(SOURCE_WORKSPACE, "index.html"),
    path.join(targetDir, "index.html")
  );

  for (const name of fs.readdirSync(path.join(SOURCE_WORKSPACE, "script"))) {
    if (name.endsWith(".js")) {
      fs.copyFileSync(
        path.join(SOURCE_WORKSPACE, "script", name),
        path.join(targetDir, "script", name)
      );
    }
  }

  for (const name of fs.readdirSync(path.join(SOURCE_WORKSPACE, "audio"))) {
    if (/^scene[1-5]\.(wav|words\.json)$/i.test(name)) {
      fs.copyFileSync(
        path.join(SOURCE_WORKSPACE, "audio", name),
        path.join(targetDir, "audio", name)
      );
    }
  }
}

test.describe("Studio Audio & Penumpang Stage E2E (Real Engine + Browser)", () => {
  let stack: LiveStack;

  test.beforeEach(async () => {
    stack = await startLiveStack();
    copyPenumpangProject(stack.workspaceDir);
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

    // Verify all 5 <audio> tracks mount in Studio with valid duration & readyState >= 1
    await expect(async () => {
      const audioStats = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll("audio"));
        return els.map((el) => ({
          src: el.getAttribute("src") || "",
          readyState: el.readyState,
          duration: el.duration,
          errorCode: el.error ? el.error.code : null,
        }));
      });
      expect(audioStats).toHaveLength(5);
      for (const stat of audioStats) {
        expect(stat.src).toContain("/api/studio/ws-asset/audio/scene");
        expect(stat.errorCode).toBeNull();
        expect(stat.readyState).toBeGreaterThanOrEqual(1);
        expect(stat.duration).toBeGreaterThan(1.0);
      }
    }).toPass({ timeout: 20_000 });

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
      .replace("audio/scene1.wav", "audio/missing_track.wav");
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


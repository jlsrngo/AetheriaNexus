import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, execSync, type ChildProcess } from "node:child_process";
import { test, expect } from "@playwright/test";
import {
  resolveEngineBinary,
  startLiveStack,
  type LiveStack,
} from "./live-stack.mjs";

function killTree(child: ChildProcess | null) {
  if (!child || child.pid === undefined) return;
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /F /T /PID ${child.pid}`, {
        stdio: "ignore",
        windowsHide: true,
      });
    } else {
      child.kill("SIGKILL");
    }
  } catch {
    // Already exited
  }
}

test.describe("Gelombang 1 Security, Sandbox & Studio Persistence E2E (Real Engine + Browser)", () => {
  let stack: LiveStack;

  test.beforeEach(async () => {
    stack = await startLiveStack();
  });

  test.afterEach(async () => {
    await stack?.stop();
  });

  test("enforces per-launch auth with zero env config and blocks path/command escape endpoints (P0-02..P0-05, P2-03)", async () => {
    // 1. Verify zero-config CSPRNG auth when AETHERIA_SERVER_PASSWORD env vars are absent (P0-05)
    const zeroCfgHome = fs.mkdtempSync(
      path.join(os.tmpdir(), "aetheria-e2e-nocfg-"),
    );
    let zeroCfgChild: ChildProcess | null = null;
    try {
      const envCopy: Record<string, string | undefined> = { ...process.env };
      delete envCopy.Aetheria_SERVER_PASSWORD;
      delete envCopy.AETHERIA_SERVER_PASSWORD;
      delete envCopy.Aetheria_SERVER_USERNAME;
      delete envCopy.AETHERIA_SERVER_USERNAME;

      const engineBin = resolveEngineBinary(stack.repoRoot);
      zeroCfgChild = spawn(engineBin, ["serve", "--port", "4197"], {
        cwd: stack.repoRoot,
        env: {
          ...envCopy,
          USERPROFILE: zeroCfgHome,
          HOME: zeroCfgHome,
          XDG_CONFIG_HOME: path.join(zeroCfgHome, ".config"),
          XDG_DATA_HOME: path.join(zeroCfgHome, ".local", "share"),
          LOCALAPPDATA: path.join(zeroCfgHome, "AppData", "Local"),
          AETHERIA_ROOT: stack.repoRoot,
          AETHERIA_HEADLESS: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        shell: false,
      });

      const pwPath = path.join(zeroCfgHome, ".aetheria", "dev-server-password");
      const deadline = Date.now() + 20_000;
      let healthSeen = false;
      while (Date.now() < deadline) {
        try {
          const r = await fetch("http://127.0.0.1:4197/api/health", {
            signal: AbortSignal.timeout(1000),
          });
          expect(r.status).toBe(401);
          if (fs.existsSync(pwPath)) {
            healthSeen = true;
            break;
          }
        } catch {
          // Still booting
        }
        await new Promise((r) => setTimeout(r, 200));
      }
      expect(healthSeen).toBe(true);

      const unauthProv = await fetch("http://127.0.0.1:4197/api/providers");
      expect(unauthProv.status).toBe(401);

      const credsRaw = fs.readFileSync(pwPath, "utf8").trim();
      expect(credsRaw).toContain(":");
      const authRes = await fetch("http://127.0.0.1:4197/api/providers", {
        headers: {
          Authorization: `Basic ${Buffer.from(credsRaw).toString("base64")}`,
        },
      });
      expect(authRes.status).toBe(200);
    } finally {
      killTree(zeroCfgChild);
      await new Promise((r) => setTimeout(r, 250));
      fs.rmSync(zeroCfgHome, { recursive: true, force: true });
    }

    // 2. Initialize active workspace and outside secret sentinel in os.tmpdir()
    const outsideSecretPath = path.join(stack.tempRoot, "outside-secret.txt");
    fs.writeFileSync(outsideSecretPath, "TOP_SECRET_OUTSIDE", "utf8");
    const initRes = await fetch(`${stack.engineUrl}/api/desktop/init-workspace`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: stack.authHeader,
      },
      body: JSON.stringify({ folderPath: stack.workspaceDir }),
    });
    expect(initRes.ok).toBe(true);

    const demoMp4 = path.join(stack.workspaceDir, "output", "demo.mp4");
    fs.mkdirSync(path.dirname(demoMp4), { recursive: true });
    fs.writeFileSync(demoMp4, "DEMO_MP4_BYTES", "utf8");

    // P0-02: stream-video requires auth & blocks traversal/outside paths
    const streamNoAuth = await fetch(
      `${stack.engineUrl}/api/studio/stream-video?file=demo.mp4`,
    );
    expect(streamNoAuth.status).toBe(401);

    const streamOutsideAbs = await fetch(
      `${stack.engineUrl}/api/studio/stream-video?path=${encodeURIComponent(outsideSecretPath)}`,
      { headers: { Authorization: stack.authHeader } },
    );
    expect(streamOutsideAbs.status).toBe(403);

    const streamTraversal = await fetch(
      `${stack.engineUrl}/api/studio/stream-video?file=${encodeURIComponent("../../outside-secret.txt")}`,
      { headers: { Authorization: stack.authHeader } },
    );
    expect(streamTraversal.status).toBe(403);

    const streamValid = await fetch(
      `${stack.engineUrl}/api/studio/stream-video?file=demo.mp4`,
      { headers: { Authorization: stack.authHeader } },
    );
    expect(streamValid.status).toBe(200);
    expect(await streamValid.text()).toBe("DEMO_MP4_BYTES");

    // P0-03: render-media rejects traversal outputName
    const renderEscapeRes = await fetch(
      `${stack.engineUrl}/api/render-media?directory=${encodeURIComponent(stack.workspaceDir)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: stack.authHeader,
        },
        body: JSON.stringify({
          compositionId: "HtmlMotionFilm",
          outputName: "../../evil.mp4",
        }),
      },
    );
    expect(renderEscapeRes.status).toBe(400);
    expect(fs.existsSync(path.join(stack.tempRoot, "evil.mp4"))).toBe(false);

    // P2-03: write-static-file blocks copying arbitrary sourcePath outside workspace
    const staticCopyLeakRes = await fetch(
      `${stack.engineUrl}/api/write-static-file?directory=${encodeURIComponent(stack.workspaceDir)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: stack.authHeader,
        },
        body: JSON.stringify({
          filePath: "public/leak.txt",
          sourcePath: outsideSecretPath,
        }),
      },
    );
    const staticCopyJson = (await staticCopyLeakRes.json()) as {
      success?: boolean;
    };
    expect(staticCopyJson.success).toBe(false);
    expect(
      fs.existsSync(path.join(stack.workspaceDir, "public", "leak.txt")),
    ).toBe(false);

    // P0-04: open-url validates URL strictly with 400 rejection on unsafe schemes/shell metachars
    for (const badUrl of [
      "file:///C:/Windows/win.ini",
      "https://example.com & calc.exe",
      "javascript:alert(1)",
    ]) {
      const badOpenRes = await fetch(`${stack.engineUrl}/api/desktop/open-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: stack.authHeader,
        },
        body: JSON.stringify({ url: badUrl }),
      });
      expect(badOpenRes.status).toBe(400);
    }
  });

  test("isolates HTML preview iframe without allow-same-origin while relaying assets and preserving empty-store edits across themes (P0-01, P0-06, P0-07)", async ({
    page,
  }) => {
    const appErrors: string[] = [];
    page.on("pageerror", (err) => appErrors.push(`pageerror: ${err.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        if (!text.includes("fonts.googleapis.com")) {
          appErrors.push(`console.error: ${text}`);
        }
      }
    });

    // Write real HTML film & workspace asset inside isolated os.tmpdir() workspace
    fs.mkdirSync(path.join(stack.workspaceDir, "assets"), { recursive: true });
    fs.writeFileSync(
      path.join(stack.workspaceDir, "assets", "palette.json"),
      JSON.stringify({ accent: "#f59e0b" }),
      "utf8",
    );
    fs.writeFileSync(
      path.join(stack.workspaceDir, "index.html"),
      `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Sandbox E2E Film</title></head>
<body style="margin:0;background:#111;color:#fff;font-family:monospace;">
  <div id="probe" style="padding:24px;font-size:28px;">booting</div>
  <script>
    var parentStorageBlocked = false;
    var desktopBlocked = false;
    var assetColor = "none";
    var renderAtCount = 0;

    try {
      var stolen = window.parent.localStorage.getItem("e2e_secret_sentinel");
      parentStorageBlocked = stolen === null ? false : false;
    } catch (e) {
      parentStorageBlocked = true;
    }

    try {
      var bridge = window.parent.aetheriaDesktop;
      desktopBlocked = !bridge;
    } catch (e) {
      desktopBlocked = true;
    }

    function updateProbe(t) {
      var el = document.getElementById("probe");
      if (el) {
        el.textContent =
          "parentStorageBlocked=" + parentStorageBlocked +
          " desktopBlocked=" + desktopBlocked +
          " assetColor=" + assetColor +
          " renderAtCount=" + renderAtCount +
          " t=" + Number(t || 0).toFixed(2);
      }
    }

    fetch("assets/palette.json")
      .then(function (r) { return r.json(); })
      .then(function (d) { assetColor = d && d.accent ? d.accent : "missing"; updateProbe(0); })
      .catch(function () { assetColor = "fetch_error"; updateProbe(0); });

    window.renderAt = function (t) {
      renderAtCount += 1;
      updateProbe(t);
    };
  </script>
</body>
</html>`,
      "utf8",
    );

    // P0-06: start with empty aetheria_nexus_studio_compositions_v6 in localStorage + sentinel secret
    await page.addInitScript(
      ({ workspaceDir }: { workspaceDir: string }) => {
        if (window !== window.top) return;
        if (!sessionStorage.getItem("__e2e_g1_init")) {
          localStorage.removeItem("aetheria_nexus_studio_compositions_v6");
          localStorage.setItem("e2e_secret_sentinel", "must-stay-isolated");
          localStorage.setItem("aetheria_active_folder", workspaceDir);
          localStorage.setItem("aetheria_theme", "dark");
          sessionStorage.setItem("__e2e_g1_init", "1");
        }
      },
      { workspaceDir: stack.workspaceDir },
    );

    await page.goto(`/?folder=${encodeURIComponent(stack.workspaceDir)}`);

    // Verify P0-01: sandbox attribute excludes allow-same-origin and renders via postMessage
    const stageIframe = page.locator("iframe[title]");
    await expect(stageIframe).toBeVisible({ timeout: 20_000 });
    const sandboxAttr = await stageIframe.getAttribute("sandbox");
    expect(sandboxAttr).toBe("allow-scripts");

    const frameProbe = page
      .frameLocator('iframe[sandbox="allow-scripts"]')
      .locator("#probe");
    await expect(frameProbe).toContainText("parentStorageBlocked=true", {
      timeout: 15_000,
    });
    await expect(frameProbe).toContainText("desktopBlocked=true");
    await expect(frameProbe).toContainText("assetColor=#f59e0b", {
      timeout: 15_000,
    });
    await expect(frameProbe).toContainText(/renderAtCount=[1-9]/);

    // P0-06 & P0-07: clear stored compositions, edit active composition metadata in UI, and
    // verify window focus syncFromBackend() does not clobber dirty unsaved edits.
    await page.getByRole("button", { name: "Inspector & Properties" }).click();
    const fpsSelect = page.locator("select").filter({ hasText: "60fps" }).first();
    await expect(fpsSelect).toBeVisible({ timeout: 10_000 });

    await page.evaluate(() => {
      localStorage.removeItem("aetheria_nexus_studio_compositions_v6");
    });

    await fpsSelect.selectOption("60");
    await expect(fpsSelect).toHaveValue("60");

    await expect(async () => {
      const storedAfterEdit = await page.evaluate(() =>
        localStorage.getItem("aetheria_nexus_studio_compositions_v6"),
      );
      expect(storedAfterEdit).toBeTruthy();
      expect(storedAfterEdit).toContain('"fps":60');
    }).toPass({ timeout: 5_000 });

    // Trigger window focus -> syncFromBackend() runs against real engine (:4196 -> 30fps)
    await page.evaluate(() => {
      window.dispatchEvent(new Event("focus"));
    });
    await page.waitForTimeout(600);
    await expect(fpsSelect).toHaveValue("60");

    // Inspect UI across all 3 themes defined in apps/src/index.css
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
      expect(box?.width ?? 0).toBeGreaterThan(100);
      expect(box?.height ?? 0).toBeGreaterThan(100);
      if (stack.screenshotDir) {
        await page.screenshot({
          path: `${stack.screenshotDir}/g1-studio-${theme}.png`,
        });
      }
    }

    expect(appErrors).toEqual([]);
  });

  test("materializes and persists metadata edits when localStorage and backend start empty (P0-06, P0-07)", async ({
    page,
  }) => {
    const appErrors: string[] = [];
    page.on("pageerror", (err) => appErrors.push(`pageerror: ${err.message}`));

    await page.addInitScript(
      ({ workspaceDir }: { workspaceDir: string }) => {
        if (window !== window.top) return;
        if (!sessionStorage.getItem("__e2e_g1_empty")) {
          localStorage.removeItem("aetheria_nexus_studio_compositions_v6");
          localStorage.setItem("aetheria_active_folder", workspaceDir);
          sessionStorage.setItem("__e2e_g1_empty", "1");
        }
      },
      { workspaceDir: stack.workspaceDir },
    );

    await page.goto(`/?folder=${encodeURIComponent(stack.workspaceDir)}`);

    await page.getByRole("button", { name: "Inspector & Properties" }).click();
    const inspector = page.locator("aside").filter({ hasText: "Composition Metadata" });
    await expect(inspector).toBeVisible({ timeout: 10_000 });

    const durationInput = inspector.locator("input[type='number']").first();
    const fpsSelect = inspector.locator("select").first();

    await inspector.getByRole("button", { name: "16:9" }).click();
    await durationInput.fill("25");
    await fpsSelect.selectOption("60");

    await expect(inspector).toContainText("1920×1080");
    await expect(inspector).toContainText("Duration (1500f)");
    await expect(fpsSelect).toHaveValue("60");

    await expect(async () => {
      const storedJson = await page.evaluate(() =>
        localStorage.getItem("aetheria_nexus_studio_compositions_v6"),
      );
      expect(storedJson).toBeTruthy();
      expect(storedJson).toContain('"ratio":"16:9"');
      expect(storedJson).toContain('"width":1920');
      expect(storedJson).toContain('"duration":25');
      expect(storedJson).toContain('"fps":60');
    }).toPass({ timeout: 5_000 });

    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.waitForTimeout(500);
    await expect(inspector).toContainText("1920×1080");
    await expect(fpsSelect).toHaveValue("60");

    await page.reload();
    await page.getByRole("button", { name: "Inspector & Properties" }).click();
    await expect(inspector).toContainText("1920×1080", { timeout: 10_000 });
    await expect(durationInput).toHaveValue("25");
    await expect(fpsSelect).toHaveValue("60");

    expect(appErrors).toEqual([]);
  });
});

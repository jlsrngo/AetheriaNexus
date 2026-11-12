import { test, expect } from "@playwright/test";
import { startLiveStack, type LiveStack } from "./live-stack.mjs";

test.describe("Subagent Default Background, Standby Queue, and Wakeup E2E (Real Engine + Browser)", () => {
  let stack: LiveStack;

  test.beforeEach(async () => {
    stack = await startLiveStack();
  });

  test.afterEach(async () => {
    await stack?.stop();
  });

  test("executes parallel background subagents with live standby UI across themes and clean wakeup notice", async ({
    page,
  }) => {
    const appErrors: string[] = [];
    page.on("pageerror", (err) => {
      appErrors.push(`pageerror: ${err.message}`);
    });
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        // Ignore offline external Google Fonts failure if sandbox blocks internet.
        if (!text.includes("fonts.googleapis.com")) {
          appErrors.push(`console.error: ${text}`);
        }
      }
    });

    // Verify Basic Auth guard is active on real engine endpoint.
    const unauthHealth = await fetch(`${stack.engineUrl}/api/health`);
    expect(unauthHealth.status).toBe(401);
    const authHealth = await fetch(`${stack.engineUrl}/api/health`, {
      headers: { Authorization: stack.authHeader },
    });
    expect(authHealth.status).toBe(200);
    const healthJson = (await authHealth.json()) as { healthy?: boolean };
    expect(healthJson.healthy).toBe(true);

    await page.addInitScript(
      ({ workspaceDir }: { workspaceDir: string }) => {
        if (!sessionStorage.getItem("__e2e_init")) {
          localStorage.setItem("aetheria_active_folder", workspaceDir);
          localStorage.setItem("aetheria_active_provider", "e2e-mock");
          localStorage.setItem("aetheria_active_model", "e2e-fast");
          localStorage.setItem("aetheria_provider_model_e2e-mock", "e2e-fast");
          localStorage.setItem("aetheria_provider_models_e2e-mock", "e2e-fast");
          localStorage.setItem("aetheria_theme", "dark");
          sessionStorage.setItem("__e2e_init", "1");
        }
      },
      { workspaceDir: stack.workspaceDir },
    );

    await page.goto(`/?folder=${encodeURIComponent(stack.workspaceDir)}`);

    const textarea = page.locator("textarea");
    await expect(textarea).toBeVisible();
    if (stack.screenshotDir) {
      await page.screenshot({ path: `${stack.screenshotDir}/01-empty-dark.png` });
    }

    // Trigger prompt that launches 2 parallel subagents (default background + standby slot).
    await textarea.fill("Tolong riset motion dan siapkan audio scene 1 secara paralel.");
    await page.getByTitle("Send message").click();

    // While parent turn finishes early and is idle, floating SubagentActivityBar must show live 1 active + 1 standby.
    const bar = page.getByTestId("subagent-activity-bar");
    await expect(bar).toBeVisible({ timeout: 20_000 });
    await expect(bar).toContainText("1 aktif");
    await expect(bar).toContainText("1 standby");

    // Expand bar and verify both actors + standby status render cleanly.
    await bar.locator("button").first().click();
    await expect(bar).toContainText("Research Assistant");
    await expect(bar).toContainText("Audio Producer");

    // Visually inspect UI container across all 3 themes defined in apps/src/index.css without crashes/zero height.
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
      const box = await bar.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThan(100);
      expect(box?.height ?? 0).toBeGreaterThan(24);
      if (stack.screenshotDir) {
        await page.screenshot({ path: `${stack.screenshotDir}/02-standby-${theme}.png` });
      }
    }

    // Reset back to dark for completion check.
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "dark");
      document.documentElement.classList.remove("light", "neobrutalism");
      document.documentElement.classList.add("dark");
    });

    // Wait for both subagents to settle and wake parent session.
    await expect(bar).toBeHidden({ timeout: 25_000 });

    const noticeRows = page.getByTestId("subagent-notice-row");
    await expect(noticeRows.first()).toBeVisible({ timeout: 15_000 });
    if (stack.screenshotDir) {
      await page.screenshot({ path: `${stack.screenshotDir}/03-notice-dark.png` });
    }
    const allPageText = await page.locator("body").innerText();
    expect(allPageText).toContain("Research Assistant selesai");
    expect(allPageText).toContain("Audio Producer selesai");
    expect(allPageText).toContain("Laporan wakeup");
    // Raw synthetic XML notification tag must never leak to UI DOM.
    expect(allPageText).not.toContain("<subagent-notification");

    // Verify backend job persistence endpoint matches completed states.
    const sessRes = await fetch(
      `${stack.engineUrl}/api/session?directory=${encodeURIComponent(stack.workspaceDir)}`,
      { headers: { Authorization: stack.authHeader } },
    );
    const sessJson = (await sessRes.json()) as { data?: Array<{ id: string }> };
    const sessionId = sessJson.data?.[0]?.id;
    expect(sessionId).toBeTruthy();

    const jobsRes = await fetch(`${stack.engineUrl}/api/session/${sessionId}/jobs`, {
      headers: { Authorization: stack.authHeader },
    });
    const jobsJson = (await jobsRes.json()) as { data?: Array<{ status: string }> };
    expect((jobsJson.data ?? []).filter((j) => j.status === "completed").length).toBeGreaterThanOrEqual(2);

    expect(stack.mockLlm.getCallCounts().parentWake).toBeGreaterThanOrEqual(1);
    expect(appErrors).toEqual([]);
  });

  test("handles upstream provider error gracefully without crashing or reloading window", async ({
    page,
  }) => {
    const appErrors: string[] = [];
    page.on("pageerror", (err) => appErrors.push(`pageerror: ${err.message}`));

    await page.addInitScript(
      ({ workspaceDir }: { workspaceDir: string }) => {
        localStorage.setItem("aetheria_active_folder", workspaceDir);
        localStorage.setItem("aetheria_active_provider", "e2e-mock");
        localStorage.setItem("aetheria_active_model", "e2e-fast");
        localStorage.setItem("aetheria_provider_model_e2e-mock", "e2e-fast");
        localStorage.setItem("aetheria_provider_models_e2e-mock", "e2e-fast");
      },
      { workspaceDir: stack.workspaceDir },
    );

    await page.goto(`/?folder=${encodeURIComponent(stack.workspaceDir)}`);

    // Set navigation sentinel so any full window reload resets it.
    await page.evaluate(() => {
      (window as unknown as { __e2eNoReload?: boolean }).__e2eNoReload = true;
    });

    stack.mockLlm.setFailNext("Provider validation error (E2E failure path)");

    const textarea = page.locator("textarea");
    await expect(textarea).toBeVisible();
    await textarea.fill("Pemicu error provider");
    await page.getByTitle("Send message").click();

    await expect(page.locator("body")).toContainText("Provider validation error", {
      timeout: 15_000,
    });
    if (stack.screenshotDir) {
      await page.screenshot({ path: `${stack.screenshotDir}/04-error-dark.png` });
    }

    // Window did not reload and chat box remains interactive.
    const noReload = await page.evaluate(
      () => (window as unknown as { __e2eNoReload?: boolean }).__e2eNoReload,
    );
    expect(noReload).toBe(true);
    await expect(textarea).toBeVisible();
    expect(appErrors).toEqual([]);
  });
});

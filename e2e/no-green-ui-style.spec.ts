import { test, expect, type Page } from "@playwright/test";
import { startLiveStack, type LiveStack } from "./live-stack.mjs";

const BANNED_CLASS_RE = /\b(?:bg|text|border|ring|accent|stroke|fill|from|to|via)-(?:emerald|green|teal)-/;
const BANNED_HEX_RE = /#(?:10b981|34d399|059669|22c55e|16a34a|4ade80|047857|065f46|064e3b|a7f3d0|6ee7b7|ecfdf5)\b/i;

async function applyTheme(page: Page, theme: "dark" | "light" | "neobrutalism") {
  await page.evaluate((t) => {
    document.documentElement.setAttribute("data-theme", t);
    document.documentElement.classList.remove("light", "dark", "neobrutalism");
    if (t === "neobrutalism") {
      document.documentElement.classList.add("light", "neobrutalism");
    } else {
      document.documentElement.classList.add(t);
    }
  }, theme);
}

async function assertNoGreenTokensInDom(page: Page) {
  const violations = await page.evaluate(
    ({ classPattern, hexPattern }) => {
      const classRe = new RegExp(classPattern);
      const hexRe = new RegExp(hexPattern, "i");
      const found: string[] = [];
      const all = document.querySelectorAll("*");
      for (const el of all) {
        const cls = typeof el.className === "string" ? el.className : "";
        if (cls && classRe.test(cls)) {
          found.push(`class violation on <${el.tagName.toLowerCase()}>: ${cls}`);
        }
        const styleAttr = el.getAttribute("style") || "";
        if (styleAttr && hexRe.test(styleAttr)) {
          found.push(`style hex violation on <${el.tagName.toLowerCase()}>: ${styleAttr}`);
        }
        const cs = getComputedStyle(el);
        for (const prop of ["color", "borderTopColor", "backgroundColor"] as const) {
          const val = cs[prop];
          if (val === "rgb(16, 185, 129)" || val === "rgb(52, 211, 153)" || val === "rgb(5, 150, 105)" || val === "rgb(34, 197, 94)") {
            found.push(`computed ${prop} green violation on <${el.tagName.toLowerCase()}>: ${val}`);
          }
        }
      }
      return found.slice(0, 10);
    },
    { classPattern: BANNED_CLASS_RE.source, hexPattern: BANNED_HEX_RE.source },
  );
  expect(violations).toEqual([]);
}

test.describe("UI Compliance: Zero Green/Emerald & Tool Pill Radius Parity (Real Engine + Browser)", () => {
  let stack: LiveStack;

  test.beforeEach(async () => {
    stack = await startLiveStack();
  });

  test.afterEach(async () => {
    await stack?.stop();
  });

  test("renders zero emerald/green tokens and matching pill border-radius across all themes", async ({
    page,
  }) => {
    const appErrors: string[] = [];
    page.on("pageerror", (err) => appErrors.push(`pageerror: ${err.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error" && !msg.text().includes("fonts.googleapis.com")) {
        appErrors.push(`console.error: ${msg.text()}`);
      }
    });

    await page.addInitScript(
      ({ workspaceDir }: { workspaceDir: string }) => {
        if (!sessionStorage.getItem("__e2e_init_ui")) {
          localStorage.setItem("aetheria_active_folder", workspaceDir);
          localStorage.setItem("aetheria_active_provider", "e2e-mock");
          localStorage.setItem("aetheria_active_model", "e2e-fast");
          localStorage.setItem("aetheria_provider_model_e2e-mock", "e2e-fast");
          localStorage.setItem("aetheria_provider_models_e2e-mock", "e2e-fast");
          localStorage.setItem("aetheria_theme", "dark");
          sessionStorage.setItem("__e2e_init_ui", "1");
        }
      },
      { workspaceDir: stack.workspaceDir },
    );

    await page.goto(`/?folder=${encodeURIComponent(stack.workspaceDir)}`);
    const textarea = page.locator("textarea");
    await expect(textarea).toBeVisible();

    await assertNoGreenTokensInDom(page);

    // Trigger multi-subagent studio flow so both SubagentActivityBar & Executed tasks pill render.
    await textarea.fill("Tolong riset motion dan siapkan audio scene 1 secara paralel.");
    await page.getByTitle("Send message").click();

    const bar = page.getByTestId("subagent-activity-bar");
    await expect(bar).toBeVisible({ timeout: 20_000 });
    await assertNoGreenTokensInDom(page);

    // Inspect active floating pill + executed task pills across all 3 CSS themes.
    for (const theme of ["dark", "light", "neobrutalism"] as const) {
      await applyTheme(page, theme);
      await assertNoGreenTokensInDom(page);
      if (stack.screenshotDir) {
        await page.screenshot({ path: `${stack.screenshotDir}/ui-active-${theme}.png` });
      }
    }

    await applyTheme(page, "dark");
    await expect(bar).toBeHidden({ timeout: 25_000 });

    const noticeRows = page.getByTestId("subagent-notice-row");
    await expect(noticeRows.first()).toBeVisible({ timeout: 15_000 });
    await assertNoGreenTokensInDom(page);

    // Verify "Executed X/Y studio task(s)" pill uses pill rounding when collapsed & card rounding when expanded.
    const toolBtn = page.locator("button", { hasText: /Executed \d+\/\d+ studio task/ }).first();
    await expect(toolBtn).toBeVisible({ timeout: 15_000 });
    const toolCard = toolBtn.locator("..");

    const collapsedRadius = await toolCard.evaluate((el) =>
      parseFloat(getComputedStyle(el).borderTopLeftRadius || "0"),
    );
    expect(collapsedRadius).toBeGreaterThanOrEqual(20);

    await toolBtn.click();
    const expandedRadius = await toolCard.evaluate((el) =>
      parseFloat(getComputedStyle(el).borderTopLeftRadius || "0"),
    );
    expect(expandedRadius).toBeLessThanOrEqual(14);
    await toolBtn.click();

    for (const theme of ["dark", "light", "neobrutalism"] as const) {
      await applyTheme(page, theme);
      await assertNoGreenTokensInDom(page);
      if (stack.screenshotDir) {
        await page.screenshot({ path: `${stack.screenshotDir}/ui-completed-${theme}.png` });
      }
    }

    expect(appErrors).toEqual([]);
  });

  test("keeps clean non-green UI without reload on provider error", async ({ page }) => {
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
    await page.evaluate(() => {
      (window as unknown as { __e2eNoReload?: boolean }).__e2eNoReload = true;
    });

    stack.mockLlm.setFailNext("Provider validation error (UI style E2E)");
    const textarea = page.locator("textarea");
    await expect(textarea).toBeVisible();
    await textarea.fill("Pemicu error");
    await page.getByTitle("Send message").click();

    await expect(page.locator("body")).toContainText("Provider validation error", { timeout: 15_000 });
    await assertNoGreenTokensInDom(page);
    if (stack.screenshotDir) {
      await page.screenshot({ path: `${stack.screenshotDir}/ui-error-dark.png` });
    }

    const noReload = await page.evaluate(
      () => (window as unknown as { __e2eNoReload?: boolean }).__e2eNoReload,
    );
    expect(noReload).toBe(true);
    expect(appErrors).toEqual([]);
  });
});


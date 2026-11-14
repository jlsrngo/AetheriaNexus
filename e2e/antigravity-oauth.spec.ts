import http from "node:http";
import { test, expect } from "@playwright/test";
import { startLiveStack, type LiveStack } from "./live-stack.mjs";

interface MockGoogleOAuthServer {
  baseUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  loadProjectUrl: string;
  tokenRequests: Array<Record<string, string>>;
  close: () => Promise<void>;
}

interface LocalCliStatusResponse {
  sources?: {
    antigravity?: {
      connected?: boolean;
      autoHarvested?: boolean;
      accountEmail?: string | null;
    };
  };
  data?: {
    antigravity?: {
      loggedIn?: boolean;
    };
    discovered?: Array<{
      provider?: string;
      sourcePath?: string;
    }>;
  };
}

interface LocalCliRefreshResponse {
  data?: {
    success?: boolean;
  };
}

async function startMockGoogleOAuthServer(): Promise<MockGoogleOAuthServer> {
  const tokenRequests: Array<Record<string, string>> = [];

  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const urlPath = (req.url || "").split("?")[0];

      if (req.method === "POST" && urlPath === "/oauth2/token") {
        const raw = Buffer.concat(chunks).toString("utf8");
        const params = Object.fromEntries(new URLSearchParams(raw).entries());
        tokenRequests.push(params);

        if (params.grant_type === "authorization_code") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              access_token: "agy-access-independent-1",
              refresh_token: "agy-refresh-independent-1",
              expires_in: 3600,
              token_type: "Bearer",
            }),
          );
          return;
        }

        if (params.grant_type === "refresh_token") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              access_token: "agy-access-refreshed-2",
              expires_in: 7200,
              token_type: "Bearer",
            }),
          );
          return;
        }

        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "unsupported_grant_type" }));
        return;
      }

      if (req.method === "GET" && urlPath === "/oauth2/userinfo") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            email: "independent-oauth@example.com",
            verified_email: true,
          }),
        );
        return;
      }

      if (req.method === "POST" && urlPath === "/v1internal:loadCodeAssist") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            cloudaicompanionProject: { id: "independent-proj-42" },
          }),
        );
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not_found" }));
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    baseUrl,
    tokenUrl: `${baseUrl}/oauth2/token`,
    userinfoUrl: `${baseUrl}/oauth2/userinfo`,
    loadProjectUrl: `${baseUrl}/v1internal:loadCodeAssist`,
    tokenRequests,
    close: async () => {
      server.closeAllConnections?.();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

test.describe("Antigravity Independent Browser OAuth E2E (Real Engine + Browser)", () => {
  let stack: LiveStack;
  let mockGoogle: MockGoogleOAuthServer;

  test.beforeEach(async () => {
    mockGoogle = await startMockGoogleOAuthServer();
    stack = await startLiveStack({
      env: {
        AETHERIA_ANTIGRAVITY_TOKEN_URL: mockGoogle.tokenUrl,
        AETHERIA_ANTIGRAVITY_USERINFO_URL: mockGoogle.userinfoUrl,
        AETHERIA_ANTIGRAVITY_LOAD_PROJECT_URL: mockGoogle.loadProjectUrl,
      },
    });
  });

  test.afterEach(async () => {
    await stack?.stop();
    await mockGoogle?.close();
  });

  test("signs in with an independent Google account via Browser OAuth, refreshes without overwrite, persists sign-out, and rejects invalid state", async ({
    page,
    context,
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

    // Prevent real external network navigations if window.open opens accounts.google.com.
    await context.route("https://accounts.google.com/**", (route) => route.abort());

    await page.addInitScript(
      ({ workspaceDir }: { workspaceDir: string }) => {
        if (!sessionStorage.getItem("__e2e_init")) {
          localStorage.setItem("aetheria_active_folder", workspaceDir);
          localStorage.setItem("aetheria_theme", "dark");
          localStorage.setItem("aetheria_lang", "en");
          sessionStorage.setItem("__e2e_init", "1");
        }
      },
      { workspaceDir: stack.workspaceDir },
    );

    await page.goto(`/settings?folder=${encodeURIComponent(stack.workspaceDir)}`);

    // Switch to CLI Bridges tab inside Settings.
    const cliTabBtn = page.getByRole("button", { name: /CLI Bridges/i });
    await expect(cliTabBtn).toBeVisible();
    await cliTabBtn.click();

    // Locate the Google Antigravity CLI card container (`.last()` picks the innermost card div).
    const agyCard = page
      .locator("div")
      .filter({ has: page.locator("span", { hasText: /^Google Antigravity CLI$/ }) })
      .filter({ hasText: "Google DeepMind" })
      .filter({ has: page.getByRole("button", { name: /Test Ping|Uji Ping/i }) })
      .last();
    await expect(agyCard).toBeVisible();

    // Expand the Antigravity card.
    const expandBtn = agyCard.locator('button[title*="Expand"], button[title*="Buka"]').first();
    await expandBtn.click();

    // Start Browser OAuth via the real button inside the card (either Sign in with browser or Switch account).
    const browserOAuthBtn = agyCard.getByRole("button", {
      name: /Sign in with browser|Switch account \(Browser\)|Re-authenticate via browser|Masuk via browser|Ganti akun \(Browser\)/i,
    });
    await expect(browserOAuthBtn).toBeVisible();

    const startRespPromise = page.waitForResponse(
      (res) => res.url().includes("/api/providers/local-cli/oauth/start") && res.request().method() === "POST",
    );
    await browserOAuthBtn.click();
    const startResp = await startRespPromise;
    expect(startResp.ok()).toBe(true);
    const startJson = (await startResp.json()) as {
      data?: { requestId?: string; authUrl?: string; target?: string };
    };
    expect(startJson.data?.target).toBe("antigravity");
    const authUrlStr = startJson.data?.authUrl ?? "";
    expect(authUrlStr).toContain("accounts.google.com/o/oauth2/v2/auth");

    const authUrl = new URL(authUrlStr);
    expect(authUrl.searchParams.get("access_type")).toBe("offline");
    expect(authUrl.searchParams.get("prompt")).toBe("select_account consent");
    const redirectUri = authUrl.searchParams.get("redirect_uri") ?? "";
    const oauthState = authUrl.searchParams.get("state") ?? "";
    expect(redirectUri).toMatch(/^http:\/\/localhost:\d+\/oauth-callback$/);
    expect(oauthState.length).toBeGreaterThan(8);

    // Simulate Google redirecting back to the ephemeral loopback listener with a URL-encoded slash in code.
    const cbRes = await fetch(
      `${redirectUri}?code=${encodeURIComponent("4/0Aan-test-code")}&state=${encodeURIComponent(oauthState)}`,
    );
    expect(cbRes.status).toBe(200);

    // Wait for the UI to reflect the independent Browser OAuth email.
    await expect(agyCard).toContainText("independent-oauth@example.com", { timeout: 15_000 });
    await expect(agyCard).toContainText(/Connected|Terhubung/i);

    // Check theme rendering across all 3 themes defined in index.css.
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
      const box = await agyCard.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThan(200);
      expect(box?.height ?? 0).toBeGreaterThan(80);
      if (stack.screenshotDir) {
        await page.screenshot({ path: `${stack.screenshotDir}/agy-connected-${theme}.png` });
      }
    }

    // Verify backend state via HTTP API: autoHarvested must be false and independent email preserved.
    const statusRes1 = await fetch(`${stack.engineUrl}/api/providers/local-cli/status`, {
      headers: { Authorization: stack.authHeader },
    });
    expect(statusRes1.ok).toBe(true);
    const statusJson1 = (await statusRes1.json()) as LocalCliStatusResponse;
    expect(statusJson1.sources?.antigravity?.connected).toBe(true);
    expect(statusJson1.sources?.antigravity?.autoHarvested).toBe(false);
    expect(statusJson1.sources?.antigravity?.accountEmail).toBe("independent-oauth@example.com");
    const agyDisc = statusJson1.data?.discovered?.find((d) => d.provider === "antigravity");
    expect(agyDisc?.sourcePath).toContain("Browser OAuth");

    // Trigger token refresh via UI button and confirm OAuth refresh_token is used without PC overwrite.
    const refreshBtn = agyCard.getByRole("button", { name: /Refresh token|Perbarui token/i });
    await expect(refreshBtn).toBeVisible();
    const refreshRespPromise = page.waitForResponse(
      (res) => res.url().includes("/api/providers/local-cli/refresh") && res.request().method() === "POST",
    );
    await refreshBtn.click();
    const refreshResp = await refreshRespPromise;
    expect(refreshResp.ok()).toBe(true);
    const refreshJson = (await refreshResp.json()) as LocalCliRefreshResponse;
    expect(refreshJson.data?.success).toBe(true);

    expect(mockGoogle.tokenRequests.some((r) => r.grant_type === "refresh_token")).toBe(true);

    const statusResAfterRefresh = await fetch(`${stack.engineUrl}/api/providers/local-cli/status`, {
      headers: { Authorization: stack.authHeader },
    });
    const statusJsonAfterRefresh = (await statusResAfterRefresh.json()) as LocalCliStatusResponse;
    expect(statusJsonAfterRefresh.sources?.antigravity?.autoHarvested).toBe(false);
    expect(statusJsonAfterRefresh.sources?.antigravity?.accountEmail).toBe("independent-oauth@example.com");

    // Sign out via the card UI and confirm subsequent status polls do NOT re-harvest PC credentials.
    const signOutBtn = agyCard.getByRole("button", { name: /Sign out|Keluar/i });
    await expect(signOutBtn).toBeVisible();
    await signOutBtn.click();

    await expect(agyCard).toContainText(/Sign-in needed|Perlu login/i, { timeout: 10_000 });
    await expect(agyCard).not.toContainText("independent-oauth@example.com");
    if (stack.screenshotDir) {
      await page.screenshot({ path: `${stack.screenshotDir}/agy-signedout-neobrutalism.png` });
    }

    const statusAfterLogout = await fetch(`${stack.engineUrl}/api/providers/local-cli/status`, {
      headers: { Authorization: stack.authHeader },
    });
    const logoutJson = (await statusAfterLogout.json()) as LocalCliStatusResponse;
    expect(logoutJson.sources?.antigravity?.connected).toBe(false);
    expect(logoutJson.data?.antigravity?.loggedIn).toBe(false);

    // Negative test: invalid OAuth callback state must cleanly report error without crashing.
    const badStartRes = await fetch(`${stack.engineUrl}/api/providers/local-cli/oauth/start`, {
      method: "POST",
      headers: {
        Authorization: stack.authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ target: "antigravity", openBrowser: false }),
    });
    expect(badStartRes.ok).toBe(true);
    const badStartJson = (await badStartRes.json()) as {
      data?: { requestId?: string; authUrl?: string };
    };
    const badAuthUrl = new URL(badStartJson.data?.authUrl ?? "");
    const badRedirect = badAuthUrl.searchParams.get("redirect_uri") ?? "";
    const badReqId = badStartJson.data?.requestId ?? "";

    await fetch(`${badRedirect}?code=some-code&state=wrong-state`);

    let badStatus: { status?: string; message?: string } = {};
    for (let i = 0; i < 20; i++) {
      const probeRes = await fetch(`${stack.engineUrl}/api/providers/local-cli/oauth/status`, {
        method: "POST",
        headers: {
          Authorization: stack.authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requestId: badReqId }),
      });
      const probeJson = (await probeRes.json()) as { data?: { status?: string; message?: string } };
      badStatus = probeJson.data ?? {};
      if (badStatus.status === "error" || badStatus.status === "success") break;
      await new Promise((r) => setTimeout(r, 150));
    }
    expect(badStatus.status).toBe("error");
    expect(badStatus.message).toContain("Invalid OAuth state");

    const finalHealth = await fetch(`${stack.engineUrl}/api/health`, {
      headers: { Authorization: stack.authHeader },
    });
    expect(finalHealth.ok).toBe(true);
    expect(appErrors).toEqual([]);
  });
});

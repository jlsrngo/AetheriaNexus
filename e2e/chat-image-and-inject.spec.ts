import http from "node:http";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { startLiveStack, type LiveStack } from "./live-stack.mjs";

const TINY_PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8m0AAAAASUVORK5CYII=",
  "base64"
);

interface RecordedChatRequest {
  model?: string;
  messages: Array<{ role?: string; content?: unknown }>;
}

async function startCustomMockLlm() {
  const requests: RecordedChatRequest[] = [];

  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", async () => {
      if (req.url?.endsWith("/models")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            data: [
              { id: "glm-4-7-flash:free", object: "model" },
              { id: "e2e-vision", object: "model" },
            ],
          })
        );
        return;
      }

      const payload = JSON.parse(Buffer.concat(chunks).toString("utf8")) as RecordedChatRequest;
      const msgs = Array.isArray(payload.messages) ? payload.messages : [];
      requests.push({ model: payload.model, messages: msgs });

      const lastMsg = msgs[msgs.length - 1];
      const lastText =
        typeof lastMsg?.content === "string"
          ? lastMsg.content
          : JSON.stringify(lastMsg?.content ?? "");
      const joined = JSON.stringify(msgs);

      if (lastText.includes("mulai turn 1 lambat")) {
        await new Promise((r) => setTimeout(r, 1800));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            choices: [
              {
                finish_reason: "stop",
                message: {
                  role: "assistant",
                  content: "Turn 1 step awal selesai.",
                },
              },
            ],
          })
        );
        return;
      }

      if (lastText.includes("[Mid-Turn User Steer]: tolong ubah arah sekarang")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            choices: [
              {
                finish_reason: "stop",
                message: {
                  role: "assistant",
                  content: "Steer mid-turn diterapkan.",
                },
              },
            ],
          })
        );
        return;
      }

      if (joined.includes("antrikan dengan gambar")) {
        const hasImagePart = msgs.some(
          (m) =>
            Array.isArray(m.content) &&
            m.content.some(
              (p: { type?: string; image_url?: { url?: string } }) =>
                p?.type === "image_url" && p?.image_url?.url?.startsWith("data:image/png")
            )
        );
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            choices: [
              {
                finish_reason: "stop",
                message: {
                  role: "assistant",
                  content: hasImagePart
                    ? "Gambar dari antrian diterima dengan aman."
                    : "Gambar dari antrian tidak terbaca.",
                },
              },
            ],
          })
        );
        return;
      }

      if (joined.includes("buat gini visualnya bisa ga?")) {
        const hasTextOnlyNotice = joined.includes(
          "Active model 'glm-4-7-flash:free' is text-only"
        );
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            choices: [
              {
                finish_reason: "stop",
                message: {
                  role: "assistant",
                  content: hasTextOnlyNotice
                    ? "Model aktif hanya mendukung teks sehingga gambar tidak bisa dilihat langsung."
                    : "Notice text-only tidak terkirim.",
                },
              },
            ],
          })
        );
        return;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          choices: [
            {
              finish_reason: "stop",
              message: { role: "assistant", content: "OK." },
            },
          ],
        })
      );
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const addr = server.address();
  if (!addr || typeof addr === "string") {
    throw new Error("Mock LLM failed to listen");
  }

  return {
    url: `http://127.0.0.1:${addr.port}/v1`,
    requests,
    close: async () => {
      server.closeAllConnections?.();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

test.describe("Chat Image Persistence, Text-Only Notice & Mid-Turn Inject E2E", () => {
  let stack: LiveStack;
  let mockLlm: Awaited<ReturnType<typeof startCustomMockLlm>>;

  const netLogs: string[] = [];
  const consoleLogs: string[] = [];

  test.beforeEach(async ({ page }) => {
    netLogs.length = 0;
    consoleLogs.length = 0;
    page.on("console", (m) => {
      if (m.type() === "error" || m.type() === "warning" || m.text().includes("useWorkstation")) {
        consoleLogs.push(`[${m.type()}] ${m.text()}`);
      }
    });
    page.on("response", (r) => {
      if (r.url().includes("/api/session")) {
        const pathname = new URL(r.url()).pathname;
        if (!pathname.endsWith("/jobs")) {
          netLogs.push(`${r.status()} ${r.request().method()} ${pathname}`);
        }
      }
    });
    mockLlm = await startCustomMockLlm();
    stack = await startLiveStack({
      aetheriaConfig: {
        provider: {
          "e2e-mock": {
            name: "E2E Mock Provider",
            type: "openai",
            options: {
              baseURL: mockLlm.url,
              apiKey: "e2e-key",
            },
            models: {
              "glm-4-7-flash:free": { name: "GLM-4.7 Flash Free (Text Only)" },
              "e2e-vision": {
                name: "E2E Vision Model",
                modalities: { input: ["text", "image"] },
              },
            },
          },
        },
      },
    });
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      console.error("=== E2E FAILURE DIAGNOSTICS ===");
      console.error("page.url:", page.url());
      console.error("netLogs:", netLogs.slice(-30).join(" | "));
      console.error("consoleLogs:", consoleLogs.slice(-20).join(" | "));
      console.error("mockLlm requests:", JSON.stringify(mockLlm?.requests ?? []));
      if (stack) {
        try {
          const act = await fetch(`${stack.engineUrl}/api/session/active`, {
            headers: { Authorization: stack.authHeader },
          }).then((r) => r.text());
          console.error("engine /api/session/active:", act);
        } catch {}
        console.error("engineLogs:\n", stack.engineLogs().slice(-2500));
      }
    }
    await stack?.stop();
    await mockLlm?.close();
  });

  test("keeps user images visible after reload and notifies text-only models honestly", async ({
    page,
  }) => {
    const appErrors: string[] = [];
    page.on("pageerror", (err) => appErrors.push(err.message));

    await page.addInitScript(
      ({ workspaceDir }: { workspaceDir: string }) => {
        if (!sessionStorage.getItem("__e2e_img_init")) {
          localStorage.setItem("aetheria_active_folder", workspaceDir);
          localStorage.setItem("aetheria_active_provider", "e2e-mock");
          localStorage.setItem("aetheria_active_model", "glm-4-7-flash:free");
          localStorage.setItem("aetheria_provider_model_e2e-mock", "glm-4-7-flash:free");
          localStorage.setItem(
            "aetheria_provider_models_e2e-mock",
            "glm-4-7-flash:free,e2e-vision"
          );
          sessionStorage.setItem("__e2e_img_init", "1");
        }
      },
      { workspaceDir: stack.workspaceDir }
    );

    await page.goto(`/?folder=${encodeURIComponent(stack.workspaceDir)}`);

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "visual_ref.png",
      mimeType: "image/png",
      buffer: TINY_PNG_BYTES,
    });

    const textarea = page.locator("textarea");
    await textarea.fill("buat gini visualnya bisa ga?");
    await page.getByTitle("Send message").click();

    await expect(
      page.getByText("Model aktif hanya mendukung teks sehingga gambar tidak bisa dilihat langsung.")
    ).toBeVisible({ timeout: 20_000 });

    const attachedImg = page.locator('img[alt="visual_ref.png"]');
    await expect(attachedImg).toBeVisible();
    await expect(page.getByTitle("Stop generating")).not.toBeVisible({ timeout: 10_000 });

    // Reload browser page -> messages load from Rust engine via ui_mapper.rs
    await page.reload();
    await expect(
      page.getByText("Model aktif hanya mendukung teks sehingga gambar tidak bisa dilihat langsung.")
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('img[alt="visual_ref.png"]')).toBeVisible({ timeout: 10_000 });
    expect(appErrors).toEqual([]);
  });

  test("preserves queued images across turns, injects mid-turn with Ctrl+Enter, and rejects invalid empty steer", async ({
    page,
  }) => {
    const appErrors: string[] = [];
    page.on("pageerror", (err) => appErrors.push(err.message));

    await page.addInitScript(
      ({ workspaceDir }: { workspaceDir: string }) => {
        if (!sessionStorage.getItem("__e2e_steer_init")) {
          localStorage.setItem("aetheria_active_folder", workspaceDir);
          localStorage.setItem("aetheria_active_provider", "e2e-mock");
          localStorage.setItem("aetheria_active_model", "e2e-vision");
          localStorage.setItem("aetheria_provider_model_e2e-mock", "e2e-vision");
          localStorage.setItem(
            "aetheria_provider_models_e2e-mock",
            "glm-4-7-flash:free,e2e-vision"
          );
          sessionStorage.setItem("__e2e_steer_init", "1");
        }
      },
      { workspaceDir: stack.workspaceDir }
    );

    await page.goto(`/?folder=${encodeURIComponent(stack.workspaceDir)}`);
    const textarea = page.locator("textarea");
    await expect(textarea).toBeVisible();

    // Start slow Turn 1 so streaming stays active
    await textarea.fill("mulai turn 1 lambat");
    await page.getByTitle("Send message").click();
    await expect(page.getByTitle("Stop generating")).toBeVisible({ timeout: 10_000 });

    // Queue a message with an attached PNG using Enter -> must preserve attachment in queue
    await page.locator('input[type="file"]').setInputFiles({
      name: "queued_ref.png",
      mimeType: "image/png",
      buffer: TINY_PNG_BYTES,
    });
    await textarea.fill("antrikan dengan gambar");
    await textarea.press("Enter");

    await expect(page.getByText("Message Queue (1)")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("antrikan dengan gambar")).toBeVisible();

    const screenshotDir = process.env.E2E_THEME_SCREENSHOT_DIR;
    if (screenshotDir) {
      for (const theme of ["dark", "light", "neobrutalism"] as const) {
        await page.evaluate((t) => {
          document.documentElement.setAttribute("data-theme", t);
        }, theme);
        await page.waitForTimeout(150);
        await page.screenshot({ path: path.join(screenshotDir, `chat-queue-${theme}.png`) });
      }
      await page.evaluate(() => {
        document.documentElement.setAttribute("data-theme", "dark");
      });
    }

    // Inject mid-turn instruction using Ctrl+Enter -> bypasses queue immediately
    await textarea.fill("tolong ubah arah sekarang");
    await textarea.press("Control+Enter");

    await expect(page.getByText("Steer mid-turn diterapkan.")).toBeVisible({ timeout: 20_000 });
    // After Turn 1 completes, queued message with image runs automatically and sends image_url part
    await expect(page.getByText("Gambar dari antrian diterima dengan aman.")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator('img[alt="queued_ref.png"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTitle("Stop generating")).not.toBeVisible({ timeout: 10_000 });

    // Error-path test: empty steer payload rejected cleanly with HTTP 400
    const badInbox = await fetch(`${stack.engineUrl}/api/session/ses_nonexistent/inbox`, {
      method: "POST",
      headers: {
        Authorization: stack.authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: "   ", delivery: "steer" }),
    });
    expect(badInbox.status).toBe(400);
    expect(appErrors).toEqual([]);
  });
});


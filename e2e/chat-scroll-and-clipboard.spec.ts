import http from "node:http";
import { test, expect } from "@playwright/test";
import { startLiveStack, type LiveStack } from "./live-stack.mjs";

async function startTallMockLlm() {
  const requests: Array<string> = [];
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      if (req.url?.endsWith("/models")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            data: [{ id: "mock-fast", object: "model" }],
          })
        );
        return;
      }

      const payload = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
        messages?: Array<{ role?: string; content?: unknown }>;
      };
      const msgs = Array.isArray(payload.messages) ? payload.messages : [];
      const lastMsg = msgs[msgs.length - 1];
      const lastText =
        typeof lastMsg?.content === "string"
          ? lastMsg.content
          : JSON.stringify(lastMsg?.content ?? "");
      requests.push(lastText.slice(0, 120));

      let tag = "other";
      if (lastText.includes("Pesan uji scroll 1")) tag = "Balasan ke-1";
      else if (lastText.includes("Pesan uji scroll 2")) tag = "Balasan ke-2";
      else if (lastText.includes("Pesan uji scroll 3")) tag = "Balasan ke-3";

      const lines = Array.from(
        { length: 28 },
        (_, i) => `- Baris respons panjang (${tag}) #${i + 1}: verifikasi scroll tetap bertahan di atas.`
      ).join("\n\n");

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          choices: [
            {
              finish_reason: "stop",
              message: {
                role: "assistant",
                content: `${tag}\n\n${lines}`,
              },
            },
          ],
        })
      );
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    close: async () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

test.describe("Chat Scroll-Up Lock & Non-Blocking Clipboard E2E", () => {
  let stack: LiveStack;
  let mockLlm: Awaited<ReturnType<typeof startTallMockLlm>>;

  test.beforeEach(async () => {
    mockLlm = await startTallMockLlm();
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
              "mock-fast": { name: "Mock Fast" },
            },
          },
        },
      },
    });
  });

  test.afterEach(async () => {
    await stack?.stop();
    await mockLlm?.close();
  });

  test("keeps scrolled-up chat position across polling ticks and lets Ctrl+V paste natively without clipboard read prompt", async ({
    page,
  }) => {
    const appErrors: string[] = [];
    page.on("pageerror", (err) => appErrors.push(err.message));

    await page.addInitScript(
      ({ workspaceDir }: { workspaceDir: string }) => {
        if (!sessionStorage.getItem("__e2e_scroll_clip_init")) {
          localStorage.setItem("aetheria_active_folder", workspaceDir);
          localStorage.setItem("aetheria_active_provider", "e2e-mock");
          localStorage.setItem("aetheria_active_model", "mock-fast");
          localStorage.setItem("aetheria_provider_model_e2e-mock", "mock-fast");
          sessionStorage.setItem("__e2e_scroll_clip_init", "1");
        }

        const win = window as unknown as {
          __clipboardAsyncReadCalls?: number;
          __nativePasteAllowedCount?: number;
        };
        win.__clipboardAsyncReadCalls = 0;
        win.__nativePasteAllowedCount = 0;

        if (navigator.clipboard) {
          const origReadText = navigator.clipboard.readText?.bind(navigator.clipboard);
          navigator.clipboard.readText = async () => {
            win.__clipboardAsyncReadCalls = (win.__clipboardAsyncReadCalls || 0) + 1;
            return origReadText ? origReadText() : "";
          };
          const origRead = navigator.clipboard.read?.bind(navigator.clipboard);
          navigator.clipboard.read = async () => {
            win.__clipboardAsyncReadCalls = (win.__clipboardAsyncReadCalls || 0) + 1;
            return origRead ? origRead() : [];
          };
        }

        window.addEventListener(
          "keydown",
          (ev) => {
            if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "v") {
              setTimeout(() => {
                if (!ev.defaultPrevented) {
                  win.__nativePasteAllowedCount = (win.__nativePasteAllowedCount || 0) + 1;
                }
              }, 0);
            }
          },
          false
        );
      },
      { workspaceDir: stack.workspaceDir }
    );

    await page.goto(`/?folder=${encodeURIComponent(stack.workspaceDir)}`);

    const chatBox = page.locator("textarea").first();
    await expect(chatBox).toBeVisible({ timeout: 20_000 });

    // 1. Verify Ctrl+V is NOT defaultPrevented by useGlobalShortcuts, triggers 0 async clipboard reads,
    // and pasting an image via desktop clipboard bridge attaches EXACTLY ONE image (never 2x/4x duplicates)
    await page.evaluate(() => {
      const tinyPng =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8m0AAAAASUVORK5CYII=";
      (window as unknown as { aetheriaDesktop?: unknown }).aetheriaDesktop = {
        readClipboardImage: async () => tinyPng,
      };
    });
    await chatBox.focus();
    await page.keyboard.press("Control+v");
    await page.waitForTimeout(200);

    const clipCounters = await page.evaluate(() => {
      const win = window as unknown as {
        __clipboardAsyncReadCalls?: number;
        __nativePasteAllowedCount?: number;
      };
      return {
        asyncReads: win.__clipboardAsyncReadCalls ?? 0,
        nativeAllowed: win.__nativePasteAllowedCount ?? 0,
      };
    });
    expect(clipCounters.asyncReads).toBe(0);
    expect(clipCounters.nativeAllowed).toBeGreaterThanOrEqual(1);
    await expect(page.locator('button[title="Remove file"]')).toHaveCount(1);
    await page.locator('button[title="Remove file"]').first().click();
    await expect(page.locator('button[title="Remove file"]')).toHaveCount(0);
    await page.evaluate(() => {
      delete (window as unknown as { aetheriaDesktop?: unknown }).aetheriaDesktop;
    });

    // 2. Send two turns to create a genuinely scrollable chat container
    await chatBox.fill("Pesan uji scroll 1");
    await chatBox.press("Enter");
    await expect(page.getByText("Balasan ke-1").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Send message" })).toBeVisible({ timeout: 20_000 });

    await chatBox.fill("Pesan uji scroll 2");
    await chatBox.press("Enter");
    await expect(page.getByText("Balasan ke-2").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Send message" })).toBeVisible({ timeout: 20_000 });

    // Locate the scrollable message container inside the chat aside
    const scrollInfo = await page.evaluate(() => {
      const aside = document.querySelector("textarea")?.closest("aside");
      const scroller = aside?.querySelector("div.overflow-y-auto") as HTMLElement | null;
      if (!scroller) return null;
      return {
        scrollHeight: scroller.scrollHeight,
        clientHeight: scroller.clientHeight,
        scrollTop: scroller.scrollTop,
      };
    });
    expect(scrollInfo).not.toBeNull();
    expect((scrollInfo?.scrollHeight ?? 0) - (scrollInfo?.clientHeight ?? 0)).toBeGreaterThan(200);

    // 3. Scroll up to top (y = 0) and wait past the 2s message polling interval
    await page.evaluate(() => {
      const aside = document.querySelector("textarea")?.closest("aside");
      const scroller = aside?.querySelector("div.overflow-y-auto") as HTMLElement | null;
      if (scroller) {
        scroller.scrollTop = 0;
        scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
      }
    });
    await page.waitForTimeout(2600);

    const scrollTopAfterPoll = await page.evaluate(() => {
      const aside = document.querySelector("textarea")?.closest("aside");
      const scroller = aside?.querySelector("div.overflow-y-auto") as HTMLElement | null;
      return scroller?.scrollTop ?? -1;
    });
    expect(scrollTopAfterPoll).toBeLessThan(80);

    // 4. Scroll back down to bottom, send Turn 3, and confirm auto-scroll follows bottom again
    await page.evaluate(() => {
      const aside = document.querySelector("textarea")?.closest("aside");
      const scroller = aside?.querySelector("div.overflow-y-auto") as HTMLElement | null;
      if (scroller) {
        scroller.scrollTop = scroller.scrollHeight;
        scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
      }
    });
    await chatBox.fill("Pesan uji scroll 3");
    await chatBox.press("Enter");
    await expect(page.getByText("Balasan ke-3").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Send message" })).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(150);

    const distanceAfterTurn3 = await page.evaluate(() => {
      const aside = document.querySelector("textarea")?.closest("aside");
      const scroller = aside?.querySelector("div.overflow-y-auto") as HTMLElement | null;
      if (!scroller) return 9999;
      return scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    });
    expect(distanceAfterTurn3).toBeLessThan(120);
    expect(appErrors).toEqual([]);
  });
});

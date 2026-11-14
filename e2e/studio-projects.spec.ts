import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { startLiveStack, type LiveStack } from "./live-stack.mjs";

function writeMinimalFilmHtml(dir: string, title: string) {
  fs.mkdirSync(path.join(dir, "script"), { recursive: true });
  fs.mkdirSync(path.join(dir, "audio"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "script", "scene1.js"),
    `(function(){ AM.registerScene("scene1", { render: function(ctx) { ctx.fillStyle = "#fef08a"; ctx.fillRect(0,0,1080,1920); } }); })();\n`
  );
  fs.writeFileSync(
    path.join(dir, "index.html"),
    `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${title}</title></head>
<body>
<canvas id="stage-hud" width="1080" height="1920"></canvas>
<script src="/script/aetheria-motion.js"></script>
<script src="/script/scene1.js"></script>
<script>
window.__filmMeta = { title: ${JSON.stringify(title)}, width: 1080, height: 1920, fps: 30, duration: 4, scenes: [{ id: "scene1", duration: 4 }] };
window.renderAt = function() {};
window.__ready = true;
</script>
</body>
</html>`
  );
}

test.describe("Studio Per-Video Project Subfolders E2E", () => {
  let stack: LiveStack;

  test.beforeEach(async () => {
    stack = await startLiveStack();
  });

  test.afterEach(async () => {
    await stack?.stop();
  });

  test("creates, switches, and deletes isolated video project subfolders without touching others", async ({
    page,
  }) => {
    const appErrors: string[] = [];
    page.on("pageerror", (err) => appErrors.push(err.message));

    await page.addInitScript(
      ({ workspaceDir }: { workspaceDir: string }) => {
        localStorage.setItem("aetheria_active_folder", workspaceDir);
      },
      { workspaceDir: stack.workspaceDir }
    );

    await page.goto("/");

    // Create first project via UI
    const newBtn = page.getByRole("button", { name: "New video project" });
    await expect(newBtn).toBeVisible({ timeout: 20000 });
    await newBtn.click();

    const titleInput = page.getByRole("textbox", { name: "New video project title" });
    await titleInput.fill("Mayat yang Menipu Hitler");
    await page.getByRole("button", { name: "Create video project" }).click();

    const proj1Dir = path.join(stack.workspaceDir, "projects", "mayat-yang-menipu-hitler");
    await expect.poll(() => fs.existsSync(proj1Dir)).toBe(true);
    writeMinimalFilmHtml(proj1Dir, "Mayat yang Menipu Hitler");

    const selector = page.getByRole("combobox", { name: "Active video project" });
    await expect(selector).toBeVisible({ timeout: 10000 });
    await expect(selector).toHaveValue("mayat-yang-menipu-hitler");

    // Create second project via UI
    await newBtn.click();
    await expect(titleInput).toBeVisible({ timeout: 10000 });
    await titleInput.fill("Video Kedua");
    await page.getByRole("button", { name: "Create video project" }).click();

    const proj2Dir = path.join(stack.workspaceDir, "projects", "video-kedua");
    await expect.poll(() => fs.existsSync(proj2Dir)).toBe(true);
    writeMinimalFilmHtml(proj2Dir, "Video Kedua");

    // Verify dropdown lists both and active project is video-kedua
    await expect(selector).toHaveValue("video-kedua", { timeout: 10000 });

    // Switch to first project via dropdown
    await selector.selectOption("mayat-yang-menipu-hitler");
    await expect(selector).toHaveValue("mayat-yang-menipu-hitler");

    // Verify engine film-meta now resolves to proj1
    const meta1Res = await fetch(
      `${stack.engineUrl}/api/studio/film-meta?directory=${encodeURIComponent(stack.workspaceDir)}`,
      { headers: { Authorization: stack.authHeader } }
    );
    expect(meta1Res.status).toBe(200);
    const meta1 = (await meta1Res.json()) as { title?: string };
    expect(meta1.title).toBe("Mayat yang Menipu Hitler");

    // Delete first project via UI without touching video-kedua
    await page.getByRole("button", { name: "Delete active video project" }).click();
    await page.getByRole("button", { name: "Confirm delete active video project" }).click();

    await expect.poll(() => fs.existsSync(proj1Dir)).toBe(false);
    expect(fs.existsSync(path.join(proj2Dir, "index.html"))).toBe(true);
    await expect(selector).toHaveValue("video-kedua");

    // Negative / failure path: path traversal delete must fail cleanly with HTTP 400
    const badDelRes = await fetch(
      `${stack.engineUrl}/api/studio/projects/delete?directory=${encodeURIComponent(stack.workspaceDir)}`,
      {
        method: "POST",
        headers: {
          Authorization: stack.authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ project: "../outside" }),
      }
    );
    expect(badDelRes.status).toBe(400);
    const badJson = (await badDelRes.json()) as { error?: string };
    expect(badJson.error).toContain("Invalid project slug");

    expect(appErrors.filter((e) => !e.includes("sandboxed"))).toEqual([]);
  });
});

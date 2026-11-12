import { describe, expect, it } from "vitest";
import {
  buildSandboxStageBridgeScript,
  isTrustedStageMessageSource,
  normalizeSandboxedAssetPath,
} from "./htmlStageBridge";

describe("htmlStageBridge", () => {
  it("accepts only safe relative workspace asset paths and rejects traversal or API proxy attempts", () => {
    expect(normalizeSandboxedAssetPath("img/bg.png")).toBe("img/bg.png");
    expect(normalizeSandboxedAssetPath("./audio/scene1.wav?t=123")).toBe("audio/scene1.wav");
    expect(normalizeSandboxedAssetPath("/api/studio/ws-asset/assets/data.json?directory=E:/WS")).toBe(
      "assets/data.json",
    );

    expect(normalizeSandboxedAssetPath("../../etc/passwd")).toBeNull();
    expect(normalizeSandboxedAssetPath("img/../secret.png")).toBeNull();
    expect(normalizeSandboxedAssetPath("/api/providers")).toBeNull();
    expect(normalizeSandboxedAssetPath("http://127.0.0.1:4196/api/health")).toBeNull();
    expect(normalizeSandboxedAssetPath("file:///C:/Windows/win.ini")).toBeNull();
    expect(normalizeSandboxedAssetPath("index.html")).toBeNull();
  });

  it("verifies message source matches expected iframe window", () => {
    const fakeWin = { name: "iframe" } as unknown as Window;
    const otherWin = { name: "attacker" } as unknown as Window;

    expect(isTrustedStageMessageSource(fakeWin, fakeWin)).toBe(true);
    expect(isTrustedStageMessageSource(otherWin, fakeWin)).toBe(false);
    expect(isTrustedStageMessageSource(fakeWin, null)).toBe(false);
  });

  it("never embeds auth tokens or credentials in the injected bridge script", () => {
    const script = buildSandboxStageBridgeScript();
    expect(script).toContain("aetheria:renderAt");
    expect(script).toContain("aetheria:assetRequest");
    expect(script).not.toContain("Authorization");
    expect(script).not.toContain("aetheriaDesktop");
  });
});


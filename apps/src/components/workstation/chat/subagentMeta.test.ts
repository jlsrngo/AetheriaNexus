import { describe, it, expect } from "vitest";
import { Bot, FileSearch, Film, Image as ImageIcon, Mic } from "lucide-react";
import { getSubagentMeta } from "./subagentMeta";

describe("getSubagentMeta", () => {
  it("hides header badge for main/default agent turns", () => {
    expect(getSubagentMeta(undefined)).toBeNull();
    expect(getSubagentMeta("")).toBeNull();
    expect(getSubagentMeta("  ")).toBeNull();
    expect(getSubagentMeta("default")).toBeNull();
    expect(getSubagentMeta("main")).toBeNull();
  });

  it("maps known subagent roles to Lucide icons without emojis", () => {
    expect(getSubagentMeta("audio")).toEqual({
      name: "Audio Producer",
      Icon: Mic,
      color: "text-amber-400",
    });
    expect(getSubagentMeta("motion")).toEqual({
      name: "Motion Engineer",
      Icon: Film,
      color: "text-indigo-400",
    });
    expect(getSubagentMeta("assets")).toEqual({
      name: "Asset Curator",
      Icon: ImageIcon,
      color: "text-[var(--text-primary)]",
    });
    expect(getSubagentMeta("research")).toEqual({
      name: "Research Assistant",
      Icon: FileSearch,
      color: "text-sky-400",
    });
  });

  it("uses Bot icon fallback for custom subagent names", () => {
    expect(getSubagentMeta("script-reviewer")).toEqual({
      name: "script-reviewer",
      Icon: Bot,
      color: "text-[var(--text-secondary)]",
    });
  });
});


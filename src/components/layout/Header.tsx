import React from "react";
import { Search, Globe } from "lucide-react";
import { WindowControls } from "./WindowControls";
import { useI18n } from "../../lib/i18n";

export const Header: React.FC = () => {
  const { language, setLanguage, t } = useI18n();

  return (
    <header
      data-tauri-drag-region
      className="h-11 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between px-3 shrink-0 z-50 select-none cursor-move"
    >
      {/* Left: App Logo & VS Code Style Menu */}
      <div data-tauri-drag-region className="flex items-center gap-3">
        <div data-tauri-drag-region className="flex items-center gap-2">
          <span className="w-5 h-5 bg-white text-black font-mono font-black text-xs flex items-center justify-center">
            ⚡
          </span>
          <span data-tauri-drag-region className="font-mono font-bold text-xs text-white tracking-wider">
            ArunakiNexus
          </span>
        </div>

        <nav data-tauri-drag-region className="hidden md:flex items-center gap-1 font-mono text-xs text-neutral-400 ml-3">
          {[
            { key: "file", label: t("file") },
            { key: "edit", label: t("edit") },
            { key: "view", label: t("view") },
            { key: "studio", label: t("studio") },
            { key: "help", label: t("help") },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              className="px-2.5 py-1 hover:text-white hover:bg-neutral-900 text-neutral-400 transition-colors uppercase text-[11px] font-mono tracking-wide"
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Center: Command Center Title Bar */}
      <div
        data-tauri-drag-region
        className="flex-1 max-w-md mx-4 hidden sm:flex items-center justify-center"
      >
        <div
          data-tauri-drag-region
          className="w-full bg-neutral-900/80 border border-neutral-800 px-3 py-1 text-xs font-mono text-neutral-400 flex items-center justify-center gap-2"
        >
          <Search className="w-3 h-3 text-neutral-500 shrink-0" />
          <span data-tauri-drag-region className="truncate text-[11px]">
            {t("searchPlaceholder")}
          </span>
        </div>
      </div>

      {/* Right: Language Switcher & Window Controls */}
      <div className="flex items-center gap-2 h-full">
        <button
          type="button"
          onClick={() => setLanguage(language === "id" ? "en" : "id")}
          className="px-2 py-0.5 border border-neutral-800 bg-neutral-900 hover:bg-white hover:text-black text-neutral-300 font-mono text-[10px] font-bold flex items-center gap-1 transition-colors"
          title="Ganti Bahasa / Switch Language"
        >
          <Globe className="w-3 h-3" />
          <span>{language.toUpperCase()}</span>
        </button>
        <WindowControls />
      </div>
    </header>
  );
};

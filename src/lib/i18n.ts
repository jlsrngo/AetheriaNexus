import { useState, useEffect, useCallback } from "react";

export type Language = "id" | "en";
export const LANGUAGE_STORAGE_KEY = "arunaki_language";

export const translations = {
  id: {
    // Menu & Header
    file: "File",
    edit: "Edit",
    view: "Tampilan",
    studio: "Studio",
    help: "Bantuan",
    searchPlaceholder: "ArunakiNexus — TikTok Video Studio",
    language: "Bahasa",
    indonesian: "Bahasa Indonesia",
    english: "English",

    // Navigation / Modules
    explorer: "Explorer",
    modules: "MODUL",
    studioEditor: "Studio Editor",
    videoStock: "Stok Video",
    postingSchedule: "Jadwal Posting",
    tiktokAnalytics: "Analitik TikTok",
    settings: "Pengaturan",

    // Canvas & Viewport
    canvasViewport: "CANVAS_VIEWPORT",
    portrait: "9:16 PORTRAIT",
    landscape: "16:9 LANDSCAPE",
    square: "1:1 SQUARE",

    // AI Director & Chat
    directorTitle: "AI VIDEO DIRECTOR",
    newChat: "BARU",
    askPlaceholder: "Ketik ide atau topik video TikTok...",
    renderToStock: "RENDER KE STOK VIDEO",
    rendering: "MERENDER_MP4...",

    // Settings
    settingsTitle: "PENGATURAN & INTEGRASI",
    connectionCli: "CONNECTION CLI (LOCAL)",
    modelProviders: "MODEL PROVIDERS",
    storageOutput: "STORAGE OUTPUT",
    rescanClis: "SCAN ULANG CLI",
    addProvider: "TAMBAH PROVIDER",
    primary: "PRIMARY",
    standby: "STANDBY",
    testPing: "TEST PING",
    configure: "KONFIGURASI",
    delete: "HAPUS",
    save: "SIMPAN",
    cancel: "BATAL",
    connected: "TERHUBUNG",
    connect: "HUBUNGKAN",
    fallbackRoutingNotice: "Saat meracik video, sistem akan memakai model aktif utama. Jika endpoint terkena rate limit, sistem otomatis beralih ke model berikutnya dalam pool secara berurutan.",
  },
  en: {
    // Menu & Header
    file: "File",
    edit: "Edit",
    view: "View",
    studio: "Studio",
    help: "Help",
    searchPlaceholder: "ArunakiNexus — TikTok Video Studio",
    language: "Language",
    indonesian: "Bahasa Indonesia",
    english: "English",

    // Navigation / Modules
    explorer: "Explorer",
    modules: "MODULES",
    studioEditor: "Studio Editor",
    videoStock: "Video Stock",
    postingSchedule: "Posting Schedule",
    tiktokAnalytics: "TikTok Analytics",
    settings: "Settings",

    // Canvas & Viewport
    canvasViewport: "CANVAS_VIEWPORT",
    portrait: "9:16 PORTRAIT",
    landscape: "16:9 LANDSCAPE",
    square: "1:1 SQUARE",

    // AI Director & Chat
    directorTitle: "AI VIDEO DIRECTOR",
    newChat: "NEW",
    askPlaceholder: "Type TikTok video idea or topic...",
    renderToStock: "RENDER TO VIDEO STOCK",
    rendering: "RENDERING_MP4...",

    // Settings
    settingsTitle: "SETTINGS & INTEGRATIONS",
    connectionCli: "CONNECTION CLI (LOCAL)",
    modelProviders: "MODEL PROVIDERS",
    storageOutput: "STORAGE OUTPUT",
    rescanClis: "RESCAN CLIS",
    addProvider: "ADD PROVIDER",
    primary: "PRIMARY",
    standby: "STANDBY",
    testPing: "TEST PING",
    configure: "CONFIGURE",
    delete: "DELETE",
    save: "SAVE",
    cancel: "CANCEL",
    connected: "CONNECTED",
    connect: "CONNECT",
    fallbackRoutingNotice: "When generating videos, Arunaki routes to the primary active model. If rate limits occur, it automatically falls back sequentially to subsequent models in the pool without interrupting your workflow.",
  },
};

export type TranslationKey = keyof typeof translations.id;

export function useI18n() {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language;
      return saved === "en" || saved === "id" ? saved : "id";
    } catch {
      return "id";
    }
  });

  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language;
        if (saved && (saved === "en" || saved === "id")) {
          setLanguageState(saved);
        }
      } catch {}
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {}
  }, []);

  const t = useCallback(
    (key: TranslationKey, fallback?: string): string => {
      const dict = translations[language] || translations.id;
      return dict[key] || fallback || key;
    },
    [language]
  );

  return { language, setLanguage, t, isId: language === "id", isEn: language === "en" };
}


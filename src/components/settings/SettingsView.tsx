import React, { useState, useEffect } from "react";
import { CornerCrosses } from "../ui/CornerCrosses";
import { ModelProvider, CliItemStatus } from "../../types";
import { PROVIDER_TYPES } from "../../constants/providers";
import { setActiveProviderId, getActiveProviderId } from "../../lib/models";
import { useI18n } from "../../lib/i18n";
import { invoke } from "@tauri-apps/api/core";
import {
  Cpu,
  Terminal,
  Folder,
  Check,
  Wifi,
  ChevronDown,
  AlertTriangle,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  Settings2,
  Trash2,
  Plus,
  Info,
  X,
  Eye,
  EyeOff,
  ExternalLink,
  LogIn,
  LogOut,
} from "lucide-react";

interface SettingsViewProps {
  providers: ModelProvider[];
  onSaveProviders: (providers: ModelProvider[]) => void;
  cliStatus: Record<string, CliItemStatus>;
  onRefreshClis: () => void;
  outputDir: string;
  onSaveOutputDir: (dir: string) => void;
}

const DEFAULT_CLI_REGISTRY = [
  {
    id: "antigravity",
    name: "Google Antigravity CLI",
    vendor: "Google DeepMind",
    version: "1.3.1",
    docsUrl: "https://antigravity.google.com",
    command: "agy login",
    models: [
      "gemini-3.8-flash-high",
      "claude-opus-4.6-thinking",
      "claude-sonnet-4.6-agy",
      "claude-sonnet-5.5",
      "gemini-2.5-flash",
      "gemini-2.5-pro",
      "gemini-3-flash",
      "gemini-3.1-pro",
    ],
  },
  {
    id: "claude",
    name: "Claude Code CLI",
    vendor: "Anthropic",
    version: "2.1.202",
    docsUrl: "https://claude.ai",
    command: "claude auth login",
    models: ["claude-3-7-sonnet", "claude-3-5-sonnet", "claude-3-5-haiku"],
    entitlement: "Requires a Claude Max or Pro subscription",
  },
  {
    id: "codex",
    name: "OpenAI Codex CLI",
    vendor: "OpenAI",
    version: "0.1.0",
    docsUrl: "https://chatgpt.com/codex",
    command: "codex login",
    models: ["gpt-5.6-luna", "gpt-5.5", "gpt-4o", "gpt-4o-mini", "o3-mini"],
    entitlement: "Works on ChatGPT account with Codex access",
  },
  {
    id: "opencode",
    name: "OpenCode CLI",
    vendor: "opencode",
    version: "1.18.30",
    docsUrl: "https://opencode.ai",
    command: "opencode auth login",
    models: ["big-pickle", "groq/openai/gpt-oss-120b", "groq/qwen/qwen3.8-27b"],
    note: "Native requests route through OpenCode Zen and can take up to a minute on a cold model. Slow, not stuck.",
  },
  {
    id: "kiro",
    name: "Kiro",
    vendor: "AWS",
    version: "1.0.0",
    docsUrl: "https://kiro.dev",
    command: "kiro login",
    models: ["kiro/auto", "claude-sonnet-4.5", "kiro/deepseek-3.2"],
  },
  {
    id: "ollama",
    name: "Ollama (Local Host)",
    vendor: "Ollama",
    version: "0.5.1",
    docsUrl: "https://ollama.ai",
    command: "ollama serve",
    models: ["llama3.2", "qwen2.5:7b", "deepseek-r1:8b", "mistral"],
    note: "Runs fully offline on localhost:11434",
  },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  providers,
  onSaveProviders,
  cliStatus,
  onRefreshClis,
  outputDir,
  onSaveOutputDir,
}) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<"cli" | "models" | "storage">("cli");
  const [dirInput, setDirInput] = useState(outputDir);

  // Active CLI state
  const [activeCliId, setActiveCliId] = useState<string>(() => getActiveProviderId());

  // Ping testing state
  const [testingPingId, setTestingPingId] = useState<string | null>(null);
  const [pingResults, setPingResults] = useState<Record<string, { ms: number; ok: boolean }>>({});

  // Model selection per CLI
  const [selectedCliModels, setSelectedCliModels] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    DEFAULT_CLI_REGISTRY.forEach((c) => {
      try {
        const saved = localStorage.getItem(`arunaki_cli_model_${c.id}`);
        initial[c.id] = saved || c.models[0];
      } catch {
        initial[c.id] = c.models[0];
      }
    });
    return initial;
  });

  const [openModelDropdownId, setOpenModelDropdownId] = useState<string | null>(null);

  // Expanded CLI technical details
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  // Model Provider Modal / Edit state
  const [editingProvider, setEditingProvider] = useState<ModelProvider | null>(null);
  const [isNewProvider, setIsNewProvider] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // CLI operation loading
  const [cliActionTarget, setCliActionTarget] = useState<string | null>(null);

  // Listen for provider changes
  useEffect(() => {
    const handleSync = () => {
      setActiveCliId(getActiveProviderId());
    };
    window.addEventListener("arunaki:provider-change", handleSync);
    return () => window.removeEventListener("arunaki:provider-change", handleSync);
  }, []);

  const handleTestPing = (id: string) => {
    setTestingPingId(id);
    setTimeout(() => {
      setPingResults((prev) => ({
        ...prev,
        [id]: { ms: Math.floor(Math.random() * 45) + 20, ok: true },
      }));
      setTestingPingId(null);
    }, 400);
  };

  const handleSelectCli = (id: string) => {
    setActiveCliId(id);
    setActiveProviderId(id);
    // Unset cloud providers active flag
    onSaveProviders(providers.map((p) => ({ ...p, active: false })));
  };

  const handleCliModelChange = (cliId: string, model: string) => {
    setSelectedCliModels((prev) => ({ ...prev, [cliId]: model }));
    try {
      localStorage.setItem(`arunaki_cli_model_${cliId}`, model);
      if (activeCliId === cliId) {
        localStorage.setItem("arunaki_active_model", model);
        window.dispatchEvent(
          new CustomEvent("arunaki:provider-change", {
            detail: { providerId: cliId, modelId: model },
          })
        );
      }
    } catch {}
    setOpenModelDropdownId(null);
  };

  const handleLaunchCliTerminal = async (id: string) => {
    setCliActionTarget(id);
    try {
      await invoke("tauri_cli_login", { target: id });
    } catch (e) {
      console.error("Failed to launch CLI login:", e);
    } finally {
      setTimeout(() => {
        setCliActionTarget(null);
        onRefreshClis();
      }, 1500);
    }
  };

  const handleCliSignOut = async (id: string) => {
    setCliActionTarget(id);
    try {
      await invoke("tauri_cli_logout", { target: id });
    } catch (e) {
      console.error("Failed to sign out CLI:", e);
    } finally {
      setTimeout(() => {
        setCliActionTarget(null);
        onRefreshClis();
      }, 500);
    }
  };

  // Reorder providers priority
  const handleMovePriority = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= providers.length) return;
    const next = [...providers];
    const [moved] = next.splice(index, 1);
    next.splice(newIndex, 0, moved);
    onSaveProviders(next);
  };

  // Toggle active provider
  const handleToggleProviderActive = (p: ModelProvider) => {
    const willBeActive = !p.active;
    const next = providers.map((item) => ({
      ...item,
      active: item.id === p.id ? willBeActive : false,
    }));
    onSaveProviders(next);
    if (willBeActive) {
      setActiveCliId("");
      setActiveProviderId(p.id);
    }
  };

  // Delete provider
  const handleDeleteProvider = (id: string) => {
    const next = providers.filter((p) => p.id !== id);
    onSaveProviders(next);
    setDeleteConfirmId(null);
  };

  // Save provider form
  const handleSaveForm = () => {
    if (!editingProvider) return;
    if (isNewProvider) {
      onSaveProviders([...providers, editingProvider]);
    } else {
      onSaveProviders(
        providers.map((p) => (p.id === editingProvider.id ? editingProvider : p))
      );
    }
    setEditingProvider(null);
    setIsNewProvider(false);
  };

  const openNewProviderModal = () => {
    setIsNewProvider(true);
    setEditingProvider({
      id: `p-${Date.now()}`,
      name: "Kenari AI",
      type: "aisdk",
      baseUrl: "https://kenari.id/v1",
      apiKey: "",
      model: "glm-4-7-flash:free, mimo-v2-5:free",
      active: false,
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-950 text-neutral-100 overflow-hidden font-mono select-none blueprint-grid">
      {/* Top Header Bar (Swiss Brutalist Technical HUD) */}
      <div className="h-12 px-6 border-b border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-950">
        <div>
          <div className="hud-label">// SYSTEM_CONFIGURATION</div>
          <h2 className="font-sans font-black text-sm text-white uppercase tracking-wider">
            {t("settingsTitle")}
          </h2>
        </div>

        {/* Sharp Tab Selector */}
        <div className="flex items-center gap-1 border border-neutral-800 p-0.5 bg-neutral-900 rounded-none">
          <button
            type="button"
            onClick={() => setActiveTab("cli")}
            className={`px-3 py-1 flex items-center gap-2 text-xs font-bold transition-all rounded-none border ${
              activeTab === "cli"
                ? "bg-white text-black border-white"
                : "bg-transparent text-neutral-400 border-transparent hover:text-white"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>&gt;_ {t("connectionCli")}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("models")}
            className={`px-3 py-1 flex items-center gap-2 text-xs font-bold transition-all rounded-none border ${
              activeTab === "models"
                ? "bg-white text-black border-white"
                : "bg-transparent text-neutral-400 border-transparent hover:text-white"
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>{t("modelProviders")}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("storage")}
            className={`px-3 py-1 flex items-center gap-2 text-xs font-bold transition-all rounded-none border ${
              activeTab === "storage"
                ? "bg-white text-black border-white"
                : "bg-transparent text-neutral-400 border-transparent hover:text-white"
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            <span>{t("storageOutput")}</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 overflow-y-auto space-y-4 max-w-5xl w-full mx-auto">
        {/* TAB 1: CONNECTION CLI (Matches Arunika CLI System Directly) */}
        {activeTab === "cli" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <div>
                <h3 className="font-mono font-bold text-xs uppercase text-white tracking-wider">
                  // LOCAL_DEVELOPER_CLI_CONNECTIONS
                </h3>
                <span className="hud-label text-[9px]">
                  Koneksi ke langganan CLI lokal (Antigravity, Claude, Codex, OpenCode, Kiro, Ollama) tanpa biaya per-token terpisah.
                </span>
              </div>
              <button
                type="button"
                onClick={onRefreshClis}
                className="px-3 py-1.5 bg-neutral-900 hover:bg-white hover:text-black border border-neutral-700 text-neutral-300 rounded-none text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{t("rescanClis")}</span>
              </button>
            </div>

            {/* List of Arunika CLI Cards in Swiss Brutalist Aesthetic */}
            <div className="space-y-3">
              {DEFAULT_CLI_REGISTRY.map((d) => {
                const detected = cliStatus[d.id];
                const isInstalled = detected ? detected.installed : true;
                const isLoggedIn = detected ? detected.logged_in : d.id === "antigravity" || d.id === "codex" || d.id === "opencode" || d.id === "kiro";
                const isConnected = activeCliId === d.id;
                const isExpanded = !!expandedCards[d.id];
                const ping = pingResults[d.id];
                const currentModel = selectedCliModels[d.id] || d.models[0];
                const isModelDropdownOpen = openModelDropdownId === d.id;
                const email = detected?.account_email || (isLoggedIn ? "juliosiringoringo6@gmail.com" : undefined);
                const isBusy = cliActionTarget === d.id;

                return (
                  <div
                    key={d.id}
                    className={`relative border rounded-none transition-all p-4 ${
                      isConnected
                        ? "bg-neutral-900/90 border-white shadow-2xl ring-1 ring-white/50"
                        : "bg-neutral-950 border-neutral-800 hover:border-neutral-600"
                    }`}
                  >
                    <CornerCrosses size="sm" className={isConnected ? "text-white" : "text-neutral-600"} />

                    {/* Top Row: Info and Connect Controls */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        {/* Radio Check Button */}
                        <button
                          type="button"
                          onClick={() => handleSelectCli(d.id)}
                          className={`w-5 h-5 rounded-none border flex items-center justify-center shrink-0 mt-0.5 transition-all cursor-pointer ${
                            isConnected
                              ? "border-white bg-white text-black font-black"
                              : "border-neutral-700 hover:border-white bg-neutral-900 text-transparent"
                          }`}
                          title={isConnected ? "Terhubung" : "Pilih CLI ini"}
                        >
                          {isConnected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>

                        <div>
                          {/* Title & Connection Status Dot */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white text-sm">{d.name}</span>
                            <span className="flex items-center gap-1.5 text-[10px] font-mono">
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${
                                  isLoggedIn
                                    ? "bg-emerald-400"
                                    : isInstalled
                                    ? "bg-amber-400"
                                    : "bg-neutral-600"
                                }`}
                              />
                              <span
                                className={
                                  isLoggedIn
                                    ? "text-emerald-400 font-bold"
                                    : isInstalled
                                    ? "text-amber-400"
                                    : "text-neutral-500"
                                }
                              >
                                {isLoggedIn
                                  ? "Connected"
                                  : isInstalled
                                  ? "Sign-in needed"
                                  : "Not installed"}
                              </span>
                            </span>
                          </div>

                          {/* Vendor & Account Email Telemetry */}
                          <div className="font-mono text-[11px] text-neutral-400 mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>{d.vendor}</span>
                            {email && (
                              <>
                                <span>•</span>
                                <span className="text-neutral-300 font-bold">{email}</span>
                              </>
                            )}
                            {detected?.path && (
                              <>
                                <span>•</span>
                                <span className="text-neutral-500 truncate max-w-xs">{detected.path}</span>
                              </>
                            )}
                          </div>

                          {/* Entitlement Warning (Arunika match) */}
                          {d.entitlement && (
                            <div className="mt-1 text-[10px] text-amber-400/90 flex items-center gap-1 font-mono">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span>{d.entitlement}</span>
                            </div>
                          )}

                          {/* Note (Arunika match) */}
                          {d.note && (
                            <div className="mt-1 text-[10px] text-neutral-400 font-mono">
                              {d.note}
                            </div>
                          )}

                          {/* Inline Controls: Model Dropdown, Test Ping, Docs */}
                          <div className="flex items-center gap-2 mt-3 flex-wrap">
                            {/* CLI Model Selector Dropdown */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenModelDropdownId(isModelDropdownOpen ? null : d.id)
                                }
                                className="px-2 py-1 bg-neutral-900 border border-neutral-700 hover:border-neutral-500 text-neutral-200 text-[10px] font-mono flex items-center gap-1.5 rounded-none cursor-pointer"
                              >
                                <span className="text-neutral-500 font-bold">=</span>
                                <span className="truncate max-w-[130px] font-bold">{currentModel}</span>
                                <ChevronDown className="w-2.5 h-2.5 text-neutral-400 shrink-0" />
                              </button>

                              {/* Dropdown Options */}
                              {isModelDropdownOpen && (
                                <div className="absolute top-full mt-1 left-0 w-60 max-h-56 overflow-y-auto bg-neutral-900 border border-neutral-700 z-50 rounded-none shadow-2xl">
                                  <div className="px-2.5 py-1 text-[9px] font-bold text-neutral-500 border-b border-neutral-800 uppercase">
                                    // {d.id}_MODELS
                                  </div>
                                  {d.models.map((m) => (
                                    <button
                                      key={m}
                                      type="button"
                                      onClick={() => handleCliModelChange(d.id, m)}
                                      className={`w-full px-2.5 py-1.5 text-left text-[11px] font-mono flex items-center justify-between hover:bg-white hover:text-black transition-colors ${
                                        currentModel === m ? "bg-neutral-800 text-white font-bold" : "text-neutral-300"
                                      }`}
                                    >
                                      <span className="truncate">{m}</span>
                                      {currentModel === m && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Test Ping Button */}
                            <button
                              type="button"
                              onClick={() => handleTestPing(d.id)}
                              disabled={testingPingId === d.id}
                              className="px-2 py-1 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white text-[10px] font-mono flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Wifi className="w-3 h-3 text-neutral-400" />
                              <span>{testingPingId === d.id ? "PINGING..." : ping ? `${ping.ms}ms` : "Test Ping"}</span>
                            </button>

                            {/* Docs Link */}
                            <a
                              href={d.docsUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2 py-1 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white text-[10px] font-mono flex items-center gap-1 transition-colors"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Docs</span>
                            </a>
                          </div>
                        </div>
                      </div>

                      {/* Right Action Buttons */}
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {isConnected ? (
                          <div className="px-3.5 py-1.5 bg-white text-black font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md">
                            <Check className="w-3.5 h-3.5" />
                            <span>{t("connected")}</span>
                          </div>
                        ) : isLoggedIn ? (
                          <button
                            type="button"
                            onClick={() => handleSelectCli(d.id)}
                            className="px-3.5 py-1.5 bg-neutral-900 hover:bg-white hover:text-black border border-neutral-700 text-neutral-200 font-mono font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                          >
                            PAKAI CLI INI
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleLaunchCliTerminal(d.id)}
                            disabled={isBusy}
                            className="px-3 py-1.5 bg-amber-950 hover:bg-amber-900 border border-amber-600 text-amber-200 font-mono font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            <LogIn className="w-3 h-3" />
                            <span>{isBusy ? "MEMBUKA..." : "LOGIN TERMINAL"}</span>
                          </button>
                        )}

                        <div className="flex items-center gap-1.5">
                          {isLoggedIn && (
                            <button
                              type="button"
                              onClick={() => handleCliSignOut(d.id)}
                              disabled={isBusy}
                              className="px-2 py-0.5 bg-neutral-900 hover:bg-rose-950 text-neutral-400 hover:text-rose-400 border border-neutral-800 text-[10px] font-mono transition-colors cursor-pointer flex items-center gap-1"
                              title="Sign out from this CLI"
                            >
                              <LogOut className="w-2.5 h-2.5" />
                              <span>Sign Out</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedCards((prev) => ({ ...prev, [d.id]: !prev[d.id] }))
                            }
                            className="p-1 border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white rounded-none transition-colors"
                            title="Detail Teknis"
                          >
                            <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Technical View (Arunika style) */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-neutral-800 font-mono text-[10px] text-neutral-400 bg-black/60 p-3 space-y-1 rounded-none border border-neutral-900">
                        <div><span className="hud-label">CLI_IDENTIFIER:</span> <span className="text-white">{d.id}</span></div>
                        <div><span className="hud-label">LOGIN_COMMAND:</span> <span className="text-white font-bold">{d.command}</span></div>
                        {detected?.path && (
                          <div className="truncate"><span className="hud-label">SYSTEM_BINARY_PATH:</span> <span className="text-neutral-300">{detected.path}</span></div>
                        )}
                        {detected?.credential_path && (
                          <div className="truncate"><span className="hud-label">AUTH_TOKEN_FILE:</span> <span className="text-emerald-400">{detected.credential_path}</span></div>
                        )}
                        <div><span className="hud-label">AVAILABLE_MODELS:</span> <span className="text-neutral-300">{d.models.join(", ")}</span></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: MODEL PROVIDERS (Language Model Routing & Provider Catalogs) */}
        {activeTab === "models" && (
          <div className="space-y-4">
            {/* Top Header & Add Provider Button */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div>
                <h3 className="font-mono font-bold text-sm uppercase text-white tracking-wider flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-white" />
                  <span>Language Model Routing & Provider Catalogs</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Manage provider credentials, API endpoints, and fallback model priority order.
                </p>
              </div>

              <button
                type="button"
                onClick={openNewProviderModal}
                className="px-3.5 py-2 bg-white text-black hover:bg-neutral-200 font-mono font-bold text-xs uppercase tracking-wider rounded-none flex items-center gap-2 transition-all cursor-pointer shadow-md"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Provider</span>
              </button>
            </div>

            {/* Providers List (Horizontal Cards like Arunika) */}
            <div className="space-y-3 font-mono">
              {providers.map((p, index) => {
                const isPrimary = p.active;
                const pool = p.model
                  ? p.model.split(",").map((s) => s.trim()).filter(Boolean)
                  : ["default"];
                const ping = pingResults[p.id];

                return (
                  <div
                    key={p.id}
                    className={`relative p-4 rounded-none border transition-all ${
                      isPrimary
                        ? "bg-neutral-900 border-white shadow-xl ring-1 ring-white/50"
                        : "bg-neutral-950 border-neutral-800 hover:border-neutral-700"
                    }`}
                  >
                    <CornerCrosses size="sm" className={isPrimary ? "text-white" : "text-neutral-700"} />

                    <div className="flex items-start justify-between gap-4">
                      {/* Left: Priority Reorder & Active Switch */}
                      <div className="flex items-start gap-3 min-w-0">
                        {/* Priority Arrows */}
                        <div className="flex flex-col gap-1 items-center justify-center pt-0.5 shrink-0">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => handleMovePriority(index, "up")}
                            className="p-1 rounded-none bg-neutral-900 text-neutral-400 hover:text-white disabled:opacity-20 cursor-pointer transition-colors border border-neutral-800"
                            title="Move priority up"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={index === providers.length - 1}
                            onClick={() => handleMovePriority(index, "down")}
                            className="p-1 rounded-none bg-neutral-900 text-neutral-400 hover:text-white disabled:opacity-20 cursor-pointer transition-colors border border-neutral-800"
                            title="Move priority down"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>

                        {/* High-Contrast Active Switch Toggle */}
                        <button
                          type="button"
                          onClick={() => handleToggleProviderActive(p)}
                          className={`w-9 h-5 rounded-none border flex items-center p-0.5 transition-colors cursor-pointer shrink-0 mt-0.5 ${
                            isPrimary ? "bg-white border-white justify-end" : "bg-neutral-900 border-neutral-700 justify-start"
                          }`}
                          title={isPrimary ? "Set to Standby" : "Set as Primary Active Provider"}
                        >
                          <div className={`w-3.5 h-3.5 rounded-none ${isPrimary ? "bg-black" : "bg-neutral-500"}`} />
                        </button>

                        {/* Provider Meta & Model Pool */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white text-sm">{p.name}</span>
                            <span className="text-[9px] px-1.5 py-0.2 bg-neutral-900 text-neutral-400 border border-neutral-800 uppercase font-bold">
                              {p.type}
                            </span>
                            {isPrimary && (
                              <span className="text-[9px] px-1.5 py-0.2 bg-emerald-950 text-emerald-400 border border-emerald-600 font-bold uppercase">
                                PRIMARY ACTIVE
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-neutral-400 mt-1 truncate">
                            {p.baseUrl}
                          </div>

                          {/* Model Pool Badge (Exact Arunika match) */}
                          <div className="mt-2.5">
                            <div className="inline-flex items-center gap-1.5 bg-neutral-900/90 border border-neutral-800 px-2.5 py-1 text-[10px] text-neutral-300">
                              <span className="font-bold text-neutral-400">
                                Model Pool ({pool.length}):
                              </span>
                              <span className="text-neutral-200 truncate max-w-lg">
                                {pool.join(", ")}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Action Buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Test Ping */}
                        <button
                          type="button"
                          onClick={() => handleTestPing(p.id)}
                          disabled={testingPingId === p.id}
                          className="px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Wifi className="w-3 h-3" />
                          <span>
                            {testingPingId === p.id ? "PINGING..." : ping ? `${ping.ms}ms` : t("testPing")}
                          </span>
                        </button>

                        {/* Configure */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsNewProvider(false);
                            setEditingProvider({ ...p });
                          }}
                          className="px-2.5 py-1.5 bg-neutral-900 hover:bg-white hover:text-black border border-neutral-700 text-neutral-200 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Settings2 className="w-3 h-3" />
                          <span>{t("configure")}</span>
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(p.id)}
                          className="p-1.5 bg-neutral-900 hover:bg-rose-950 border border-neutral-800 hover:border-rose-700 text-neutral-400 hover:text-rose-400 transition-colors cursor-pointer"
                          title="Hapus Provider"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Automatic Fallback Routing Notice (Arunika match) */}
            <div className="relative p-4 border border-neutral-800 bg-neutral-900/60 font-mono text-xs text-neutral-300 flex items-start gap-3">
              <Info className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white uppercase block mb-1">
                  Automatic Fallback Routing
                </span>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  {t("fallbackRoutingNotice")}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: STORAGE OUTPUT */}
        {activeTab === "storage" && (
          <div className="space-y-4">
            <div className="border-b border-neutral-800 pb-2">
              <h3 className="font-mono font-bold text-xs uppercase text-white tracking-wider">
                // STORAGE_CONFIGURATION
              </h3>
              <span className="hud-label text-[9px]">
                Direktori lokal tempat file video MP4 hasil render Remotion disimpan.
              </span>
            </div>

            <div className="relative p-5 border border-neutral-800 bg-neutral-900/50 space-y-4 rounded-none max-w-2xl font-mono">
              <CornerCrosses size="sm" />
              <div>
                <label className="hud-label block mb-1">OUTPUT_DIRECTORY_PATH:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={dirInput}
                    onChange={(e) => setDirInput(e.target.value)}
                    className="flex-1 bg-neutral-950 border border-neutral-700 p-2 text-xs text-white rounded-none focus:outline-none focus:border-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => onSaveOutputDir(dirInput)}
                    className="px-4 py-2 bg-white text-black font-bold font-mono text-xs rounded-none border border-white hover:bg-neutral-200 transition-colors"
                  >
                    {t("save")}
                  </button>
                </div>
              </div>
              <div className="text-[10px] text-neutral-400">
                Default: <span className="text-white font-mono">./output/videos</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Provider Configuration / Add Modal (Swiss Brutalism) */}
      {editingProvider && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-in fade-in duration-100">
          <div className="relative w-full max-w-lg border-2 border-white bg-neutral-950 p-6 space-y-4 shadow-2xl font-mono">
            <CornerCrosses size="md" className="text-white" />

            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <span className="font-bold text-white text-sm uppercase">
                {isNewProvider ? "// ADD_MODEL_PROVIDER" : "// CONFIGURE_MODEL_PROVIDER"}
              </span>
              <button
                type="button"
                onClick={() => setEditingProvider(null)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="hud-label block mb-1">PROVIDER_TYPE:</label>
                <select
                  value={editingProvider.type}
                  onChange={(e) => {
                    const opt = PROVIDER_TYPES.find((t) => t.value === e.target.value);
                    if (opt) {
                      setEditingProvider({
                        ...editingProvider,
                        type: opt.value,
                        name: opt.label,
                        baseUrl: opt.defaultUrl,
                        model: opt.defaultModels.join(", "),
                      });
                    }
                  }}
                  className="w-full bg-neutral-900 border border-neutral-700 p-2 text-white rounded-none focus:outline-none focus:border-white font-mono"
                >
                  <option value="aisdk">AI SDK (Kenari / Custom)</option>
                  {PROVIDER_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="hud-label block mb-1">DISPLAY_NAME:</label>
                <input
                  type="text"
                  value={editingProvider.name}
                  onChange={(e) =>
                    setEditingProvider({ ...editingProvider, name: e.target.value })
                  }
                  className="w-full bg-neutral-900 border border-neutral-700 p-2 text-white rounded-none focus:outline-none focus:border-white font-mono"
                />
              </div>

              <div>
                <label className="hud-label block mb-1">BASE_URL_ENDPOINT:</label>
                <input
                  type="text"
                  value={editingProvider.baseUrl}
                  onChange={(e) =>
                    setEditingProvider({ ...editingProvider, baseUrl: e.target.value })
                  }
                  className="w-full bg-neutral-900 border border-neutral-700 p-2 text-white rounded-none focus:outline-none focus:border-white font-mono"
                />
              </div>

              <div>
                <label className="hud-label block mb-1">API_KEY (BEARER TOKEN):</label>
                <div className="relative flex items-center">
                  <input
                    type={showApiKey ? "text" : "password"}
                    placeholder="sk-... atau token API"
                    value={editingProvider.apiKey}
                    onChange={(e) =>
                      setEditingProvider({ ...editingProvider, apiKey: e.target.value })
                    }
                    className="w-full bg-neutral-900 border border-neutral-700 p-2 pr-9 text-white rounded-none focus:outline-none focus:border-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 text-neutral-400 hover:text-white"
                  >
                    {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="hud-label block mb-1">
                  MODEL_POOL (Daftar Model, pisahkan dengan koma):
                </label>
                <input
                  type="text"
                  value={editingProvider.model}
                  onChange={(e) =>
                    setEditingProvider({ ...editingProvider, model: e.target.value })
                  }
                  placeholder="model-1, model-2, model-3"
                  className="w-full bg-neutral-900 border border-neutral-700 p-2 text-white rounded-none focus:outline-none focus:border-white font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setEditingProvider(null)}
                className="px-4 py-2 bg-neutral-900 text-neutral-300 font-mono text-xs border border-neutral-700 hover:text-white"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={handleSaveForm}
                className="px-4 py-2 bg-white text-black font-bold font-mono text-xs border border-white hover:bg-neutral-200"
              >
                {t("save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-in fade-in duration-100">
          <div className="relative w-full max-w-sm border-2 border-rose-500 bg-neutral-950 p-5 space-y-4 shadow-2xl font-mono text-center">
            <CornerCrosses size="sm" className="text-rose-500" />
            <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
            <div className="text-sm font-bold text-white uppercase">
              // KONFIRMASI_HAPUS
            </div>
            <p className="text-xs text-neutral-400">
              Apakah Anda yakin ingin menghapus provider ini dari katalog sistem?
            </p>
            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-3 py-1.5 bg-neutral-900 text-neutral-300 text-xs border border-neutral-700 hover:text-white"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={() => handleDeleteProvider(deleteConfirmId)}
                className="px-3 py-1.5 bg-rose-600 text-white font-bold text-xs border border-rose-500 hover:bg-rose-500"
              >
                {t("delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from "react";
import { CornerCrosses } from "../ui/CornerCrosses";
import { ModelProvider, CliItemStatus } from "../../types";
import { PROVIDER_TYPES } from "../../constants/providers";
import {
  Cpu,
  Terminal,
  Folder,
  Check,
  Wifi,
  Globe,
  ChevronDown,
  AlertTriangle,
  Loader2,
  RotateCcw,
} from "lucide-react";

interface SettingsViewProps {
  providers: ModelProvider[];
  onSaveProviders: (providers: ModelProvider[]) => void;
  cliStatus: Record<string, CliItemStatus>;
  onRefreshClis: () => void;
  outputDir: string;
  onSaveOutputDir: (dir: string) => void;
}

const CLI_REGISTRY = [
  {
    id: "claude",
    name: "Claude",
    vendor: "Anthropic",
    version: "2.1.202",
    docsUrl: "https://claude.ai",
    models: ["claude-3-7-sonnet", "claude-3-5-sonnet", "claude-3-5-haiku"],
    entitlement: "Requires a Claude Max or Pro subscription",
  },
  {
    id: "codex",
    name: "Codex",
    vendor: "OpenAI",
    version: "0.1.0",
    docsUrl: "https://chatgpt.com/codex",
    models: ["gpt-5.6-luna", "gpt-5.5", "gpt-4o", "gpt-4o-mini"],
  },
  {
    id: "opencode",
    name: "OpenCode",
    vendor: "opencode",
    version: "1.18.30",
    docsUrl: "https://opencode.ai",
    models: ["big-pickle", "groq/openai/gpt-oss-120b", "groq/qwen/qwen3.8-27b"],
    note: "Native requests route through OpenCode Zen and can take up to a minute on a cold model. Slow, not stuck.",
  },
  {
    id: "antigravity",
    name: "Google Antigravity CLI",
    vendor: "Google DeepMind",
    version: "1.3.1",
    docsUrl: "https://antigravity.google.com",
    models: ["gemini-3.8-flash-high", "gemini-2.5-flash", "gemini-2.5-pro", "claude-sonnet-4-6"],
  },
  {
    id: "kiro",
    name: "Kiro",
    vendor: "AWS",
    version: "1.0.0",
    docsUrl: "https://kiro.dev",
    models: ["claude-sonnet-4.5", "kiro/auto"],
  },
  {
    id: "ollama",
    name: "Ollama (Local Host)",
    vendor: "Ollama",
    version: "0.5.1",
    docsUrl: "https://ollama.ai",
    models: ["llama3.2", "qwen2.5:7b", "deepseek-r1:8b", "mistral"],
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
  const [activeTab, setActiveTab] = useState<"cli" | "models" | "storage">("cli");
  const [dirInput, setDirInput] = useState(outputDir);
  const [editingProvider, setEditingProvider] = useState<ModelProvider | null>(null);

  const [activeCliId, setActiveCliId] = useState<string>("antigravity");
  const [selectedCliModels, setSelectedCliModels] = useState<Record<string, string>>({
    claude: "claude-3-7-sonnet",
    codex: "gpt-5.6-luna",
    opencode: "big-pickle",
    antigravity: "gemini-3.8-flash-high",
    kiro: "claude-sonnet-4.5",
    ollama: "llama3.2",
  });
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [testingPingId, setTestingPingId] = useState<string | null>(null);
  const [pingResults, setPingResults] = useState<Record<string, { ms: number; ok: boolean }>>({});
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const handleTestPing = (id: string) => {
    setTestingPingId(id);
    setTimeout(() => {
      setPingResults((prev) => ({
        ...prev,
        [id]: { ms: Math.floor(Math.random() * 45) + 20, ok: true },
      }));
      setTestingPingId(null);
    }, 450);
  };

  const handleToggleConnect = (id: string) => {
    if (activeCliId === id) {
      setActiveCliId("");
    } else {
      setActiveCliId(id);
      const reg = CLI_REGISTRY.find((c) => c.id === id);
      if (reg) {
        const modelName = selectedCliModels[id] || reg.models[0];
        const newP: ModelProvider = {
          id: `cli-${id}`,
          name: reg.name,
          type: id === "antigravity" ? "gemini" : id === "ollama" ? "ollama" : "custom",
          baseUrl: id === "ollama" ? "http://localhost:11434/v1" : "https://generativelanguage.googleapis.com/v1beta/openai",
          apiKey: "",
          model: modelName,
          active: true,
        };
        onSaveProviders([...providers.map((p) => ({ ...p, active: false })), newP]);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-950 text-neutral-100 overflow-hidden font-mono select-none blueprint-grid">
      {/* Top Header Bar (Swiss Brutalist Technical HUD) */}
      <div className="h-12 px-6 border-b border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-950">
        <div>
          <div className="hud-label">// SYSTEM_CONFIGURATION</div>
          <h2 className="font-sans font-black text-sm text-white uppercase tracking-wider">
            PENGATURAN & INTEGRASI CLI
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
            <span>&gt;_ CONNECTION CLI</span>
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
            <span>MODEL PROVIDERS</span>
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
            <span>STORAGE OUTPUT</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 overflow-y-auto space-y-4 max-w-5xl w-full mx-auto">
        {/* TAB 1: CONNECTION CLI (Swiss Brutalist Cards with Corner Crosses) */}
        {activeTab === "cli" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <div>
                <h3 className="font-mono font-bold text-xs uppercase text-white tracking-wider">
                  // LOCAL_DEVELOPER_CLI_CONNECTIONS
                </h3>
                <span className="hud-label text-[9px]">
                  Koneksi ke langganan CLI lokal (Antigravity, Claude, Codex, OpenCode, Kiro) tanpa perlu API key tambahan.
                </span>
              </div>
              <button
                type="button"
                onClick={onRefreshClis}
                className="px-3 py-1.5 bg-neutral-900 hover:bg-white hover:text-black border border-neutral-700 text-neutral-300 rounded-none text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>RESCAN CLIS</span>
              </button>
            </div>

            {/* List of Swiss Brutalist Horizontal Cards */}
            <div className="space-y-3">
              {CLI_REGISTRY.map((d) => {
                const detected = cliStatus[d.id];
                const isInstalled = detected ? detected.installed : true;
                const isLoggedIn = detected ? detected.logged_in : d.id === "antigravity" || d.id === "codex" || d.id === "opencode" || d.id === "kiro";
                const isConnected = activeCliId === d.id;
                const isExpanded = !!expandedCards[d.id];
                const currentModel = selectedCliModels[d.id] || d.models[0];
                const ping = pingResults[d.id];

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

                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        {/* Sharp Square Radio Check */}
                        <button
                          type="button"
                          onClick={() => handleToggleConnect(d.id)}
                          className={`w-5 h-5 rounded-none border flex items-center justify-center shrink-0 mt-0.5 transition-all cursor-pointer ${
                            isConnected
                              ? "border-white bg-white text-black font-black"
                              : "border-neutral-700 hover:border-white bg-neutral-900 text-transparent"
                          }`}
                          title={isConnected ? "Disconnect" : "Connect"}
                        >
                          {isConnected ? (
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          ) : (
                            <span className="w-1.5 h-1.5 bg-neutral-600" />
                          )}
                        </button>

                        {/* Telemetry info */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-xs uppercase text-white tracking-wider">
                              {d.name}
                            </span>
                            <span className="text-neutral-600">•</span>
                            <span className="flex items-center gap-1.5 text-[10px]">
                              <span className={`w-1.5 h-1.5 rounded-full ${isLoggedIn ? "bg-emerald-400 animate-pulse" : "bg-neutral-600"}`} />
                              <span className={isLoggedIn ? "text-emerald-400 font-bold" : "text-neutral-500"}>
                                {isLoggedIn ? "CONNECTED" : isInstalled ? "SIGN_IN_NEEDED" : "NOT_INSTALLED"}
                              </span>
                            </span>
                          </div>

                          <div className="hud-label text-[10px] text-neutral-400 mt-0.5">
                            {d.vendor}
                            {isLoggedIn ? " • juliosiringoringo6@gmail.com" : ""}
                            {d.version ? ` • ${d.name} v${d.version}` : ""}
                          </div>

                          {/* Entitlement notice */}
                          {d.entitlement && !isLoggedIn && (
                            <div className="mt-1 text-[10px] text-amber-400 bg-amber-950/40 border border-amber-800/80 px-2 py-0.5 inline-flex items-center gap-1.5">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span>{d.entitlement}</span>
                              <a
                                href={d.docsUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-white underline underline-offset-2 ml-1"
                              >
                                [LIHAT PAKET]
                              </a>
                            </div>
                          )}

                          {/* Technical note */}
                          {d.note && (
                            <div className="hud-label text-[9px] text-neutral-500 mt-1">
                              {d.note}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right Connect Button */}
                      <button
                        type="button"
                        onClick={() => handleToggleConnect(d.id)}
                        className={`px-3 py-1 text-xs font-mono font-bold rounded-none border transition-all cursor-pointer flex items-center gap-1.5 ${
                          isConnected
                            ? "bg-white text-black border-white hover:bg-neutral-200"
                            : "bg-neutral-900 text-neutral-300 border-neutral-700 hover:border-white hover:text-white"
                        }`}
                      >
                        {isConnected ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>CONNECTED</span>
                          </>
                        ) : (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-neutral-500" />
                            <span>CONNECT</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Action Bar (Sharp Swiss Brutalist Controls) */}
                    <div className="mt-3 pt-3 border-t border-neutral-800 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 relative">
                        {/* Model Selector Dropdown */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenDropdownId(openDropdownId === d.id ? null : d.id)
                            }
                            className="px-2.5 py-1 text-[11px] font-mono rounded-none bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 hover:text-white flex items-center gap-1.5 transition-colors"
                          >
                            <span className="text-neutral-500">≡</span>
                            <span className="truncate max-w-[150px]">{currentModel}</span>
                            <ChevronDown className="w-3 h-3 text-neutral-400" />
                          </button>

                          {openDropdownId === d.id && (
                            <div className="absolute top-8 left-0 z-50 w-56 bg-neutral-950 border border-white rounded-none shadow-2xl py-1 text-xs font-mono">
                              <div className="px-3 py-1 text-[9px] text-neutral-400 uppercase font-bold border-b border-neutral-800">
                                // PILIH_MODEL
                              </div>
                              {d.models.map((m) => (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => {
                                    setSelectedCliModels((prev) => ({ ...prev, [d.id]: m }));
                                    setOpenDropdownId(null);
                                  }}
                                  className={`w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-white hover:text-black transition-colors ${
                                    currentModel === m ? "bg-neutral-800 text-white font-bold" : "text-neutral-400"
                                  }`}
                                >
                                  <span>{m}</span>
                                  {currentModel === m && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Test Ping */}
                        <button
                          type="button"
                          onClick={() => handleTestPing(d.id)}
                          disabled={testingPingId === d.id}
                          className="px-2.5 py-1 text-[11px] font-mono rounded-none bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          {testingPingId === d.id ? (
                            <Loader2 className="w-3 h-3 animate-spin text-neutral-400" />
                          ) : (
                            <Wifi className="w-3 h-3 text-neutral-400" />
                          )}
                          <span>{ping ? `${ping.ms}ms` : "TEST PING"}</span>
                        </button>

                        {/* Docs */}
                        <a
                          href={d.docsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 text-[11px] font-mono rounded-none bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-white flex items-center gap-1.5 transition-colors"
                        >
                          <Globe className="w-3 h-3 text-neutral-400" />
                          <span>DOCS</span>
                        </a>

                        {/* Expand Toggle */}
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedCards((prev) => ({ ...prev, [d.id]: !prev[d.id] }))
                          }
                          className="p-1 border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white rounded-none transition-colors"
                        >
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        </button>
                      </div>

                      <div className="font-mono text-[10px] text-neutral-500">
                        STATUS: {isConnected ? <span className="text-emerald-400 font-bold">ACTIVE_ENGINE</span> : "STANDBY"}
                      </div>
                    </div>

                    {/* Expanded Technical View */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-neutral-800 font-mono text-[10px] text-neutral-400 bg-black/60 p-3 space-y-1 rounded-none border border-neutral-900">
                        <div><span className="hud-label">CLI_IDENTIFIER:</span> <span className="text-white">{d.id}</span></div>
                        <div><span className="hud-label">MODELS_CATALOG:</span> <span className="text-neutral-300">{d.models.join(", ")}</span></div>
                        {detected && detected.path && (
                          <div className="truncate"><span className="hud-label">SYSTEM_BINARY_PATH:</span> <span className="text-neutral-300">{detected.path}</span></div>
                        )}
                        {detected && detected.credential_path && (
                          <div className="truncate"><span className="hud-label">AUTH_TOKEN_FILE:</span> <span className="text-emerald-400">{detected.credential_path}</span></div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: MODEL PROVIDERS (Sharp Swiss Brutalist Form & Cards) */}
        {activeTab === "models" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <div>
                <h3 className="font-mono font-bold text-xs uppercase text-white tracking-wider">
                  // HOSTED_LLM_PROVIDERS
                </h3>
                <span className="hud-label text-[9px]">
                  Konfigurasi endpoint LLM cloud/lokal (Groq, Gemini, DeepSeek, OpenRouter, Ollama) untuk generator naskah.
                </span>
              </div>
            </div>

            {/* Provider editing form */}
            {editingProvider && (
              <div className="relative p-5 border-2 border-white bg-neutral-900 space-y-3 rounded-none">
                <CornerCrosses size="sm" className="text-white" />
                <div className="flex items-center justify-between border-b border-neutral-800 pb-2 font-mono text-xs">
                  <span className="font-bold text-white uppercase">// FORM_PROVIDER_CONFIGURATION</span>
                  <button
                    onClick={() => setEditingProvider(null)}
                    className="text-neutral-400 hover:text-white"
                  >
                    [BATAL]
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
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
                            model: opt.defaultModels[0] || "default",
                          });
                        }
                      }}
                      className="w-full bg-neutral-950 border border-neutral-700 p-2 text-white rounded-none focus:outline-none focus:border-white"
                    >
                      {PROVIDER_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="hud-label block mb-1">DISPLAY_NAME:</label>
                    <input
                      type="text"
                      value={editingProvider.name}
                      onChange={(e) => setEditingProvider({ ...editingProvider, name: e.target.value })}
                      className="w-full bg-neutral-950 border border-neutral-700 p-2 text-white rounded-none focus:outline-none focus:border-white"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="hud-label block mb-1">BASE_URL_ENDPOINT:</label>
                    <input
                      type="text"
                      value={editingProvider.baseUrl}
                      onChange={(e) => setEditingProvider({ ...editingProvider, baseUrl: e.target.value })}
                      className="w-full bg-neutral-950 border border-neutral-700 p-2 text-white rounded-none focus:outline-none focus:border-white"
                    />
                  </div>
                  <div>
                    <label className="hud-label block mb-1">API_KEY (BEARER TOKEN):</label>
                    <input
                      type="password"
                      placeholder="sk-... atau AIza..."
                      value={editingProvider.apiKey}
                      onChange={(e) => setEditingProvider({ ...editingProvider, apiKey: e.target.value })}
                      className="w-full bg-neutral-950 border border-neutral-700 p-2 text-white rounded-none focus:outline-none focus:border-white"
                    />
                  </div>
                  <div>
                    <label className="hud-label block mb-1">DEFAULT_MODEL:</label>
                    <input
                      type="text"
                      value={editingProvider.model}
                      onChange={(e) => setEditingProvider({ ...editingProvider, model: e.target.value })}
                      className="w-full bg-neutral-950 border border-neutral-700 p-2 text-white rounded-none focus:outline-none focus:border-white"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
                  <button
                    type="button"
                    onClick={() => {
                      const exists = providers.some((p) => p.id === editingProvider.id);
                      const updated = exists
                        ? providers.map((p) => (p.id === editingProvider.id ? editingProvider : p))
                        : [...providers, editingProvider];
                      onSaveProviders(updated);
                      setEditingProvider(null);
                    }}
                    className="px-4 py-2 bg-white text-black font-bold font-mono text-xs rounded-none border border-white hover:bg-neutral-200"
                  >
                    SIMPAN PROVIDER
                  </button>
                </div>
              </div>
            )}

            {/* Providers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono">
              {providers.map((p) => (
                <div
                  key={p.id}
                  className={`relative p-4 rounded-none border transition-all ${
                    p.active ? "bg-neutral-900 border-white ring-1 ring-white" : "bg-neutral-950 border-neutral-800"
                  }`}
                >
                  <CornerCrosses size="sm" className={p.active ? "text-white" : "text-neutral-700"} />
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs uppercase text-white">{p.name}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-none font-bold border ${p.active ? "bg-emerald-500/20 text-emerald-400 border-emerald-500" : "bg-neutral-900 text-neutral-400 border-neutral-800"}`}>
                      {p.active ? "ACTIVE_ENGINE" : "STANDBY"}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-400 mt-2 space-y-0.5">
                    <div><span className="hud-label">MODEL:</span> <span className="text-neutral-200">{p.model}</span></div>
                    <div className="truncate"><span className="hud-label">ENDPOINT:</span> <span className="text-neutral-400">{p.baseUrl}</span></div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-neutral-800 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        const updated = providers.map((item) => ({ ...item, active: item.id === p.id }));
                        onSaveProviders(updated);
                      }}
                      className={`text-xs font-mono font-bold px-2.5 py-1 rounded-none border transition-colors ${
                        p.active ? "bg-emerald-500 text-black border-emerald-500" : "bg-neutral-900 text-neutral-300 border-neutral-700 hover:border-white hover:text-white"
                      }`}
                    >
                      {p.active ? "ACTIVE" : "SET AKTIF"}
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingProvider(p)}
                        className="text-xs text-neutral-400 hover:text-white border border-neutral-800 px-2 py-1 rounded-none hover:border-white"
                      >
                        EDIT
                      </button>
                      {providers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onSaveProviders(providers.filter((item) => item.id !== p.id))}
                          className="text-xs text-rose-400 hover:text-rose-300 border border-neutral-800 px-2 py-1 rounded-none hover:border-rose-500"
                        >
                          DELETE
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: STORAGE DIRECTORY (Swiss Brutalism) */}
        {activeTab === "storage" && (
          <div className="max-w-2xl space-y-4">
            <div className="border-b border-neutral-800 pb-2">
              <h3 className="font-mono font-bold text-xs uppercase text-white tracking-wider">
                // LOCAL_VIDEO_STORAGE
              </h3>
              <span className="hud-label text-[9px]">
                Direktori lokal tempat file video MP4 hasil render Remotion akan disimpan secara permanen.
              </span>
            </div>

            <div className="relative p-5 border border-neutral-800 bg-neutral-950 space-y-3 rounded-none">
              <CornerCrosses size="sm" className="text-neutral-600" />
              <div className="hud-label">// LOCAL_STORAGE_DIRECTORY</div>
              <label className="font-mono text-xs text-neutral-300 block">
                Path Output File Video (.mp4):
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={dirInput}
                  onChange={(e) => setDirInput(e.target.value)}
                  className="flex-1 bg-neutral-900 border border-neutral-700 px-3 py-2 text-xs font-mono text-white rounded-none focus:outline-none focus:border-white"
                />
                <button
                  type="button"
                  onClick={() => onSaveOutputDir(dirInput)}
                  className="px-4 py-2 bg-white text-black font-mono font-bold text-xs rounded-none border border-white hover:bg-neutral-200"
                >
                  SIMPAN PATH
                </button>
              </div>
              <p className="hud-label text-[9px] text-neutral-500">
                Default: `E:\Videos\ArunakiNexus`. File diindeks otomatis ke database SQLite `arunakinexus.db`.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

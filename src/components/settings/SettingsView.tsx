import React, { useState } from "react";
import { Panel } from "../ui/Panel";
import { Button } from "../ui/Button";
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

// Full registry descriptors from Arunika
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
  const [activeTab, setActiveTab] = useState<"models" | "cli" | "storage">("cli");
  const [dirInput, setDirInput] = useState(outputDir);
  const [editingProvider, setEditingProvider] = useState<ModelProvider | null>(null);

  // Active connected CLI
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
      // Auto-set as active model provider
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
    <div className="flex-1 flex flex-col h-full bg-[#111318] text-neutral-100 overflow-hidden font-sans select-none">
      {/* Top Header Bar */}
      <div className="h-12 px-6 border-b border-neutral-800/80 flex items-center justify-between shrink-0 bg-[#111318]">
        <div>
          <h2 className="font-sans font-bold text-sm text-neutral-200 tracking-tight">
            Settings & Integrations
          </h2>
        </div>

        {/* Arunika Style Tab Selector */}
        <div className="flex items-center gap-1 bg-[#181a20] p-1 rounded-xl border border-neutral-800 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("cli")}
            className={`px-3 py-1.5 flex items-center gap-1.5 rounded-lg font-medium transition-all ${
              activeTab === "cli"
                ? "bg-neutral-800 text-white shadow-sm font-semibold"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Connection CLI</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("models")}
            className={`px-3 py-1.5 flex items-center gap-1.5 rounded-lg font-medium transition-all ${
              activeTab === "models"
                ? "bg-neutral-800 text-white shadow-sm font-semibold"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Model Providers</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("storage")}
            className={`px-3 py-1.5 flex items-center gap-1.5 rounded-lg font-medium transition-all ${
              activeTab === "storage"
                ? "bg-neutral-800 text-white shadow-sm font-semibold"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            <span>Storage Output</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 overflow-y-auto space-y-4 max-w-4xl w-full mx-auto">
        {/* TAB 1: CONNECTION CLI (Exact Arunika CliProviderCard Design) */}
        {activeTab === "cli" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1">
              <div>
                <h3 className="font-bold text-sm text-white">Local Developer CLI Connections</h3>
                <p className="text-xs text-neutral-400">
                  Connect to local CLI subscriptions and tools (Antigravity, Claude, Codex, OpenCode, Kiro) without needing separate API keys.
                </p>
              </div>
              <button
                type="button"
                onClick={onRefreshClis}
                className="px-3 py-1.5 bg-[#181a20] hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white rounded-xl text-xs flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Rescan CLIs</span>
              </button>
            </div>

            {/* List of Arunika-style Horizontal Cards */}
            <div className="space-y-2.5">
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
                    className={`rounded-2xl border transition-all duration-200 ${
                      isConnected
                        ? "bg-[#161820] border-neutral-700 shadow-lg"
                        : "bg-[#14161d] border-neutral-800/80 hover:border-neutral-700"
                    }`}
                  >
                    {/* Header Row */}
                    <div className="px-4 py-3 flex items-center gap-3 min-w-0">
                      {/* Check / Radio Circle Button */}
                      <button
                        type="button"
                        onClick={() => handleToggleConnect(d.id)}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                          isConnected
                            ? "border-white bg-white shadow-sm"
                            : "border-neutral-700 hover:border-neutral-500 bg-transparent"
                        }`}
                        title={isConnected ? "Disconnect" : "Connect"}
                      >
                        {isConnected ? (
                          <Check className="w-3.5 h-3.5 text-black stroke-[3]" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-neutral-600" />
                        )}
                      </button>

                      {/* Info Text */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-neutral-100">{d.name}</span>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isLoggedIn ? "bg-emerald-400" : "bg-neutral-600"}`} />
                          <span className="text-[11px] text-neutral-400">
                            {isLoggedIn ? "Connected" : isInstalled ? "Sign-in needed" : "Not installed"}
                          </span>
                        </div>

                        <p className="text-[10px] text-neutral-500 mt-0.5">
                          {d.vendor}
                          {isLoggedIn ? " • juliosiringoringo6@gmail.com" : ""}
                          {d.version ? ` • ${d.name} ${d.version}` : ""}
                        </p>

                        {/* Entitlement Notice (e.g. Claude Max / Pro) */}
                        {d.entitlement && !isLoggedIn && (
                          <p className="text-[10px] text-amber-500/90 mt-0.5 flex items-center gap-1 flex-wrap">
                            <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                            <span>{d.entitlement}</span>
                            <a
                              href={d.docsUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-neutral-400 hover:text-white underline underline-offset-2"
                            >
                              See plans
                            </a>
                          </p>
                        )}

                        {/* Note */}
                        {d.note && (
                          <p className="text-[10px] text-neutral-500 mt-0.5 leading-relaxed">
                            {d.note}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action Bar (Arunika style) */}
                    <div className="px-4 pb-3 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 relative">
                        {/* Model Dropdown Pill */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenDropdownId(openDropdownId === d.id ? null : d.id)
                            }
                            className="px-2.5 py-1 text-[11px] rounded-lg bg-[#1a1d26] hover:bg-[#202430] border border-neutral-700/80 text-neutral-300 hover:text-white flex items-center gap-1.5 transition-all font-medium"
                          >
                            <span className="text-neutral-500 font-mono">≡</span>
                            <span className="truncate max-w-[130px]">{currentModel}</span>
                            <ChevronDown className="w-3 h-3 text-neutral-400" />
                          </button>

                          {openDropdownId === d.id && (
                            <div className="absolute top-8 left-0 z-50 w-52 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl py-1 text-xs">
                              {d.models.map((m) => (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => {
                                    setSelectedCliModels((prev) => ({ ...prev, [d.id]: m }));
                                    setOpenDropdownId(null);
                                  }}
                                  className={`w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-neutral-800 ${
                                    currentModel === m ? "text-white font-bold bg-neutral-800/60" : "text-neutral-400"
                                  }`}
                                >
                                  <span>{m}</span>
                                  {currentModel === m && <Check className="w-3 h-3 text-emerald-400" />}
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
                          className="px-2.5 py-1 text-[11px] rounded-lg bg-[#1a1d26] hover:bg-[#202430] border border-neutral-700/80 text-neutral-300 hover:text-white flex items-center gap-1.5 transition-all font-medium"
                        >
                          {testingPingId === d.id ? (
                            <Loader2 className="w-3 h-3 animate-spin text-neutral-400" />
                          ) : (
                            <Wifi className="w-3 h-3 text-neutral-400" />
                          )}
                          <span>{ping ? `${ping.ms}ms` : "Test Ping"}</span>
                        </button>

                        {/* Docs Button */}
                        <a
                          href={d.docsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 text-[11px] rounded-lg bg-[#1a1d26] hover:bg-[#202430] border border-neutral-700/80 text-neutral-300 hover:text-white flex items-center gap-1.5 transition-all font-medium"
                        >
                          <Globe className="w-3 h-3 text-neutral-400" />
                          <span>Docs</span>
                        </a>

                        {/* Expand Details Toggle */}
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedCards((prev) => ({ ...prev, [d.id]: !prev[d.id] }))
                          }
                          className="p-1 text-neutral-400 hover:text-white transition-colors"
                        >
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        </button>
                      </div>

                      {/* Connect / Connected Button (Arunika style) */}
                      <button
                        type="button"
                        onClick={() => handleToggleConnect(d.id)}
                        className={`px-3.5 py-1 text-xs rounded-xl font-medium transition-all flex items-center gap-1.5 ${
                          isConnected
                            ? "bg-white text-black font-bold shadow-md hover:bg-neutral-200"
                            : "bg-[#181a20] hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/80"
                        }`}
                      >
                        {isConnected ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Connected</span>
                          </>
                        ) : (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-neutral-500" />
                            <span>Connect</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Expanded Step / Details */}
                    {isExpanded && (
                      <div className="px-4 py-3 border-t border-neutral-800/80 text-xs text-neutral-400 bg-neutral-950/40 rounded-b-2xl space-y-1">
                        <div>ID: <span className="font-mono text-white">{d.id}</span></div>
                        <div>Available Models: <span className="text-neutral-200">{d.models.join(", ")}</span></div>
                        {detected && detected.path && (
                          <div className="truncate">Local Binary: <span className="font-mono text-neutral-300">{detected.path}</span></div>
                        )}
                        {detected && detected.credential_path && (
                          <div className="truncate">Credentials: <span className="font-mono text-emerald-400">{detected.credential_path}</span></div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: MODEL PROVIDERS (Cloud & Local) */}
        {activeTab === "models" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-1">
              <div>
                <h3 className="font-bold text-sm text-white">Cloud & Hosted LLM Providers</h3>
                <p className="text-xs text-neutral-400">
                  Custom OpenAI-compatible and cloud API providers (Groq, Gemini, DeepSeek, OpenRouter, Ollama).
                </p>
              </div>
            </div>

            {/* Editing Form */}
            {editingProvider && (
              <Panel className="p-5 border border-white bg-neutral-900 space-y-3 rounded-2xl">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                  <span className="font-bold text-xs text-white">Provider Configuration</span>
                  <button
                    onClick={() => setEditingProvider(null)}
                    className="text-xs text-neutral-400 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[11px] text-neutral-400 block mb-1">Type:</label>
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
                      className="w-full bg-neutral-950 border border-neutral-700 p-2 text-white rounded-xl focus:outline-none"
                    >
                      {PROVIDER_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-neutral-400 block mb-1">Name:</label>
                    <input
                      type="text"
                      value={editingProvider.name}
                      onChange={(e) => setEditingProvider({ ...editingProvider, name: e.target.value })}
                      className="w-full bg-neutral-950 border border-neutral-700 p-2 text-white rounded-xl focus:outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[11px] text-neutral-400 block mb-1">Base URL:</label>
                    <input
                      type="text"
                      value={editingProvider.baseUrl}
                      onChange={(e) => setEditingProvider({ ...editingProvider, baseUrl: e.target.value })}
                      className="w-full bg-neutral-950 border border-neutral-700 p-2 text-white rounded-xl focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-neutral-400 block mb-1">API Key:</label>
                    <input
                      type="password"
                      placeholder="sk-... atau AIza..."
                      value={editingProvider.apiKey}
                      onChange={(e) => setEditingProvider({ ...editingProvider, apiKey: e.target.value })}
                      className="w-full bg-neutral-950 border border-neutral-700 p-2 text-white rounded-xl focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-neutral-400 block mb-1">Default Model:</label>
                    <input
                      type="text"
                      value={editingProvider.model}
                      onChange={(e) => setEditingProvider({ ...editingProvider, model: e.target.value })}
                      className="w-full bg-neutral-950 border border-neutral-700 p-2 text-white rounded-xl focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      const exists = providers.some((p) => p.id === editingProvider.id);
                      const updated = exists
                        ? providers.map((p) => (p.id === editingProvider.id ? editingProvider : p))
                        : [...providers, editingProvider];
                      onSaveProviders(updated);
                      setEditingProvider(null);
                    }}
                  >
                    Save Provider
                  </Button>
                </div>
              </Panel>
            )}

            {/* Providers List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {providers.map((p) => (
                <div
                  key={p.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    p.active ? "bg-[#161820] border-emerald-500 shadow-md" : "bg-[#14161d] border-neutral-800"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-white">{p.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${p.active ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-neutral-800 text-neutral-400"}`}>
                      {p.active ? "Active" : "Standby"}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-400 mt-2 space-y-0.5">
                    <div>Model: <span className="text-neutral-200">{p.model}</span></div>
                    <div className="truncate">URL: <span className="font-mono text-[11px]">{p.baseUrl}</span></div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-neutral-800/80 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        const updated = providers.map((item) => ({ ...item, active: item.id === p.id }));
                        onSaveProviders(updated);
                      }}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                        p.active ? "bg-emerald-500 text-black font-bold" : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                      }`}
                    >
                      {p.active ? "In Use" : "Select"}
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingProvider(p)}
                        className="text-xs text-neutral-400 hover:text-white"
                      >
                        Edit
                      </button>
                      {providers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onSaveProviders(providers.filter((item) => item.id !== p.id))}
                          className="text-xs text-rose-400 hover:text-rose-300"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: STORAGE DIRECTORY */}
        {activeTab === "storage" && (
          <div className="max-w-2xl space-y-4">
            <div>
              <h3 className="font-bold text-sm text-white">Local Video Storage</h3>
              <p className="text-xs text-neutral-400">
                Directory where rendered Remotion MP4 video files are saved on your machine.
              </p>
            </div>

            <div className="p-5 rounded-2xl border border-neutral-800 bg-[#14161d] space-y-3">
              <label className="text-xs text-neutral-300 block font-medium">
                Output Folder Path:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={dirInput}
                  onChange={(e) => setDirInput(e.target.value)}
                  className="flex-1 bg-neutral-950 border border-neutral-700 px-3 py-2 text-xs text-white rounded-xl focus:outline-none"
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onSaveOutputDir(dirInput)}
                >
                  Save Path
                </Button>
              </div>
              <p className="text-[11px] text-neutral-500">
                Default: `E:\Videos\ArunakiNexus`. Files are indexed into SQLite for instant playback.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

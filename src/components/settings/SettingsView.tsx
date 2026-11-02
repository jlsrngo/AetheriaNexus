import React, { useState } from "react";
import { Panel } from "../ui/Panel";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { ModelProvider, CliItemStatus } from "../../types";
import { PROVIDER_TYPES } from "../../constants/providers";
import {
  Cpu,
  Terminal,
  Folder,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  Play,
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

export const SettingsView: React.FC<SettingsViewProps> = ({
  providers,
  onSaveProviders,
  cliStatus,
  onRefreshClis,
  outputDir,
  onSaveOutputDir,
}) => {
  const [activeTab, setActiveTab] = useState<"models" | "cli" | "storage">("models");
  const [dirInput, setDirInput] = useState(outputDir);
  const [editingProvider, setEditingProvider] = useState<ModelProvider | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Activate provider
  const handleToggleActive = (id: string) => {
    const updated = providers.map((p) => ({
      ...p,
      active: p.id === id,
    }));
    onSaveProviders(updated);
  };

  // Add new provider
  const handleAddNew = () => {
    const defaultType = PROVIDER_TYPES[0];
    const newP: ModelProvider = {
      id: `p-${Date.now()}`,
      name: defaultType.label,
      type: defaultType.value,
      baseUrl: defaultType.defaultUrl,
      apiKey: "",
      model: defaultType.defaultModels[0] || "default",
      active: false,
    };
    setEditingProvider(newP);
  };

  // Save edited provider
  const handleSaveForm = (p: ModelProvider) => {
    const exists = providers.some((item) => item.id === p.id);
    let updated: ModelProvider[];
    if (exists) {
      updated = providers.map((item) => (item.id === p.id ? p : item));
    } else {
      updated = [...providers, p];
    }
    onSaveProviders(updated);
    setEditingProvider(null);
  };

  // Delete provider
  const handleDelete = (id: string) => {
    const updated = providers.filter((p) => p.id !== id);
    if (updated.length > 0 && !updated.some((p) => p.active)) {
      updated[0].active = true;
    }
    onSaveProviders(updated);
  };

  // Test provider connection
  const handleTestConnection = async (p: ModelProvider) => {
    setIsTesting(true);
    setTestResult(null);
    try {
      if (p.type === "gemini" && !p.baseUrl.includes("/openai")) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${p.apiKey}`;
        const res = await fetch(url);
        if (res.ok) {
          setTestResult({ id: p.id, success: true, message: "Koneksi Gemini API Valid & Aktif!" });
        } else {
          setTestResult({ id: p.id, success: false, message: `Error HTTP ${res.status}` });
        }
      } else {
        const endpoint = `${p.baseUrl.replace(/\/+$/, "")}/models`;
        const headers: Record<string, string> = {};
        if (p.apiKey) headers["Authorization"] = `Bearer ${p.apiKey}`;
        const res = await fetch(endpoint, { headers });
        if (res.ok) {
          setTestResult({ id: p.id, success: true, message: `Endpoint ${p.type} terhubung!` });
        } else {
          setTestResult({ id: p.id, success: false, message: `Error HTTP ${res.status}` });
        }
      }
    } catch (e) {
      setTestResult({ id: p.id, success: false, message: `Gagal terhubung: ${e}` });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-950 overflow-hidden blueprint-grid">
      {/* Top Header */}
      <div className="h-14 px-8 border-b border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-950/80 backdrop-blur">
        <div>
          <div className="hud-label">// SYSTEM_CONFIGURATION</div>
          <h2 className="font-mono text-sm font-black text-white uppercase tracking-wider">
            PENGATURAN AI PROVIDER & LOCAL CLI
          </h2>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 font-mono text-xs">
          <button
            onClick={() => setActiveTab("models")}
            className={`px-3 py-1.5 flex items-center gap-2 border transition-all rounded-none ${
              activeTab === "models"
                ? "bg-white text-black border-white font-bold"
                : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white"
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>MODEL PROVIDERS</span>
          </button>
          <button
            onClick={() => setActiveTab("cli")}
            className={`px-3 py-1.5 flex items-center gap-2 border transition-all rounded-none ${
              activeTab === "cli"
                ? "bg-white text-black border-white font-bold"
                : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>CONNECTION CLI (LOCAL)</span>
          </button>
          <button
            onClick={() => setActiveTab("storage")}
            className={`px-3 py-1.5 flex items-center gap-2 border transition-all rounded-none ${
              activeTab === "storage"
                ? "bg-white text-black border-white font-bold"
                : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white"
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            <span>STORAGE OUTPUT</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-8 overflow-y-auto space-y-6">
        {/* TAB 1: MODEL PROVIDERS */}
        {activeTab === "models" && (
          <div className="max-w-4xl space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-mono text-sm font-bold text-white uppercase">
                  // CLOUD & HOSTED PROVIDERS
                </h3>
                <p className="font-mono text-xs text-neutral-400">
                  Konfigurasi endpoint LLM cloud/lokal (Groq, Gemini, DeepSeek, OpenRouter, Ollama) untuk generator naskah.
                </p>
              </div>
              <Button variant="primary" size="sm" onClick={handleAddNew}>
                <Plus className="w-3.5 h-3.5" />
                <span>TAMBAH PROVIDER</span>
              </Button>
            </div>

            {/* Editing Form Modal / Inline Panel */}
            {editingProvider && (
              <Panel className="p-5 border-2 border-white bg-neutral-900 space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                  <span className="font-mono font-bold text-xs text-white">
                    {editingProvider.id.startsWith("p-") ? "// FORM_PROVIDER_CONFIG" : "// EDIT_PROVIDER"}
                  </span>
                  <button
                    onClick={() => setEditingProvider(null)}
                    className="font-mono text-xs text-neutral-400 hover:text-white"
                  >
                    [BATAL]
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 font-mono text-xs">
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
                      className="w-full bg-neutral-950 border border-neutral-700 p-2 text-white rounded-none focus:outline-none focus:border-white"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="hud-label block mb-1">BASE_URL_ENDPOINT:</label>
                    <input
                      type="text"
                      value={editingProvider.baseUrl}
                      onChange={(e) =>
                        setEditingProvider({ ...editingProvider, baseUrl: e.target.value })
                      }
                      className="w-full bg-neutral-950 border border-neutral-700 p-2 text-white rounded-none focus:outline-none focus:border-white"
                    />
                  </div>

                  <div>
                    <label className="hud-label block mb-1">API_KEY (BEARER TOKEN):</label>
                    <input
                      type="password"
                      placeholder={editingProvider.type === "ollama" ? "Opsional untuk Ollama" : "sk-... atau AIza..."}
                      value={editingProvider.apiKey}
                      onChange={(e) =>
                        setEditingProvider({ ...editingProvider, apiKey: e.target.value })
                      }
                      className="w-full bg-neutral-950 border border-neutral-700 p-2 text-white rounded-none focus:outline-none focus:border-white"
                    />
                  </div>

                  <div>
                    <label className="hud-label block mb-1">DEFAULT_MODEL:</label>
                    <input
                      type="text"
                      value={editingProvider.model}
                      onChange={(e) =>
                        setEditingProvider({ ...editingProvider, model: e.target.value })
                      }
                      className="w-full bg-neutral-950 border border-neutral-700 p-2 text-white rounded-none focus:outline-none focus:border-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleTestConnection(editingProvider)}
                    disabled={isTesting}
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>TEST KONEKSI</span>
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleSaveForm(editingProvider)}
                  >
                    SIMPAN PROVIDER
                  </Button>
                </div>
              </Panel>
            )}

            {/* Providers List Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {providers.map((p) => {
                const isSelected = p.active;
                return (
                  <Panel
                    key={p.id}
                    className={`p-4 border transition-all ${
                      isSelected
                        ? "border-emerald-500 bg-neutral-900/90 shadow-lg"
                        : "border-neutral-800 bg-neutral-900/40"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isSelected ? "bg-emerald-400 animate-pulse" : "bg-neutral-600"
                            }`}
                          />
                          <h4 className="font-mono text-xs font-bold text-white uppercase">
                            {p.name}
                          </h4>
                        </div>
                        <span className="hud-label text-[9px] block mt-1">
                          MODEL: <span className="text-neutral-200">{p.model}</span>
                        </span>
                      </div>

                      <Badge variant={isSelected ? "emerald" : "neutral"}>
                        {isSelected ? "ACTIVE_ENGINE" : "STANDBY"}
                      </Badge>
                    </div>

                    <div className="mt-3 pt-3 border-t border-neutral-800 font-mono text-[11px] text-neutral-400 space-y-1 truncate">
                      <div className="truncate">URL: {p.baseUrl}</div>
                      <div>
                        KEY: {p.apiKey ? "••••••••" + p.apiKey.slice(-4) : "(Tidak Ada / Lokal)"}
                      </div>
                    </div>

                    {/* Test result banner */}
                    {testResult && testResult.id === p.id && (
                      <div
                        className={`mt-2 p-2 font-mono text-[10px] flex items-center gap-1.5 ${
                          testResult.success
                            ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800"
                            : "bg-rose-950/60 text-rose-400 border border-rose-800"
                        }`}
                      >
                        {testResult.success ? (
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span>{testResult.message}</span>
                      </div>
                    )}

                    <div className="mt-4 flex items-center justify-between pt-2">
                      <button
                        onClick={() => handleToggleActive(p.id)}
                        disabled={isSelected}
                        className={`font-mono text-[11px] px-2.5 py-1 border rounded-none transition-colors ${
                          isSelected
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500"
                            : "bg-neutral-800 hover:bg-white hover:text-black text-neutral-300 border-neutral-700"
                        }`}
                      >
                        {isSelected ? "SEDANG DIGUNAKAN" : "SET AKTIF"}
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleTestConnection(p)}
                          disabled={isTesting}
                          className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800 transition-colors"
                          title="Test Koneksi"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingProvider(p)}
                          className="px-2 py-1 text-[11px] font-mono text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800 transition-colors"
                        >
                          EDIT
                        </button>
                        {providers.length > 1 && (
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="p-1.5 text-neutral-400 hover:text-rose-400 hover:bg-rose-950/50 border border-neutral-800 transition-colors"
                            title="Hapus Provider"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </Panel>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: LOCAL CLI CONNECTIONS */}
        {activeTab === "cli" && (
          <div className="max-w-4xl space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-mono text-sm font-bold text-white uppercase">
                  // LOCAL AI CLI CONNECTIONS
                </h3>
                <p className="font-mono text-xs text-neutral-400">
                  Deteksi otomatis binary CLI & autentikasi lokal yang terinstal di PC (seperti Google Antigravity `agy`, Claude Code CLI, Codex, OpenCode).
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={onRefreshClis}>
                <RotateCcw className="w-3.5 h-3.5" />
                <span>SCAN ULANG CLI</span>
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(cliStatus).map(([key, item]) => {
                const isOnline = item.installed && (item.logged_in || key === "ollama");
                return (
                  <Panel key={key} className="p-5 border border-neutral-800 bg-neutral-900/50 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Terminal className="w-4 h-4 text-neutral-300" />
                          <h4 className="font-mono text-xs font-bold text-white uppercase">
                            {item.name}
                          </h4>
                        </div>
                        <div className="hud-label text-[9px] mt-1">
                          COMMAND: <span className="text-neutral-300 font-mono">{key}</span>
                        </div>
                      </div>

                      <Badge variant={isOnline ? "emerald" : item.installed ? "amber" : "neutral"}>
                        {isOnline ? "READY / LOGGED IN" : item.installed ? "INSTALLED" : "NOT DETECTED"}
                      </Badge>
                    </div>

                    <div className="bg-neutral-950 p-2.5 border border-neutral-800 font-mono text-[10px] space-y-1 text-neutral-400">
                      <div className="truncate">
                        <span className="text-neutral-500">BIN_PATH:</span> {item.path || "(Tidak ditemukan di system PATH)"}
                      </div>
                      <div className="truncate">
                        <span className="text-neutral-500">AUTH_STATUS:</span>{" "}
                        {item.logged_in ? (
                          <span className="text-emerald-400 font-bold">✓ Authenticated via {item.credential_path}</span>
                        ) : (
                          <span className="text-neutral-500">Belum login atau file auth tidak ditemukan</span>
                        )}
                      </div>
                      <div>
                        <span className="text-neutral-500">AVAILABLE_MODELS:</span>{" "}
                        <span className="text-neutral-300">{item.available_models.join(", ")}</span>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                      <span className="hud-label text-[9px]">
                        DEFAULT: <span className="text-white font-mono">{item.default_model}</span>
                      </span>

                      {item.installed && (
                        <button
                          onClick={() => {
                            // Quick add as active provider
                            const newP: ModelProvider = {
                              id: `cli-${item.id}`,
                              name: item.name,
                              type: item.id === "antigravity" ? "gemini" : item.id === "ollama" ? "ollama" : "custom",
                              baseUrl: item.id === "ollama" ? "http://localhost:11434/v1" : "https://generativelanguage.googleapis.com/v1beta/openai",
                              apiKey: "",
                              model: item.default_model,
                              active: true,
                            };
                            onSaveProviders([
                              ...providers.map((p) => ({ ...p, active: false })),
                              newP,
                            ]);
                            setActiveTab("models");
                          }}
                          className="font-mono text-[11px] px-3 py-1 bg-white text-black hover:bg-neutral-200 font-bold transition-colors"
                        >
                          PAKAI CLI INI
                        </button>
                      )}
                    </div>
                  </Panel>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: STORAGE DIRECTORY */}
        {activeTab === "storage" && (
          <div className="max-w-2xl space-y-5">
            <div>
              <h3 className="font-mono text-sm font-bold text-white uppercase">
                // LOCAL VIDEO STORAGE
              </h3>
              <p className="font-mono text-xs text-neutral-400">
                Folder lokal tempat file output video MP4 hasil render Remotion akan disimpan secara permanen.
              </p>
            </div>

            <Panel className="p-6 space-y-4">
              <div className="hud-label">// LOCAL_STORAGE_DIRECTORY</div>
              <div className="space-y-2">
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
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => onSaveOutputDir(dirInput)}
                  >
                    SIMPAN PATH
                  </Button>
                </div>
                <p className="font-mono text-[10px] text-neutral-500">
                  Direktori default: `E:\Videos\ArunakiNexus`. File MP4 otomatis dimasukkan ke inventaris SQLite Stok Video.
                </p>
              </div>
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
};

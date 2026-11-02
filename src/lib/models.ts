/**
 * Model resolution and catalog definitions for active CLI and model providers.
 */

export interface ModelItem {
  id: string;
  name: string;
  badge?: string;
}

export interface ProviderCatalog {
  id: string;
  name: string;
  badge: string;
  models: ModelItem[];
}

export const CLI_MODELS_CATALOG: Record<string, ProviderCatalog> = {
  antigravity: {
    id: "antigravity",
    name: "Google Antigravity CLI",
    badge: "ANTIGRAVITY",
    models: [
      { id: "claude-opus-4.6-thinking", name: "Claude Opus 4.6 Thinking", badge: "Thinking" },
      { id: "claude-sonnet-4.6-agy", name: "Claude Sonnet 4.6 Agy", badge: "Agy" },
      { id: "claude-sonnet-5.5", name: "Claude Sonnet 5.5" },
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
      { id: "gemini-3-flash", name: "Gemini 3 Flash", badge: "Agent" },
      { id: "gemini-3.1-pro", name: "Gemini 3.1 Pro" },
      { id: "gemini-3.8-flash-high", name: "Gemini 3.8 Flash (High)", badge: "High" },
    ],
  },
  claude: {
    id: "claude",
    name: "Claude Code CLI",
    badge: "CLAUDE",
    models: [
      { id: "claude-3-7-sonnet", name: "Claude 3.7 Sonnet", badge: "Hybrid" },
      { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", badge: "Fast" },
      { id: "claude-3-5-haiku", name: "Claude 3.5 Haiku", badge: "Compact" },
    ],
  },
  codex: {
    id: "codex",
    name: "OpenAI Codex CLI",
    badge: "CODEX",
    models: [
      { id: "gpt-5.6-luna", name: "GPT-5.6 Luna", badge: "Reasoning" },
      { id: "gpt-5.5", name: "GPT-5.5" },
      { id: "gpt-4o", name: "GPT-4o" },
      { id: "o3-mini", name: "o3-mini", badge: "Reasoning" },
    ],
  },
  opencode: {
    id: "opencode",
    name: "OpenCode CLI",
    badge: "OPENCODE",
    models: [
      { id: "big-pickle", name: "Big Pickle", badge: "Zen Built-in" },
      { id: "groq/openai/gpt-oss-120b", name: "GPT-OSS 120B", badge: "Groq LPU" },
      { id: "groq/qwen/qwen3.8-27b", name: "Qwen 3.8 27B" },
    ],
  },
  kiro: {
    id: "kiro",
    name: "Kiro CLI",
    badge: "KIRO",
    models: [
      { id: "kiro/auto", name: "Auto (Best Available)", badge: "Kiro AI" },
      { id: "claude-sonnet-4.5", name: "Claude Sonnet 4.5", badge: "Kiro Pro" },
      { id: "kiro/deepseek-3.2", name: "DeepSeek 3.2", badge: "Reasoning" },
    ],
  },
  ollama: {
    id: "ollama",
    name: "Ollama (Local Host)",
    badge: "OLLAMA",
    models: [
      { id: "llama3.2", name: "Llama 3.2" },
      { id: "qwen2.5:7b", name: "Qwen 2.5 7B" },
      { id: "deepseek-r1:8b", name: "DeepSeek R1 8B", badge: "Reasoning" },
      { id: "mistral", name: "Mistral 7B" },
    ],
  },
};

/** Get the currently active provider ID (CLI or Cloud Provider) */
export function getActiveProviderId(): string {
  try {
    return localStorage.getItem("arunaki_active_provider") || "antigravity";
  } catch {
    return "antigravity";
  }
}

/** Set the currently active provider ID */
export function setActiveProviderId(providerId: string): void {
  try {
    localStorage.setItem("arunaki_active_provider", providerId);
    window.dispatchEvent(
      new CustomEvent("arunaki:provider-change", {
        detail: { providerId },
      })
    );
  } catch { }
}

/** Get available models for a given provider or active provider */
export function getModelsForProvider(providerId?: string): {
  badge: string;
  models: ModelItem[];
} {
  const pId = providerId || getActiveProviderId();

  if (CLI_MODELS_CATALOG[pId]) {
    return {
      badge: CLI_MODELS_CATALOG[pId].badge,
      models: CLI_MODELS_CATALOG[pId].models,
    };
  }

  // Check saved cloud model providers from localStorage
  try {
    const rawProviders = localStorage.getItem("arunaki_providers");
    if (rawProviders) {
      const providers = JSON.parse(rawProviders);
      const match = providers.find((p: any) => p.id === pId || p.type === pId);
      if (match) {
        const pool = match.model ? match.model.split(",").map((s: string) => s.trim()).filter(Boolean) : ["default"];
        return {
          badge: match.name.toUpperCase().replace(/\s+/g, "_"),
          models: pool.map((m: string) => ({
            id: m,
            name: m,
            badge: match.type?.toUpperCase(),
          })),
        };
      }
    }
  } catch { }

  // Fallback to Antigravity
  return {
    badge: "ANTIGRAVITY",
    models: CLI_MODELS_CATALOG.antigravity.models,
  };
}

/** Get the currently active model for the active provider */
export function getActiveModel(providerId?: string): ModelItem {
  const pId = providerId || getActiveProviderId();
  const catalog = getModelsForProvider(pId);

  try {
    const saved =
      localStorage.getItem(`arunaki_cli_model_${pId}`) ||
      localStorage.getItem("arunaki_active_model");

    if (saved) {
      const found = catalog.models.find((m) => m.id === saved);
      if (found) return found;
      return { id: saved, name: saved };
    }
  } catch { }

  return catalog.models[0] || { id: "gemini-3.8-flash-high", name: "Gemini 3.8 Flash" };
}

/** Set the active model */
export function setActiveModel(providerId: string, model: ModelItem): void {
  try {
    localStorage.setItem("arunaki_active_provider", providerId);
    localStorage.setItem("arunaki_active_model", model.id);
    localStorage.setItem(`arunaki_cli_model_${providerId}`, model.id);
    window.dispatchEvent(
      new CustomEvent("arunaki:provider-change", {
        detail: { providerId, modelId: model.id },
      })
    );
  } catch { }
}


export interface ProviderTypeOption {
  value: string;
  label: string;
  defaultUrl: string;
  defaultModels: string[];
}

export const PROVIDER_TYPES: ProviderTypeOption[] = [
  {
    value: "gemini",
    label: "Google Gemini (Official)",
    defaultUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModels: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
  },
  {
    value: "groq",
    label: "Groq Cloud (Ultra-Fast LPU)",
    defaultUrl: "https://api.groq.com/openai/v1",
    defaultModels: [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "deepseek-r1-distill-llama-70b",
      "mixtral-8x7b-32768",
    ],
  },
  {
    value: "deepseek",
    label: "DeepSeek Official",
    defaultUrl: "https://api.deepseek.com/v1",
    defaultModels: ["deepseek-chat", "deepseek-reasoner"],
  },
  {
    value: "openrouter",
    label: "OpenRouter",
    defaultUrl: "https://openrouter.ai/api/v1",
    defaultModels: [
      "google/gemini-2.5-flash",
      "meta-llama/llama-3.3-70b-instruct",
      "anthropic/claude-3.5-sonnet",
      "openai/gpt-4o",
    ],
  },
  {
    value: "openai",
    label: "OpenAI Official",
    defaultUrl: "https://api.openai.com/v1",
    defaultModels: ["gpt-4o", "gpt-4o-mini", "o3-mini"],
  },
  {
    value: "anthropic",
    label: "Anthropic Official",
    defaultUrl: "https://api.anthropic.com/v1",
    defaultModels: ["claude-3-7-sonnet", "claude-3-5-sonnet", "claude-3-5-haiku"],
  },
  {
    value: "ollama",
    label: "Ollama (Local Host)",
    defaultUrl: "http://localhost:11434/v1",
    defaultModels: ["llama3.2", "qwen2.5:7b", "deepseek-r1:8b", "mistral"],
  },
  {
    value: "lmstudio",
    label: "LM Studio (Local Host)",
    defaultUrl: "http://localhost:1234/v1",
    defaultModels: ["local-model"],
  },
  {
    value: "custom",
    label: "Custom OpenAI-Compatible Endpoint",
    defaultUrl: "http://localhost:8000/v1",
    defaultModels: ["default"],
  },
];

export interface ModelProvider {
  id: string;
  name: string;
  type: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  active: boolean;
}

export const INITIAL_PROVIDERS: ModelProvider[] = [
  {
    id: "p-gemini",
    name: "Google Gemini",
    type: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    apiKey: "",
    model: "gemini-2.5-flash",
    active: true,
  },
  {
    id: "p-groq",
    name: "Groq LPU",
    type: "groq",
    baseUrl: "https://api.groq.com/openai/v1",
    apiKey: "",
    model: "llama-3.3-70b-versatile",
    active: false,
  },
  {
    id: "p-ollama",
    name: "Ollama Local",
    type: "ollama",
    baseUrl: "http://localhost:11434/v1",
    apiKey: "",
    model: "llama3.2",
    active: false,
  },
];


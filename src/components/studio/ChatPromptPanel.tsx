import React, { useState, useRef, useEffect, useCallback } from "react";
import { CornerCrosses } from "../ui/CornerCrosses";
import {
  Sparkles,
  Plus,
  Send,
  Download,
  ChevronDown,
  Check,
} from "lucide-react";
import { TikTokVideoProps } from "../../remotion/types";
import {
  getActiveProviderId,
  getModelsForProvider,
  getActiveModel,
  setActiveModel,
  ModelItem,
} from "../../lib/models";
import { useI18n } from "../../lib/i18n";

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
}

interface ChatPromptPanelProps {
  props: TikTokVideoProps;
  setProps: (props: TikTokVideoProps) => void;
  onAiGenerateWithTopic: (topic: string) => Promise<any>;
  onRender: () => void;
  isRendering: boolean;
  renderProgress: number;
}

export const ChatPromptPanel: React.FC<ChatPromptPanelProps> = ({
  onAiGenerateWithTopic,
  onRender,
  isRendering,
  renderProgress,
}) => {
  const { t } = useI18n();
  const [inputPrompt, setInputPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  // Active provider & model state
  const [providerId, setProviderId] = useState<string>(() => getActiveProviderId());
  const [catalog, setCatalog] = useState(() => getModelsForProvider(getActiveProviderId()));
  const [selectedModel, setSelectedModelState] = useState<ModelItem>(() => getActiveModel(getActiveProviderId()));

  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync when provider changes externally (e.g. from Settings or another window)
  useEffect(() => {
    const handleSync = () => {
      const currentPid = getActiveProviderId();
      setProviderId(currentPid);
      const cat = getModelsForProvider(currentPid);
      setCatalog(cat);
      setSelectedModelState(getActiveModel(currentPid));
    };

    window.addEventListener("arunaki:provider-change", handleSync);
    window.addEventListener("storage", handleSync);
    return () => {
      window.removeEventListener("arunaki:provider-change", handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, []);

  const handleSelectModel = useCallback((model: ModelItem) => {
    setSelectedModelState(model);
    setActiveModel(providerId, model);
  }, [providerId]);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "m-init",
      sender: "assistant",
      text: `3 KEBIASAAN PAGI ORANG SUKSES

1. Minum 500ml air mineral sebelum menyentuh HP
2. Stretching ringan 10 menit untuk aliran darah
3. Catat 1 prioritas terpenting hari ini

RINCIAN TELEMETRI:
• Durasi: 00:05 (30 FPS)
• Rasio: 9:16 Vertikal TikTok
• Format Hook: 3 Detik Pertama
• Status: Tersinkronisasi ke Remotion Player`,
      timestamp: "10:49",
    },
  ]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        modelDropdownRef.current &&
        !modelDropdownRef.current.contains(e.target as Node)
      ) {
        setIsModelDropdownOpen(false);
      }
    };
    if (isModelDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isModelDropdownOpen]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!inputPrompt.trim() || isGenerating) return;

    const userText = inputPrompt.trim();
    setInputPrompt("");

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}.${String(
      now.getMinutes()
    ).padStart(2, "0")}`;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: "user",
      text: userText,
      timestamp: timeStr,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsGenerating(true);

    try {
      const script = await onAiGenerateWithTopic(userText);

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        sender: "assistant",
        text: script?.hook
          ? `${script.hook}\n\n${script.body}\n\nRincian:\n• Kategori: ${script.category}\n• Durasi: 00:05 (30 FPS)\n• Model: ${selectedModel.name}\n• Provider: ${catalog.badge}\n• Status: Tersinkronisasi ke Remotion Player`
          : `Naskah video berhasil diperbarui untuk topik: "${userText}"\n\nRINCIAN TELEMETRI:\n• Model: ${selectedModel.name}\n• Provider: ${catalog.badge}\n• Durasi: 00:05 (150 Frames)\n• Status: Tersinkronisasi ke Canvas Viewport`,
        timestamp: timeStr,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `e-${Date.now()}`,
        sender: "assistant",
        text: `// ERROR: Gagal memproses naskah dengan model ${selectedModel.name}.\n${err?.message || "Koneksi provider terputus."}`,
        timestamp: timeStr,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    setMessages([
      {
        id: `m-${Date.now()}`,
        sender: "assistant",
        text: `Sesi sutradara baru siap. Masukkan ide naskah TikTok atau produk yang ingin dipromosikan.`,
        timestamp: "10:49",
      },
    ]);
  };

  return (
    <div className="w-[420px] h-full bg-neutral-950 border-l border-neutral-800 flex flex-col font-mono select-none">
      {/* Panel Header */}
      <div className="h-10 px-4 border-b border-neutral-800 flex items-center justify-between text-xs text-neutral-400 font-bold uppercase tracking-wider">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-white" />
          <span className="text-white">{t("directorTitle")}</span>
        </div>
        <button
          type="button"
          onClick={handleNewChat}
          className="flex items-center gap-1 text-[10px] px-2 py-0.5 border border-neutral-800 hover:border-white text-neutral-400 hover:text-white transition-colors"
        >
          <Plus className="w-3 h-3" />
          <span>{t("newChat")}</span>
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className="relative group">
            {msg.sender === "assistant" ? (
              <div className="relative border border-neutral-800 bg-neutral-900/60 p-3.5 rounded-none font-mono text-xs text-neutral-200">
                <CornerCrosses />
                <div className="flex items-center justify-between text-[10px] text-neutral-500 mb-2 border-b border-neutral-800/80 pb-1">
                  <span className="font-bold text-neutral-400">// AI_DIRECTOR ({catalog.badge})</span>
                  <span>{msg.timestamp}</span>
                </div>
                <div className="whitespace-pre-wrap leading-relaxed text-neutral-200 font-mono">
                  {msg.text}
                </div>
              </div>
            ) : (
              <div className="relative border border-neutral-700 bg-neutral-800/50 p-3 rounded-none font-mono text-xs text-neutral-100 ml-4">
                <div className="flex items-center justify-between text-[10px] text-neutral-400 mb-1 border-b border-neutral-700/60 pb-1">
                  <span className="font-bold text-white">// USER_PROMPT</span>
                  <span>{msg.timestamp}</span>
                </div>
                <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
              </div>
            )}
          </div>
        ))}
        {isGenerating && (
          <div className="relative border border-neutral-800 bg-neutral-900/30 p-3 font-mono text-xs text-neutral-400 flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-400 animate-ping"></span>
            <span>// MEMPROSES_NASKAH_DENGAN_{catalog.badge}...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box Area (Swiss Brutalism) */}
      <div className="p-3 border-t border-neutral-800 bg-neutral-950 flex flex-col gap-2">
        <div className="relative border border-neutral-700 bg-neutral-900/90 rounded-none p-2 flex flex-col gap-2">
          <CornerCrosses />

          {/* Textarea */}
          <textarea
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("askPlaceholder")}
            rows={3}
            className="w-full bg-transparent text-xs text-neutral-100 placeholder-neutral-500 resize-none outline-none font-mono leading-relaxed"
          />

          {/* Input Footer Controls */}
          <div className="flex items-center justify-between pt-1 border-t border-neutral-800">
            {/* Model Selector Dropdown with Active Vendor */}
            <div className="relative" ref={modelDropdownRef}>
              <button
                type="button"
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                className="text-[10px] font-mono border border-neutral-700 bg-neutral-950 text-neutral-300 hover:text-white hover:border-neutral-500 px-2 py-0.5 flex items-center gap-1.5 transition-colors cursor-pointer rounded-none max-w-[210px]"
                title="Pilih Model AI"
              >
                <span className="text-neutral-500 font-bold">=</span>
                <span className="truncate uppercase font-bold">{selectedModel.name}</span>
                <ChevronDown className="w-2.5 h-2.5 text-neutral-400 shrink-0" />
              </button>

              {/* Swiss Brutalist Model Menu */}
              {isModelDropdownOpen && (
                <div className="absolute bottom-full mb-1.5 left-0 w-64 max-h-64 overflow-y-auto bg-neutral-900 border border-neutral-700 shadow-2xl z-50 rounded-none">
                  <div className="px-3 py-1.5 border-b border-neutral-800 flex items-center justify-between font-mono text-[10px] text-neutral-400 bg-neutral-950">
                    <span className="font-bold">// MODEL</span>
                    <span className="px-1.5 py-0.5 bg-neutral-800 text-white font-mono text-[9px] uppercase tracking-wider border border-neutral-700 font-bold">
                      {catalog.badge}
                    </span>
                  </div>
                  {catalog.models.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        handleSelectModel(m);
                        setIsModelDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-white hover:text-black transition-colors ${
                        selectedModel.id === m.id ? "text-white font-bold bg-neutral-800" : "text-neutral-300"
                      }`}
                    >
                      <span className="truncate text-xs font-mono">{m.name}</span>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {m.badge && (
                          <span className="text-[9px] px-1.5 py-0.2 bg-neutral-800 text-neutral-300 border border-neutral-700">
                            {m.badge}
                          </span>
                        )}
                        {selectedModel.id === m.id && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Send Button */}
            <button
              type="button"
              onClick={handleSend}
              disabled={isGenerating || !inputPrompt.trim() || isRendering}
              className="w-6 h-6 rounded-none bg-white hover:bg-neutral-200 text-black flex items-center justify-center transition-colors disabled:opacity-30 cursor-pointer font-bold"
              title="Kirim pesan"
            >
              <Send className="w-3 h-3 ml-0.5" />
            </button>
          </div>
        </div>

        {/* Render Video Button (Swiss Brutalism) */}
        {isRendering ? (
          <div className="p-2.5 bg-neutral-900 border border-neutral-800 rounded-none font-mono">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-white font-bold animate-pulse">// {t("rendering")}</span>
              <span className="text-white font-mono">{renderProgress}%</span>
            </div>
            <div className="w-full bg-neutral-950 h-1.5 border border-neutral-800 rounded-none overflow-hidden">
              <div
                className="bg-white h-full transition-all duration-200"
                style={{ width: `${renderProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onRender}
            disabled={isGenerating}
            className="w-full py-2.5 px-3 bg-white text-black hover:bg-neutral-200 border border-white font-mono font-bold text-xs uppercase tracking-wider rounded-none flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t("renderToStock")}</span>
          </button>
        )}
      </div>
    </div>
  );
};

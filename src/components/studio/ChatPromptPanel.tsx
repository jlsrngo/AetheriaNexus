import React, { useState, useRef, useEffect } from "react";
import { CornerCrosses } from "../ui/CornerCrosses";
import {
  Sparkles,
  Plus,
  Send,
  Download,
  Paperclip,
  ChevronDown,
  Check,
} from "lucide-react";
import { TikTokVideoProps } from "../../remotion/types";

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
}

interface ChatPromptPanelProps {
  props: TikTokVideoProps;
  setProps: (props: TikTokVideoProps) => void;
  onAiGenerateWithTopic: (topic: string) => Promise<void>;
  onRender: () => void;
  isRendering: boolean;
  renderProgress: number;
}

const AVAILABLE_CHAT_MODELS = [
  { id: "gemini-3.8-flash", name: "GEMINI 3.8 FLASH" },
  { id: "gemini-2.5-flash", name: "GEMINI 2.5 FLASH" },
  { id: "gemini-2.5-pro", name: "GEMINI 2.5 PRO" },
  { id: "claude-3-7-sonnet", name: "CLAUDE 3.7 SONNET" },
  { id: "claude-3-5-sonnet", name: "CLAUDE 3.5 SONNET" },
  { id: "gpt-4o", name: "GPT-4O (OPENAI)" },
  { id: "deepseek-r1", name: "DEEPSEEK R1" },
  { id: "llama-3.3-70b", name: "LLAMA 3.3 70B (GROQ)" },
];

export const ChatPromptPanel: React.FC<ChatPromptPanelProps> = ({
  onAiGenerateWithTopic,
  onRender,
  isRendering,
  renderProgress,
}) => {
  const [sessionTitle, setSessionTitle] = useState("// TIKTOK_DIRECTOR_SESSION_01");
  const [inputPrompt, setInputPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_CHAT_MODELS[0]);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [taskExecuted, setTaskExecuted] = useState(true);

  const modelDropdownRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNewChat = () => {
    setMessages([
      {
        id: `m-${Date.now()}`,
        sender: "assistant",
        text: "Sesi AI Director baru aktif. Ketik topik video apapun untuk mulai meracik naskah.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    setSessionTitle(`// TIKTOK_SESSION_${Date.now().toString().slice(-4)}`);
    setTaskExecuted(false);
  };

  const handleSend = async () => {
    const text = inputPrompt.trim();
    if (!text || isGenerating) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: "user",
      text,
      timestamp: timeStr,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt("");
    setIsGenerating(true);
    setSessionTitle(`// TOPIC_${text.toUpperCase().slice(0, 16)}`);

    try {
      await onAiGenerateWithTopic(text);
      setTaskExecuted(true);
      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        sender: "assistant",
        text: `✓ Naskah video baru untuk "${text}" berhasil diracik!\n\nCanvas Remotion Player di sebelah kiri telah diperbarui secara langsung. Anda dapat menekan tombol Render di bawah untuk menyimpannya ke Stok Video.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: "assistant",
        text: "Terjadi kendala saat memproses permintaan AI. Coba gunakan model atau topik lain.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="w-[420px] bg-neutral-950 flex flex-col justify-between overflow-hidden border-l border-neutral-800 select-none font-mono">
      {/* 1. TOP HEADER (Swiss Brutalism HUD) */}
      <div className="h-9 px-3 border-b border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-950 rounded-none">
        <div className="flex items-center gap-2 truncate pr-2">
          <span className="w-2 h-2 bg-emerald-400 shrink-0"></span>
          <span className="font-mono font-bold text-xs text-white uppercase tracking-wider truncate">
            {sessionTitle}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleNewChat}
            className="px-2 py-0.5 rounded-none bg-neutral-900 hover:bg-white hover:text-black border border-neutral-700 text-neutral-300 font-mono text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
            title="New Chat Session"
          >
            <Plus className="w-3 h-3" />
            <span>NEW</span>
          </button>
        </div>
      </div>

      {/* 2. TASK EXECUTION CHIP (Swiss Brutalism HUD Banner) */}
      {taskExecuted && (
        <div className="px-3 pt-2">
          <div className="relative p-2 bg-neutral-900 border border-neutral-800 rounded-none flex items-center justify-between text-[11px] text-neutral-300 font-mono">
            <CornerCrosses size="sm" className="text-neutral-700" />
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-bold text-white">// EXECUTED_TASK: 1/1 REMOTION_SYNC</span>
            </div>
            <span className="hud-label text-[9px] text-neutral-400">1/1 // READY</span>
          </div>
        </div>
      )}

      {/* 3. MESSAGE STREAM (Swiss Brutalist Sharp Cards) */}
      <div className="flex-1 p-3 overflow-y-auto space-y-3 text-xs font-mono">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
          >
            <div className="hud-label text-[9px] mb-1 text-neutral-500">
              {msg.sender === "user" ? "OPERATOR" : "AI_DIRECTOR"} // {msg.timestamp}
            </div>
            <div
              className={`relative p-3.5 rounded-none text-xs leading-relaxed max-w-[94%] border transition-all ${
                msg.sender === "user"
                  ? "bg-white text-black border-white font-bold shadow-lg"
                  : "bg-neutral-900/90 text-neutral-200 border-neutral-800 whitespace-pre-wrap"
              }`}
            >
              {msg.sender !== "user" && <CornerCrosses size="sm" className="text-neutral-700" />}
              {msg.text}
            </div>
          </div>
        ))}

        {isGenerating && (
          <div className="flex items-center gap-2 text-neutral-400 text-xs p-3 bg-neutral-900 border border-neutral-800 rounded-none animate-pulse">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
            <span>AI Director sedang meracik naskah & hook video...</span>
          </div>
        )}
      </div>

      {/* 4. BOTTOM INPUT BOX & ACTION BUTTONS (Swiss Brutalism) */}
      <div className="p-3 border-t border-neutral-800 bg-neutral-950 space-y-2 shrink-0">
        <div className="relative bg-neutral-900 border border-neutral-800 focus-within:border-white rounded-none p-2.5 transition-colors">
          <CornerCrosses size="sm" className="text-neutral-700" />

          {/* Textarea */}
          <textarea
            rows={2}
            placeholder="Ketik topik video (misal: '3 kebiasaan sukses', 'tips atur gaji')..."
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={isGenerating || isRendering}
            className="w-full bg-transparent text-xs leading-[20px] text-white placeholder-neutral-500 resize-none focus:outline-none font-mono rounded-none"
          />

          {/* Bottom Bar: Attach + Model Picker + Send Button */}
          <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-neutral-800">
            <div className="flex items-center gap-1.5 relative" ref={modelDropdownRef}>
              {/* Paperclip */}
              <button
                type="button"
                className="w-6 h-6 rounded-none border border-neutral-800 bg-neutral-950 hover:bg-white hover:text-black flex items-center justify-center text-neutral-400 transition-colors cursor-pointer"
                title="Attach file"
              >
                <Paperclip className="w-3.5 h-3.5" />
              </button>

              {/* Model Picker Pill */}
              <button
                type="button"
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                className="px-2 py-0.5 rounded-none bg-neutral-950 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 text-[10px] font-mono flex items-center gap-1.5 transition-colors"
              >
                <span className="text-neutral-500">≡</span>
                <span className="truncate max-w-[130px] font-bold">{selectedModel.name}</span>
                <ChevronDown className="w-3 h-3 text-neutral-400 shrink-0" />
              </button>

              {/* Model Dropdown Menu */}
              {isModelDropdownOpen && (
                <div className="absolute bottom-8 left-0 z-50 w-56 bg-neutral-950 border border-white rounded-none shadow-2xl py-1 text-xs font-mono">
                  <div className="px-3 py-1 text-[9px] text-neutral-400 uppercase font-bold border-b border-neutral-800">
                    // PILIH_MODEL_AI
                  </div>
                  {AVAILABLE_CHAT_MODELS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setSelectedModel(m);
                        setIsModelDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-white hover:text-black transition-colors ${
                        selectedModel.id === m.id ? "text-white font-bold bg-neutral-800" : "text-neutral-400"
                      }`}
                    >
                      <span className="truncate">{m.name}</span>
                      {selectedModel.id === m.id && <Check className="w-3.5 h-3.5 text-emerald-400" />}
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
              <span className="text-white font-bold animate-pulse">// MERENDER_MP4...</span>
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
            <span>RENDER KE STOK VIDEO</span>
          </button>
        )}
      </div>
    </div>
  );
};

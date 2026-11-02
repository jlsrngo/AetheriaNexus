import React, { useState, useRef, useEffect } from "react";
import {
  Bot,
  Sparkles,
  Plus,
  Send,
  Download,
  Paperclip,
  ChevronDown,
  Check,
  Columns,
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
  { id: "gemini-3.8-flash", name: "Gemini 3.8 Flash (Low)" },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
  { id: "claude-3-7-sonnet", name: "Claude 3.7 Sonnet" },
  { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet" },
  { id: "gpt-4o", name: "GPT-4o" },
  { id: "deepseek-r1", name: "DeepSeek R1" },
  { id: "llama-3.3-70b", name: "Llama 3.3 70B (Groq)" },
];

export const ChatPromptPanel: React.FC<ChatPromptPanelProps> = ({
  onAiGenerateWithTopic,
  onRender,
  isRendering,
  renderProgress,
}) => {
  const [sessionTitle, setSessionTitle] = useState("TIKTOK-SCRIPT.txt direct...");
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
      text: `3 Kebiasaan Pagi Orang Sukses yang Mengubah Segalanya

1. Minum 500ml air mineral sebelum menyentuh HP
2. Stretching ringan 10 menit untuk aliran darah
3. Catat 1 prioritas terpenting hari ini

Rincian:
• Durasi: 00:05 (30 FPS)
• Rasio: 9:16 Vertikal TikTok
• Format Hook: 3 Detik Pertama
• Status: Tersinkronisasi ke Remotion Player`,
      timestamp: "10.49",
    },
  ]);

  // Close model dropdown on outside click
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
        text: "Sesi baru siap. Ketik topik video TikTok yang Anda inginkan...",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    setSessionTitle("TIKTOK-NEW-SESSION.txt...");
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
    setSessionTitle(`${text.toUpperCase().slice(0, 18)}.txt...`);

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
        text: "Terjadi kesalahan saat memproses permintaan AI. Coba gunakan model atau topik lain.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="w-[420px] bg-[#111318] flex flex-col justify-between overflow-hidden border-l border-neutral-800 select-none">
      {/* 1. TOP HEADER (Arunika style) */}
      <div className="h-10 px-3.5 border-b border-neutral-800/80 flex items-center justify-between shrink-0 bg-[#111318]">
        <div className="flex items-center gap-2 truncate pr-2">
          <Bot className="w-4 h-4 text-neutral-400 shrink-0" />
          <span className="font-sans font-bold text-xs text-neutral-100 truncate tracking-tight">
            {sessionTitle}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            className="w-6 h-6 rounded-md bg-amber-500 hover:bg-amber-400 text-black flex items-center justify-center transition-colors shadow-sm"
            title="AI Features"
          >
            <Sparkles className="w-3.5 h-3.5 fill-black" />
          </button>
          <button
            type="button"
            onClick={handleNewChat}
            className="w-6 h-6 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800/60 flex items-center justify-center transition-colors"
            title="New Chat Session"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="w-6 h-6 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800/60 flex items-center justify-center transition-colors"
            title="Layout Toggle"
          >
            <Columns className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. TASK EXECUTION BADGE (Arunika style chip) */}
      {taskExecuted && (
        <div className="px-3.5 pt-2.5">
          <div className="px-3 py-1.5 bg-[#181a20] border border-neutral-800/80 rounded-xl flex items-center justify-between text-xs text-neutral-300 font-sans cursor-pointer hover:border-neutral-700 transition-colors">
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-semibold text-xs">Executed 1/1 video script task</span>
            </div>
            <div className="flex items-center gap-1.5 text-neutral-500 text-[11px]">
              <span>1/1</span>
              <ChevronDown className="w-3 h-3" />
            </div>
          </div>
        </div>
      )}

      {/* 3. MESSAGE STREAM (Arunika style card bubbles) */}
      <div className="flex-1 p-3.5 overflow-y-auto space-y-4 text-xs font-sans">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`p-4 rounded-2xl text-xs leading-relaxed max-w-[92%] border transition-all ${
                msg.sender === "user"
                  ? "bg-neutral-800 text-white border-neutral-700 font-medium"
                  : "bg-[#181a20] text-neutral-200 border-neutral-800/90 whitespace-pre-wrap font-sans shadow-sm"
              }`}
            >
              {msg.text}
            </div>
            <span className="text-[10px] text-neutral-500 mt-1 px-1">{msg.timestamp}</span>
          </div>
        ))}

        {isGenerating && (
          <div className="flex items-center gap-2 text-neutral-400 text-xs p-3 bg-[#181a20] rounded-2xl border border-neutral-800 animate-pulse">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
            <span>AI Director sedang meracik naskah & hook video...</span>
          </div>
        )}
      </div>

      {/* 4. BOTTOM INPUT BOX & ACTIONS (Arunika exact style) */}
      <div className="p-3 border-t border-neutral-800/80 bg-[#111318] space-y-2 shrink-0">
        <div className="bg-[#181a20] border border-neutral-700/70 focus-within:border-neutral-500 rounded-2xl p-2.5 transition-all shadow-inner">
          {/* Textarea */}
          <textarea
            rows={2}
            placeholder="Ask anything, type @ to mention files, / for commands..."
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={isGenerating || isRendering}
            className="w-full bg-transparent text-xs leading-[20px] text-white placeholder-neutral-500 resize-none focus:outline-none"
          />

          {/* Bottom Bar inside input box: Attach + Model Picker + Send Button */}
          <div className="flex items-center justify-between pt-1 mt-1 border-t border-neutral-800/60">
            <div className="flex items-center gap-2 relative" ref={modelDropdownRef}>
              {/* Paperclip / Attach icon */}
              <button
                type="button"
                className="w-6 h-6 rounded-md flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-800/60 transition-colors"
                title="Attach file"
              >
                <Paperclip className="w-3.5 h-3.5" />
              </button>

              {/* Model Picker Pill */}
              <button
                type="button"
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                className="px-2.5 py-1 rounded-lg bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/60 text-[11px] font-sans flex items-center gap-1.5 transition-all"
              >
                <span className="truncate max-w-[140px] font-medium">{selectedModel.name}</span>
                <ChevronDown className="w-3 h-3 text-neutral-400 shrink-0" />
              </button>

              {/* Model Dropdown Menu */}
              {isModelDropdownOpen && (
                <div className="absolute bottom-9 left-6 z-50 w-52 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl py-1 text-xs">
                  <div className="px-3 py-1.5 text-[10px] text-neutral-400 uppercase font-bold border-b border-neutral-800">
                    PILIH MODEL AI
                  </div>
                  {AVAILABLE_CHAT_MODELS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setSelectedModel(m);
                        setIsModelDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-neutral-800 transition-colors ${
                        selectedModel.id === m.id ? "text-white font-bold bg-neutral-800/50" : "text-neutral-400"
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
              className="w-7 h-7 rounded-full bg-neutral-200 hover:bg-white text-black flex items-center justify-center transition-transform active:scale-95 disabled:opacity-30 cursor-pointer shadow-sm"
              title="Send message"
            >
              <Send className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </div>
        </div>

        {/* Render Video Button */}
        {isRendering ? (
          <div className="p-2.5 bg-neutral-900 border border-neutral-800 rounded-xl">
            <div className="flex items-center justify-between text-xs font-mono mb-1.5">
              <span className="text-white font-bold animate-pulse">// MERENDER_MP4...</span>
              <span className="text-white font-mono">{renderProgress}%</span>
            </div>
            <div className="w-full bg-neutral-950 h-1.5 rounded-full overflow-hidden">
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
            className="w-full py-2 px-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-200 hover:text-white rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-neutral-400" />
            <span>Render Video ke Stok Persediaan</span>
          </button>
        )}
      </div>
    </div>
  );
};

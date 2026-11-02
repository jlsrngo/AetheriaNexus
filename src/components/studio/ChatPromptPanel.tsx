import React, { useState } from "react";
import { Panel } from "../ui/Panel";
import { Button } from "../ui/Button";
import { Send, Plus, Download, Sparkles } from "lucide-react";
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

export const ChatPromptPanel: React.FC<ChatPromptPanelProps> = ({
  onAiGenerateWithTopic,
  onRender,
  isRendering,
  renderProgress,
}) => {
  const [sessionName, setSessionName] = useState("Session: AI Video Director");
  const [inputPrompt, setInputPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "m-init",
      sender: "assistant",
      text: "Halo! Ketik ide atau topik video TikTok yang Anda inginkan (misal: '3 kebiasaan sukses', 'tips atur gaji', 'rahasia FYP'). Saya akan langsung merumuskan naskah dan memperbarui preview video di sebelah kiri.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const handleNewSession = () => {
    setMessages([
      {
        id: `m-${Date.now()}`,
        sender: "assistant",
        text: "Sesi baru dimulai. Ketik topik video apapun untuk mulai membuat naskah.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    setSessionName(`Session: Video #${Date.now().toString().slice(-4)}`);
  };

  const handleSend = async () => {
    const text = inputPrompt.trim();
    if (!text || isGenerating) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt("");
    setIsGenerating(true);
    setSessionName(`Session: ${text.slice(0, 24)}...`);

    try {
      await onAiGenerateWithTopic(text);
      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        sender: "assistant",
        text: `✓ Naskah video berhasil diracik! Canvas preview di sebelah kiri telah diperbarui dengan hook baru.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: "assistant",
        text: "Maaf, terjadi kendala saat meracik video. Coba ulangi dengan topik lain.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="w-[420px] bg-neutral-950 flex flex-col justify-between overflow-hidden border-l border-neutral-800 select-none">
      {/* 1. Top Header: Session Name (VS Code Chat style) */}
      <div className="h-9 px-4 border-b border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-950">
        <div className="flex items-center gap-2 truncate">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span className="font-mono text-xs font-bold text-neutral-200 truncate">
            {sessionName}
          </span>
        </div>

        <button
          onClick={handleNewSession}
          className="p-1 text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors flex items-center gap-1 font-mono text-[11px]"
          title="New Chat Session"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">New</span>
        </button>
      </div>

      {/* 2. Chat Area: Message History */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 font-mono text-xs">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
          >
            <div className="hud-label text-[9px] mb-1 text-neutral-500">
              {msg.sender === "user" ? "You" : "AI Director"} • {msg.timestamp}
            </div>
            <div
              className={`p-3 max-w-[88%] rounded-none text-xs leading-relaxed border ${
                msg.sender === "user"
                  ? "bg-white text-black border-white font-medium"
                  : "bg-neutral-900 text-neutral-200 border-neutral-800 font-sans"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {isGenerating && (
          <div className="flex items-center gap-2 text-neutral-400 font-mono text-xs p-2 animate-pulse">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
            <span>AI sedang meracik naskah & hook...</span>
          </div>
        )}
      </div>

      {/* 3. Bottom: Input Box with Send Button & Render Button */}
      <div className="p-3 border-t border-neutral-800 space-y-2 bg-neutral-950 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            placeholder="Ketik topik video (misal: '3 kebiasaan sukses')..."
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            disabled={isGenerating || isRendering}
            className="flex-1 bg-neutral-900 border border-neutral-800 px-3 py-2 text-xs font-mono text-white rounded-none focus:outline-none focus:border-white disabled:opacity-50"
          />
          <Button
            variant="primary"
            size="sm"
            type="submit"
            disabled={isGenerating || !inputPrompt.trim() || isRendering}
            className="px-3"
            title="Kirim pesan"
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </form>

        {/* Render Action */}
        {isRendering ? (
          <Panel className="p-2.5 bg-neutral-900 border border-neutral-700">
            <div className="flex items-center justify-between font-mono text-[11px] mb-1.5">
              <span className="text-white font-bold animate-pulse">// MERENDER_MP4...</span>
              <span className="text-white font-mono">{renderProgress}%</span>
            </div>
            <div className="w-full bg-neutral-950 h-1.5 border border-neutral-800">
              <div
                className="bg-white h-full transition-all duration-200"
                style={{ width: `${renderProgress}%` }}
              />
            </div>
          </Panel>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            className="w-full text-xs font-mono"
            onClick={onRender}
            disabled={isGenerating}
          >
            <Download className="w-3.5 h-3.5" />
            <span>RENDER KE STOK VIDEO</span>
          </Button>
        )}
      </div>
    </div>
  );
};

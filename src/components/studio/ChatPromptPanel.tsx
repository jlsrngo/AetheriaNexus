import React, { useState } from "react";
import { Panel } from "../ui/Panel";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Sparkles, Send, Download, SlidersHorizontal } from "lucide-react";
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

const QUICK_SUGGESTIONS = [
  "3 Cara Bangun Jam 5 Pagi Tanpa Mengantuk",
  "Tips Atur Gaji UMR Biar Punya Tabungan",
  "5 Tools AI Gratis yang Jarang Diketahui",
  "Trik Psikologi 3 Detik Bikin Orang Percaya",
  "Rahasia Konten FYP TikTok 2026",
];

export const ChatPromptPanel: React.FC<ChatPromptPanelProps> = ({
  props,
  setProps,
  onAiGenerateWithTopic,
  onRender,
  isRendering,
  renderProgress,
}) => {
  const [inputPrompt, setInputPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showManualProps, setShowManualProps] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "m-01",
      sender: "assistant",
      text: "Halo! Saya AI Director ArunakiNexus. Ketik topik apapun yang Anda inginkan (misal: '3 kebiasaan sukses', 'tips kelola gaji', 'rahasia FYP'), dan saya akan langsung meracik hook 3 detik, naskah, dan memperbarui preview video di sebelah kiri secara instan.",
      timestamp: "16:20",
    },
  ]);

  const handleSend = async (topicToSend?: string) => {
    const text = (topicToSend || inputPrompt).trim();
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

    try {
      await onAiGenerateWithTopic(text);
      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        sender: "assistant",
        text: `✓ Naskah video berhasil diracik! Canvas player sebelah kiri telah diperbarui dengan hook baru. Klik tombol di bawah untuk merender ke stok.`,
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
    <div className="w-[450px] bg-neutral-950/95 flex flex-col justify-between overflow-hidden border-l border-neutral-800 select-none">
      {/* Top Telemetry Header */}
      <div className="p-4 border-b border-neutral-800 flex items-center justify-between shrink-0">
        <div>
          <div className="hud-label">// CONVERSATIONAL_DIRECTOR</div>
          <div className="font-mono text-xs font-bold text-white uppercase mt-0.5">
            AI VIDEO AGENT
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowManualProps(!showManualProps)}
            className="font-mono text-[10px] text-neutral-400 hover:text-white flex items-center gap-1 border border-neutral-800 px-2 py-1 transition-colors"
            title="Toggle Manual Form"
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span>{showManualProps ? "CHAT MODE" : "MANUAL PROPS"}</span>
          </button>
          <Badge variant="emerald">ONLINE</Badge>
        </div>
      </div>

      {/* Main Body: Chat Stream OR Manual Props */}
      {!showManualProps ? (
        <div className="flex-1 p-4 overflow-y-auto space-y-4 font-mono text-xs">
          {/* Quick suggestions */}
          <div className="space-y-1.5 pb-2 border-b border-neutral-900">
            <span className="hud-label text-[9px]">QUICK_TOPIC_PILLS:</span>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_SUGGESTIONS.map((topic, i) => (
                <button
                  key={i}
                  disabled={isGenerating}
                  onClick={() => handleSend(topic)}
                  className="text-[10px] bg-neutral-900 hover:bg-white hover:text-black text-neutral-300 border border-neutral-800 px-2.5 py-1 transition-all rounded-none disabled:opacity-50 text-left truncate max-w-[200px]"
                >
                  ⚡ {topic}
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div className="space-y-3 pt-2">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
              >
                <div className="hud-label text-[8px] mb-1">
                  {msg.sender === "user" ? "YOU // OPERATOR" : "AI // DIRECTOR"} [
                  {msg.timestamp}]
                </div>
                <div
                  className={`p-3 max-w-[90%] border rounded-none text-xs leading-relaxed ${
                    msg.sender === "user"
                      ? "bg-white text-black border-white font-bold"
                      : "bg-neutral-900/90 text-neutral-200 border-neutral-800 font-sans"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {isGenerating && (
              <div className="flex items-center gap-2 text-neutral-400 font-mono text-[11px] p-2 animate-pulse">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                <span>AI sedang merumuskan hook viral & naskah...</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Manual Tuning Form */
        <div className="flex-1 p-5 overflow-y-auto space-y-4 font-mono text-xs">
          <div className="hud-label">// FINE_TUNE_PARAMETERS</div>

          <div className="space-y-1">
            <label className="hud-label block">CATEGORY_BADGE:</label>
            <input
              type="text"
              value={props.category}
              onChange={(e) => setProps({ ...props, category: e.target.value })}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-none px-3 py-2 text-xs text-white focus:outline-none focus:border-white"
            />
          </div>

          <div className="space-y-1">
            <label className="hud-label block">HOOK_TITLE:</label>
            <textarea
              rows={3}
              value={props.hookText}
              onChange={(e) => setProps({ ...props, hookText: e.target.value })}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-none p-3 text-xs font-sans font-bold text-white focus:outline-none focus:border-white resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="hud-label block">CONTENT_POINTS:</label>
            <textarea
              rows={4}
              value={props.bodyText}
              onChange={(e) => setProps({ ...props, bodyText: e.target.value })}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-none p-3 text-xs text-neutral-200 focus:outline-none focus:border-white resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="hud-label block">WATERMARK_HANDLE:</label>
            <input
              type="text"
              value={props.authorHandle}
              onChange={(e) => setProps({ ...props, authorHandle: e.target.value })}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-none px-3 py-2 text-xs text-white focus:outline-none focus:border-white"
            />
          </div>
        </div>
      )}

      {/* Bottom Section: Prompt Input & Render Button */}
      <div className="p-4 border-t border-neutral-800 space-y-3 bg-neutral-950 shrink-0">
        {/* Chat input box */}
        {!showManualProps && (
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
              className="flex-1 bg-neutral-900 border border-neutral-700 px-3 py-2 text-xs font-mono text-white rounded-none focus:outline-none focus:border-white disabled:opacity-50"
            />
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={isGenerating || !inputPrompt.trim() || isRendering}
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </form>
        )}

        {/* Render Progress or Render Button */}
        {isRendering ? (
          <Panel className="p-3 bg-neutral-900 border border-neutral-700">
            <div className="flex items-center justify-between font-mono text-xs mb-1.5">
              <span className="text-white font-bold animate-pulse">// MERENDER_MP4...</span>
              <span className="text-white font-mono">{renderProgress}%</span>
            </div>
            <div className="w-full bg-neutral-950 h-2 border border-neutral-800">
              <div
                className="bg-white h-full transition-all duration-200"
                style={{ width: `${renderProgress}%` }}
              />
            </div>
          </Panel>
        ) : (
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={onRender}
            disabled={isGenerating}
          >
            <Download className="w-4 h-4" />
            <span>RENDER & SIMPAN KE STOK VIDEO</span>
          </Button>
        )}
      </div>
    </div>
  );
};

import { useState, useEffect } from "react";
import { Mic, Video, Sliders, Sparkles, Upload, ArrowRight } from "lucide-react";
import { Dialog, DialogContent } from "../../../ui/dialog";
import { cn } from "../../../../lib/utils";
import { AudioPresetPanel } from "./AudioPresetPanel";
import { VideoPresetPanel } from "./VideoPresetPanel";
import type { PresetStudioModalProps, PresetStudioStep } from "./presetTypes";

export function PresetStudioModal({
  open,
  initialStep = "choose",
  onClose,
  onSendMessage,
}: PresetStudioModalProps) {
  const [step, setStep] = useState<PresetStudioStep>(initialStep);
  const [focusedSide, setFocusedSide] = useState<"audio" | "video">("audio");

  useEffect(() => {
    if (open) {
      setStep(initialStep);
      setFocusedSide("audio");
    }
  }, [open, initialStep]);

  // Left / Right keyboard navigation on the initial chooser screen
  useEffect(() => {
    if (!open || step !== "choose") return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setFocusedSide("audio");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setFocusedSide("video");
      } else if (e.key === "Enter") {
        e.preventDefault();
        setStep(focusedSide);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, step, focusedSide]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        onClose={onClose}
        className={cn(
          "transition-all duration-150",
          step === "choose" ? "max-w-xl" : "max-w-2xl"
        )}
      >
        {step === "choose" && (
          <div className="flex flex-col gap-4">
            {/* Title Header */}
            <div className="space-y-1 pr-6">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--bg-panel)] border border-[var(--border-color)] text-[10px] font-mono text-[var(--text-secondary)]">
                <span>/add</span>
                <span>•</span>
                <span>Preset & Reference Studio</span>
              </div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Pilih Jenis Preset & Referensi
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Gunakan tombol panah <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-panel)] border border-[var(--border-color)] font-mono text-[10px]">←</kbd>{" "}
                <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-panel)] border border-[var(--border-color)] font-mono text-[10px]">→</kbd>{" "}
                atau klik salah satu kartu di bawah untuk menambahkan referensi & tuning manual maupun dengan AI.
              </p>
            </div>

            {/* Left vs Right Selection Grid */}
            <div className="grid grid-cols-2 gap-3.5 pt-1">
              {/* LEFT CARD: AUDIO / VOICE PRESET */}
              <button
                type="button"
                onMouseEnter={() => setFocusedSide("audio")}
                onClick={() => setStep("audio")}
                className={cn(
                  "group relative text-left p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between min-h-[210px]",
                  focusedSide === "audio"
                    ? "bg-emerald-500/[0.08] border-emerald-500/60 shadow-sm"
                    : "bg-[var(--bg-panel)] border-[var(--border-color)] hover:border-[var(--border-strong)]"
                )}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <Mic className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Kiri • Audio
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                      Audio & Voice Preset
                    </h3>
                    <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                      Upload sampel suara (.wav), atur preset <code>aetheria</code>, tuning manual intonasi (CFG, tempo, pitch), tes render suara tanpa LLM, atau minta AI tuning.
                    </p>
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-[var(--border-color)] flex items-center justify-between text-[11px] font-medium text-emerald-400">
                  <span className="inline-flex items-center gap-1">
                    <Sliders className="w-3 h-3" />
                    Manual & AI Voice Tuning
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>

              {/* RIGHT CARD: VIDEO TEMPLATE / REFERENCE */}
              <button
                type="button"
                onMouseEnter={() => setFocusedSide("video")}
                onClick={() => setStep("video")}
                className={cn(
                  "group relative text-left p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between min-h-[210px]",
                  focusedSide === "video"
                    ? "bg-rose-500/[0.08] border-rose-500/60 shadow-sm"
                    : "bg-[var(--bg-panel)] border-[var(--border-color)] hover:border-[var(--border-strong)]"
                )}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                      <Video className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      Kanan • Video
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                      Video Template & Referensi
                    </h3>
                    <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                      Upload video referensi (.mp4) atau link TikTok/Reels, ekstrak palet warna & keyframe otomatis, pilih Style DNA, dan minta AI tuning motion grafisnya.
                    </p>
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-[var(--border-color)] flex items-center justify-between text-[11px] font-medium text-rose-400">
                  <span className="inline-flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Blueprint & Motion Tuning
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            </div>

            <div className="flex items-center justify-between text-[10px] text-[var(--text-dim)] pt-1">
              <span className="inline-flex items-center gap-1">
                <Upload className="w-3 h-3" />
                Mendukung upload file lokal (.wav, .mp3, .mp4) & link referensi
              </span>
              <span>Tekan Enter untuk membuka kartu yang dipilih</span>
            </div>
          </div>
        )}

        {step === "audio" && (
          <AudioPresetPanel
            onBack={() => setStep("choose")}
            onClose={onClose}
            onSendMessage={onSendMessage}
          />
        )}

        {step === "video" && (
          <VideoPresetPanel
            onBack={() => setStep("choose")}
            onClose={onClose}
            onSendMessage={onSendMessage}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}


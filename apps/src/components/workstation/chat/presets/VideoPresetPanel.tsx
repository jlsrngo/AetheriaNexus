import { useState, useRef } from "react";
import {
  ArrowLeft,
  Video,
  Upload,
  Sparkles,
  Link2,
  Loader2,
  CheckCircle2,
  Palette,
  Film,
} from "lucide-react";
import { toast } from "sonner";
import { API_BASE, apiFetch } from "../../../../lib/api";
import { cn } from "../../../../lib/utils";

interface VideoPresetPanelProps {
  onBack: () => void;
  onClose: () => void;
  onSendMessage: (
    prompt: string,
    files?: Array<{ name: string; uri: string; mime?: string }>
  ) => void;
}

const STYLE_DNA_OPTIONS = [
  {
    id: "auto-reference",
    label: "Auto Follow Reference (>90%)",
    desc: "Ikuti palet, tipografi, dan ritme potongan dari video referensi",
  },
  {
    id: "clean-airy",
    label: "Clean Airy",
    desc: "Blue-white bg, soft glows, dark ink text, kartu melayang",
  },
  {
    id: "night-focus",
    label: "Night Focus",
    desc: "Near-black blue, dim glows, kartu gelap dengan border tipis",
  },
  {
    id: "soft-neon",
    label: "Soft Neon",
    desc: "Dark indigo, mint + violet light, headline geometris",
  },
  {
    id: "mono-editorial",
    label: "Mono Editorial",
    desc: "Hitam/putih kontras, serif besar, aksen merah tua",
  },
  {
    id: "warm-paper",
    label: "Warm Paper",
    desc: "Warm off-white, peach glow, coklat tua & terracotta",
  },
] as const;

export function VideoPresetPanel({
  onBack,
  onClose,
  onSendMessage,
}: VideoPresetPanelProps) {
  const [templateName, setTemplateName] = useState("viral-reference-template");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [uploadedBase64, setUploadedBase64] = useState("");
  const [savedVideoPath, setSavedVideoPath] = useState("");
  const [extractedReport, setExtractedReport] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);

  // Manual Visual & Motion Tuning Knobs
  const [styleDna, setStyleDna] = useState<string>("auto-reference");
  const [pacing, setPacing] = useState<"fast" | "balanced" | "cinematic">("fast");
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9" | "1:1">("9:16");
  const [voicePreset, setVoicePreset] = useState<string>("aetheria");
  const [voiceStyle, setVoiceStyle] = useState<string>("default");
  const [tuningInstruction, setTuningInstruction] = useState("");

  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setUploadedBase64(reader.result);
        toast.success(`Video referensi "${file.name}" siap diekstrak.`);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleExtractBlueprint = async () => {
    if (!uploadedBase64 && !savedVideoPath) {
      toast.error("Upload file video MP4 terlebih dahulu untuk diekstrak lokal.");
      return;
    }
    setIsExtracting(true);
    try {
      const res = await apiFetch(`${API_BASE}/studio/video-reference/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: uploadedFileName || undefined,
          videoBase64: uploadedBase64 || undefined,
          videoPath: savedVideoPath || undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || "Gagal mengekstrak blueprint video referensi.");
        return;
      }
      setSavedVideoPath(data.videoPath || "");
      setExtractedReport(data.reportMarkdown || "Blueprint berhasil diekstrak ke workspace/ref/extracted/ref_report.md");
      toast.success("Blueprint visual, palet warna & keyframe berhasil diekstrak!");
    } catch (err: any) {
      toast.error(`Error ekstraksi: ${err?.message || String(err)}`);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSendToLlmTuning = () => {
    const refSource = savedVideoPath
      ? `File Video Referensi Lokal: ${savedVideoPath} (Blueprint: workspace/ref/extracted/ref_report.md)`
      : referenceUrl.trim()
        ? `Link Video Referensi: ${referenceUrl.trim()}`
        : uploadedFileName
          ? `File Video Upload: ${uploadedFileName}`
          : "Template Motion Graphics Baru";

    const customNote =
      tuningInstruction.trim() ||
      "Buat / tuning video HTML Motion Engine mengikuti referensi ini dengan kemiripan layout, palet warna, dan tipografi di atas 90%.";

    const prompt = `[Video Preset & Reference Studio: ${templateName}]
- Sumber Referensi: ${refSource}
- Style DNA: ${styleDna}
- Rasio Video: ${aspectRatio} | Tempo Transisi: ${pacing}
- Suara Narator: voice="${voicePreset}" (style="${voiceStyle}")

Instruksi Tuning Video & Motion:
${customNote}`;

    onSendMessage(prompt);
    onClose();
  };

  return (
    <div className="flex flex-col gap-3.5 max-h-[78vh] overflow-y-auto pr-1">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 rounded-lg bg-[var(--bg-hover)] hover:bg-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            title="Kembali ke pilihan Kiri/Kanan"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <div className="flex items-center gap-1.5">
            <Video className="w-4 h-4 text-rose-400" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Video Preset & Reference Studio
            </h3>
          </div>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
          Blueprint & Motion Tuning
        </span>
      </div>

      {/* 1. Upload Video File or Paste Link */}
      <div className="p-3 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-color)] space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-[var(--text-primary)]">
            1. Upload Video Referensi (.MP4) atau Link TikTok / Reels
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border-color)] cursor-pointer transition-colors"
            >
              <Upload className="w-3 h-3 text-rose-400" />
              {uploadedFileName ? "Ganti Video" : "Upload .MP4"}
            </button>
            {uploadedBase64 && (
              <button
                type="button"
                onClick={handleExtractBlueprint}
                disabled={isExtracting}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-rose-500 hover:bg-rose-600 text-white cursor-pointer disabled:opacity-50"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Mengekstrak...
                  </>
                ) : (
                  <>
                    <Film className="w-3 h-3" />
                    Ekstrak Keyframe & Palet
                  </>
                )}
              </button>
            )}
          </div>
          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            className="hidden"
            onChange={handleVideoFileChange}
          />
        </div>

        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-5 space-y-1">
            <label className="text-[10px] text-[var(--text-muted)]">Nama Preset / Project</label>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="misal: tech-explainer-reel"
              className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-xs font-mono text-[var(--text-primary)] focus:outline-none"
            />
          </div>
          <div className="col-span-7 space-y-1">
            <label className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
              <Link2 className="w-3 h-3" />
              Link Referensi (TikTok / YouTube Shorts / Reels)
            </label>
            <input
              type="text"
              value={referenceUrl}
              onChange={(e) => setReferenceUrl(e.target.value)}
              placeholder="https://www.tiktok.com/@username/video/..."
              className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] focus:outline-none"
            />
          </div>
        </div>

        {extractedReport && (
          <div className="p-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-strong)] flex items-center gap-2 text-[11px] text-[var(--text-primary)]">
            <CheckCircle2 className="w-4 h-4 text-[var(--text-primary)] shrink-0" />
            <span className="truncate">
              Blueprint terekstrak ke <code>workspace/ref/extracted/ref_report.md</code>
            </span>
          </div>
        )}
      </div>

      {/* 2. Visual DNA & Pacing Knobs */}
      <div className="p-3 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-color)] space-y-2.5">
        <div className="flex items-center gap-1.5">
          <Palette className="w-3.5 h-3.5 text-rose-400" />
          <span className="text-[11px] font-medium text-[var(--text-primary)]">
            2. Pilih Style DNA & Ritme Visual
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {STYLE_DNA_OPTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setStyleDna(item.id)}
              className={cn(
                "text-left p-2 rounded-lg border transition-colors cursor-pointer",
                styleDna === item.id
                  ? "bg-rose-500/15 border-rose-500/40 text-[var(--text-primary)]"
                  : "bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              )}
            >
              <div className="text-[11px] font-semibold">{item.label}</div>
              <div className="text-[10px] text-[var(--text-muted)] line-clamp-1">
                {item.desc}
              </div>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="space-y-1">
            <label className="text-[10px] text-[var(--text-muted)]">Rasio Kanvas</label>
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value as any)}
              className="w-full px-2 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
            >
              <option value="9:16">9:16 (TikTok / Reels)</option>
              <option value="16:9">16:9 (YouTube Landscape)</option>
              <option value="1:1">1:1 (Square Feed)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-[var(--text-muted)]">Tempo Transisi</label>
            <select
              value={pacing}
              onChange={(e) => setPacing(e.target.value as any)}
              className="w-full px-2 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
            >
              <option value="fast">Fast Hook (TikTok Dynamic)</option>
              <option value="balanced">Balanced Storytelling</option>
              <option value="cinematic">Calm Cinematic</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-[var(--text-muted)]">Pasangkan Preset Suara</label>
            <div className="flex gap-1">
              <select
                value={voicePreset}
                onChange={(e) => setVoicePreset(e.target.value)}
                className="w-1/2 px-1.5 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
              >
                <option value="aetheria">aetheria (ID)</option>
                <option value="aetheria_en">aetheria_en (EN)</option>
                <option value="id-ID-GadisNeural">GadisNeural</option>
                <option value="id-ID-ArdiNeural">ArdiNeural</option>
              </select>
              <select
                value={voiceStyle}
                onChange={(e) => setVoiceStyle(e.target.value)}
                className="w-1/2 px-1.5 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
              >
                <option value="default">default</option>
                <option value="energetic">energetic</option>
                <option value="casual">casual</option>
                <option value="mystery">mystery</option>
                <option value="serious">serious</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Ask LLM to Build / Tune Video Template */}
      <div className="p-3 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-color)] space-y-2">
        <label className="text-[11px] font-medium text-[var(--text-primary)]">
          3. Instruksi Tuning Visual & Animasi untuk AI Agent
        </label>
        <textarea
          rows={2}
          value={tuningInstruction}
          onChange={(e) => setTuningInstruction(e.target.value)}
          placeholder="Contoh: Ikuti layout kartu dan warna dari referensi, tapi ganti topiknya jadi bahas fitur Aetheria Agent, animasikan teks per kata sesuai ketukan suara..."
          className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] resize-none focus:outline-none"
        />
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={handleSendToLlmTuning}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-500 hover:bg-rose-600 text-white cursor-pointer transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Kirim ke Agent & Tuning Video
          </button>
        </div>
      </div>
    </div>
  );
}


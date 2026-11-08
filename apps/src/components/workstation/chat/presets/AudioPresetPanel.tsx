import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Mic,
  Play,
  Upload,
  Sparkles,
  Save,
  Sliders,
  Plus,
  Loader2,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { API_BASE, apiFetch } from "../../../../lib/api";
import { cn } from "../../../../lib/utils";
import type { VoicePresetItem } from "./presetTypes";

interface AudioPresetPanelProps {
  onBack: () => void;
  onClose: () => void;
  onSendMessage: (
    prompt: string,
    files?: Array<{ name: string; uri: string; mime?: string }>
  ) => void;
}

const STYLE_KEYS = ["default", "energetic", "casual", "mystery", "serious"] as const;

export function AudioPresetPanel({
  onBack,
  onClose,
  onSendMessage,
}: AudioPresetPanelProps) {
  const [presets, setPresets] = useState<Record<string, VoicePresetItem>>({});
  const [selectedId, setSelectedId] = useState<string>("aetheria");
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Editable fields
  const [customId, setCustomId] = useState("");
  const [name, setName] = useState("");
  const [lang, setLang] = useState<"id" | "en">("id");
  const [selectedStyle, setSelectedStyle] = useState<string>("default");
  const [cfgValue, setCfgValue] = useState<number>(1.48);
  const [rate, setRate] = useState<number>(10);
  const [pitch, setPitch] = useState<number>(14);
  const [promptText, setPromptText] = useState("");
  const [controlInstruction, setControlInstruction] = useState("");

  // Uploaded audio sample
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [uploadedBase64, setUploadedBase64] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Test & AI Tuning
  const [testText, setTestText] = useState(
    "Kalian tahu nggak, kalau ini Aetheria, agen motion grafis otomatis yang bikin konten video jadi makin hidup dan sinematik."
  );
  const [aiTuningNote, setAiTuningNote] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load presets from backend
  useEffect(() => {
    let mounted = true;
    apiFetch(`${API_BASE}/studio/voice-presets`)
      .then((res) => res.json())
      .then((data) => {
        if (!mounted) return;
        if (data?.presets && typeof data.presets === "object") {
          setPresets(data.presets);
          const firstKey = data.presets["aetheria"]
            ? "aetheria"
            : Object.keys(data.presets)[0] || "aetheria";
          setSelectedId(firstKey);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Sync form when preset or style changes
  useEffect(() => {
    if (isCreatingNew) return;
    const p = presets[selectedId];
    if (!p) return;

    setName(p.name || selectedId);
    setLang(p.lang === "en" ? "en" : "id");
    const st = p.styles?.[selectedStyle];
    setCfgValue(st?.cfgValue ?? p.cfgValue ?? 1.48);
    setPromptText(st?.promptText || p.promptText || "");
    setControlInstruction(st?.controlInstruction || p.controlInstruction || "");

    const rawRate = parseInt((p.fallback?.rate || "+10%").replace(/[^-\d]/g, ""), 10);
    const rawPitch = parseInt((p.fallback?.pitch || "+14Hz").replace(/[^-\d]/g, ""), 10);
    setRate(Number.isFinite(rawRate) ? rawRate : 0);
    setPitch(Number.isFinite(rawPitch) ? rawPitch : 0);

    if (p.lang === "en") {
      setTestText(
        "Did you know that this is Aetheria, an automated motion graphics agent that brings your video content to life with cinematic quality."
      );
    } else {
      setTestText(
        "Kalian tahu nggak, kalau ini Aetheria, agen motion grafis otomatis yang bikin konten video jadi makin hidup dan sinematik."
      );
    }
  }, [selectedId, selectedStyle, presets, isCreatingNew]);

  const handleStartNewPreset = () => {
    setIsCreatingNew(true);
    setCustomId("custom_voice");
    setName("Custom Creator Voice");
    setLang("id");
    setSelectedStyle("default");
    setCfgValue(1.48);
    setRate(5);
    setPitch(0);
    setPromptText("");
    setControlInstruction(
      "Gaya bercerita antusias ala konten kreator, artikulasi lepas dan plong, intonasi dinamis."
    );
    setUploadedFileName("");
    setUploadedBase64("");
  };

  const handleSelectExisting = (id: string) => {
    setIsCreatingNew(false);
    setSelectedId(id);
    setUploadedFileName("");
    setUploadedBase64("");
  };

  const handleAudioFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setUploadedBase64(reader.result);
        toast.success(`Audio referensi "${file.name}" siap disimpan.`);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSavePreset = async () => {
    const targetId = isCreatingNew ? customId.trim() : selectedId;
    if (!targetId) {
      toast.error("ID Preset wajib diisi.");
      return;
    }
    if (!promptText.trim()) {
      toast.error("Kalimat referensi (Prompt Text) wajib diisi sesuai sampel audio.");
      return;
    }

    setIsSaving(true);
    try {
      const existingStyles = !isCreatingNew ? presets[selectedId]?.styles || {} : {};
      const updatedStyles = {
        ...existingStyles,
        [selectedStyle]: {
          label:
            existingStyles[selectedStyle]?.label ||
            `${selectedStyle.charAt(0).toUpperCase() + selectedStyle.slice(1)} Style`,
          mode: "ultimate",
          sampleFile:
            uploadedFileName ||
            presets[selectedId]?.sampleFile ||
            `${targetId}.wav`,
          promptText: promptText.trim(),
          cfgValue,
          controlInstruction: controlInstruction.trim(),
        },
      };

      const res = await apiFetch(`${API_BASE}/studio/voice-presets/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: targetId,
          name: name.trim() || targetId,
          lang,
          promptText: promptText.trim(),
          controlInstruction: controlInstruction.trim(),
          cfgValue,
          styles: isCreatingNew ? undefined : updatedStyles,
          sampleFileName: uploadedFileName || undefined,
          sampleBase64: uploadedBase64 || undefined,
          fallbackRate: `${rate >= 0 ? "+" : ""}${rate}%`,
          fallbackPitch: `${pitch >= 0 ? "+" : ""}${pitch}Hz`,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || "Gagal menyimpan preset suara.");
        return;
      }
      if (data.presets) {
        setPresets(data.presets);
      }
      setIsCreatingNew(false);
      setSelectedId(data.preset?.id || targetId);
      toast.success(`Preset "${data.preset?.id || targetId}" berhasil disimpan!`);
    } catch (err: any) {
      toast.error(`Error: ${err?.message || String(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestVoice = async () => {
    if (!testText.trim()) {
      toast.error("Masukkan kalimat tes terlebih dahulu.");
      return;
    }
    const targetId = isCreatingNew ? customId.trim() : selectedId;
    if (isCreatingNew && uploadedBase64) {
      await handleSavePreset();
    }

    setIsTesting(true);
    setPreviewAudioUrl(null);
    try {
      const res = await apiFetch(`${API_BASE}/studio/voice-presets/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: testText.trim(),
          voice: targetId || "aetheria",
          style: selectedStyle,
          lang,
          cfgValue,
          rate: `${rate >= 0 ? "+" : ""}${rate}%`,
          pitch: `${pitch >= 0 ? "+" : ""}${pitch}Hz`,
        }),
      });
      const data = await res.json();
      if (!data.success || !data.audioDataUrl) {
        toast.error(data.error || "Gagal merender contoh suara.");
        return;
      }
      setPreviewAudioUrl(data.audioDataUrl);
      toast.success("Contoh suara berhasil di-generate (Tanpa LLM)!");
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.play().catch(() => {});
        }
      }, 80);
    } catch (err: any) {
      toast.error(`Gagal mengetes suara: ${err?.message || String(err)}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleAskAiToTune = () => {
    const targetId = isCreatingNew ? customId.trim() || "custom_voice" : selectedId;
    const note =
      aiTuningNote.trim() ||
      "Tolong bantu tuning intonasi, jeda napas, dan cfgValue preset suara ini supaya terdengar makin natural dan lepas.";
    const prompt = `[Audio Preset Studio: ${targetId}:${selectedStyle}]
Preset: "${targetId}" (lang: ${lang}, style: ${selectedStyle}, cfgValue: ${cfgValue}, rate: ${rate >= 0 ? "+" : ""}${rate}%, pitch: ${pitch >= 0 ? "+" : ""}${pitch}Hz)
Kalimat Referensi (promptText): "${promptText}"
Kalimat Tes: "${testText}"

Instruksi Tuning Audio:
${note}
(Catatan: Render contoh suaranya saja dengan voicebox_speak tanpa perlu merender ulang video penuh).`;

    const files =
      uploadedBase64 && uploadedFileName
        ? [{ name: uploadedFileName, uri: uploadedBase64, mime: "audio/wav" }]
        : undefined;

    onSendMessage(prompt, files);
    onClose();
  };

  return (
    <div className="flex flex-col gap-3.5 max-h-[78vh] overflow-y-auto pr-1">
      {/* Header Navigation */}
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
            <Mic className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Audio & Voice Preset Studio
            </h3>
          </div>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Zero-LLM Manual & AI Tuning
        </span>
      </div>

      {/* 1. Preset Selector Pills + Add New */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-[var(--text-secondary)]">
          1. Pilih Preset Suara atau Buat Baru
        </label>
        <div className="flex items-center gap-1.5 flex-wrap">
          {Object.keys(presets).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => handleSelectExisting(id)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer",
                !isCreatingNew && selectedId === id
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                  : "bg-[var(--bg-panel)] text-[var(--text-secondary)] border-[var(--border-color)] hover:bg-[var(--bg-hover)]"
              )}
            >
              {id} ({presets[id]?.lang?.toUpperCase() || "ID"})
            </button>
          ))}
          <button
            type="button"
            onClick={handleStartNewPreset}
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer",
              isCreatingNew
                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                : "bg-[var(--bg-panel)] text-[var(--text-muted)] border-dashed border-[var(--border-strong)] hover:text-[var(--text-primary)]"
            )}
          >
            <Plus className="w-3 h-3" />
            Preset Baru
          </button>
        </div>
      </div>

      {/* New Preset ID & Language Row */}
      <div className="grid grid-cols-12 gap-2">
        {isCreatingNew && (
          <div className="col-span-4 space-y-1">
            <label className="text-[10px] text-[var(--text-muted)]">ID Preset (unik)</label>
            <input
              type="text"
              value={customId}
              onChange={(e) => setCustomId(e.target.value)}
              placeholder="misal: aetheria_pro"
              className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--bg-panel)] border border-[var(--border-color)] text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-strong)]"
            />
          </div>
        )}
        <div className={cn(isCreatingNew ? "col-span-5" : "col-span-8", "space-y-1")}>
          <label className="text-[10px] text-[var(--text-muted)]">Nama Preset</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--bg-panel)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-strong)]"
          />
        </div>
        <div className={cn(isCreatingNew ? "col-span-3" : "col-span-4", "space-y-1")}>
          <label className="text-[10px] text-[var(--text-muted)]">Bahasa</label>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as "id" | "en")}
            className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--bg-panel)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] focus:outline-none"
          >
            <option value="id">Indonesia (ID)</option>
            <option value="en">English (EN)</option>
          </select>
        </div>
      </div>

      {/* 2. Upload Reference WAV & Prompt Text */}
      <div className="p-3 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-color)] space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-[var(--text-primary)]">
            2. Sampel Referensi Suara (.wav) & Transkrip
          </span>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border-color)] cursor-pointer transition-colors"
          >
            <Upload className="w-3 h-3 text-emerald-400" />
            {uploadedFileName ? "Ganti Audio" : "Upload Referensi .WAV"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.wav,.mp3"
            className="hidden"
            onChange={handleAudioFileUpload}
          />
        </div>

        <div className="text-[10px] text-[var(--text-muted)] flex items-center gap-1.5">
          <span>File aktif:</span>
          <code className="px-1.5 py-0.5 rounded bg-[var(--bg-card)] text-emerald-400 font-mono">
            {uploadedFileName || presets[selectedId]?.sampleFile || "aetheria_id.wav"}
          </code>
          <span>(Ideal: 6–9 detik, berhenti bersih di akhir kalimat)</span>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-[var(--text-muted)]">
            Kalimat Transkrip Sampel (wajib 100% sama dengan yang diucapkan di audio referensi):
          </label>
          <textarea
            rows={2}
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            placeholder="Tulis kalimat persis yang diucapkan di file audio referensi..."
            className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] resize-none focus:outline-none focus:border-[var(--border-strong)]"
          />
        </div>
      </div>

      {/* 3. Manual Tuning Sliders (Style, CFG, Rate, Pitch) */}
      <div className="p-3 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-color)] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] font-medium text-[var(--text-primary)]">
              3. Tuning Intonasi Manual (Per Style)
            </span>
          </div>
          <div className="flex items-center gap-1">
            {STYLE_KEYS.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setSelectedStyle(st)}
                className={cn(
                  "px-2 py-0.5 rounded-md text-[10px] font-medium border transition-colors cursor-pointer",
                  selectedStyle === st
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : "bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-color)] hover:text-[var(--text-primary)]"
                )}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {/* CFG Value Slider */}
          <div className="space-y-1 bg-[var(--bg-card)] p-2 rounded-lg border border-[var(--border-color)]">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-[var(--text-secondary)]">CFG (Lepas vs Tegas)</span>
              <span className="font-mono text-emerald-400">{cfgValue.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={1.2}
              max={2.0}
              step={0.02}
              value={cfgValue}
              onChange={(e) => setCfgValue(parseFloat(e.target.value))}
              className="w-full accent-emerald-400 cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-[var(--text-dim)]">
              <span>1.20 (Lepas)</span>
              <span>1.48 (Pas)</span>
              <span>2.00 (Ketat)</span>
            </div>
          </div>

          {/* Speaking Rate Slider */}
          <div className="space-y-1 bg-[var(--bg-card)] p-2 rounded-lg border border-[var(--border-color)]">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-[var(--text-secondary)]">Tempo Bicara (Rate)</span>
              <span className="font-mono text-emerald-400">
                {rate >= 0 ? `+${rate}%` : `${rate}%`}
              </span>
            </div>
            <input
              type="range"
              min={-20}
              max={25}
              step={1}
              value={rate}
              onChange={(e) => setRate(parseInt(e.target.value, 10))}
              className="w-full accent-emerald-400 cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-[var(--text-dim)]">
              <span>-20%</span>
              <span>0%</span>
              <span>+25%</span>
            </div>
          </div>

          {/* Pitch Slider */}
          <div className="space-y-1 bg-[var(--bg-card)] p-2 rounded-lg border border-[var(--border-color)]">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-[var(--text-secondary)]">Nada Dasar (Pitch)</span>
              <span className="font-mono text-emerald-400">
                {pitch >= 0 ? `+${pitch}Hz` : `${pitch}Hz`}
              </span>
            </div>
            <input
              type="range"
              min={-15}
              max={20}
              step={1}
              value={pitch}
              onChange={(e) => setPitch(parseInt(e.target.value, 10))}
              className="w-full accent-emerald-400 cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-[var(--text-dim)]">
              <span>-15Hz</span>
              <span>0Hz</span>
              <span>+20Hz</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Live Voice Test (Zero-LLM) + Ask AI Tuning */}
      <div className="p-3 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-color)] space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-[var(--text-primary)]">
            4. Tes Render Suara (Tanpa LLM) & Bantuan AI Tuning
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleSavePreset}
              disabled={isSaving}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border-color)] cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Save className="w-3 h-3 text-emerald-400" />
              )}
              Simpan Preset
            </button>

            <button
              type="button"
              onClick={handleTestVoice}
              disabled={isTesting}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-medium bg-emerald-500 hover:bg-emerald-600 text-black font-semibold cursor-pointer disabled:opacity-50 transition-colors"
            >
              {isTesting ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Merender Suara...
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-current" />
                  Tes Suara Sekarang
                </>
              )}
            </button>
          </div>
        </div>

        <textarea
          rows={2}
          value={testText}
          onChange={(e) => setTestText(e.target.value)}
          placeholder="Tulis kalimat untuk mengetes hasil intonasi suara..."
          className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] resize-none focus:outline-none"
        />

        {previewAudioUrl && (
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] text-emerald-300 font-medium">
                Preview Hasil Tuning ({selectedId}:{selectedStyle})
              </span>
            </div>
            <audio
              ref={audioRef}
              src={previewAudioUrl}
              controls
              className="h-7 max-w-[260px]"
            />
          </div>
        )}

        {/* Ask AI to Tune Box */}
        <div className="pt-2 border-t border-[var(--border-color)] flex items-center gap-2">
          <input
            type="text"
            value={aiTuningNote}
            onChange={(e) => setAiTuningNote(e.target.value)}
            placeholder="Kurang pas? Tulis keluhan (misal: 'masih agak ketahan di akhir kalimat') lalu minta AI tuning..."
            className="flex-1 px-2.5 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] focus:outline-none"
          />
          <button
            type="button"
            onClick={handleAskAiToTune}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border-strong)] shrink-0 cursor-pointer transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Minta LLM Tuning
          </button>
        </div>
      </div>
    </div>
  );
}


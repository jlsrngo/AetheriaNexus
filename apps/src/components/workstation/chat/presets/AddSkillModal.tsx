import { useState } from "react";
import { Sparkles, ArrowRight, Loader2, FolderOpen, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent } from "../../../ui/dialog";
import { API_BASE, apiFetch } from "../../../../lib/api";
import { cn } from "../../../../lib/utils";
import { toast } from "sonner";

interface AddSkillModalProps {
  open: boolean;
  onClose: () => void;
  onSkillRegistered: (command: string) => void;
}

export function AddSkillModal({ open, onClose, onSkillRegistered }: AddSkillModalProps) {
  const [name, setName] = useState("");
  const [filePath, setFilePath] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const cleanSlug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const handleRegister = async () => {
    if (!cleanSlug) {
      toast.error("Nama skill wajib diisi");
      return;
    }
    if (!filePath.trim()) {
      toast.error("Path file instruksi/brief wajib diisi");
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/skills/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cleanSlug,
          file_path: filePath.trim(),
          description: description.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Skill /${cleanSlug} berhasil didaftarkan ke .aetheria/skills/!`);
        onSkillRegistered(`/${cleanSlug}`);
        onClose();
        setName("");
        setFilePath("");
        setDescription("");
      } else {
        toast.error(data.error || "Gagal mendaftarkan skill");
      }
    } catch (err: any) {
      toast.error(`Error: ${err?.message || "Koneksi ke engine gagal"}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent onClose={onClose} className="max-w-xl transition-all duration-150">
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="space-y-1 pr-6">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--bg-panel)] border border-[var(--border-color)] text-[10px] font-mono text-[var(--text-secondary)]">
              <Sparkles size={11} className="text-amber-400" />
              <span>/add skill</span>
              <span>•</span>
              <span>Isolated Skill Manager</span>
            </div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              Tambah Skill Baru ke .aetheria
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Daftarkan file instruksi/brief markdown (.md) ke direktori terisolasi <code className="text-emerald-400">.aetheria/skills/</code>. Skill otomatis terdaftar di menu slash command (/).
            </p>
          </div>

          {/* Form */}
          <div className="space-y-3.5 pt-1">
            {/* Nama Skill */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text-primary)] flex items-center justify-between">
                <span>Nama Skill</span>
                {cleanSlug && (
                  <span className="font-mono text-[10px] text-emerald-400">/{cleanSlug}</span>
                )}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="contoh: editorial-kinetic, cyber-neon, retro-terminal..."
                className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--bg-panel)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
              />
            </div>

            {/* Path File Brief */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text-primary)]">
                Path File Brief Markdown (.md)
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={filePath}
                  onChange={(e) => setFilePath(e.target.value)}
                  placeholder="e.g. instruksi_remotion_agent_kinetic_motion_graphics_v2.md"
                  className="w-full pl-3 pr-8 py-2 text-xs rounded-lg bg-[var(--bg-panel)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors font-mono"
                />
                <FolderOpen size={14} className="absolute right-3 text-[var(--text-muted)] pointer-events-none" />
              </div>
            </div>

            {/* Deskripsi */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text-primary)]">
                Deskripsi Singkat (Opsional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Deskripsi singkat tampilan dan animasi skill"
                className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--bg-panel)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-color)]">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleRegister}
              disabled={isLoading || !cleanSlug || !filePath}
              className={cn(
                "inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg text-white transition-all shadow-sm",
                isLoading || !cleanSlug || !filePath
                  ? "bg-emerald-600/50 cursor-not-allowed text-white/60"
                  : "bg-emerald-600 hover:bg-emerald-500 cursor-pointer active:scale-95"
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Mendaftarkan...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={13} />
                  <span>Daftarkan ke .aetheria</span>
                  <ArrowRight size={13} />
                </>
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

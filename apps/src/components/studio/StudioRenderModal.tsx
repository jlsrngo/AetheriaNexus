import React, { useState, useEffect } from "react";
import {
  Download,
  X,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  Film,
  Zap,
  Cpu,
} from "lucide-react";
import { Dialog, DialogContent } from "../ui";
import { NexusVideoProps } from "../../remotion/types";
import { renderNexusMedia, getNexusRenderProgress, RenderJob } from "../../lib/nexusStudioBridge";
import { toast } from "sonner";

interface StudioRenderModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoProps: NexusVideoProps;
  ratio: "9:16" | "16:9" | "1:1";
  fps: number;
  duration: number;
}

export const StudioRenderModal: React.FC<StudioRenderModalProps> = ({
  isOpen,
  onClose,
  videoProps,
  ratio,
  fps,
  duration,
}) => {
  const [outputName, setOutputName] = useState(`nexus-${Date.now()}.mp4`);
  const [qualityPreset, setQualityPreset] = useState<"crf-18" | "crf-23">("crf-18");
  const [isRendering, setIsRendering] = useState(false);
  const [renderJob, setRenderJob] = useState<RenderJob | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [outputPath, setOutputPath] = useState<string | null>(null);

  const totalFrames = duration * fps;

  useEffect(() => {
    if (isOpen) {
      setOutputName(`nexus-${Date.now()}.mp4`);
      setIsRendering(false);
      setIsDone(false);
      setProgressPercent(0);
      setErrorMessage(null);
      setOutputPath(null);
      setRenderJob(null);
    }
  }, [isOpen]);

  const handleStartRender = async () => {
    setIsRendering(true);
    setIsDone(false);
    setProgressPercent(5);
    setErrorMessage(null);

    toast.info("Starting Nexus Local Render Engine...", {
      description: "Bundling composition & rendering MP4 via GPU hardware acceleration...",
    });

    try {
      const res = await renderNexusMedia({
        compositionId: "NexusEditorialVideo",
        props: videoProps,
        outputName: outputName.endsWith(".mp4") ? outputName : `${outputName}.mp4`,
        ratio,
      });

      if (!res.success) {
        throw new Error(res.error || "Render execution failed");
      }

      if (res.renderId) {
        // Poll progress if renderId returned
        const rid = res.renderId;
        const interval = setInterval(async () => {
          const job = await getNexusRenderProgress(rid);
          if (job) {
            setRenderJob(job);
            setProgressPercent(job.percent);
            window.dispatchEvent(new CustomEvent("nexus-render-job", { detail: { job } }));
            if (job.status === "done") {
              clearInterval(interval);
              setIsRendering(false);
              setIsDone(true);
              setProgressPercent(100);
              setOutputPath(job.outputPath || res.outputPath || "output/");
              toast.success("MP4 Video Rendered Successfully!");
            } else if (job.status === "error") {
              clearInterval(interval);
              setIsRendering(false);
              setErrorMessage(job.error || "Render worker failed");
              toast.error("Render Failed", { description: job.error });
            }
          }
        }, 800);
      } else {
        // Instant synchronous render completion
        setIsRendering(false);
        setIsDone(true);
        setProgressPercent(100);
        setOutputPath(res.outputPath || "output/");
        toast.success("MP4 Video Rendered Successfully!");
      }
    } catch (err: any) {
      console.error("Render error:", err);
      setIsRendering(false);
      setErrorMessage(err?.message || String(err));
      toast.error("Render Failed", { description: err?.message || String(err) });
    }
  };

  const handleOpenFolder = () => {
    if (outputPath) {
      (window as any).arunakiDesktop?.openPath?.(outputPath)?.catch?.(() => { });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isRendering && onClose()}>
      <DialogContent hideCloseButton className="max-w-[540px] p-0 rounded-none border border-neutral-700 bg-neutral-950 font-mono shadow-2xl">
        {/* Header */}
        <div className="h-10 bg-neutral-900 border-b border-neutral-800 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider">
            <Film className="w-4 h-4 text-emerald-400" />
            <span>NEXUS VIDEO EXPORT ENGINE (GPU)</span>
          </div>
          {!isRendering && (
            <button
              type="button"
              onClick={onClose}
              className="text-neutral-500 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Metadata Grid */}
          <div className="grid grid-cols-4 gap-2 p-3 bg-neutral-900/60 border border-neutral-800">
            <div>
              <div className="text-[9px] text-neutral-500 uppercase">RESOLUTION</div>
              <div className="font-bold text-white mt-0.5">
                {ratio === "9:16" ? "1080×1920" : ratio === "1:1" ? "1080×1080" : "1920×1080"}
              </div>
            </div>
            <div>
              <div className="text-[9px] text-neutral-500 uppercase">ASPECT RATIO</div>
              <div className="font-bold text-emerald-400 mt-0.5">{ratio}</div>
            </div>
            <div>
              <div className="text-[9px] text-neutral-500 uppercase">FPS / FRAMES</div>
              <div className="font-bold text-white mt-0.5">{fps} / {totalFrames}</div>
            </div>
            <div>
              <div className="text-[9px] text-neutral-500 uppercase">CLOUD COST</div>
              <div className="font-bold text-emerald-400 mt-0.5">Rp 0 ($0.00)</div>
            </div>
          </div>

          {/* Form Settings */}
          {!isRendering && !isDone && (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider block mb-1">
                  OUTPUT FILENAME
                </label>
                <div className="flex items-center bg-neutral-900 border border-neutral-800 px-2.5 py-1.5">
                  <input
                    type="text"
                    value={outputName}
                    onChange={(e) => setOutputName(e.target.value)}
                    className="w-full bg-transparent text-white font-mono text-xs focus:outline-none"
                  />
                  <span className="text-neutral-500 text-[10px] shrink-0 font-bold">.mp4</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider block mb-1">
                  QUALITY PRESET (CODEC: H.264 / AAC)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setQualityPreset("crf-18")}
                    className={`p-2.5 text-left border rounded-none cursor-pointer ${qualityPreset === "crf-18"
                        ? "bg-neutral-900 border-white text-white"
                        : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white"
                      }`}
                  >
                    <div className="font-bold text-xs">CRF 18 (High Quality)</div>
                    <div className="text-[9px] text-neutral-500 mt-0.5">Crisp social media export</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setQualityPreset("crf-23")}
                    className={`p-2.5 text-left border rounded-none cursor-pointer ${qualityPreset === "crf-23"
                        ? "bg-neutral-900 border-white text-white"
                        : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white"
                      }`}
                  >
                    <div className="font-bold text-xs">CRF 23 (Compact)</div>
                    <div className="text-[9px] text-neutral-500 mt-0.5">Faster render, smaller size</div>
                  </button>
                </div>
              </div>

              {/* Hardware Acceleration Info */}
              <div className="p-2.5 bg-neutral-900/40 border border-neutral-800/80 flex items-center gap-2.5 text-neutral-400 text-[11px]">
                <Cpu className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>
                  Uses local GPU encoder (NVENC / AMF / Intel QSV) for ultra-fast local rendering with zero cloud API costs.
                </span>
              </div>
            </div>
          )}

          {/* Render in Progress */}
          {isRendering && (
            <div className="py-4 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400 animate-pulse" />
                  RENDERING MP4 VIDEO...
                </span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  {progressPercent}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-3 bg-neutral-900 border border-neutral-800 rounded-none overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-neutral-500 font-mono">
                <span>
                  Frames: {renderJob?.renderedFrames || Math.round((progressPercent / 100) * totalFrames)} / {totalFrames}
                </span>
                <span>Hardware: Local GPU Accelerated</span>
              </div>
            </div>
          )}

          {/* Render Done State */}
          {isDone && (
            <div className="py-4 space-y-4 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <div>
                <div className="font-bold text-white text-sm uppercase tracking-wider">
                  VIDEO EXPORT COMPLETED!
                </div>
                <p className="text-neutral-400 text-[11px] mt-1 font-mono break-all px-2">
                  {outputPath || "Export saved to output/ folder."}
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleOpenFolder}
                  className="py-2 px-4 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white font-mono text-xs flex items-center gap-1.5 rounded-none"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  OPEN FOLDER
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2 px-4 bg-white hover:bg-neutral-200 text-black font-extrabold font-mono text-xs rounded-none"
                >
                  DONE
                </button>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-rose-950/40 border border-rose-800 text-rose-300 text-[11px] flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="break-all">{errorMessage}</div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {!isRendering && !isDone && (
          <div className="p-4 bg-neutral-900 border-t border-neutral-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="py-1.5 px-4 bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-white font-mono text-xs rounded-none"
            >
              CANCEL
            </button>
            <button
              type="button"
              onClick={handleStartRender}
              className="py-1.5 px-5 bg-white hover:bg-neutral-200 text-black font-extrabold font-mono text-xs border border-white flex items-center gap-2 rounded-none shadow-md active:translate-y-0.5"
            >
              <Download className="w-3.5 h-3.5" />
              START EXPORT
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};


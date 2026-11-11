import React from "react";
import { RotateCcw, ShieldAlert } from "lucide-react";

export interface WorkspaceFilmErrorBannerProps {
  error: string | null;
  onReload: () => void;
}

export const WorkspaceFilmErrorBanner: React.FC<WorkspaceFilmErrorBannerProps> = ({
  error,
  onReload,
}) => {
  if (!error) return null;
  return (
    <div className="absolute inset-x-8 top-10 p-4 rounded-xl bg-black/85 border border-amber-500/30 backdrop-blur-md shadow-2xl flex flex-col items-center justify-center text-center z-30 pointer-events-auto">
      <div className="flex items-center gap-2 text-amber-400 font-medium text-xs mb-1">
        <ShieldAlert className="w-4 h-4 shrink-0" />
        <span>Video Script Warning (Sandbox Workspace)</span>
      </div>
      <p className="text-[11px] font-mono text-rose-300/90 max-w-lg overflow-x-auto whitespace-pre-wrap bg-black/60 p-2 rounded border border-white/5 my-1.5">
        {error}
      </p>
      <p className="text-[10px] text-zinc-400 max-w-md">
        The main application remains unaffected. Ask the AI assistant in Chat to fix this script.
      </p>
      <button
        type="button"
        onClick={onReload}
        className="mt-2 px-3 py-1 text-[11px] font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-md border border-amber-500/30 transition-colors flex items-center gap-1.5 cursor-pointer"
      >
        <RotateCcw className="w-3 h-3" />
        Reload Preview
      </button>
    </div>
  );
};


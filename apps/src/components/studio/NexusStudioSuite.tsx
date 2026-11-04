import React, { useState, useEffect } from "react";
import { RefreshCw, ExternalLink } from "lucide-react";

interface NexusStudioSuiteProps {
  serverUrl?: string;
}

export const NexusStudioSuite: React.FC<NexusStudioSuiteProps> = ({
  serverUrl = "http://localhost:3333",
}) => {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Check if studio server on port 3333 is healthy
  const checkStatus = async () => {
    try {
      await fetch(serverUrl, { method: "HEAD", mode: "no-cors" });
      setIsOnline(true);
    } catch {
      setIsOnline(false);
      // Ping backend engine to ensure studio daemon is launched
      try {
        await fetch("http://127.0.0.1:20288/api/ensure-studio-server", { method: "POST" });
      } catch {}
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [serverUrl]);

  const handleOpenBrowser = () => {
    window.open(serverUrl, "_blank", "noopener,noreferrer");
  };

  const handleReload = () => {
    setReloadKey((prev) => prev + 1);
    checkStatus();
  };

  return (
    <div className="w-full h-full flex flex-col bg-neutral-950 text-neutral-100 font-mono select-none overflow-hidden relative">
      {/* Fallback if studio server is starting */}
      {isOnline === false && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-neutral-950/95 space-y-3">
          <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent animate-spin rounded-none" />
          <div className="text-sm font-bold text-white uppercase tracking-wider">
            Starting Nexus Studio Engine (Port 3333)...
          </div>
          <p className="text-xs text-neutral-400 max-w-md">
            Memuat seluruh antarmuka 1.152 file Remotion Studio ke dalam kanvas.
          </p>
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={handleReload}
              className="py-1 px-3 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white font-mono text-xs uppercase rounded-none cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
            <button
              type="button"
              onClick={handleOpenBrowser}
              className="py-1 px-3 bg-white hover:bg-neutral-200 text-black font-bold font-mono text-xs uppercase rounded-none cursor-pointer flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in Browser</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Authentic Remotion Studio Suite Frame */}
      <iframe
        key={reloadKey}
        src={serverUrl}
        title="Nexus Studio Engine"
        className="w-full h-full border-none bg-neutral-950 flex-1"
      />
    </div>
  );
};

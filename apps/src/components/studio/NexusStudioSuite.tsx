import React, { useState, useEffect } from "react";
import { Loader2, RefreshCw } from "lucide-react";

export const NexusStudioSuite: React.FC = () => {
  const [isServerReady, setIsServerReady] = useState<boolean>(true);
  const [iframeKey, setIframeKey] = useState<number>(0);

  // Health probe for Remotion Studio on port 3333
  useEffect(() => {
    let mounted = true;
    const probe = async () => {
      try {
        await fetch("http://127.0.0.1:3333", { method: "HEAD", mode: "no-cors" });
        if (mounted) setIsServerReady(true);
      } catch {
        if (mounted) setIsServerReady(false);
      }
    };

    probe();
    const interval = setInterval(probe, 2500);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleReload = () => {
    setIframeKey((prev) => prev + 1);
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#111319] overflow-hidden select-none relative">
      {!isServerReady ? (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-neutral-400 font-mono text-xs space-y-3">
          <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
          <p className="text-white font-bold">Connecting to Remotion Studio (:3333)...</p>
          <button
            type="button"
            onClick={handleReload}
            className="px-3 py-1 bg-neutral-900 border border-neutral-700 hover:border-orange-500 text-white flex items-center gap-1.5 cursor-pointer rounded-none text-[11px]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reload</span>
          </button>
        </div>
      ) : (
        <iframe
          key={iframeKey}
          src="http://127.0.0.1:3333"
          className="w-full h-full border-none bg-[#111319]"
          title="Remotion Studio"
          allow="clipboard-read; clipboard-write; autoplay; fullscreen"
        />
      )}
    </div>
  );
};

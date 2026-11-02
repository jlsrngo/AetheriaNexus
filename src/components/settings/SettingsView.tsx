import React, { useState, useEffect } from "react";
import { Panel } from "../ui/Panel";
import { Button } from "../ui/Button";

interface SettingsViewProps {
  geminiApiKey: string;
  outputDir: string;
  onSaveSetting: (key: string, value: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  geminiApiKey,
  outputDir,
  onSaveSetting,
}) => {
  const [keyInput, setKeyInput] = useState(geminiApiKey);
  const [dirInput, setDirInput] = useState(outputDir);

  useEffect(() => {
    setKeyInput(geminiApiKey);
  }, [geminiApiKey]);

  useEffect(() => {
    setDirInput(outputDir);
  }, [outputDir]);

  return (
    <div className="p-8 flex-1 overflow-y-auto blueprint-grid space-y-8">
      <div className="pb-4 border-b border-neutral-800">
        <div className="hud-label">// SYSTEM_CONFIGURATION</div>
        <h2 className="font-mono text-xl font-black text-white uppercase tracking-tight mt-1">
          PENGATURAN DESKTOP & API
        </h2>
        <p className="font-mono text-xs text-neutral-400 mt-1">
          Folder penyimpanan video lokal dan konfigurasi autentikasi SQLite.
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        <Panel className="p-6 space-y-4">
          <div className="hud-label">// LOCAL_STORAGE_DIRECTORY</div>
          <div className="space-y-2">
            <label className="font-mono text-xs text-neutral-300 block">
              Path Output File Video (.mp4):
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={dirInput}
                onChange={(e) => setDirInput(e.target.value)}
                className="flex-1 bg-neutral-900 border border-neutral-700 px-3 py-2 text-xs font-mono text-white rounded-none focus:outline-none focus:border-white"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onSaveSetting("output_directory", dirInput)}
              >
                SIMPAN PATH
              </Button>
            </div>
          </div>
        </Panel>

        <Panel className="p-6 space-y-4">
          <div className="hud-label">// AI_GENERATION_CREDENTIALS</div>
          <div className="space-y-2">
            <label className="font-mono text-xs text-neutral-300 block">
              Google Gemini API Key (Untuk AI Naskah & Hook):
            </label>
            <input
              type="password"
              placeholder="AIzaSy..."
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 px-3 py-2 text-xs font-mono text-white rounded-none focus:outline-none focus:border-white"
            />
            <p className="font-mono text-[10px] text-neutral-500">
              Disimpan secara lokal di SQLite `arunakinexus.db`. Jika dikosongkan, generator beralih ke template offline.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onSaveSetting("gemini_api_key", keyInput)}
          >
            SIMPAN API KEY
          </Button>
        </Panel>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef, useCallback } from "react";
import { PlayerRef } from "@remotion/player";
import { NexusActivityBar, ActivityTab } from "./NexusActivityBar";
import { NexusAssetsPropsExplorer } from "./NexusAssetsPropsExplorer";
import { NexusMainStage } from "./NexusMainStage";
import { NexusTimeline } from "./NexusTimeline";
import { NexusStudioStatusBar } from "./NexusStudioStatusBar";
import { StudioRenderModal } from "./StudioRenderModal";
import { NexusVideoProps, defaultNexusVideoProps } from "../../remotion/types";
import { fetchNexusStaticFiles, NexusStaticFile } from "../../lib/nexusStudioBridge";

export const NexusStudioSuite: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActivityTab>("explorer");
  const [videoProps, setVideoProps] = useState<NexusVideoProps>(defaultNexusVideoProps);
  const [staticFiles, setStaticFiles] = useState<NexusStaticFile[]>([]);
  const [isRenderModalOpen, setIsRenderModalOpen] = useState(false);
  const playerRef = useRef<PlayerRef>(null);

  const fps = 30;
  const durationInSeconds = 5;

  // Load static files from local Rust asset vault
  const loadAssets = useCallback(async () => {
    const files = await fetchNexusStaticFiles();
    setStaticFiles(files);
  }, []);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const handleChangeProps = (incoming: Partial<NexusVideoProps>) => {
    setVideoProps((prev) => ({
      ...prev,
      ...incoming,
    }));
  };

  const handleSelectMedia = (file: NexusStaticFile) => {
    if (file.type === "audio") {
      handleChangeProps({ authorHandle: `@${file.name.replace(/\.[^/.]+$/, "")}` });
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-neutral-950 text-neutral-100 font-mono select-none overflow-hidden relative">
      {/* Main Studio Viewport (Activity Bar + Left Explorer + Main Stage & Timeline) */}
      <div className="flex-1 flex overflow-hidden">
        {/* 1. Far Left VSCode Activity Bar */}
        <NexusActivityBar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
        />

        {/* 2. Left Assets & Props Explorer */}
        <NexusAssetsPropsExplorer
          videoProps={videoProps}
          onChangeProps={handleChangeProps}
          staticFiles={staticFiles}
          onSelectMediaFile={handleSelectMedia}
          onRefreshFiles={loadAssets}
        />

        {/* 3. Center Section: Main Stage (Top) + Timeline with Export Button (Bottom) */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Upper Center: Main Stage Phone Mockup Viewport */}
          <NexusMainStage
            videoProps={videoProps}
            playerRef={playerRef}
            fps={fps}
            durationInSeconds={durationInSeconds}
          />

          {/* Lower Center: Timeline with Tracks & [⚡ EXPORT MP4] Button */}
          <NexusTimeline
            playerRef={playerRef}
            durationInSeconds={durationInSeconds}
            fps={fps}
            hookText={videoProps.hookText}
            onOpenExportModal={() => setIsRenderModalOpen(true)}
          />
        </div>
      </div>

      {/* 4. Bottom Technical HUD Status Bar */}
      <NexusStudioStatusBar />

      {/* 5. Render Modal (Triggered by [⚡ EXPORT MP4] in Timeline) */}
      <StudioRenderModal
        isOpen={isRenderModalOpen}
        onClose={() => setIsRenderModalOpen(false)}
        videoProps={videoProps}
        ratio="9:16"
        fps={fps}
        duration={durationInSeconds}
      />
    </div>
  );
};

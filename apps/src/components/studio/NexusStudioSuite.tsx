import React, { useState, useEffect, useRef, useCallback } from "react";
import { PlayerRef } from "@remotion/player";
import { NexusActivityBar, ActivityTab } from "./NexusActivityBar";
import { NexusStudioSidebarPanel } from "./NexusStudioSidebarPanel";
import { NexusMainStage } from "./NexusMainStage";
import { NexusTimeline } from "./NexusTimeline";
import { NexusStudioStatusBar } from "./NexusStudioStatusBar";
import { StudioRenderModal } from "./StudioRenderModal";
import { NexusVideoProps, defaultNexusVideoProps } from "../../remotion/types";
import {
  fetchNexusStaticFiles,
  fetchNexusCompositions,
  CompositionPreset,
  NexusStaticFile,
  RenderJob,
} from "../../lib/nexusStudioBridge";

const DEFAULT_COMPOSITIONS: CompositionPreset[] = [
  {
    id: "NexusEditorialVideo",
    name: "NexusEditorialVideo",
    folder: "src/remotion",
    ratio: "9:16",
    duration: 5,
    fps: 30,
    width: 1080,
    height: 1920,
    props: defaultNexusVideoProps,
  },
  {
    id: "TikTokVideo",
    name: "TikTokVideo (Viral Hook)",
    folder: "src/remotion",
    ratio: "9:16",
    duration: 15,
    fps: 30,
    width: 1080,
    height: 1920,
    props: {
      ...defaultNexusVideoProps,
      hookText: "Stop Scrolling If You Want More Views",
      category: "GROWTH HACK",
      subCategory: "TIKTOK SECRETS",
    },
  },
  {
    id: "NexusSquareFeed",
    name: "NexusSquareFeed (1:1 Carousel)",
    folder: "src/remotion",
    ratio: "1:1",
    duration: 5,
    fps: 30,
    width: 1080,
    height: 1080,
    props: {
      ...defaultNexusVideoProps,
      hookText: "The 1-Minute Daily Habit for Founders",
      category: "ENTREPRENEURSHIP",
      subCategory: "FEED POST",
    },
  },
  {
    id: "NexusCorporate",
    name: "NexusCorporate (16:9 Landscape)",
    folder: "src/remotion",
    ratio: "16:9",
    duration: 10,
    fps: 30,
    width: 1920,
    height: 1080,
    props: {
      ...defaultNexusVideoProps,
      hookText: "Autonomous AI Automation Architecture",
      category: "ENGINEERING",
      subCategory: "CASE STUDY",
    },
  },
];

export const NexusStudioSuite: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActivityTab>("compositions");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [compositions, setCompositions] = useState<CompositionPreset[]>(DEFAULT_COMPOSITIONS);
  const [activeCompositionId, setActiveCompositionId] = useState<string>("NexusEditorialVideo");
  const [ratio, setRatio] = useState<"9:16" | "1:1" | "16:9">("9:16");
  const [videoProps, setVideoProps] = useState<NexusVideoProps>(defaultNexusVideoProps);
  const [staticFiles, setStaticFiles] = useState<NexusStaticFile[]>([]);
  const [renderJobs, setRenderJobs] = useState<RenderJob[]>([]);
  const [isRenderModalOpen, setIsRenderModalOpen] = useState(false);
  const playerRef = useRef<PlayerRef>(null);

  const fps = 30;
  const durationInSeconds = 5;

  // Load static files from local Rust asset vault
  const loadAssets = useCallback(async () => {
    const files = await fetchNexusStaticFiles();
    if (files && files.length > 0) {
      setStaticFiles(files);
    }
    const comps = await fetchNexusCompositions();
    if (comps && comps.length > 0) {
      setCompositions(comps);
    }
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

  const handleSelectComposition = (preset: CompositionPreset) => {
    setActiveCompositionId(preset.id);
    if (preset.ratio) {
      setRatio(preset.ratio);
    }
    if (preset.props) {
      handleChangeProps(preset.props);
    }
  };

  // Listen for menu bar events and global shortcuts
  useEffect(() => {
    const handleSelectCompEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.id) {
        setActiveCompositionId(detail.id);
        const matched = compositions.find((c) => c.id === detail.id);
        if (matched?.props) {
          setVideoProps((prev) => ({ ...prev, ...matched.props }));
        }
      }
      if (detail?.ratio) {
        setRatio(detail.ratio);
      }
    };

    const handleSetRatioEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.ratio) {
        setRatio(detail.ratio);
      }
    };

    const handleResetPropsEvent = () => {
      setVideoProps(defaultNexusVideoProps);
    };

    const handleTriggerRenderEvent = () => {
      setIsRenderModalOpen(true);
    };

    const handleOpenToolEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.tool === "vault") {
        setActiveTab("assets");
        setIsSidebarOpen(true);
      } else if (detail?.tool === "subtitles" || detail?.tool === "ai-script") {
        setActiveTab("props");
        setIsSidebarOpen(true);
      } else if (detail?.tool === "gpu") {
        setActiveTab("jobs");
        setIsSidebarOpen(true);
      }
    };

    const handleRenderJobEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.job) {
        setRenderJobs((prev) => [
          detail.job,
          ...prev.filter((j) => j.renderId !== detail.job.renderId),
        ]);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setIsSidebarOpen((prev) => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "e") {
        e.preventDefault();
        setIsRenderModalOpen(true);
      }
    };

    window.addEventListener("nexus-render-job", handleRenderJobEvent);
    window.addEventListener("nexus-select-composition", handleSelectCompEvent);
    window.addEventListener("nexus-set-ratio", handleSetRatioEvent);
    window.addEventListener("nexus-reset-props", handleResetPropsEvent);
    window.addEventListener("arunaki-trigger-render", handleTriggerRenderEvent);
    window.addEventListener("nexus-open-tool", handleOpenToolEvent);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("nexus-render-job", handleRenderJobEvent);
      window.removeEventListener("nexus-select-composition", handleSelectCompEvent);
      window.removeEventListener("nexus-set-ratio", handleSetRatioEvent);
      window.removeEventListener("nexus-reset-props", handleResetPropsEvent);
      window.removeEventListener("arunaki-trigger-render", handleTriggerRenderEvent);
      window.removeEventListener("nexus-open-tool", handleOpenToolEvent);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [compositions]);

  return (
    <div className="w-full h-full flex flex-col bg-neutral-950 text-neutral-100 font-mono select-none overflow-hidden relative">
      {/* Main Studio Viewport (Activity Rail + Left Explorer Panel + Main Stage & Timeline) */}
      <div className="flex-1 flex overflow-hidden">
        {/* 1. Far Left VSCode-style Activity Rail */}
        <NexusActivityBar
          activeTab={activeTab}
          isOpen={isSidebarOpen}
          onSelectTab={(tab) => {
            setActiveTab(tab);
            setIsSidebarOpen(true);
          }}
          onToggleCollapse={() => setIsSidebarOpen((prev) => !prev)}
          activeJobCount={renderJobs.filter((j) => j.status === "rendering").length}
        />

        {/* 2. Left Active Remotion Sidebar Panel (Compositions, Dynamic Props, Assets, Jobs) */}
        <NexusStudioSidebarPanel
          activeTab={activeTab}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          videoProps={videoProps}
          onChangeProps={handleChangeProps}
          compositions={compositions}
          activeCompositionId={activeCompositionId}
          onSelectComposition={handleSelectComposition}
          staticFiles={staticFiles}
          onSelectMediaFile={handleSelectMedia}
          onRefreshFiles={loadAssets}
          renderJobs={renderJobs}
        />

        {/* 3. Center Section: Main Stage Monitor (Top) + Timeline with Export Button (Bottom) */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Upper Center: Main Stage Professional Video Editing Monitor (No Phone Frame) */}
          <NexusMainStage
            videoProps={videoProps}
            playerRef={playerRef}
            fps={fps}
            durationInSeconds={durationInSeconds}
            ratio={ratio}
            onChangeRatio={setRatio}
          />

          {/* Lower Center: Timeline with Multi-Tracks & [⚡ EXPORT MP4] Button */}
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

      {/* 5. Render Modal (Triggered by [⚡ EXPORT MP4] in Timeline or Ctrl+E) */}
      <StudioRenderModal
        isOpen={isRenderModalOpen}
        onClose={() => setIsRenderModalOpen(false)}
        videoProps={videoProps}
        ratio={ratio}
        fps={fps}
        duration={durationInSeconds}
      />
    </div>
  );
};

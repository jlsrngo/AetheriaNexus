import React, { useState } from "react";
import { Player } from "@remotion/player";
import { TikTokVideo } from "../../remotion/TikTokVideo";
import { TikTokVideoProps } from "../../remotion/types";
import { Panel } from "../ui/Panel";
import { ChatPromptPanel } from "./ChatPromptPanel";
import { useI18n } from "../../lib/i18n";

import { GeneratedScript } from "../../services/aiService";

interface StudioViewProps {
  props: TikTokVideoProps;
  setProps: (props: TikTokVideoProps) => void;
  onAiGenerate: (topic?: string) => Promise<GeneratedScript | void> | any;
  onRender: () => void;
  isRendering: boolean;
  renderProgress: number;
}

export type CanvasRatio = "9:16" | "16:9" | "1:1";

export const StudioView: React.FC<StudioViewProps> = ({
  props,
  setProps,
  onAiGenerate,
  onRender,
  isRendering,
  renderProgress,
}) => {
  const { t } = useI18n();
  const [ratio, setRatio] = useState<CanvasRatio>("9:16");

  // Determine dimensions based on ratio
  const getDimensions = () => {
    switch (ratio) {
      case "16:9":
        return {
          width: 1920,
          height: 1080,
          containerClass: "w-full max-w-[620px] aspect-[16/9]",
          label: "16:9 // 1920x1080",
        };
      case "1:1":
        return {
          width: 1080,
          height: 1080,
          containerClass: "w-full max-w-[420px] aspect-square",
          label: "1:1 // 1080x1080",
        };
      case "9:16":
      default:
        return {
          width: 1080,
          height: 1920,
          containerClass: "w-full max-w-[360px] aspect-[9/16]",
          label: "9:16 // 1080x1920",
        };
    }
  };

  const dim = getDimensions();

  return (
    <div className="flex-1 flex h-full overflow-hidden blueprint-grid">
      {/* Left Canvas: Live Remotion Player */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative border-r border-neutral-800 overflow-y-auto">
        {/* HUD Top Bar with Ratio Switcher */}
        <div className={`w-full ${ratio === "16:9" ? "max-w-[620px]" : ratio === "1:1" ? "max-w-[420px]" : "max-w-[360px]"} flex flex-wrap items-center justify-between gap-2 mb-3 font-mono text-[11px] text-neutral-400`}>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-400"></span>
            <span className="text-white font-bold">{t("canvasViewport")}</span>
          </div>

          {/* Ratio Selector Buttons (Swiss Brutalism) */}
          <div className="flex items-center border border-neutral-800 bg-neutral-900">
            <button
              type="button"
              onClick={() => setRatio("9:16")}
              className={`px-2 py-0.5 text-[10px] font-mono font-bold transition-colors ${
                ratio === "9:16"
                  ? "bg-white text-black"
                  : "text-neutral-400 hover:text-white hover:bg-neutral-800"
              }`}
            >
              9:16
            </button>
            <button
              type="button"
              onClick={() => setRatio("16:9")}
              className={`px-2 py-0.5 text-[10px] font-mono font-bold border-l border-neutral-800 transition-colors ${
                ratio === "16:9"
                  ? "bg-white text-black"
                  : "text-neutral-400 hover:text-white hover:bg-neutral-800"
              }`}
            >
              16:9
            </button>
            <button
              type="button"
              onClick={() => setRatio("1:1")}
              className={`px-2 py-0.5 text-[10px] font-mono font-bold border-l border-neutral-800 transition-colors ${
                ratio === "1:1"
                  ? "bg-white text-black"
                  : "text-neutral-400 hover:text-white hover:bg-neutral-800"
              }`}
            >
              1:1
            </button>
          </div>
        </div>

        {/* Video Player Frame with Corner Crosses */}
        <Panel
          className={`${dim.containerClass} bg-black border-2 border-neutral-700 shadow-2xl flex items-center justify-center overflow-hidden transition-all duration-300`}
          cornerColor="text-white"
        >
          <Player
            component={TikTokVideo}
            inputProps={props}
            durationInFrames={150}
            fps={30}
            compositionWidth={dim.width}
            compositionHeight={dim.height}
            style={{
              width: "100%",
              height: "100%",
            }}
            controls
            loop
            autoPlay
          />
        </Panel>

        {/* Subtle Telemetry Footer */}
        <div className="mt-3 font-mono text-[10px] text-neutral-500 tracking-wider">
          // RESOLUTION: {dim.label} // ENGINE: REMOTION_4_REACT
        </div>
      </div>

      {/* Right Conversational Director: Chat Prompt Panel */}
      <ChatPromptPanel
        props={props}
        setProps={setProps}
        onAiGenerateWithTopic={async (topic) => {
          return await onAiGenerate(topic);
        }}
        onRender={onRender}
        isRendering={isRendering}
        renderProgress={renderProgress}
      />
    </div>
  );
};

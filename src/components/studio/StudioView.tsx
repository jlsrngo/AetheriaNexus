import React from "react";
import { Player } from "@remotion/player";
import { TikTokVideo } from "../../remotion/TikTokVideo";
import { TikTokVideoProps } from "../../remotion/types";
import { Panel } from "../ui/Panel";
import { Badge } from "../ui/Badge";
import { ChatPromptPanel } from "./ChatPromptPanel";

interface StudioViewProps {
  props: TikTokVideoProps;
  setProps: (props: TikTokVideoProps) => void;
  onAiGenerate: (topic?: string) => Promise<void> | void;
  onRender: () => void;
  isRendering: boolean;
  renderProgress: number;
}

export const StudioView: React.FC<StudioViewProps> = ({
  props,
  setProps,
  onAiGenerate,
  onRender,
  isRendering,
  renderProgress,
}) => {
  return (
    <div className="flex-1 flex h-full overflow-hidden blueprint-grid">
      {/* Left Canvas: Live Remotion Player */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 relative border-r border-neutral-800">
        {/* HUD Top Bar */}
        <div className="w-full max-w-[360px] flex items-center justify-between mb-3 font-mono text-[11px] text-neutral-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-400"></span>
            <span className="text-white font-bold">CANVAS_VIEWPORT</span>
          </div>
          <Badge variant="neutral">9:16 // 1080x1920</Badge>
        </div>

        {/* Video Player Frame with Corner Crosses */}
        <Panel
          className="w-full max-w-[360px] aspect-[9/16] bg-black border-2 border-neutral-700 shadow-2xl flex items-center justify-center overflow-hidden"
          cornerColor="text-white"
        >
          <Player
            component={TikTokVideo}
            inputProps={props}
            durationInFrames={150}
            fps={30}
            compositionWidth={1080}
            compositionHeight={1920}
            style={{
              width: "100%",
              height: "100%",
            }}
            controls
            loop
            autoPlay
          />
        </Panel>

        {/* Theme Picker HUD */}
        <div className="flex items-center gap-3 mt-5 font-mono text-xs">
          <span className="hud-label">THEME_PALETTE:</span>
          {(["emerald", "violet", "rose", "amber", "cyan"] as const).map((color) => (
            <button
              key={color}
              onClick={() => setProps({ ...props, themeColor: color })}
              className={`w-5 h-5 rounded-none border transition-all ${
                props.themeColor === color
                  ? "border-white scale-110 ring-1 ring-white"
                  : "border-neutral-700 opacity-60 hover:opacity-100"
              }`}
              style={{
                background:
                  color === "emerald"
                    ? "#10b981"
                    : color === "violet"
                    ? "#a855f7"
                    : color === "rose"
                    ? "#f43f5e"
                    : color === "amber"
                    ? "#f59e0b"
                    : "#06b6d4",
              }}
            />
          ))}
        </div>
      </div>

      {/* Right Conversational Director: Chat Prompt Panel */}
      <ChatPromptPanel
        props={props}
        setProps={setProps}
        onAiGenerateWithTopic={async (topic) => {
          await onAiGenerate(topic);
        }}
        onRender={onRender}
        isRendering={isRendering}
        renderProgress={renderProgress}
      />
    </div>
  );
};

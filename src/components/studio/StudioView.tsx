import React from "react";
import { Player } from "@remotion/player";
import { TikTokVideo } from "../../remotion/TikTokVideo";
import { TikTokVideoProps } from "../../remotion/types";
import { Panel } from "../ui/Panel";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Sparkles, Download } from "lucide-react";

interface StudioViewProps {
  props: TikTokVideoProps;
  setProps: (props: TikTokVideoProps) => void;
  onAiGenerate: () => void;
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
                props.themeColor === color ? "border-white scale-110 ring-1 ring-white" : "border-neutral-700 opacity-60 hover:opacity-100"
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

      {/* Right Inspector: Props & Parameters Form */}
      <div className="w-[420px] bg-neutral-950/90 p-6 flex flex-col justify-between overflow-y-auto border-l border-neutral-800">
        <div className="space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div>
              <h2 className="font-mono font-bold text-xs uppercase text-white tracking-wider">
                // COMPOSITION_PROPS
              </h2>
              <span className="hud-label text-[9px]">PARAMETERS_INPUT</span>
            </div>
            <Button variant="secondary" size="sm" onClick={onAiGenerate}>
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>AI GENERATE</span>
            </Button>
          </div>

          {/* Form: Category */}
          <div className="space-y-1">
            <label className="hud-label block">01_CATEGORY_BADGE:</label>
            <input
              type="text"
              value={props.category}
              onChange={(e) => setProps({ ...props, category: e.target.value })}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-none px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-white"
            />
          </div>

          {/* Form: Hook Text */}
          <div className="space-y-1">
            <label className="hud-label block">02_HOOK_TITLE (3 SECONDS):</label>
            <textarea
              rows={3}
              value={props.hookText}
              onChange={(e) => setProps({ ...props, hookText: e.target.value })}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-none p-3 text-xs font-sans font-bold text-white focus:outline-none focus:border-white resize-none leading-relaxed"
            />
          </div>

          {/* Form: Body Text */}
          <div className="space-y-1">
            <label className="hud-label block">03_CONTENT_POINTS (1 LINE PER POINT):</label>
            <textarea
              rows={4}
              value={props.bodyText}
              onChange={(e) => setProps({ ...props, bodyText: e.target.value })}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-none p-3 text-xs font-mono text-neutral-200 focus:outline-none focus:border-white resize-none leading-relaxed"
            />
          </div>

          {/* Form: Author Handle */}
          <div className="space-y-1">
            <label className="hud-label block">04_WATERMARK_HANDLE:</label>
            <input
              type="text"
              value={props.authorHandle}
              onChange={(e) => setProps({ ...props, authorHandle: e.target.value })}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-none px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-white"
            />
          </div>
        </div>

        {/* Action Bottom Section */}
        <div className="pt-5 border-t border-neutral-800 space-y-3">
          {isRendering ? (
            <Panel className="p-4 bg-neutral-900 border border-neutral-700">
              <div className="flex items-center justify-between font-mono text-xs mb-2">
                <span className="text-white font-bold animate-pulse">// RENDERING_LOCAL_MP4...</span>
                <span className="text-white font-mono">{renderProgress}%</span>
              </div>
              <div className="w-full bg-neutral-950 h-2 border border-neutral-800">
                <div
                  className="bg-white h-full transition-all duration-200"
                  style={{ width: `${renderProgress}%` }}
                />
              </div>
            </Panel>
          ) : (
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={onRender}
            >
              <Download className="w-4 h-4" />
              <span>RENDER & SIMPAN KE STOK VIDEO</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from "react";
import {
  X,
  Save,
  Eye,
  EyeOff,
  Clock,
  Trash2,
  Sparkles,
  Type,
  Award,
  Sliders,
  Paintbrush,
  LayoutTemplate,
} from "lucide-react";
import { cn } from "../../lib/utils";
import type { VideoLayerSpec } from "../../remotion/types";
import { resolveColorToHex } from "../../remotion/types";
import { useStudioStore } from "../../hooks/useStudioStore";
import { ColorPickerField } from "./clip-modal/ColorPickerField";
import { getFieldInfo } from "./clip-modal/clipModalTypes";

export interface ClipEditModalProps {
  isOpen: boolean;
  layer: VideoLayerSpec | null;
  durationInFrames: number;
  fps: number;
  onClose: () => void;
  onSaveContent: (layer: VideoLayerSpec, newContent: string) => void;
  onSaveTiming: (layer: VideoLayerSpec, from: number, duration: number) => void;
  onSaveColor?: (layer: VideoLayerSpec, newColor: string) => void;
  onToggleVisibility?: (layer: VideoLayerSpec) => void;
  onDeleteCustom?: (layerId: string) => void;
}

export const ClipEditModal: React.FC<ClipEditModalProps> = ({
  isOpen,
  layer,
  durationInFrames,
  fps,
  onClose,
  onSaveContent,
  onSaveTiming,
  onSaveColor,
  onToggleVisibility,
  onDeleteCustom,
}) => {
  const { activeComposition, actions } = useStudioStore();
  const [contentDraft, setContentDraft] = useState("");
  const [fromDraft, setFromDraft] = useState(0);
  const [durationDraft, setDurationDraft] = useState(30);

  // Color Pickers:
  // Accent / Border color
  const [colorDraft, setColorDraft] = useState("#F97316");
  // Text Font color
  const [textColorDraft, setTextColorDraft] = useState("#FFFFFF");
  // Card Background Style & Color
  const [cardBgDraft, setCardBgDraft] = useState("glass");
  const [customCardBgHex, setCustomCardBgHex] = useState("#0A0A0C");

  // Video Background Style (for bg-base)
  const [bgStyleDraft, setBgStyleDraft] = useState<"radial" | "linear" | "vignette" | "solid" | "cyberpunk">("radial");

  // Visual effect parameters
  const [orbSizeDraft, setOrbSizeDraft] = useState<number>(600);
  const [orbBlurDraft, setOrbBlurDraft] = useState<number>(140);
  const [gridSizeDraft, setGridSizeDraft] = useState<number>(40);
  const [gridOpacityDraft, setGridOpacityDraft] = useState<number>(0.22);
  const [iconCharDraft, setIconCharDraft] = useState<string>("⚡");

  useEffect(() => {
    if (layer) {
      setContentDraft(layer.content ?? layer.label);
      setFromDraft(layer.from);
      setDurationDraft(layer.durationInFrames);

      const hexAccent = resolveColorToHex(
        activeComposition.props.layerColors?.[layer.id] || layer.color || "#F97316"
      );
      setColorDraft(hexAccent);

      const hexText = resolveColorToHex(
        activeComposition.props.layerTextColors?.[layer.id] || "#FFFFFF"
      );
      setTextColorDraft(hexText);

      const savedBg = activeComposition.props.layerBgColors?.[layer.id] || "glass";
      if (savedBg.startsWith("#")) {
        setCardBgDraft("custom");
        setCustomCardBgHex(savedBg);
      } else {
        setCardBgDraft(savedBg);
      }

      setBgStyleDraft(activeComposition.props.bgStyle || "radial");
      setOrbSizeDraft(activeComposition.props.orbSize ?? 600);
      setOrbBlurDraft(activeComposition.props.orbBlur ?? 140);
      setGridSizeDraft(activeComposition.props.gridSize ?? 40);
      setGridOpacityDraft(activeComposition.props.gridOpacity ?? 0.22);
      setIconCharDraft(activeComposition.props.footerIconChar || "⚡");
    }
  }, [layer, activeComposition.props]);

  if (!isOpen || !layer) return null;

  const endFrame = fromDraft + durationDraft;
  const startSec = (fromDraft / fps).toFixed(2);
  const endSec = (endFrame / fps).toFixed(2);

  const isOrbLayer = layer.id === "bg-orb-pattern";
  const isGridLayer = layer.id === "bg-grid-pattern";
  const isBaseLayer = layer.id === "bg-base";
  const isVisualEffectLayer = isOrbLayer || isGridLayer || isBaseLayer;
  const isIconLayer = layer.id === "footer-icon";
  const isBulletLayer = layer.id.startsWith("text-bullet-") || layer.isCustom;
  const hasCardBg = isBulletLayer || layer.id === "hud-category" || layer.id === "footer-tag";

  const fieldInfo = getFieldInfo(layer.id);

  const handleSave = () => {
    const trimmed = contentDraft.trim();
    if (trimmed.length > 0) {
      onSaveContent(layer, trimmed);
    }
    const safeFrom = Math.max(0, Math.min(durationInFrames - 1, fromDraft));
    const safeDur = Math.max(1, Math.min(durationInFrames - safeFrom, durationDraft));
    onSaveTiming(layer, safeFrom, safeDur);
    if (onSaveColor && colorDraft) {
      onSaveColor(layer, colorDraft);
    }

    const finalCardBg = cardBgDraft === "custom" ? customCardBgHex : cardBgDraft;

    actions.updateActiveProps({
      layerColors: {
        ...(activeComposition.props.layerColors || {}),
        [layer.id]: colorDraft,
      },
      layerTextColors: {
        ...(activeComposition.props.layerTextColors || {}),
        [layer.id]: textColorDraft,
      },
      layerBgColors: {
        ...(activeComposition.props.layerBgColors || {}),
        [layer.id]: finalCardBg,
      },
      ...(isBaseLayer ? { bgStyle: bgStyleDraft } : {}),
      ...(isOrbLayer ? { orbSize: orbSizeDraft, orbBlur: orbBlurDraft } : {}),
      ...(isGridLayer ? { gridSize: gridSizeDraft, gridOpacity: gridOpacityDraft } : {}),
      ...(isIconLayer ? { footerIconChar: iconCharDraft.slice(0, 4) || "⚡" } : {}),
    });

    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[var(--bg-panel)] border border-[var(--border-strong)] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[var(--text-primary)]"
      >
        {/* Header */}
        <div className="h-11 px-4 border-b border-[var(--border-color)] bg-[var(--bg-card)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 transition-colors shadow-sm"
              style={{
                backgroundColor: `${colorDraft}30`,
                borderColor: colorDraft,
                borderWidth: "1px",
                color: colorDraft,
              }}
            >
              {layer.trackCode}
            </span>
            <span className="text-xs font-semibold truncate text-[var(--text-primary)]">
              {isVisualEffectLayer
                ? `Edit Visual Effect: ${layer.label}`
                : isIconLayer
                ? `Edit Icon Box: ${layer.label}`
                : `Edit Component: ${layer.label}`}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-4 space-y-3.5 text-xs overflow-y-auto max-h-[75vh]">
          {/* Section 1: Type-Specific Content or Visual Controls */}
          {isVisualEffectLayer ? (
            /* Visual Effect Layer Banner & Parameters */
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                    <span>Visual Effects & Video Background</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-200 font-mono">
                      GRAPHICS / BACKGROUND
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                    {isOrbLayer
                      ? "This layer is an ambient glow orb effect behind video text (graphic element, not text). Adjusting color and parameters below immediately updates the lighting visual in the video player."
                      : isGridLayer
                      ? "This layer is a blueprint grid pattern behind the video (graphic element, not text). Adjusting color and size below immediately updates the grid lines in the video."
                      : "This layer is the base video background. You can customize gradient styles and base colors below."}
                  </p>
                </div>
              </div>

              {/* Background Video Style Options (for bg-base) */}
              {isBaseLayer && (
                <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                      <LayoutTemplate className="w-3.5 h-3.5 text-amber-400" />
                      <span>Video Background Style</span>
                    </span>
                    <span className="text-[9px] font-mono text-amber-400 font-bold uppercase">
                      {bgStyleDraft}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    {[
                      { id: "radial", label: "Radial Glow" },
                      { id: "linear", label: "Linear Studio" },
                      { id: "vignette", label: "Deep Vignette" },
                      { id: "cyberpunk", label: "Cyberpunk Dual" },
                      { id: "solid", label: "Solid Studio" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setBgStyleDraft(opt.id as any)}
                        className={cn(
                          "h-7 px-2 rounded-lg border text-[10px] font-medium transition-colors cursor-pointer",
                          bgStyleDraft === opt.id
                            ? "bg-[#cf6613] border-[#e07b27] text-white font-semibold"
                            : "bg-[var(--bg-input)] border-[var(--border-color)] text-[var(--text-secondary)] hover:text-white"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Orb Specific Visual Parameters */}
              {isOrbLayer && (
                <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-2.5">
                  <span className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-amber-400" />
                    <span>Ambient Glow Orb Parameters</span>
                  </span>

                  <div className="space-y-2 pt-1">
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] mb-1">
                        <span>Orb Light Size (Scale)</span>
                        <span className="font-mono text-amber-400">{orbSizeDraft}px</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { val: 400, label: "400px (Small)" },
                          { val: 600, label: "600px (Default)" },
                          { val: 800, label: "800px (Large)" },
                        ].map((opt) => (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() => setOrbSizeDraft(opt.val)}
                            className={cn(
                              "h-6 px-2 rounded-md border text-[10px] font-mono transition-colors cursor-pointer",
                              orbSizeDraft === opt.val
                                ? "bg-[#cf6613] border-[#e07b27] text-white font-semibold"
                                : "bg-[var(--bg-input)] border-[var(--border-color)] text-[var(--text-secondary)] hover:text-white"
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] mb-1">
                        <span>Glow Softness (Blur)</span>
                        <span className="font-mono text-amber-400">{orbBlurDraft}px</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { val: 80, label: "80px (Crisp)" },
                          { val: 140, label: "140px (Default)" },
                          { val: 220, label: "220px (Ultra Soft)" },
                        ].map((opt) => (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() => setOrbBlurDraft(opt.val)}
                            className={cn(
                              "h-6 px-2 rounded-md border text-[10px] font-mono transition-colors cursor-pointer",
                              orbBlurDraft === opt.val
                                ? "bg-[#cf6613] border-[#e07b27] text-white font-semibold"
                                : "bg-[var(--bg-input)] border-[var(--border-color)] text-[var(--text-secondary)] hover:text-white"
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Grid Specific Visual Parameters */}
              {isGridLayer && (
                <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-2.5">
                  <span className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-amber-400" />
                    <span>Blueprint Grid Parameters</span>
                  </span>

                  <div className="space-y-2 pt-1">
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] mb-1">
                        <span>Grid Line Spacing</span>
                        <span className="font-mono text-amber-400">{gridSizeDraft}px</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { val: 20, label: "20px (Dense)" },
                          { val: 40, label: "40px (Default)" },
                          { val: 60, label: "60px (Wide)" },
                        ].map((opt) => (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() => setGridSizeDraft(opt.val)}
                            className={cn(
                              "h-6 px-2 rounded-md border text-[10px] font-mono transition-colors cursor-pointer",
                              gridSizeDraft === opt.val
                                ? "bg-[#cf6613] border-[#e07b27] text-white font-semibold"
                                : "bg-[var(--bg-input)] border-[var(--border-color)] text-[var(--text-secondary)] hover:text-white"
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] mb-1">
                        <span>Grid Line Opacity</span>
                        <span className="font-mono text-amber-400">
                          {Math.round(gridOpacityDraft * 100)}%
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { val: 0.1, label: "10% (Subtle)" },
                          { val: 0.22, label: "22% (Default)" },
                          { val: 0.45, label: "45% (Sharp)" },
                        ].map((opt) => (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() => setGridOpacityDraft(opt.val)}
                            className={cn(
                              "h-6 px-2 rounded-md border text-[10px] font-mono transition-colors cursor-pointer",
                              gridOpacityDraft === opt.val
                                ? "bg-[#cf6613] border-[#e07b27] text-white font-semibold"
                                : "bg-[var(--bg-input)] border-[var(--border-color)] text-[var(--text-secondary)] hover:text-white"
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Compact Timeline Track Label (Optional rename) */}
              <div className="space-y-1">
                <label className="text-[10px] text-[var(--text-muted)] block">
                  Timeline Track Label Name (Optional)
                </label>
                <input
                  type="text"
                  value={contentDraft}
                  onChange={(e) => setContentDraft(e.target.value)}
                  placeholder={fieldInfo.placeholder}
                  className="w-full px-2.5 h-7 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-xs text-[var(--text-secondary)] outline-none focus:border-amber-400 font-sans"
                />
              </div>
            </div>
          ) : isIconLayer ? (
            /* Icon Box Symbol & Character Editing */
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/25 flex items-start gap-2.5">
                <Award className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <div className="font-semibold text-orange-300">
                    Footer Avatar / Icon Box
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                    Choose the icon symbol or emoji displayed in the avatar box beside the author name.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-2">
                <label className="text-[11px] font-semibold text-[var(--text-secondary)] block">
                  Select Avatar Icon Symbol
                </label>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-[var(--bg-input)] border border-amber-400/50 flex items-center justify-center text-xl font-bold text-amber-400 shrink-0 shadow">
                    {iconCharDraft}
                  </div>
                  <input
                    type="text"
                    maxLength={3}
                    value={iconCharDraft}
                    onChange={(e) => setIconCharDraft(e.target.value)}
                    className="flex-1 px-3 h-10 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-sm font-bold text-[var(--text-primary)] outline-none focus:border-amber-400"
                    placeholder="⚡"
                  />
                </div>

                <div className="pt-1">
                  <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-semibold block mb-1">
                    Quick Icons
                  </span>
                  <div className="grid grid-cols-8 gap-1">
                    {["⚡", "🔥", "🚀", "✦", "★", "💎", "👑", "🎯"].map((sym) => (
                      <button
                        key={sym}
                        type="button"
                        onClick={() => setIconCharDraft(sym)}
                        className={cn(
                          "h-7 rounded-md border text-sm flex items-center justify-center cursor-pointer transition-colors",
                          iconCharDraft === sym
                            ? "bg-[#cf6613] border-[#e07b27] text-white"
                            : "bg-[var(--bg-input)] border-[var(--border-color)] hover:bg-[var(--bg-hover)]"
                        )}
                      >
                        {sym}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Text Content Layer (Hook headline, bullet points, category, subcategory, author, tag) */
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{fieldInfo.contentLabel}</span>
                </label>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                  LIVE VIDEO TEXT
                </span>
              </div>
              <textarea
                rows={3}
                autoFocus
                value={contentDraft}
                onChange={(e) => setContentDraft(e.target.value)}
                placeholder={fieldInfo.placeholder}
                className="w-full p-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] outline-none focus:border-amber-400 resize-none font-sans leading-relaxed shadow-inner"
              />
              <p className="text-[10px] text-[var(--text-muted)]">
                The text above is immediately displayed on the video canvas and rendered MP4.
              </p>
            </div>
          )}

          {/* Section 2: Clean Color Pickers (NO PRESET BUTTON GRID - CLEAN COLOR PICKER ONLY) */}
          <div className="space-y-3">
            {/* Color Picker 1: Text Font Color (for text layers) */}
            {!isVisualEffectLayer && !isIconLayer && (
              <ColorPickerField
                label="Text Color"
                desc={fieldInfo.textDesc}
                value={textColorDraft}
                onChange={setTextColorDraft}
              />
            )}

            {/* Color Picker 2: Accent / Border / Orb / Base Color */}
            <ColorPickerField
              label={
                isVisualEffectLayer
                  ? isBaseLayer
                    ? "Base Background Theme Color"
                    : isOrbLayer
                    ? "Ambient Glow Orb Color"
                    : "Blueprint Grid Line Color"
                  : isIconLayer
                  ? "Avatar Icon Box Color"
                  : "Accent & Border Color"
              }
              desc={fieldInfo.accentDesc}
              value={colorDraft}
              onChange={setColorDraft}
            />

            {/* Card Background Style & Color Selector (for Bullet Points & Badges) */}
            {hasCardBg && (
              <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                    <Paintbrush className="w-3.5 h-3.5 text-amber-400" />
                    <span>Card Background Style</span>
                  </span>
                  <span className="text-[9px] font-mono text-amber-400 uppercase font-bold">
                    {cardBgDraft}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: "glass", label: "Dark Glass" },
                    { id: "tint", label: "Accent Tint" },
                    { id: "solid", label: "Solid Black" },
                    { id: "transparent", label: "Transparent" },
                    { id: "custom", label: "Custom Color" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setCardBgDraft(opt.id)}
                      className={cn(
                        "h-7 px-2 rounded-lg border text-[10px] font-medium transition-colors cursor-pointer",
                        cardBgDraft === opt.id
                          ? "bg-[#cf6613] border-[#e07b27] text-white font-semibold"
                          : "bg-[var(--bg-input)] border-[var(--border-color)] text-[var(--text-secondary)] hover:text-white"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* If Custom Color is selected, show background color picker */}
                {cardBgDraft === "custom" && (
                  <div className="pt-1">
                    <ColorPickerField
                      label="Custom Card Background Color"
                      desc="Choose a custom background color for this component card."
                      value={customCardBgHex}
                      onChange={setCustomCardBgHex}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 3: Timing Section */}
          <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Timeline Timing & Position</span>
              </span>
              <span className="text-[10px] font-mono text-amber-400">
                {startSec}s – {endSec}s
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-[var(--text-muted)] block mb-1">
                  Start Frame
                </label>
                <input
                  type="number"
                  min={0}
                  max={durationInFrames - 1}
                  step={1}
                  value={fromDraft}
                  onChange={(e) =>
                    setFromDraft(
                      Math.max(0, Math.min(durationInFrames - 1, Number(e.target.value) || 0))
                    )
                  }
                  className="w-full px-2.5 h-8 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-xs font-mono text-[var(--text-primary)] outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-[10px] text-[var(--text-muted)] block mb-1">
                  Duration (Frames)
                </label>
                <input
                  type="number"
                  min={1}
                  max={durationInFrames}
                  step={1}
                  value={durationDraft}
                  onChange={(e) =>
                    setDurationDraft(
                      Math.max(1, Math.min(durationInFrames - fromDraft, Number(e.target.value) || 1))
                    )
                  }
                  className="w-full px-2.5 h-8 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-xs font-mono text-[var(--text-primary)] outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-[10px] text-[var(--text-muted)] block mb-1">
                  End Frame
                </label>
                <input
                  type="number"
                  disabled
                  value={endFrame}
                  className="w-full px-2.5 h-8 rounded-lg bg-[var(--bg-input)]/50 border border-[var(--border-color)] text-xs font-mono text-[var(--text-muted)] cursor-not-allowed opacity-75"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Visibility Toggle */}
          <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-sky-400" />
              <div>
                <div className="text-[11px] font-semibold text-[var(--text-primary)]">
                  Layer Visibility in Video
                </div>
                <div className="text-[10px] text-[var(--text-muted)]">
                  Toggle whether this layer is rendered in canvas & exported video
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (onToggleVisibility) onToggleVisibility(layer);
              }}
              className={cn(
                "h-7 px-3 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer",
                layer.visible
                  ? "bg-[#0284c7] border-[#38bdf8] text-white"
                  : "bg-[var(--bg-input)] border-[var(--border-color)] text-[var(--text-muted)]"
              )}
            >
              {layer.visible ? (
                <>
                  <Eye className="w-3 h-3" />
                  <span>Visible</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3 h-3" />
                  <span>Hidden</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[var(--border-color)] bg-[var(--bg-card)] flex items-center justify-between gap-2 shrink-0">
          <div>
            {layer.isCustom && onDeleteCustom && (
              <button
                type="button"
                onClick={() => {
                  onDeleteCustom(layer.id);
                  onClose();
                }}
                className="h-7 px-2.5 rounded-lg bg-[var(--bg-input)] hover:bg-rose-950/60 border border-[var(--border-color)] hover:border-rose-500 text-rose-400 text-xs flex items-center gap-1 transition-colors cursor-pointer"
                title="Delete this dynamic layer track"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-7 px-3 rounded-lg bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="h-7 px-3.5 rounded-lg bg-[#cf6613] hover:bg-[#b8580f] border border-[#e07b27] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

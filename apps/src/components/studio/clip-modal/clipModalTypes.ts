import type { VideoLayerSpec } from "../../../remotion/types";

export interface ClipFieldInfo {
  contentLabel: string;
  placeholder: string;
  textDesc: string;
  accentDesc: string;
}

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

export function getFieldInfo(id: string): ClipFieldInfo {
  switch (id) {
    case "text-hook":
      return {
        contentLabel: "Hook Headline Text",
        placeholder: "Enter main hook headline...",
        textDesc: "Modify the main video headline text.",
        accentDesc: "Change the gradient accent and headline text glow.",
      };
    case "hud-category":
      return {
        contentLabel: "Category Badge Text",
        placeholder: "e.g. PRODUCTIVITY",
        textDesc: "Change the category badge text in the top left corner.",
        accentDesc: "Change badge border and indicator light color.",
      };
    case "hud-subcategory":
      return {
        contentLabel: "Subcategory Title Text",
        placeholder: "e.g. EXECUTIVE HABITS",
        textDesc: "Change the subcategory text in the top right corner.",
        accentDesc: "Change subcategory text and border color.",
      };
    case "footer-author":
      return {
        contentLabel: "Author Handle / Name",
        placeholder: "e.g. @nexus.creative",
        textDesc: "Change author / creator handle in the video footer.",
        accentDesc: "Change author handle font color.",
      };
    case "footer-tag":
      return {
        contentLabel: "Editorial Tag Text",
        placeholder: "e.g. NEXUS // EDITORIAL SHORT",
        textDesc: "Change editorial badge text in the bottom right footer.",
        accentDesc: "Change border and accent color of the editorial badge.",
      };
    case "footer-icon":
      return {
        contentLabel: "Footer Avatar / Icon Symbol",
        placeholder: "e.g. ⚡",
        textDesc: "Avatar icon symbol in the video footer.",
        accentDesc: "Background and glow color for the avatar icon box.",
      };
    case "bg-base":
      return {
        contentLabel: "Background Layer Name",
        placeholder: "Background: Radial Gradient",
        textDesc: "Primary background for the entire video.",
        accentDesc: "Gradient theme and base canvas color.",
      };
    case "bg-orb-pattern":
      return {
        contentLabel: "Glow Orb Pattern Name",
        placeholder: "Pattern: Ambient Glow Orb",
        textDesc: "Floating ambient glow light effect.",
        accentDesc: "Color and glow intensity of the ambient orb.",
      };
    case "bg-grid-pattern":
      return {
        contentLabel: "Grid Pattern Name",
        placeholder: "Pattern: Blueprint Grid",
        textDesc: "Blueprint grid line background effect.",
        accentDesc: "Color of the background blueprint grid lines.",
      };
    default:
      return {
        contentLabel: "Bullet Point Content Text",
        placeholder: "Enter bullet point text...",
        textDesc: "Change bullet point text displayed on the video canvas.",
        accentDesc: "Change line accent symbol // and card border color.",
      };
  }
}

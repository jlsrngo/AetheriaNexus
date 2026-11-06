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
        textDesc: "Mengubah teks judul headline video.",
        accentDesc: "Mengubah gradasi aksen dan pantulan glow teks headline.",
      };
    case "hud-category":
      return {
        contentLabel: "Category Badge Text",
        placeholder: "e.g. PRODUCTIVITY",
        textDesc: "Mengubah teks pada badge kategori sudut kiri atas.",
        accentDesc: "Mengubah warna border dan lampu indikator badge.",
      };
    case "hud-subcategory":
      return {
        contentLabel: "Subcategory Title Text",
        placeholder: "e.g. EXECUTIVE HABITS",
        textDesc: "Mengubah teks subkategori sudut kanan atas.",
        accentDesc: "Mengubah warna font subkategori.",
      };
    case "footer-author":
      return {
        contentLabel: "Author Handle / Name",
        placeholder: "e.g. @nexus.creative",
        textDesc: "Mengubah nama author / kreator di footer video.",
        accentDesc: "Mengubah warna font nama author.",
      };
    case "footer-tag":
      return {
        contentLabel: "Editorial Tag Text",
        placeholder: "e.g. NEXUS // EDITORIAL SHORT",
        textDesc: "Mengubah teks badge editorial di footer kanan.",
        accentDesc: "Mengubah warna border dan aksen badge editorial.",
      };
    case "footer-icon":
      return {
        contentLabel: "Footer Avatar / Icon Symbol",
        placeholder: "e.g. ⚡",
        textDesc: "Simbol ikon avatar di footer video.",
        accentDesc: "Warna background dan glow kotak ikon avatar.",
      };
    case "bg-base":
      return {
        contentLabel: "Background Layer Name",
        placeholder: "Background: Radial Gradient",
        textDesc: "Latar belakang utama seluruh video.",
        accentDesc: "Warna tema gradien latar belakang video.",
      };
    case "bg-orb-pattern":
      return {
        contentLabel: "Glow Orb Pattern Name",
        placeholder: "Pattern: Ambient Glow Orb",
        textDesc: "Efek bola cahaya ambient mengambang.",
        accentDesc: "Warna pendaran cahaya bola ambient di video.",
      };
    case "bg-grid-pattern":
      return {
        contentLabel: "Grid Pattern Name",
        placeholder: "Pattern: Blueprint Grid",
        textDesc: "Efek garis grid blueprint latar belakang.",
        accentDesc: "Warna garis-garis grid blueprint di video.",
      };
    default:
      return {
        contentLabel: "Bullet Point Content Text",
        placeholder: "Enter bullet point text...",
        textDesc: "Mengubah teks poin bullet yang tampil di layar video.",
        accentDesc: "Mengubah warna simbol garis // dan border kartu di video.",
      };
  }
}

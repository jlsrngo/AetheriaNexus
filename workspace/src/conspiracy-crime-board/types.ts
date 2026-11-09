export interface PinItem {
  id: string;
  name: string;
  role: string;
  photoUrl?: string; // Optional: if empty, renders template placeholder slot
  dropFrame: number;
  pinFrame: number;
  x: number; // coordinates in 1080x1920
  y: number;
  width: number;
  height: number;
  rotation: number;
  pinOffset: { x: number; y: number }; // relative to card
  notes?: string;
  handwrittenMark?: string;
}

export interface ThreadConnection {
  from: number;
  to: number;
  startFrame: number;
}

export interface ConspiracySceneProps {
  cards?: PinItem[];
  title?: string;
  dateMarker?: string;
  subnote?: string;
  backgroundImage?: string;
}

export interface ConspiracyCrimeBoardProps {
  scene1Props?: ConspiracySceneProps;
  sceneType?: "pinboard" | "tahukah_kamu";
}

export const CONSPIRACY_FPS = 30;
export const CONSPIRACY_WIDTH = 1080;
export const CONSPIRACY_HEIGHT = 1920;

// Alan Turing Documentary — Scene Durations (duration + 0.6s buffer)
export const SCENE_1_DURATION_FRAMES = 151; // Hook "Tahukah Kamu?"
export const SCENE_2_DURATION_FRAMES = 257; // Peta Perang & U-Boat
export const SCENE_3_DURATION_FRAMES = 242; // Bletchley Park & Turing Portrait
export const SCENE_4_DURATION_FRAMES = 248; // Mesin Bombe vs Enigma
export const SCENE_5_DURATION_FRAMES = 266; // Pesan Terpecahkan & Nyawa Terselamatkan
export const SCENE_6_DURATION_FRAMES = 323; // Masa Depan Komputer & Turing Test
export const SCENE_7_DURATION_FRAMES = 265; // Tragedi Pengadilan 1952
export const SCENE_8_DURATION_FRAMES = 270; // Warisan Abadi & Royal Pardon 2013
export const TOTAL_CONSPIRACY_FRAMES = SCENE_1_DURATION_FRAMES + SCENE_2_DURATION_FRAMES + SCENE_3_DURATION_FRAMES + SCENE_4_DURATION_FRAMES + SCENE_5_DURATION_FRAMES + SCENE_6_DURATION_FRAMES + SCENE_7_DURATION_FRAMES + SCENE_8_DURATION_FRAMES;


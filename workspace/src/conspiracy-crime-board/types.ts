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
export const SCENE_1_DURATION_FRAMES = 180; // 6 detik di 30 fps
export const TOTAL_CONSPIRACY_FRAMES = 180; // Default untuk Scene 1 (bisa diperpanjang saat Scene 2+ ditambahkan)


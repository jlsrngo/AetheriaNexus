export type PresetStudioStep = "choose" | "audio" | "video";

export interface VoiceStyleConfig {
  label: string;
  mode: string;
  sampleFile: string;
  promptText: string;
  cfgValue: number;
  controlInstruction: string;
}

export interface VoicePresetItem {
  id: string;
  name: string;
  description: string;
  gender: string;
  lang: "id" | "en";
  engine: string;
  sampleFile: string;
  promptText: string;
  controlInstruction: string;
  defaultStyle: string;
  cfgValue: number;
  styles: Record<string, VoiceStyleConfig>;
  fallback?: {
    voice: string;
    rate: string;
    pitch: string;
  };
}

export interface PresetStudioModalProps {
  open: boolean;
  initialStep?: PresetStudioStep;
  onClose: () => void;
  onSendMessage: (
    prompt: string,
    files?: Array<{ name: string; uri: string; mime?: string }>
  ) => void;
}


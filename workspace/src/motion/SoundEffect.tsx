import { Sequence, Audio, staticFile } from "remotion";

export type SfxType =
  | "whoosh"
  | "pop"
  | "typewriter"
  | "impact"
  | "chime"
  | "riser";

export interface SfxPreset {
  file: string;
  defaultVolume: number;
  durationFrames: number;
}

export const SFX_PRESETS: Record<SfxType, SfxPreset> = {
  whoosh: {
    file: "sfx/sfx_whoosh.wav",
    defaultVolume: 0.22,
    durationFrames: 15,
  },
  pop: {
    file: "sfx/sfx_pop.wav",
    defaultVolume: 0.20,
    durationFrames: 8,
  },
  typewriter: {
    file: "sfx/sfx_typewriter.wav",
    defaultVolume: 0.12,
    durationFrames: 4,
  },
  impact: {
    file: "sfx/sfx_impact.wav",
    defaultVolume: 0.30,
    durationFrames: 25,
  },
  chime: {
    file: "sfx/sfx_chime.wav",
    defaultVolume: 0.22,
    durationFrames: 18,
  },
  riser: {
    file: "sfx/sfx_riser.wav",
    defaultVolume: 0.24,
    durationFrames: 30,
  },
};

export interface SoundEffectProps {
  type?: SfxType;
  src?: string;
  from?: number;
  durationInFrames?: number;
  volume?: number;
}

/**
 * Smart SoundEffect component for Remotion compositions.
 * Pre-configured with balanced levels and durations to keep the audio crisp and uncluttered.
 */
export function SoundEffect({
  type = "whoosh",
  src,
  from = 0,
  durationInFrames,
  volume,
}: SoundEffectProps) {
  const preset = SFX_PRESETS[type] || SFX_PRESETS.whoosh;
  const soundFile = src || preset.file;
  const dur = durationInFrames || preset.durationFrames;
  const vol = volume !== undefined ? volume : preset.defaultVolume;

  return (
    <Sequence from={from} durationInFrames={dur}>
      <Audio src={staticFile(soundFile)} volume={vol} />
    </Sequence>
  );
}

export interface SmartSfxCue {
  type: SfxType;
  frame: number;
  volume?: number;
}

export interface SmartSfxTrackProps {
  cues: SmartSfxCue[];
  /** Minimum frames between consecutive sound effects to prevent audio clutter (default: 5 frames ~ 160ms) */
  minIntervalFrames?: number;
}

/**
 * SmartSfxTrack component.
 * Filters and plays cues with a density guard so SFX never sound messy or chaotic.
 */
export function SmartSfxTrack({
  cues,
  minIntervalFrames = 5,
}: SmartSfxTrackProps) {
  // Sort cues chronologically
  const sorted = [...cues].sort((a, b) => a.frame - b.frame);
  const cleanCues: SmartSfxCue[] = [];
  let lastFrame = -999;

  for (const cue of sorted) {
    // If another sound was played too close, drop or defer to prevent auditory clutter
    if (cue.frame - lastFrame >= minIntervalFrames || cue.type === "impact") {
      cleanCues.push(cue);
      lastFrame = cue.frame;
    }
  }

  return (
    <>
      {cleanCues.map((cue, idx) => (
        <SoundEffect
          key={`${cue.type}-${cue.frame}-${idx}`}
          type={cue.type}
          from={cue.frame}
          volume={cue.volume}
        />
      ))}
    </>
  );
}

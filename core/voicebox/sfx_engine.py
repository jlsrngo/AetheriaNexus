"""
Smart SFX Engine for Aetheria Nexus.
Synthesizes and intelligently schedules context-aware sound effects (SFX)
without prompt bloat or auditory clutter.
"""

import json
import math
import struct
import wave
from pathlib import Path
from typing import Dict, List, Any, Optional

SAMPLE_RATE = 48000

# Sound generator DSP definitions (Pure Python wave synthesis - zero dependencies)
def generate_sine_blip(freq_start: float, freq_end: float, duration: float, decay_rate: float, volume: float = 0.5) -> List[float]:
    num_samples = int(duration * SAMPLE_RATE)
    samples = []
    phase = 0.0
    for i in range(num_samples):
        t = i / SAMPLE_RATE
        progress = i / max(1, num_samples - 1)
        freq = freq_start + (freq_end - freq_start) * progress
        phase += 2.0 * math.pi * freq / SAMPLE_RATE
        envelope = math.exp(-decay_rate * t) * volume
        sample = math.sin(phase) * envelope
        samples.append(sample)
    return samples

def generate_noise_sweep(duration: float, freq_start: float, freq_end: float, volume: float = 0.4) -> List[float]:
    import random
    num_samples = int(duration * SAMPLE_RATE)
    samples = []
    # Simple lowpass state
    lp_state = 0.0
    for i in range(num_samples):
        progress = i / max(1, num_samples - 1)
        # Cutoff sweep
        fc = freq_start + (freq_end - freq_start) * progress
        rc = 1.0 / (2.0 * math.pi * fc)
        dt = 1.0 / SAMPLE_RATE
        alpha = dt / (rc + dt)
        raw_noise = (random.random() * 2.0 - 1.0)
        lp_state += alpha * (raw_noise - lp_state)
        # Bell envelope
        envelope = math.sin(math.pi * progress) * volume
        samples.append(lp_state * envelope)
    return samples

def generate_chime(frequencies: List[float], duration: float, volume: float = 0.3) -> List[float]:
    num_samples = int(duration * SAMPLE_RATE)
    samples = [0.0] * num_samples
    for f in frequencies:
        phase = 0.0
        for i in range(num_samples):
            t = i / SAMPLE_RATE
            phase += 2.0 * math.pi * f / SAMPLE_RATE
            envelope = math.exp(-6.0 * t) * (volume / len(frequencies))
            samples[i] += math.sin(phase) * envelope
    return samples

def generate_sub_impact(duration: float = 0.45, volume: float = 0.6) -> List[float]:
    num_samples = int(duration * SAMPLE_RATE)
    samples = []
    phase = 0.0
    for i in range(num_samples):
        t = i / SAMPLE_RATE
        freq = 150.0 * math.exp(-12.0 * t) + 42.0
        phase += 2.0 * math.pi * freq / SAMPLE_RATE
        envelope = math.exp(-5.0 * t) * volume
        sample = math.sin(phase) * envelope
        samples.append(sample)
    return samples

def write_wav(file_path: Path, samples: List[float]):
    file_path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(file_path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SAMPLE_RATE)
        int_samples = [max(-32767, min(32767, int(s * 32767.0))) for s in samples]
        raw = struct.pack(f"<{len(int_samples)}h", *int_samples)
        w.writeframes(raw)

def ensure_soundbank(sfx_dir: Path):
    """Generates the studio soundbank files if not already present."""
    sfx_dir.mkdir(parents=True, exist_ok=True)
    files = {
        "sfx_typewriter.wav": lambda: generate_sine_blip(2200, 1600, 0.035, 120.0, 0.20),
        "sfx_pop.wav": lambda: generate_sine_blip(950, 480, 0.075, 45.0, 0.35),
        "sfx_whoosh.wav": lambda: generate_noise_sweep(0.380, 400, 4500, 0.32),
        "sfx_impact.wav": lambda: generate_sub_impact(0.450, 0.55),
        "sfx_chime.wav": lambda: generate_chime([1046.5, 1318.5, 1567.98], 0.35, 0.30),
        "sfx_riser.wav": lambda: generate_noise_sweep(0.750, 250, 6000, 0.30),
    }
    for name, gen_fn in files.items():
        target = sfx_dir / name
        if not target.exists() or target.stat().st_size < 100:
            samples = gen_fn()
            write_wav(target, samples)

class SmartSfxScheduler:
    """
    Intelligently maps video scene events to sound effects.
    Implements density guard to avoid cluttered audio.
    """

    DEFAULT_RULES = {
        "scene_transition": {"type": "whoosh", "lead_frames": 2, "volume": 0.22},
        "headline_entrance": {"type": "pop", "lead_frames": 1, "volume": 0.20},
        "badge_in": {"type": "pop", "lead_frames": 1, "volume": 0.18},
        "stat_highlight": {"type": "chime", "lead_frames": 0, "volume": 0.24},
        "dramatic_climax": {"type": "impact", "lead_frames": 0, "volume": 0.32},
        "call_to_action": {"type": "chime", "lead_frames": 0, "volume": 0.22},
        "caption_phrase": {"type": "typewriter", "lead_frames": 0, "volume": 0.12},
    }

    @classmethod
    def generate_cues_for_scenes(cls, scenes: List[Dict[str, Any]], fps: int = 30) -> List[Dict[str, Any]]:
        cues = []
        current_frame = 0

        for idx, scene in enumerate(scenes):
            duration_frames = int(scene.get("duration", 4.0) * fps)
            scene_type = scene.get("type", "normal").lower()

            # 1. Scene Entrance (Whoosh) - except frame 0 to keep intro clean
            if idx > 0:
                cues.append({
                    "type": "whoosh",
                    "frame": max(0, current_frame - 2),
                    "volume": 0.22
                })

            # 2. Key Headline / Card Pop
            headline_offset = scene.get("headlineFrame", 6)
            cues.append({
                "type": "pop",
                "frame": current_frame + headline_offset,
                "volume": 0.20
            })

            # 3. Contextual Highlights based on scene semantic role
            if "stat" in scene_type or "proof" in scene_type or scene.get("hasStat"):
                cues.append({
                    "type": "chime",
                    "frame": current_frame + int(duration_frames * 0.35),
                    "volume": 0.24
                })
            elif "climax" in scene_type or "twist" in scene_type or scene.get("isClimax"):
                cues.append({
                    "type": "impact",
                    "frame": current_frame + int(duration_frames * 0.25),
                    "volume": 0.32
                })
            elif "cta" in scene_type or "end" in scene_type or idx == len(scenes) - 1:
                cues.append({
                    "type": "chime",
                    "frame": current_frame + int(duration_frames * 0.30),
                    "volume": 0.22
                })

            current_frame += duration_frames

        # Apply Density Guard: Ensure no two loud cues occur within 6 frames (~200ms)
        cues.sort(key=lambda x: x["frame"])
        filtered_cues = []
        last_frame = -999
        for c in cues:
            if c["frame"] - last_frame >= 6 or c["type"] == "impact":
                filtered_cues.append(c)
                last_frame = c["frame"]

        return filtered_cues

if __name__ == "__main__":
    import sys
    # When run directly, ensure soundbank in workspace/public/sfx
    project_root = Path(__file__).resolve().parent.parent.parent
    ensure_soundbank(project_root / "workspace" / "public" / "sfx")
    ensure_soundbank(project_root / "public" / "sfx")
    ensure_soundbank(project_root / "apps" / "public" / "sfx")
    print(json.dumps({"status": "ok", "soundbank": "synced"}))

#!/usr/bin/env python3
"""
Arunaki Neural TTS & Voicebox Bridge Engine
Zero cloud cost (Rp 0), studio-grade natural voice synthesis.
Supports custom voice styles, rate, pitch, and multi-speaker presets.
"""

import argparse
import asyncio
import os
import sys
import edge_tts
import soundfile as sf

VOICE_PRESETS = {
    "documentary_male": {
        "voice": "en-US-ChristopherNeural",
        "description": "Deep, authoritative BBC/Discovery documentary narrator",
        "rate": "+6%",
        "pitch": "-2Hz",
    },
    "tech_male": {
        "voice": "en-US-GuyNeural",
        "description": "Passionate, confident Silicon Valley tech review & podcast voice",
        "rate": "+8%",
        "pitch": "+0Hz",
    },
    "story_female": {
        "voice": "en-US-JennyNeural",
        "description": "Clear, engaging storytelling female voice",
        "rate": "+5%",
        "pitch": "+0Hz",
    },
    "id_documentary": {
        "voice": "id-ID-ArdiNeural",
        "description": "Bahasa Indonesia formal documentary narrator",
        "rate": "+5%",
        "pitch": "-1Hz",
    },
    "id_conversational": {
        "voice": "id-ID-GadisNeural",
        "description": "Bahasa Indonesia natural storytelling & viral TikTok hook",
        "rate": "+8%",
        "pitch": "+0Hz",
    },
}

async def generate_voice(text: str, output_wav: str, preset: str = "documentary_male", rate: str = None, pitch: str = None):
    config = VOICE_PRESETS.get(preset, VOICE_PRESETS["documentary_male"])
    voice = config["voice"]
    effective_rate = rate or config["rate"]
    effective_pitch = pitch or config["pitch"]

    temp_mp3 = output_wav.replace(".wav", ".temp.mp3")
    print(f"[TTS] Synthesizing with preset '{preset}' (Voice: {voice}, Rate: {effective_rate}, Pitch: {effective_pitch})...")
    
    communicate = edge_tts.Communicate(text, voice, rate=effective_rate, pitch=effective_pitch)
    await communicate.save(temp_mp3)

    # Convert to standard WAV for Remotion audio stability
    data, samplerate = sf.read(temp_mp3)
    sf.write(output_wav, data, samplerate)
    if os.path.exists(temp_mp3):
        os.remove(temp_mp3)

    duration = len(data) / samplerate
    print(f"[TTS] Generated: {output_wav} ({duration:.2f}s, {samplerate}Hz)")
    return duration

def main():
    parser = argparse.ArgumentParser(description="Arunaki Neural TTS & Voicebox Bridge")
    parser.add_argument("--text", type=str, required=True, help="Text to speak")
    parser.add_argument("--output", type=str, default="apps/public/rust_voiceover.wav", help="Output WAV path")
    parser.add_argument("--preset", type=str, default="documentary_male", choices=list(VOICE_PRESETS.keys()))
    parser.add_argument("--rate", type=str, default=None, help="Rate adjustment, e.g. +10%%")
    parser.add_argument("--pitch", type=str, default=None, help="Pitch adjustment, e.g. -2Hz")
    args = parser.parse_args()

    asyncio.run(generate_voice(args.text, args.output, args.preset, args.rate, args.pitch))

if __name__ == "__main__":
    main()


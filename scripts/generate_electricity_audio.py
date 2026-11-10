import os
import sys
import json
import shutil
import subprocess

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
WORKSPACE_AUDIO = os.path.join(PROJECT_ROOT, "workspace", "audio")
APPS_PUBLIC_AUDIO = os.path.join(PROJECT_ROOT, "apps", "public", "audio")

os.makedirs(APPS_PUBLIC_AUDIO, exist_ok=True)

scenes = [
    "scene1_hook",
    "scene2_rahasia_alam",
    "scene3_langit_laboratorium",
    "scene4_volta_baterai",
    "scene5_faraday_generator",
    "scene6_twist_penutup"
]

print("=== GENERATING AETHERIA PRESET AUDIO (VOXCPM2 + SPOTIFY DSP) ===")

for scene_id in scenes:
    words_file = os.path.join(WORKSPACE_AUDIO, f"{scene_id}.words.json")
    wav_file = os.path.join(WORKSPACE_AUDIO, f"{scene_id}.wav")

    if not os.path.exists(words_file):
        print(f"[-] Missing {words_file}, skipping...")
        continue

    with open(words_file, "r", encoding="utf-8") as f:
        meta = json.load(f)

    text = meta.get("text", "")
    spoken = meta.get("spoken_text", text)

    print(f"\n[+] Processing {scene_id} ({len(text)} chars)...")
    cmd = [
        sys.executable,
        os.path.join(PROJECT_ROOT, "core", "voicebox", "voicebox_engine.py"),
        "--text", text,
        "--spoken-text", spoken,
        "--out", wav_file,
        "--voice", "aetheria",
        "--style", "mystery",
        "--lang", "id"
    ]

    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"[-] Failed to generate {scene_id}: {res.stderr}")
    else:
        print(f"[✓] Successfully generated {wav_file}")
        # Copy to apps/public/audio for Remotion & Vite static serving
        dest_wav = os.path.join(APPS_PUBLIC_AUDIO, f"{scene_id}.wav")
        dest_words = os.path.join(APPS_PUBLIC_AUDIO, f"{scene_id}.words.json")
        shutil.copy2(wav_file, dest_wav)
        shutil.copy2(words_file, dest_words)
        print(f"[✓] Mirrored to {dest_wav}")

print("\n=== ALL 6 SCENES GENERATED SUCCESSFULLY ===")


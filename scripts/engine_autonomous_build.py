import urllib.request
import json
import time
import sys

ENGINE_URL = "http://127.0.0.1:4196"

def main():
    print("=" * 65)
    print("  DISPATCHING AUTONOMOUS VIDEO ASSEMBLY & RENDER TO ENGINE")
    print("=" * 65)

    # 1. Create a session on the engine with fast, high-quality Qwen model
    create_req = urllib.request.Request(
        f"{ENGINE_URL}/api/session",
        data=json.dumps({
            "title": "AiShift Video Autonomous Builder",
            "directory": r"e:\JS\ArunakiNexus",
            "model": {
                "providerID": "kenari",
                "id": "qwen3-5-397b-a17b:free"
            }
        }).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(create_req) as resp:
        s_data = json.loads(resp.read().decode("utf-8"))["data"]
        sid = s_data["id"]
        print(f"[*] Engine Session Created: {sid}")

    # 2. Instruct the engine to assemble and render the video using its native tools
    prompt_text = """Nexus Engine, tugasmu adalah menyelesaikan dan merender video editorial gaya @aishift.id secara otonom.

Komponen yang sudah ada di workspace/src/ai-shift/:
- types.ts (durasi scene S1=360, S2=210, S3=810, S4=330, TOTAL_FRAMES=1710, warna, font)
- components/motion.tsx (AuroraGlow, animasi teks/stat)
- components/CounterStat.tsx (angka statistik hitung naik)
- Audio voiceover di workspace/public/: vo_scene1.wav, vo_scene2.wav, vo_scene3.wav, vo_scene4.wav

Lakukan langkah-langkah berikut menggunakan tool native-mu:
1. Gunakan tool 'write' untuk membuat file 'workspace/src/ai-shift/AiShiftComposition.tsx'.
   File ini harus mengimpor komponen di atas, menyusun 4 Sequence (Scene 1: Hook, Scene 2: Stat 1, Scene 3: Stat 2, Scene 4: CTA), serta Audio untuk masing-masing scene, dan mengekspor AiShiftComposition, AISHIFT_TOTAL_FRAMES, AISHIFT_FPS, AISHIFT_WIDTH, AISHIFT_HEIGHT.
2. Gunakan tool 'edit' untuk mendaftarkan 'AiShiftComposition' ke 'workspace/src/Root.tsx'.
3. Panggil tool 'render_video' dengan composition_id='AiShiftComposition' dan output_path='output/ai-shift-video.mp4'.

Jalankan sekarang secara otonom step by step!"""

    prompt_req = urllib.request.Request(
        f"{ENGINE_URL}/api/session/{sid}/prompt",
        data=json.dumps({"text": prompt_text}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(prompt_req) as resp:
        print(f"[*] Prompt Injected Status: {resp.status} (Engine starting agent turn...)")

    print("\n[*] Memantau aktivitas tool engine secara real-time...")
    seen_messages = 0
    start_time = time.time()
    rendered = False

    while time.time() - start_time < 300: # 5 minutes max
        time.sleep(3)
        try:
            with urllib.request.urlopen(f"{ENGINE_URL}/api/session/{sid}/message") as resp:
                msgs = json.loads(resp.read().decode("utf-8")).get("data", [])
                if len(msgs) > seen_messages:
                    for m in msgs[seen_messages:]:
                        role = m.get("role") or m.get("type", "unknown")
                        text = m.get("text") or ""
                        tools = m.get("tools") or []
                        print(f"\n[ENGINE MSG - {role.upper()}]")
                        if tools:
                            for t in tools:
                                print(f"  -> Tool Executed: {t.get('name')} (Status: {t.get('status')})")
                        if text:
                            print(f"  -> Text: {text}")
                    seen_messages = len(msgs)

            # Check if video was rendered
            import os
            if os.path.exists("output/ai-shift-video.mp4") and os.path.getsize("output/ai-shift-video.mp4") > 100000:
                print("\n" + "=" * 65)
                print("  [SUCCESS] output/ai-shift-video.mp4 BERHASIL DIRENDER OLEH ENGINE!")
                print(f"  Ukuran: {os.path.getsize('output/ai-shift-video.mp4'):,} bytes")
                print("=" * 65)
                rendered = True
                break
        except Exception as e:
            print(f"  ... polling error: {e}")

    if not rendered:
        print("[!] Selesai atau timeout tercapai.")

if __name__ == "__main__":
    main()


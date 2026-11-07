import urllib.request
import json
import time
import os
import sys

ENGINE_URL = "http://127.0.0.1:4196"
WORKSPACE_DIR = r"e:\AetheriaNexus"
OUTPUT_MP4 = os.path.join(WORKSPACE_DIR, "output", "prossultan-gemini-flash.mp4")

def main():
    print("=" * 72)
    print("  AETHERIA E2E VIDEO TEST (KENARI API + @PROSSULTAN + @POCKETMYTH)")
    print("=" * 72)

    # 1. Create a session on the engine with Kenari API (Qwen 3.5 397B)
    create_payload = {
        "title": "E2E Video: @prossultan Gemini 3.8 Flash x @pocketmyth Voice",
        "directory": WORKSPACE_DIR,
        "location": {"directory": WORKSPACE_DIR},
        "model": {
            "providerID": "kenari",
            "id": "qwen3-5-397b-a17b:free"
        }
    }
    create_req = urllib.request.Request(
        f"{ENGINE_URL}/api/session",
        data=json.dumps(create_payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(create_req) as resp:
        s_data = json.loads(resp.read().decode("utf-8"))["data"]
        sid = s_data["id"]
        print(f"[*] Engine Session Created: {sid}")
        print(f"[*] Provider: kenari | Model: qwen3-5-397b-a17b:free")

    # 2. Dispatch E2E prompt (pure user request with both TikTok links)
    prompt_text = """buat video dengan refrensi ini 

https://www.tiktok.com/@prossultan/video/7704517278666198279?is_from_webapp=1&sender_device=pc&web_id=7705460684746360327

audionya ini 
https://www.tiktok.com/@pocketmyth/video/7278334667198188805?is_from_webapp=1&sender_device=pc&web_id=7705460684746360327

tone dan intonasinya (gunakan voice: "pocketmyth" di voicebox_speak tanpa engine: "edge", baca laporan referensi di workspace/ref/extracted/ref_report.md, buat komponen Remotion di workspace/src/prossultan-gemini/ dengan setiap <Audio src={staticFile("vo_sceneN.wav")} /> WAJIB berada DI DALAM <Sequence from={SCENE_START_FRAMES[i]} durationInFrames={SCENE_FRAMES[i]}> agar suara tidak double/tumpuk di frame 0, daftarkan ProssultanComposition di workspace/src/Root.tsx, dan jalankan render_video ke output/prossultan-gemini-flash.mp4)."""

    prompt_req = urllib.request.Request(
        f"{ENGINE_URL}/api/session/{sid}/prompt",
        data=json.dumps({"text": prompt_text}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(prompt_req) as resp:
        print(f"[*] Prompt Dispatched! HTTP Status: {resp.status}")

    print("\n[*] Monitoring Engine Session Turn & Tool Calls...")
    seen_parts = set()
    start_time = time.time()

    while time.time() - start_time < 600:
        time.sleep(3)
        try:
            with urllib.request.urlopen(f"{ENGINE_URL}/api/session/{sid}/message") as resp:
                payload = json.loads(resp.read().decode("utf-8"))
                msgs = payload.get("data", [])
                for m in msgs:
                    m_id = m.get("id", "")
                    role = m.get("role") or m.get("type", "unknown")
                    content = m.get("content") or []
                    if isinstance(content, list):
                        for idx, part in enumerate(content):
                            part_key = f"{m_id}_{idx}_{part.get('type')}_{part.get('status', '')}"
                            if part_key not in seen_parts:
                                seen_parts.add(part_key)
                                ptype = part.get("type")
                                if ptype == "text":
                                    txt = (part.get("text") or "").strip()
                                    if txt and role != "user":
                                        print(f"\n[ASSISTANT TEXT]:\n{txt[:400]}{'...' if len(txt) > 400 else ''}")
                                elif ptype in ("tool-call", "tool_call", "tool"):
                                    tname = part.get("name") or part.get("tool") or part.get("toolName")
                                    tstatus = part.get("status") or "called"
                                    print(f"  -> [TOOL] {tname} ({tstatus})")

            # Also check active run status if available or output MP4
            if os.path.exists(OUTPUT_MP4) and os.path.getsize(OUTPUT_MP4) > 100_000:
                # Wait a brief moment for final assistant text
                time.sleep(4)
                print("\n" + "=" * 72)
                print(f"  [SUCCESS] E2E VIDEO RENDERED: {OUTPUT_MP4}")
                print(f"  File Size: {os.path.getsize(OUTPUT_MP4):,} bytes")
                print("=" * 72)
                return
        except Exception as e:
            print(f"  ... polling: {e}")

    print("[!] Timeout or session ended.")

if __name__ == "__main__":
    main()


import urllib.request
import json
import time
import sys

def main():
    print("=" * 60)
    print("  INJECTING PROMPT TO AETHERIA ENGINE SESSION")
    print("=" * 60)

    # 1. Create autonomous session on engine
    create_req = urllib.request.Request(
        "http://127.0.0.1:4196/api/session",
        data=json.dumps({
            "title": "Autonomous Reference Dissection & Video Creation",
            "directory": r"e:\JS\ArunakiNexus",
            "model": {
                "providerID": "kenari",
                "id": "agnes-3-0-flash:free"
            }
        }).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(create_req) as resp:
        s_data = json.loads(resp.read().decode("utf-8"))["data"]
        sid = s_data["id"]
        print(f"[*] Engine Session Created: {sid}")

    # 2. Inject Prompt
    prompt_text = (
        "Halo Nexus Engine. Ada video referensi viral baru di path: "
        "'references/aishift_7699432430687505685.mp4'.\n\n"
        "Tugasmu secara mandiri:\n"
        "1. Jalankan tool 'extract_video_reference' pada 'references/aishift_7699432430687505685.mp4' untuk membedah durasi scene, ritme, dan warna dominan.\n"
        "2. Baca file 'workspace/ref/extracted/style_spec.json' yang dihasilkan.\n"
        "3. Berikan analisis struktur adegan referensi tersebut dan paparkan konsep video baru yang akan kamu buat berdasarkan gaya referensi itu."
    )

    prompt_req = urllib.request.Request(
        f"http://127.0.0.1:4196/api/session/{sid}/prompt",
        data=json.dumps({"text": prompt_text}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(prompt_req) as resp:
        print(f"[*] Prompt Injected Status: {resp.status} (Dispatched to autonomous agent turn)")

    print(f"\n[*] Menunggu engine menjalankan turn secara mandiri...")
    completed = False
    for step in range(30):
        time.sleep(3)
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:4196/api/session/{sid}/message") as resp:
                data = json.loads(resp.read().decode("utf-8"))
                msgs = data.get("data", [])
                if len(msgs) > 1:
                    print(f"\n[+] Engine telah merespons! Total {len(msgs)} pesan tercatat di sesi:")
                    for idx, m in enumerate(msgs[1:], start=1):
                        role = m.get("role") or m.get("type", "assistant")
                        text = m.get("text", "")
                        print(f"\n==================== PESAN ENGINE [{role.upper()}] ====================")
                        print(text)
                    completed = True
                    break
                else:
                    print(f"    - Turn sedang diproses oleh engine (detik ke-{(step+1)*3})...")
        except Exception as e:
            print(f"    - Menunggu turn: {e}")

    if not completed:
        print("[!] Engine masih memproses turn di background.")

if __name__ == "__main__":
    main()

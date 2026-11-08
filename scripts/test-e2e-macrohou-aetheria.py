import urllib.request
import json
import time
import os
import sys

ENGINE_URL = "http://127.0.0.1:4196"
WORKSPACE_DIR = r"e:\AetheriaNexus"
OUTPUT_MP4 = os.path.join(WORKSPACE_DIR, "output", "aetheria-macrohou-launch.mp4")

def wait_for_engine(timeout=600):
    start = time.time()
    while time.time() - start < timeout:
        try:
            with urllib.request.urlopen(f"{ENGINE_URL}/api/health", timeout=3) as r:
                if r.status == 200:
                    return True
        except Exception:
            time.sleep(2)
    return False

def main():
    print("=" * 72)
    print("  AETHERIA E2E VIDEO TEST (PROMPT-MOTION @MACROHOU STYLE FOR AETHERIA)")
    print("=" * 72)

    if not wait_for_engine():
        print("[!] Engine did not start on :4196 within timeout.")
        sys.exit(1)

    if os.path.exists(OUTPUT_MP4):
        try:
            os.remove(OUTPUT_MP4)
        except Exception:
            pass

    # 1. Create a session on the engine with Kenari API (Qwen 3.5 397B)
    create_payload = {
        "title": "E2E Video: Aetheria Launch Showreel (@macrohou Prompt Motion Style)",
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

    # 2. Dispatch E2E prompt modeled on https://prompt-motion.com/macrohou-33959d
    prompt_text = """Make a high-density, studio-grade motion graphics launch video explaining **Aetheria Nexus** (our autonomous AI motion graphics & voiceover desktop workstation) inspired by the visual motion design from https://prompt-motion.com/macrohou-33959d (`workspace/ref/macrohou_ren.mp4`, blueprint at `workspace/ref/extracted_macrohou/ref_report.md`).

<direction>
1. CRITICAL TOPIC ISOLATION: The reference video `macrohou_ren.mp4` was a health supplement ad. DO NOT copy or translate any text about health, supplements, or "everyone swears it works"! All voiceovers, headlines, and on-screen cards MUST 100% be about **Aetheria Nexus** (our AI motion graphics desktop workstation).
2. Follow the exact per-scene visual archetypes and contrast shifts from the reference:
   - **Scene 1 (DARK 3D PARTICLE EXPLOSION HOOK — bg `#0C0B0B`):** Deep black background with 24+ floating 3D-styled capsules/pills (`#4D5E4E` emerald-sage & `#E2C07D` warm gold, two-tone pill shapes, `+` crosses, and `★★★★★` star clusters) drifting with parallax and foreground depth-of-field blur (`blur(6px)` on 3 huge edge capsules).
     * Sub-beat 1 (0..3.2s): Giant `124px` headline `"Semua orang bilang AI video itu ribet."` in crisp white & accent red.
     * Sub-beat 2 (3.2..6.8s): 3 staggered floating pain-point cards (`Nulis script & storyboard berjam-jam`, `Cari voiceover & dubbing AI kaku`, `Sinkronin frame per kata di timeline`).
      * Sub-beat 3 (6.8..10.6s): Stage Clearing Transition: Pain-point cards animate out with exit() (slide up & fade out), clearing the stage so the solution command pill /add preset · Studio Otomatis expands into center stage with continuous glowing border pulse (Math.sin(frame * 0.08)). Absolutely NO overlapping elements and NO frozen/stuck frames!
   - **Scene 2 (STAGGERED PILL STACK & WORKSTATION UI — bg `#F2ECE5` warm editorial grid):**
     * Sub-beat 1 (0..4.5s): Editorial header `"Aetheria Nexus Workstation — Ketik /add preset"` with top app window bar.
     * Sub-beat 2 (4.5..10.5s): Cursor glides across and clicks the `/add preset` command, revealing the Studio Modal with Left Card (Audio & Voicebox Preset) and Right Card (Video Blueprint Extractor).
     * Sub-beat 3 (10.5..17s): Camera zooms in (`scale 1.0 -> 1.15`) onto live tuning sliders: `CFG Voice Temperature: 1.48 (Lepas)` and `Pedalboard Limiter: -14.0 LUFS`.
   - **Scene 3 (SCREEN-STUDIO MACRO ZOOM UI — bg `#F2ECE5`):**
     * Sub-beat 1 (0..3.5s): Headline `"Lokal & Bebas Cloud"` + Giant readout `"Rp 0 Cloud Bill"`.
     * Sub-beat 2 (3.5..7.5s): Tilted hardware frame with glowing mint-sage status pill `"RENDERED LOCAL"` and colossal `132px` metric `"100% Frame Sync"` with word-timing markers.
     * Sub-beat 3 (7.5..12s): Live animated audio waveform bars + badge `"0ms Delay · Audio-Visual Lock Verified"`.
   - **Scene 4 (SVG BEZIER NODE GRAPH & PAYOFF — bg `#F2ECE5` -> `#0C0B0B` end card):**
     * Sub-beat 1 (0..3.5s): Left-aligned headline `"Dari Prompt ke Motion Graphics"`. Below: circular node `✓ Aetheria Engine` connected via animated SVG cubic Bezier curves (`<svg><path d="M ... C ..." strokeDasharray={600} strokeDashoffset={...} /></svg>`) to 4 staggered pill nodes (`Remotion 60fps Code`, `VoxCPM2 Neural Voice`, `Smart SFX Engine`, `Zero Cloud Cost Rp 0`).
     * Sub-beat 2 (3.5..7.5s): Cinematic cut to dark end card with glowing Aetheria emblem, title `"Aetheria Nexus"`, punchy tagline `"Lo Tulis, Dia Gerak."`, and action pill `"Mulai Render Sekarang — Gratis"`.
3. CRITICAL ANIMATION RULE: Inside every `SceneN.tsx`, `useCurrentFrame()` ALREADY starts at `0` because it is inside `<Sequence>`. Always pass `0` (or local stagger `6`, `14`, `24`) as `startFrame`. NEVER pass `SCENE_START_FRAMES[i]` inside `Scene1.tsx..Scene4.tsx`!
4. STRICT TIMING & FRAME DURATIONS (derive from voiceover words.json):
   - Scene 1: 640 frames (~10.66s)
   - Scene 2: 1020 frames (~17.0s)
   - Scene 3: 730 frames (~12.16s)
   - Scene 4: 460 frames (~7.66s)
   - Total: 2850 frames (~47.5s)
</direction>

<sound_design_and_voiceover>
- In `workspace/public/`, generate or reuse the 4 sequential Indonesian voiceovers:
  - `workspace/public/vo_aetheria_s1.wav`: "Semua orang bilang AI video itu ribet. Nulis script, cari voiceover, sinkronin frame—udah berapa jam? Tapi gimana kalau lo cuma perlu satu perintah, dan semuanya jadi?"
  - `workspace/public/vo_aetheria_s2.wav`: "Kenalin, Aetheria. Workstation otonom buat motion graphics. Lo ketik slash add preset, pilih template, dan boom—studio lengkap muncul. Audio kiri kanan, video timeline, semua udah settingan pro. CFG satu koma empat delapan, limiter minus empat belas LUFS, cursor langsung klik sendiri."
  - `workspace/public/vo_aetheria_s3.wav`: "Nah ini gila. Zero cloud cost, seratus persen frame sync. Voicebox generate suara plus word alignment, Remotion render frame by frame tepat pas. Nggak ada lagi audio kececer atau visual telat."
  - `workspace/public/vo_aetheria_s4.wav`: "Jadi tunggu apa lagi? Dari prompt langsung jadi motion graphics. Aetheria Nexus—lo tulis, dia gerak. Coba sekarang!"
- In `AetheriaLaunchComposition.tsx`, wrap each scene and its matching voiceover `<Audio src={staticFile("vo_aetheria_sN.wav")} />` inside `<Sequence from={SCENE_START_FRAMES[i]} durationInFrames={SCENE_FRAMES[i]}>`.
- MANDATORY SOUND EFFECTS (SFX): Layer studio SFX inside each scene `<Sequence>`:
  - Scene 1: `sfx/sfx_whoosh.wav` (frame 0), `sfx/sfx_impact.wav` (frame 15), `sfx/sfx_pop.wav` (frames 195, 225, 255), `sfx/sfx_chime.wav` (frame 415)
  - Scene 2: `sfx/sfx_whoosh.wav` (frame 0), `sfx/sfx_pop.wav` (frame 270 cursor click), `sfx/sfx_chime.wav` (frame 280 modal open), `sfx/sfx_riser.wav` (frame 620 camera zoom)
  - Scene 3: `sfx/sfx_whoosh.wav` (frame 0), `sfx/sfx_impact.wav` (frame 30), `sfx/sfx_chime.wav` (frame 160), `sfx/sfx_pop.wav` (frame 330)
  - Scene 4: `sfx/sfx_whoosh.wav` (frame 0), `sfx/sfx_pop.wav` (frames 25, 45, 65 node connects), `sfx/sfx_impact.wav` (frame 210 end card drop), `sfx/sfx_chime.wav` (frame 330 CTA glow)
- Build the Remotion project in `workspace/src/aetheria-launch/` (`types.ts`, `scenes/Scene1.tsx`..`Scene4.tsx`, `AetheriaLaunchComposition.tsx`), register `AetheriaLaunch` in `workspace/src/Root.tsx`, and run `render_video` to `"output/aetheria-macrohou-launch.mp4"`.
</sound_design_and_voiceover>"""

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

    while time.time() - start_time < 900:
        time.sleep(4)
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
                                        print(f"\n[ASSISTANT TEXT]:\n{txt[:400]}{'...' if len(txt) > 400 else ''}", flush=True)
                                elif ptype in ("tool-call", "tool_call", "tool"):
                                    tname = part.get("name") or part.get("tool") or part.get("toolName")
                                    tstatus = part.get("status") or "called"
                                    print(f"  -> [TOOL] {tname} ({tstatus})", flush=True)

            if os.path.exists(OUTPUT_MP4) and os.path.getsize(OUTPUT_MP4) > 100_000:
                time.sleep(4)
                print("\n" + "=" * 72)
                print(f"  [SUCCESS] E2E VIDEO RENDERED: {OUTPUT_MP4}")
                print(f"  File Size: {os.path.getsize(OUTPUT_MP4):,} bytes")
                print("=" * 72)
                return
        except Exception as e:
            print(f"  ... polling: {e}", flush=True)

    print("[!] Timeout or session ended.")

if __name__ == "__main__":
    main()


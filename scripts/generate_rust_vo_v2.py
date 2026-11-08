import os
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor

VO_SCENES = [
    (1, 0.15, "Tahukah kamu, bahasa pemrograman paling dicintai di dunia ini lahir dari tragedi lift rusak di lantai 21?"),
    (2, 5.15, "Tahun 2006, insinyur Graydon Hoare harus jalan kaki naik tangga 21 lantai karena software liftnya mati total."),
    (3, 10.15, "Penyebabnya sepele tapi mematikan: bug memori C++ yang bikin seluruh sistem operasi lift crash seketika!"),
    (4, 15.15, "Dilema programmer: C++ memang super cepat tapi rawan crash, sedangkan Java aman tapi lemot karena garbage collector."),
    (5, 20.15, "Dari rasa frustrasi itu, Graydon menciptakan Rust di kamarnya, terinspirasi dari jamur tangguh bernama rust fungus."),
    (6, 25.15, "Tahun 2009, Mozilla resmi mendanai riset mesin Servo untuk membuktikan kekuatan Rust di dunia nyata."),
    (7, 30.15, "Senjata rahasia Rust: Borrow Checker! Menjamin seratus persen memori aman saat compile, tanpa garbage collector sama sekali!"),
    (8, 35.15, "Zero-cost abstraction! Berjalan secepat bare-metal C++, tapi seaman bahasa tingkat tinggi modern."),
    (9, 40.15, "Tahun 2015 versi satu titik nol resmi rilis, dan langsung dinobatkan sebagai bahasa paling dicintai developer selama 8 tahun beruntun!"),
    (10, 45.15, "Gimana fungsinya sekarang? Rust resmi masuk ke inti Linux Kernel, mengamankan Android, Windows, dan infra Cloudflare!"),
    (11, 50.15, "Bahkan mesin AI modern, backend Discord, hingga crypto berkecepatan tinggi kini wajib dibangun di atas Rust!"),
    (12, 55.15, "Dari lift rusak, kini jadi standar masa depan software dunia. Kamu sudah ketik cargo run hari ini?"),
]

def generate_scene(item):
    num, offset, text = item
    out_wav = f"workspace/public/vo_rust_v2_s{num}.wav"
    print(f"[s{num}] Starting VoxCPM2 (aetheria_id): \"{text[:35]}...\"")
    cmd = [
        sys.executable,
        "core/voicebox/voicebox_engine.py",
        "--text", text,
        "--out", out_wav,
        "--voice", "aetheria",
        "--lang", "id"
    ]
    t0 = time.time()
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode == 0:
        print(f"[s{num}] DONE in {time.time()-t0:.1f}s -> {out_wav}")
        return True
    else:
        print(f"[s{num}] FAILED: {res.stderr}")
        return False

def main():
    print("=== Generating 12 VO Scenes with Aetheria Preset (aetheria_id.wav clone) ===")
    t_start = time.time()
    with ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(generate_scene, VO_SCENES))
    print(f"\nAll scenes completed in {time.time()-t_start:.1f}s. Success count: {sum(results)}/{len(VO_SCENES)}")

if __name__ == "__main__":
    main()


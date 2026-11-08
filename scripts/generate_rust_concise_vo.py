import os
import sys
import time
import subprocess
from concurrent.futures import ThreadPoolExecutor

CONCISE_VO_SCENES = [
    (1, 0.20, "Tahukah kamu, bahasa pemrograman paling dicintai dunia lahir dari lift rusak?"),
    (2, 5.20, "Tahun 2006, insinyur Graydon Hoare harus naik tangga dua satu lantai."),
    (3, 10.20, "Penyebabnya: bug memori C++ yang bikin OS lift crash seketika!"),
    (4, 15.20, "Dilema programmer: C++ rawan crash, tapi Java lemot kena garbage collector."),
    (5, 20.20, "Di kamarnya, Graydon merancang Rust, terinspirasi dari jamur super tangguh."),
    (6, 25.20, "Tahun 2009, Mozilla resmi mendanai riset mesin web Servo."),
    (7, 30.20, "Senjata rahasianya: Borrow Checker! Memori aman tanpa garbage collector."),
    (8, 35.20, "Zero-cost abstraction! Berjalan secepat C++, tapi anti crash."),
    (9, 40.20, "Rust dinobatkan sebagai bahasa paling dicintai developer delapan tahun berturut-turut!"),
    (10, 45.20, "Kini Rust resmi dipakai di Linux Kernel, Android, dan Windows."),
    (11, 50.20, "Menjadi pondasi mesin AI modern dan backend Discord berkecepatan tinggi."),
    (12, 55.20, "Dari lift rusak, kini jadi standar dunia. Cargo run sekarang!"),
]

def generate_scene(item):
    num, offset, text = item
    out_wav = f"workspace/public/vo_rust_clean_s{num}.wav"
    print(f"[s{num}] Generating natural speech: \"{text}\"")
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
        print(f"[s{num}] OK in {time.time()-t0:.1f}s -> {out_wav}")
        return True
    else:
        print(f"[s{num}] Error: {res.stderr}")
        return False

def main():
    print("=== Generating Natural, Unhurried Aetheria VO (10 Words per Scene) ===")
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(generate_scene, CONCISE_VO_SCENES))
    print(f"Completed in {time.time()-t0:.1f}s. Success: {sum(results)}/{len(CONCISE_VO_SCENES)}")

if __name__ == "__main__":
    main()


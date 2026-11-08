import os
import subprocess
import sys
import wave
import struct

VO_SCRIPTS = [
    (1, 0.2, "Tahun 2006, lift apartemen lantai dua satu mati total."),
    (2, 5.2, "Graydon Hoare naik tangga dua satu lantai, gara-gara C++ crash."),
    (3, 10.2, "Tujuh puluh persen celah sistem ternyata adalah bug memori."),
    (4, 15.2, "Dilema programmer: C++ rawan crash, tapi garbage collector lambat."),
    (5, 20.2, "Dinamai dari jamur Rust, siklus biologis yang sangat tangguh."),
    (6, 25.2, "Tahun 2009, Mozilla resmi mensponsori riset mesin Servo."),
    (7, 30.2, "Senjata rahasianya: Borrow Checker, aman saat compile-time."),
    (8, 35.2, "Zero-cost abstraction: berjalan secepat bare-metal."),
    (9, 40.2, "Mei 2015, Rust versi satu titik nol resmi stabil bersama Cargo."),
    (10, 45.2, "Bahasa paling dicintai developer dunia delapan tahun berturut-turut."),
    (11, 50.2, "Menembus inti Linux Kernel dan raksasa cloud dunia."),
    (12, 55.2, "Dari lift rusak, jadi standar masa depan. Cargo run sekarang!")
]

def generate_voiceovers():
    print("=== Generating Voiceovers with Official Indonesian Preset (id-ID-ArdiNeural + Pedalboard DSP) ===")
    for scene_num, offset_sec, text in VO_SCRIPTS:
        out_wav = f"workspace/public/vo_rust_s{scene_num}.wav"
        if os.path.exists(out_wav) and os.path.getsize(out_wav) > 1024:
            print(f"[s{scene_num}] Already generated: {out_wav}")
            continue
        print(f"[s{scene_num}] Generating: \"{text}\" -> {out_wav}")
        cmd = [
            sys.executable,
            "core/voicebox/voicebox_engine.py",
            "--text", text,
            "--out", out_wav,
            "--lang", "id",
            "--voice", "id-ID-ArdiNeural",
            "--engine", "edge",
            "--rate", "+8%",
            "--pitch", "+6Hz",
            "--reset-voice-lock"
        ]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode != 0:
            print(f"Error on s{scene_num}: {res.stderr}")
        else:
            print(f"[s{scene_num}] OK (Neural Broadcast)")

def mix_master_audio():
    print("\n=== Mixing Master Audio (VO + SFX) ===")
    SAMPLE_RATE = 48000
    TOTAL_DURATION = 60.0
    NUM_SAMPLES = int(SAMPLE_RATE * TOTAL_DURATION)
    
    # 2 channels (stereo)
    left = [0.0] * NUM_SAMPLES
    right = [0.0] * NUM_SAMPLES
    
    # 1. Load SFX track
    sfx_path = "workspace/public/rust_history_sfx.wav"
    if os.path.exists(sfx_path):
        print(f"Loading SFX track from {sfx_path}...")
        with wave.open(sfx_path, "rb") as wf:
            n = wf.getnframes()
            data = wf.readframes(n)
            sfx_samples = struct.unpack(f"<{n*2}h", data)
            # Boost SFX slightly +4dB (~1.5x)
            for i in range(min(n, NUM_SAMPLES)):
                l = (sfx_samples[i*2] / 32768.0) * 1.5
                r = (sfx_samples[i*2 + 1] / 32768.0) * 1.5
                left[i] += l
                right[i] += r
    
    # 2. Overlay Voiceovers at their respective scene start times
    for scene_num, offset_sec, text in VO_SCRIPTS:
        vo_path = f"workspace/public/vo_rust_s{scene_num}.wav"
        if not os.path.exists(vo_path):
            print(f"Warning: {vo_path} not found")
            continue
        
        with wave.open(vo_path, "rb") as wf:
            n_ch = wf.getnchannels()
            s_rate = wf.getframerate()
            n_f = wf.getnframes()
            data = wf.readframes(n_f)
            raw_s = struct.unpack(f"<{n_f * n_ch}h", data)
            start_idx = int(offset_sec * SAMPLE_RATE)
            
            # Resample to 48000 if needed (e.g. 24000 -> 48000)
            ratio = SAMPLE_RATE / float(s_rate)
            num_out_frames = int(n_f * ratio)
            
            # Voiceover volume scale
            vo_gain = 1.3
            for out_i in range(num_out_frames):
                dest_idx = start_idx + out_i
                if dest_idx >= NUM_SAMPLES:
                    break
                
                # Source sample index in raw_s
                in_idx = int(out_i / ratio)
                if in_idx >= n_f:
                    break
                
                if n_ch == 1:
                    v = (raw_s[in_idx] / 32768.0) * vo_gain
                    left[dest_idx] += v
                    right[dest_idx] += v
                else:
                    l = (raw_s[in_idx*2] / 32768.0) * vo_gain
                    r = (raw_s[in_idx*2 + 1] / 32768.0) * vo_gain
                    left[dest_idx] += l
                    right[dest_idx] += r
        print(f"Mixed s{scene_num} at {offset_sec}s")
    
    # 3. Soft Limiter / Clamping
    master_path = "workspace/public/rust_master_audio.wav"
    print(f"Writing mastered audio to {master_path}...")
    with wave.open(master_path, "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        out_bytes = bytearray()
        for i in range(NUM_SAMPLES):
            # Soft tanh-like limiter
            l = left[i]
            r = right[i]
            l_clamped = max(-0.98, min(0.98, l))
            r_clamped = max(-0.98, min(0.98, r))
            out_bytes.extend(struct.pack("<hh", int(l_clamped * 32767), int(r_clamped * 32767)))
        wf.writeframes(out_bytes)
    print("Master audio ready: rust_master_audio.wav")

if __name__ == "__main__":
    generate_voiceovers()
    mix_master_audio()


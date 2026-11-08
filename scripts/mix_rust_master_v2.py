import os
import sys
import math
import random
import struct
import wave
import subprocess

SAMPLE_RATE = 48000
TOTAL_DURATION = 60.08
NUM_SAMPLES = int(SAMPLE_RATE * TOTAL_DURATION)
FFMPEG = r"E:\AetheriaNexus\node_modules\@remotion\compositor-win32-x64-msvc\ffmpeg.exe"

# Stereo float buffers for mixing
sfx_left = [0.0] * NUM_SAMPLES
sfx_right = [0.0] * NUM_SAMPLES
vo_left = [0.0] * NUM_SAMPLES
vo_right = [0.0] * NUM_SAMPLES

def add_sfx(idx, val, pan=0.0):
    if 0 <= idx < NUM_SAMPLES:
        sfx_left[idx] += val * (1.0 - pan * 0.5)
        sfx_right[idx] += val * (1.0 + pan * 0.5)

def add_vo(idx, val, pan=0.0):
    if 0 <= idx < NUM_SAMPLES:
        vo_left[idx] += val * (1.0 - pan * 0.5)
        vo_right[idx] += val * (1.0 + pan * 0.5)

# --- Procedural Synthesizers ---
def synth_bass_thud(start_time, freq=110.0, duration=0.38, gain=0.65):
    start_sample = int(start_time * SAMPLE_RATE)
    num_s = int(duration * SAMPLE_RATE)
    phase = 0.0
    for i in range(num_s):
        t = i / SAMPLE_RATE
        frac = t / duration
        f = freq * math.pow(26.0 / freq, frac)
        phase += 2.0 * math.pi * f / SAMPLE_RATE
        decay = gain * math.pow(0.001 / gain, frac)
        add_sfx(start_sample + i, math.sin(phase) * decay)

def synth_red_sting(start_time, duration=0.28, gain=0.55):
    start_sample = int(start_time * SAMPLE_RATE)
    num_s = int(duration * SAMPLE_RATE)
    phase = 0.0
    last_val = 0.0
    rc = 1.0 / (2.0 * math.pi * 750.0)
    dt = 1.0 / SAMPLE_RATE
    alpha = dt / (rc + dt)
    for i in range(num_s):
        t = i / SAMPLE_RATE
        frac = t / duration
        f = 160.0 * math.pow(50.0 / 160.0, frac)
        phase += 2.0 * math.pi * f / SAMPLE_RATE
        norm = (phase / (2.0 * math.pi)) % 1.0
        saw = 2.0 * (norm - 0.5)
        last_val = last_val + alpha * (saw - last_val)
        decay = gain * math.pow(0.001 / gain, frac)
        add_sfx(start_sample + i, last_val * decay)

def synth_elevator_buzzer(start_time, duration=0.25, gain=0.45):
    start_sample = int(start_time * SAMPLE_RATE)
    num_s = int(duration * SAMPLE_RATE)
    phase = 0.0
    for i in range(num_s):
        t = i / SAMPLE_RATE
        f = 220.0 if t < 0.12 else 185.0
        phase += 2.0 * math.pi * f / SAMPLE_RATE
        sq = 1.0 if (phase % (2.0 * math.pi)) < math.pi else -1.0
        frac = t / duration
        decay = gain * math.pow(0.001 / gain, frac)
        add_sfx(start_sample + i, sq * decay)

def overlay_sampled_wav(wav_path, start_time, gain=1.0, pan=0.0):
    if not os.path.exists(wav_path):
        return
    with wave.open(wav_path, "rb") as wf:
        n_ch = wf.getnchannels()
        sr = wf.getframerate()
        n_f = wf.getnframes()
        data = wf.readframes(n_f)
        raw = struct.unpack(f"<{n_f * n_ch}h", data)
        start_sample = int(start_time * SAMPLE_RATE)
        ratio = SAMPLE_RATE / float(sr)
        out_len = int(n_f * ratio)
        for i in range(out_len):
            dest = start_sample + i
            if dest >= NUM_SAMPLES:
                break
            src_idx = int(i / ratio)
            if n_ch == 1:
                val = (raw[src_idx] / 32768.0) * gain
                add_sfx(dest, val, pan)
            else:
                l_val = (raw[src_idx * 2] / 32768.0) * gain
                r_val = (raw[src_idx * 2 + 1] / 32768.0) * gain
                if 0 <= dest < NUM_SAMPLES:
                    sfx_left[dest] += l_val
                    sfx_right[dest] += r_val

def speed_up_vo_file(in_wav, out_wav, speed_factor):
    cmd = [
        FFMPEG, "-y", "-i", in_wav,
        "-filter:a", f"atempo={speed_factor:.3f}",
        out_wav
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

def main():
    print("=== Mixing Master Audio V2 (VoxCPM2 Aetheria ID + Punchy Synchronized SFX) ===")

    # 1. Prepare Vo files with tight tempo fitting
    # Target: each scene speech should finish within 4.5 seconds
    vo_specs = [
        (1, 1.48),  # 7.00s -> 4.72s
        (2, 1.48),  # 6.93s -> 4.68s
        (3, 1.60),  # 7.59s -> 4.74s
        (4, 1.65),  # 8.46s -> 5.12s
        (5, 1.42),  # 6.62s -> 4.66s
        (6, 1.35),  # 6.29s -> 4.65s
        (7, 1.60),  # 7.62s -> 4.76s
        (8, 1.50),  # 7.12s -> 4.74s
        (9, 1.65),  # 8.18s -> 4.95s
        (10, 1.48), # 7.00s -> 4.72s
        (11, 1.38), # 6.39s -> 4.63s
        (12, 1.25), # 5.62s -> 4.50s
    ]

    for s_idx, factor in vo_specs:
        raw_vo = f"workspace/public/vo_rust_v2_s{s_idx}.wav"
        fitted_vo = f"workspace/public/vo_rust_v2_s{s_idx}_fitted.wav"
        speed_up_vo_file(raw_vo, fitted_vo, factor)
        
        # Load fitted VO into vo buffer
        scene_start_sec = (s_idx - 1) * 5.0 + 0.15
        with wave.open(fitted_vo, "rb") as wf:
            n_f = wf.getnframes()
            data = wf.readframes(n_f)
            raw = struct.unpack(f"<{n_f}h", data)
            start_sample = int(scene_start_sec * SAMPLE_RATE)
            vo_gain = 1.05
            for i in range(n_f):
                dest = start_sample + i
                if dest >= NUM_SAMPLES:
                    break
                s = (raw[i] / 32768.0) * vo_gain
                add_vo(dest, s)
        print(f"[s{s_idx}] Fitted VO placed at t={scene_start_sec:.2f}s")

    # 2. Build High-Impact Synchronized SFX
    pop_wav = "workspace/public/sfx_pop.wav"
    whoosh_wav = "workspace/public/sfx_whoosh.wav"
    impact_wav = "workspace/public/sfx_impact.wav"
    chime_wav = "workspace/public/sfx_chime.wav"
    typewriter_wav = "workspace/public/sfx_typewriter.wav"
    riser_wav = "workspace/public/sfx_riser.wav"

    # Scene cut transitions (every 5.0 seconds)
    for s in range(12):
        t_cut = s * 5.0
        overlay_sampled_wav(whoosh_wav, t_cut, gain=0.85)
        synth_bass_thud(t_cut + 0.02, freq=105.0 - s * 2, gain=0.75)

    # Element specific SFX cues (matched exactly to visual entrances)
    # Scene 1: Hook (0-5s)
    overlay_sampled_wav(pop_wav, 0.25, gain=1.2, pan=-0.2)
    overlay_sampled_wav(pop_wav, 0.55, gain=1.2, pan=0.2)
    overlay_sampled_wav(whoosh_wav, 0.90, gain=0.7)
    synth_elevator_buzzer(1.20, duration=0.35, gain=0.6)
    overlay_sampled_wav(impact_wav, 1.65, gain=1.0)
    synth_red_sting(1.68, gain=0.7)

    # Scene 2: Graydon & 21 Floors (5-10s)
    overlay_sampled_wav(whoosh_wav, 5.20, gain=0.75)
    overlay_sampled_wav(pop_wav, 5.50, gain=1.1, pan=-0.3)
    overlay_sampled_wav(pop_wav, 6.10, gain=1.1, pan=0.3)
    synth_red_sting(6.50, gain=0.65)
    overlay_sampled_wav(impact_wav, 7.20, gain=0.9)

    # Scene 3: Bug C++ & 70% Vulnerabilities (10-15s)
    overlay_sampled_wav(impact_wav, 10.10, gain=1.1)
    synth_red_sting(10.45, gain=0.7)
    overlay_sampled_wav(typewriter_wav, 11.20, gain=0.9)
    synth_elevator_buzzer(12.00, duration=0.3, gain=0.6)
    overlay_sampled_wav(pop_wav, 13.00, gain=1.2)

    # Scene 4: Dilemma C++ vs GC (15-20s)
    overlay_sampled_wav(pop_wav, 15.60, gain=1.1, pan=-0.4)
    overlay_sampled_wav(pop_wav, 16.50, gain=1.1, pan=0.4)
    synth_red_sting(17.80, gain=0.6)

    # Scene 5: Rust Fungus & Apartment (20-25s)
    overlay_sampled_wav(riser_wav, 20.00, gain=0.65)
    overlay_sampled_wav(pop_wav, 21.20, gain=1.1)
    synth_red_sting(22.40, gain=0.65)
    overlay_sampled_wav(chime_wav, 23.50, gain=0.85)

    # Scene 6: Mozilla & Servo (25-30s)
    overlay_sampled_wav(impact_wav, 25.10, gain=1.0)
    overlay_sampled_wav(whoosh_wav, 26.20, gain=0.8)
    overlay_sampled_wav(chime_wav, 27.50, gain=0.9)

    # Scene 7: Borrow Checker (30-35s)
    overlay_sampled_wav(impact_wav, 30.15, gain=1.2)
    synth_red_sting(31.20, gain=0.75)
    overlay_sampled_wav(chime_wav, 33.00, gain=1.0)

    # Scene 8: Zero-cost Abstraction (35-40s)
    overlay_sampled_wav(whoosh_wav, 35.10, gain=0.9)
    overlay_sampled_wav(impact_wav, 36.20, gain=1.1)
    synth_red_sting(37.50, gain=0.7)

    # Scene 9: 8 Years Loved (40-45s)
    overlay_sampled_wav(chime_wav, 40.15, gain=1.2)
    overlay_sampled_wav(impact_wav, 41.20, gain=1.0)
    overlay_sampled_wav(pop_wav, 42.00, gain=1.1, pan=-0.3)
    overlay_sampled_wav(pop_wav, 42.40, gain=1.1, pan=0.0)
    overlay_sampled_wav(pop_wav, 42.80, gain=1.1, pan=0.3)

    # Scene 10: Linux Kernel, Android, Windows, Cloudflare (45-50s)
    overlay_sampled_wav(impact_wav, 45.10, gain=1.1)
    overlay_sampled_wav(pop_wav, 45.80, gain=1.2, pan=-0.4)
    overlay_sampled_wav(pop_wav, 46.60, gain=1.2, pan=-0.15)
    overlay_sampled_wav(pop_wav, 47.40, gain=1.2, pan=0.15)
    overlay_sampled_wav(pop_wav, 48.20, gain=1.2, pan=0.4)
    synth_red_sting(48.50, gain=0.7)

    # Scene 11: AI Infra & Discord (50-55s)
    overlay_sampled_wav(whoosh_wav, 50.10, gain=0.85)
    overlay_sampled_wav(pop_wav, 50.80, gain=1.2)
    overlay_sampled_wav(pop_wav, 51.60, gain=1.2)
    overlay_sampled_wav(impact_wav, 52.80, gain=1.1)
    overlay_sampled_wav(chime_wav, 53.50, gain=0.9)

    # Scene 12: Call To Action & Cargo Run (55-60s)
    overlay_sampled_wav(whoosh_wav, 55.05, gain=0.8)
    overlay_sampled_wav(typewriter_wav, 56.20, gain=1.0)
    overlay_sampled_wav(impact_wav, 57.50, gain=1.2)
    synth_red_sting(57.80, gain=0.8)
    overlay_sampled_wav(chime_wav, 58.50, gain=1.3)

    # 3. Master Mixing (Ducking & Normalization)
    print("Normalizing and mixing VO + SFX with headroom...")
    master_left = [0.0] * NUM_SAMPLES
    master_right = [0.0] * NUM_SAMPLES

    for i in range(NUM_SAMPLES):
        # Slightly duck SFX by 15% when VO is active so voice stays 100% intelligible
        vo_amp = (abs(vo_left[i]) + abs(vo_right[i])) * 0.5
        duck = 1.0 - min(0.20, vo_amp * 0.3)
        master_left[i] = vo_left[i] + sfx_left[i] * duck
        master_right[i] = vo_right[i] + sfx_right[i] * duck

    # Normalize to -1.0 dB FS (peak = 0.89)
    peak = max(max(abs(l) for l in master_left), max(abs(r) for r in master_right))
    print(f"Pre-norm peak: {peak:.3f}")
    if peak > 0.001:
        norm_factor = 0.89 / peak
        for i in range(NUM_SAMPLES):
            master_left[i] *= norm_factor
            master_right[i] *= norm_factor

    # Convert to 16-bit PCM
    out_samples = []
    for i in range(NUM_SAMPLES):
        l_s = int(max(-32768, min(32767, master_left[i] * 32767.0)))
        r_s = int(max(-32768, min(32767, master_right[i] * 32767.0)))
        out_samples.extend([l_s, r_s])

    out_data = struct.pack(f"<{NUM_SAMPLES * 2}h", *out_samples)
    out_wav = "workspace/public/rust_master_audio.wav"
    with wave.open(out_wav, "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(out_data)

    print(f"Master audio successfully written: {out_wav} ({TOTAL_DURATION:.2f}s, stereo 48kHz)")

if __name__ == "__main__":
    main()


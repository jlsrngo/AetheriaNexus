import math
import random
import struct
import wave

SAMPLE_RATE = 48000
TOTAL_DURATION = 60.0
NUM_SAMPLES = int(SAMPLE_RATE * TOTAL_DURATION)

# Stereo float buffer
left = [0.0] * NUM_SAMPLES
right = [0.0] * NUM_SAMPLES

def add_sample(idx, val, pan=0.0):
    if 0 <= idx < NUM_SAMPLES:
        left[idx] += val * (1.0 - pan * 0.5)
        right[idx] += val * (1.0 + pan * 0.5)

def play_bass_thud(start_time, freq=95.0, duration=0.38):
    start_sample = int(start_time * SAMPLE_RATE)
    num_s = int(duration * SAMPLE_RATE)
    phase = 0.0
    for i in range(num_s):
        t = i / SAMPLE_RATE
        frac = t / duration
        # Exponential freq ramp from freq to 26
        f = freq * math.pow(26.0 / freq, frac)
        phase += 2.0 * math.pi * f / SAMPLE_RATE
        # Gain exponential decay
        gain = 0.4 * math.pow(0.001 / 0.4, frac)
        s = math.sin(phase) * gain
        add_sample(start_sample + i, s)

def play_text_pop(start_time, pitch=520.0, duration=0.065):
    start_sample = int(start_time * SAMPLE_RATE)
    num_s = int(duration * SAMPLE_RATE)
    phase = 0.0
    for i in range(num_s):
        t = i / SAMPLE_RATE
        frac = t / duration
        f = pitch * math.pow(0.45, frac)
        phase += 2.0 * math.pi * f / SAMPLE_RATE
        # Triangle wave: 2 * abs(2 * (phase / 2pi - floor(phase / 2pi + 0.5))) - 1
        norm_phase = (phase / (2.0 * math.pi)) % 1.0
        tri = 2.0 * abs(2.0 * norm_phase - 1.0) - 1.0
        gain = 0.16 * math.pow(0.001 / 0.16, frac)
        add_sample(start_sample + i, tri * gain)

def play_red_accent_sting(start_time, duration=0.26):
    start_sample = int(start_time * SAMPLE_RATE)
    num_s = int(duration * SAMPLE_RATE)
    phase = 0.0
    # Simple 1-pole lowpass filter memory
    last_val = 0.0
    # rc for 680Hz
    rc = 1.0 / (2.0 * math.pi * 680.0)
    dt = 1.0 / SAMPLE_RATE
    alpha = dt / (rc + dt)
    
    for i in range(num_s):
        t = i / SAMPLE_RATE
        frac = t / duration
        f = 145.0 * math.pow(52.0 / 145.0, frac)
        phase += 2.0 * math.pi * f / SAMPLE_RATE
        # Sawtooth wave: 2 * (phase / 2pi - floor(0.5 + phase / 2pi))
        norm = (phase / (2.0 * math.pi)) % 1.0
        saw = 2.0 * (norm - 0.5)
        # Lowpass filter
        last_val = last_val + alpha * (saw - last_val)
        gain = 0.18 * math.pow(0.001 / 0.18, frac)
        add_sample(start_sample + i, last_val * gain)

def play_elevator_buzzer(start_time, duration=0.22):
    start_sample = int(start_time * SAMPLE_RATE)
    num_s = int(duration * SAMPLE_RATE)
    phase = 0.0
    for i in range(num_s):
        t = i / SAMPLE_RATE
        f = 220.0 if t < 0.09 else 185.0
        phase += 2.0 * math.pi * f / SAMPLE_RATE
        sq = 1.0 if (phase % (2.0 * math.pi)) < math.pi else -1.0
        frac = t / duration
        gain = 0.09 * math.pow(0.001 / 0.09, frac)
        add_sample(start_sample + i, sq * gain)

def play_whoosh(start_time, duration=0.28, peak_freq=950.0):
    start_sample = int(start_time * SAMPLE_RATE)
    num_s = int(duration * SAMPLE_RATE)
    # Bandpass filter state
    y1 = 0.0
    y2 = 0.0
    x1 = 0.0
    x2 = 0.0
    
    for i in range(num_s):
        t = i / SAMPLE_RATE
        # Noise
        noise = random.uniform(-1.0, 1.0)
        # Center freq sweep 180 -> peak_freq -> 200
        if t < duration * 0.5:
            fc = 180.0 * math.pow(peak_freq / 180.0, t / (duration * 0.5))
        else:
            fc = peak_freq * math.pow(200.0 / peak_freq, (t - duration * 0.5) / (duration * 0.5))
        
        # Simple resonant bandpass approx
        w0 = 2.0 * math.pi * fc / SAMPLE_RATE
        q = 2.2
        alpha = math.sin(w0) / (2.0 * q)
        b0 = alpha
        b1 = 0.0
        b2 = -alpha
        a0 = 1.0 + alpha
        a1 = -2.0 * math.cos(w0)
        a2 = 1.0 - alpha
        
        filtered = (b0/a0)*noise + (b1/a0)*x1 + (b2/a0)*x2 - (a1/a0)*y1 - (a2/a0)*y2
        x2 = x1
        x1 = noise
        y2 = y1
        y1 = filtered
        
        # Gain ramp
        if t < duration * 0.45:
            gain = 0.01 + (0.22 - 0.01) * (t / (duration * 0.45))
        else:
            frac = (t - duration * 0.45) / (duration * 0.55)
            gain = 0.22 * math.pow(0.001 / 0.22, frac)
        
        add_sample(start_sample + i, filtered * gain)

# AUDIO_CUES from HTML
cues = [
    # Scene 1 (0 - 5s)
    (0.05, lambda: play_whoosh(0.05, 0.3, 850)),
    (0.35, lambda: play_text_pop(0.35, 480)),
    (0.95, lambda: play_elevator_buzzer(0.95)),
    (1.65, lambda: play_red_accent_sting(1.65)),
    # Scene 2 (5 - 10s)
    (5.00, lambda: (play_bass_thud(5.00, 110, 0.4), play_whoosh(5.00, 0.25, 1100))),
    (5.45, lambda: play_text_pop(5.45, 520)),
    (6.10, lambda: play_red_accent_sting(6.10)),
    (7.20, lambda: play_text_pop(7.20, 420)),
    # Scene 3 (10 - 15s)
    (10.00, lambda: play_bass_thud(10.00, 95, 0.4)),
    (10.45, lambda: play_red_accent_sting(10.45)),
    (11.40, lambda: play_text_pop(11.40, 500)),
    (12.10, lambda: play_red_accent_sting(12.10)),
    # Scene 4 (15 - 20s)
    (15.00, lambda: play_whoosh(15.00, 0.3, 1200)),
    (15.60, lambda: play_bass_thud(15.60, 120, 0.28)),
    (16.30, lambda: play_text_pop(16.30, 520)),
    (17.00, lambda: play_text_pop(17.00, 580)),
    (17.70, lambda: play_text_pop(17.70, 660)),
    # Scene 5 (20 - 25s)
    (20.00, lambda: play_whoosh(20.00, 0.3, 950)),
    (20.60, lambda: play_red_accent_sting(20.60)),
    (21.60, lambda: play_text_pop(21.60, 540)),
    # Scene 6 (25 - 30s)
    (25.00, lambda: play_bass_thud(25.00, 100, 0.38)),
    (25.50, lambda: play_text_pop(25.50, 600)),
    (26.80, lambda: play_red_accent_sting(26.80)),
    # Scene 7 (30 - 35s)
    (30.00, lambda: play_whoosh(30.00, 0.28, 1100)),
    (30.70, lambda: play_bass_thud(30.70, 130, 0.25)),
    (31.30, lambda: play_red_accent_sting(31.30)),
    # Scene 8 (35 - 40s)
    (35.00, lambda: play_whoosh(35.00, 0.32, 1250)),
    (35.60, lambda: play_text_pop(35.60, 620)),
    (36.50, lambda: play_red_accent_sting(36.50)),
    # Scene 9 (40 - 45s)
    (40.00, lambda: play_bass_thud(40.00, 95, 0.4)),
    (40.60, lambda: play_red_accent_sting(40.60)),
    (41.60, lambda: play_text_pop(41.60, 680)),
    # Scene 10 (45 - 50s)
    (45.00, lambda: play_whoosh(45.00, 0.3, 1050)),
    (45.60, lambda: play_text_pop(45.60, 720)),
    # Scene 11 (50 - 55s)
    (50.00, lambda: play_bass_thud(50.00, 105, 0.35)),
    (50.60, lambda: play_text_pop(50.60, 540)),
    (51.20, lambda: play_text_pop(51.20, 600)),
    (51.80, lambda: play_red_accent_sting(51.80)),
    # Scene 12 (55 - 60s)
    (55.00, lambda: play_whoosh(55.00, 0.28, 1000)),
    (55.70, lambda: play_red_accent_sting(55.70)),
    (57.50, lambda: play_bass_thud(57.50, 80, 0.5)),
    (58.10, lambda: play_red_accent_sting(58.10))
]

print("Synthesizing audio cues...")
for t, fn in cues:
    fn()

out_path = "workspace/public/rust_history_sfx.wav"
print(f"Writing 60s stereo audio to {out_path}...")
with wave.open(out_path, "wb") as wf:
    wf.setnchannels(2)
    wf.setsampwidth(2)
    wf.setframerate(SAMPLE_RATE)
    frames = bytearray()
    for i in range(NUM_SAMPLES):
        # Clip to -1.0 .. 1.0 and convert to 16-bit PCM
        l_val = max(-1.0, min(1.0, left[i]))
        r_val = max(-1.0, min(1.0, right[i]))
        l_int = int(l_val * 32767)
        r_int = int(r_val * 32767)
        frames.extend(struct.pack("<hh", l_int, r_int))
    wf.writeframes(frames)

print("Done! rust_history_sfx.wav generated successfully.")


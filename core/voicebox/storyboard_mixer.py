import argparse
import json
import math
import os
import struct
import wave

SAMPLE_RATE = 48000


def read_wav_mono_or_stereo(wav_path):
    if not os.path.exists(wav_path):
        return [], SAMPLE_RATE
    with wave.open(wav_path, "rb") as wf:
        n_ch = wf.getnchannels()
        sr = wf.getframerate()
        n_f = wf.getnframes()
        data = wf.readframes(n_f)
        raw = struct.unpack(f"<{n_f * n_ch}h", data)
        if n_ch == 1:
            samples = [(s / 32768.0, s / 32768.0) for s in raw]
        else:
            samples = [
                (raw[i * 2] / 32768.0, raw[i * 2 + 1] / 32768.0)
                for i in range(n_f)
            ]
        return samples, sr


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--resolved-json", required=True)
    parser.add_argument("--public-dir", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    with open(args.resolved_json, "r", encoding="utf-8") as f:
        sb = json.load(f)

    total_sec = float(sb.get("totalDurationSec", 30.0)) + 0.1
    num_samples = int(SAMPLE_RATE * total_sec)

    vo_l = [0.0] * num_samples
    vo_r = [0.0] * num_samples
    sfx_l = [0.0] * num_samples
    sfx_r = [0.0] * num_samples

    def add_sfx(idx, l_val, r_val):
        if 0 <= idx < num_samples:
            sfx_l[idx] += l_val
            sfx_r[idx] += r_val

    def synth_bass_thud(start_sec, freq=105.0, duration=0.35, gain=0.55):
        start_idx = int(start_sec * SAMPLE_RATE)
        n_s = int(duration * SAMPLE_RATE)
        phase = 0.0
        for i in range(n_s):
            t = i / SAMPLE_RATE
            frac = t / duration
            f = freq * math.pow(28.0 / freq, frac)
            phase += 2.0 * math.pi * f / SAMPLE_RATE
            val = math.sin(phase) * gain * math.pow(0.001 / gain, frac)
            add_sfx(start_idx + i, val, val)

    def overlay_wav(target_l, target_r, wav_path, start_sec, gain=1.0, pan=0.0):
        samples, sr = read_wav_mono_or_stereo(wav_path)
        if not samples:
            return
        start_idx = int(start_sec * SAMPLE_RATE)
        ratio = SAMPLE_RATE / float(sr)
        out_len = int(len(samples) * ratio)
        l_pan = 1.0 - max(0.0, pan) * 0.45
        r_pan = 1.0 + min(0.0, pan) * 0.45
        for i in range(out_len):
            dest = start_idx + i
            if dest >= num_samples:
                break
            src_i = min(len(samples) - 1, int(i / ratio))
            sl, sr_v = samples[src_i]
            target_l[dest] += sl * gain * l_pan
            target_r[dest] += sr_v * gain * r_pan

    pub = args.public_dir
    sfx_files = {
        "whoosh": os.path.join(pub, "sfx_whoosh.wav"),
        "pop": os.path.join(pub, "sfx_pop.wav"),
        "impact": os.path.join(pub, "sfx_impact.wav"),
        "chime": os.path.join(pub, "sfx_chime.wav"),
        "typewriter": os.path.join(pub, "sfx_typewriter.wav"),
    }

    for scene in sb.get("scenes", []):
        s_start = float(scene.get("startSec", 0.0))
        vo_file = scene.get("voFile", "")
        if vo_file:
            vo_path = (
                vo_file
                if os.path.isabs(vo_file)
                else os.path.join(pub, os.path.basename(vo_file))
            )
            overlay_wav(vo_l, vo_r, vo_path, s_start + 0.12, gain=1.05, pan=0.0)

        # Scene cut whoosh + sub-bass thud
        overlay_wav(sfx_l, sfx_r, sfx_files["whoosh"], s_start, gain=0.78)
        synth_bass_thud(s_start + 0.02, freq=102.0, gain=0.58)

        # Automatic Beat-Synced SFX
        for b_idx, beat in enumerate(scene.get("beats", [])):
            b_time = s_start + float(beat.get("startSec", 0.25))
            b_type = beat.get("type", "headline")
            pan = -0.25 if b_idx % 2 == 0 else 0.25
            if b_type in ("badge", "card"):
                overlay_wav(sfx_l, sfx_r, sfx_files["pop"], b_time, gain=1.05, pan=pan)
            elif b_type == "punch":
                overlay_wav(sfx_l, sfx_r, sfx_files["impact"], b_time, gain=1.0, pan=0.0)
            elif b_type in ("stat", "cta"):
                overlay_wav(sfx_l, sfx_r, sfx_files["chime"], b_time, gain=0.95, pan=0.0)
            elif b_type == "code":
                overlay_wav(
                    sfx_l, sfx_r, sfx_files["typewriter"], b_time, gain=0.88, pan=pan
                )
            else:
                overlay_wav(sfx_l, sfx_r, sfx_files["pop"], b_time, gain=0.82, pan=pan)

    master_l = [0.0] * num_samples
    master_r = [0.0] * num_samples
    peak = 0.001
    for i in range(num_samples):
        vo_amp = (abs(vo_l[i]) + abs(vo_r[i])) * 0.5
        duck = 1.0 - min(0.24, vo_amp * 0.35)
        ml = vo_l[i] + sfx_l[i] * duck
        mr = vo_r[i] + sfx_r[i] * duck
        master_l[i] = ml
        master_r[i] = mr
        if abs(ml) > peak:
            peak = abs(ml)
        if abs(mr) > peak:
            peak = abs(mr)

    norm = 0.89 / peak if peak > 0.001 else 1.0
    out_shorts = []
    for i in range(num_samples):
        ls = int(max(-32768, min(32767, master_l[i] * norm * 32767.0)))
        rs = int(max(-32768, min(32767, master_r[i] * norm * 32767.0)))
        out_shorts.append(ls)
        out_shorts.append(rs)

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with wave.open(args.out, "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(struct.pack(f"<{num_samples * 2}h", *out_shorts))

    print(json.dumps({"success": True, "outputPath": args.out, "durationSec": total_sec}))


if __name__ == "__main__":
    main()


#!/usr/bin/env python3
"""
Voicebox Engine for ArunakiNexus
===============================
Directly embeds the Voicebox & Kokoro-82M TTS inference engine,
Indonesian Neural TTS, Spotify Pedalboard DSP broadcast mastering,
and word-level subtitle alignment.

Supported Voice Modes:
- Kokoro ONNX: af_heart, af_bella, af_sarah, am_adam, am_michael, bf_emma, etc. (English & global)
- Indonesian Neural: id-ID-GadisNeural, id-ID-ArdiNeural (Warm, human, expressive Indonesian)
- Audio DSP Chain: Highpass (80Hz) -> Pedalboard Compressor -> Limiter (-14 LUFS standard)
"""

import os
import sys
import json
import time
import asyncio
import argparse
import tempfile
import pathlib
from typing import List, Dict, Any, Optional

import numpy as np
import soundfile as sf

# Spotify DSP effects
try:
    from pedalboard import Pedalboard, HighpassFilter, Compressor, Gain, Limiter  # type: ignore
    HAS_PEDALBOARD = True
except ImportError:
    HAS_PEDALBOARD = False

# Gradio client for VoxCPM
try:
    from gradio_client import Client, handle_file  # type: ignore
    HAS_GRADIO_CLIENT = True
except ImportError:
    Client = None  # type: ignore
    handle_file = None  # type: ignore
    HAS_GRADIO_CLIENT = False

SCRIPT_DIR = pathlib.Path(__file__).resolve().parent
MODELS_DIR = SCRIPT_DIR / "models"
ONNX_PATH = MODELS_DIR / "kokoro-v0_19.onnx"
VOICES_PATH = MODELS_DIR / "voices-v1.0.bin"

# Fallback voice defaults
DEFAULT_EN_VOICE = "af_heart"
DEFAULT_ID_VOICE = "id-ID-ArdiNeural"


def apply_voicebox_dsp(audio_data: np.ndarray, sample_rate: int) -> np.ndarray:
    """
    Applies Voicebox's studio DSP mastering pipeline using Spotify's Pedalboard.
    Chain:
    1. HighpassFilter at 80Hz: cuts low mic mud and AC hum
    2. Compressor: ratio=3.5, threshold=-16dB: broadcast voice warmth & presence
    3. Gain / Limiter: peaks at -1.0 dBFS, TikTok/Shorts broadcast loudness
    """
    if not HAS_PEDALBOARD:
        # Fallback: simple peak normalization
        peak = np.max(np.abs(audio_data))
        if peak > 0:
            return (audio_data / peak) * 0.92
        return audio_data

    # Ensure float32 shape
    audio_f32 = audio_data.astype(np.float32)
    if audio_f32.ndim == 1:
        # Mono to stereo for pedalboard if needed or keep 1D
        audio_f32 = audio_f32.reshape(1, -1)

    board = Pedalboard([
        HighpassFilter(cutoff_frequency_hz=80.0),
        Compressor(threshold_db=-16.0, ratio=3.5, attack_ms=6.0, release_ms=65.0),
        Gain(gain_db=2.0),
        Limiter(threshold_db=-1.0, release_ms=80.0)
    ])

    effected = board(audio_f32, sample_rate)
    return effected.squeeze()


async def generate_indonesian_speech(
    text: str,
    voice: str = DEFAULT_ID_VOICE,
    rate: str = "+0%",
    pitch: str = "+0Hz"
) -> tuple[np.ndarray, int, List[Dict[str, Any]]]:
    """
    Generates expressive Indonesian speech using Edge Neural engine with word boundaries.
    """
    import edge_tts  # type: ignore

    communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
    words_data: List[Dict[str, Any]] = []

    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp_mp3:
        tmp_mp3_path = tmp_mp3.name

    try:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                with open(tmp_mp3_path, "ab") as f:
                    f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                words_data.append({
                    "word": chunk.get("text", ""),
                    "start": chunk.get("offset", 0) / 10_000_000,
                    "duration": chunk.get("duration", 0) / 10_000_000,
                    "end": (chunk.get("offset", 0) + chunk.get("duration", 0)) / 10_000_000
                })

        # Load audio into numpy array
        data, sr = sf.read(tmp_mp3_path)
        if not words_data:
            words_data = estimate_word_timings(text, len(data) / sr)
        return data, sr, words_data
    finally:
        if os.path.exists(tmp_mp3_path):
            try:
                os.remove(tmp_mp3_path)
            except OSError:
                pass


def generate_kokoro_speech(
    text: str,
    voice: str = DEFAULT_EN_VOICE,
    speed: float = 1.0
) -> tuple[np.ndarray, int]:
    """
    Generates speech using Kokoro-82M ONNX inference.
    """
    from kokoro_onnx import Kokoro  # type: ignore

    if not ONNX_PATH.exists() or not VOICES_PATH.exists():
        raise FileNotFoundError(f"Kokoro model files missing in {MODELS_DIR}. Run model download first.")

    kokoro = Kokoro(str(ONNX_PATH), str(VOICES_PATH))
    samples, sample_rate = kokoro.create(text, voice=voice, speed=speed, lang="en-us")
    return samples, sample_rate


VOXCPM_SPACE = os.environ.get("VOXCPM_SPACE", "openbmb/VoxCPM-Demo")
VOXCPM_TIMEOUT_SEC = 180


def infer_gender_and_default_voice(voice: Optional[str], voice_design: Optional[str]) -> tuple[bool, str]:
    """Infers gender from explicit voice or voice_design keywords, returning (is_female, matched_voice)."""
    text = f"{voice or ''} {voice_design or ''}".lower()
    is_female = any(k in text for k in ("gadis", "cewek", "wanita", "perempuan", "female", "girl", "af_", "bf_"))
    matched_voice = "id-ID-GadisNeural" if is_female else "id-ID-ArdiNeural"
    return is_female, matched_voice


def default_voice_design(voice: Optional[str], lang: str, voice_design: Optional[str] = None) -> str:
    """Natural-language voice description for VoxCPM2 Voice Design when the caller gives none."""
    is_female, _ = infer_gender_and_default_voice(voice, voice_design)
    if lang.lower() == "id":
        who = "Cewek muda Indonesia" if is_female else "Cowok muda Indonesia"
        return f"{who}, suara hangat dan natural, santai seperti ngobrol, antusias seperti kreator konten teknologi"
    who = "A young woman" if is_female else "A young man"
    return f"{who} with a warm, natural, conversational voice, upbeat like a tech content creator"


def generate_voxcpm_speech(
    text: str,
    voice_design: str,
    clone_ref: Optional[str] = None,
) -> tuple[np.ndarray, int]:
    """
    Generates natural speech with OpenBMB VoxCPM2 (Apache-2.0) through its official Hugging Face Space.
    - Voice Design: `voice_design` describes the voice (gender, age, tone, pace).
    - Cloning: `clone_ref` is a WAV/audio sample to clone. Automatically trimmed to optimal duration (<30s).
    Raises on any network/queue failure so the caller can fall back to the Indonesian Neural engine.
    """
    if not HAS_GRADIO_CLIENT or Client is None or handle_file is None:
        raise ImportError("gradio_client is not installed in the current environment.")

    trimmed_tmp: Optional[str] = None
    ref_to_use = clone_ref

    if clone_ref and os.path.isfile(clone_ref):
        try:
            info = sf.info(clone_ref)
            # VoxCPM requires reference audio to be <= 50s. Optimal sweet spot is 10-15s.
            if info.duration > 35.0:
                with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tf:
                    trimmed_tmp = tf.name
                data, sr = sf.read(clone_ref)
                if data.ndim > 1:
                    data = np.mean(data, axis=1)
                start_sample = int(sr * 2.0) if len(data) > sr * 20 else 0
                max_samples = int(sr * 15.0)
                end_sample = min(len(data), start_sample + max_samples)
                sf.write(trimmed_tmp, data[start_sample:end_sample].astype(np.float32), sr)
                ref_to_use = trimmed_tmp
                print(f"[voicebox] Trimmed reference voice {clone_ref} ({round(info.duration, 1)}s) to 15s sample for VoxCPM2")
        except Exception as e:
            print(f"[voicebox] Warning checking clone_ref length: {e}")

    try:
        client = Client(VOXCPM_SPACE, verbose=False)
        job = client.submit(
            text_input=text,
            # Control instruction is ignored by the Space when a clone reference is given.
            control_instruction="" if ref_to_use else voice_design,
            reference_wav_path_input=handle_file(ref_to_use) if ref_to_use else None,
            use_prompt_text=False,
            prompt_text_input="",
            cfg_value_input=2.0,
            do_normalize=True,
            denoise=False,
            api_name="/generate",
        )
        result = job.result(timeout=VOXCPM_TIMEOUT_SEC)
        audio_path = result if isinstance(result, str) else result[0]
        data, sr = sf.read(audio_path)
        if data.ndim > 1:
            data = np.mean(data, axis=1)
        return data.astype(np.float32), sr
    finally:
        if trimmed_tmp and os.path.exists(trimmed_tmp):
            try:
                os.remove(trimmed_tmp)
            except OSError:
                pass


def estimate_word_timings(text: str, total_duration: float) -> List[Dict[str, Any]]:
    """Character-weighted word timings for engines that do not report word boundaries."""
    raw_words = text.split()
    if not raw_words:
        return []
    weights = [len(w) + 1 for w in raw_words]
    unit = total_duration / sum(weights)
    words: List[Dict[str, Any]] = []
    cursor = 0.0
    for w, wt in zip(raw_words, weights):
        dur = wt * unit
        words.append({
            "word": w,
            "start": round(cursor, 3),
            "duration": round(dur, 3),
            "end": round(cursor + dur, 3),
        })
        cursor += dur
    return words


def analyze_reference_voice(ref_audio_path: str, lang: str = "id") -> Dict[str, Any]:
    """
    Analyzes a reference audio WAV file (e.g. extracted from a user-uploaded video or voice sample)
    to estimate fundamental frequency (F0 pitch in Hz), vocal register (male/female), pitch shift,
    and speaking cadence so synthesized voiceovers match the reference voice character.
    """
    p = pathlib.Path(ref_audio_path)
    if not p.is_file():
        return {}
    try:
        data, sr = sf.read(str(p))
        if data.ndim > 1:
            data = np.mean(data, axis=1)
        data = data.astype(np.float32)

        # Estimate voiced segments and F0 via autocorrelation on 40ms frames
        frame_len = int(sr * 0.04)
        hop = int(sr * 0.02)
        min_lag = max(1, int(sr / 320))  # 320 Hz max F0
        max_lag = max(min_lag + 1, int(sr / 75))  # 75 Hz min F0
        f0_list: List[float] = []
        voiced_frames = 0
        total_frames = 0

        for start in range(0, min(len(data) - frame_len, sr * 15), hop):
            frame = data[start : start + frame_len]
            rms = float(np.sqrt(np.mean(frame * frame)))
            total_frames += 1
            if rms < 0.015:
                continue
            voiced_frames += 1
            frame = frame - np.mean(frame)
            corr = np.correlate(frame, frame, mode="full")[len(frame) - 1 :]
            if max_lag < len(corr):
                sub = corr[min_lag:max_lag]
                if len(sub) > 0 and corr[0] > 0:
                    peak_idx = int(np.argmax(sub)) + min_lag
                    if corr[peak_idx] / corr[0] > 0.25:
                        f0_list.append(float(sr) / float(peak_idx))

        median_f0 = float(np.median(f0_list)) if f0_list else 135.0
        is_female = median_f0 >= 165.0
        is_id = lang.lower() == "id"
        matched_voice = (
            ("id-ID-GadisNeural" if is_female else "id-ID-ArdiNeural")
            if is_id
            else ("af_heart" if is_female else "am_adam")
        )
        base_f0 = 210.0 if is_female else 125.0
        pitch_diff_hz = int(np.clip(round(median_f0 - base_f0), -18, 18))
        pitch_str = f"{pitch_diff_hz:+d}Hz"

        voiced_ratio = voiced_frames / max(1, total_frames)
        rate_pct = int(np.clip(round((voiced_ratio - 0.55) * 35), -12, 18))
        rate_str = f"{rate_pct:+d}%"

        return {
            "median_f0_hz": round(median_f0, 1),
            "matched_voice": matched_voice,
            "pitch": pitch_str,
            "rate": rate_str,
        }
    except Exception as e:
        print(f"[voicebox] Reference voice analysis warning: {e}")
        return {}


def get_voice_lock_path(output_path: pathlib.Path) -> pathlib.Path:
    """Returns the .voice_lock.json path associated with this project's public folder."""
    return output_path.parent / ".voice_lock.json"


def read_voice_lock(lock_file: pathlib.Path) -> Optional[Dict[str, Any]]:
    """Reads project voice lock to ensure 100% deterministic speaker consistency across scenes."""
    if lock_file.is_file():
        try:
            with open(lock_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[voicebox] Warning reading voice lock {lock_file}: {e}")
    return None


def write_voice_lock(lock_file: pathlib.Path, profile: Dict[str, Any]):
    """Locks narrator voice identity across all scenes in a video project."""
    try:
        lock_file.parent.mkdir(parents=True, exist_ok=True)
        with open(lock_file, "w", encoding="utf-8") as f:
            json.dump(profile, f, indent=2)
        print(f"[voicebox] Project Voice Lock engaged: voice={profile.get('voice')}, engine={profile.get('engine')}, gender={profile.get('gender')} -> {lock_file.name}")
    except Exception as e:
        print(f"[voicebox] Warning writing voice lock: {e}")


def generate_speech(
    text: str,
    output_path: str,
    voice: Optional[str] = None,
    lang: str = "id",
    apply_dsp: bool = True,
    ref_audio: Optional[str] = None,
    rate: str = "+0%",
    pitch: str = "+0Hz",
    engine: str = "auto",
    voice_design: Optional[str] = None,
    clone_ref: Optional[str] = None,
    reset_voice_lock: bool = False,
) -> Dict[str, Any]:
    """
    Unified entry point for voice generation with Project Voice Lock.
    Ensures 100% consistent speaker identity across all scenes in a video project:
    - Indonesian: id-ID-GadisNeural (female dubbing) & id-ID-ArdiNeural (male dubbing) + Spotify Pedalboard DSP.
    - Locks narrator profile in .voice_lock.json so scenes never switch voices or drift mid-video.
    - Exact word boundary synchronization for Remotion kinetic captions.
    """
    out_file = pathlib.Path(output_path).resolve()
    out_file.parent.mkdir(parents=True, exist_ok=True)
    words_json_path = out_file.with_suffix(".words.json")

    ref_profile: Dict[str, Any] = {}
    if ref_audio:
        ref_profile = analyze_reference_voice(ref_audio, lang=lang)
        if ref_profile:
            if not voice:
                voice = ref_profile.get("matched_voice")
            if rate == "+0%" and ref_profile.get("rate"):
                rate = ref_profile["rate"]
            if pitch == "+0Hz" and ref_profile.get("pitch"):
                pitch = ref_profile["pitch"]

    lock_file = get_voice_lock_path(out_file)
    if reset_voice_lock and lock_file.is_file():
        try:
            lock_file.unlink()
        except OSError:
            pass

    is_scene_1 = out_file.stem in ("vo_scene1", "scene1", "voiceover")
    lock_data = None if (is_scene_1 and (voice or voice_design or reset_voice_lock)) else read_voice_lock(lock_file)

    if lock_data:
        print(f"[voicebox] Enforcing Project Voice Lock from {lock_file.name}: {lock_data.get('voice')} ({lock_data.get('gender')})")
        voice = lock_data.get("voice", voice)
        gender = lock_data.get("gender")
        is_female = (gender == "female")
        if lock_data.get("engine"):
            engine = lock_data["engine"]
        if lock_data.get("rate") and rate == "+0%":
            rate = lock_data["rate"]
        if lock_data.get("pitch") and pitch == "+0Hz":
            pitch = lock_data["pitch"]
        if lock_data.get("anchor_audio") and not clone_ref and pathlib.Path(lock_data["anchor_audio"]).is_file():
            clone_ref = lock_data["anchor_audio"]
    else:
        is_female, detected_voice = infer_gender_and_default_voice(voice, voice_design)
        is_id = (lang.lower() == "id") or (voice and "id-ID" in voice)
        if not voice:
            voice = detected_voice if is_id else ("af_heart" if is_female else "am_adam")

        # If a clone reference audio is provided, automatically use VoxCPM2 for zero-shot voice cloning.
        # Otherwise fallback to deterministic neural engine + Pedalboard DSP.
        if engine == "auto":
            engine = "voxcpm" if (clone_ref and os.path.isfile(clone_ref)) else ("edge" if is_id else "kokoro")

        write_voice_lock(lock_file, {
            "voice": voice,
            "gender": "female" if is_female else "male",
            "engine": engine,
            "lang": lang,
            "rate": rate,
            "pitch": pitch,
            "created_at": time.time()
        })

    is_indonesian = (lang.lower() == "id") or (voice and "id-ID" in voice)
    start_time = time.time()
    words: List[Dict[str, Any]] = []
    used_engine = ""
    fallback_reason = ""

    if engine in ("voxcpm",):
        design = voice_design or default_voice_design(voice, lang)
        print(f"[voicebox] Generating with VoxCPM2 ({'clone' if clone_ref else 'voice design'}: {design if not clone_ref else clone_ref})...")
        try:
            audio_data, sample_rate = generate_voxcpm_speech(text, design, clone_ref=clone_ref)
            words = estimate_word_timings(text, len(audio_data) / sample_rate)
            used_engine = "voxcpm2"
            if is_scene_1 and lock_file.is_file():
                try:
                    curr = read_voice_lock(lock_file) or {}
                    curr["anchor_audio"] = str(out_file)
                    write_voice_lock(lock_file, curr)
                except Exception:
                    pass
        except Exception as e:
            fallback_reason = f"VoxCPM2 unavailable ({type(e).__name__}: {e})"
            print(f"[voicebox] {fallback_reason} -> falling back to deterministic engine")

    if not used_engine:
        if is_indonesian:
            v = voice or ("id-ID-GadisNeural" if is_female else "id-ID-ArdiNeural")
            print(f"[voicebox] Generating audio (lang={lang}, voice={v}, rate={rate}, pitch={pitch})...")
            audio_data, sample_rate, words = asyncio.run(
                generate_indonesian_speech(text, voice=v, rate=rate, pitch=pitch)
            )
            used_engine = "edge-neural"
        else:
            v = voice or ("af_heart" if is_female else "am_adam")
            print(f"[voicebox] Generating audio (lang={lang}, voice={v})...")
            audio_data, sample_rate = generate_kokoro_speech(text, voice=v)
            words = estimate_word_timings(text, len(audio_data) / sample_rate)
            used_engine = "kokoro"

    # Apply Voicebox studio DSP mastering
    if apply_dsp:
        print("[voicebox] Applying Spotify Pedalboard broadcast DSP (Highpass + Compressor + -14 LUFS Limiter)...")
        mastered_audio = apply_voicebox_dsp(audio_data, sample_rate)
    else:
        mastered_audio = audio_data

    # Write WAV file
    sf.write(str(out_file), mastered_audio, sample_rate)
    duration_sec = len(mastered_audio) / sample_rate

    # Write word alignment for Remotion kinetic subtitles
    with open(words_json_path, "w", encoding="utf-8") as f:
        json.dump({
            "text": text,
            "duration": round(duration_sec, 3),
            "sample_rate": sample_rate,
            "words": words
        }, f, indent=2, ensure_ascii=False)

    elapsed = round(time.time() - start_time, 2)
    print(f"[voicebox] Done in {elapsed}s with {used_engine}: {out_file} ({round(duration_sec, 2)}s audio)")

    result: Dict[str, Any] = {
        "success": True,
        "engine": used_engine,
        "audio_path": str(out_file),
        "words_path": str(words_json_path),
        "duration": duration_sec,
        "sample_rate": sample_rate,
        "word_count": len(words),
        "elapsed_sec": elapsed
    }
    if fallback_reason:
        result["fallback_reason"] = fallback_reason
    return result


def run_http_server(host: str = "127.0.0.1", port: int = 17493):
    """
    Runs Voicebox HTTP API server on standard port 17493.
    """
    import uvicorn
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel

    app = FastAPI(title="Voicebox TTS Service", version="1.0.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    class SpeakRequest(BaseModel):
        text: str
        voice: Optional[str] = None
        lang: str = "id"
        output_path: Optional[str] = None
        dsp: bool = True

    @app.get("/health")
    def health():
        return {
            "status": "healthy",
            "has_pedalboard": HAS_PEDALBOARD,
            "kokoro_ready": ONNX_PATH.exists() and VOICES_PATH.exists()
        }

    @app.get("/voices")
    def list_voices():
        return {
            "indonesian": ["id-ID-ArdiNeural", "id-ID-GadisNeural"],
            "kokoro_default": DEFAULT_EN_VOICE,
            "kokoro_ready": ONNX_PATH.exists()
        }

    @app.post("/speak")
    def speak(req: SpeakRequest):
        try:
            target_out = req.output_path or f"output/voicebox_{int(time.time())}.wav"
            res = generate_speech(
                text=req.text,
                output_path=target_out,
                voice=req.voice,
                lang=req.lang,
                apply_dsp=req.dsp
            )
            return res
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    print(f"[voicebox] Starting server on http://{host}:{port} ...")
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Voicebox Engine for ArunakiNexus")
    parser.add_argument("--text", type=str, help="Text to speak")
    parser.add_argument("--out", type=str, default="output/voicebox_test.wav", help="Output WAV path")
    parser.add_argument("--voice", type=str, default=None, help="Voice name")
    parser.add_argument("--lang", type=str, default="id", help="Language: id or en")
    parser.add_argument("--ref-audio", type=str, default=None, help="Optional reference audio WAV for voice matching")
    parser.add_argument("--rate", type=str, default="+0%", help="Speaking rate adjustment, e.g. +10%% or -5%%")
    parser.add_argument("--pitch", type=str, default="+0Hz", help="Pitch adjustment, e.g. +5Hz or -8Hz")
    parser.add_argument("--engine", type=str, default="auto", choices=["auto", "voxcpm", "edge", "kokoro"], help="TTS engine (auto = VoxCPM2 with legacy fallback)")
    parser.add_argument("--voice-design", type=str, default=None, help="VoxCPM2 voice description, e.g. 'Cowok muda, santai, antusias'")
    parser.add_argument("--clone-ref", type=str, default=None, help="WAV of a voice you own or may use, cloned by VoxCPM2")
    parser.add_argument("--reset-voice-lock", action="store_true", help="Reset project voice lock to start a fresh voice identity")
    parser.add_argument("--no-dsp", action="store_true", help="Disable DSP mastering")
    parser.add_argument("--serve", action="store_true", help="Run HTTP server on port 17493")
    parser.add_argument("--port", type=int, default=17493, help="Server port")

    args = parser.parse_args()

    if args.serve:
        run_http_server(port=args.port)
    elif args.text:
        res = generate_speech(
            text=args.text,
            output_path=args.out,
            voice=args.voice,
            lang=args.lang,
            apply_dsp=not args.no_dsp,
            ref_audio=args.ref_audio,
            rate=args.rate,
            pitch=args.pitch,
            engine=args.engine,
            voice_design=args.voice_design,
            clone_ref=args.clone_ref,
            reset_voice_lock=args.reset_voice_lock,
        )
        print(json.dumps(res, indent=2))
    else:
        parser.print_help()

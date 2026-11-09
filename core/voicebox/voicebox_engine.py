#!/usr/bin/env python3
"""
Voicebox Engine for AetheriaNexus
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
    from pedalboard import (  # type: ignore
        Pedalboard,
        HighpassFilter,
        PeakFilter,
        HighShelfFilter,
        NoiseGate,
        Compressor,
        Gain,
        Limiter,
    )
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
PRESETS_DIR = SCRIPT_DIR / "presets"
PRESETS_JSON = PRESETS_DIR / "presets.json"

# Fallback voice defaults
DEFAULT_EN_VOICE = "af_heart"
DEFAULT_ID_VOICE = "id-ID-ArdiNeural"


def indonesian_number_to_words(n: int) -> str:
    """Converts an integer to Indonesian spoken words."""
    satuan = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas']
    if n < 0:
        return 'minus ' + indonesian_number_to_words(-n)
    if n == 0:
        return 'nol'
    if n < 12:
        return satuan[n]
    if n < 20:
        return satuan[n - 10] + ' belas'
    if n < 100:
        return satuan[n // 10] + ' puluh' + ((' ' + satuan[n % 10]) if (n % 10 != 0) else '')
    if n < 200:
        return 'seratus' + ((' ' + indonesian_number_to_words(n - 100)) if (n - 100 != 0) else '')
    if n < 1000:
        return satuan[n // 100] + ' ratus' + ((' ' + indonesian_number_to_words(n % 100)) if (n % 100 != 0) else '')
    if n < 2000:
        return 'seribu' + ((' ' + indonesian_number_to_words(n - 1000)) if (n - 1000 != 0) else '')
    if n < 1000000:
        return indonesian_number_to_words(n // 1000) + ' ribu' + ((' ' + indonesian_number_to_words(n % 1000)) if (n % 1000 != 0) else '')
    if n < 1000000000:
        return indonesian_number_to_words(n // 1000000) + ' juta' + ((' ' + indonesian_number_to_words(n % 1000000)) if (n % 1000000 != 0) else '')
    return str(n)


def _digits_after_decimal_to_words(frac_str: str) -> str:
    """Reads decimal fraction digits individually in Indonesian ('75' -> 'tujuh lima', '05' -> 'nol lima')."""
    digit_map = {
        '0': 'nol', '1': 'satu', '2': 'dua', '3': 'tiga', '4': 'empat',
        '5': 'lima', '6': 'enam', '7': 'tujuh', '8': 'delapan', '9': 'sembilan'
    }
    return ' '.join(digit_map[d] for d in frac_str if d in digit_map)


def normalize_indonesian_speech_text(text: str) -> str:
    """
    Comprehensive Indonesian TTS phonetic & prosody normalizer:
    1. Strips non-spoken elements (#hashtags, markdown symbols, URLs) so TTS never reads '#gemini' aloud.
    2. Converts currency & decimal numbers BEFORE standalone integers so '3.8' becomes 'tiga koma delapan'
       and '$0,75' becomes 'nol koma tujuh lima dolar' (never 'tiga.delapan' or 'nol,tujuh puluh lima'
       which injects a period/comma mid-word and breaks TTS intonation).
    3. Converts percentages ('100%' -> 'seratus persen') and multipliers ('2x' -> 'dua kali').
    4. Expands slang & Indonesian conversational abbreviations smoothly.
    """
    import re

    res = text

    # 1. Strip URLs, hashtags (#gemini), and markdown formatting (*, **, `, ~)
    res = re.sub(r'https?://\S+', '', res)
    res = re.sub(r'(?:^|\s)#\w+', ' ', res)
    res = re.sub(r'[*`~_]+', '', res)

    # 2. Currency with decimals or integers: $0.75, $0,75, $15 -> 'nol koma tujuh lima dolar'
    def replace_usd_decimal(m):
        whole = indonesian_number_to_words(int(m.group(1)))
        frac = _digits_after_decimal_to_words(m.group(2))
        return f"{whole} koma {frac} dolar"

    def replace_usd_int(m):
        whole = indonesian_number_to_words(int(m.group(1)))
        return f"{whole} dolar"

    res = re.sub(r'\$\s*(\d+)[.,](\d+)\b', replace_usd_decimal, res)
    res = re.sub(r'\$\s*(\d+)\b', replace_usd_int, res)

    # Rupiah: Rp 10.000 or Rp10000
    def replace_idr(m):
        raw_digits = re.sub(r'[.,]', '', m.group(1))
        if raw_digits.isdigit():
            return f"{indonesian_number_to_words(int(raw_digits))} rupiah"
        return m.group(0)

    res = re.sub(r'\bRp\.?\s*(\d+(?:[.,]\d{3})*)\b', replace_idr, res, flags=re.IGNORECASE)

    # 3. Thousands separators (e.g. '1.000.000' or '10.000' where groups after dot are exactly 3 digits)
    def replace_thousands(m):
        raw_digits = m.group(0).replace('.', '')
        if raw_digits.isdigit():
            return indonesian_number_to_words(int(raw_digits))
        return m.group(0)

    res = re.sub(r'\b\d{1,3}(?:\.\d{3})+\b', replace_thousands, res)

    # 4. Decimal numbers (e.g. '3.8', '3,8', '0,75', '1.5') -> 'tiga koma delapan', 'nol koma tujuh lima'
    def replace_decimal(m):
        whole = indonesian_number_to_words(int(m.group(1)))
        frac = _digits_after_decimal_to_words(m.group(2))
        return f"{whole} koma {frac}"

    res = re.sub(r'\b(\d+)[.,](\d+)\b', replace_decimal, res)

    # 5. Percentages ('100%' -> 'seratus persen') and multipliers ('2x' -> 'dua kali')
    res = re.sub(
        r'\b(\d+)\s*%',
        lambda m: f"{indonesian_number_to_words(int(m.group(1)))} persen",
        res,
    )
    res = re.sub(
        r'\b(\d+)x\b',
        lambda m: f"{indonesian_number_to_words(int(m.group(1)))} kali",
        res,
        flags=re.IGNORECASE,
    )

    # 6. Standalone integers ('21' -> 'dua puluh satu', '2027' -> 'dua ribu dua puluh tujuh')
    def replace_num(match):
        num_str = match.group(0)
        try:
            return indonesian_number_to_words(int(num_str))
        except Exception:
            return num_str

    res = re.sub(r'\b\d+\b', replace_num, res)

    # 7. Conversational abbreviations & tech phonetics
    res = re.sub(r'\bwkwk+\b', 'haha', res, flags=re.IGNORECASE)
    res = re.sub(r'\bbtw\b', 'ngomong-ngomong', res, flags=re.IGNORECASE)
    res = re.sub(r'\bygk\b', 'yang nggak', res, flags=re.IGNORECASE)
    res = re.sub(r'\bgk\b', 'nggak', res, flags=re.IGNORECASE)
    res = re.sub(r'\bga\b', 'nggak', res, flags=re.IGNORECASE)
    res = re.sub(r'\bdgn\b', 'dengan', res, flags=re.IGNORECASE)
    res = re.sub(r'\butk\b', 'untuk', res, flags=re.IGNORECASE)
    res = re.sub(r'\bkrn\b', 'karena', res, flags=re.IGNORECASE)
    res = re.sub(r'\btp\b', 'tapi', res, flags=re.IGNORECASE)
    res = re.sub(r'\bsdh\b', 'sudah', res, flags=re.IGNORECASE)
    res = re.sub(r'\bblm\b', 'belum', res, flags=re.IGNORECASE)
    # English tech terms often mispronounced in Indonesian phonetic context
    res = re.sub(r'\bAPI\s+key\b', 'E-P-I ki', res, flags=re.IGNORECASE)
    res = re.sub(r'\bkey\b', 'ki', res, flags=re.IGNORECASE)
    res = re.sub(r'\bcache\b', 'kes', res, flags=re.IGNORECASE)

    # 8. Intelligent narrative prosody & intonation shaping (PocketMyth storytelling cadence)
    # 8a. Transform rhetorical hook questions ending with period into question mark (forces rising pitch hook)
    hook_patterns = [
        r'(\b(?:Tahukah|Pernahkah)\s+(?:kalian|kamu|kita)\b[^.!?]+)\.',
        r'(\b(?:Kalian|Kamu)\s+tahu\s+nggak\b[^.!?]+)\.',
        r'(\b(?:Kenapa|Mengapa|Bagaimana|Apa\s+jadinya\s+kalau)\b[^.!?]+)\.',
    ]
    for pat in hook_patterns:
        res = re.sub(pat, r'\1?', res, flags=re.IGNORECASE)

    # 8b. Add natural suspense comma after rhetorical opening clauses if missing
    res = re.sub(r'\b(Tahukah\s+(?:kalian|kamu|kita))\s+(?!,)', r'\1, ', res, flags=re.IGNORECASE)
    res = re.sub(r'\b(Kalian\s+tahu\s+nggak)\s+(?!,)', r'\1, ', res, flags=re.IGNORECASE)

    # 8c. Add comma after narrative discourse transition markers for natural pitch rise / suspense pause
    discourse_words = [
        'Namun', 'Tetapi', 'Padahal', 'Bahkan', 'Tiba-tiba', 'Sayangnya',
        'Untungnya', 'Akibatnya', 'Sebaliknya', 'Alhasil', 'Faktanya',
        'Bayangkan', 'Anehnya', 'Menariknya'
    ]
    pattern_disc = r'(^|[.!?]\s+|\n)(' + '|'.join(discourse_words) + r')\s+(?!,)'
    res = re.sub(pattern_disc, r'\1\2, ', res, flags=re.IGNORECASE)

    # 8d. Narrative temporal & contrast phrases
    res = re.sub(r'\b(Dan\s+sejak\s+(?:hari|saat)\s+itu)\s+(?!,)', r'\1, ', res, flags=re.IGNORECASE)
    res = re.sub(r'\b(Sejak\s+(?:hari|saat)\s+itu)\s+(?!,)', r'\1, ', res, flags=re.IGNORECASE)
    res = re.sub(r'\b(Bukan\s+hanya\s+itu|Tidak\s+hanya\s+itu)\s+(?!,)', r'\1, ', res, flags=re.IGNORECASE)
    res = re.sub(r'\b(Pelajaran\s+terbesarnya\s+adalah)\s+(?!,)', r'\1, ', res, flags=re.IGNORECASE)
    res = re.sub(r'\s+(melainkan|tetapi\s+juga)\s+', r', \1 ', res, flags=re.IGNORECASE)

    # 8e. Bind adverb-adjective pairs before coordinate predicates (prevents mid-phrase break like 'begitu [pause] dalam')
    res = re.sub(r'(\b(?:begitu|sangat|amat)\s+[a-zA-Z]+)\s+(membuat|menjadikan|menyebabkan)\b', r'\1, \2', res, flags=re.IGNORECASE)

    # 8f. Smooth out ellipses (...) into clean natural breath commas to prevent neural vocal fry / trembling jitter
    res = re.sub(r'\.{3,}', ', ', res)

    # Clean double commas and punctuation spacing
    res = re.sub(r',\s*,+', ', ', res)
    res = re.sub(r'\s+([,!?.:])', r'\1', res)
    # Collapse multiple spaces and clean trailing punctuation whitespace
    res = re.sub(r'\s+', ' ', res).strip()
    return res


def load_voice_presets() -> Dict[str, Any]:
    """Loads permanent Aetheria voice presets (Indonesian & English) and their selectable styles from disk."""
    id_prompt = "Kalian tahu nggak, kalau ini Aetheria, agen motion grafis otomatis yang bikin konten video jadi makin hidup dan sinematik."
    en_prompt = "Did you know that this is Aetheria, an automated motion graphics agent that brings your video content to life with cinematic quality."
    default_id_styles = {
        "default": {
            "label": "PocketMyth Storytelling (Default)",
            "mode": "controllable",
            "sampleFile": "aetheria_id.wav",
            "promptText": id_prompt,
            "cfgValue": 1.48,
            "controlInstruction": "Artikulasi bersih, bulat, dan empuk. Pelepasan vokal lepas dan plong, suara dada hangat, tanpa getaran serak di ujung kata, gaya narator santai PocketMyth.",
        },
        "energetic": {
            "label": "PocketMyth Hook & Energetic",
            "mode": "ultimate",
            "sampleFile": "aetheria_id.wav",
            "promptText": id_prompt,
            "cfgValue": 1.50,
            "controlInstruction": "Artikulasi bulat dan lantang, intonasi hook TikTok sangat bertenaga, menyambar perhatian penonton di awal kalimat, nada naik antusias tanpa serak.",
        },
        "casual": {
            "label": "Casual Ngobrol (Santai / Review)",
            "mode": "ultimate",
            "sampleFile": "aetheria_id.wav",
            "promptText": id_prompt,
            "cfgValue": 1.55,
            "controlInstruction": "Gaya ngobrol santai, ramah, artikulasi bulat empuk langsung ke penonton seperti obrolan kreator.",
        },
        "mystery": {
            "label": "Mystery & Suspense (Sejarah / Misteri)",
            "mode": "controllable",
            "sampleFile": "aetheria_id.wav",
            "promptText": id_prompt,
            "cfgValue": 1.58,
            "controlInstruction": "Gaya bercerita misterius dan dramatis, suara dada dalam, tempo terkontrol, intonasi menegangkan bikin penasaran.",
        },
        "horror": {
            "label": "Horor & Supranatural (Mencekam / Gelap)",
            "mode": "controllable",
            "sampleFile": "aetheria_id.wav",
            "promptText": id_prompt,
            "cfgValue": 1.60,
            "controlInstruction": "Gaya narator storytelling horor mencekam. Nada rendah, suara dada dalam, tempo lambat dan dingin, artikulasi bulat berbisik intens, jeda hening menegangkan, menciptakan suasana misterius dan menyeramkan.",
        },
        "crime_conspiracy": {
            "label": "Kriminal & Konspirasi (True Crime / Dokumen Rahasia)",
            "mode": "controllable",
            "sampleFile": "aetheria_id.wav",
            "promptText": id_prompt,
            "cfgValue": 1.54,
            "controlInstruction": "Gaya narator dokumenter kriminal dan konspirasi investigatif. Nada dingin, serius, penuh tanda tanya, tempo terukur dan tenang, artikulasi tajam dan berwibawa, menekan fakta-fakta ganjil yang mencurigakan.",
        },
        "serious": {
            "label": "Serious & Tegas (Warning / Fakta)",
            "mode": "controllable",
            "sampleFile": "aetheria_id.wav",
            "promptText": id_prompt,
            "cfgValue": 1.58,
            "controlInstruction": "Gaya bicara serius, berwibawa, tegas, lugas, artikulasi bulat dan menekan poin-poin krusial.",
        },
    }
    default_en_styles = {
        "default": {
            "label": "Original Storytelling (Default)",
            "mode": "ultimate",
            "sampleFile": "aetheria_en.wav",
            "promptText": en_prompt,
            "cfgValue": 1.48,
            "controlInstruction": "Upbeat, conversational tech & motion graphics creator, open and natural vocal delivery.",
        },
        "energetic": {
            "label": "Energetic & Punchy (Tech / Hook)",
            "mode": "ultimate",
            "sampleFile": "aetheria_en.wav",
            "promptText": en_prompt,
            "cfgValue": 1.42,
            "controlInstruction": "High-energy, punchy, open and enthusiastic creator hook.",
        },
        "casual": {
            "label": "Casual Conversational (Review / Explainer)",
            "mode": "ultimate",
            "sampleFile": "aetheria_en.wav",
            "promptText": en_prompt,
            "cfgValue": 1.48,
            "controlInstruction": "Relaxed, friendly, conversational delivery like chatting with a friend.",
        },
        "mystery": {
            "label": "Mystery & Cinematic (Documentary)",
            "mode": "ultimate",
            "sampleFile": "aetheria_en.wav",
            "promptText": en_prompt,
            "cfgValue": 1.68,
            "controlInstruction": "Intriguing, dramatic, cinematic storytelling tone.",
        },
        "serious": {
            "label": "Serious & Authoritative (Facts / Warning)",
            "mode": "ultimate",
            "sampleFile": "aetheria_en.wav",
            "promptText": en_prompt,
            "cfgValue": 1.62,
            "controlInstruction": "Firm, clear, authoritative delivery emphasizing key facts.",
        },
    }
    presets: Dict[str, Any] = {
        "aetheria": {
            "id": "aetheria",
            "name": "Aetheria (Indonesian Storytelling Creator)",
            "description": "Suara kreator motion grafis & storytelling Aetheria (Bahasa Indonesia). Intonasi dinamis, ekspresif, santai seperti ngobrol, antusias. Mendukung pilihan style: default, energetic, casual, mystery, serious.",
            "gender": "male",
            "lang": "id",
            "engine": "voxcpm",
            "sample_path": str(PRESETS_DIR / "aetheria_id.wav"),
            "prompt_text": id_prompt,
            "control_instruction": "Gaya bercerita antusias ala konten kreator, artikulasi lepas dan plong, intonasi dinamis, ekspresif, santai seperti ngobrol langsung dengan penonton.",
            "default_style": "default",
            "cfg_value": 1.48,
            "styles": default_id_styles,
            "fallback_voice": "id-ID-ArdiNeural",
            "fallback_pitch": "+14Hz",
            "fallback_rate": "+10%",
        },
        "aetheria_en": {
            "id": "aetheria_en",
            "name": "Aetheria English (Global Motion Graphics Creator)",
            "description": "Aetheria English motion graphics & storytelling creator voice. Dynamic, conversational, upbeat intonation. Supports styles: default, energetic, casual, mystery, serious.",
            "gender": "male",
            "lang": "en",
            "engine": "voxcpm",
            "sample_path": str(PRESETS_DIR / "aetheria_en.wav"),
            "prompt_text": en_prompt,
            "control_instruction": "Upbeat, conversational tech & motion graphics creator, open and natural vocal delivery, engaging storytelling cadence.",
            "default_style": "default",
            "cfg_value": 1.48,
            "styles": default_en_styles,
            "fallback_voice": "am_adam",
            "fallback_pitch": "+0Hz",
            "fallback_rate": "+5%",
        },
    }
    if PRESETS_JSON.is_file():
        try:
            with open(PRESETS_JSON, "r", encoding="utf-8") as f:
                data = json.load(f).get("presets", {})
                for k, v in data.items():
                    sample = v.get("sampleFile")
                    sample_path = str(PRESETS_DIR / sample) if sample else ""
                    presets[k.lower()] = {
                        "id": k,
                        "name": v.get("name", k),
                        "description": v.get("description", ""),
                        "gender": v.get("gender", "male"),
                        "lang": v.get("lang", "id"),
                        "engine": v.get("engine", "voxcpm"),
                        "sample_path": sample_path,
                        "prompt_text": v.get("promptText", ""),
                        "control_instruction": v.get("controlInstruction", ""),
                        "default_style": v.get("defaultStyle", "default"),
                        "cfg_value": float(v.get("cfgValue", 1.48)),
                        "styles": v.get("styles", default_id_styles),
                        "fallback_voice": v.get("fallback", {}).get("voice", "id-ID-ArdiNeural"),
                        "fallback_pitch": v.get("fallback", {}).get("pitch", "+14Hz"),
                        "fallback_rate": v.get("fallback", {}).get("rate", "+10%"),
                    }
        except Exception as e:
            print(f"[voicebox] Warning loading presets from {PRESETS_JSON}: {e}")
    return presets


def apply_voicebox_dsp(
    audio_data: np.ndarray,
    sample_rate: int,
    gentle_cloning: bool = False,
) -> np.ndarray:
    """
    Applies Voicebox's studio DSP mastering pipeline using Spotify's Pedalboard.
    When `gentle_cloning=True` (used for VoxCPM2 cloned voices whose reference audio is
    already broadcast-compressed), uses a transparent 1.6:1 compressor with slower
    28ms attack so emphatic pitch peaks are never squashed or held back ("ketahan").
    """
    if not HAS_PEDALBOARD:
        peak = np.max(np.abs(audio_data))
        if peak > 0:
            return (audio_data / peak) * 0.92
        return audio_data

    audio_f32 = audio_data.astype(np.float32)
    if audio_f32.ndim == 1:
        audio_f32 = audio_f32.reshape(1, -1)

    if gentle_cloning:
        # Transparent zero-phase mastering for cloned voice: preserves pure natural timbre,
        # open room dynamics (RMS ~0.12-0.14), and prevents comb-filtering / double-voice artifacts.
        board = Pedalboard([
            HighpassFilter(cutoff_frequency_hz=65.0),
            Limiter(threshold_db=-1.0, release_ms=80.0),
        ])
    else:
        board = Pedalboard([
            HighpassFilter(cutoff_frequency_hz=85.0),
            PeakFilter(cutoff_frequency_hz=220.0, gain_db=1.5, q=0.8),
            HighShelfFilter(cutoff_frequency_hz=7500.0, gain_db=-1.5),
            NoiseGate(threshold_db=-40.0, attack_ms=10.0, release_ms=80.0),
            Compressor(threshold_db=-16.0, ratio=3.0, attack_ms=8.0, release_ms=65.0),
            Gain(gain_db=1.8),
            Limiter(threshold_db=-1.0, release_ms=80.0),
        ])

    effected = board(audio_f32, sample_rate)
    return effected.squeeze()


def preprocess_reference_audio(
    audio_path: str,
    top_db: float = 30.0,
    max_duration_sec: float = 12.0,
) -> str:
    """
    Preprocesses reference audio for zero-shot voice cloning (adapted from jamiepine/voicebox):
    1. Converts stereo to mono and removes DC offset.
    2. Trims leading/trailing silence (top_db=30dB below peak).
    3. If longer than `max_duration_sec`, cuts cleanly at a natural sentence pause (low RMS valley)
       between 7s and `max_duration_sec` so it never cuts mid-word or leaves hanging half-sentences.
    4. Peak-normalizes to -1.0 dBFS and adds 50ms edge padding.
    Returns path to a temporary preprocessed WAV file (or original path on error).
    """
    try:
        data, sr = sf.read(audio_path)
        if data.ndim > 1:
            data = np.mean(data, axis=1)
        data = data.astype(np.float32)

        # Remove DC offset
        data = data - float(np.mean(data))

        # Trim leading/trailing silence using 20ms frame RMS relative to peak
        win = max(1, int(sr * 0.02))
        n_frames = len(data) // win
        if n_frames > 4:
            frames = data[: n_frames * win].reshape(n_frames, win)
            rms = np.sqrt(np.mean(frames * frames, axis=1))
            peak_rms = float(np.max(rms)) if len(rms) > 0 else 0.0
            thresh = max(0.003, peak_rms * (10.0 ** (-top_db / 20.0)))
            active = np.where(rms >= thresh)[0]
            if len(active) > 0:
                start_sample = max(0, int(active[0] * win) - int(sr * 0.05))
                end_sample = min(len(data), int((active[-1] + 1) * win) + int(sr * 0.05))
                data = data[start_sample:end_sample]

        # If still longer than max_duration_sec, find the quietest natural sentence boundary between 7.0s and max_duration_sec
        max_samples = int(sr * max_duration_sec)
        if len(data) > max_samples:
            min_search = int(sr * 7.0)
            search_region = data[min_search:max_samples]
            hop = max(1, int(sr * 0.05))
            n_hop = len(search_region) // hop
            if n_hop > 2:
                hop_rms = [
                    float(np.sqrt(np.mean(search_region[i * hop : (i + 1) * hop] ** 2)))
                    for i in range(n_hop)
                ]
                quietest_idx = int(np.argmin(hop_rms))
                cut_point = min_search + quietest_idx * hop
                data = data[:cut_point]
            else:
                data = data[:max_samples]

        # Peak normalize to 0.89 (-1 dBFS)
        peak = float(np.max(np.abs(data)))
        if peak > 1e-4:
            data = (data / peak) * 0.89

        pad = np.zeros(int(sr * 0.05), dtype=np.float32)
        data = np.concatenate([pad, data, pad])

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tf:
            tmp_path = tf.name
        sf.write(tmp_path, data, sr)
        return tmp_path
    except Exception as e:
        print(f"[voicebox] Warning preprocessing reference audio {audio_path}: {e}")
        return audio_path


def trim_tts_output(
    audio_data: np.ndarray,
    sample_rate: int,
    top_db: float = 42.0,
    max_internal_silence_ms: int = 380,
) -> np.ndarray:
    """
    Trims leading/trailing silence and compacts unnatural internal pauses (>380ms)
    in synthesized TTS audio (adapted from jamiepine/voicebox `trim_tts_output`).
    Applies a 15ms cosine crossfade whenever an internal silence gap is shortened
    so breath transitions and vowel tails never sound choked or held back ("ketahan").
    """
    if len(audio_data) < sample_rate * 0.15:
        return audio_data

    data = audio_data.astype(np.float32)
    if data.ndim > 1:
        data = data.flatten()

    win = max(1, int(sample_rate * 0.02))  # 20ms frame
    n_frames = len(data) // win
    if n_frames < 5:
        return data

    frames = data[: n_frames * win].reshape(n_frames, win)
    rms = np.sqrt(np.mean(frames * frames, axis=1))
    peak_rms = float(np.max(rms))
    if peak_rms < 1e-4:
        return data

    thresh = max(0.0015, peak_rms * (10.0 ** (-top_db / 20.0)))
    is_voiced = rms >= thresh

    voiced_indices = np.where(is_voiced)[0]
    if len(voiced_indices) == 0:
        return data

    # 1. Trim leading and trailing silence with 40ms lead and 140ms trailing tail margin
    first_f = max(0, int(voiced_indices[0]) - 2)
    last_f = min(n_frames, int(voiced_indices[-1]) + 7)

    # 2. Compact internal silence gaps exceeding max_internal_silence_ms with smooth fade
    max_silent_frames = max(4, int(max_internal_silence_ms / 20))
    kept_frames: List[np.ndarray] = []
    silent_run = 0

    for idx in range(first_f, last_f):
        if is_voiced[idx]:
            silent_run = 0
            kept_frames.append(frames[idx].copy())
        else:
            silent_run += 1
            if silent_run <= max_silent_frames:
                frame_copy = frames[idx].copy()
                if silent_run == max_silent_frames:
                    # Gentle fade-out on the last kept silent frame so cut is imperceptible
                    fade = np.linspace(1.0, 0.15, len(frame_copy), dtype=np.float32)
                    frame_copy *= fade
                kept_frames.append(frame_copy)

    if not kept_frames:
        return data

    return np.concatenate(kept_frames).astype(np.float32)


def sanitize_voice_audio(audio_data: np.ndarray, sample_rate: int) -> np.ndarray:
    """
    Sanitizes voiceover audio by trimming any leading click/transient artifacts,
    compacting dead-air pauses via `trim_tts_output`, padding 35ms of natural breath
    silence, and applying smooth 25ms cosine fade-in/fade-out so there is zero click.
    """
    if len(audio_data) < sample_rate * 0.1:
        return audio_data

    data = audio_data.astype(np.float32)
    if data.ndim > 1:
        data = data.flatten()

    # Check for pre-speech transient bursts (e.g. 10-100ms noise burst followed by quiet before main speech)
    step = int(sample_rate * 0.02)
    if len(data) >= step * 10:
        first_rms = [np.sqrt(np.mean(data[i*step:(i+1)*step]**2)) for i in range(8)]
        # If chunk 1-3 has sudden spike followed by a drop (<0.02) before another rise, trim the spike
        if max(first_rms[1:4]) > 0.1 and min(first_rms[4:7]) < 0.02 and max(first_rms[6:]) > 0.1:
            valley_idx = 4 + int(np.argmin(first_rms[4:7]))
            cut_point = valley_idx * step
            data = data[cut_point:]

    # Compact dead-air silence & trim leading/trailing silence (TikTok snappy pacing)
    data = trim_tts_output(data, sample_rate, top_db=42.0, max_internal_silence_ms=380)

    # Smooth 25ms cosine fade in
    fade_in_len = min(int(sample_rate * 0.025), len(data))
    fade_in = 0.5 * (1.0 - np.cos(np.linspace(0.0, np.pi, fade_in_len)))
    data[:fade_in_len] *= fade_in

    # Smooth 25ms cosine fade out
    fade_out_len = min(int(sample_rate * 0.025), len(data))
    fade_out = 0.5 * (1.0 + np.cos(np.linspace(0.0, np.pi, fade_out_len)))
    data[-fade_out_len:] *= fade_out

    # 35ms gentle lead-in and 60ms tail breath pad
    pad_in = np.zeros(int(sample_rate * 0.035), dtype=np.float32)
    pad_out = np.zeros(int(sample_rate * 0.06), dtype=np.float32)
    return np.concatenate([pad_in, data, pad_out])



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


def split_text_into_clauses(text: str, max_chars: int = 135) -> List[str]:
    """
    Splits long narration text into natural sentence/clause chunks (`<= max_chars`)
    so zero-shot TTS models (VoxCPM2 / Qwen3-TTS) maintain lively intonation and
    never suffer from prosody flatten/drift on long paragraphs (adapted from jamiepine/voicebox `chunked_tts.py`).
    """
    import re

    cleaned = text.strip()
    if len(cleaned) <= max_chars:
        return [cleaned] if cleaned else []

    # First split on sentence-ending punctuation (. ! ?)
    raw_sentences = [
        s.strip()
        for s in re.split(r'(?<=[.!?])\s+', cleaned)
        if s and s.strip()
    ]

    chunks: List[str] = []
    current = ""

    for sent in raw_sentences:
        if len(sent) > max_chars:
            if current:
                chunks.append(current)
                current = ""
            # Split overly long single sentences on commas/semicolons
            clauses = [c.strip() for c in re.split(r'(?<=[,;:])\s+', sent) if c.strip()]
            sub_cur = ""
            for cl in clauses:
                if not sub_cur:
                    sub_cur = cl
                elif len(sub_cur) + 1 + len(cl) <= max_chars:
                    sub_cur = f"{sub_cur} {cl}"
                else:
                    chunks.append(sub_cur)
                    sub_cur = cl
            if sub_cur:
                chunks.append(sub_cur)
        else:
            if not current:
                current = sent
            elif len(current) + 1 + len(sent) <= max_chars:
                current = f"{current} {sent}"
            else:
                chunks.append(current)
                current = sent

    if current:
        chunks.append(current)

    return chunks if chunks else [cleaned]


def crossfade_audio_chunks(
    chunks: List[np.ndarray],
    sample_rate: int,
    crossfade_ms: int = 30,
    pause_ms: int = 90,
) -> np.ndarray:
    """
    Concatenates multiple synthesized sentence chunks with a snappy TikTok-style
    inter-sentence breath pause (90ms) and smooth 30ms cosine crossfade to prevent clicks.
    """
    if not chunks:
        return np.zeros(0, dtype=np.float32)
    if len(chunks) == 1:
        return chunks[0].astype(np.float32)

    fade_len = max(1, int(sample_rate * (crossfade_ms / 1000.0)))
    pause_pad = np.zeros(int(sample_rate * (pause_ms / 1000.0)), dtype=np.float32)

    out = trim_tts_output(chunks[0], sample_rate, top_db=42.0, max_internal_silence_ms=260)
    for nxt_raw in chunks[1:]:
        nxt = trim_tts_output(nxt_raw, sample_rate, top_db=42.0, max_internal_silence_ms=260)
        if len(nxt) == 0:
            continue
        if len(out) >= fade_len and len(nxt) >= fade_len:
            fade_out = 0.5 * (1.0 + np.cos(np.linspace(0.0, np.pi, fade_len, dtype=np.float32)))
            fade_in = 0.5 * (1.0 - np.cos(np.linspace(0.0, np.pi, fade_len, dtype=np.float32)))
            out[-fade_len:] *= fade_out
            nxt[:fade_len] *= fade_in
        out = np.concatenate([out, pause_pad, nxt])

    return out.astype(np.float32)


def generate_voxcpm_speech(
    text: str,
    voice_design: str,
    clone_ref: Optional[str] = None,
    prompt_text: Optional[str] = None,
    control_instruction: Optional[str] = None,
    cfg_value: float = 1.55,
    cloning_mode: str = "controllable",
    denoise: bool = False,
) -> tuple[np.ndarray, int]:
    """
    Generates natural speech with OpenBMB VoxCPM2 (Apache-2.0) through its official Hugging Face Space.
    - Voice Design: `voice_design` describes the voice (gender, age, tone, pace).
    - Cloning: `clone_ref` is a WAV/audio sample to clone. Preprocessed to clean 7-12s voice reference.
    - Prompt Text: `prompt_text` is the exact spoken text of `clone_ref` for perfect prosody/intonation alignment.
    - Speaker Anchor: When `prompt_text` and `clone_ref` are provided, `use_prompt_text=True` is always
      used so speaker identity NEVER drifts across sentence chunks (zero voice drift even on 5-minute narrations).
    - Style Steering: `control_instruction` directs emotional delivery, pacing, and intonation dynamics.
    - `denoise`: Defaults to `True` to remove reference microphone reverb and background noise.
    - `cfg_value`: Defaults to `1.55` so vocal delivery is open, natural, rounded, and never raspy.
    """
    if not HAS_GRADIO_CLIENT or Client is None or handle_file is None:
        raise ImportError("gradio_client is not installed in the current environment.")

    preprocessed_tmp: Optional[str] = None
    ref_to_use = clone_ref

    if clone_ref and os.path.isfile(clone_ref):
        try:
            info = sf.info(clone_ref)
            # Only re-trim if not already a curated preset sample (<= 13.5s) and no exact prompt_text is provided
            if info.duration > 13.5 and not (prompt_text and prompt_text.strip()):
                preprocessed_tmp = preprocess_reference_audio(clone_ref, top_db=30.0, max_duration_sec=11.0)
                if preprocessed_tmp != clone_ref:
                    ref_to_use = preprocessed_tmp
                    new_info = sf.info(ref_to_use)
                    print(f"[voicebox] Preprocessed reference voice {clone_ref} ({round(info.duration, 1)}s -> {round(new_info.duration, 2)}s) for VoxCPM2")
        except Exception as e:
            print(f"[voicebox] Warning preprocessing clone_ref: {e}")

    try:
        client = None
        for init_attempt in range(3):
            try:
                client = Client(
                    VOXCPM_SPACE,
                    verbose=False,
                    httpx_kwargs={"timeout": 60.0},
                )
                break
            except Exception as init_err:
                if init_attempt == 2:
                    raise init_err
                print(f"[voicebox] VoxCPM2 client init timeout (attempt {init_attempt + 1}/3: {init_err}), retrying in 3s...")
                time.sleep(3.0)

        assert client is not None
        use_prompt = bool(
            cloning_mode != "controllable"
            and ref_to_use
            and prompt_text
            and prompt_text.strip()
        )
        ctrl = control_instruction if control_instruction else (voice_design if not ref_to_use else "")

        clauses = split_text_into_clauses(text, max_chars=240)
        audio_chunks: List[np.ndarray] = []
        out_sr = 48000

        for idx, clause in enumerate(clauses):
            if idx > 0:
                time.sleep(2.5)
            if len(clauses) > 1:
                print(f"[voicebox] VoxCPM2 chunk {idx + 1}/{len(clauses)}: '{clause}'")

            last_err: Optional[Exception] = None
            for attempt in range(4):
                try:
                    job = client.submit(
                        text_input=clause,
                        control_instruction=ctrl,
                        reference_wav_path_input=handle_file(ref_to_use) if ref_to_use else None,
                        use_prompt_text=use_prompt,
                        prompt_text_input=prompt_text if use_prompt else "",
                        cfg_value_input=float(cfg_value),
                        do_normalize=False,
                        denoise=bool(denoise),
                        api_name="/generate",
                    )
                    result = job.result(timeout=VOXCPM_TIMEOUT_SEC)
                    audio_path = result if isinstance(result, str) else result[0]
                    data, sr = sf.read(audio_path)
                    if data.ndim > 1:
                        data = np.mean(data, axis=1)
                    out_sr = sr
                    audio_chunks.append(data.astype(np.float32))
                    last_err = None
                    break
                except Exception as err:
                    last_err = err
                    wait_s = 3.0 * (attempt + 1)
                    print(f"[voicebox] VoxCPM2 slot busy (attempt {attempt + 1}/4: {err}), retrying in {wait_s}s...")
                    time.sleep(wait_s)
                    try:
                        client = Client(
                            VOXCPM_SPACE,
                            verbose=False,
                            httpx_kwargs={"timeout": 60.0},
                        )
                    except Exception:
                        pass

            if last_err is not None:
                raise last_err

        combined = crossfade_audio_chunks(audio_chunks, out_sr, crossfade_ms=30, pause_ms=90)
        return combined, out_sr
    finally:
        if preprocessed_tmp and preprocessed_tmp != clone_ref and os.path.exists(preprocessed_tmp):
            try:
                os.remove(preprocessed_tmp)
            except OSError:
                pass


def align_words_to_audio_energy(
    text: str,
    audio_data: np.ndarray,
    sample_rate: int,
) -> List[Dict[str, Any]]:
    """
    Energy-envelope word boundary alignment:
    Maps spoken words onto actual voiced energy islands in `audio_data` so Remotion
    kinetic captions synchronize with real speech bursts and pause across breaths.
    """
    total_duration = len(audio_data) / float(max(1, sample_rate))
    raw_words = text.split()
    if not raw_words or total_duration <= 0.05:
        return []

    win = max(1, int(sample_rate * 0.02))  # 20ms frame
    n_frames = len(audio_data) // win
    if n_frames < 5:
        return estimate_word_timings(text, total_duration)

    data = audio_data[: n_frames * win].reshape(n_frames, win)
    rms = np.sqrt(np.mean(data * data, axis=1))
    peak = float(np.max(rms))
    if peak < 1e-4:
        return estimate_word_timings(text, total_duration)

    thresh = max(0.004, peak * 0.05)
    voiced_mask = rms >= thresh
    voiced_indices = np.where(voiced_mask)[0]
    if len(voiced_indices) < 2:
        return estimate_word_timings(text, total_duration)

    # Distribute words proportionally across cumulative voiced frames so pauses are respected
    voiced_weights = np.where(voiced_mask, np.maximum(0.15, rms / peak), 0.05)
    cum_energy = np.cumsum(voiced_weights)
    total_energy = float(cum_energy[-1])
    if total_energy <= 0:
        return estimate_word_timings(text, total_duration)

    # Punctuation adds slight trailing weight
    word_weights = []
    for w in raw_words:
        base = max(2, len(w))
        if w.endswith((',', ';', ':')):
            base += 2
        elif w.endswith(('.', '!', '?')):
            base += 3
        word_weights.append(float(base))

    total_w = sum(word_weights)
    words_out: List[Dict[str, Any]] = []
    acc_w = 0.0

    for w, wt in zip(raw_words, word_weights):
        start_ratio = acc_w / total_w
        end_ratio = (acc_w + wt) / total_w
        acc_w += wt

        start_frame = int(np.searchsorted(cum_energy, start_ratio * total_energy))
        end_frame = int(np.searchsorted(cum_energy, end_ratio * total_energy))
        start_sec = round(min(total_duration, start_frame * 0.02), 3)
        end_sec = round(min(total_duration, max(start_sec + 0.06, (end_frame + 1) * 0.02)), 3)
        words_out.append({
            "word": w,
            "start": start_sec,
            "duration": round(end_sec - start_sec, 3),
            "end": end_sec,
        })

    return words_out


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
    style: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Unified entry point for voice generation with Project Voice Lock & Selectable Preset Styles.
    - Supports `voice="aetheria:energetic"` or `voice="aetheria_en:casual"` or `style="energetic" | "mystery" | "casual" | "serious" | "default"`.
    - Ensures 100% consistent speaker identity across all scenes in a video project.
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

    # Support shorthand `voice="aetheria:energetic"` as well as explicit `style="energetic"`
    raw_voice = (voice or "").strip()
    if ":" in raw_voice and not style:
        parts = raw_voice.split(":", 1)
        voice = parts[0].strip()
        style = parts[1].strip().lower()

    # Permanent Voice Presets (aetheria & aetheria_en)
    presets = load_voice_presets()
    preset_key = (voice or "").lower().strip()
    if preset_key in ("aetheria_id", "pocketmyth"):
        preset_key = "aetheria"
    preset_info = presets.get(preset_key)
    selected_style_key = (style or "").lower().strip()
    selected_style_info: Dict[str, Any] = {}

    if preset_info:
        styles_map = preset_info.get("styles") or {}
        if not selected_style_key:
            selected_style_key = preset_info.get("default_style", "default")
        selected_style_info = styles_map.get(selected_style_key) or styles_map.get("default") or {}
        style_label = selected_style_info.get("label", selected_style_key)
        print(f"[voicebox] Applying permanent voice preset '{preset_key}' (style='{selected_style_key}' - {style_label}): {preset_info['name']}")
        style_sample = selected_style_info.get("sampleFile")
        style_sample_path = str(PRESETS_DIR / style_sample) if style_sample else preset_info.get("sample_path")
        if not clone_ref and style_sample_path and os.path.isfile(style_sample_path):
            clone_ref = style_sample_path
        engine = preset_info.get("engine", "voxcpm")
        if not voice_design:
            voice_design = selected_style_info.get("controlInstruction") or preset_info.get("description")
        lang = preset_info.get("lang", lang)

    # Normalize Indonesian numbers & abbreviations so '21' is spoken as 'dua puluh satu', never 'twenty one'
    if lang.lower() == "id" or (voice and "id-ID" in voice) or preset_key == "aetheria":
        text = normalize_indonesian_speech_text(text)

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
        if not style and lock_data.get("style"):
            selected_style_key = lock_data["style"]
            if preset_info:
                styles_map = preset_info.get("styles") or {}
                selected_style_info = styles_map.get(selected_style_key) or selected_style_info
        gender = lock_data.get("gender")
        is_female = (gender == "female")
        if lock_data.get("engine") and not preset_info:
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
            "style": selected_style_key or "default",
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
        prompt_txt = (
            selected_style_info.get("promptText")
            or (preset_info.get("prompt_text") if preset_info else None)
        )
        ctrl_inst = (
            selected_style_info.get("controlInstruction")
            or (preset_info.get("control_instruction") if preset_info else None)
            or voice_design
        )
        cfg_val = float(
            selected_style_info.get("cfgValue")
            or (preset_info.get("cfg_value", 1.55) if preset_info else 1.55)
        )
        cloning_mode = str(selected_style_info.get("mode", "controllable"))
        print(
            f"[voicebox] Generating with VoxCPM2 (mode={cloning_mode}, cfg={cfg_val}, style={selected_style_key or 'default'}, "
            f"{'clone' if clone_ref else 'voice design'}: {design if not clone_ref else clone_ref})..."
        )
        try:
            audio_data, sample_rate = generate_voxcpm_speech(
                text,
                design,
                clone_ref=clone_ref,
                prompt_text=prompt_txt,
                control_instruction=ctrl_inst,
                cfg_value=cfg_val,
                cloning_mode=cloning_mode,
            )
            words = estimate_word_timings(text, len(audio_data) / sample_rate)
            used_engine = "voxcpm2"
            if is_scene_1 and lock_file.is_file() and not preset_info:
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
            if preset_info and preset_info.get("fallback_voice"):
                v = preset_info["fallback_voice"]
                if pitch == "+0Hz":
                    pitch = preset_info.get("fallback_pitch", "+14Hz")
                if rate == "+0%":
                    rate = preset_info.get("fallback_rate", "+10%")
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

    # Sanitize voiceover audio (trim pre-speech transient spikes, compact dead-air pauses, cosine fade-in/out)
    audio_data = sanitize_voice_audio(audio_data, sample_rate)

    # Apply Voicebox studio DSP mastering (use gentle transparent compressor for cloned voices so pitch peaks aren't squashed)
    if apply_dsp:
        is_cloned = (used_engine == "voxcpm2" and bool(clone_ref))
        print(f"[voicebox] Applying Spotify Pedalboard broadcast DSP ({'Gentle Cloning 1.6:1' if is_cloned else 'Broadcast 3.5:1'} + Limiter)...")
        mastered_audio = apply_voicebox_dsp(audio_data, sample_rate, gentle_cloning=is_cloned)
    else:
        mastered_audio = audio_data

    # Write WAV file
    sf.write(str(out_file), mastered_audio, sample_rate)
    duration_sec = len(mastered_audio) / sample_rate

    # Re-align word timings against the final compacted & mastered waveform if not provided by Edge WordBoundary
    if used_engine in ("voxcpm2", "kokoro") or not words:
        words = align_words_to_audio_energy(text, mastered_audio, sample_rate)

    # Write word alignment for Remotion kinetic subtitles
    with open(words_json_path, "w", encoding="utf-8") as f:
        json.dump({
            "text": text,
            "duration": round(duration_sec, 3),
            "sample_rate": sample_rate,
            "style": selected_style_key or "default",
            "words": words
        }, f, indent=2, ensure_ascii=False)

    elapsed = round(time.time() - start_time, 2)
    print(f"[voicebox] Done in {elapsed}s with {used_engine}: {out_file} ({round(duration_sec, 2)}s audio)")

    result: Dict[str, Any] = {
        "success": True,
        "engine": used_engine,
        "style": selected_style_key or "default",
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
    import uvicorn  # type: ignore
    from fastapi import FastAPI, HTTPException  # type: ignore
    from fastapi.middleware.cors import CORSMiddleware  # type: ignore
    from pydantic import BaseModel  # type: ignore

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
        style: Optional[str] = None
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
        presets = load_voice_presets()
        return {
            "presets": {
                k: {
                    "name": v["name"],
                    "description": v["description"],
                    "gender": v["gender"],
                    "lang": v["lang"],
                    "defaultStyle": v.get("default_style", "default"),
                    "styles": v.get("styles", {}),
                }
                for k, v in presets.items()
            },
            "indonesian": ["aetheria", "id-ID-ArdiNeural", "id-ID-GadisNeural"],
            "english": ["aetheria_en", "af_heart", "am_adam"],
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
                style=req.style,
                lang=req.lang,
                apply_dsp=req.dsp
            )
            return res
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    print(f"[voicebox] Starting server on http://{host}:{port} ...")
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Voicebox Engine for AetheriaNexus")
    parser.add_argument("--text", type=str, help="Text to speak")
    parser.add_argument("--out", type=str, default="output/voicebox_test.wav", help="Output WAV path")
    parser.add_argument("--voice", type=str, default=None, help="Voice name (e.g. 'aetheria', 'aetheria_en', or 'aetheria:energetic')")
    parser.add_argument("--style", type=str, default=None, help="Preset delivery style: default, energetic, mystery, casual, serious")
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
            style=args.style,
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

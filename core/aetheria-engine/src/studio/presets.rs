//! Voicebox Preset Studio Handlers for Aetheria Engine.
//!
//! Endpoints:
//! - GET  `/api/studio/voice-presets`        — List presets from `core/voicebox/presets/presets.json`
//! - POST `/api/studio/voice-presets/save`   — Add or update a voice preset (and optional base64 WAV sample)
//! - POST `/api/studio/voice-presets/test`   — Synthesize a live preview sample with custom tuning (no LLM)

pub use super::video_reference::{handle_extract_video_reference, ExtractVideoRefPayload};

use axum::{response::IntoResponse, Json};
use base64::Engine as _;
use serde::Deserialize;
use serde_json::{json, Value};
use std::path::PathBuf;
use tokio::process::Command;

fn presets_dir() -> PathBuf {
    crate::paths::project_root()
        .join("core")
        .join("voicebox")
        .join("presets")
}

fn presets_json_path() -> PathBuf {
    presets_dir().join("presets.json")
}

/// GET / POST `/api/studio/voice-presets`
pub async fn handle_get_voice_presets() -> impl IntoResponse {
    let path = presets_json_path();
    let raw = std::fs::read_to_string(&path).unwrap_or_else(|_| r#"{"presets":{}}"#.to_string());
    let parsed: Value = serde_json::from_str(&raw).unwrap_or_else(|_| json!({ "presets": {} }));
    Json(json!({
        "success": true,
        "presets": parsed.get("presets").cloned().unwrap_or_else(|| json!({}))
    }))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveVoicePresetPayload {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub lang: Option<String>,
    pub gender: Option<String>,
    pub prompt_text: String,
    pub control_instruction: Option<String>,
    pub cfg_value: Option<f64>,
    pub styles: Option<Value>,
    pub sample_file_name: Option<String>,
    pub sample_base64: Option<String>,
    pub fallback_voice: Option<String>,
    pub fallback_rate: Option<String>,
    pub fallback_pitch: Option<String>,
}

/// POST `/api/studio/voice-presets/save`
pub async fn handle_save_voice_preset(
    Json(payload): Json<SaveVoicePresetPayload>,
) -> impl IntoResponse {
    let preset_id = payload
        .id
        .trim()
        .to_lowercase()
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '_' || c == '-' {
                c
            } else {
                '_'
            }
        })
        .collect::<String>();

    if preset_id.is_empty() {
        return Json(json!({ "success": false, "error": "Preset ID is required." }));
    }

    let dir = presets_dir();
    let _ = std::fs::create_dir_all(&dir);

    let json_path = presets_json_path();
    let raw =
        std::fs::read_to_string(&json_path).unwrap_or_else(|_| r#"{"presets":{}}"#.to_string());
    let mut root_val: Value =
        serde_json::from_str(&raw).unwrap_or_else(|_| json!({ "presets": {} }));

    let existing = root_val
        .get("presets")
        .and_then(|p| p.get(&preset_id))
        .cloned()
        .unwrap_or_else(|| json!({}));

    let mut sample_filename = payload
        .sample_file_name
        .filter(|s| !s.trim().is_empty())
        .or_else(|| {
            existing
                .get("sampleFile")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        })
        .unwrap_or_else(|| format!("{}.wav", preset_id));

    if let Some(b64_raw) = payload.sample_base64.filter(|s| !s.trim().is_empty()) {
        let clean_b64 = b64_raw
            .split(',')
            .next_back()
            .unwrap_or(b64_raw.as_str())
            .trim();
        match base64::engine::general_purpose::STANDARD.decode(clean_b64) {
            Ok(bytes) => {
                if !sample_filename.to_lowercase().ends_with(".wav") {
                    sample_filename = format!("{}.wav", preset_id);
                }
                let sample_target = dir.join(&sample_filename);
                if let Err(e) = std::fs::write(&sample_target, &bytes) {
                    return Json(json!({
                        "success": false,
                        "error": format!("Failed to write audio sample file: {}", e)
                    }));
                }
            }
            Err(e) => {
                return Json(json!({
                    "success": false,
                    "error": format!("Invalid audio base64 data: {}", e)
                }));
            }
        }
    }

    let cfg_val = payload
        .cfg_value
        .or_else(|| existing.get("cfgValue").and_then(|v| v.as_f64()))
        .unwrap_or(1.48);
    let lang = payload
        .lang
        .or_else(|| {
            existing
                .get("lang")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        })
        .unwrap_or_else(|| "id".to_string());
    let gender = payload
        .gender
        .or_else(|| {
            existing
                .get("gender")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        })
        .unwrap_or_else(|| "male".to_string());
    let ctrl = payload
        .control_instruction
        .or_else(|| {
            existing
                .get("controlInstruction")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        })
        .unwrap_or_else(|| {
            "Gaya bercerita antusias ala konten kreator, artikulasi lepas dan plong, intonasi dinamis."
                .to_string()
        });
    let desc = payload
        .description
        .or_else(|| {
            existing
                .get("description")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        })
        .unwrap_or_else(|| format!("Custom voice preset ({})", payload.name));

    let prompt_txt = payload.prompt_text.trim().to_string();

    let styles_val = if let Some(custom_styles) = payload.styles {
        custom_styles
    } else {
        json!({
            "default": {
                "label": "Original Storytelling (Default)",
                "mode": "ultimate",
                "sampleFile": sample_filename,
                "promptText": prompt_txt,
                "cfgValue": cfg_val,
                "controlInstruction": ctrl
            },
            "energetic": {
                "label": "Energetic & Lepas (Tech / Hook)",
                "mode": "ultimate",
                "sampleFile": sample_filename,
                "promptText": prompt_txt,
                "cfgValue": (cfg_val - 0.06).max(1.20),
                "controlInstruction": "Gaya bicara kreator yang lantang, lepas, plong, sangat antusias dan bertenaga."
            },
            "casual": {
                "label": "Casual Ngobrol (Santai / Review)",
                "mode": "ultimate",
                "sampleFile": sample_filename,
                "promptText": prompt_txt,
                "cfgValue": cfg_val,
                "controlInstruction": "Gaya ngobrol santai dan akrab langsung ke penonton."
            },
            "mystery": {
                "label": "Mystery & Suspense (Sejarah / Konspirasi)",
                "mode": "ultimate",
                "sampleFile": sample_filename,
                "promptText": prompt_txt,
                "cfgValue": (cfg_val + 0.18).min(2.20),
                "controlInstruction": "Gaya bercerita misterius dan dramatis, bikin penasaran."
            },
            "serious": {
                "label": "Serious & Tegas (Warning / Fakta)",
                "mode": "ultimate",
                "sampleFile": sample_filename,
                "promptText": prompt_txt,
                "cfgValue": (cfg_val + 0.12).min(2.10),
                "controlInstruction": "Gaya bicara serius, tegas, lugas, dan menekankan poin penting."
            }
        })
    };

    let fb_voice = payload.fallback_voice.unwrap_or_else(|| {
        if lang == "en" {
            "am_adam".to_string()
        } else {
            "id-ID-ArdiNeural".to_string()
        }
    });
    let fb_rate = payload.fallback_rate.unwrap_or_else(|| "+10%".to_string());
    let fb_pitch = payload.fallback_pitch.unwrap_or_else(|| "+14Hz".to_string());

    let preset_obj = json!({
        "id": preset_id,
        "name": payload.name.trim(),
        "description": desc,
        "gender": gender,
        "lang": lang,
        "engine": "voxcpm",
        "sampleFile": sample_filename,
        "promptText": prompt_txt,
        "controlInstruction": ctrl,
        "defaultStyle": "default",
        "cfgValue": cfg_val,
        "styles": styles_val,
        "fallback": {
            "voice": fb_voice,
            "rate": fb_rate,
            "pitch": fb_pitch
        }
    });

    if !root_val
        .get("presets")
        .map(|v| v.is_object())
        .unwrap_or(false)
    {
        root_val["presets"] = json!({});
    }
    root_val["presets"][&preset_id] = preset_obj.clone();

    match std::fs::write(
        &json_path,
        serde_json::to_string_pretty(&root_val).unwrap_or_default(),
    ) {
        Ok(_) => Json(json!({
            "success": true,
            "preset": preset_obj,
            "presets": root_val["presets"]
        })),
        Err(e) => Json(json!({
            "success": false,
            "error": format!("Failed to save presets.json: {}", e)
        })),
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestVoicePresetPayload {
    pub text: String,
    pub voice: String,
    pub style: Option<String>,
    pub lang: Option<String>,
    pub rate: Option<String>,
    pub pitch: Option<String>,
    pub cfg_value: Option<f64>,
    pub no_dsp: Option<bool>,
}

/// POST `/api/studio/voice-presets/test`
/// Synthesizes a preview audio sample without any LLM call and returns a `data:audio/wav;base64,...` URI.
pub async fn handle_test_voice_preset(
    Json(payload): Json<TestVoicePresetPayload>,
) -> impl IntoResponse {
    let text = payload.text.trim();
    if text.is_empty() {
        return Json(json!({ "success": false, "error": "Sample test text cannot be empty." }));
    }

    let root = crate::paths::project_root();
    let out_dir = root.join("output");
    let _ = std::fs::create_dir_all(&out_dir);
    let out_file = out_dir.join(format!("preset_preview_{}.wav", crate::paths::now_ms()));

    if let Some(cfg) = payload.cfg_value {
        let json_path = presets_json_path();
        if let Ok(raw) = std::fs::read_to_string(&json_path) {
            if let Ok(mut root_val) = serde_json::from_str::<Value>(&raw) {
                let base_id = payload.voice.split(':').next().unwrap_or(&payload.voice);
                let style_key = payload.style.as_deref().unwrap_or("default");
                if let Some(preset_obj) = root_val
                    .get_mut("presets")
                    .and_then(|p| p.get_mut(base_id))
                {
                    preset_obj["cfgValue"] = json!(cfg);
                    if let Some(st_obj) = preset_obj
                        .get_mut("styles")
                        .and_then(|s| s.get_mut(style_key))
                    {
                        st_obj["cfgValue"] = json!(cfg);
                    }
                    let _ = std::fs::write(
                        &json_path,
                        serde_json::to_string_pretty(&root_val).unwrap_or_default(),
                    );
                }
            }
        }
    }

    let script_path = root.join("core").join("voicebox").join("voicebox_engine.py");
    let mut cmd = Command::new("python");
    crate::paths::configure_hidden_tokio_command(&mut cmd);
    cmd.arg(&script_path)
        .arg("--text")
        .arg(text)
        .arg("--out")
        .arg(&out_file)
        .arg("--voice")
        .arg(&payload.voice)
        .arg("--lang")
        .arg(payload.lang.as_deref().unwrap_or("id"))
        .arg("--reset-voice-lock");

    if let Some(st) = payload.style.as_deref().filter(|s| !s.is_empty()) {
        cmd.arg("--style").arg(st);
    }
    if let Some(r) = payload.rate.as_deref().filter(|s| !s.is_empty()) {
        cmd.arg("--rate").arg(r);
    }
    if let Some(p) = payload.pitch.as_deref().filter(|s| !s.is_empty()) {
        cmd.arg("--pitch").arg(p);
    }
    if payload.no_dsp.unwrap_or(false) {
        cmd.arg("--no-dsp");
    }

    match cmd.output().await {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            if !output.status.success() || !out_file.exists() {
                return Json(json!({
                    "success": false,
                    "error": format!("Voice preview failed: {} {}", stdout, stderr)
                }));
            }

            let bytes = std::fs::read(&out_file).unwrap_or_default();
            let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
            let _ = std::fs::remove_file(&out_file);
            let _ = std::fs::remove_file(out_file.with_extension("words.json"));

            let mut meta = json!({});
            if let Some(idx) = stdout.rfind('{') {
                if let Ok(parsed) = serde_json::from_str::<Value>(&stdout[idx..]) {
                    meta = parsed;
                }
            }

            Json(json!({
                "success": true,
                "audioDataUrl": format!("data:audio/wav;base64,{}", b64),
                "meta": meta
            }))
        }
        Err(e) => Json(json!({
            "success": false,
            "error": format!("Failed to launch Voicebox engine: {}", e)
        })),
    }
}

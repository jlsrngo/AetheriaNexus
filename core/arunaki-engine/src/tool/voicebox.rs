//! Voicebox TTS Tool for Arunaki Engine.
//! Invokes the embedded Voicebox TTS engine (Kokoro-82M + Indonesian Neural + Spotify Pedalboard DSP)
//! to produce broadcast-quality voiceovers and word-level alignment for Remotion videos.

use serde_json::{json, Value};
use std::path::Path;
use tokio::process::Command;

/// Synchronize a generated audio file into both `workspace/public/` and the cached Remotion bundle
/// `public/` directory so `staticFile(...)` always finds it without manual shell copies or re-bundling.
fn sync_audio_to_public_dirs(root: &Path, target_out: &Path) {
    if !target_out.is_file() {
        return;
    }
    let Some(file_name) = target_out.file_name() else {
        return;
    };

    let ws_pub = root.join("workspace").join("public");
    let _ = std::fs::create_dir_all(&ws_pub);
    let ws_dest = ws_pub.join(file_name);
    if ws_dest != target_out {
        let _ = std::fs::copy(target_out, &ws_dest);
    }

    let bundle_pub = crate::paths::render_cache_dir().join("public");
    let _ = std::fs::create_dir_all(&bundle_pub);
    let bundle_dest = bundle_pub.join(file_name);
    if bundle_dest != target_out {
        let _ = std::fs::copy(target_out, &bundle_dest);
    }
}

pub fn voicebox_tool_definition() -> Value {
    json!({
        "type": "function",
        "function": {
            "name": "voicebox_speak",
            "description": "Generates broadcast-quality voiceover audio and word alignment using the local Voicebox TTS engine (Kokoro-82M and Indonesian Neural with Spotify Pedalboard audio mastering: highpass filter, dynamic range compression, and -14 LUFS normalization). Use this tool whenever producing voiceover for a Remotion video scene or social media reel.",
            "parameters": {
                "type": "object",
                "properties": {
                    "text": {
                        "type": "string",
                        "description": "The exact script or narration text to synthesize."
                    },
                    "outputPath": {
                        "type": "string",
                        "description": "Relative output path for the mastered WAV file. Defaults to 'workspace/public/voiceover.wav'."
                    },
                    "lang": {
                        "type": "string",
                        "enum": ["id", "en"],
                        "description": "Language: 'id' for natural Indonesian (id-ID-ArdiNeural/GadisNeural) or 'en' for Kokoro-82M."
                    },
                    "voice": {
                        "type": "string",
                        "description": "Optional specific voice name (e.g. 'id-ID-ArdiNeural', 'id-ID-GadisNeural', 'af_heart', 'am_adam')."
                    },
                    "refAudio": {
                        "type": "string",
                        "description": "Optional path to a reference audio/video sample (e.g. 'workspace/public/ref_voice.wav') to match its vocal register, pitch, and cadence."
                    },
                    "rate": {
                        "type": "string",
                        "description": "Optional speaking rate adjustment (e.g. '+10%', '-5%')."
                    },
                    "pitch": {
                        "type": "string",
                        "description": "Optional vocal pitch adjustment (e.g. '+5Hz', '-8Hz')."
                    }
                },
                "required": ["text"]
            }
        }
    })
}

pub async fn execute_voicebox(workspace_dir: &str, arguments: &Value) -> Value {
    let text = match arguments.get("text").and_then(|v| v.as_str()) {
        Some(t) if !t.trim().is_empty() => t.trim(),
        _ => return json!({ "error": "voicebox_speak requires a non-empty 'text' parameter." }),
    };

    let out_rel = arguments
        .get("outputPath")
        .or_else(|| arguments.get("output_path"))
        .and_then(|v| v.as_str())
        .unwrap_or("workspace/public/voiceover.wav");

    let lang = arguments
        .get("lang")
        .or_else(|| arguments.get("language"))
        .and_then(|v| v.as_str())
        .unwrap_or("id");

    let root = crate::paths::project_root();
    let ws = if workspace_dir.trim().is_empty() {
        root.clone()
    } else {
        std::path::PathBuf::from(workspace_dir)
    };

    let target_out = if Path::new(out_rel).is_absolute() {
        std::path::PathBuf::from(out_rel)
    } else {
        ws.join(out_rel)
    };

    // Fast Cache Hit: If the WAV file already exists and is non-empty (>1KB), reuse it immediately
    // unless force=true is explicitly passed.
    let force_regen = arguments.get("force").and_then(|v| v.as_bool()).unwrap_or(false);
    if !force_regen {
        if let Ok(meta) = std::fs::metadata(&target_out) {
            if meta.len() > 1024 {
                sync_audio_to_public_dirs(&root, &target_out);
                return json!({
                    "success": true,
                    "cached": true,
                    "message": format!("Reused existing mastered voiceover at '{}' (synced to workspace/public & bundle/public)", target_out.display()),
                    "outputPath": target_out.to_string_lossy().to_string()
                });
            }
        }
    }

    let script_path = root.join("core").join("voicebox").join("voicebox_engine.py");

    let mut cmd = Command::new("python");
    cmd.arg(&script_path)
        .arg("--text")
        .arg(text)
        .arg("--out")
        .arg(&target_out)
        .arg("--lang")
        .arg(lang);

    if let Some(v) = arguments.get("voice").and_then(|v| v.as_str()).filter(|s| !s.is_empty()) {
        cmd.arg("--voice").arg(v);
    }

    let ref_audio_opt = arguments
        .get("refAudio")
        .or_else(|| arguments.get("ref_audio"))
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty());
    if let Some(ref_rel) = ref_audio_opt {
        let ref_path = if Path::new(ref_rel).is_absolute() {
            std::path::PathBuf::from(ref_rel)
        } else {
            ws.join(ref_rel)
        };
        if ref_path.is_file() {
            cmd.arg("--ref-audio").arg(ref_path);
        }
    } else {
        let default_ref = root.join("workspace").join("public").join("ref_voice.wav");
        if default_ref.is_file() {
            cmd.arg("--ref-audio").arg(default_ref);
        }
    }

    if let Some(r) = arguments.get("rate").and_then(|v| v.as_str()).filter(|s| !s.is_empty()) {
        cmd.arg("--rate").arg(r);
    }
    if let Some(p) = arguments.get("pitch").and_then(|v| v.as_str()).filter(|s| !s.is_empty()) {
        cmd.arg("--pitch").arg(p);
    }

    match cmd.output().await {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();

            if !output.status.success() {
                return json!({
                    "error": format!("Voicebox execution failed: {}\nStderr: {}", stdout, stderr)
                });
            }

            sync_audio_to_public_dirs(&root, &target_out);

            // Parse json output from python if possible
            if let Some(idx) = stdout.rfind('{') {
                if let Ok(parsed) = serde_json::from_str::<Value>(&stdout[idx..]) {
                    return parsed;
                }
            }

            json!({
                "success": true,
                "message": format!("Voiceover generated successfully at '{}'", target_out.display()),
                "outputPath": target_out.to_string_lossy().to_string()
            })
        }
        Err(err) => json!({
            "error": format!("Failed to run Voicebox Python engine: {}", err)
        }),
    }
}

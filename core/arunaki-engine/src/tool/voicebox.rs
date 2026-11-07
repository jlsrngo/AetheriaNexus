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
            "description": "Generates natural, human-sounding voiceover audio + word alignment mastered with Spotify Pedalboard DSP (highpass, compressor, -14 LUFS limiter). For Indonesian, use voice: 'pocketmyth' (permanent viral storytelling creator with youth energetic intonation), 'id-ID-GadisNeural' (warm, clear, professional female dubbing) or 'id-ID-ArdiNeural' (authoritative male narrator). The engine automatically engages Project Voice Lock (.voice_lock.json) so the narrator identity remains 100% consistent across every scene. Use this tool whenever producing voiceover for a Remotion video scene or social media reel.",
            "parameters": {
                "type": "object",
                "properties": {
                    "text": {
                        "type": "string",
                        "description": "The exact script or narration text to synthesize. Write it the way people actually talk (casual particles like 'jadi', 'nah', 'gue', commas for breathing)."
                    },
                    "outputPath": {
                        "type": "string",
                        "description": "Relative output path for the mastered WAV file. Defaults to 'workspace/public/voiceover.wav'."
                    },
                    "lang": {
                        "type": "string",
                        "enum": ["id", "en"],
                        "description": "Language of the narration."
                    },
                    "voice": {
                        "type": "string",
                        "description": "Narrator voice. For Indonesian viral storytelling creator use 'pocketmyth'; for female dubbing use 'id-ID-GadisNeural'; for authoritative male use 'id-ID-ArdiNeural'. For English female use 'af_heart'; male use 'am_adam'. Automatically locked across all scenes."
                    },
                    "voiceDesign": {
                        "type": "string",
                        "description": "Natural voice description, e.g. 'Cewek muda Indonesia, suara hangat, santai seperti ngobrol, antusias seperti kreator teknologi'. Informs voice selection and project voice lock."
                    },
                    "engine": {
                        "type": "string",
                        "enum": ["auto", "edge", "voxcpm", "kokoro"],
                        "description": "TTS engine. 'edge' / 'auto' = Deterministic broadcast neural voice with Pedalboard DSP; 'voxcpm' = experimental latent voice design; 'kokoro' = English ONNX."
                    },
                    "resetVoiceLock": {
                        "type": "boolean",
                        "description": "Set true when starting a new project with a fresh narrator persona."
                    },
                    "cloneVoice": {
                        "type": "boolean",
                        "description": "Clone the voice in `refAudio` with VoxCPM2. ONLY set true when the user uploaded their OWN voice recording or explicitly confirmed they have permission for that voice. Never clone voices extracted from third-party videos/links."
                    },
                    "refAudio": {
                        "type": "string",
                        "description": "Optional reference audio (e.g. 'workspace/public/ref_voice.wav'). Analyzed for register/pitch; only cloned when cloneVoice=true."
                    },
                    "rate": {
                        "type": "string",
                        "description": "Speaking rate adjustment (e.g. '+10%')."
                    },
                    "pitch": {
                        "type": "string",
                        "description": "Pitch adjustment (e.g. '+5Hz')."
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
    // unless force=true or resetVoiceLock=true is explicitly passed.
    let force_regen = arguments.get("force").and_then(|v| v.as_bool()).unwrap_or(false)
        || arguments.get("resetVoiceLock").and_then(|v| v.as_bool()).unwrap_or(false);
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
            let clone = arguments.get("cloneVoice").and_then(|v| v.as_bool()).unwrap_or(false);
            if clone {
                cmd.arg("--clone-ref").arg(&ref_path);
            }
            cmd.arg("--ref-audio").arg(ref_path);
        }
    }

    if let Some(d) = arguments.get("voiceDesign").and_then(|v| v.as_str()).filter(|s| !s.trim().is_empty()) {
        cmd.arg("--voice-design").arg(d);
    }
    if let Some(e) = arguments.get("engine").and_then(|v| v.as_str()).filter(|s| !s.is_empty()) {
        cmd.arg("--engine").arg(e);
    }

    if let Some(r) = arguments.get("rate").and_then(|v| v.as_str()).filter(|s| !s.is_empty()) {
        cmd.arg("--rate").arg(r);
    }
    if let Some(p) = arguments.get("pitch").and_then(|v| v.as_str()).filter(|s| !s.is_empty()) {
        cmd.arg("--pitch").arg(p);
    }

    if arguments.get("resetVoiceLock").and_then(|v| v.as_bool()).unwrap_or(false) {
        cmd.arg("--reset-voice-lock");
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

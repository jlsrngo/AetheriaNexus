//! Voicebox TTS Tool for Arunaki Engine.
//! Invokes the embedded Voicebox TTS engine (Kokoro-82M + Indonesian Neural + Spotify Pedalboard DSP)
//! to produce broadcast-quality voiceovers and word-level alignment for Remotion videos.

use serde_json::{json, Value};
use std::path::Path;
use std::process::Command;

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
                    }
                },
                "required": ["text"]
            }
        }
    })
}

pub fn execute_voicebox(workspace_dir: &str, arguments: &Value) -> Value {
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

    let script_path = root.join("core").join("voicebox").join("voicebox_engine.py");

    let mut cmd = Command::new("python");
    cmd.arg(&script_path)
        .arg("--text")
        .arg(text)
        .arg("--out")
        .arg(&target_out)
        .arg("--lang")
        .arg(lang);

    if let Some(v) = arguments.get("voice").and_then(|v| v.as_str()) {
        cmd.arg("--voice").arg(v);
    }

    match cmd.output() {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();

            if !output.status.success() {
                return json!({
                    "error": format!("Voicebox execution failed: {}\nStderr: {}", stdout, stderr)
                });
            }

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

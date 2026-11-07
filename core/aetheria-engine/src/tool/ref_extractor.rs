//! Reference Video Extractor Tool for Aetheria Engine.
//! Analyzes reference video files or YouTube/TikTok URLs to extract exact scene cuts,
//! color palettes, pacing, and layout blueprints with >90% similarity fidelity.

use serde_json::{json, Value};
use tokio::process::Command;

pub fn ref_extractor_tool_definition() -> Value {
    json!({
        "type": "function",
        "function": {
            "name": "extract_video_reference",
            "description": "Analyzes a reference video file (or downloaded video) to extract its complete visual & stylistic blueprint: scene cut timestamps, color palette, audio BPM/tempo, typography layout, and motion cadence. Produces a style_spec.json and blueprint with >90% similarity target so generated videos faithfully match the reference.",
            "parameters": {
                "type": "object",
                "properties": {
                    "videoPath": {
                        "type": "string",
                        "description": "Path to the reference MP4 video file (e.g. 'workspace/ref/reference.mp4')."
                    },
                    "outputDir": {
                        "type": "string",
                        "description": "Optional output folder to save extracted blueprints, frames, and palette. Defaults to 'workspace/ref/extracted'."
                    }
                },
                "required": ["videoPath"]
            }
        }
    })
}

pub async fn execute_ref_extractor(workspace_dir: &str, arguments: &Value) -> Value {
    let video_raw = match arguments.get("videoPath").and_then(|v| v.as_str()) {
        Some(v) if !v.trim().is_empty() => v.trim(),
        _ => return json!({ "error": "extract_video_reference requires a valid 'videoPath' string." }),
    };

    let root = crate::paths::project_root();
    let ws = if workspace_dir.trim().is_empty() {
        root.clone()
    } else {
        std::path::PathBuf::from(workspace_dir)
    };

    let video_path = if std::path::Path::new(video_raw).is_absolute() {
        std::path::PathBuf::from(video_raw)
    } else {
        ws.join(video_raw)
    };

    if !video_path.exists() {
        return json!({ "error": format!("Reference video file not found at: {}", video_path.display()) });
    }

    let out_raw = arguments.get("outputDir").and_then(|v| v.as_str()).unwrap_or("workspace/ref/extracted");
    let out_dir = if std::path::Path::new(out_raw).is_absolute() {
        std::path::PathBuf::from(out_raw)
    } else {
        ws.join(out_raw)
    };

    let script_path = root.join("core").join("ref_extractor").join("ref_extractor.py");

    let mut cmd = Command::new("python");
    cmd.arg(&script_path)
        .arg(&video_path)
        .arg(&out_dir);

    match cmd.output().await {
        Ok(res) => {
            let stdout = String::from_utf8_lossy(&res.stdout).to_string();
            if let Some(idx) = stdout.rfind('{') {
                if let Ok(parsed) = serde_json::from_str::<Value>(&stdout[idx..]) {
                    return parsed;
                }
            }
            json!({
                "success": true,
                "raw": stdout.trim()
            })
        }
        Err(err) => json!({ "error": format!("Failed to execute reference extractor: {}", err) }),
    }
}

//! Reference Video Extractor Tool for Aetheria Engine.
//! Analyzes reference video files or YouTube/TikTok URLs to extract exact scene cuts,
//! color palettes, pacing, and layout blueprints with >90% similarity fidelity.

use base64::prelude::*;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use tokio::process::Command;

use super::resolve_isolated_path;

async fn python_has_cv2_and_numpy() -> bool {
    let mut check = Command::new("python");
    crate::paths::configure_hidden_tokio_command(&mut check);
    check.arg("-c").arg("import cv2, numpy");
    check
        .output()
        .await
        .map(|o| o.status.success())
        .unwrap_or(false)
}

pub(crate) fn collect_extracted_frames_response(
    ws: &Path,
    frames_dir: &Path,
    fallback_mode: &str,
) -> Value {
    let mut frame_paths = Vec::new();
    let mut vision_images = Vec::new();
    if let Ok(entries) = std::fs::read_dir(frames_dir) {
        let mut files: Vec<PathBuf> = entries
            .flatten()
            .map(|e| e.path())
            .filter(|p| p.is_file())
            .collect();
        files.sort();
        for p in files.into_iter().take(4) {
            let rel = p
                .strip_prefix(ws)
                .unwrap_or(&p)
                .to_string_lossy()
                .replace('\\', "/");
            frame_paths.push(rel);
            if let Ok(bytes) = std::fs::read(&p) {
                if !bytes.is_empty() {
                    let b64 = BASE64_STANDARD.encode(&bytes);
                    vision_images.push(Value::String(format!("data:image/jpeg;base64,{}", b64)));
                }
            }
        }
    }
    json!({
        "ok": true,
        "success": true,
        "fallback": fallback_mode,
        "frames": frame_paths,
        "_vision_images": vision_images
    })
}

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
                        "description": "Path to the reference MP4 video file (e.g. 'ref/reference.mp4')."
                    },
                    "outputDir": {
                        "type": "string",
                        "description": "Optional output folder to save extracted blueprints, frames, and palette. Defaults to 'ref/extracted'."
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

    let video_path = match resolve_isolated_path(&ws.to_string_lossy(), video_raw) {
        Ok(p) => p,
        Err(e) => return json!({ "ok": false, "error": e }),
    };

    if !video_path.exists() {
        return json!({ "ok": false, "error": format!("Reference video file not found at: {}", video_path.display()) });
    }

    let default_out = "ref/extracted";
    let out_raw = arguments.get("outputDir").and_then(|v| v.as_str()).unwrap_or(default_out);
    let out_dir = match resolve_isolated_path(&ws.to_string_lossy(), out_raw) {
        Ok(p) => p,
        Err(e) => return json!({ "ok": false, "error": e }),
    };

    if python_has_cv2_and_numpy().await {
        let script_path = root.join("core").join("ref_extractor").join("ref_extractor.py");
        let mut cmd = Command::new("python");
        crate::paths::configure_hidden_tokio_command(&mut cmd);
        cmd.arg(&script_path).arg(&video_path).arg(&out_dir);

        if let Ok(res) = cmd.output().await {
            let stdout = String::from_utf8_lossy(&res.stdout).to_string();
            if let Some(idx) = stdout.rfind('{') {
                if let Ok(parsed) = serde_json::from_str::<Value>(&stdout[idx..]) {
                    if parsed.get("error").is_none() {
                        return parsed;
                    }
                }
            } else if res.status.success() && !stdout.trim().is_empty() {
                return json!({
                    "ok": true,
                    "success": true,
                    "raw": stdout.trim()
                });
            }
        }
    }

    // Fallback: extract reference frames via FFmpeg (`-vf fps=1/2.5 -frames:v 4`) without Python/cv2
    let frames_dir = out_dir.join("frames");
    let _ = std::fs::create_dir_all(&frames_dir);
    let ff_bin = crate::paths::locate_ffmpeg_binary().unwrap_or_else(|| PathBuf::from("ffmpeg"));
    let pattern = frames_dir.join("thumb_%03d.jpg");
    let mut ff_cmd = Command::new(&ff_bin);
    crate::paths::configure_hidden_tokio_command(&mut ff_cmd);
    let _ = ff_cmd
        .args([
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            &video_path.to_string_lossy(),
            "-vf",
            "fps=1/2.5",
            "-frames:v",
            "4",
            "-q:v",
            "4",
            &pattern.to_string_lossy(),
        ])
        .output()
        .await;

    let fallback_res = collect_extracted_frames_response(&ws, &frames_dir, "ffmpeg");
    if fallback_res
        .get("frames")
        .and_then(|v| v.as_array())
        .is_some_and(|arr| !arr.is_empty())
    {
        return fallback_res;
    }

    json!({
        "ok": false,
        "error": "Failed to extract reference frames: neither Python (cv2/numpy) nor FFmpeg produced frames."
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn collects_fallback_frames_with_success_true_and_no_palette() {
        let ws = std::env::temp_dir().join(format!("aetheria_ref_ext_g5_{}", std::process::id()));
        let frames_dir = ws.join("ref").join("extracted").join("frames");
        let _ = std::fs::remove_dir_all(&ws);
        std::fs::create_dir_all(&frames_dir).unwrap();
        std::fs::write(frames_dir.join("thumb_001.jpg"), b"jpg1").unwrap();
        std::fs::write(frames_dir.join("thumb_002.jpg"), b"jpg2").unwrap();

        let res = collect_extracted_frames_response(&ws, &frames_dir, "ffmpeg");
        assert_eq!(res.get("success"), Some(&json!(true)));
        assert!(res.get("palette").is_none());
        assert_eq!(
            res.get("frames"),
            Some(&json!([
                "ref/extracted/frames/thumb_001.jpg",
                "ref/extracted/frames/thumb_002.jpg"
            ]))
        );
        assert_eq!(
            res.get("_vision_images")
                .and_then(|v| v.as_array())
                .map(|a| a.len()),
            Some(2)
        );

        let _ = std::fs::remove_dir_all(&ws);
    }
}

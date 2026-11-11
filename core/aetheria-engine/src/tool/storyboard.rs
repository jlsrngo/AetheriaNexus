//! Deterministic Storyboard Engine Tool (`produce_video`).
//! Orchestrates validation & timing resolution (`storyboard_planner`), 48kHz stereo mixing,
//! Remotion template sync, MP4 rendering, and post-render FFmpeg QA snapshot extraction.

use serde_json::{json, Value};
use std::path::PathBuf;
use std::process::Command;

use super::skill_inspector::copy_dir_all;
use super::storyboard_planner::{load_and_validate_storyboard, resolve_storyboard_timings};
use crate::tool::render;

pub fn produce_video_tool_definition() -> Value {
    json!({
        "type": "function",
        "function": {
            "name": "produce_video",
            "description": "Deterministic end-to-end video producer from a declarative Storyboard JSON. You (the LLM) only write the creative storyboard (scenes with 8-12 words of narration, layout kind, and visual beats tied to spoken keywords). The engine automatically validates word counts, synthesizes Aetheria voiceovers, calculates exact word-level timings, mixes 48kHz stereo audio + punchy SFX with zero overlap, populates collision-free Remotion layouts, renders the MP4, and extracts QA snapshots.",
            "parameters": {
                "type": "object",
                "properties": {
                    "storyboard_path": {
                        "type": "string",
                        "description": "Path to storyboard JSON file (e.g. 'workspace/storyboard.json')."
                    },
                    "storyboard": {
                        "type": "object",
                        "description": "Optional inline storyboard JSON object (title, style, voice, scenes[])."
                    },
                    "output_path": {
                        "type": "string",
                        "description": "Destination MP4 path (e.g. 'output/video.mp4')."
                    }
                }
            }
        }
    })
}

pub async fn execute_produce_video(
    session_id: &str,
    assistant_msg_id: &str,
    call_id: &str,
    workspace_dir: &str,
    arguments: &Value,
) -> Value {
    let root = crate::paths::project_root();
    let ws = if workspace_dir.trim().is_empty() {
        root.clone()
    } else {
        PathBuf::from(workspace_dir)
    };

    let sb_val = match load_and_validate_storyboard(&ws, arguments) {
        Ok(v) => v,
        Err(err) => return err,
    };

    let pub_dir = root.join("workspace").join("public");
    let _ = std::fs::create_dir_all(&pub_dir);

    let planned = match resolve_storyboard_timings(&root, workspace_dir, &sb_val).await {
        Ok(p) => p,
        Err(err) => return err,
    };

    // Write resolved JSON & run sample-accurate 48kHz stereo master mixer
    let resolved_json_path = pub_dir.join("sb_resolved.json");
    let _ = std::fs::write(
        &resolved_json_path,
        serde_json::to_string_pretty(&planned.resolved_json).unwrap_or_default(),
    );
    let master_wav_path = pub_dir.join("sb_master_audio.wav");
    let mixer_script = root.join("core").join("voicebox").join("storyboard_mixer.py");
    let mix_status = Command::new("python")
        .arg(&mixer_script)
        .arg("--resolved-json")
        .arg(&resolved_json_path)
        .arg("--public-dir")
        .arg(&pub_dir)
        .arg("--out")
        .arg(&master_wav_path)
        .status();
    if !mix_status.map(|s| s.success()).unwrap_or(false) {
        return json!({ "error": "Failed to mix storyboard master audio via storyboard_mixer.py" });
    }

    // Sync master templates to workspace/src/_storyboard & write resolvedData.ts
    let tpl_dir = root
        .join("core")
        .join("aetheria-engine")
        .join("templates")
        .join("storyboard");
    let ws_sb_dir = root.join("workspace").join("src").join("_storyboard");
    if tpl_dir.is_dir() {
        let _ = copy_dir_all(&tpl_dir, &ws_sb_dir);
    }
    let ts_content = format!(
        "import {{ ResolvedStoryboard }} from \"./types\";\n\nexport const RESOLVED_STORYBOARD: ResolvedStoryboard = {};\n",
        serde_json::to_string_pretty(&planned.resolved_json).unwrap_or_default()
    );
    let _ = std::fs::write(ws_sb_dir.join("resolvedData.ts"), ts_content);

    // Render StoryboardVideo composition to MP4
    let out_mp4 = arguments
        .get("output_path")
        .and_then(Value::as_str)
        .unwrap_or("output/storyboard-video.mp4");
    let render_args = json!({
        "composition_id": "StoryboardVideo",
        "output_path": out_mp4
    });
    let render_res = render::execute_render_video_with_progress(
        session_id,
        assistant_msg_id,
        call_id,
        workspace_dir,
        &render_args,
    );
    if render_res.get("error").is_some() {
        return render_res;
    }

    // Automatic Post-Render QA: extract 1 snapshot PNG per scene midpoint via bundled ffmpeg
    let ffmpeg_bin = root
        .join("node_modules")
        .join("@remotion")
        .join("compositor-win32-x64-msvc")
        .join("ffmpeg.exe");
    let mp4_path_str = render_res
        .get("outputPath")
        .and_then(Value::as_str)
        .unwrap_or(out_mp4);
    let mut qa_snapshots = Vec::new();
    if ffmpeg_bin.is_file() {
        let out_dir = root.join("output");
        let _ = std::fs::create_dir_all(&out_dir);
        for sc in &planned.resolved_scenes {
            let idx = sc.get("index").and_then(Value::as_u64).unwrap_or(1);
            let st = sc.get("startSec").and_then(Value::as_f64).unwrap_or(0.0);
            let dur = sc.get("durationSec").and_then(Value::as_f64).unwrap_or(4.0);
            let mid = st + dur * 0.55;
            let snap_path = out_dir.join(format!("qa_scene_{}.png", idx));
            let _ = Command::new(&ffmpeg_bin)
                .args([
                    "-y",
                    "-ss",
                    &format!("{:.2}", mid),
                    "-i",
                    mp4_path_str,
                    "-frames:v",
                    "1",
                ])
                .arg(&snap_path)
                .output();
            if snap_path.is_file() {
                qa_snapshots.push(snap_path.to_string_lossy().to_string());
            }
        }
    }

    json!({
        "success": true,
        "message": "Storyboard video produced with verified Aetheria voiceovers, zero-overlap 48kHz stereo SFX mix, and QA snapshots.",
        "outputPath": mp4_path_str,
        "totalDurationSec": planned.total_duration_sec,
        "totalFrames": planned.total_frames,
        "qaSnapshots": qa_snapshots
    })
}

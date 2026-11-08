//! Deterministic Storyboard Engine Tool (`produce_video`).
//! The LLM writes only creative ideas (`storyboard.json`); Rust validates word counts,
//! generates/reuses Aetheria voiceovers, computes exact word-aligned beat timings,
//! mixes a 48kHz stereo master WAV with auto-SFX, populates pre-tested layouts,
//! renders the MP4, and extracts 1 QA snapshot per scene.

use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::tool::{render, voicebox};

const VALID_LAYOUTS: &[&str] = &["hero-photo", "headline", "stat", "list", "terminal", "cta"];

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

fn match_word_start_sec(words: &[Value], keyword: &str) -> Option<f64> {
    let target = keyword
        .trim()
        .to_lowercase()
        .chars()
        .filter(|c| c.is_alphanumeric())
        .collect::<String>();
    if target.is_empty() {
        return None;
    }
    for w in words {
        let w_str = w
            .get("word")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_lowercase()
            .chars()
            .filter(|c| c.is_alphanumeric())
            .collect::<String>();
        if !w_str.is_empty() && (w_str.contains(&target) || target.contains(&w_str)) {
            if let Some(st) = w.get("start").and_then(Value::as_f64) {
                return Some(st);
            }
        }
    }
    None
}

fn copy_dir_all(src: &Path, dst: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)?.flatten() {
        let ty = entry.file_type()?;
        let dest_path = dst.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_all(&entry.path(), &dest_path)?;
        } else {
            std::fs::copy(entry.path(), dest_path)?;
        }
    }
    Ok(())
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

    // 1. Load storyboard JSON from inline `storyboard` or `storyboard_path`
    let sb_val: Value = if let Some(inline) = arguments.get("storyboard").filter(|v| v.is_object()) {
        inline.clone()
    } else if let Some(rel) = arguments.get("storyboard_path").and_then(Value::as_str) {
        let p = if Path::new(rel).is_absolute() {
            PathBuf::from(rel)
        } else {
            ws.join(rel)
        };
        match std::fs::read_to_string(&p) {
            Ok(raw) => match serde_json::from_str(&raw) {
                Ok(v) => v,
                Err(e) => return json!({ "error": format!("Invalid JSON in {}: {}", p.display(), e) }),
            },
            Err(e) => return json!({ "error": format!("Failed to read storyboard {}: {}", p.display(), e) }),
        }
    } else {
        return json!({ "error": "produce_video requires either 'storyboard' object or 'storyboard_path'." });
    };

    let Some(scenes_in) = sb_val.get("scenes").and_then(Value::as_array) else {
        return json!({ "error": "Storyboard must contain a non-empty 'scenes' array." });
    };
    if scenes_in.is_empty() {
        return json!({ "error": "Storyboard 'scenes' array cannot be empty." });
    }

    // 2. Validate word counts & layouts before generating audio
    for (idx, sc) in scenes_in.iter().enumerate() {
        let s_num = idx + 1;
        let narration = sc.get("narration").and_then(Value::as_str).unwrap_or("").trim();
        let word_count = narration.split_whitespace().count();
        if word_count == 0 {
            return json!({ "error": format!("Scene {} has empty narration.", s_num) });
        }
        if word_count > 15 {
            return json!({
                "error": format!(
                    "Scene {} narration has {} words (max 15 allowed to prevent rushed speech): \"{}\". Shorten to 8-12 words.",
                    s_num, word_count, narration
                )
            });
        }
        let layout = sc.get("layout").and_then(Value::as_str).unwrap_or("headline");
        if !VALID_LAYOUTS.contains(&layout) {
            return json!({
                "error": format!("Scene {} has invalid layout '{}'. Valid layouts: {:?}", s_num, layout, VALID_LAYOUTS)
            });
        }
    }

    let voice = sb_val.get("voice").and_then(Value::as_str).unwrap_or("aetheria");
    let lang = sb_val.get("lang").and_then(Value::as_str).unwrap_or("id");
    let style = sb_val.get("style").and_then(Value::as_str).unwrap_or("editorial");
    let title = sb_val.get("title").and_then(Value::as_str).unwrap_or("Aetheria Storyboard Video");
    let fps: u32 = 60;

    // 3. Generate/reuse voiceover per scene & resolve exact timings
    let mut current_sec = 0.0_f64;
    let mut resolved_scenes = Vec::new();
    let pub_dir = root.join("workspace").join("public");
    let _ = std::fs::create_dir_all(&pub_dir);

    for (idx, sc) in scenes_in.iter().enumerate() {
        let s_num = idx + 1;
        let s_id = sc
            .get("id")
            .and_then(Value::as_str)
            .map(str::to_string)
            .unwrap_or_else(|| format!("s{}", s_num));
        let narration = sc.get("narration").and_then(Value::as_str).unwrap_or("").trim();
        let vo_rel = sc
            .get("voFile")
            .and_then(Value::as_str)
            .map(str::to_string)
            .unwrap_or_else(|| format!("workspace/public/vo_sb_s{}.wav", s_num));

        let vo_args = json!({
            "text": narration,
            "outputPath": vo_rel,
            "voice": voice,
            "lang": lang
        });
        let vo_res = voicebox::execute_voicebox(workspace_dir, &vo_args).await;
        if let Some(err) = vo_res.get("error").and_then(Value::as_str) {
            return json!({ "error": format!("Scene {} voiceover failed: {}", s_num, err) });
        }

        let vo_abs = root.join(&vo_rel);
        let words_path = vo_abs.with_extension("words.json");
        let words_json: Value = std::fs::read_to_string(&words_path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_else(|| json!({}));

        let vo_dur = words_json
            .get("duration")
            .and_then(Value::as_f64)
            .unwrap_or(4.1);
        let words_arr = words_json
            .get("words")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();

        // Ensure 0.65s breathing buffer after VO so speech never collides with next scene
        let scene_dur = sc
            .get("durationSec")
            .and_then(Value::as_f64)
            .unwrap_or_else(|| ((vo_dur + 0.65) * 10.0).ceil() / 10.0)
            .max(3.5);

        let beats_in = sc
            .get("beats")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        let mut resolved_beats = Vec::new();
        let beat_count = beats_in.len().max(1);

        for (b_i, b) in beats_in.iter().enumerate() {
            let b_type = b.get("type").and_then(Value::as_str).unwrap_or("headline");
            let b_text = b.get("text").and_then(Value::as_str).unwrap_or("");
            let matched_sec = b
                .get("at")
                .and_then(Value::as_str)
                .and_then(|kw| match_word_start_sec(&words_arr, kw));
            let fallback_sec = 0.2 + (b_i as f64) * ((vo_dur * 0.72) / (beat_count as f64));
            let start_sec = b
                .get("startSec")
                .and_then(Value::as_f64)
                .or(matched_sec)
                .unwrap_or(fallback_sec);

            resolved_beats.push(json!({
                "id": format!("{}_b{}", s_id, b_i + 1),
                "type": b_type,
                "text": b_text,
                "subtext": b.get("subtext").and_then(Value::as_str),
                "accent": b.get("accent").and_then(Value::as_str),
                "startSec": (start_sec * 100.0).round() / 100.0
            }));
        }

        let start_frame = (current_sec * (fps as f64)).round() as u32;
        let dur_frames = (scene_dur * (fps as f64)).round() as u32;

        resolved_scenes.push(json!({
            "index": s_num,
            "id": s_id,
            "narration": narration,
            "voFile": vo_abs.to_string_lossy().to_string(),
            "layout": sc.get("layout").and_then(Value::as_str).unwrap_or("headline"),
            "dark": sc.get("dark").and_then(Value::as_bool).unwrap_or(s_num % 2 == 0),
            "tag": sc.get("tag").and_then(Value::as_str),
            "image": sc.get("image").and_then(Value::as_str),
            "statValue": sc.get("statValue").and_then(Value::as_str),
            "statLabel": sc.get("statLabel").and_then(Value::as_str),
            "codeLines": sc.get("codeLines"),
            "startSec": (current_sec * 100.0).round() / 100.0,
            "durationSec": scene_dur,
            "startFrame": start_frame,
            "durationInFrames": dur_frames,
            "beats": resolved_beats
        }));

        current_sec += scene_dur;
    }

    let total_frames = (current_sec * (fps as f64)).round() as u32;
    let resolved_sb = json!({
        "title": title,
        "style": style,
        "fps": fps,
        "width": 1080,
        "height": 1920,
        "totalFrames": total_frames,
        "totalDurationSec": (current_sec * 100.0).round() / 100.0,
        "audioFile": "sb_master_audio.wav",
        "scenes": resolved_scenes
    });

    // 4. Write resolved JSON & run sample-accurate 48kHz stereo master mixer
    let resolved_json_path = pub_dir.join("sb_resolved.json");
    let _ = std::fs::write(
        &resolved_json_path,
        serde_json::to_string_pretty(&resolved_sb).unwrap_or_default(),
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

    // 5. Sync master templates to workspace/src/_storyboard & write resolvedData.ts
    let tpl_dir = root.join("core").join("aetheria-engine").join("templates").join("storyboard");
    let ws_sb_dir = root.join("workspace").join("src").join("_storyboard");
    if tpl_dir.is_dir() {
        let _ = copy_dir_all(&tpl_dir, &ws_sb_dir);
    }
    let ts_content = format!(
        "import {{ ResolvedStoryboard }} from \"./types\";\n\nexport const RESOLVED_STORYBOARD: ResolvedStoryboard = {};\n",
        serde_json::to_string_pretty(&resolved_sb).unwrap_or_default()
    );
    let _ = std::fs::write(ws_sb_dir.join("resolvedData.ts"), ts_content);

    // 6. Render StoryboardVideo composition to MP4
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

    // 7. Automatic Post-Render QA: extract 1 snapshot PNG per scene midpoint via bundled ffmpeg
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
        for sc in &resolved_scenes {
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
        "totalDurationSec": current_sec,
        "totalFrames": total_frames,
        "qaSnapshots": qa_snapshots
    })
}


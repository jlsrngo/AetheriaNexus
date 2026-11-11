//! Storyboard Validation, Voiceover Generation & Word-Aligned Beat Timing Planner.

use serde_json::{json, Value};
use std::path::Path;

use crate::tool::voicebox;

const VALID_LAYOUTS: &[&str] = &["hero-photo", "headline", "stat", "list", "terminal", "cta"];

pub(crate) fn match_word_start_sec(words: &[Value], keyword: &str) -> Option<f64> {
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

pub(crate) fn load_and_validate_storyboard(
    ws: &Path,
    arguments: &Value,
) -> Result<Value, Value> {
    let sb_val: Value = if let Some(inline) = arguments.get("storyboard").filter(|v| v.is_object())
    {
        inline.clone()
    } else if let Some(rel) = arguments.get("storyboard_path").and_then(Value::as_str) {
        let p = if Path::new(rel).is_absolute() {
            rel.into()
        } else {
            ws.join(rel)
        };
        match std::fs::read_to_string(&p) {
            Ok(raw) => serde_json::from_str(&raw)
                .map_err(|e| json!({ "error": format!("Invalid JSON in {}: {}", p.display(), e) }))?,
            Err(e) => {
                return Err(json!({ "error": format!("Failed to read storyboard {}: {}", p.display(), e) }))
            }
        }
    } else {
        return Err(
            json!({ "error": "produce_video requires either 'storyboard' object or 'storyboard_path'." }),
        );
    };

    let Some(scenes_in) = sb_val.get("scenes").and_then(Value::as_array) else {
        return Err(json!({ "error": "Storyboard must contain a non-empty 'scenes' array." }));
    };
    if scenes_in.is_empty() {
        return Err(json!({ "error": "Storyboard 'scenes' array cannot be empty." }));
    }

    for (idx, sc) in scenes_in.iter().enumerate() {
        let s_num = idx + 1;
        let narration = sc
            .get("narration")
            .and_then(Value::as_str)
            .unwrap_or("")
            .trim();
        let word_count = narration.split_whitespace().count();
        if word_count == 0 {
            return Err(json!({ "error": format!("Scene {} has empty narration.", s_num) }));
        }
        if word_count > 15 {
            return Err(json!({
                "error": format!(
                    "Scene {} narration has {} words (max 15 allowed to prevent rushed speech): \"{}\". Shorten to 8-12 words.",
                    s_num, word_count, narration
                )
            }));
        }
        let layout = sc
            .get("layout")
            .and_then(Value::as_str)
            .unwrap_or("headline");
        if !VALID_LAYOUTS.contains(&layout) {
            return Err(json!({
                "error": format!("Scene {} has invalid layout '{}'. Valid layouts: {:?}", s_num, layout, VALID_LAYOUTS)
            }));
        }
    }

    Ok(sb_val)
}

pub(crate) struct PlannedStoryboard {
    pub resolved_json: Value,
    pub resolved_scenes: Vec<Value>,
    pub total_duration_sec: f64,
    pub total_frames: u32,
}

pub(crate) async fn resolve_storyboard_timings(
    ws: &Path,
    workspace_dir: &str,
    sb_val: &Value,
) -> Result<PlannedStoryboard, Value> {
    let scenes_in = sb_val
        .get("scenes")
        .and_then(Value::as_array)
        .ok_or_else(|| json!({ "error": "Storyboard missing scenes." }))?;

    let voice = sb_val
        .get("voice")
        .and_then(Value::as_str)
        .unwrap_or("aetheria");
    let lang = sb_val.get("lang").and_then(Value::as_str).unwrap_or("id");
    let style = sb_val
        .get("style")
        .and_then(Value::as_str)
        .unwrap_or("editorial");
    let title = sb_val
        .get("title")
        .and_then(Value::as_str)
        .unwrap_or("Aetheria Storyboard Video");
    let fps: u32 = 60;

    let mut current_sec = 0.0_f64;
    let mut resolved_scenes = Vec::new();

    for (idx, sc) in scenes_in.iter().enumerate() {
        let s_num = idx + 1;
        let s_id = sc
            .get("id")
            .and_then(Value::as_str)
            .map(str::to_string)
            .unwrap_or_else(|| format!("s{}", s_num));
        let narration = sc
            .get("narration")
            .and_then(Value::as_str)
            .unwrap_or("")
            .trim();
        let vo_rel = sc
            .get("voFile")
            .and_then(Value::as_str)
            .map(str::to_string)
            .unwrap_or_else(|| format!("audio/vo_sb_s{}.wav", s_num));

        let vo_args = json!({
            "text": narration,
            "outputPath": vo_rel,
            "voice": voice,
            "lang": lang
        });
        let vo_res = voicebox::execute_voicebox(workspace_dir, &vo_args).await;
        if let Some(err) = vo_res.get("error").and_then(Value::as_str) {
            return Err(json!({ "error": format!("Scene {} voiceover failed: {}", s_num, err) }));
        }

        let vo_abs = ws.join(&vo_rel);
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
    let resolved_json = json!({
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

    Ok(PlannedStoryboard {
        resolved_json,
        resolved_scenes,
        total_duration_sec: current_sec,
        total_frames,
    })
}


//! Visual Preview Screenshot Tool for HTML5/JS Motion Films.
//! Captures screenshots of `index.html` at requested timestamps using headless Chromium/Edge CDP
//! (no FFmpeg required) and attaches them to vision context for visual self-verification.

use serde_json::{json, Value};

pub fn capture_film_preview_tool_definition() -> Value {
    json!({
        "type": "function",
        "function": {
            "name": "capture_film_preview",
            "description": "Captures visual screenshots of the active project's index.html film at specified timestamps (default start and mid-point, max 4 frames) using headless Edge/Chrome and attaches them to vision context so you can inspect your own visual output and compare it against user reference images/links.",
            "parameters": {
                "type": "object",
                "properties": {
                    "timestamps": {
                        "type": "array",
                        "items": { "type": "number" },
                        "description": "Optional playback timestamps in seconds to capture (e.g. [0.5, 3.0]). Defaults to start & mid-point."
                    }
                }
            }
        }
    })
}

pub async fn execute_capture_film_preview(workspace_dir: &str, arguments: &Value) -> Value {
    let timestamps: Vec<f64> = arguments
        .get("timestamps")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_f64()).collect())
        .unwrap_or_default();

    match crate::studio::preview_capture::capture_film_preview_frames(workspace_dir, timestamps).await
    {
        Ok(res) => {
            let captured: Vec<Value> = res
                .frames
                .iter()
                .map(|f| {
                    json!({
                        "timestamp": f.timestamp,
                        "path": f.saved_rel_path
                    })
                })
                .collect();
            let vision_images: Vec<Value> = res
                .frames
                .iter()
                .map(|f| Value::String(f.data_url.clone()))
                .collect();
            json!({
                "ok": true,
                "width": res.width,
                "height": res.height,
                "duration": res.duration,
                "fps": res.fps,
                "captured": captured,
                "output": format!(
                    "Captured {} visual preview frame(s) ({}x{} @ {}fps). Attached screenshots to vision context for side-by-side comparison against the reference.",
                    res.frames.len(),
                    res.width,
                    res.height,
                    res.fps
                ),
                "_vision_images": vision_images
            })
        }
        Err(err) => json!({
            "ok": false,
            "error": err
        }),
    }
}

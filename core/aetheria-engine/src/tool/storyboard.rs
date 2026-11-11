//! Deterministic Storyboard Engine Tool (`produce_video`).
//! Orchestrates validation & timing resolution (`storyboard_planner`), 48kHz stereo mixing,
//! standalone HTML5+JS Motion Film generation, pure-Rust CDP MP4 rendering, and FFmpeg QA snapshots.

use serde_json::{json, Value};
use std::path::PathBuf;
use std::process::Command;

use super::storyboard_planner::{load_and_validate_storyboard, resolve_storyboard_timings};
use crate::tool::render;

pub fn produce_video_tool_definition() -> Value {
    json!({
        "type": "function",
        "function": {
            "name": "produce_video",
            "description": "Deterministic end-to-end video producer from a declarative Storyboard JSON. Generates synchronized Aetheria voiceovers, mixes 48kHz stereo audio, emits a standalone HTML5+JS Motion Film (`index.html`), exports to MP4 via local Edge/Chrome CDP + FFmpeg, and extracts QA snapshots.",
            "parameters": {
                "type": "object",
                "properties": {
                    "storyboard_path": {
                        "type": "string",
                        "description": "Path to storyboard JSON file inside active folder (e.g. 'storyboard.json')."
                    },
                    "storyboard": {
                        "type": "object",
                        "description": "Optional inline storyboard JSON object (title, style, voice, scenes[])."
                    },
                    "output_path": {
                        "type": "string",
                        "description": "Destination MP4 path inside active folder (e.g. 'output/video.mp4')."
                    }
                }
            }
        }
    })
}

fn build_storyboard_html(resolved_json: &Value) -> String {
    let payload_str = serde_json::to_string_pretty(resolved_json).unwrap_or_else(|_| "{}".to_string());
    let title = resolved_json
        .get("title")
        .and_then(Value::as_str)
        .unwrap_or("Aetheria Storyboard Film");
    let duration = resolved_json
        .get("totalDurationSec")
        .and_then(Value::as_f64)
        .unwrap_or(10.0);

    format!(
        r##"<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>{title}</title>
  <script src="/script/aetheria-motion.js"></script>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    html, body {{ width: 1080px; height: 1920px; overflow: hidden; background: #0A0A0C; font-family: Inter, system-ui, sans-serif; }}
    canvas {{ display: block; width: 1080px; height: 1920px; }}
  </style>
</head>
<body>
<canvas id="stage" width="1080" height="1920"></canvas>
<script>
const STORYBOARD = {payload_str};
const SCENES = (STORYBOARD.scenes || []).map((s, idx) => ({{
  id: s.id || ("scene" + (idx + 1)),
  title: s.narration || ("Scene " + (idx + 1)),
  start: s.startSec || 0,
  duration: s.durationSec || 4,
  audio: idx === 0 && STORYBOARD.audioFile ? "/audio/" + STORYBOARD.audioFile : undefined,
  dark: Boolean(s.dark),
  tag: s.tag || "",
  statValue: s.statValue || "",
  statLabel: s.statLabel || "",
  beats: Array.isArray(s.beats) ? s.beats : []
}}));

window.AETHERIA_FILM = {{
  title: STORYBOARD.title || "Storyboard Film",
  width: 1080,
  height: 1920,
  fps: STORYBOARD.fps || 60,
  duration: {duration},
  scenes: SCENES
}};

const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");

window.renderAt = function(t) {{
  const resolved = window.AM ? AM.resolveScene(t, SCENES) : {{ scene: SCENES[0] || {{}}, localTime: t, index: 0 }};
  const sc = resolved.scene || {{}};
  const lt = resolved.localTime || 0;
  const dur = Math.max(0.5, sc.duration || 4);

  const grad = ctx.createLinearGradient(0, 0, 0, 1920);
  grad.addColorStop(0, sc.dark ? "#0A0A0C" : "#12131A");
  grad.addColorStop(1, sc.dark ? "#14161E" : "#1D202B");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1080, 1920);

  if (window.AM && AM.drawGridBackdrop) {{
    AM.drawGridBackdrop(ctx, t, "#10B981", "#0A0A0C", "#14161E");
  }}

  const pop = window.AM ? AM.pop(lt, 0.05, 2.4, 0.45, 0.16, 1.2) : [1, 0];
  ctx.save();
  ctx.translate(540, 820);
  ctx.scale(Math.max(0.1, pop[0]) / (1 + pop[1]), Math.max(0.1, pop[0]) * (1 + pop[1]));
  ctx.fillStyle = "#FAFAFA";
  ctx.textAlign = "center";
  ctx.font = "700 58px Inter, system-ui, sans-serif";
  const words = String(sc.title || "").split(/\s+/);
  let line = "";
  let y = -60;
  for (let i = 0; i < words.length; i++) {{
    const next = line ? line + " " + words[i] : words[i];
    if (ctx.measureText(next).width > 860 && line) {{
      ctx.fillText(line, 0, y);
      y += 74;
      line = words[i];
    }} else {{
      line = next;
    }}
  }}
  if (line) ctx.fillText(line, 0, y);
  ctx.restore();

  if (window.AM && AM.drawTopHeader) {{
    AM.drawTopHeader(ctx, sc, lt, t);
  }}
}};

window.renderAt(0);
window.__ready = true;
</script>
</body>
</html>
"##
    )
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
        crate::desktop::get_active_workspace_root()
            .filter(|s| !s.trim().is_empty())
            .map(PathBuf::from)
            .unwrap_or_else(|| crate::paths::aetheria_dot_dir().join("scratch"))
    } else {
        PathBuf::from(workspace_dir)
    };
    let ws_str = ws.to_string_lossy().to_string();

    let sb_val = match load_and_validate_storyboard(&ws, arguments) {
        Ok(v) => v,
        Err(err) => return err,
    };

    let audio_dir = ws.join("audio");
    let _ = std::fs::create_dir_all(&audio_dir);

    let planned = match resolve_storyboard_timings(&ws, &ws_str, &sb_val).await {
        Ok(p) => p,
        Err(err) => return err,
    };

    let resolved_json_path = audio_dir.join("sb_resolved.json");
    let _ = std::fs::write(
        &resolved_json_path,
        serde_json::to_string_pretty(&planned.resolved_json).unwrap_or_default(),
    );
    let master_wav_path = audio_dir.join("sb_master_audio.wav");
    let mixer_script = root.join("core").join("voicebox").join("storyboard_mixer.py");
    let mut mix_cmd = Command::new("python");
    crate::paths::configure_hidden_std_command(&mut mix_cmd);
    let mix_status = mix_cmd
        .arg(&mixer_script)
        .arg("--resolved-json")
        .arg(&resolved_json_path)
        .arg("--public-dir")
        .arg(&audio_dir)
        .arg("--out")
        .arg(&master_wav_path)
        .status();
    if !mix_status.map(|s| s.success()).unwrap_or(false) {
        return json!({ "error": "Failed to mix storyboard master audio via storyboard_mixer.py" });
    }

    let html_out = ws.join("index.html");
    let html_content = build_storyboard_html(&planned.resolved_json);
    if let Err(e) = std::fs::write(&html_out, html_content) {
        return json!({ "error": format!("Failed writing storyboard HTML film: {}", e) });
    }

    let out_mp4 = arguments
        .get("output_path")
        .and_then(Value::as_str)
        .unwrap_or("output/storyboard-video.mp4");
    let render_args = json!({
        "composition_id": "HtmlMotionFilm",
        "output_path": out_mp4
    });
    let render_res = render::execute_render_video_with_progress(
        session_id,
        assistant_msg_id,
        call_id,
        &ws_str,
        &render_args,
    )
    .await;
    if render_res.get("error").is_some() {
        return render_res;
    }

    let mp4_path_str = render_res
        .get("outputPath")
        .and_then(Value::as_str)
        .unwrap_or(out_mp4);
    let mut qa_snapshots = Vec::new();
    if let Some(ffmpeg_bin) = crate::paths::locate_ffmpeg_binary() {
        let out_dir = ws.join("output");
        let _ = std::fs::create_dir_all(&out_dir);
        for sc in &planned.resolved_scenes {
            let idx = sc.get("index").and_then(Value::as_u64).unwrap_or(1);
            let st = sc.get("startSec").and_then(Value::as_f64).unwrap_or(0.0);
            let dur = sc.get("durationSec").and_then(Value::as_f64).unwrap_or(4.0);
            let mid = st + dur * 0.55;
            let snap_path = out_dir.join(format!("qa_scene_{}.png", idx));
            let mut ff_cmd = Command::new(&ffmpeg_bin);
            crate::paths::configure_hidden_std_command(&mut ff_cmd);
            let _ = ff_cmd
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
        "message": "Storyboard HTML film produced with verified Aetheria voiceovers and native MP4 export.",
        "outputPath": mp4_path_str,
        "totalDurationSec": planned.total_duration_sec,
        "totalFrames": planned.total_frames,
        "qaSnapshots": qa_snapshots
    })
}

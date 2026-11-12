//! Trigger Render Tool for Nexus AI Agent (Pure-Rust CDP + FFmpeg HTML Exporter).
//! Exports the active project folder's `index.html` + `script/*.js` + `audio/*` to MP4 without Node.js or Remotion.

use serde_json::{json, Value};
use std::path::PathBuf;

pub use super::render_command::{
    optimal_render_concurrency, resolve_render_output_path, RenderOptions, DEFAULT_COMPOSITION,
};
use crate::session::message::emit_event;
use crate::studio::html_renderer::{render_active_html_film, HtmlRenderParams};

pub fn render_video_tool_definition() -> Value {
    json!({
        "type": "function",
        "function": {
            "name": "render_video",
            "description": "Exports the active project folder's HTML5+JS Motion Film (`index.html` + `script/*.js`) into a native MP4 file on disk using local headless Chrome/Edge CDP + FFmpeg ($0 local compute, zero Node.js/Remotion). ONLY call this tool if the user explicitly demands exporting to MP4 (e.g. 'render sekarang ke mp4', 'ekspor mp4').",
            "parameters": {
                "type": "object",
                "properties": {
                    "composition_id": {
                        "type": "string",
                        "description": "Optional composition or film label. Defaults to 'HtmlMotionFilm'."
                    },
                    "output_path": {
                        "type": "string",
                        "description": "Optional destination MP4 path, resolved against the active project folder (e.g. 'output/video.mp4')."
                    },
                    "codec": {
                        "type": "string",
                        "description": "Optional video codec ('h264', 'h265', 'vp9', 'prores'). Defaults to 'h264'."
                    }
                }
            }
        }
    })
}

pub async fn execute_render_video(
    session_id: &str,
    workspace_dir: &str,
    arguments: &Value,
) -> Value {
    execute_render_video_with_progress(session_id, "", "", workspace_dir, arguments).await
}

pub async fn execute_render_video_with_progress(
    session_id: &str,
    assistant_msg_id: &str,
    call_id: &str,
    workspace_dir: &str,
    arguments: &Value,
) -> Value {
    let composition_id = arguments["composition_id"]
        .as_str()
        .map(str::trim)
        .filter(|id| !id.is_empty())
        .unwrap_or(DEFAULT_COMPOSITION);

    let effective_ws = if workspace_dir.trim().is_empty() {
        crate::desktop::get_active_workspace_root()
            .filter(|s| !s.trim().is_empty())
            .map(PathBuf::from)
            .unwrap_or_else(|| crate::paths::aetheria_dot_dir().join("scratch"))
    } else {
        PathBuf::from(workspace_dir)
    };

    let output_path =
        match resolve_render_output_path(&effective_ws, arguments["output_path"].as_str()) {
            Ok(p) => p,
            Err(err) => {
                return json!({
                    "error": err
                });
            }
        };
    let codec = arguments
        .get("codec")
        .and_then(Value::as_str)
        .unwrap_or("h264")
        .to_string();

    let params = HtmlRenderParams {
        workspace_dir: Some(effective_ws.to_string_lossy().to_string()),
        output_path: output_path.clone(),
        codec,
        frame_range: None,
    };

    let mut last_emitted_percent: i64 = -1;
    let ws_emit = workspace_dir.to_string();
    let sess_emit = session_id.to_string();
    let msg_emit = assistant_msg_id.to_string();
    let call_emit = call_id.to_string();
    let comp_name = composition_id.to_string();

    let result = render_active_html_film(
        params,
        |_total, msg| {
            emit_event(
                &ws_emit,
                "session.next.tool.progress",
                json!({
                    "sessionID": sess_emit,
                    "messageID": msg_emit,
                    "id": call_emit,
                    "callID": call_emit,
                    "tool": "render_video",
                    "name": "render_video",
                    "preview": msg,
                    "percent": 0
                }),
            );
        },
        |rendered, total, percent| {
            let pct = percent as i64;
            if pct != last_emitted_percent {
                last_emitted_percent = pct;
                let preview = format!(
                    "Rendering {} • {}% ({}/{})",
                    comp_name, pct, rendered, total
                );
                emit_event(
                    &ws_emit,
                    "session.next.tool.progress",
                    json!({
                        "sessionID": sess_emit,
                        "messageID": msg_emit,
                        "id": call_emit,
                        "callID": call_emit,
                        "tool": "render_video",
                        "name": "render_video",
                        "preview": preview,
                        "percent": pct,
                        "renderedFrames": rendered,
                        "totalFrames": total
                    }),
                );
            }
        },
    )
    .await;

    match result {
        Ok(done) => {
            let final_output = done.output_path.to_string_lossy().to_string();
            crate::studio::compositions::register_rendered_composition(
                composition_id,
                Some(&final_output),
            );
            json!({
                "success": true,
                "message": "Video exported to MP4 successfully via native Chrome/Edge CDP + FFmpeg.",
                "compositionId": composition_id,
                "outputPath": final_output,
                "totalFrames": done.total_frames,
                "fps": done.fps
            })
        }
        Err(err) => json!({
            "error": format!("HTML MP4 render failed: {}", err)
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::resolve_render_output_path;
    use std::path::Path;

    #[test]
    fn test_resolve_render_output_path_stays_in_active_workspace() {
        let ws = Path::new("D:\\Projects\\MyVideo");
        let p1 = resolve_render_output_path(ws, Some("export/final.mp4")).unwrap();
        assert_eq!(p1, ws.join("export").join("final.mp4"));

        let p2 = resolve_render_output_path(ws, None).unwrap();
        assert!(p2.starts_with(ws.join("output")));
        assert!(p2.to_string_lossy().ends_with(".mp4"));

        assert!(resolve_render_output_path(ws, Some("../../outside.mp4")).is_err());

        #[cfg(windows)]
        let abs_evil = "C:\\Windows\\Temp\\evil.mp4";
        #[cfg(not(windows))]
        let abs_evil = "/tmp/evil.mp4";
        assert!(resolve_render_output_path(ws, Some(abs_evil)).is_err());
    }
}

//! Trigger Render Tool for Nexus AI Agent.
//! Acts as the programmatic equivalent of clicking the "[↓] RENDER MP4" button in the UI.

use serde_json::{json, Value};
use std::process::Command;

pub fn render_video_tool_definition() -> Value {
    json!({
        "type": "function",
        "function": {
            "name": "render_video",
            "description": "Triggers local Nexus GPU engine to export the active video composition to an MP4 file on disk ($0 local hardware acceleration). Equivalent to pressing the '[↓] RENDER MP4' button in the UI. Use when the user requests to render or export the video to MP4 (e.g., via chat or Telegram bot).",
            "parameters": {
                "type": "object",
                "properties": {
                    "composition_id": {
                        "type": "string",
                        "description": "Composition identifier to render. Defaults to 'NexusShorts'."
                    },
                    "output_path": {
                        "type": "string",
                        "description": "Optional destination MP4 file path (e.g. 'export/video.mp4'). If omitted, defaults to timestamped output."
                    }
                }
            }
        }
    })
}

pub fn execute_render_video(
    _session_id: &str,
    _workspace_dir: &str,
    arguments: &Value,
) -> Value {
    let output_path = arguments["output_path"].as_str();

    let mut cmd = Command::new("node");
    cmd.arg("scripts/render.mjs");

    if let Some(out) = output_path {
        cmd.arg("--output").arg(out);
    }

    match cmd.output() {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();

            if output.status.success() {
                json!({
                    "success": true,
                    "message": "Video successfully exported to MP4 via local Nexus GPU hardware acceleration ($0 cloud cost).",
                    "stdout": stdout,
                    "outputPath": output_path.unwrap_or("export/ folder")
                })
            } else {
                json!({
                    "error": format!("Nexus render failed with exit code: {:?}\nStdout: {}\nStderr: {}", output.status.code(), stdout, stderr)
                })
            }
        }
        Err(e) => {
            json!({
                "error": format!("Failed to launch Nexus video renderer: {}", e)
            })
        }
    }
}

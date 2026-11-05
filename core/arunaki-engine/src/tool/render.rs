//! Trigger Render Tool for Nexus AI Agent.
//! Acts as the programmatic equivalent of clicking the "[↓] RENDER MP4" button in the UI.

use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::paths::now_ms;

pub const DEFAULT_COMPOSITION: &str = "NexusEditorialVideo";

/// Single place that builds the `node scripts/render.mjs` invocation.
/// Used by the agent tool, the HTTP `/api/render-media` route and the Tauri command,
/// so browser detection and bundle caching apply everywhere.
pub fn build_command(root: &Path, composition: &str, props: &str, output: Option<&Path>) -> Command {
    let mut cmd = Command::new("node");
    cmd.current_dir(root)
        .arg(root.join("scripts").join("render.mjs"))
        .arg("--composition")
        .arg(composition)
        .arg("--props")
        .arg(props)
        .arg("--bundle-dir")
        .arg(crate::paths::render_cache_dir());

    if let Some(browser) = crate::paths::detect_browser_executable() {
        cmd.arg("--browser-executable").arg(browser);
    }

    if let Some(output) = output {
        cmd.arg("--output").arg(output);
    }

    cmd
}

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
                        "description": "Composition identifier to render. Defaults to 'NexusEditorialVideo'. Unknown ids fall back to the first registered composition."
                    },
                    "output_path": {
                        "type": "string",
                        "description": "Optional destination MP4 path, resolved against the active project folder (e.g. 'export/video.mp4'). Defaults to 'output/nexus-<timestamp>.mp4'."
                    }
                }
            }
        }
    })
}

/// Reads the last `{"type": "..."}` event the render script printed.
fn last_event<'a>(stdout: &'a str, event_type: &str) -> Option<Value> {
    stdout
        .lines()
        .filter_map(|line| serde_json::from_str::<Value>(line.trim()).ok())
        .filter(|value| value.get("type").and_then(Value::as_str) == Some(event_type))
        .last()
        .map(|value| value.to_owned())
}

pub fn execute_render_video(
    _session_id: &str,
    workspace_dir: &str,
    arguments: &Value,
) -> Value {
    let composition_id = arguments["composition_id"]
        .as_str()
        .map(str::trim)
        .filter(|id| !id.is_empty())
        .unwrap_or(DEFAULT_COMPOSITION);

    let root = crate::paths::project_root();
    let workspace = if workspace_dir.trim().is_empty() {
        root.clone()
    } else {
        PathBuf::from(workspace_dir)
    };

    let output_path = match arguments["output_path"].as_str() {
        Some(raw) if !raw.trim().is_empty() => {
            let candidate = Path::new(raw);
            if candidate.is_absolute() {
                candidate.to_path_buf()
            } else {
                workspace.join(candidate)
            }
        }
        _ => workspace
            .join("output")
            .join(format!("nexus-{}.mp4", now_ms())),
    };

    let mut cmd = build_command(&root, composition_id, "{}", Some(&output_path));

    match cmd.output() {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();

            if !output.status.success() {
                let reported = last_event(&stdout, "error")
                    .and_then(|value| value["error"].as_str().map(str::to_owned))
                    .unwrap_or_else(|| {
                        format!("exit code {:?}\nStderr: {}", output.status.code(), stderr.trim())
                    });
                return json!({ "error": format!("Nexus render failed: {}", reported) });
            }

            let done = last_event(&stdout, "done");
            json!({
                "success": true,
                "message": "Video exported to MP4 via local Nexus render engine ($0 cloud cost).",
                "compositionId": done
                    .as_ref()
                    .and_then(|value| value["compositionId"].as_str())
                    .unwrap_or(composition_id),
                "outputPath": done
                    .as_ref()
                    .and_then(|value| value["outputPath"].as_str())
                    .map(str::to_owned)
                    .unwrap_or_else(|| output_path.to_string_lossy().to_string()),
            })
        }
        Err(e) => json!({
            "error": format!("Failed to launch Nexus video renderer: {}", e)
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::{build_command, last_event};
    use std::path::Path;

    #[test]
    fn test_last_event_picks_latest_and_ignores_noise() {
        let stdout = concat!(
            "not json\n",
            "{\"type\":\"status\",\"totalFrames\":150}\n",
            "{\"type\":\"progress\",\"percent\":40}\n",
            "{\"type\":\"done\",\"compositionId\":\"TikTokVideo\",\"outputPath\":\"out.mp4\"}\n"
        );
        let done = last_event(stdout, "done").expect("done event");
        assert_eq!(done["compositionId"], "TikTokVideo");
        assert_eq!(done["outputPath"], "out.mp4");
        assert!(last_event(stdout, "error").is_none());
    }

    #[test]
    fn test_build_command_passes_cache_and_browser() {
        let root = crate::paths::project_root();
        let cmd = build_command(&root, "TikTokVideo", "{}", Some(Path::new("out.mp4")));
        let args: Vec<String> = cmd
            .get_args()
            .map(|arg| arg.to_string_lossy().to_string())
            .collect();

        assert!(root.join("scripts").join("render.mjs").is_file());
        assert!(args.contains(&"--bundle-dir".to_string()));
        assert!(args.contains(&crate::paths::render_cache_dir().to_string_lossy().to_string()));
        assert!(args.contains(&"TikTokVideo".to_string()));
        assert!(args.contains(&"out.mp4".to_string()));

        if crate::paths::detect_browser_executable().is_some() {
            assert!(args.contains(&"--browser-executable".to_string()));
        }
    }
}

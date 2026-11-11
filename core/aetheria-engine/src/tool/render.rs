//! Trigger Render Tool for Nexus AI Agent (Rust Native Render Orchestrator).
//! Computes bundle cache stamps, CPU parallelism, codec selection, and frame ranges
//! in Rust before invoking the Remotion worker.

use serde_json::{json, Value};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::Stdio;

pub use super::render_command::{
    build_command, build_command_with_options, compute_remotion_bundle_stamp,
    optimal_render_concurrency, sync_workspace_public_to_bundle, RenderOptions, DEFAULT_COMPOSITION,
};
use crate::paths::now_ms;
use crate::session::message::emit_event;

pub fn render_video_tool_definition() -> Value {
    json!({
        "type": "function",
        "function": {
            "name": "render_video",
            "description": "Triggers the local Remotion engine to render the active video composition into a native MP4 file on disk ($0 local hardware acceleration). ONLY call this tool if the user explicitly demands rendering into a file (e.g. 'render sekarang ke mp4', 'ekspor mp4'). Otherwise, assemble the scenes and Root.tsx so the user can interactively preview the video in the studio player and click the Render button themselves.",
            "parameters": {
                "type": "object",
                "properties": {
                    "composition_id": {
                        "type": "string",
                        "description": "Composition identifier registered in workspace/src/Root.tsx to render. Defaults to 'NexusEditorialVideo'."
                    },
                    "output_path": {
                        "type": "string",
                        "description": "Optional destination MP4 path, resolved against the active project folder (e.g. 'output/video.mp4'). Defaults to 'output/nexus-<timestamp>.mp4'."
                    },
                    "props": {
                        "type": "object",
                        "description": "Optional JSON object containing Remotion inputProps to pass to the composition."
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
    session_id: &str,
    workspace_dir: &str,
    arguments: &Value,
) -> Value {
    execute_render_video_with_progress(session_id, "", "", workspace_dir, arguments)
}

pub fn execute_render_video_with_progress(
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

    let root = crate::paths::project_root();
    let workspace = if workspace_dir.trim().is_empty() {
        root.clone()
    } else {
        PathBuf::from(workspace_dir)
    };

    let output_path = match arguments["output_path"].as_str() {
        Some(raw) if !raw.trim().is_empty() => {
            let mut clean_raw = raw.trim();
            let ws_is_workspace = workspace
                .file_name()
                .and_then(|n| n.to_str())
                .map(|n| n.eq_ignore_ascii_case("workspace"))
                .unwrap_or(false);

            if ws_is_workspace {
                while clean_raw.starts_with("workspace/") || clean_raw.starts_with("workspace\\") {
                    clean_raw = &clean_raw["workspace/".len()..];
                }
                while clean_raw.starts_with("./workspace/") || clean_raw.starts_with(".\\workspace\\") {
                    clean_raw = &clean_raw["./workspace/".len()..];
                }
            }

            let candidate = Path::new(clean_raw);
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

    let props_str = arguments
        .get("props")
        .map(|v| {
            if v.is_string() {
                v.as_str().unwrap_or("{}").to_string()
            } else {
                serde_json::to_string(v).unwrap_or_else(|_| "{}".to_string())
            }
        })
        .unwrap_or_else(|| "{}".to_string());

    sync_workspace_public_to_bundle(&root);

    let mut cmd = build_command(&root, composition_id, &props_str, Some(&output_path));
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

    match cmd.spawn() {
        Ok(mut child) => {
            let mut stdout_lines = Vec::new();
            let mut last_emitted_percent: i64 = -1;

            if let Some(stdout_pipe) = child.stdout.take() {
                let reader = BufReader::new(stdout_pipe);
                for line in reader.lines().map_while(Result::ok) {
                    let trimmed = line.trim();
                    if let Ok(ev) = serde_json::from_str::<Value>(trimmed) {
                        match ev.get("type").and_then(Value::as_str) {
                            Some("status") => {
                                let msg = ev
                                    .get("message")
                                    .and_then(Value::as_str)
                                    .unwrap_or("Preparing video render...");
                                emit_event(
                                    workspace_dir,
                                    "session.next.tool.progress",
                                    json!({
                                        "sessionID": session_id,
                                        "messageID": assistant_msg_id,
                                        "id": call_id,
                                        "callID": call_id,
                                        "tool": "render_video",
                                        "name": "render_video",
                                        "preview": msg,
                                        "percent": 0
                                    }),
                                );
                            }
                            Some("progress") => {
                                let percent = ev.get("percent").and_then(Value::as_i64).unwrap_or(0);
                                let rendered = ev.get("renderedFrames").and_then(Value::as_i64).unwrap_or(0);
                                let total = ev.get("totalFrames").and_then(Value::as_i64).unwrap_or(0);
                                if percent != last_emitted_percent {
                                    last_emitted_percent = percent;
                                    let preview = format!(
                                        "Rendering {} • {}% ({}/{})",
                                        composition_id, percent, rendered, total
                                    );
                                    emit_event(
                                        workspace_dir,
                                        "session.next.tool.progress",
                                        json!({
                                            "sessionID": session_id,
                                            "messageID": assistant_msg_id,
                                            "id": call_id,
                                            "callID": call_id,
                                            "tool": "render_video",
                                            "name": "render_video",
                                            "preview": preview,
                                            "percent": percent,
                                            "renderedFrames": rendered,
                                            "totalFrames": total
                                        }),
                                    );
                                }
                            }
                            _ => {}
                        }
                    }
                    stdout_lines.push(line);
                }
            }

            let status = child.wait();
            let stdout = stdout_lines.join("\n");
            let mut stderr = String::new();
            if let Some(mut stderr_pipe) = child.stderr.take() {
                use std::io::Read;
                let _ = stderr_pipe.read_to_string(&mut stderr);
            }

            let is_ok = status.as_ref().map(|s| s.success()).unwrap_or(false);
            if !is_ok {
                let reported = last_event(&stdout, "error")
                    .and_then(|value| value["error"].as_str().map(str::to_owned))
                    .unwrap_or_else(|| {
                        format!(
                            "exit code {:?}\nStderr: {}",
                            status.ok().and_then(|s| s.code()),
                            stderr.trim()
                        )
                    });
                return json!({ "error": format!("Nexus render failed: {}", reported) });
            }

            let done = last_event(&stdout, "done");
            let final_comp_id = done
                .as_ref()
                .and_then(|value| value["compositionId"].as_str())
                .unwrap_or(composition_id);
            let final_output = done
                .as_ref()
                .and_then(|value| value["outputPath"].as_str())
                .map(str::to_owned)
                .unwrap_or_else(|| output_path.to_string_lossy().to_string());

            crate::studio::compositions::register_rendered_composition(final_comp_id, Some(&final_output));

            json!({
                "success": true,
                "message": "Video exported to MP4 successfully via local Remotion render engine.",
                "compositionId": final_comp_id,
                "outputPath": final_output,
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
        assert!(args.contains(&"--concurrency".to_string()));
        assert!(args.contains(&"--codec".to_string()));
        assert!(args.contains(&crate::paths::render_cache_dir().to_string_lossy().to_string()));
        assert!(args.contains(&"TikTokVideo".to_string()));
        assert!(args.contains(&"out.mp4".to_string()));

        if crate::paths::detect_browser_executable().is_some() {
            assert!(args.contains(&"--browser-executable".to_string()));
        }
    }
}

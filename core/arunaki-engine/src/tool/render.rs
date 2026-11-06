//! Trigger Render Tool for Nexus AI Agent (Rust Native Render Orchestrator).
//! Computes bundle cache stamps, CPU parallelism, codec selection, and frame ranges
//! in Rust before invoking the Remotion worker.

use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::UNIX_EPOCH;

use crate::paths::now_ms;

pub const DEFAULT_COMPOSITION: &str = "NexusEditorialVideo";

#[derive(Default, Clone, Debug)]
pub struct RenderOptions {
    pub codec: Option<String>,
    pub frame_range: Option<(u32, u32)>,
    pub concurrency: Option<usize>,
}

/// Fast native Rust directory mtime scanner for `apps/src/remotion` so Node.js
/// does not have to recursively stat files synchronously before every render.
pub fn compute_remotion_bundle_stamp(root: &Path) -> String {
    let remotion_dir = root.join("apps").join("src").join("remotion");
    let newest = newest_mtime_ms(&remotion_dir);
    format!("{}", newest)
}

fn newest_mtime_ms(dir: &Path) -> u128 {
    let mut newest: u128 = 0;
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                newest = newest.max(newest_mtime_ms(&path));
            } else if let Ok(meta) = entry.metadata() {
                if let Ok(modified) = meta.modified() {
                    if let Ok(dur) = modified.duration_since(UNIX_EPOCH) {
                        newest = newest.max(dur.as_millis());
                    }
                }
            }
        }
    }
    newest
}

/// Detects optimal multi-core thread count in Rust (`available_parallelism`).
pub fn optimal_render_concurrency() -> usize {
    std::thread::available_parallelism()
        .map(|n| n.get().clamp(2, 16))
        .unwrap_or(4)
}

/// Single place that builds the `node scripts/render.mjs` invocation with Rust-computed
/// bundle stamp, multi-core concurrency, codec, and hardware acceleration flags.
pub fn build_command(
    root: &Path,
    composition: &str,
    props: &str,
    output: Option<&Path>,
) -> Command {
    build_command_with_options(root, composition, props, output, &RenderOptions::default())
}

pub fn build_command_with_options(
    root: &Path,
    composition: &str,
    props: &str,
    output: Option<&Path>,
    opts: &RenderOptions,
) -> Command {
    let concurrency = opts.concurrency.unwrap_or_else(optimal_render_concurrency);
    let stamp = compute_remotion_bundle_stamp(root);
    let codec = opts.codec.as_deref().unwrap_or("h264");

    let mut cmd = Command::new("node");
    cmd.current_dir(root)
        .arg(root.join("scripts").join("render.mjs"))
        .arg("--composition")
        .arg(composition)
        .arg("--props")
        .arg(props)
        .arg("--bundle-dir")
        .arg(crate::paths::render_cache_dir())
        .arg("--bundle-stamp")
        .arg(stamp)
        .arg("--concurrency")
        .arg(concurrency.to_string())
        .arg("--codec")
        .arg(codec);

    if let Some((start_f, end_f)) = opts.frame_range {
        cmd.arg("--frames").arg(format!("{}-{}", start_f, end_f));
    }

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
            "description": "Triggers the local Remotion engine to render the active video composition into a native MP4 file on disk ($0 local hardware acceleration). MUST be called whenever the user asks to generate, create, build, render, or test a video end-to-end so that the actual MP4 file is produced.",
            "parameters": {
                "type": "object",
                "properties": {
                    "composition_id": {
                        "type": "string",
                        "description": "Composition identifier to render (e.g. 'RustBlueprintStory', 'NexusEditorialVideo', 'RustOriginBlueprint', 'TikTokVideo'). Defaults to 'NexusEditorialVideo'."
                    },
                    "output_path": {
                        "type": "string",
                        "description": "Optional destination MP4 path, resolved against the active project folder (e.g. 'output/rust-blueprint-story.mp4'). Defaults to 'output/nexus-<timestamp>.mp4'."
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

    let mut cmd = build_command(&root, composition_id, &props_str, Some(&output_path));

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

//! Studio video render job execution worker and progress tracking.

use super::types::{ProgressQuery, RenderJob, RenderMediaPayload};
use crate::paths::{gen_id, now_ms};
use axum::{extract::Query, response::IntoResponse, Json};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{OnceLock, RwLock};
use tokio::io::{AsyncBufReadExt, BufReader};

static RENDER_JOBS: OnceLock<RwLock<HashMap<String, RenderJob>>> = OnceLock::new();

pub fn get_render_jobs_store() -> &'static RwLock<HashMap<String, RenderJob>> {
    RENDER_JOBS.get_or_init(|| RwLock::new(HashMap::new()))
}

/// POST /api/render-media
pub async fn handle_render_media(
    Json(payload): Json<RenderMediaPayload>,
) -> impl IntoResponse {
    let render_id = gen_id("rnd");
    let comp_id = payload
        .composition_id
        .unwrap_or_else(|| "NexusEditorialVideo".to_string());

    let final_props = payload.input_props.or(payload.props).unwrap_or_else(|| json!({}));
    let props_str = serde_json::to_string(&final_props).unwrap_or_else(|_| "{}".to_string());

    let workspace = crate::desktop::get_active_workspace_root()
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."));

    let output_dir = workspace.join("output");
    let _ = std::fs::create_dir_all(&output_dir);

    let output_file = if let Some(custom) = payload.output_name {
        output_dir.join(custom)
    } else {
        output_dir.join(format!("nexus-{}.mp4", now_ms()))
    };

    let output_file_str = output_file.to_string_lossy().to_string();
    let render_opts = crate::tool::render::RenderOptions {
        codec: payload.codec.clone(),
        frame_range: match (payload.in_frame, payload.out_frame) {
            (Some(s), Some(e)) if e >= s => Some((s, e)),
            _ => None,
        },
        concurrency: None,
    };

    let job = RenderJob {
        render_id: render_id.clone(),
        composition_id: comp_id.clone(),
        status: "rendering".to_string(),
        percent: 0,
        rendered_frames: 0,
        total_frames: 150,
        output_path: Some(output_file_str.clone()),
        error: None,
        created_at: now_ms(),
    };

    {
        let mut jobs = get_render_jobs_store().write().unwrap();
        jobs.insert(render_id.clone(), job);
    }

    // Spawn async background worker to stream render progress
    let rid = render_id.clone();
    let out_dest = output_file_str.clone();
    let comp_for_worker = comp_id.clone();
    tokio::spawn(async move {
        let child = tokio::process::Command::from(crate::tool::render::build_command_with_options(
            &crate::paths::project_root(),
            &comp_for_worker,
            &props_str,
            Some(std::path::Path::new(&out_dest)),
            &render_opts,
        ))
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn();

        match child {
            Ok(mut process) => {
                if let Some(stdout) = process.stdout.take() {
                    let mut reader = BufReader::new(stdout).lines();
                    while let Ok(Some(line)) = reader.next_line().await {
                        if let Ok(parsed) = serde_json::from_str::<Value>(&line) {
                            let msg_type = parsed.get("type").and_then(|v| v.as_str()).unwrap_or("");
                            if msg_type == "status" {
                                if let Some(total) = parsed.get("totalFrames").and_then(|v| v.as_u64()) {
                                    let mut jobs = get_render_jobs_store().write().unwrap();
                                    if let Some(j) = jobs.get_mut(&rid) {
                                        j.total_frames = total as u32;
                                    }
                                }
                            } else if msg_type == "progress" {
                                let percent = parsed.get("percent").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                                let rendered = parsed.get("renderedFrames").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                                let total = parsed.get("totalFrames").and_then(|v| v.as_u64()).unwrap_or(150) as u32;

                                let mut jobs = get_render_jobs_store().write().unwrap();
                                if let Some(j) = jobs.get_mut(&rid) {
                                    j.percent = percent;
                                    j.rendered_frames = rendered;
                                    j.total_frames = total;
                                }

                                crate::session::message::emit_event(
                                    "global",
                                    "studio.render_progress",
                                    json!({
                                        "renderId": rid,
                                        "percent": percent,
                                        "renderedFrames": rendered,
                                        "totalFrames": total,
                                        "status": "rendering"
                                    }),
                                );
                            } else if msg_type == "done" {
                                let mut jobs = get_render_jobs_store().write().unwrap();
                                if let Some(j) = jobs.get_mut(&rid) {
                                    j.percent = 100;
                                    j.status = "done".to_string();
                                }
                                crate::session::message::emit_event(
                                    "global",
                                    "studio.render_done",
                                    json!({
                                        "renderId": rid,
                                        "status": "done",
                                        "outputPath": out_dest
                                    }),
                                );
                            } else if msg_type == "error" {
                                let message = parsed
                                    .get("error")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("Render engine failed")
                                    .to_string();
                                let mut jobs = get_render_jobs_store().write().unwrap();
                                if let Some(j) = jobs.get_mut(&rid) {
                                    j.status = "error".to_string();
                                    j.error = Some(message.clone());
                                }
                                drop(jobs);
                                crate::session::message::emit_event(
                                    "global",
                                    "studio.render_error",
                                    json!({
                                        "renderId": rid,
                                        "status": "error",
                                        "error": message
                                    }),
                                );
                            }
                        }
                    }
                }

                let exit_status = process.wait().await;
                let success = exit_status.map(|s| s.success()).unwrap_or(false);

                let mut jobs = get_render_jobs_store().write().unwrap();
                if let Some(j) = jobs.get_mut(&rid) {
                    if success {
                        j.status = "done".to_string();
                        j.percent = 100;
                    } else if j.status != "done" && j.status != "error" {
                        j.status = "error".to_string();
                        j.error = Some("Render process exited unexpectedly".to_string());
                    }
                }
            }
            Err(e) => {
                let mut jobs = get_render_jobs_store().write().unwrap();
                if let Some(j) = jobs.get_mut(&rid) {
                    j.status = "error".to_string();
                    j.error = Some(format!("Failed to spawn render process: {}", e));
                }
                crate::session::message::emit_event(
                    "global",
                    "studio.render_error",
                    json!({
                        "renderId": rid,
                        "status": "error",
                        "error": e.to_string()
                    }),
                );
            }
        }
    });

    Json(json!({
        "success": true,
        "renderId": render_id,
        "status": "rendering",
        "outputPath": output_file_str,
        "message": "Nexus GPU Hardware Render started"
    }))
}

/// GET / POST /api/render-progress
pub async fn handle_render_progress(
    Query(query): Query<ProgressQuery>,
) -> impl IntoResponse {
    let jobs = get_render_jobs_store().read().unwrap();
    if let Some(ref rid) = query.render_id {
        if let Some(job) = jobs.get(rid) {
            return Json(json!({
                "success": true,
                "data": job
            }));
        }
    }

    let all: Vec<RenderJob> = jobs.values().cloned().collect();
    Json(json!({
        "success": true,
        "data": all
    }))
}


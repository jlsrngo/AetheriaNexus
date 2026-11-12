//! Studio video render job execution worker and progress tracking (Pure-Rust CDP + FFmpeg).

use super::html_renderer::{render_active_html_film, HtmlRenderParams};
use super::motion::resolve_active_dir_from_request;
use super::types::{ProgressQuery, RenderJob, RenderMediaPayload};
use crate::paths::{gen_id, now_ms};
use axum::{extract::Query, http::HeaderMap, response::IntoResponse, Json};
use serde_json::json;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{OnceLock, RwLock};

static RENDER_JOBS: OnceLock<RwLock<HashMap<String, RenderJob>>> = OnceLock::new();

pub fn get_render_jobs_store() -> &'static RwLock<HashMap<String, RenderJob>> {
    RENDER_JOBS.get_or_init(|| RwLock::new(HashMap::new()))
}

/// POST /api/render-media
pub async fn handle_render_media(
    Query(q): Query<HashMap<String, String>>,
    headers: HeaderMap,
    Json(payload): Json<RenderMediaPayload>,
) -> impl IntoResponse {
    let render_id = gen_id("rnd");
    let comp_id = payload
        .composition_id
        .unwrap_or_else(|| "HtmlMotionFilm".to_string());

    let active_ws = resolve_active_dir_from_request(&q, &headers);
    let workspace = active_ws
        .clone()
        .unwrap_or_else(|| crate::paths::aetheria_dot_dir().join("scratch"));

    let output_dir = workspace.join("output");
    let _ = std::fs::create_dir_all(&output_dir);

    let output_file = if let Some(custom) = payload.output_name.filter(|s| !s.trim().is_empty()) {
        let candidate = output_dir.join(custom.trim());
        if !crate::paths::contains_path(&output_dir, &candidate) {
            return (
                axum::http::StatusCode::BAD_REQUEST,
                Json(json!({
                    "success": false,
                    "error": "Access Denied: outputName escapes workspace output folder"
                })),
            )
                .into_response();
        }
        candidate
    } else {
        output_dir.join(format!("nexus-{}.mp4", now_ms()))
    };

    let output_file_str = output_file.to_string_lossy().to_string();
    let frame_range = match (payload.in_frame, payload.out_frame) {
        (Some(s), Some(e)) if e >= s => Some((s, e)),
        _ => None,
    };
    let codec = payload.codec.unwrap_or_else(|| "h264".to_string());

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
        let mut jobs = get_render_jobs_store().write().unwrap_or_else(|e| e.into_inner());
        jobs.insert(render_id.clone(), job);
    }

    let rid = render_id.clone();
    let out_dest = output_file_str.clone();
    let ws_str = active_ws.map(|p| p.to_string_lossy().to_string());

    tokio::spawn(async move {
        let rid_status = rid.clone();
        let rid_progress = rid.clone();

        let params = HtmlRenderParams {
            workspace_dir: ws_str,
            output_path: PathBuf::from(&out_dest),
            codec,
            frame_range,
        };

        let result = render_active_html_film(
            params,
            move |total, _msg| {
                let mut jobs = get_render_jobs_store().write().unwrap_or_else(|e| e.into_inner());
                if let Some(j) = jobs.get_mut(&rid_status) {
                    j.total_frames = total;
                }
            },
            move |rendered, total, percent| {
                let mut jobs = get_render_jobs_store().write().unwrap_or_else(|e| e.into_inner());
                if let Some(j) = jobs.get_mut(&rid_progress) {
                    j.percent = percent;
                    j.rendered_frames = rendered;
                    j.total_frames = total;
                }
                crate::session::message::emit_event(
                    "global",
                    "studio.render_progress",
                    json!({
                        "renderId": rid_progress,
                        "percent": percent,
                        "renderedFrames": rendered,
                        "totalFrames": total,
                        "status": "rendering"
                    }),
                );
            },
        )
        .await;

        match result {
            Ok(done) => {
                let mut jobs = get_render_jobs_store().write().unwrap_or_else(|e| e.into_inner());
                if let Some(j) = jobs.get_mut(&rid) {
                    j.percent = 100;
                    j.rendered_frames = done.total_frames;
                    j.total_frames = done.total_frames;
                    j.status = "done".to_string();
                }
                crate::session::message::emit_event(
                    "global",
                    "studio.render_done",
                    json!({
                        "renderId": rid,
                        "status": "done",
                        "outputPath": done.output_path.to_string_lossy().to_string()
                    }),
                );
            }
            Err(err_msg) => {
                let mut jobs = get_render_jobs_store().write().unwrap_or_else(|e| e.into_inner());
                if let Some(j) = jobs.get_mut(&rid) {
                    j.status = "error".to_string();
                    j.error = Some(err_msg.clone());
                }
                crate::session::message::emit_event(
                    "global",
                    "studio.render_error",
                    json!({
                        "renderId": rid,
                        "status": "error",
                        "error": err_msg
                    }),
                );
            }
        }
    });

    Json(json!({
        "success": true,
        "renderId": render_id,
        "status": "rendering",
        "outputPath": output_file_str
    }))
    .into_response()
}

/// GET / POST /api/render-progress?renderId=...
pub async fn handle_render_progress(Query(query): Query<ProgressQuery>) -> impl IntoResponse {
    let jobs = get_render_jobs_store()
        .read()
        .unwrap_or_else(|e| e.into_inner());
    let Some(rid) = query.render_id.as_deref() else {
        let all: Vec<_> = jobs.values().cloned().collect();
        return Json(json!({
            "jobs": all
        }));
    };
    if let Some(job) = jobs.get(rid) {
        Json(serde_json::to_value(job).unwrap_or_else(|_| json!({ "error": "Serialize error" })))
    } else {
        Json(json!({
            "renderId": rid,
            "status": "not_found",
            "percent": 0,
            "error": "Render job not found"
        }))
    }
}

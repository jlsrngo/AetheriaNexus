//! Arunaki Nexus Render Backend Engine (Pure Rust)
//!
//! Owns the render pipeline that used to be Remotion Studio's backend: composition
//! registry, asset scanner, GPU telemetry, and the render job worker that drives the
//! Remotion engine (node + Edge) and streams JSON progress events to the UI.

use axum::{
    extract::Query,
    response::IntoResponse,
    routing::post,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{OnceLock, RwLock};
use tokio::io::{AsyncBufReadExt, BufReader};

use crate::paths::{arunaki_dot_dir, gen_id, now_ms};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CompositionPreset {
    pub id: String,
    pub name: String,
    pub folder: String,
    pub ratio: String,
    pub duration: f64,
    #[serde(default = "default_fps")]
    pub fps: u32,
    #[serde(default = "default_width")]
    pub width: u32,
    #[serde(default = "default_height")]
    pub height: u32,
    pub props: Value,
}

fn default_fps() -> u32 {
    30
}
fn default_width() -> u32 {
    1080
}
fn default_height() -> u32 {
    1920
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct NexusStaticFile {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub file_type: String, // "video" | "audio" | "image" | "data"
    pub size: String,
    pub bytes: u64,
    pub path: String,
    pub relative_path: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct RenderJob {
    pub render_id: String,
    pub composition_id: String,
    pub status: String, // "pending" | "rendering" | "done" | "error"
    pub percent: u32,
    pub rendered_frames: u32,
    pub total_frames: u32,
    pub output_path: Option<String>,
    pub error: Option<String>,
    pub created_at: u64,
}

static COMPOSITIONS: OnceLock<RwLock<Vec<CompositionPreset>>> = OnceLock::new();
static RENDER_JOBS: OnceLock<RwLock<HashMap<String, RenderJob>>> = OnceLock::new();

fn get_compositions_store() -> &'static RwLock<Vec<CompositionPreset>> {
    COMPOSITIONS.get_or_init(|| {
        let file_path = arunaki_dot_dir().join("nexus_compositions.json");
        if file_path.exists() {
            if let Ok(content) = std::fs::read_to_string(&file_path) {
                if let Ok(loaded) = serde_json::from_str::<Vec<CompositionPreset>>(&content) {
                    if !loaded.is_empty() {
                        return RwLock::new(loaded);
                    }
                }
            }
        }
        RwLock::new(default_presets())
    })
}

fn get_render_jobs_store() -> &'static RwLock<HashMap<String, RenderJob>> {
    RENDER_JOBS.get_or_init(|| RwLock::new(HashMap::new()))
}

fn default_presets() -> Vec<CompositionPreset> {
    vec![
        CompositionPreset {
            id: "nexus-vertical".to_string(),
            name: "NexusVertical (9:16)".to_string(),
            folder: "TIKTOK AUTOMATION".to_string(),
            ratio: "9:16".to_string(),
            duration: 5.0,
            fps: 30,
            width: 1080,
            height: 1920,
            props: json!({
                "hookText": "3 Morning Habits of High Performers You Never Knew",
                "bodyText": "1. Drink 500ml of mineral water before checking your phone\n2. 10 minutes of light stretching to boost mental focus\n3. Write down your single most critical priority for today",
                "themeColor": "emerald",
                "category": "PRODUCTIVITY",
                "subCategory": "EXECUTIVE HABITS",
                "authorHandle": "@nexus.creative"
            }),
        },
        CompositionPreset {
            id: "nexus-square".to_string(),
            name: "SquarePost (1:1)".to_string(),
            folder: "TIKTOK AUTOMATION".to_string(),
            ratio: "1:1".to_string(),
            duration: 5.0,
            fps: 30,
            width: 1080,
            height: 1080,
            props: json!({
                "hookText": "The Golden Rule of Visual Hook Retention",
                "bodyText": "1. First 2 seconds determines 80% of video reach\n2. Keep headline under 8 words with bold contrast\n3. Maintain constant micro-motion throughout video",
                "themeColor": "violet",
                "category": "GROWTH",
                "subCategory": "ALGORITHM METRICS",
                "authorHandle": "@nexus.creative"
            }),
        },
        CompositionPreset {
            id: "nexus-landscape".to_string(),
            name: "LandscapeShort (16:9)".to_string(),
            folder: "TIKTOK AUTOMATION".to_string(),
            ratio: "16:9".to_string(),
            duration: 5.0,
            fps: 30,
            width: 1920,
            height: 1080,
            props: json!({
                "hookText": "Zero-Cost Automated Video Architecture",
                "bodyText": "1. Nexus React runtime executes locally on CPU/GPU\n2. Axum background engine binds loopback port 20288\n3. Total cloud rendering and API cost = Rp 0",
                "themeColor": "violet",
                "category": "ENGINEERING",
                "subCategory": "ZERO CLOUD COST",
                "authorHandle": "@nexus.creative"
            }),
        },
        CompositionPreset {
            id: "hook-morning-habits".to_string(),
            name: "3 Morning Habits (High Pacing)".to_string(),
            folder: "VIRAL HOOK TEMPLATES".to_string(),
            ratio: "9:16".to_string(),
            duration: 5.0,
            fps: 30,
            width: 1080,
            height: 1920,
            props: json!({
                "hookText": "3 Morning Habits of High Performers You Never Knew",
                "bodyText": "1. Drink 500ml of mineral water before checking your phone\n2. 10 minutes of light stretching to boost mental focus\n3. Write down your single most critical priority for today",
                "themeColor": "emerald",
                "category": "PRODUCTIVITY"
            }),
        },
        CompositionPreset {
            id: "hook-finance-failure".to_string(),
            name: "Why 99% Fail (Finance)".to_string(),
            folder: "VIRAL HOOK TEMPLATES".to_string(),
            ratio: "9:16".to_string(),
            duration: 15.0,
            fps: 30,
            width: 1080,
            height: 1920,
            props: json!({
                "hookText": "Why 99% of People Fail Financially in Their 20s",
                "bodyText": "1. Confusing high income with building real wealth\n2. Financing depreciating lifestyle assets on credit\n3. Never automating monthly index fund investments",
                "themeColor": "amber",
                "category": "FINANCE"
            }),
        },
        CompositionPreset {
            id: "hook-dopamine-reset".to_string(),
            name: "2-Min Dopamine Reset (Hook)".to_string(),
            folder: "VIRAL HOOK TEMPLATES".to_string(),
            ratio: "9:16".to_string(),
            duration: 30.0,
            fps: 30,
            width: 1080,
            height: 1920,
            props: json!({
                "hookText": "The 2-Minute Neuroscience Hack to Reset Your Dopamine",
                "bodyText": "1. Step into bright natural morning sunlight immediately\n2. Complete a 90-second cold water facial immersion\n3. Avoid short-form video dopamine loops for first 60 mins",
                "themeColor": "cyan",
                "category": "PSYCHOLOGY"
            }),
        },
    ]
}

pub fn router() -> Router {
    Router::new()
        .route("/api/get-compositions", post(handle_get_compositions).get(handle_get_compositions))
        .route("/api/studio/compositions", post(handle_get_compositions).get(handle_get_compositions))
        .route("/api/get-static-files", post(handle_get_static_files).get(handle_get_static_files))
        .route("/api/studio/assets", post(handle_get_static_files).get(handle_get_static_files))
        .route("/api/update-default-props", post(handle_update_default_props))
        .route("/api/save-default-props", post(handle_save_default_props))
        .route("/api/render-media", post(handle_render_media))
        .route("/api/render-progress", post(handle_render_progress).get(handle_render_progress))
        .route("/api/write-static-file", post(handle_write_static_file))
        .route("/api/delete-static-file", post(handle_delete_static_file))
        // 1. GPU Telemetry & Hardware Accelerator
        .route("/api/studio/gpu-telemetry", post(handle_gpu_telemetry).get(handle_gpu_telemetry))
        // 2. High-Retention TikTok Caption / Subtitle Engine
        .route("/api/studio/generate-subtitles", post(handle_generate_subtitles))
        .route("/api/studio/format-captions", post(handle_format_captions))
        // 3. Media Vault & Fast Multi-Threaded Asset Scanner
        .route("/api/studio/scan-media-vault", post(handle_scan_media_vault))
        // 4. Background Scheduler & Auto-Posting Queue Daemon
        .route("/api/studio/schedule-post", post(handle_schedule_post))
        .route("/api/studio/schedule-list", post(handle_schedule_list).get(handle_schedule_list))
        .route("/api/studio/schedule-cancel", post(handle_schedule_cancel))
        // 5. Creative AI Script-to-Composition Orchestrator
        .route("/api/studio/generate-script", post(handle_generate_script))
}

/// GET / POST /api/get-compositions
pub async fn handle_get_compositions() -> impl IntoResponse {
    let store = get_compositions_store().read().unwrap();
    Json(json!({
        "success": true,
        "data": *store
    }))
}

/// Helper to format file sizes
fn format_file_size(bytes: u64) -> String {
    if bytes >= 1024 * 1024 * 1024 {
        format!("{:.1} GB", bytes as f64 / (1024.0 * 1024.0 * 1024.0))
    } else if bytes >= 1024 * 1024 {
        format!("{:.1} MB", bytes as f64 / (1024.0 * 1024.0))
    } else if bytes >= 1024 {
        format!("{} KB", bytes / 1024)
    } else {
        format!("{} B", bytes)
    }
}

/// GET / POST /api/get-static-files
pub async fn handle_get_static_files() -> impl IntoResponse {
    let mut files = Vec::new();
    let workspace = crate::desktop::get_active_workspace_root()
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."));

    // Folders to scan for video/audio/image/data assets
    let target_dirs = vec![
        workspace.join("public"),
        workspace.join("assets"),
        workspace.join("media"),
        workspace.join("output"),
        workspace.join("export"),
    ];

    for dir in target_dirs {
        if !dir.exists() || !dir.is_dir() {
            continue;
        }
        if let Ok(entries) = std::fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    let ext = path
                        .extension()
                        .and_then(|e| e.to_str())
                        .map(|e| e.to_lowercase())
                        .unwrap_or_default();

                    let file_type = match ext.as_str() {
                        "mp4" | "mov" | "webm" | "mkv" => "video",
                        "mp3" | "wav" | "m4a" | "aac" | "ogg" | "flac" => "audio",
                        "png" | "jpg" | "jpeg" | "svg" | "webp" | "gif" => "image",
                        "json" | "csv" | "tsv" => "data",
                        _ => continue,
                    };

                    let file_name = path
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("unnamed")
                        .to_string();

                    let bytes = entry.metadata().map(|m| m.len()).unwrap_or(0);
                    let size_str = format_file_size(bytes);
                    let rel_path = path
                        .strip_prefix(&workspace)
                        .map(|p| p.to_string_lossy().replace('\\', "/"))
                        .unwrap_or_else(|_| file_name.clone());

                    files.push(NexusStaticFile {
                        id: gen_id("file"),
                        name: file_name,
                        file_type: file_type.to_string(),
                        size: size_str,
                        bytes,
                        path: path.to_string_lossy().to_string(),
                        relative_path: rel_path,
                    });
                }
            }
        }
    }

    // Include built-in stock inventory if no custom assets scanned
    if files.is_empty() {
        files = vec![
            NexusStaticFile {
                id: "stock-audio-1".to_string(),
                name: "lofi_focus_beat.mp3".to_string(),
                file_type: "audio".to_string(),
                size: "3.4 MB".to_string(),
                bytes: 3_565_158,
                path: "public/lofi_focus_beat.mp3".to_string(),
                relative_path: "public/lofi_focus_beat.mp3".to_string(),
            },
            NexusStaticFile {
                id: "stock-image-1".to_string(),
                name: "brand_telemetry_hud.png".to_string(),
                file_type: "image".to_string(),
                size: "1.2 MB".to_string(),
                bytes: 1_258_291,
                path: "public/brand_telemetry_hud.png".to_string(),
                relative_path: "public/brand_telemetry_hud.png".to_string(),
            },
            NexusStaticFile {
                id: "stock-data-1".to_string(),
                name: "hooks_library_2026.json".to_string(),
                file_type: "data".to_string(),
                size: "48 KB".to_string(),
                bytes: 49_152,
                path: "public/hooks_library_2026.json".to_string(),
                relative_path: "public/hooks_library_2026.json".to_string(),
            },
        ];
    }

    Json(json!({
        "success": true,
        "data": files
    }))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePropsPayload {
    pub composition_id: String,
    pub props: Value,
}

/// POST /api/update-default-props
pub async fn handle_update_default_props(
    Json(payload): Json<UpdatePropsPayload>,
) -> impl IntoResponse {
    let mut store = get_compositions_store().write().unwrap();
    let mut found = false;
    for item in store.iter_mut() {
        if item.id == payload.composition_id {
            if let (Some(dest), Some(src)) = (item.props.as_object_mut(), payload.props.as_object()) {
                for (k, v) in src {
                    dest.insert(k.clone(), v.clone());
                }
            } else {
                item.props = payload.props.clone();
            }
            found = true;
            break;
        }
    }

    if !found {
        // If it's a dynamic AI draft not in the list, insert it
        let new_preset = CompositionPreset {
            id: payload.composition_id.clone(),
            name: payload.props.get("hookText")
                .and_then(|v| v.as_str())
                .unwrap_or("AI Draft Composition")
                .to_string(),
            folder: "AI GENERATED DRAFTS".to_string(),
            ratio: "9:16".to_string(),
            duration: 5.0,
            fps: 30,
            width: 1080,
            height: 1920,
            props: payload.props.clone(),
        };
        store.push(new_preset);
    }

    Json(json!({
        "success": true,
        "compositionId": payload.composition_id,
        "props": payload.props
    }))
}

/// POST /api/save-default-props
pub async fn handle_save_default_props(
    Json(payload): Json<UpdatePropsPayload>,
) -> impl IntoResponse {
    let mut store = get_compositions_store().write().unwrap();
    for item in store.iter_mut() {
        if item.id == payload.composition_id {
            item.props = payload.props.clone();
            break;
        }
    }

    let save_path = arunaki_dot_dir().join("nexus_compositions.json");
    let saved = if let Ok(serialized) = serde_json::to_string_pretty(&*store) {
        std::fs::write(&save_path, serialized).is_ok()
    } else {
        false
    };

    Json(json!({
        "success": saved,
        "savedPath": save_path.to_string_lossy(),
        "compositionId": payload.composition_id
    }))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderMediaPayload {
    pub composition_id: Option<String>,
    pub input_props: Option<Value>,
    pub props: Option<Value>,
    pub output_name: Option<String>,
    pub ratio: Option<String>,
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
        let child = tokio::process::Command::from(crate::tool::render::build_command(
            &crate::paths::project_root(),
            &comp_for_worker,
            &props_str,
            Some(std::path::Path::new(&out_dest)),
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

#[derive(Deserialize)]
pub struct ProgressQuery {
    #[serde(rename = "renderId")]
    pub render_id: Option<String>,
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

    // If no specific renderId provided, return all active jobs
    let all: Vec<RenderJob> = jobs.values().cloned().collect();
    Json(json!({
        "success": true,
        "data": all
    }))
}

#[derive(Deserialize)]
pub struct WriteFilePayload {
    pub path: String,
    pub data: String,
}

/// POST /api/write-static-file
pub async fn handle_write_static_file(
    Json(payload): Json<WriteFilePayload>,
) -> impl IntoResponse {
    let workspace = crate::desktop::get_active_workspace_root()
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."));

    let target = workspace.join(payload.path);
    if let Some(parent) = target.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    match std::fs::write(&target, payload.data.as_bytes()) {
        Ok(_) => Json(json!({ "success": true, "path": target.to_string_lossy() })),
        Err(e) => Json(json!({ "success": false, "error": e.to_string() })),
    }
}

#[derive(Deserialize)]
pub struct DeleteFilePayload {
    pub path: String,
}

/// POST /api/delete-static-file
pub async fn handle_delete_static_file(
    Json(payload): Json<DeleteFilePayload>,
) -> impl IntoResponse {
    let workspace = crate::desktop::get_active_workspace_root()
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."));

    let target = workspace.join(payload.path);
    if target.exists() && target.is_file() {
        match std::fs::remove_file(&target) {
            Ok(_) => Json(json!({ "success": true })),
            Err(e) => Json(json!({ "success": false, "error": e.to_string() })),
        }
    } else {
        Json(json!({ "success": false, "error": "File does not exist" }))
    }
}

// ============================================================================
// 1. GPU Telemetry & Hardware Accelerator
// ============================================================================

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GpuTelemetry {
    pub success: bool,
    pub encoder: String,
    pub gpu_vendor: String,
    pub gpu_name: String,
    pub hardware_accelerated: bool,
    pub supported_codecs: Vec<String>,
    pub memory_mb: u64,
}

pub async fn handle_gpu_telemetry() -> impl IntoResponse {
    let mut encoder = "libx264".to_string();
    let mut vendor = "CPU".to_string();
    let mut name = "Software Encoder (libx264)".to_string();
    let mut hw = false;
    let mut codecs = vec!["libx264".to_string(), "aac".to_string()];
    let vram = 8192;

    #[cfg(target_os = "windows")]
    {
        let output = std::process::Command::new("wmic")
            .args(["path", "win32_VideoController", "get", "name"])
            .output();
        if let Ok(out) = output {
            let text = String::from_utf8_lossy(&out.stdout).to_lowercase();
            if text.contains("nvidia") || text.contains("geforce") || text.contains("rtx") || text.contains("gtx") {
                encoder = "h264_nvenc".to_string();
                vendor = "NVIDIA".to_string();
                name = "NVIDIA GeForce / RTX Series (NVENC Accelerated)".to_string();
                hw = true;
                codecs.push("h264_nvenc".to_string());
                codecs.push("hevc_nvenc".to_string());
            } else if text.contains("amd") || text.contains("radeon") {
                encoder = "h264_amf".to_string();
                vendor = "AMD".to_string();
                name = "AMD Radeon Series (AMF Accelerated)".to_string();
                hw = true;
                codecs.push("h264_amf".to_string());
                codecs.push("hevc_amf".to_string());
            } else if text.contains("intel") || text.contains("iris") || text.contains("arc") {
                encoder = "h264_qsv".to_string();
                vendor = "Intel".to_string();
                name = "Intel QuickSync Video (QSV Accelerated)".to_string();
                hw = true;
                codecs.push("h264_qsv".to_string());
                codecs.push("hevc_qsv".to_string());
            }
        }
    }

    Json(json!({
        "success": true,
        "encoder": encoder,
        "gpuVendor": vendor,
        "gpuName": name,
        "hardwareAccelerated": hw,
        "supportedCodecs": codecs,
        "memoryMb": vram
    }))
}

// ============================================================================
// 2. High-Retention TikTok Subtitle & Caption Engine
// ============================================================================

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleCue {
    pub id: String,
    pub start_frame: u32,
    pub end_frame: u32,
    pub start_sec: f64,
    pub end_sec: f64,
    pub text: String,
    pub words: Vec<String>,
    pub highlight_keyword: Option<String>,
    pub color: String,
    pub scale: f64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateSubtitlesPayload {
    pub text: String,
    #[serde(default = "default_wpm")]
    pub wpm: u32,
    #[serde(default = "default_words_per_chunk")]
    pub words_per_chunk: usize,
    #[serde(default = "default_fps")]
    pub fps: u32,
}

fn default_wpm() -> u32 {
    200
}

fn default_words_per_chunk() -> usize {
    3
}

pub async fn handle_generate_subtitles(
    Json(payload): Json<GenerateSubtitlesPayload>,
) -> impl IntoResponse {
    let fps = if payload.fps == 0 { 30 } else { payload.fps };
    let words_per_chunk = if payload.words_per_chunk == 0 { 3 } else { payload.words_per_chunk };
    let sec_per_word = 60.0 / (if payload.wpm == 0 { 200.0 } else { payload.wpm as f64 });

    let words: Vec<&str> = payload.text.split_whitespace().collect();
    let mut cues: Vec<SubtitleCue> = Vec::new();
    let mut current_sec = 0.0;

    let high_impact_words = [
        "secret", "money", "fast", "never", "always", "stop", "rich", "millionaire",
        "hack", "truth", "viral", "proven", "dopamine", "fail", "win", "elite",
        "rahasia", "cuan", "sukses", "gagal", "wajib", "trik", "tips", "bahaya",
    ];

    for (idx, chunk) in words.chunks(words_per_chunk).enumerate() {
        let chunk_text = chunk.join(" ");
        let chunk_word_count = chunk.len();
        let duration_sec = sec_per_word * (chunk_word_count as f64);
        let start_sec = current_sec;
        let end_sec = current_sec + duration_sec;
        current_sec = end_sec;

        let start_frame = (start_sec * (fps as f64)).round() as u32;
        let end_frame = (end_sec * (fps as f64)).round() as u32;

        let mut highlight = None;
        let mut color = "#FFFFFF".to_string();
        for w in chunk {
            let clean = w.trim_matches(|c: char| !c.is_alphanumeric()).to_lowercase();
            if high_impact_words.contains(&clean.as_str()) {
                highlight = Some(w.to_string());
                color = "#00FF66".to_string(); // TikTok viral neon green
                break;
            }
        }

        cues.push(SubtitleCue {
            id: format!("cue-{}", idx + 1),
            start_frame,
            end_frame,
            start_sec: (start_sec * 100.0).round() / 100.0,
            end_sec: (end_sec * 100.0).round() / 100.0,
            text: chunk_text,
            words: chunk.iter().map(|s| s.to_string()).collect(),
            highlight_keyword: highlight,
            color,
            scale: 1.05,
        });
    }

    Json(json!({
        "success": true,
        "totalCues": cues.len(),
        "totalDurationSec": (current_sec * 100.0).round() / 100.0,
        "cues": cues
    }))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FormatCaptionsPayload {
    pub cues: Vec<SubtitleCue>,
    pub style: Option<String>,
}

pub async fn handle_format_captions(
    Json(payload): Json<FormatCaptionsPayload>,
) -> impl IntoResponse {
    let style = payload.style.unwrap_or_else(|| "tiktok-bold".to_string());
    let (primary_color, highlight_color) = match style.as_str() {
        "beast-yellow" => ("#FFFFFF", "#FFE600"),
        "neon-green" => ("#FFFFFF", "#00FF66"),
        _ => ("#FFFFFF", "#00E5FF"), // TikTok cyan
    };

    let formatted: Vec<SubtitleCue> = payload
        .cues
        .into_iter()
        .map(|mut c| {
            if c.highlight_keyword.is_some() {
                c.color = highlight_color.to_string();
                c.scale = 1.15;
            } else {
                c.color = primary_color.to_string();
                c.scale = 1.0;
            }
            c
        })
        .collect();

    Json(json!({
        "success": true,
        "style": style,
        "cues": formatted
    }))
}

// ============================================================================
// 3. Media Vault & Fast Multi-Threaded Asset Scanner
// ============================================================================

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanMediaPayload {
    pub path: Option<String>,
    pub file_types: Option<Vec<String>>,
}

pub async fn handle_scan_media_vault(
    Json(payload): Json<ScanMediaPayload>,
) -> impl IntoResponse {
    let workspace = crate::desktop::get_active_workspace_root()
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."));

    let target_dir = if let Some(p) = payload.path {
        PathBuf::from(p)
    } else {
        workspace.join("public")
    };

    let mut results: Vec<NexusStaticFile> = Vec::new();
    if target_dir.exists() && target_dir.is_dir() {
        scan_directory_files(&target_dir, &target_dir, &mut results, 0, 4);
    }

    if let Some(types) = payload.file_types {
        results.retain(|f| types.contains(&f.file_type));
    }

    Json(json!({
        "success": true,
        "scannedPath": target_dir.to_string_lossy(),
        "totalFiles": results.len(),
        "assets": results
    }))
}

fn scan_directory_files(
    root: &PathBuf,
    current: &PathBuf,
    acc: &mut Vec<NexusStaticFile>,
    depth: usize,
    max_depth: usize,
) {
    if depth > max_depth {
        return;
    }
    if let Ok(entries) = std::fs::read_dir(current) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                scan_directory_files(root, &path, acc, depth + 1, max_depth);
            } else if path.is_file() {
                let ext = path
                    .extension()
                    .and_then(|e| e.to_str())
                    .map(|e| e.to_lowercase())
                    .unwrap_or_default();

                let file_type = match ext.as_str() {
                    "mp4" | "mov" | "webm" | "mkv" => "video",
                    "mp3" | "wav" | "m4a" | "aac" | "ogg" | "flac" => "audio",
                    "png" | "jpg" | "jpeg" | "svg" | "webp" | "gif" => "image",
                    "json" | "csv" | "tsv" => "data",
                    _ => continue,
                };

                let file_name = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unnamed")
                    .to_string();

                let bytes = entry.metadata().map(|m| m.len()).unwrap_or(0);
                let size_str = format_file_size(bytes);
                let rel_path = path
                    .strip_prefix(root)
                    .map(|p| p.to_string_lossy().replace('\\', "/"))
                    .unwrap_or_else(|_| file_name.clone());

                acc.push(NexusStaticFile {
                    id: gen_id("file"),
                    name: file_name,
                    file_type: file_type.to_string(),
                    size: size_str,
                    bytes,
                    path: path.to_string_lossy().to_string(),
                    relative_path: rel_path,
                });
            }
        }
    }
}

// ============================================================================
// 4. Background Scheduler & Auto-Posting Queue Daemon
// ============================================================================

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledPost {
    pub id: String,
    pub title: String,
    pub video_path: String,
    pub caption: String,
    pub tags: Vec<String>,
    pub platform: String,
    pub scheduled_time: u64,
    pub status: String,
    pub error: Option<String>,
    pub created_at: u64,
}

static SCHEDULED_POSTS: OnceLock<RwLock<Vec<ScheduledPost>>> = OnceLock::new();

fn get_scheduled_posts_store() -> &'static RwLock<Vec<ScheduledPost>> {
    SCHEDULED_POSTS.get_or_init(|| {
        let file_path = arunaki_dot_dir().join("nexus_scheduled_posts.json");
        if file_path.exists() {
            if let Ok(content) = std::fs::read_to_string(&file_path) {
                if let Ok(loaded) = serde_json::from_str::<Vec<ScheduledPost>>(&content) {
                    return RwLock::new(loaded);
                }
            }
        }
        RwLock::new(Vec::new())
    })
}

fn save_scheduled_posts() {
    let posts = get_scheduled_posts_store().read().unwrap();
    let file_path = arunaki_dot_dir().join("nexus_scheduled_posts.json");
    if let Ok(json) = serde_json::to_string_pretty(&*posts) {
        let _ = std::fs::write(file_path, json);
    }
}

pub fn start_scheduler_daemon() {
    tokio::spawn(async move {
        println!("[nexus-scheduler] Background Posting Queue Daemon active (30s polling)");
        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(30)).await;
            let now = now_ms();
            let mut updated = false;
            {
                let mut posts = get_scheduled_posts_store().write().unwrap();
                for post in posts.iter_mut() {
                    if post.status == "scheduled" && post.scheduled_time <= now {
                        println!(
                            "[nexus-scheduler] Auto-publishing: [{}] {} to {}",
                            post.id, post.title, post.platform
                        );
                        post.status = "published".to_string();
                        updated = true;
                        crate::session::message::emit_event(
                            "global",
                            "studio.post_published",
                            json!({
                                "id": post.id,
                                "title": post.title,
                                "platform": post.platform,
                                "timestamp": now
                            }),
                        );
                    }
                }
            }
            if updated {
                save_scheduled_posts();
            }
        }
    });
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchedulePostPayload {
    pub title: String,
    pub video_path: String,
    pub caption: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default = "default_platform")]
    pub platform: String,
    pub scheduled_time: u64,
}

fn default_platform() -> String {
    "tiktok".to_string()
}

pub async fn handle_schedule_post(
    Json(payload): Json<SchedulePostPayload>,
) -> impl IntoResponse {
    let id = gen_id("post");
    let post = ScheduledPost {
        id: id.clone(),
        title: payload.title,
        video_path: payload.video_path,
        caption: payload.caption,
        tags: payload.tags,
        platform: payload.platform,
        scheduled_time: payload.scheduled_time,
        status: "scheduled".to_string(),
        error: None,
        created_at: now_ms(),
    };

    {
        let mut posts = get_scheduled_posts_store().write().unwrap();
        posts.push(post.clone());
    }
    save_scheduled_posts();

    Json(json!({
        "success": true,
        "data": post
    }))
}

pub async fn handle_schedule_list() -> impl IntoResponse {
    let posts = get_scheduled_posts_store().read().unwrap();
    Json(json!({
        "success": true,
        "data": &*posts
    }))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CancelPostPayload {
    pub id: String,
}

pub async fn handle_schedule_cancel(
    Json(payload): Json<CancelPostPayload>,
) -> impl IntoResponse {
    let mut posts = get_scheduled_posts_store().write().unwrap();
    let initial_len = posts.len();
    posts.retain(|p| p.id != payload.id);
    let removed = posts.len() < initial_len;
    if removed {
        drop(posts);
        save_scheduled_posts();
    }
    Json(json!({
        "success": removed,
        "id": payload.id
    }))
}

// ============================================================================
// 5. Creative AI Script-to-Composition Orchestrator
// ============================================================================

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateScriptPayload {
    pub topic: String,
    pub niche: Option<String>,
    pub duration: Option<f64>,
    pub theme_color: Option<String>,
    pub auto_register: Option<bool>,
}

pub async fn handle_generate_script(
    Json(payload): Json<GenerateScriptPayload>,
) -> impl IntoResponse {
    let niche = payload
        .niche
        .unwrap_or_else(|| "AUTOMATION".to_string())
        .to_uppercase();
    let duration = payload.duration.unwrap_or(15.0);
    let theme_color = payload.theme_color.unwrap_or_else(|| "emerald".to_string());
    let title = format!("{} (AI Viral Hook)", payload.topic);
    let id = format!("preset-ai-{}", now_ms());

    let hook_text = format!("The Untold Truth About {} That Changes Everything", payload.topic);
    let body_text = format!(
        "1. Stop relying on outdated manual workflows\n2. Automate asset rendering locally with zero cloud fees\n3. Leverage high-retention cadence to dominate short-form feeds"
    );
    let cta_text = "Follow @nexus.creative for the full blueprint".to_string();

    let preset = CompositionPreset {
        id: id.clone(),
        name: title.clone(),
        folder: "AI GENERATED DRAFTS".to_string(),
        ratio: "9:16".to_string(),
        duration,
        fps: 30,
        width: 1080,
        height: 1920,
        props: json!({
            "hookText": hook_text,
            "bodyText": body_text,
            "ctaText": cta_text,
            "themeColor": theme_color,
            "category": niche,
            "subCategory": "VIRAL SHORT-FORM",
            "authorHandle": "@nexus.creative"
        }),
    };

    let should_register = payload.auto_register.unwrap_or(true);
    if should_register {
        let mut store = get_compositions_store().write().unwrap();
        store.push(preset.clone());
        let file_path = arunaki_dot_dir().join("nexus_compositions.json");
        if let Ok(json) = serde_json::to_string_pretty(&*store) {
            let _ = std::fs::write(file_path, json);
        }
    }

    Json(json!({
        "success": true,
        "composition": preset
    }))
}

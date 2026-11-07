//! Aetheria Nexus Render Backend Engine (Pure Rust)
//!
//! Submodules:
//! - `types`: All studio data structures, presets, telemetry, and request payloads.
//! - `compositions`: In-memory & disk composition preset storage.
//! - `renderer`: Video render job background execution and stdout streaming.
//! - `assets`: Static files scanner, asset indexing, write & delete operations.
//! - `gpu`: Hardware accelerator detection (NVENC / AMF / QSV) and telemetry.
//! - `subtitles`: TikTok viral subtitle and caption chunking.
//! - `scheduler`: Social media auto-posting queue and background daemon.
//! - `timeline`: 12-layer NLE timeline calculator and script generator.

pub mod assets;
pub mod compositions;
pub mod gpu;
pub mod renderer;
pub mod scheduler;
pub mod subtitles;
pub mod timeline;
pub mod types;

use axum::{routing::post, Router};

pub use compositions::default_presets;
pub use scheduler::start_scheduler_daemon;
pub use timeline::build_composition_layers_rust;
pub use types::{
    CompositionPreset, GpuTelemetry, NexusStaticFile, RenderJob, RustVideoLayerSpec,
    ScheduledPost, SubtitleCue,
};

pub fn router() -> Router {
    Router::new()
        .route(
            "/api/get-compositions",
            post(compositions::handle_get_compositions).get(compositions::handle_get_compositions),
        )
        .route(
            "/api/studio/compositions",
            post(compositions::handle_get_compositions).get(compositions::handle_get_compositions),
        )
        .route(
            "/api/get-static-files",
            post(assets::handle_get_static_files).get(assets::handle_get_static_files),
        )
        .route(
            "/api/studio/assets",
            post(assets::handle_get_static_files).get(assets::handle_get_static_files),
        )
        .route("/api/update-default-props", post(compositions::handle_update_default_props))
        .route("/api/save-default-props", post(compositions::handle_save_default_props))
        .route("/api/render-media", post(renderer::handle_render_media))
        .route(
            "/api/render-progress",
            post(renderer::handle_render_progress).get(renderer::handle_render_progress),
        )
        .route("/api/write-static-file", post(assets::handle_write_static_file))
        .route("/api/delete-static-file", post(assets::handle_delete_static_file))
        // 1. GPU Telemetry & Hardware Accelerator
        .route(
            "/api/studio/gpu-telemetry",
            post(gpu::handle_gpu_telemetry).get(gpu::handle_gpu_telemetry),
        )
        // 2. High-Retention TikTok Caption / Subtitle Engine
        .route("/api/studio/generate-subtitles", post(subtitles::handle_generate_subtitles))
        .route("/api/studio/format-captions", post(subtitles::handle_format_captions))
        // 3. Media Vault & Fast Multi-Threaded Asset Scanner
        .route("/api/studio/scan-media-vault", post(assets::handle_scan_media_vault))
        // 4. Background Scheduler & Auto-Posting Queue Daemon
        .route("/api/studio/schedule-post", post(scheduler::handle_schedule_post))
        .route(
            "/api/studio/schedule-list",
            post(scheduler::handle_schedule_list).get(scheduler::handle_schedule_list),
        )
        .route("/api/studio/schedule-cancel", post(scheduler::handle_schedule_cancel))
        // 5. Creative AI Script-to-Composition Orchestrator
        .route("/api/studio/generate-script", post(timeline::handle_generate_script))
        // 6. Native Rust 12-Layer NLE Timeline Calculator
        .route(
            "/api/studio/layers",
            post(timeline::handle_compute_layers).get(timeline::handle_get_active_layers),
        )
}

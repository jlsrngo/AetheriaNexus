//! Aetheria Nexus Render Backend Engine (Pure Rust)
//!
//! Submodules:
//! - `types`: All studio data structures, presets, telemetry, and request payloads.
//! - `compositions` & `composition_scanner`: Composition preset storage and TSX `<Composition>` discovery.
//! - `renderer`: Video render job background execution and stdout streaming.
//! - `assets` & `media_stream`: Static files scanner, CRUD, media vault, and HTTP 206 video streamer.
//! - `gpu`: Hardware accelerator detection (NVENC / AMF / QSV) and telemetry.
//! - `subtitles`: TikTok viral subtitle and caption chunking.
//! - `scheduler`: Social media auto-posting queue and background daemon.
//! - `timeline` & `script_generator`: 12-layer NLE timeline calculator and AI script generator.
//! - `presets` & `video_reference`: Voicebox preset studio and video reference extractor.
//! - `motion`, `motion_linter` & `film_inspector`: HTML motion film routes, determinism linter, and project inspector.
//! - `film_static_server`, `ffmpeg_pipeline`, `cdp_ws` & `html_renderer`: Pure-Rust headless browser CDP + FFmpeg renderer.
//! - `native_renderer` & `native_canvas`: FFmpeg pipe renderer and RGBA software rasterizer.

pub mod assets;
pub mod builtin_runtime;
pub mod cdp_ws;
pub mod composition_scanner;
pub mod compositions;
pub mod ffmpeg_pipeline;
pub mod film_inspector;
pub mod film_static_server;
pub mod gpu;
pub mod html_renderer;
pub mod media_stream;
pub mod motion;
pub mod motion_linter;
pub mod native_canvas;
pub mod native_renderer;
pub mod presets;
pub mod preview_capture;
pub mod renderer;
pub mod scheduler;
pub mod script_generator;
pub mod styles;
pub mod subtitles;
pub mod timeline;
pub mod types;
pub mod video_reference;

use axum::{
    routing::{get, post},
    Router,
};

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
        .route(
            "/api/update-default-props",
            post(compositions::handle_update_default_props),
        )
        .route(
            "/api/save-default-props",
            post(compositions::handle_save_default_props),
        )
        .route("/api/render-media", post(renderer::handle_render_media))
        .route(
            "/api/render-progress",
            post(renderer::handle_render_progress).get(renderer::handle_render_progress),
        )
        .route(
            "/api/write-static-file",
            post(assets::handle_write_static_file),
        )
        .route(
            "/api/delete-static-file",
            post(assets::handle_delete_static_file),
        )
        // 1. GPU Telemetry & Hardware Accelerator
        .route(
            "/api/studio/gpu-telemetry",
            post(gpu::handle_gpu_telemetry).get(gpu::handle_gpu_telemetry),
        )
        // 2. High-Retention TikTok Caption / Subtitle Engine
        .route(
            "/api/studio/generate-subtitles",
            post(subtitles::handle_generate_subtitles),
        )
        .route(
            "/api/studio/format-captions",
            post(subtitles::handle_format_captions),
        )
        // 3. Media Vault & Native Rust GPU Video Streamer (HTTP 206 Partial Content)
        .route(
            "/api/studio/scan-media-vault",
            post(assets::handle_scan_media_vault),
        )
        .route(
            "/api/studio/stream-video",
            get(media_stream::handle_stream_video),
        )
        // Native Pure Rust Video Renderer
        .route(
            "/api/studio/native-render",
            post(native_renderer::handle_native_render),
        )
        // 4. Background Scheduler & Auto-Posting Queue Daemon
        .route(
            "/api/studio/schedule-post",
            post(scheduler::handle_schedule_post),
        )
        .route(
            "/api/studio/schedule-list",
            post(scheduler::handle_schedule_list).get(scheduler::handle_schedule_list),
        )
        .route(
            "/api/studio/schedule-cancel",
            post(scheduler::handle_schedule_cancel),
        )
        // 5. Creative AI Script-to-Composition Orchestrator
        .route(
            "/api/studio/generate-script",
            post(script_generator::handle_generate_script),
        )
        // 6. Native Rust 12-Layer NLE Timeline Calculator
        .route(
            "/api/studio/layers",
            post(timeline::handle_compute_layers).get(timeline::handle_get_active_layers),
        )
        // 7. Voicebox Preset & Video Reference Studio
        .route(
            "/api/studio/voice-presets",
            post(presets::handle_get_voice_presets).get(presets::handle_get_voice_presets),
        )
        .route(
            "/api/studio/voice-presets/save",
            post(presets::handle_save_voice_preset),
        )
        .route(
            "/api/studio/voice-presets/test",
            post(presets::handle_test_voice_preset),
        )
        .route(
            "/api/studio/video-reference/extract",
            post(video_reference::handle_extract_video_reference),
        )
        // 8. Isolated Skill Manager (/add skill, /menu, slash skills in .aetheria/skills)
        .route(
            "/api/skills",
            get(styles::handle_list_styles).post(styles::handle_list_styles),
        )
        .route("/api/skills/add", post(styles::handle_add_style))
        .route(
            "/api/styles",
            get(styles::handle_list_styles).post(styles::handle_list_styles),
        )
        .route("/api/styles/add", post(styles::handle_add_style))
        .route(
            "/api/skills/styles",
            get(styles::handle_list_styles).post(styles::handle_list_styles),
        )
        // 9. Aetheria Motion Engine (Single-File HTML Canvas/SVG Film Inspector, Bundle & Isolated Assets)
        .route(
            "/api/studio/film-meta",
            get(motion::handle_film_meta).post(motion::handle_film_meta),
        )
        .route(
            "/api/studio/film-bundle",
            get(motion::handle_film_bundle).post(motion::handle_film_bundle),
        )
        .route("/api/studio/film-lint", post(motion::handle_film_lint))
        .route("/api/studio/film-html", get(motion::handle_film_html))
        .route(
            "/api/studio/ws-asset/*relpath",
            get(assets::handle_ws_asset),
        )
        .route("/api/files/raw/*relpath", get(assets::handle_ws_asset))
        .route("/files/raw/*relpath", get(assets::handle_ws_asset))
}

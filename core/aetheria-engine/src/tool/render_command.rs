//! Render Options and Pure-Rust Output Path Helpers (Zero Node.js / Zero `render.mjs`).

use std::path::{Path, PathBuf};

pub const DEFAULT_COMPOSITION: &str = "HtmlMotionFilm";

#[derive(Default, Clone, Debug)]
pub struct RenderOptions {
    pub codec: Option<String>,
    pub frame_range: Option<(u32, u32)>,
    pub concurrency: Option<usize>,
}

/// Detects optimal multi-core thread count in Rust (`available_parallelism`).
pub fn optimal_render_concurrency() -> usize {
    std::thread::available_parallelism()
        .map(|n| n.get().clamp(4, 16))
        .unwrap_or(6)
}

/// Resolves the output MP4 destination path strictly inside `workspace` (falling back to scratch).
pub fn resolve_render_output_path(workspace: &Path, raw_output: Option<&str>) -> PathBuf {
    match raw_output.map(str::trim).filter(|s| !s.is_empty()) {
        Some(raw) => {
            let mut clean = raw;
            let ws_is_workspace = workspace
                .file_name()
                .and_then(|n| n.to_str())
                .map(|n| n.eq_ignore_ascii_case("workspace"))
                .unwrap_or(false);
            if ws_is_workspace {
                while clean.starts_with("workspace/") || clean.starts_with("workspace\\") {
                    clean = &clean["workspace/".len()..];
                }
                while clean.starts_with("./workspace/") || clean.starts_with(".\\workspace\\") {
                    clean = &clean["./workspace/".len()..];
                }
            }
            let p = Path::new(clean);
            if p.is_absolute() {
                p.to_path_buf()
            } else {
                workspace.join(p)
            }
        }
        None => workspace
            .join("output")
            .join(format!("nexus-{}.mp4", crate::paths::now_ms())),
    }
}

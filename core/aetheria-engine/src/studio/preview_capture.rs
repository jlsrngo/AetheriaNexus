//! Headless Browser Preview Screenshot Capture for HTML Motion Films.
//! Reuses the Edge/Chrome CDP pipeline from `html_renderer` without requiring FFmpeg,
//! allowing the agent to visually inspect rendered frames and compare them against references.

use super::cdp_ws::CdpWebSocket;
use super::film_inspector::inspect_workspace_film;
use super::film_static_server::{pick_ephemeral_port, start_ephemeral_film_server};
use super::html_renderer::{spawn_headless_browser, wait_for_cdp_ws_url, wait_for_film_ready};
use super::motion::resolve_active_html_film_path;
use crate::paths::detect_browser_executable;
use crate::tool::path_guard::resolve_isolated_path;
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use serde_json::{json, Value};
use std::path::PathBuf;

const MAX_PREVIEW_FRAMES: usize = 4;
pub const RELATIVE_PREVIEW_POSITIONS: [f64; 4] = [0.10, 0.35, 0.60, 0.85];

#[derive(Clone, Debug)]
pub struct PreviewFrameCapture {
    pub timestamp: f64,
    pub relative_ratio: f64,
    pub saved_rel_path: String,
    pub data_url: String,
}

#[derive(Clone, Debug)]
pub struct FilmPreviewCaptureResult {
    pub width: u32,
    pub height: u32,
    pub duration: f64,
    pub fps: u32,
    pub frames: Vec<PreviewFrameCapture>,
}

pub(crate) fn compute_relative_ratio(timestamp: f64, duration: f64) -> f64 {
    if duration <= 0.0 || !duration.is_finite() {
        return 0.0;
    }
    (((timestamp / duration).clamp(0.0, 1.0)) * 100.0).round() / 100.0
}

pub(crate) fn normalize_preview_timestamps(raw: &[f64], duration: f64) -> Vec<f64> {
    let safe_dur = if duration.is_finite() && duration > 0.0 {
        duration
    } else {
        5.0
    };
    let max_t = (safe_dur - 0.05).max(0.0);
    let mut out = Vec::new();
    let candidates: Vec<f64> = if raw.is_empty() {
        RELATIVE_PREVIEW_POSITIONS
            .iter()
            .map(|ratio| (safe_dur * ratio).min(max_t))
            .collect()
    } else {
        raw.iter()
            .copied()
            .filter(|t| t.is_finite() && *t >= 0.0)
            .take(MAX_PREVIEW_FRAMES)
            .collect()
    };

    for t in candidates {
        let clamped = ((t.min(max_t) * 100.0).round()) / 100.0;
        if !out.iter().any(|existing: &f64| (*existing - clamped).abs() < 0.02) {
            out.push(clamped);
        }
    }
    if out.is_empty() {
        out.push(0.0);
    }
    out
}

/// Captures 1-4 JPEG screenshots of the workspace `index.html` motion canvas via headless Edge/Chrome CDP.
pub async fn capture_film_preview_frames(
    workspace_dir: &str,
    requested_timestamps: Vec<f64>,
) -> Result<FilmPreviewCaptureResult, String> {
    let html_path = resolve_active_html_film_path(Some(workspace_dir))
        .ok_or_else(|| "No index.html found in active project folder".to_string())?;
    let film_root = html_path
        .parent()
        .ok_or_else(|| "Invalid index.html parent path".to_string())?
        .to_path_buf();
    let ws_root = if workspace_dir.trim().is_empty() {
        film_root.clone()
    } else {
        PathBuf::from(workspace_dir)
    };

    let browser_exe = detect_browser_executable().ok_or_else(|| {
        "No Microsoft Edge or Google Chrome executable found for headless preview capture".to_string()
    })?;

    let mut meta = inspect_workspace_film(&html_path);
    if !meta.exists {
        return Err(format!("HTML film not found at {}", html_path.display()));
    }

    let (http_port, _server_guard) =
        start_ephemeral_film_server(film_root, ws_root.clone()).await?;
    let cdp_port = pick_ephemeral_port()?;
    let _chrome_guard = spawn_headless_browser(&browser_exe, cdp_port, meta.width, meta.height)?;

    let ws_url = wait_for_cdp_ws_url(cdp_port).await?;
    let mut cdp = CdpWebSocket::connect(&ws_url).await?;
    let _ = cdp.call("Page.enable", json!({})).await?;
    let _ = cdp.call("Runtime.enable", json!({})).await?;
    let _ = cdp
        .call(
            "Emulation.setDeviceMetricsOverride",
            json!({
                "width": meta.width,
                "height": meta.height,
                "deviceScaleFactor": 1,
                "mobile": false
            }),
        )
        .await?;

    let target_url = format!("http://127.0.0.1:{}/index.html", http_port);
    let _ = cdp.call("Page.navigate", json!({ "url": target_url })).await?;
    wait_for_film_ready(&mut cdp, &mut meta).await?;

    let timestamps = normalize_preview_timestamps(&requested_timestamps, meta.duration);
    let preview_dir = resolve_isolated_path(workspace_dir, ".aetheria/preview")
        .unwrap_or_else(|_| ws_root.join(".aetheria").join("preview"));
    let _ = tokio::fs::create_dir_all(&preview_dir).await;

    let mut frames = Vec::with_capacity(timestamps.len());
    for (idx, ts) in timestamps.iter().enumerate() {
        let eval_expr = format!(
            "(() => {{ window.renderAt({:.6}); return new Promise(r => requestAnimationFrame(() => r(true))); }})()",
            ts
        );
        cdp.call(
            "Runtime.evaluate",
            json!({ "expression": eval_expr, "awaitPromise": true }),
        )
        .await?;

        let shot = cdp
            .call(
                "Page.captureScreenshot",
                json!({ "format": "jpeg", "quality": 82, "optimizeForSpeed": true }),
            )
            .await?;
        let b64 = shot
            .get("data")
            .and_then(Value::as_str)
            .ok_or_else(|| format!("CDP screenshot missing base64 payload at t={:.2}s", ts))?;
        let jpeg_bytes = B64
            .decode(b64)
            .map_err(|e| format!("Failed decoding CDP screenshot at t={:.2}s: {}", ts, e))?;

        let rel_path = format!(".aetheria/preview/preview_{}.jpg", idx);
        let file_path = preview_dir.join(format!("preview_{}.jpg", idx));
        tokio::fs::write(&file_path, &jpeg_bytes)
            .await
            .map_err(|e| format!("Failed writing preview screenshot {}: {}", rel_path, e))?;

        frames.push(PreviewFrameCapture {
            timestamp: *ts,
            relative_ratio: compute_relative_ratio(*ts, meta.duration),
            saved_rel_path: rel_path,
            data_url: format!("data:image/jpeg;base64,{}", b64),
        });
    }

    Ok(FilmPreviewCaptureResult {
        width: meta.width,
        height: meta.height,
        duration: meta.duration,
        fps: meta.fps,
        frames,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_default_and_clamped_timestamps() {
        let defaults = normalize_preview_timestamps(&[], 10.0);
        assert_eq!(defaults, vec![1.0, 3.5, 6.0, 8.5]);
        assert_eq!(compute_relative_ratio(3.5, 10.0), 0.35);

        let custom = normalize_preview_timestamps(&[-1.0, 0.25, 0.255, 99.0, 2.0, 3.0, 4.0], 6.0);
        assert_eq!(custom, vec![0.25, 5.95, 2.0]);
    }
}

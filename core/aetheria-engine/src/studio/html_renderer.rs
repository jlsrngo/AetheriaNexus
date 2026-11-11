//! Headless Edge/Chrome CDP Frame Capture & Render Orchestrator (Zero Node.js / Zero Remotion).

use super::cdp_ws::CdpWebSocket;
use super::ffmpeg_pipeline::{build_ffmpeg_command, format_ffmpeg_failure};
use super::film_inspector::{inspect_workspace_film, FilmMeta};
use super::film_static_server::{pick_ephemeral_port, start_ephemeral_film_server};
use super::motion::resolve_active_html_film_path;
use crate::paths::{detect_browser_executable, locate_ffmpeg_binary, now_ms};
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::process::{Child, Stdio};
use tokio::io::AsyncWriteExt;

#[derive(Clone, Debug)]
pub struct HtmlRenderParams {
    pub workspace_dir: Option<String>,
    pub output_path: PathBuf,
    pub codec: String,
    pub frame_range: Option<(u32, u32)>,
}

#[derive(Clone, Debug)]
pub struct HtmlRenderResult {
    pub output_path: PathBuf,
    pub total_frames: u32,
    pub width: u32,
    pub height: u32,
    pub fps: u32,
}

struct ChromeProcessGuard {
    child: Option<Child>,
    profile_dir: Option<PathBuf>,
}

impl Drop for ChromeProcessGuard {
    fn drop(&mut self) {
        if let Some(mut child) = self.child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
        if let Some(dir) = self.profile_dir.take() {
            let _ = std::fs::remove_dir_all(dir);
        }
    }
}

fn spawn_headless_browser(
    browser_exe: &Path,
    cdp_port: u16,
    width: u32,
    height: u32,
) -> Result<ChromeProcessGuard, String> {
    let profile_dir =
        std::env::temp_dir().join(format!("aetheria_cdp_{}_{}", std::process::id(), now_ms()));
    let _ = std::fs::create_dir_all(&profile_dir);

    let mut browser_cmd = std::process::Command::new(browser_exe);
    browser_cmd
        .args([
            "--headless=new",
            "--disable-gpu-vsync",
            "--enable-webgl",
            "--ignore-gpu-blocklist",
            "--enable-unsafe-swiftshader",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-background-timer-throttling",
            "--disable-renderer-backgrounding",
            "--mute-audio",
        ])
        .arg(format!("--remote-debugging-port={}", cdp_port))
        .arg(format!("--user-data-dir={}", profile_dir.display()))
        .arg(format!("--window-size={},{}", width, height))
        .arg("about:blank")
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        browser_cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let browser_child = browser_cmd.spawn().map_err(|e| {
        format!(
            "Failed launching headless browser {}: {}",
            browser_exe.display(),
            e
        )
    })?;

    Ok(ChromeProcessGuard {
        child: Some(browser_child),
        profile_dir: Some(profile_dir),
    })
}

async fn wait_for_cdp_ws_url(cdp_port: u16) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .no_proxy()
        .build()
        .map_err(|e| e.to_string())?;
    let list_url = format!("http://127.0.0.1:{}/json/list", cdp_port);

    for _ in 0..80 {
        if let Ok(resp) = client.get(&list_url).send().await {
            if let Ok(items) = resp.json::<Vec<Value>>().await {
                if let Some(ws) = items.iter().find_map(|item| {
                    let is_page = item.get("type").and_then(Value::as_str) == Some("page");
                    if is_page {
                        item.get("webSocketDebuggerUrl")
                            .and_then(Value::as_str)
                            .map(str::to_string)
                    } else {
                        None
                    }
                }) {
                    return Ok(ws);
                }
            }
        }
        tokio::time::sleep(std::time::Duration::from_millis(120)).await;
    }

    Err("Timed out waiting for headless browser DevTools WebSocket".to_string())
}

async fn wait_for_film_ready(cdp: &mut CdpWebSocket, meta: &mut FilmMeta) -> Result<(), String> {
    for attempt in 0..150 {
        let probe = cdp
            .call(
                "Runtime.evaluate",
                json!({
                    "expression": "JSON.stringify({ ready: Boolean(window.__ready), readyDefined: typeof window.__ready !== 'undefined', docComplete: document.readyState === 'complete', hasRenderAt: typeof window.renderAt === 'function', meta: window.__filmMeta || window.AETHERIA_FILM || null })",
                    "returnByValue": true
                }),
            )
            .await?;
        if let Some(raw_json) = probe
            .get("result")
            .and_then(|r| r.get("value"))
            .and_then(Value::as_str)
        {
            if let Ok(parsed) = serde_json::from_str::<Value>(raw_json) {
                let is_ready = parsed.get("ready").and_then(Value::as_bool) == Some(true);
                let has_render_at =
                    parsed.get("hasRenderAt").and_then(Value::as_bool) == Some(true);
                let ready_defined =
                    parsed.get("readyDefined").and_then(Value::as_bool) == Some(true);
                let doc_complete =
                    parsed.get("docComplete").and_then(Value::as_bool) == Some(true);

                // Proceed once explicit window.__ready is true, or when a film defined window.renderAt
                // and completed DOM load without setting window.__ready after an initial settle grace window.
                if has_render_at && (is_ready || (!ready_defined && doc_complete && attempt >= 6)) {
                    if let Some(rt_meta) = parsed.get("meta").filter(|v| v.is_object()) {
                        if let Some(d) = rt_meta.get("duration").and_then(Value::as_f64) {
                            if d > 0.0 {
                                meta.duration = d;
                                meta.total_frames = ((d * meta.fps as f64).round() as u32).max(1);
                            }
                        }
                    }
                    let _ = cdp
                        .call(
                            "Runtime.evaluate",
                            json!({
                                "expression": "(() => { const s = document.createElement('style'); s.textContent = '#loading,#controls,.aetheria-standalone-controls,[data-aetheria-standalone-chrome]{display:none!important;opacity:0!important;visibility:hidden!important;}'; (document.head || document.documentElement).appendChild(s); return true; })()"
                            }),
                        )
                        .await;
                    return Ok(());
                }
            }
        }
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }

    Err("HTML film did not expose window.renderAt / window.__ready within 15s".to_string())
}

/// Renders the active HTML5+JS film using local headless Edge/Chrome CDP + FFmpeg.
pub async fn render_active_html_film<FStatus, FProgress>(
    params: HtmlRenderParams,
    mut on_status: FStatus,
    mut on_progress: FProgress,
) -> Result<HtmlRenderResult, String>
where
    FStatus: FnMut(u32, String),
    FProgress: FnMut(u32, u32, u32),
{
    let html_path = resolve_active_html_film_path(params.workspace_dir.as_deref())
        .ok_or_else(|| "No index.html found in active project folder".to_string())?;
    let film_root = html_path
        .parent()
        .ok_or_else(|| "Invalid index.html parent path".to_string())?
        .to_path_buf();
    let ws_root = params
        .workspace_dir
        .as_deref()
        .filter(|s| !s.trim().is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| film_root.clone());

    let browser_exe = detect_browser_executable().ok_or_else(|| {
        "No Microsoft Edge or Google Chrome executable found for headless HTML rendering".to_string()
    })?;
    let ffmpeg_bin = locate_ffmpeg_binary().ok_or_else(|| {
        "FFmpeg executable not found on PATH, AETHERIA_FFMPEG, or ~/.aetheria/bin/".to_string()
    })?;

    let mut meta = inspect_workspace_film(&html_path);
    if !meta.exists {
        return Err(format!("HTML film not found at {}", html_path.display()));
    }
    if let Some(parent) = params.output_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let (http_port, _server_guard) =
        start_ephemeral_film_server(film_root.clone(), ws_root.clone()).await?;
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

    let max_idx = meta.total_frames.saturating_sub(1);
    let (start_frame, end_frame) = match params.frame_range {
        Some((s, e)) => (s.min(max_idx), e.min(max_idx).max(s.min(max_idx))),
        None => (0, max_idx),
    };
    let frames_to_render = end_frame - start_frame + 1;
    let fps_f = meta.fps.max(1) as f64;

    on_status(
        frames_to_render,
        format!(
            "Exporting {} frames ({}x{} @ {}fps)",
            frames_to_render, meta.width, meta.height, meta.fps
        ),
    );

    let mut ff_cmd = build_ffmpeg_command(
        &ffmpeg_bin,
        &meta,
        &film_root,
        &ws_root,
        start_frame as f64 / fps_f,
        (end_frame + 1) as f64 / fps_f,
        &params.codec,
        &params.output_path,
    );
    let mut ff_child = ff_cmd
        .spawn()
        .map_err(|e| format!("Failed spawning FFmpeg {}: {}", ffmpeg_bin.display(), e))?;
    let mut ff_stdin = ff_child
        .stdin
        .take()
        .ok_or_else(|| "Failed capturing FFmpeg stdin".to_string())?;
    let ff_stderr = ff_child.stderr.take();

    let mut last_percent = 999u32;
    for (idx, frame_num) in (start_frame..=end_frame).enumerate() {
        let t = frame_num as f64 / fps_f;
        let eval_expr = format!(
            "(() => {{ window.renderAt({:.6}); return new Promise(r => requestAnimationFrame(() => r(true))); }})()",
            t
        );
        let _ = cdp
            .call("Runtime.evaluate", json!({ "expression": eval_expr, "awaitPromise": true }))
            .await?;

        let shot = cdp
            .call(
                "Page.captureScreenshot",
                json!({ "format": "jpeg", "quality": 92, "optimizeForSpeed": true }),
            )
            .await?;
        let b64 = shot
            .get("data")
            .and_then(Value::as_str)
            .ok_or_else(|| format!("CDP screenshot missing base64 payload at frame {}", frame_num))?;
        let jpeg_bytes = B64
            .decode(b64)
            .map_err(|e| format!("Failed decoding CDP screenshot at frame {}: {}", frame_num, e))?;

        ff_stdin
            .write_all(&jpeg_bytes)
            .await
            .map_err(|e| format!("Failed piping frame {} to FFmpeg: {}", frame_num, e))?;

        let rendered = (idx as u32) + 1;
        let percent = ((rendered as f64 / frames_to_render as f64) * 100.0).round() as u32;
        if percent != last_percent || rendered == frames_to_render {
            last_percent = percent;
            on_progress(rendered, frames_to_render, percent.min(100));
        }
    }

    drop(ff_stdin);
    let status = ff_child
        .wait()
        .await
        .map_err(|e| format!("FFmpeg wait error: {}", e))?;

    if !status.success() {
        return Err(format_ffmpeg_failure(status, ff_stderr).await);
    }

    Ok(HtmlRenderResult {
        output_path: params.output_path,
        total_frames: frames_to_render,
        width: meta.width,
        height: meta.height,
        fps: meta.fps,
    })
}

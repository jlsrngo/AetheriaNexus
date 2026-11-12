//! System, updater, notification, and static web distribution serving.

use super::workspace::get_active_workspace_root;
use crate::bridge::LOCAL_CLI_BRIDGE_PORT;
use crate::paths::aetheria_dot_dir;
use axum::{
    body::Body,
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde_json::{json, Value};
use std::path::PathBuf;

pub async fn handle_engine_info() -> Response {
    let info_path = aetheria_dot_dir().join("engine-info.json");
    if let Ok(raw) = std::fs::read_to_string(&info_path) {
        if let Ok(val) = serde_json::from_str::<Value>(&raw) {
            return Json(val).into_response();
        }
    }
    Json(json!({
        "port": 4196,
        "hostname": "127.0.0.1",
        "url": "http://127.0.0.1:4196",
        "bridgePort": LOCAL_CLI_BRIDGE_PORT,
        "runtime": "rust"
    }))
    .into_response()
}

pub async fn handle_video_render(Json(payload): Json<Value>) -> impl IntoResponse {
    let workspace = get_active_workspace_root().unwrap_or_default();
    let session_id = payload.get("session_id").and_then(|v| v.as_str()).unwrap_or("video_session");
    let res = crate::tool::render::execute_render_video(session_id, &workspace, &payload).await;
    Json(res)
}

/// Validates that an external URL is strictly a well-formed HTTP/HTTPS URL with no control
/// characters, whitespace, or embedded credentials before passing to OS shell-free launchers.
pub fn validate_external_url(raw_url: &str) -> Result<String, String> {
    if raw_url.is_empty() || raw_url.len() > 2048 {
        return Err("Invalid URL: length out of bounds".to_string());
    }
    if raw_url.chars().any(|c| c.is_control() || c.is_whitespace()) {
        return Err("Invalid URL: whitespace and control characters are not allowed".to_string());
    }
    let parsed = reqwest::Url::parse(raw_url)
        .map_err(|e| format!("Invalid URL: {}", e))?;
    let scheme = parsed.scheme();
    if scheme != "http" && scheme != "https" {
        return Err(format!("Unsupported URL scheme '{}': only http/https allowed", scheme));
    }
    if parsed.host_str().is_none_or(|h| h.is_empty()) {
        return Err("Invalid URL: missing host".to_string());
    }
    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err("Invalid URL: embedded credentials are not allowed".to_string());
    }
    Ok(parsed.as_str().to_string())
}

#[cfg(windows)]
fn launch_external_url(url: &str) -> Result<(), String> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use std::ptr::null;

    #[link(name = "shell32")]
    extern "system" {
        fn ShellExecuteW(
            hwnd: *const std::ffi::c_void,
            lp_operation: *const u16,
            lp_file: *const u16,
            lp_parameters: *const u16,
            lp_directory: *const u16,
            n_show_cmd: i32,
        ) -> isize;
    }

    let op: Vec<u16> = OsStr::new("open").encode_wide().chain(Some(0)).collect();
    let target: Vec<u16> = OsStr::new(url).encode_wide().chain(Some(0)).collect();
    // SAFETY: `op` and `target` are NUL-terminated UTF-16 buffers that live across the
    // synchronous `ShellExecuteW` call, and optional pointer arguments are passed as null.
    let rc = unsafe { ShellExecuteW(null(), op.as_ptr(), target.as_ptr(), null(), null(), 1) };
    if rc > 32 {
        Ok(())
    } else {
        Err(format!("OS URL launcher failed with status {}", rc))
    }
}

#[cfg(target_os = "macos")]
fn launch_external_url(url: &str) -> Result<(), String> {
    std::process::Command::new("open")
        .arg(url)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("Failed to open URL: {}", e))
}

#[cfg(all(unix, not(target_os = "macos")))]
fn launch_external_url(url: &str) -> Result<(), String> {
    std::process::Command::new("xdg-open")
        .arg(url)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("Failed to open URL: {}", e))
}

pub async fn handle_open_url(Json(body): Json<Value>) -> Response {
    let raw_url = body.get("url").and_then(|v| v.as_str()).unwrap_or("");
    let validated = match validate_external_url(raw_url) {
        Ok(u) => u,
        Err(err) => {
            return (
                axum::http::StatusCode::BAD_REQUEST,
                Json(json!({ "error": err })),
            )
                .into_response();
        }
    };
    let launch_target = validated.clone();
    match tokio::task::spawn_blocking(move || launch_external_url(&launch_target)).await {
        Ok(Ok(())) => Json(json!({ "success": true, "url": validated })).into_response(),
        Ok(Err(err)) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": err })),
        )
            .into_response(),
        Err(err) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("URL launcher task failed: {}", err) })),
        )
            .into_response(),
    }
}

pub async fn handle_quit() -> Response {
    tokio::spawn(async {
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        std::process::exit(0);
    });
    Json(json!({ "ok": true })).into_response()
}

pub fn locate_web_dist() -> Option<PathBuf> {
    if let Ok(custom) = std::env::var("AETHERIA_WEB_DIST") {
        let p = PathBuf::from(custom);
        if p.join("index.html").exists() {
            return Some(p);
        }
    }

    let mut candidates = Vec::new();
    if let Ok(exe) = std::env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            candidates.push(exe_dir.join("web"));
            candidates.push(exe_dir.join("apps/dist"));
            candidates.push(exe_dir.join("apps/web/dist"));
            let mut cur = Some(exe_dir);
            for _ in 0..5 {
                if let Some(d) = cur {
                    candidates.push(d.join("apps/dist"));
                    candidates.push(d.join("apps/web/dist"));
                    candidates.push(d.join("apps/desktop/web"));
                    candidates.push(d.join("web"));
                    cur = d.parent();
                }
            }
        }
    }
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join("apps/dist"));
        candidates.push(cwd.join("apps/web/dist"));
        candidates.push(cwd.join("apps/desktop/web"));
    }

    candidates.into_iter().find(|p| p.join("index.html").exists())
}

pub fn try_serve_static_asset(uri_path: &str) -> Option<Response> {
    if uri_path.starts_with("/api/")
        || uri_path.starts_with("/session")
        || uri_path.starts_with("/provider")
        || uri_path.starts_with("/messaging")
        || uri_path.starts_with("/knowledge")
    {
        return None;
    }

    let dist_dir = locate_web_dist()?;
    let rel = uri_path.trim_start_matches('/');
    let target_file = if rel.is_empty() {
        dist_dir.join("index.html")
    } else {
        let candidate = dist_dir.join(rel);
        if candidate.is_file() {
            candidate
        } else {
            // SPA fallback for client routes
            dist_dir.join("index.html")
        }
    };

    let bytes = std::fs::read(&target_file).ok()?;
    let mime = mime_guess::from_path(&target_file).first_or_octet_stream();
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, mime.as_ref())
        .body(Body::from(bytes))
        .ok()
}

pub async fn handle_desktop_notify(Json(payload): Json<Value>) -> impl IntoResponse {
    let title = payload
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("Aetheria Workstation")
        .to_string();
    let body = payload
        .get("body")
        .and_then(|v| v.as_str())
        .unwrap_or("Document response completed.")
        .to_string();

    tokio::task::spawn_blocking(move || {
        #[cfg(windows)]
        {
            const AETHERIA_ICON_BYTES: &[u8] = include_bytes!("../../../../src-tauri/icons/128x128.png");
            let icon_path = std::env::var("LOCALAPPDATA")
                .map(std::path::PathBuf::from)
                .unwrap_or_else(|_| std::env::temp_dir())
                .join("Aetheria")
                .join("aetheria-logo.png");
            if let Some(parent) = icon_path.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            if !icon_path.exists() {
                let _ = std::fs::write(&icon_path, AETHERIA_ICON_BYTES);
            }
            let icon_win_path = icon_path.to_string_lossy().to_string();
            let icon_file_uri = format!("file:///{}", icon_win_path.replace('\\', "/"));

            let xml_escape = |s: &str| -> String {
                s.replace('&', "&amp;")
                    .replace('<', "&lt;")
                    .replace('>', "&gt;")
                    .replace('"', "&quot;")
                    .replace('\'', "&apos;")
            };
            let ps_escape = |s: &str| -> String { s.replace('\'', "''") };
            let t_xml = ps_escape(&xml_escape(&title));
            let b_xml = ps_escape(&xml_escape(&body));
            let icon_win_escaped = ps_escape(&icon_win_path);
            let icon_uri_escaped = ps_escape(&xml_escape(&icon_file_uri));
            let script = format!(
                "try {{\n\
                    New-Item -Path 'HKCU:\\Software\\Classes\\AppUserModelId\\Aetheria' -Force | Out-Null\n\
                    Set-ItemProperty -Path 'HKCU:\\Software\\Classes\\AppUserModelId\\Aetheria' -Name 'DisplayName' -Value 'Aetheria' -Force\n\
                    Set-ItemProperty -Path 'HKCU:\\Software\\Classes\\AppUserModelId\\Aetheria' -Name 'IconUri' -Value '{}' -Force\n\
                    Set-ItemProperty -Path 'HKCU:\\Software\\Classes\\AppUserModelId\\Aetheria' -Name 'IconBackgroundColor' -Value '00000000' -Force\n\
                    [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null\n\
                    [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null\n\
                    $xml = New-Object Windows.Data.Xml.Dom.XmlDocument\n\
                    $xml.LoadXml('<toast><visual><binding template=\"ToastGeneric\"><text>{}</text><text>{}</text><image placement=\"appLogoOverride\" src=\"{}\"/></binding></visual></toast>')\n\
                    $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)\n\
                    $toast.Tag = 'aetheria-status'\n\
                    $toast.Group = 'aetheria'\n\
                    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Aetheria').Show($toast)\n\
                }} catch {{}}",
                icon_win_escaped, t_xml, b_xml, icon_uri_escaped
            );
            let mut ps = std::process::Command::new("powershell");
            crate::paths::configure_hidden_std_command(&mut ps);
            let _ = ps.args(["-NoProfile", "-Command", &script]).spawn();
        }
    });

    Json(json!({ "ok": true }))
}

pub async fn handle_check_updates() -> impl IntoResponse {
    let current_version = env!("CARGO_PKG_VERSION");
    let client = reqwest::Client::builder()
        .user_agent("Aetheria-Desktop-Updater")
        .timeout(std::time::Duration::from_secs(6))
        .build();

    let client = match client {
        Ok(c) => c,
        Err(e) => {
            return Json(json!({
                "status": "error",
                "message": format!("Failed to create HTTP client: {}", e),
                "has_update": false,
                "current_version": current_version,
            }));
        }
    };

    let url = "https://api.github.com/repos/jlsrngo/Aetheria/releases/latest";
    let res = client.get(url).send().await;

    match res {
        Ok(resp) => {
            if resp.status().is_success() {
                if let Ok(rel) = resp.json::<Value>().await {
                    let tag = rel.get("tag_name").and_then(|v| v.as_str()).unwrap_or("").trim();
                    let latest_version = tag.trim_start_matches('v');
                    let release_url = rel.get("html_url").and_then(|v| v.as_str()).unwrap_or("https://github.com/jlsrngo/Aetheria/releases");
                    let release_notes = rel.get("body").and_then(|v| v.as_str()).unwrap_or("");

                    let has_update = !latest_version.is_empty() && latest_version != current_version;

                    let mut download_url = release_url.to_string();
                    if let Some(assets) = rel.get("assets").and_then(|a| a.as_array()) {
                        for asset in assets {
                            if let Some(name) = asset.get("name").and_then(|n| n.as_str()) {
                                if name.ends_with(".exe") || name.ends_with(".msi") {
                                    if let Some(dl) = asset.get("browser_download_url").and_then(|u| u.as_str()) {
                                        download_url = dl.to_string();
                                        break;
                                    }
                                }
                            }
                        }
                    }

                    return Json(json!({
                        "status": "ok",
                        "has_update": has_update,
                        "current_version": current_version,
                        "latest_version": latest_version,
                        "release_url": release_url,
                        "download_url": download_url,
                        "release_notes": release_notes,
                    }));
                }
            }
            Json(json!({
                "status": "ok",
                "has_update": false,
                "current_version": current_version,
                "latest_version": current_version,
                "message": "Repository is up to date.",
            }))
        }
        Err(e) => Json(json!({
            "status": "offline_or_error",
            "has_update": false,
            "current_version": current_version,
            "message": format!("Could not reach GitHub Releases: {}", e),
        })),
    }
}

pub async fn handle_check_artcraft_updates() -> Json<Value> {
    Json(json!({
        "status": "ok",
        "has_artcraft_update": false,
        "apps": []
    }))
}

#[cfg(test)]
mod tests {
    use super::validate_external_url;

    #[test]
    fn test_validate_external_url_allows_clean_http_and_https() {
        assert_eq!(
            validate_external_url("https://aetheria.studio/docs?tab=motion&v=2").unwrap(),
            "https://aetheria.studio/docs?tab=motion&v=2"
        );
        assert_eq!(
            validate_external_url("http://127.0.0.1:4196/health").unwrap(),
            "http://127.0.0.1:4196/health"
        );
    }

    #[test]
    fn test_validate_external_url_rejects_dangerous_or_malformed_inputs() {
        for bad in [
            "",
            "javascript:alert(1)",
            "file:///C:/Windows/System32/cmd.exe",
            "ms-msdt:/id",
            "https://example.com & calc.exe",
            "https://example.com/\ncalc",
            "https://user:secret@example.com/path",
            "ftp://example.com/file",
        ] {
            assert!(
                validate_external_url(bad).is_err(),
                "Expected URL to be rejected: {:?}",
                bad
            );
        }
    }
}


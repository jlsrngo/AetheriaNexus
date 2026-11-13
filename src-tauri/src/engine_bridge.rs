//! In-process IPC bridge routing frontend API requests to the embedded Axum engine router.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::OnceLock;
use tokio::sync::Notify;

const AUTH_MODE_PENDING: u8 = 0;
const AUTH_MODE_EMBEDDED: u8 = 1;
const AUTH_MODE_EXTERNAL: u8 = 2;

static ENGINE_AUTH_MODE: AtomicU8 = AtomicU8::new(AUTH_MODE_PENDING);
static ENGINE_AUTH_NOTIFY: OnceLock<Notify> = OnceLock::new();

fn auth_notify() -> &'static Notify {
    ENGINE_AUTH_NOTIFY.get_or_init(Notify::new)
}

pub fn set_engine_auth_mode_embedded() {
    ENGINE_AUTH_MODE.store(AUTH_MODE_EMBEDDED, Ordering::Release);
    auth_notify().notify_waiters();
}

pub fn set_engine_auth_mode_external() {
    ENGINE_AUTH_MODE.store(AUTH_MODE_EXTERNAL, Ordering::Release);
    auth_notify().notify_waiters();
}

#[derive(serde::Deserialize, serde::Serialize, Clone, Debug)]
pub struct TauriEngineRequest {
    pub path: String,
    pub method: Option<String>,
    pub headers: Option<HashMap<String, String>>,
    pub body: Option<String>,
}

#[derive(serde::Deserialize, serde::Serialize, Clone, Debug)]
pub struct TauriEngineResponse {
    pub status: u16,
    pub status_text: String,
    pub headers: HashMap<String, String>,
    pub body: String,
    pub ok: bool,
}

/// Dispatches an engine API call inside this process through the engine's Axum router.
/// No loopback socket is involved; the HTTP port stays available for third-party clients.
#[tauri::command]
pub async fn tauri_engine_fetch(req: TauriEngineRequest) -> Result<TauriEngineResponse, String> {
    let method_str = req.method.unwrap_or_else(|| "GET".to_string()).to_uppercase();
    let path = if req.path.starts_with('/') {
        req.path
    } else {
        format!("/{}", req.path)
    };

    let mut headers: Vec<(String, String)> = req
        .headers
        .unwrap_or_default()
        .into_iter()
        .filter(|(k, _)| !k.eq_ignore_ascii_case("authorization"))
        .collect();
    // Trusted in-process IPC bridge: always authenticate directly against the embedded engine's
    // live credentials so stale WebView-cached tokens can never trigger persistent 401 failures.
    headers.push((
        "Authorization".to_string(),
        aetheria_engine::server_auth::server_auth_header(),
    ));
    let (status, resp_headers, body) = aetheria_engine::handle_local_request(
        &method_str,
        &path,
        headers,
        req.body.map(String::into_bytes),
    )
    .await;

    Ok(TauriEngineResponse {
        status,
        status_text: reqwest::StatusCode::from_u16(status)
            .ok()
            .and_then(|s| s.canonical_reason())
            .unwrap_or("")
            .to_string(),
        headers: resp_headers.into_iter().collect(),
        body: String::from_utf8_lossy(&body).into_owned(),
        ok: (200..300).contains(&status),
    })
}

/// Returns the active engine Basic token in memory for native WebView media tags (`<video>`, `<audio>`, `<img>`).
#[tauri::command]
pub async fn get_engine_auth_token() -> Option<String> {
    if ENGINE_AUTH_MODE.load(Ordering::Acquire) == AUTH_MODE_PENDING {
        let notify = auth_notify();
        let notified = notify.notified();
        if ENGINE_AUTH_MODE.load(Ordering::Acquire) == AUTH_MODE_PENDING {
            let _ = tokio::time::timeout(std::time::Duration::from_secs(2), notified).await;
        }
    }

    match ENGINE_AUTH_MODE.load(Ordering::Acquire) {
        AUTH_MODE_EMBEDDED => Some(aetheria_engine::server_auth::server_auth_token_b64()),
        AUTH_MODE_EXTERNAL => aetheria_engine::server_auth::read_persisted_auth_token_b64(),
        _ => {
            if aetheria_engine::server_auth::try_credentials().is_some() {
                Some(aetheria_engine::server_auth::server_auth_token_b64())
            } else {
                aetheria_engine::server_auth::read_persisted_auth_token_b64()
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn tauri_engine_fetch_overrides_stale_authorization_header() {
        let mut stale = HashMap::new();
        stale.insert(
            "Authorization".to_string(),
            "Basic c3RhbGU6cGFzc3dvcmQ=".to_string(),
        );
        let resp = tauri_engine_fetch(TauriEngineRequest {
            path: "/api/health".to_string(),
            method: Some("GET".to_string()),
            headers: Some(stale),
            body: None,
        })
        .await
        .expect("ipc fetch succeeds");
        assert_eq!(resp.status, 200);
        assert!(resp.ok);
    }
}


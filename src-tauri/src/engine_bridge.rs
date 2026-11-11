//! In-process IPC bridge routing frontend API requests to the embedded Axum engine router.

use std::collections::HashMap;

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

    let headers: Vec<(String, String)> = req.headers.unwrap_or_default().into_iter().collect();
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


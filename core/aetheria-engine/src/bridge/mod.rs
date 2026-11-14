//! Local-CLI Bridge (:20288) — OpenAI-compatible server lifecycle, origin security guard & router.

mod antigravity;
pub(crate) mod antigravity_auth;
mod antigravity_safety;
mod claude;
mod codex;
mod kiro;
mod kiro_event_stream;
mod opencode;
mod response_format;
mod routes;
pub mod schema;

pub(crate) use antigravity_auth::{clear_antigravity_project_id_cache, get_antigravity_project_id};
pub(crate) use antigravity_safety::clear_antigravity_cooldowns;
pub(crate) use response_format::{
    extract_content_text, make_completion_response, make_completion_response_with_reasoning,
    make_sse_response_from_result, make_sse_response_with_reasoning,
};

use axum::{
    body::Body,
    extract::Request,
    http::{header, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
    Router,
};
use serde_json::{json, Value};

use crate::cred_store::harvest_all;

pub const LOCAL_CLI_BRIDGE_PORT: u16 = 20288;

/// Origin guard: Blocks arbitrary browser websites from making cross-site calls to the local bridge.
/// CLI tools (Cursor IDE, Claude Code, curl, scripts) don't send an Origin header and are allowed.
async fn origin_guard_middleware(req: Request, next: Next) -> Response {
    if let Some(origin) = req.headers().get(header::ORIGIN).and_then(|v| v.to_str().ok()) {
        let allowed = origin == "http://localhost"
            || origin == "https://localhost"
            || origin.starts_with("http://127.0.0.1:")
            || origin.starts_with("http://localhost:")
            || origin == "http://127.0.0.1"
            || origin.starts_with("tauri://")
            || origin == "http://tauri.localhost";

        if !allowed {
            return Response::builder()
                .status(StatusCode::FORBIDDEN)
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(r#"{"error":"Forbidden: Cross-site browser access to local bridge is blocked for security"}"#))
                .unwrap_or_else(|_| StatusCode::FORBIDDEN.into_response());
        }
    }
    next.run(req).await
}

pub async fn start_bridge_server(preferred_port: u16) -> Result<u16, String> {
    harvest_all();

    let probe_url = format!("http://127.0.0.1:{}/health", preferred_port);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(300))
        .build();
    if let Ok(c) = client {
        if let Ok(resp) = c.get(&probe_url).send().await {
            if resp.status().is_success() {
                println!(
                    "[aetheria-bridge] Existing bridge instance detected on port {}, reusing.",
                    preferred_port
                );
                return Ok(preferred_port);
            }
        }
    }

    let candidate_ports = [
        preferred_port,
        preferred_port + 1,
        preferred_port + 2,
        preferred_port + 3,
        0,
    ];

    let mut bound_listener = None;
    for &p in &candidate_ports {
        let addr = format!("127.0.0.1:{}", p);
        match tokio::net::TcpListener::bind(&addr).await {
            Ok(l) => {
                bound_listener = Some(l);
                break;
            }
            Err(_) => continue,
        }
    }

    let listener = bound_listener.ok_or_else(|| {
        format!(
            "Failed to bind Local-CLI Bridge on any candidate port around {}",
            preferred_port
        )
    })?;

    let actual_port = listener
        .local_addr()
        .map(|a| a.port())
        .unwrap_or(preferred_port);

    let info_path = crate::paths::aetheria_dot_dir().join("bridge-info.json");
    let _ = std::fs::write(
        info_path,
        serde_json::to_string_pretty(&json!({
            "port": actual_port,
            "url": format!("http://127.0.0.1:{}/v1", actual_port),
            "pid": std::process::id(),
            "healthy": true
        }))
        .unwrap_or_default(),
    );

    let app = Router::new()
        .route("/health", get(routes::handle_health))
        .route("/v1/models", get(routes::handle_models))
        .route("/v1/chat/completions", post(routes::handle_chat_completions))
        .layer(middleware::from_fn(origin_guard_middleware));

    tokio::spawn(async move {
        let _ = axum::serve(listener, app).await;
    });

    Ok(actual_port)
}

/// Returns the current base URL for the Local-CLI Bridge, reading dynamic port if available.
pub fn get_bridge_base_url() -> String {
    let info_path = crate::paths::aetheria_dot_dir().join("bridge-info.json");
    if let Ok(content) = std::fs::read_to_string(&info_path) {
        if let Ok(val) = serde_json::from_str::<Value>(&content) {
            if let Some(url) = val.get("url").and_then(|v| v.as_str()) {
                return url.trim_end_matches('/').to_string();
            }
        }
    }
    format!("http://127.0.0.1:{}/v1", LOCAL_CLI_BRIDGE_PORT)
}

/// Ensures the Local-CLI Bridge server is responsive. If not responding, starts it immediately.
pub async fn ensure_bridge_running() -> u16 {
    let info_path = crate::paths::aetheria_dot_dir().join("bridge-info.json");
    let recorded_port = std::fs::read_to_string(&info_path)
        .ok()
        .and_then(|c| serde_json::from_str::<Value>(&c).ok())
        .and_then(|v| v.get("port").and_then(|p| p.as_u64()))
        .map(|p| p as u16)
        .unwrap_or(LOCAL_CLI_BRIDGE_PORT);

    let probe_ports = if recorded_port == LOCAL_CLI_BRIDGE_PORT {
        vec![LOCAL_CLI_BRIDGE_PORT]
    } else {
        vec![recorded_port, LOCAL_CLI_BRIDGE_PORT]
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(300))
        .build();

    if let Ok(c) = client {
        for &port in &probe_ports {
            let probe_url = format!("http://127.0.0.1:{}/health", port);
            if let Ok(resp) = c.get(&probe_url).send().await {
                if resp.status().is_success() {
                    return port;
                }
            }
        }
    }

    crate::paths::log_engine(
        "bridge",
        "⚠️ Bridge probe failed or offline. Auto-starting Local-CLI Bridge...",
    );
    match start_bridge_server(LOCAL_CLI_BRIDGE_PORT).await {
        Ok(port) => {
            crate::paths::log_engine(
                "bridge",
                &format!("✅ Local-CLI Bridge active and listening on port {}", port),
            );
            port
        }
        Err(e) => {
            crate::paths::log_engine("bridge", &format!("❌ Failed to start bridge: {}", e));
            LOCAL_CLI_BRIDGE_PORT
        }
    }
}

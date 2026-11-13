pub mod aetheria;
pub mod binary_locator;
pub mod bridge;
pub mod cred_store;
pub mod desktop;
pub mod diff;
pub mod engine_endpoints;
pub mod file_changes;
pub mod file_search;
pub mod file_text_extract;
pub mod files;
pub mod http_guard;
pub mod knowledge;
pub mod messaging;
pub mod network;
pub mod paths;
pub mod permission;
pub mod provider;
pub mod question;
pub mod server_auth;
pub mod session;
pub mod studio;
pub mod tasks;
pub mod tool;

pub use engine_endpoints::{handle_fallback, handle_health, handle_sse_events};
pub use http_guard::{cors_and_auth_middleware, is_allowed_origin};

use crate::bridge::{start_bridge_server, LOCAL_CLI_BRIDGE_PORT};
use crate::cred_store::{harvest_all, register_local_cli_to_config};
use crate::paths::aetheria_dot_dir;
use axum::{
    body::Body,
    extract::Request,
    http::{header, Method},
    middleware,
    routing::{get, post},
    Router,
};
use serde_json::json;

pub const ENGINE_VERSION: &str = "1.3.0-rust";

pub async fn init_engine_and_bind(
    hostname: &str,
    port: u16,
) -> (tokio::net::TcpListener, String, u16) {
    // 1. Harvest local CLI credentials & start Local-CLI Bridge on :20188
    harvest_all();
    register_local_cli_to_config(LOCAL_CLI_BRIDGE_PORT);
    if let Err(e) = start_bridge_server(LOCAL_CLI_BRIDGE_PORT).await {
        eprintln!(
            "[aetheria-engine] Notice: bridge server on :{}: {}",
            LOCAL_CLI_BRIDGE_PORT, e
        );
    } else {
        println!(
            "[aetheria-engine] Local-CLI Bridge listening on http://127.0.0.1:{}/v1",
            LOCAL_CLI_BRIDGE_PORT
        );
    }

    // 2. Recover any orphaned jobs/sessions from prior crash/restart (OpenCode SessionRestart)
    let recovered_jobs = session::job_registry::recover_orphaned_jobs_on_startup();
    if recovered_jobs > 0 {
        println!(
            "[aetheria-engine] Recovered and settled {} orphaned job(s) from previous run",
            recovered_jobs
        );
    }
    let interrupted_subagents = session::restart::list_interrupted_subagents_on_startup();
    for rec in interrupted_subagents {
        session::agent_turn::subagent::wake_interrupted_subagent_on_startup(rec);
    }
    let pending_inboxes = session::inbox::recover_pending_inboxes_on_startup();
    if !pending_inboxes.is_empty() {
        println!(
            "[aetheria-engine] Resuming {} session(s) with persisted inbox items",
            pending_inboxes.len()
        );
        for sid in &pending_inboxes {
            session::prompt::wake_session_inbox_on_startup(sid);
        }
    }
    let pending_compactions = session::restart::take_pending_compactions_on_startup();
    if !pending_compactions.is_empty() {
        println!(
            "[aetheria-engine] Resuming {} session(s) with interrupted compaction",
            pending_compactions.len()
        );
        for rec in pending_compactions {
            session::prompt::wake_session_compaction_on_startup(rec);
        }
    }
    let interrupted_turns = session::restart::take_interrupted_turns_on_startup();
    for rec in interrupted_turns {
        if !pending_inboxes.contains(&rec.session_id) {
            session::prompt::wake_interrupted_turn_on_startup(rec);
        }
    }

    // 3. Start background Telegram bot polling & active folder ingestion watcher
    messaging::start_telegram_worker();
    session::watcher::start_folder_watcher_daemon();
    studio::start_scheduler_daemon();

    // 4. Write dev-server-password if server password env is provided
    // 4. Always initialize per-launch auth credentials and persist password files
    let creds = crate::server_auth::init_server_credentials();
    crate::server_auth::persist_dev_server_password_files(creds);

    let bind_addr = format!("{}:{}", hostname, port);
    let listener = match tokio::net::TcpListener::bind(&bind_addr).await {
        Ok(l) => l,
        Err(_) => tokio::net::TcpListener::bind(format!("{}:0", hostname))
            .await
            .expect("Failed to bind aetheria-engine"),
    };

    let actual_port = listener.local_addr().map(|a| a.port()).unwrap_or(port);
    let url = format!("http://{}:{}", hostname, actual_port);

    // 5. Write ~/.aetheria/engine-info.json with complete dynamic stack metadata
    let info_path = aetheria_dot_dir().join("engine-info.json");
    let _ = std::fs::write(
        info_path,
        serde_json::to_string_pretty(&json!({
            "port": actual_port,
            "hostname": hostname,
            "url": url,
            "bridgePort": LOCAL_CLI_BRIDGE_PORT,
            "pid": std::process::id(),
            "runtime": "Native Rust Hybrid",
            "version": ENGINE_VERSION,
            "engine": "Axum v0.7 + Tokio v1.40",
            "desktop": "Tauri v2 + WebView2",
            "docs": "Native Win32 COM Sidecar (aetheria-docs)",
            "os": format!("{}_{} {}", std::env::consts::OS, std::env::consts::ARCH, std::env::consts::FAMILY)
        }))
        .unwrap_or_default(),
    );

    (listener, url, actual_port)
}

pub async fn run_axum_server(listener: tokio::net::TcpListener, _actual_port: u16) {
    axum::serve(listener, build_router()).await.unwrap();
}

pub fn build_router() -> Router {
    Router::new()
        .route("/api/health", get(handle_health))
        .route("/global/health", get(handle_health))
        .route("/health", get(handle_health))
        .route("/api/event", get(handle_sse_events))
        .route("/global/event", get(handle_sse_events))
        .route("/event", get(handle_sse_events))
        .route(
            "/api/tool/format-step-label",
            post(tool::step_formatter::handle_format_step_label),
        )
        .route(
            "/tool/format-step-label",
            post(tool::step_formatter::handle_format_step_label),
        )
        .merge(desktop::router())
        .merge(diff::router())
        .merge(knowledge::router())
        .merge(files::router())
        .merge(provider::router())
        .merge(messaging::router())
        .merge(session::router())
        .merge(tasks::router())
        .merge(question::router())
        .merge(permission::router())
        .merge(studio::router())
        .fallback(handle_fallback)
        .layer(middleware::from_fn(cors_and_auth_middleware))
}

/// Same router, built once, so in-process dispatch does not re-register routes per call.
fn shared_router() -> &'static Router {
    static ROUTER: std::sync::OnceLock<Router> = std::sync::OnceLock::new();
    ROUTER.get_or_init(build_router)
}

/// Dispatches a request through the same router the Axum server uses, without touching a socket.
/// The desktop shell uses this so the UI never depends on the local HTTP port; third-party
/// integrations still speak HTTP on 127.0.0.1:4096.
pub async fn handle_local_request(
    method: &str,
    path: &str,
    headers: Vec<(String, String)>,
    body: Option<Vec<u8>>,
) -> (u16, Vec<(String, String)>, Vec<u8>) {
    use tower::ServiceExt;

    let m = Method::from_bytes(method.as_bytes()).unwrap_or(Method::GET);
    let mut builder = Request::builder().method(m).uri(path);
    if let Some(hs) = builder.headers_mut() {
        for (k, v) in headers {
            if let (Ok(name), Ok(val)) = (
                header::HeaderName::from_bytes(k.as_bytes()),
                header::HeaderValue::from_str(&v),
            ) {
                hs.append(name, val);
            }
        }
    }
    let req = builder.body(Body::from(body.unwrap_or_default()));
    let req = match req {
        Ok(r) => r,
        Err(e) => return (400, vec![], format!("Bad request: {e}").into_bytes()),
    };

    match shared_router().clone().oneshot(req).await {
        Ok(resp) => {
            let status = resp.status().as_u16();
            let headers: Vec<(String, String)> = resp
                .headers()
                .iter()
                .filter_map(|(k, v)| v.to_str().ok().map(|v| (k.to_string(), v.to_string())))
                .collect();
            let bytes = axum::body::to_bytes(resp.into_body(), 64 * 1024 * 1024)
                .await
                .map(|b| b.to_vec())
                .unwrap_or_default();
            (status, headers, bytes)
        }
        Err(e) => (500, vec![], format!("Engine dispatch failed: {e}").into_bytes()),
    }
}

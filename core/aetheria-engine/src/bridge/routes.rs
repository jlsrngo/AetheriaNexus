//! Local-CLI Bridge HTTP Endpoint Handlers (`/health`, `/v1/models`, `/v1/chat/completions`).

use axum::{
    extract::Request,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::{json, Value};

use super::antigravity::handle_antigravity_request;
use super::claude::handle_claude_request;
use super::codex::handle_codex_request;
use super::kiro::handle_kiro_request;
use super::opencode::handle_opencode_request;
use crate::cred_store::get_all_credentials;

pub(crate) async fn handle_health() -> impl IntoResponse {
    let creds = get_all_credentials();
    Json(json!({
        "ok": true,
        "codex": creds.contains_key("codex"),
        "claude": creds.contains_key("claude"),
        "opencode": creds.contains_key("opencode"),
        "kiro": creds.contains_key("kiro"),
        "antigravity": creds.contains_key("antigravity"),
        "groq": creds.contains_key("groq"),
    }))
}

pub(crate) async fn handle_models() -> impl IntoResponse {
    let creds = get_all_credentials();
    let mut models = Vec::new();
    if creds.contains_key("codex") {
        for id in [
            "gpt-5.6-terra",
            "gpt-5.4",
            "gpt-5.4-mini",
            "gpt-5.3-codex",
            "gpt-5.2-codex",
            "gpt-5.2",
            "gpt-5.1-codex-max",
            "gpt-5.1-codex-mini",
        ] {
            models.push(json!({ "id": id, "object": "model", "owned_by": "codex-cli" }));
        }
    }
    if creds.contains_key("claude") {
        for id in ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5"] {
            models.push(json!({ "id": id, "object": "model", "owned_by": "claude-cli" }));
        }
    }
    if creds.contains_key("kiro") {
        for id in [
            "kiro/auto",
            "kiro/claude-opus-4.6",
            "kiro/claude-sonnet-4.6",
            "kiro/claude-sonnet-4.5",
            "kiro/claude-haiku-4.5",
            "kiro/deepseek-3.2",
            "kiro/minimax-m2.5",
            "kiro/glm-5",
            "kiro/qwen3-coder-next",
        ] {
            models.push(json!({ "id": id, "object": "model", "owned_by": "kiro-cli" }));
        }
    }
    if creds.contains_key("antigravity") {
        for id in [
            "gemini-3.8-pro-high",
            "gemini-3.8-pro-low",
            "gemini-3.8-flash-high",
            "gemini-3.8-flash-medium",
            "gemini-3.8-flash-low",
            "gemini-3.8-flash-minimal",
            "claude-sonnet-4-6-agy",
            "claude-opus-4-6-thinking",
            "gpt-oss-120b-medium",
        ] {
            models.push(json!({ "id": id, "object": "model", "owned_by": "antigravity-cli" }));
        }
    }
    if creds.contains_key("opencode") {
        for id in [
            "opencode/big-pickle",
            "opencode/mimo-v2-pro-free",
            "opencode/mimo-v2-omni-free",
            "opencode/nemotron-3-super-free",
            "opencode/minimax-m2.5-free",
            "opencode/gpt-5-nano",
        ] {
            models.push(json!({ "id": id, "object": "model", "owned_by": "opencode-cli" }));
        }
    }
    Json(json!({ "object": "list", "data": models }))
}

pub(crate) async fn handle_chat_completions(req: Request) -> Response {
    let bytes = match axum::body::to_bytes(req.into_body(), 32 * 1024 * 1024).await {
        Ok(b) => b,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": { "message": format!("Invalid request body: {}", e) } })),
            )
                .into_response()
        }
    };
    let body: Value = match serde_json::from_slice(&bytes) {
        Ok(v) => v,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": { "message": format!("Invalid JSON: {}", e) } })),
            )
                .into_response()
        }
    };

    let model = body
        .get("model")
        .and_then(|v| v.as_str())
        .unwrap_or("gpt-5.4")
        .to_string();
    let is_stream = body
        .get("stream")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    crate::paths::log_engine(
        "bridge",
        &format!("⚡ Incoming AI Request -> Model: '{}' (stream: {})", model, is_stream),
    );

    if model.starts_with("kiro/") {
        return handle_kiro_request(body, &model, is_stream).await;
    }
    if model.starts_with("opencode/") || model == "big-pickle" || model.ends_with("-free") {
        return handle_opencode_request(body, &model, is_stream).await;
    }
    if model.starts_with("gemini-")
        || model.ends_with("-agy")
        || model.ends_with("-thinking")
        || model.starts_with("gpt-oss-")
    {
        return handle_antigravity_request(body, &model, is_stream).await;
    }
    if model.starts_with("claude-") {
        return handle_claude_request(body, &model, is_stream).await;
    }
    handle_codex_request(body, &model, is_stream).await
}


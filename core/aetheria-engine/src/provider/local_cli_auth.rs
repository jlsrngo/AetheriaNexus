//! Local-CLI Authentication, OAuth, Token Harvest, Sign-In & Refresh HTTP Handlers.

use crate::bridge::LOCAL_CLI_BRIDGE_PORT;
use crate::cred_store::{
    get_all_credentials, get_credential, get_oauth_status, harvest_all, refresh_credential_source,
    register_local_cli_to_config, remove_credential, set_credential, start_oauth_session,
    CredentialEntry,
};
use crate::paths::now_iso;
use axum::{
    extract::Path as AxumPath,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::{json, Value};

pub async fn handle_local_cli_login(Json(body): Json<Value>) -> Response {
    let target = body.get("target").and_then(|v| v.as_str()).unwrap_or("");
    match target {
        "antigravity-logout" => {
            remove_credential("antigravity");
            Json(json!({
                "data": { "success": true, "message": "Signed out from Antigravity." }
            }))
            .into_response()
        }
        "opencode-logout" => {
            remove_credential("opencode");
            Json(json!({
                "data": { "success": true, "message": "Signed out from OpenCode." }
            }))
            .into_response()
        }
        "claude" | "codex" | "opencode-terminal" | "antigravity-cli" => {
            let cmd_str = match target {
                "claude" => "claude",
                "codex" => "codex",
                "opencode-terminal" => "opencode auth login",
                "antigravity-cli" => "agy login",
                _ => "cmd",
            };
            #[cfg(windows)]
            {
                let _ = std::process::Command::new("cmd")
                    .args(["/c", "start", "cmd", "/k", cmd_str])
                    .spawn();
            }
            Json(json!({
                "data": {
                    "success": true,
                    "message": format!("Launched '{}' in terminal window.", cmd_str)
                }
            }))
            .into_response()
        }
        _ => Json(json!({
            "data": {
                "success": true,
                "message": "Built-in Rust Local-CLI Bridge is active."
            }
        }))
        .into_response(),
    }
}

pub async fn handle_local_cli_oauth_start(Json(body): Json<Value>) -> Response {
    let target = body
        .get("target")
        .and_then(|v| v.as_str())
        .unwrap_or("kiro");
    let open_browser = body
        .get("openBrowser")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);

    match start_oauth_session(target, open_browser).await {
        Ok(data) => Json(json!({ "data": data })).into_response(),
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": e, "data": { "status": "error", "message": e } })),
        )
            .into_response(),
    }
}

pub async fn handle_local_cli_oauth_status(Json(body): Json<Value>) -> Response {
    let req_id = body
        .get("requestId")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    if let Some(st) = get_oauth_status(req_id) {
        Json(json!({
            "data": {
                "requestId": st.request_id,
                "target": st.target,
                "status": st.status,
                "message": st.message,
                "authUrl": st.auth_url
            }
        }))
        .into_response()
    } else {
        Json(json!({
            "data": {
                "requestId": req_id,
                "target": "unknown",
                "status": "error",
                "message": "OAuth session not found"
            }
        }))
        .into_response()
    }
}

pub async fn handle_local_cli_harvest() -> Response {
    let harvested = harvest_all();
    register_local_cli_to_config(LOCAL_CLI_BRIDGE_PORT);
    Json(json!({ "ok": true, "harvested": harvested })).into_response()
}

pub async fn handle_local_cli_signin(Json(body): Json<Value>) -> Response {
    let source = body
        .get("source")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    harvest_all();
    if let Some(c) = get_credential(&source) {
        if let Some(refreshed) = refresh_credential_source(&source, &c).await {
            register_local_cli_to_config(LOCAL_CLI_BRIDGE_PORT);
            return Json(json!({
                "ok": true,
                "source": source,
                "method": "refresh",
                "expiresAt": refreshed.expires_at
            }))
            .into_response();
        }
        register_local_cli_to_config(LOCAL_CLI_BRIDGE_PORT);
        return Json(json!({
            "ok": true,
            "source": source,
            "method": "harvest",
            "expiresAt": c.expires_at
        }))
        .into_response();
    }
    (
        StatusCode::BAD_REQUEST,
        Json(json!({ "ok": false, "error": format!("No local credentials found for {}", source) })),
    )
        .into_response()
}

pub async fn handle_local_cli_token(Json(body): Json<Value>) -> Response {
    let Some(source) = body.get("source").and_then(|v| v.as_str()) else {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "source is required" })),
        )
            .into_response();
    };
    let Some(token) = body.get("accessToken").and_then(|v| v.as_str()) else {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "accessToken is required" })),
        )
            .into_response();
    };
    set_credential(CredentialEntry {
        source: source.to_string(),
        access_token: token.trim().to_string(),
        refresh_token: body
            .get("refreshToken")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        expires_at: None,
        client_id: None,
        client_secret: None,
        region: body
            .get("region")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        account_info: Some("Manual token".to_string()),
        updated_at: now_iso(),
        auto_harvested: false,
        ..Default::default()
    });
    register_local_cli_to_config(LOCAL_CLI_BRIDGE_PORT);
    Json(json!({ "ok": true, "source": source })).into_response()
}

pub async fn handle_local_cli_refresh(Json(body): Json<Value>) -> Response {
    let target = body
        .get("source")
        .or_else(|| body.get("target"))
        .and_then(|v| v.as_str());
    let action = body.get("action").and_then(|v| v.as_str()).unwrap_or("refresh");

    if action == "logout" {
        if let Some(t) = target {
            remove_credential(t);
            register_local_cli_to_config(LOCAL_CLI_BRIDGE_PORT);
            return Json(json!({
                "ok": true,
                "data": { "success": true, "message": format!("Signed out from {}.", t) }
            }))
            .into_response();
        }
    }

    harvest_all();
    let creds = get_all_credentials();
    let mut results = serde_json::Map::new();
    let mut any_ok = false;
    for (src, entry) in creds {
        if let Some(t) = target {
            if t != src {
                continue;
            }
        }
        let ok = refresh_credential_source(&src, &entry).await.is_some();
        if ok {
            any_ok = true;
        }
        results.insert(src, Value::Bool(ok));
    }
    register_local_cli_to_config(LOCAL_CLI_BRIDGE_PORT);
    Json(json!({
        "ok": true,
        "results": results,
        "data": {
            "success": any_ok || target.is_none(),
            "message": if any_ok { "Token refreshed successfully." } else { "Credentials re-harvested." }
        }
    }))
    .into_response()
}

pub async fn handle_local_cli_delete(AxumPath(source): AxumPath<String>) -> Response {
    let removed = remove_credential(&source);
    register_local_cli_to_config(LOCAL_CLI_BRIDGE_PORT);
    Json(json!({ "ok": removed })).into_response()
}


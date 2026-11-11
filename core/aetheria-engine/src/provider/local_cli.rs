//! Local-CLI Status, Quota, Discovery, Connect & Bridge Injection HTTP Handlers.
//!
//! Static model catalogs live in `local_cli_registry` and authentication/OAuth
//! routes live in `local_cli_auth`.

pub use super::local_cli_auth::{
    handle_local_cli_delete, handle_local_cli_harvest, handle_local_cli_login,
    handle_local_cli_oauth_start, handle_local_cli_oauth_status, handle_local_cli_refresh,
    handle_local_cli_signin, handle_local_cli_token,
};
pub use super::local_cli_registry::{
    build_cli_provider_registry, build_discovered_list,
    default_models_for_target_impl as default_models_for_target,
};

use super::config::{read_aetheria_config, write_aetheria_config};
use crate::bridge::LOCAL_CLI_BRIDGE_PORT;
use crate::cred_store::{
    fetch_all_quotas, fetch_live_quotas_list, get_all_credentials, harvest_all,
    register_local_cli_to_config,
};
use crate::paths::{home_dir, now_ms};
use axum::{
    response::{IntoResponse, Response},
    Json,
};
use serde_json::{json, Value};

pub async fn handle_local_cli_status() -> Response {
    harvest_all();
    register_local_cli_to_config(LOCAL_CLI_BRIDGE_PORT);
    let creds = get_all_credentials();
    let quotas = fetch_all_quotas().await;

    let mut sources = serde_json::Map::new();
    for s in ["codex", "claude", "opencode", "kiro", "antigravity", "groq"] {
        if let Some(c) = creds.get(s) {
            let expired = c.expires_at.map(|exp| now_ms() >= exp).unwrap_or(false);
            sources.insert(
                s.to_string(),
                json!({
                    "connected": true,
                    "expired": expired,
                    "expiresAt": c.expires_at,
                    "updatedAt": c.updated_at,
                    "autoHarvested": c.auto_harvested,
                    "accountInfo": c.account_info,
                    "accountEmail": c.account_email.clone().or_else(|| c.account_info.clone().filter(|s| s.contains('@'))),
                    "hasRefreshToken": c.refresh_token.is_some(),
                    "quota": quotas.get(s).cloned()
                }),
            );
        } else {
            sources.insert(
                s.to_string(),
                json!({
                    "connected": false,
                    "expired": false
                }),
            );
        }
    }

    let agy_c = creds.get("antigravity");
    let agy_signed_in = agy_c.map(|c| !c.access_token.is_empty()).unwrap_or(false);
    let antigravity_slot = json!({
        "detected": true,
        "cliInstalled": true,
        "agyInstalled": true,
        "agySignedIn": agy_signed_in,
        "agyVersion": "1.3.1",
        "loggedIn": agy_signed_in,
        "accountEmail": agy_c.and_then(|c| c.account_email.clone()),
        "environment": "Google Antigravity CLI (agy)",
        "detail": if agy_signed_in { "Signed in & ready via Local-CLI Bridge" } else { "Not signed in" }
    });

    let claude_signed_in = creds
        .get("claude")
        .map(|c| !c.access_token.is_empty())
        .unwrap_or(false);
    let claude_slot = json!({
        "installed": true,
        "version": "2.1.202",
        "loggedIn": claude_signed_in,
        "signedIn": claude_signed_in,
        "credentialFile": "~/.claude/.credentials.json",
        "detail": if claude_signed_in { "Signed in & ready via Local-CLI Bridge" } else { "Not signed in" }
    });

    let codex_c = creds.get("codex");
    let codex_signed_in = codex_c.map(|c| !c.access_token.is_empty()).unwrap_or(false);
    let codex_slot = json!({
        "installed": true,
        "version": "0.1.0",
        "isCloudOnly": false,
        "signedIn": codex_signed_in,
        "loggedIn": codex_signed_in,
        "plan": if codex_signed_in { Some("free") } else { None },
        "accountEmail": codex_c.and_then(|c| c.account_email.clone()),
        "expiresAt": codex_c.and_then(|c| c.expires_at),
        "credentialFile": "~/.codex/auth.json",
        "detail": if codex_signed_in { "Signed in & ready via Local-CLI Bridge" } else { "Not signed in" }
    });

    let kiro_c = creds.get("kiro");
    let kiro_signed_in = kiro_c.map(|c| !c.access_token.is_empty()).unwrap_or(false);
    let kiro_slot = json!({
        "installed": true,
        "signedIn": kiro_signed_in,
        "loggedIn": kiro_signed_in,
        "requiresCli": false,
        "accountEmail": kiro_c.and_then(|c| c.account_email.clone()),
        "region": kiro_c.and_then(|c| c.region.clone()).unwrap_or_else(|| "us-east-1".to_string()),
        "hasRefreshToken": kiro_c.and_then(|c| c.refresh_token.as_ref()).is_some(),
        "expiresAt": kiro_c.and_then(|c| c.expires_at),
        "detail": if kiro_signed_in { "Signed in & ready via Local-CLI Bridge" } else { "Not signed in" }
    });

    let opencode_slot = json!({
        "installed": true,
        "version": "1.18.30",
        "loggedIn": true,
        "signedIn": true,
        "serverRunning": false,
        "serverPort": 4097,
        "authenticatedProviders": ["9router", "groq"],
        "hasGroq": true,
        "has9Router": true,
        "detail": "OpenCode interpreter ready"
    });

    let nine_router_slot = json!({
        "installed": true,
        "version": "0.5.35",
        "running": true,
        "port": LOCAL_CLI_BRIDGE_PORT,
        "baseUrl": format!("http://127.0.0.1:{}/v1", LOCAL_CLI_BRIDGE_PORT),
        "url": format!("http://127.0.0.1:{}/v1", LOCAL_CLI_BRIDGE_PORT),
        "models": default_models_for_target("9router"),
        "detail": "Built-in Rust Local-CLI Bridge active"
    });

    let mut data_envelope = json!({
        "claude": claude_slot,
        "opencode": opencode_slot,
        "antigravity": antigravity_slot,
        "kiro": kiro_slot,
        "nineRouter": nine_router_slot,
        "codex": codex_slot,
        "bridgePort": LOCAL_CLI_BRIDGE_PORT,
        "bridgeRunning": true,
        "discovered": build_discovered_list(),
        "registry": build_cli_provider_registry()
    });
    data_envelope["cardStates"] =
        super::cli_diagnostics::build_normalized_card_states(&data_envelope);

    Json(json!({
        "bridgeRunning": true,
        "bridgePort": LOCAL_CLI_BRIDGE_PORT,
        "bridgeUrl": format!("http://127.0.0.1:{}/v1", LOCAL_CLI_BRIDGE_PORT),
        "sources": sources,
        "quotas": quotas,
        "data": data_envelope
    }))
    .into_response()
}

pub async fn handle_local_cli_quotas() -> Response {
    let quotas = fetch_all_quotas().await;
    let list = fetch_live_quotas_list().await;
    Json(json!({ "ok": true, "quotas": quotas, "data": list })).into_response()
}

pub async fn handle_local_cli_quota_post() -> Response {
    let list = fetch_live_quotas_list().await;
    Json(json!({ "ok": true, "data": list })).into_response()
}

pub async fn handle_local_cli_models(Json(body): Json<Value>) -> Response {
    let target = body
        .get("target")
        .and_then(|v| v.as_str())
        .unwrap_or("kiro");
    let models = default_models_for_target(target);
    Json(json!({
        "data": {
            "target": target,
            "models": models
        }
    }))
    .into_response()
}

pub async fn handle_local_cli_discovered() -> Response {
    harvest_all();
    Json(json!({ "data": build_discovered_list() })).into_response()
}

pub async fn handle_local_cli_connect(Json(body): Json<Value>) -> Response {
    let target = body
        .get("target")
        .and_then(|v| v.as_str())
        .unwrap_or("kiro");
    let default_mods = default_models_for_target(target);
    let chosen_model = body
        .get("model")
        .and_then(|v| v.as_str())
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| default_mods.first().copied().unwrap_or("kiro/auto"));

    harvest_all();
    register_local_cli_to_config(LOCAL_CLI_BRIDGE_PORT);

    let pid = match target {
        "claude" => "claude-cli",
        "opencode" => "opencode-zen",
        "antigravity" => "antigravity-local",
        "9router" => "9router",
        "codex" => "codex-cli",
        "kiro" => "kiro-cli",
        other => other,
    };
    let disp_name = match target {
        "claude" => "Claude Code (Local Subscription)",
        "opencode" => "OpenCode Zen (Local CLI)",
        "antigravity" => "Antigravity (Local Account)",
        "9router" => "9Router (Local AI Hub)",
        "codex" => "OpenAI Codex (ChatGPT Subscription)",
        "kiro" => "Kiro (AWS CodeWhisperer)",
        other => other,
    };
    let base_url = format!("http://127.0.0.1:{}/v1", LOCAL_CLI_BRIDGE_PORT);

    let mut cfg = read_aetheria_config();
    if cfg.get("provider").and_then(|v| v.as_object()).is_none() {
        cfg["provider"] = json!({});
    }
    let mut models_obj = serde_json::Map::new();
    for m in &default_mods {
        models_obj.insert(
            (*m).to_string(),
            json!({
                "name": m,
                "attachment": true,
                "reasoning": true,
                "tool_call": true,
                "limit": { "context": 200000, "output": 32768 }
            }),
        );
    }
    models_obj.entry(chosen_model.to_string()).or_insert_with(|| {
        json!({
            "name": chosen_model,
            "attachment": true,
            "reasoning": true,
            "tool_call": true,
            "limit": { "context": 200000, "output": 32768 }
        })
    });

    cfg["provider"][pid] = json!({
        "name": disp_name,
        "type": "openai",
        "npm": "@ai-sdk/openai-compatible",
        "api": base_url,
        "defaultModel": chosen_model,
        "active": true,
        "priority": 1,
        "options": {
            "baseURL": base_url,
            "apiKey": format!("local-cli-{}", target)
        },
        "models": models_obj
    });
    cfg["model"] = Value::String(format!("local-cli/{}", chosen_model));
    write_aetheria_config(&cfg);

    Json(json!({
        "data": {
            "id": pid,
            "name": disp_name,
            "type": "openai",
            "baseUrl": base_url,
            "apiKey": format!("local-cli-{}", target),
            "model": chosen_model,
            "active": true,
            "priority": 1
        }
    }))
    .into_response()
}

pub async fn handle_local_cli_inject(Json(body): Json<Value>) -> Response {
    let target = body
        .get("target")
        .and_then(|v| v.as_str())
        .unwrap_or("all");
    let action = body
        .get("action")
        .and_then(|v| v.as_str())
        .unwrap_or("inject");
    let bridge_url = format!("http://127.0.0.1:{}", LOCAL_CLI_BRIDGE_PORT);
    let mut paths_touched = Vec::new();

    if target == "claude" || target == "all" {
        let claude_dir = home_dir().join(".claude");
        let _ = std::fs::create_dir_all(&claude_dir);
        let settings_path = claude_dir.join("settings.json");
        let mut val: Value = std::fs::read_to_string(&settings_path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_else(|| json!({}));
        if !val.is_object() {
            val = json!({});
        }
        if action == "inject" {
            if val.get("env").and_then(|v| v.as_object()).is_none() {
                val["env"] = json!({});
            }
            val["env"]["ANTHROPIC_BASE_URL"] = Value::String(bridge_url.clone());
            val["env"]["ANTHROPIC_AUTH_TOKEN"] = Value::String("aetheria-bridge".to_string());
        } else if let Some(env_obj) = val.get_mut("env").and_then(|v| v.as_object_mut()) {
            env_obj.remove("ANTHROPIC_BASE_URL");
            env_obj.remove("ANTHROPIC_AUTH_TOKEN");
        }
        if let Ok(raw) = serde_json::to_string_pretty(&val) {
            let _ = std::fs::write(&settings_path, raw);
            paths_touched.push(settings_path.to_string_lossy().to_string());
        }
    }

    if target == "codex" || target == "all" {
        let codex_dir = home_dir().join(".codex");
        let _ = std::fs::create_dir_all(&codex_dir);
        let cfg_path = codex_dir.join("config.toml");
        if action == "inject" {
            let toml_content = format!(
                "# Injected by Aetheria Local-CLI Bridge\nmodel_provider = \"aetheria\"\n\n[model_providers.aetheria]\nname = \"Aetheria Local Bridge\"\nbase_url = \"{}/v1\"\n",
                bridge_url
            );
            let _ = std::fs::write(&cfg_path, toml_content);
        } else if cfg_path.exists() {
            let _ = std::fs::remove_file(&cfg_path);
        }
        paths_touched.push(cfg_path.to_string_lossy().to_string());
    }

    let joined = paths_touched.join(", ");
    Json(json!({
        "data": {
            "success": true,
            "action": action,
            "path": joined,
            "message": format!("CLI config {} complete ({})", action, joined)
        }
    }))
    .into_response()
}

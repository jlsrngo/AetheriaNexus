//! Provider & Model Catalog Query Engine and Read-Only HTTP Handlers.
//!
//! Configuration mutations live in `catalog_crud` and live connection/model
//! probes live in `catalog_probe`.

use super::config::read_aetheria_config;
use crate::bridge::LOCAL_CLI_BRIDGE_PORT;
use crate::cred_store::register_local_cli_to_config;
use axum::{
    extract::Path as AxumPath,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::{json, Value};

pub fn build_catalog() -> (Vec<Value>, Vec<Value>) {
    register_local_cli_to_config(LOCAL_CLI_BRIDGE_PORT);
    let cfg = read_aetheria_config();
    let mut providers = Vec::new();
    let mut models = Vec::new();

    let prov_map_opt = cfg
        .get("provider")
        .or_else(|| cfg.get("providers"))
        .and_then(|v| v.as_object());

    if let Some(prov_map) = prov_map_opt {
        for (pid, pval) in prov_map {
            let pname = pval
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or(pid.as_str());
            let base_url = pval
                .pointer("/options/baseURL")
                .or_else(|| pval.pointer("/api/url"))
                .or_else(|| pval.get("api").filter(|v| v.is_string()))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            providers.push(json!({
                "id": pid,
                "name": pname,
                "api": {
                    "type": "aisdk",
                    "package": pval.get("npm").and_then(|v| v.as_str()).unwrap_or("@ai-sdk/openai-compatible"),
                    "url": base_url,
                    "settings": pval.get("options").cloned().unwrap_or_else(|| json!({}))
                },
                "request": { "headers": {}, "body": {} }
            }));

            let mut combined_models = pval
                .get("models")
                .and_then(|v| v.as_object())
                .cloned()
                .unwrap_or_default();

            let cli_target = match pid.as_str() {
                "antigravity" | "antigravity-local" | "gemini" | "gemini-cli" => Some("antigravity"),
                "claude" | "claude-code" | "claude-cli" => Some("claude"),
                "codex" | "codex-cli" => Some("codex"),
                "kiro" | "kiro-cli" => Some("kiro"),
                "opencode" | "opencode-zen" => Some("opencode"),
                "9router" | "nineRouter" => Some("9router"),
                _ => None,
            };
            if let Some(t) = cli_target {
                for m in super::local_cli::default_models_for_target(t) {
                    combined_models.entry(m.to_string()).or_insert_with(|| {
                        json!({
                            "name": m,
                            "attachment": true,
                            "reasoning": true,
                            "tool_call": true,
                            "limit": { "context": 200000, "output": 32768 }
                        })
                    });
                }
            }

            for (mid, mval) in &combined_models {
                let mname = mval
                    .get("name")
                    .and_then(|v| v.as_str())
                    .unwrap_or(mid.as_str());
                let ctx_lim = mval
                    .pointer("/limit/context")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(200_000);
                let out_lim = mval
                    .pointer("/limit/output")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(32_768);
                models.push(json!({
                    "id": mid,
                    "providerID": pid,
                    "name": mname,
                    "api": {
                        "id": mid,
                        "type": "aisdk",
                        "package": "@ai-sdk/openai-compatible",
                        "url": base_url,
                        "settings": {}
                    },
                    "capabilities": {
                        "tools": mval.get("tool_call").and_then(|v| v.as_bool()).unwrap_or(true),
                        "input": ["text", "image"],
                        "output": ["text"]
                    },
                    "request": { "headers": {}, "body": {} },
                    "variants": [],
                    "time": { "released": 0 },
                    "cost": mval.get("cost").cloned().unwrap_or_else(|| json!([])),
                    "status": "active",
                    "enabled": true,
                    "limit": {
                        "context": ctx_lim,
                        "output": out_lim
                    }
                }));
            }
        }
    }

    (providers, models)
}

pub async fn handle_model_list() -> Response {
    let (_, models) = build_catalog();
    Json(json!({ "data": models })).into_response()
}

pub async fn handle_provider_list() -> Response {
    let (providers, _) = build_catalog();
    Json(json!({ "data": providers })).into_response()
}

pub async fn handle_provider_get(AxumPath(id): AxumPath<String>) -> Response {
    let (providers, _) = build_catalog();
    if let Some(p) = providers
        .into_iter()
        .find(|p| p.get("id").and_then(|v| v.as_str()) == Some(&id))
    {
        return Json(json!({ "data": p })).into_response();
    }
    (
        StatusCode::NOT_FOUND,
        Json(json!({ "error": format!("Provider not found: {}", id) })),
    )
        .into_response()
}

pub async fn handle_agent_list() -> Response {
    let agents = vec![
        json!({
            "id": "default",
            "description": "AetheriaNexus Remotion React Video Studio Agent",
            "request": { "headers": {}, "body": {} },
            "mode": "primary",
            "hidden": false,
            "permissions": []
        }),
        json!({
            "id": "build",
            "description": "AetheriaNexus Remotion Video Execution Agent",
            "request": { "headers": {}, "body": {} },
            "mode": "primary",
            "hidden": false,
            "permissions": []
        }),
    ];
    Json(json!({ "data": agents })).into_response()
}

pub async fn handle_agent_get(AxumPath(id): AxumPath<String>) -> Response {
    Json(json!({
        "data": {
            "id": id,
            "description": "AetheriaNexus Remotion React Video Studio Agent",
            "request": { "headers": {}, "body": {} },
            "mode": "primary",
            "hidden": false,
            "permissions": []
        }
    }))
    .into_response()
}

pub fn build_ui_providers_list() -> Vec<Value> {
    register_local_cli_to_config(LOCAL_CLI_BRIDGE_PORT);
    let cfg = read_aetheria_config();
    let active_model_str = cfg.get("model").and_then(|v| v.as_str()).unwrap_or("");
    let mut out = Vec::new();
    let prov_map_opt = cfg
        .get("provider")
        .or_else(|| cfg.get("providers"))
        .and_then(|v| v.as_object());

    if let Some(prov_map) = prov_map_opt {
        for (idx, (pid, pval)) in prov_map.iter().enumerate() {
            if pid == "local-cli" {
                continue;
            }
            let pname = pval
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or(pid.as_str());
            let base_url = pval
                .pointer("/options/baseURL")
                .or_else(|| pval.pointer("/api/url"))
                .or_else(|| pval.get("api").filter(|v| v.is_string()))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let api_key = pval
                .pointer("/options/apiKey")
                .or_else(|| pval.pointer("/request/body/apiKey"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let first_model = pval
                .get("models")
                .and_then(|v| v.as_object())
                .and_then(|m| m.keys().next().cloned())
                .unwrap_or_default();
            let active = active_model_str.starts_with(&format!("{}/", pid))
                || pval.get("active").and_then(|v| v.as_bool()).unwrap_or(true);
            let selected_model =
                if let Some(rest) = active_model_str.strip_prefix(&format!("{}/", pid)) {
                    rest.to_string()
                } else {
                    pval.get("defaultModel")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string())
                        .unwrap_or(first_model)
                };
            let priority = pval
                .get("priority")
                .and_then(|v| v.as_u64())
                .unwrap_or((idx + 1) as u64);

            let is_cli = super::cloud_manager::is_cli_provider(pid, base_url, pname, api_key);

            out.push(json!({
                "id": pid,
                "name": pname,
                "type": pval.get("type").and_then(|v| v.as_str()).unwrap_or("openai"),
                "baseUrl": base_url,
                "apiKey": api_key,
                "model": selected_model,
                "headerPrefix": pval.get("headerPrefix").and_then(|v| v.as_str()),
                "headerTitle": pval.get("headerTitle").and_then(|v| v.as_str()),
                "active": active,
                "priority": priority,
                "isCli": is_cli,
                "category": if is_cli { "cli" } else { "cloud" }
            }));
        }
    }
    out
}

/// Resolves model `cost` tiers from `cfg` (`/provider/<pid>/models/<mid>/cost` or `/providers/...`).
pub fn resolve_model_cost_tiers(
    cfg: &Value,
    provider_id: &str,
    model_id: &str,
) -> Vec<crate::session::usage::CostTier> {
    let cost_val = cfg
        .pointer(&format!("/provider/{}/models/{}/cost", provider_id, model_id))
        .or_else(|| cfg.pointer(&format!("/providers/{}/models/{}/cost", provider_id, model_id)));
    crate::session::usage::parse_cost_tiers(cost_val)
}

pub async fn handle_ui_providers_list() -> Response {
    let list = build_ui_providers_list();
    Json(json!({ "data": list })).into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_ui_providers_list_returns_valid_list() {
        let list = build_ui_providers_list();
        for p in &list {
            assert!(p.get("id").is_some());
            assert!(p.get("name").is_some());
        }
        if let Some(kenari) = list
            .iter()
            .find(|p| p.get("id").and_then(|v| v.as_str()) == Some("kenari"))
        {
            let key = kenari.get("apiKey").and_then(|v| v.as_str()).unwrap_or("");
            assert!(!key.is_empty(), "Kenari API key must not be empty if present");
        }
    }
}

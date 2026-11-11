//! Resolves the active LLM provider endpoint, API key, and model ID for subagents.
//! Isolated so subagent execution logic stays cleanly decoupled from config lookup.

use crate::provider::read_aetheria_config;

pub(crate) async fn resolve_subagent_provider_config() -> (String, String, String) {
    let cfg = read_aetheria_config();
    let active_provider = cfg
        .get("provider_type")
        .or_else(|| cfg.get("active_provider"))
        .and_then(|v| v.as_str())
        .unwrap_or("api");

    let mut base_url = crate::bridge::get_bridge_base_url();
    let mut api_key = String::from("local-cli-bridge");
    let mut model_id = String::from("glm-5.1");

    if active_provider == "custom" {
        if let Some(u) = cfg.get("custom_base_url").and_then(|v| v.as_str()) {
            if !u.is_empty() {
                base_url = u.trim_end_matches('/').to_string();
            }
        }
        if let Some(k) = cfg.get("custom_api_key").and_then(|v| v.as_str()) {
            api_key = k.to_string();
        }
        if let Some(m) = cfg.get("custom_model").and_then(|v| v.as_str()) {
            if !m.is_empty() {
                model_id = m.to_string();
            }
        }
    } else if active_provider == "local-cli" || active_provider == "antigravity" {
        let port = crate::bridge::ensure_bridge_running().await;
        base_url = format!("http://127.0.0.1:{}/v1", port);
        if let Some(k) = cfg.get("local_api_key").and_then(|v| v.as_str()) {
            api_key = k.to_string();
        }
        if let Some(m) = cfg.get("local_model").and_then(|v| v.as_str()) {
            if !m.is_empty() {
                model_id = m.to_string();
            }
        }
    } else {
        if let Some(u) = cfg.get("api_base_url").and_then(|v| v.as_str()) {
            if !u.is_empty() {
                base_url = u.trim_end_matches('/').to_string();
            }
        }
        if let Some(k) = cfg.get("api_key").and_then(|v| v.as_str()) {
            api_key = k.to_string();
        }
        if let Some(m) = cfg.get("api_model").and_then(|v| v.as_str()) {
            if !m.is_empty() {
                model_id = m.to_string();
            }
        }
    }

    (base_url, api_key, model_id)
}


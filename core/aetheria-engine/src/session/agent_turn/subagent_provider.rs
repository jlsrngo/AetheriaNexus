//! Resolves the active LLM provider endpoint, API key, and model ID for subagents.
//! Inherits the parent session's active provider/model so subagents run on the exact model chosen by the user.

use crate::provider::read_aetheria_config;
use crate::session::model::default_model_ref;
use crate::session::session::with_store;
use serde_json::Value;

fn resolve_parent_model_ref(parent_session_id: &str) -> (String, String) {
    let parent_model = with_store(|store| {
        store
            .sessions
            .get(parent_session_id)
            .and_then(|s| s.get("model"))
            .cloned()
    })
    .unwrap_or_else(default_model_ref);

    let provider_id = parent_model
        .get("providerID")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("local-cli")
        .to_string();
    let model_id = parent_model
        .get("id")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("kiro/auto")
        .to_string();

    (provider_id, model_id)
}

fn resolve_provider_endpoint_and_key(cfg: &Value, provider_id: &str, bridge_url: &str) -> (String, String) {
    if provider_id == "antigravity" || provider_id == "local-cli" {
        return (bridge_url.to_string(), "local-cli-bridge".to_string());
    }

    let base_url = cfg
        .pointer(&format!("/provider/{}/options/baseURL", provider_id))
        .or_else(|| cfg.pointer(&format!("/provider/{}/api/url", provider_id)))
        .or_else(|| cfg.pointer(&format!("/provider/{}/api", provider_id)))
        .or_else(|| cfg.pointer(&format!("/providers/{}/options/baseURL", provider_id)))
        .or_else(|| cfg.pointer(&format!("/providers/{}/api/url", provider_id)))
        .and_then(Value::as_str)
        .map(|s| s.trim_end_matches('/').to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| bridge_url.to_string());

    let api_key = cfg
        .pointer(&format!("/provider/{}/options/apiKey", provider_id))
        .or_else(|| cfg.pointer(&format!("/provider/{}/request/body/apiKey", provider_id)))
        .or_else(|| cfg.pointer(&format!("/providers/{}/options/apiKey", provider_id)))
        .or_else(|| cfg.pointer(&format!("/providers/{}/request/body/apiKey", provider_id)))
        .and_then(Value::as_str)
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "local-cli-bridge".to_string());

    (base_url, api_key)
}

pub(crate) async fn resolve_subagent_provider_config(
    parent_session_id: &str,
) -> (String, String, String) {
    let cfg = read_aetheria_config();
    let (provider_id, model_id) = resolve_parent_model_ref(parent_session_id);

    let bridge_url = if provider_id == "antigravity" || provider_id == "local-cli" {
        let port = crate::bridge::ensure_bridge_running().await;
        format!("http://127.0.0.1:{}/v1", port)
    } else {
        crate::bridge::get_bridge_base_url()
    };

    let (base_url, api_key) = resolve_provider_endpoint_and_key(&cfg, &provider_id, &bridge_url);
    (base_url, api_key, model_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[tokio::test]
    async fn inherits_parent_session_provider_and_model() {
        let sid = "sess_subagent_inherit_test";
        with_store(|store| {
            store.sessions.insert(
                sid.to_string(),
                json!({
                    "id": sid,
                    "model": {
                        "providerID": "local-cli",
                        "id": "kiro/claude-sonnet-4.5"
                    }
                }),
            );
        });

        let (pid, mid) = resolve_parent_model_ref(sid);
        assert_eq!(pid, "local-cli");
        assert_eq!(mid, "kiro/claude-sonnet-4.5");

        let (url, key) = resolve_provider_endpoint_and_key(
            &json!({
                "provider": {
                    "kenari": {
                        "options": {
                            "baseURL": "https://kenari.id/v1",
                            "apiKey": "kn-test"
                        }
                    }
                }
            }),
            "kenari",
            "http://127.0.0.1:20288/v1",
        );
        assert_eq!(url, "https://kenari.id/v1");
        assert_eq!(key, "kn-test");
    }
}


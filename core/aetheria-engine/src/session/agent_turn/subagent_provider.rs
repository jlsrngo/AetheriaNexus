//! Resolves the active LLM provider endpoint, API key, and model ID for subagents.
//! Inherits the parent session's active provider/model so subagents run on the exact model chosen by the user.

use crate::provider::read_aetheria_config;
use crate::session::model::default_model_ref;
use crate::session::session::with_store;
use serde_json::Value;

pub(crate) fn resolve_parent_model_ref(parent_session_id: &str) -> (String, String) {
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

fn parse_model_spec(cfg: &Value, spec: &str, fallback_provider: &str) -> Option<(String, String)> {
    let trimmed = spec.trim();
    if trimmed.is_empty() {
        return None;
    }
    if let Some((p, m)) = trimmed.split_once('/') {
        let p = p.trim();
        let m = m.trim();
        if !p.is_empty() && !m.is_empty() {
            let is_known_provider = cfg.pointer(&format!("/provider/{}", p)).is_some()
                || cfg.pointer(&format!("/providers/{}", p)).is_some()
                || matches!(
                    p,
                    "local-cli" | "antigravity" | "kenari" | "openai" | "anthropic" | "google" | "parity"
                )
                || p.starts_with("parity");
            if is_known_provider {
                return Some((p.to_string(), m.to_string()));
            }
        }
    }
    Some((fallback_provider.to_string(), trimmed.to_string()))
}

fn resolve_agent_configured_model(
    cfg: &Value,
    agent_name: &str,
    fallback_provider: &str,
) -> Option<(String, String)> {
    let agent_model = cfg.pointer(&format!("/agent/{}/model", agent_name))?;
    if let Some(s) = agent_model.as_str() {
        return parse_model_spec(cfg, s, fallback_provider);
    }
    if let Some(obj) = agent_model.as_object() {
        let pid = obj
            .get("providerID")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .unwrap_or(fallback_provider);
        let mid = obj
            .get("modelID")
            .or_else(|| obj.get("id"))
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|s| !s.is_empty())?;
        return Some((pid.to_string(), mid.to_string()));
    }
    None
}

pub(crate) async fn resolve_subagent_provider_config_for_call(
    parent_session_id: &str,
    agent_name: &str,
    model_override: Option<&str>,
) -> (String, String, String, String) {
    let cfg = read_aetheria_config();
    let (parent_provider_id, parent_model_id) = resolve_parent_model_ref(parent_session_id);
    let (provider_id, model_id) = model_override
        .and_then(|spec| parse_model_spec(&cfg, spec, &parent_provider_id))
        .or_else(|| resolve_agent_configured_model(&cfg, agent_name, &parent_provider_id))
        .unwrap_or_else(|| (parent_provider_id.clone(), parent_model_id));

    let session_model = with_store(|store| {
        store
            .sessions
            .get(parent_session_id)
            .and_then(|s| s.get("model"))
            .cloned()
    });

    let bridge_url = if provider_id == "antigravity" || provider_id == "local-cli" {
        let port = crate::bridge::ensure_bridge_running().await;
        format!("http://127.0.0.1:{}/v1", port)
    } else {
        crate::bridge::get_bridge_base_url()
    };

    let (mut base_url, mut api_key) =
        resolve_provider_endpoint_and_key(&cfg, &provider_id, &bridge_url);
    if provider_id == parent_provider_id {
        if let Some(ref sm) = session_model {
            if let Some(sess_url) = sm
                .get("baseURL")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|s| !s.is_empty())
            {
                base_url = sess_url.trim_end_matches('/').to_string();
            }
            if let Some(sess_key) = sm
                .get("apiKey")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|s| !s.is_empty())
            {
                api_key = sess_key.to_string();
            }
        }
    }
    (base_url, api_key, model_id, provider_id)
}

#[allow(dead_code)]
pub(crate) async fn resolve_subagent_provider_config(
    parent_session_id: &str,
) -> (String, String, String) {
    let (base_url, api_key, model_id, _provider_id) =
        resolve_subagent_provider_config_for_call(parent_session_id, "general", None).await;
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


//! Antigravity (Google Cloud Code v1internal) Model Mapping, Project Discovery & Signature Cache.

use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

static AGY_PROJECT_ID: OnceLock<Mutex<Option<(String, String)>>> = OnceLock::new();
static AGY_SIGNATURES: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();

pub(crate) fn clear_antigravity_project_id_cache() {
    let m = AGY_PROJECT_ID.get_or_init(|| Mutex::new(None));
    if let Ok(mut guard) = m.lock() {
        *guard = None;
    }
}

pub(crate) fn remember_signature(key: &str, sig: &str) {
    if key.is_empty() || sig.is_empty() {
        return;
    }
    let m = AGY_SIGNATURES.get_or_init(|| Mutex::new(HashMap::new()));
    if let Ok(mut guard) = m.lock() {
        guard.insert(key.to_string(), sig.to_string());
    }
}

pub(crate) fn lookup_signature(key: &str) -> Option<String> {
    let m = AGY_SIGNATURES.get_or_init(|| Mutex::new(HashMap::new()));
    m.lock().ok().and_then(|g| g.get(key).cloned())
}

pub(crate) fn map_antigravity_model(model: &str) -> (&'static str, Option<&'static str>) {
    match model {
        "gemini-3.8-pro-high" => ("gemini-3.1-pro-high", Some("high")),
        "gemini-3.8-pro-low" => ("gemini-3.1-pro-low", Some("low")),
        "gemini-3.8-flash-high" => ("gemini-3-flash", Some("high")),
        "gemini-3.8-flash-medium" => ("gemini-3-flash", Some("medium")),
        "gemini-3.8-flash-low" => ("gemini-3-flash", Some("low")),
        "gemini-3.8-flash-minimal" => ("gemini-3-flash", Some("minimal")),
        "claude-sonnet-4-6-agy" => ("claude-sonnet-4-6", None),
        "claude-opus-4-6-thinking" => ("claude-opus-4-6-thinking", Some("high")),
        "gpt-oss-120b-medium" => ("gpt-oss-120b-medium", Some("medium")),
        _ => ("gemini-3-flash", Some("medium")),
    }
}

fn extract_project_id_value(v: &Value) -> Option<String> {
    v.as_str()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .or_else(|| {
            v.get("id")
                .and_then(|x| x.as_str())
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(|s| s.to_string())
        })
}

pub(crate) async fn get_antigravity_project_id(access_token: &str) -> String {
    if access_token.is_empty() {
        return "rising-fact-p41fc".to_string();
    }

    {
        let m = AGY_PROJECT_ID.get_or_init(|| Mutex::new(None));
        if let Ok(guard) = m.lock() {
            if let Some((ref cached_tok, ref cached_pid)) = *guard {
                if cached_tok == access_token && !cached_pid.is_empty() {
                    return cached_pid.clone();
                }
            }
        }
    }

    let load_url = std::env::var("AETHERIA_ANTIGRAVITY_LOAD_PROJECT_URL")
        .unwrap_or_else(|_| "https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist".to_string());
    if load_url.trim().is_empty() {
        return "rising-fact-p41fc".to_string();
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .unwrap_or_default();

    let metadata = json!({
        "ideType": "ANTIGRAVITY",
        "platform": "WINDOWS",
        "pluginType": "GEMINI"
    });

    if let Ok(resp) = client
        .post(&load_url)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("Content-Type", "application/json")
        .header("User-Agent", "antigravity/2.0.7 windows/amd64")
        .json(&json!({ "metadata": metadata }))
        .send()
        .await
    {
        if let Ok(data) = resp.json::<Value>().await {
            let mut resolved_pid = data
                .get("cloudaicompanionProject")
                .and_then(extract_project_id_value);

            if resolved_pid.is_none() {
                let tier_id = data
                    .get("allowedTiers")
                    .and_then(|v| v.as_array())
                    .and_then(|tiers| {
                        tiers
                            .iter()
                            .find(|t| t.get("isDefault").and_then(|b| b.as_bool()) == Some(true))
                            .or_else(|| tiers.first())
                            .and_then(|t| t.get("id").and_then(|id| id.as_str()))
                    })
                    .unwrap_or("free-tier");

                let onboard_url = std::env::var("AETHERIA_ANTIGRAVITY_ONBOARD_URL").unwrap_or_else(|_| {
                    "https://cloudcode-pa.googleapis.com/v1internal:onboardUser".to_string()
                });
                if !onboard_url.trim().is_empty() {
                    if let Ok(onb_resp) = client
                        .post(&onboard_url)
                        .header("Authorization", format!("Bearer {}", access_token))
                        .header("Content-Type", "application/json")
                        .header("User-Agent", "antigravity/2.0.7 windows/amd64")
                        .json(&json!({
                            "tierId": tier_id,
                            "metadata": metadata
                        }))
                        .send()
                        .await
                    {
                        if let Ok(onb_data) = onb_resp.json::<Value>().await {
                            resolved_pid = onb_data
                                .pointer("/response/cloudaicompanionProject")
                                .or_else(|| onb_data.get("cloudaicompanionProject"))
                                .and_then(extract_project_id_value);
                        }
                    }
                }
            }

            if let Some(pid) = resolved_pid {
                let m = AGY_PROJECT_ID.get_or_init(|| Mutex::new(None));
                if let Ok(mut guard) = m.lock() {
                    *guard = Some((access_token.to_string(), pid.clone()));
                }
                return pid;
            }
        }
    }

    "rising-fact-p41fc".to_string()
}


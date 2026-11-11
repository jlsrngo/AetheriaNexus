//! Antigravity (Google Cloud Code v1internal) Model Mapping, Project Discovery & Signature Cache.

use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

static AGY_PROJECT_ID: OnceLock<Mutex<Option<String>>> = OnceLock::new();
static AGY_SIGNATURES: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();

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

pub(crate) async fn get_antigravity_project_id(access_token: &str) -> String {
    {
        let m = AGY_PROJECT_ID.get_or_init(|| Mutex::new(None));
        if let Ok(guard) = m.lock() {
            if let Some(ref pid) = *guard {
                return pid.clone();
            }
        }
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .unwrap_or_default();

    if let Ok(resp) = client
        .post("https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist")
        .header("Authorization", format!("Bearer {}", access_token))
        .header("Content-Type", "application/json")
        .header("User-Agent", "antigravity/2.0.7 windows/amd64")
        .json(&json!({
            "metadata": {
                "ideType": "ANTIGRAVITY",
                "platform": "WINDOWS",
                "pluginType": "GEMINI"
            }
        }))
        .send()
        .await
    {
        if let Ok(data) = resp.json::<Value>().await {
            let pid = data
                .get("cloudaicompanionProject")
                .and_then(|v| {
                    v.as_str()
                        .map(|s| s.to_string())
                        .or_else(|| v.get("id").and_then(|x| x.as_str()).map(|s| s.to_string()))
                })
                .unwrap_or_else(|| "rising-fact-p41fc".to_string());
            let m = AGY_PROJECT_ID.get_or_init(|| Mutex::new(None));
            if let Ok(mut guard) = m.lock() {
                *guard = Some(pid.clone());
            }
            return pid;
        }
    }

    "rising-fact-p41fc".to_string()
}


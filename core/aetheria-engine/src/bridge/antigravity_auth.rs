//! Antigravity (Google Cloud Code v1internal) Model Mapping, Project Discovery & Signature Cache.

use crate::paths::now_ms;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fmt::Write as _;
use std::sync::{Mutex, OnceLock};

pub const ANTIGRAVITY_IDE_USER_AGENT: &str = "antigravity/hub/2.24.0 darwin/arm64";
pub const ANTIGRAVITY_DAILY_STREAM_URL: &str =
    "https://daily-cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse";

/// Numeric `ClientMetadata` enum payload expected by Cloud Code Assist `loadCodeAssist`/`onboardUser`.
pub fn client_metadata_json() -> Value {
    let platform_enum: u8 = if cfg!(target_os = "macos") {
        if cfg!(target_arch = "aarch64") {
            2
        } else {
            1
        }
    } else if cfg!(target_os = "linux") {
        if cfg!(target_arch = "aarch64") {
            4
        } else {
            3
        }
    } else if cfg!(target_os = "windows") {
        5
    } else {
        0
    };
    json!({
        "ideType": 9,
        "platform": platform_enum,
        "pluginType": 2
    })
}

fn uuid_from_seed(seed: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(if seed.is_empty() {
        b"antigravity".as_slice()
    } else {
        seed.as_bytes()
    });
    let digest = hasher.finalize();
    let mut bytes = [0u8; 16];
    bytes.copy_from_slice(&digest[..16]);
    bytes[6] = (bytes[6] & 0x0f) | 0x50;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    let mut hex = String::with_capacity(32);
    for b in bytes {
        let _ = write!(&mut hex, "{:02x}", b);
    }
    format!(
        "{}-{}-{}-{}-{}",
        &hex[0..8],
        &hex[8..12],
        &hex[12..16],
        &hex[16..20],
        &hex[20..32]
    )
}

/// Formats `agent/<conversationUuid>/<timestampMs>/<trajectoryUuid>/<step>` matching Antigravity IDE.
pub fn build_antigravity_ide_request_id(
    project_id: &str,
    model: &str,
    content_count: usize,
) -> String {
    let session_key = if project_id.trim().is_empty() {
        "anonymous"
    } else {
        project_id.trim()
    };
    let conv_uuid = uuid_from_seed(&format!("antigravity:conversation:{}", session_key));
    let traj_uuid = uuid_from_seed(&format!("antigravity:trajectory:{}:{}", session_key, model));
    let step = content_count.max(1).saturating_mul(2) - 1;
    format!("agent/{}/{}/{}/{}", conv_uuid, now_ms(), traj_uuid, step)
}

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

    let metadata = client_metadata_json();

    if let Ok(resp) = client
        .post(&load_url)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("Content-Type", "application/json")
        .header("User-Agent", ANTIGRAVITY_IDE_USER_AGENT)
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
                    .unwrap_or("legacy-tier");

                let onboard_url = std::env::var("AETHERIA_ANTIGRAVITY_ONBOARD_URL").unwrap_or_else(|_| {
                    "https://cloudcode-pa.googleapis.com/v1internal:onboardUser".to_string()
                });
                if !onboard_url.trim().is_empty() {
                    if let Ok(onb_resp) = client
                        .post(&onboard_url)
                        .header("Authorization", format!("Bearer {}", access_token))
                        .header("Content-Type", "application/json")
                        .header("User-Agent", ANTIGRAVITY_IDE_USER_AGENT)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn client_metadata_uses_numeric_enums() {
        let meta = client_metadata_json();
        assert_eq!(meta["ideType"], json!(9));
        assert_eq!(meta["pluginType"], json!(2));
        #[cfg(target_os = "windows")]
        assert_eq!(meta["platform"], json!(5));
        #[cfg(not(target_os = "windows"))]
        assert!(meta["platform"].as_u64().is_some());
    }

    #[test]
    fn build_antigravity_ide_request_id_matches_ide_format() {
        let req_id = build_antigravity_ide_request_id("aicode-consumers", "gemini-3-flash", 3);
        let parts: Vec<&str> = req_id.split('/').collect();
        assert_eq!(parts.len(), 5);
        assert_eq!(parts[0], "agent");
        assert_eq!(parts[1].len(), 36);
        assert!(parts[2].parse::<u64>().is_ok());
        assert_eq!(parts[3].len(), 36);
        assert_eq!(parts[4], "5");
        assert_eq!(parts[1].chars().nth(14), Some('5'));
    }
}


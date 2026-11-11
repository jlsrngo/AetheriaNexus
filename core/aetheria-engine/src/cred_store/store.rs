//! Credential store persistence and in-memory cache (`local-cli-credentials.json`).

pub use super::cli_config_sync::register_local_cli_to_config;
pub use super::vault_helpers::{
    decode_jwt_payload, is_expired, parse_iso_to_ms, read_windows_generic_credential,
};

use super::types::{CredentialEntry, CredentialStore};
use crate::paths::{aetheria_dot_dir, now_ms};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

static STORE_CACHE: OnceLock<Mutex<CredentialStore>> = OnceLock::new();

pub fn cred_file_path() -> PathBuf {
    aetheria_dot_dir().join("local-cli-credentials.json")
}

pub fn load_store_from_disk() -> CredentialStore {
    let path = cred_file_path();
    let mut entries = HashMap::new();
    if let Ok(raw) = std::fs::read_to_string(&path) {
        let trimmed = raw.trim_start_matches('\u{feff}');
        if let Ok(val) = serde_json::from_str::<Value>(trimmed) {
            let map_opt = val
                .get("entries")
                .and_then(|e| e.as_object())
                .or_else(|| val.as_object());
            if let Some(map) = map_opt {
                for (k, v) in map {
                    if k == "version" || k == "entries" {
                        continue;
                    }
                    if let Ok(mut entry) = serde_json::from_value::<CredentialEntry>(v.clone()) {
                        if entry.source.is_empty() {
                            entry.source = k.clone();
                        }
                        if !entry.access_token.is_empty() {
                            entries.insert(k.clone(), entry);
                        }
                    }
                }
            }
        }
    }
    CredentialStore {
        version: 1,
        entries,
    }
}

pub fn save_store_to_disk(store: &CredentialStore) {
    let path = cred_file_path();
    let mut root_map = serde_json::Map::new();
    if let Ok(raw) = std::fs::read_to_string(&path) {
        let trimmed = raw.trim_start_matches('\u{feff}');
        if let Ok(Value::Object(existing)) = serde_json::from_str::<Value>(trimmed) {
            if !existing.contains_key("entries") {
                root_map = existing;
            }
        }
    }

    for (k, entry) in &store.entries {
        let mut obj = root_map
            .get(k)
            .and_then(|v| v.as_object())
            .cloned()
            .unwrap_or_default();
        obj.insert("provider".to_string(), Value::String(k.clone()));
        if !obj.contains_key("displayName") {
            let disp = match k.as_str() {
                "codex" => "OpenAI Codex / ChatGPT",
                "kiro" => "Kiro (AWS)",
                "opencode" => "OpenCode Zen",
                "claude" => "Claude Code",
                "antigravity" => "Google Antigravity (agy)",
                _ => k.as_str(),
            };
            obj.insert("displayName".to_string(), Value::String(disp.to_string()));
        }
        if !obj.contains_key("type") {
            let t = if k == "opencode" { "api_key" } else { "oauth" };
            obj.insert("type".to_string(), Value::String(t.to_string()));
        }
        obj.insert(
            "accessToken".to_string(),
            Value::String(entry.access_token.clone()),
        );
        if let Some(ref rt) = entry.refresh_token {
            obj.insert("refreshToken".to_string(), Value::String(rt.clone()));
        }
        if let Some(exp) = entry.expires_at {
            obj.insert("expiresAt".to_string(), json!(exp));
        }
        if let Some(ref cid) = entry.client_id {
            obj.insert("clientId".to_string(), Value::String(cid.clone()));
        }
        if let Some(ref csec) = entry.client_secret {
            obj.insert("clientSecret".to_string(), Value::String(csec.clone()));
        }
        if let Some(ref reg) = entry.region {
            obj.insert("region".to_string(), Value::String(reg.clone()));
        }
        if let Some(ref parn) = entry.profile_arn {
            obj.insert("profileArn".to_string(), Value::String(parn.clone()));
        }
        if let Some(ref aid) = entry.account_id {
            obj.insert("accountId".to_string(), Value::String(aid.clone()));
        }
        if let Some(ref aem) = entry.account_email {
            obj.insert("accountEmail".to_string(), Value::String(aem.clone()));
        }
        obj.insert("lastRefreshAt".to_string(), json!(now_ms()));
        if !obj.contains_key("sourcePath") {
            obj.insert("sourcePath".to_string(), Value::String(String::new()));
        }
        root_map.insert(k.clone(), Value::Object(obj));
    }

    if let Ok(raw) = serde_json::to_string_pretty(&Value::Object(root_map)) {
        let _ = std::fs::write(path, raw);
    }
}

pub fn with_store<F, R>(f: F) -> R
where
    F: FnOnce(&mut CredentialStore) -> R,
{
    let mutex = STORE_CACHE.get_or_init(|| Mutex::new(load_store_from_disk()));
    let mut guard = mutex.lock().unwrap_or_else(|e| e.into_inner());
    f(&mut guard)
}

pub fn get_credential(source: &str) -> Option<CredentialEntry> {
    with_store(|store| store.entries.get(source).cloned())
}

pub fn set_credential(entry: CredentialEntry) {
    with_store(|store| {
        store.entries.insert(entry.source.clone(), entry);
        save_store_to_disk(store);
    });
}

pub fn remove_credential(source: &str) -> bool {
    with_store(|store| {
        let removed = store.entries.remove(source).is_some();
        if removed {
            save_store_to_disk(store);
        }
        removed
    })
}

pub fn get_all_credentials() -> HashMap<String, CredentialEntry> {
    with_store(|store| store.entries.clone())
}

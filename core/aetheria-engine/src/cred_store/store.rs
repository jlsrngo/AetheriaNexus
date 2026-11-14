//! Credential store persistence and in-memory cache (`local-cli-credentials.json`).

pub use super::cli_config_sync::register_local_cli_to_config;
pub use super::vault_helpers::{
    decode_jwt_payload, is_expired, parse_iso_to_ms, read_windows_generic_credential,
};

use super::types::{CredentialEntry, CredentialStore};
use crate::paths::{aetheria_dot_dir, now_iso, now_ms};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

static STORE_CACHE: OnceLock<Mutex<CredentialStore>> = OnceLock::new();

pub fn cred_file_path() -> PathBuf {
    aetheria_dot_dir().join("local-cli-credentials.json")
}

fn set_optional_str_field(
    obj: &mut serde_json::Map<String, Value>,
    key: &str,
    val: Option<&str>,
) {
    match val {
        Some(v) if !v.is_empty() => {
            obj.insert(key.to_string(), Value::String(v.to_string()));
        }
        _ => {
            obj.remove(key);
        }
    }
}

pub fn load_store_from_path(path: &Path) -> CredentialStore {
    let mut entries = HashMap::new();
    let mut logged_out = HashSet::new();
    if let Ok(raw) = std::fs::read_to_string(path) {
        let trimmed = raw.trim_start_matches('\u{feff}');
        if let Ok(val) = serde_json::from_str::<Value>(trimmed) {
            if let Some(arr) = val.get("loggedOut").and_then(|v| v.as_array()) {
                for item in arr {
                    if let Some(s) = item.as_str() {
                        logged_out.insert(s.to_string());
                    }
                }
            }
            let map_opt = val
                .get("entries")
                .and_then(|e| e.as_object())
                .or_else(|| val.as_object());
            if let Some(map) = map_opt {
                for (k, v) in map {
                    if k == "version" || k == "entries" || k == "loggedOut" {
                        continue;
                    }
                    if v.get("loggedOut").and_then(|b| b.as_bool()).unwrap_or(false) {
                        logged_out.insert(k.clone());
                        continue;
                    }
                    if let Ok(mut entry) = serde_json::from_value::<CredentialEntry>(v.clone()) {
                        if entry.source.is_empty() {
                            entry.source = k.clone();
                        }
                        if entry.client_id.is_none() {
                            entry.client_id = v
                                .get("clientId")
                                .and_then(|s| s.as_str())
                                .map(|s| s.to_string());
                        }
                        if entry.client_secret.is_none() {
                            entry.client_secret = v
                                .get("clientSecret")
                                .and_then(|s| s.as_str())
                                .map(|s| s.to_string());
                        }
                        if let Some(ah) = v.get("autoHarvested").and_then(|b| b.as_bool()) {
                            entry.auto_harvested = ah;
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
        logged_out,
    }
}

pub fn load_store_from_disk() -> CredentialStore {
    load_store_from_path(&cred_file_path())
}

pub fn save_store_to_path(store: &CredentialStore, path: &Path) {
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let mut root_map = serde_json::Map::new();
    if let Ok(raw) = std::fs::read_to_string(path) {
        let trimmed = raw.trim_start_matches('\u{feff}');
        if let Ok(Value::Object(existing)) = serde_json::from_str::<Value>(trimmed) {
            if !existing.contains_key("entries") {
                root_map = existing;
            }
        }
    }

    root_map.retain(|k, _| store.entries.contains_key(k) || store.logged_out.contains(k));

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
        set_optional_str_field(&mut obj, "refreshToken", entry.refresh_token.as_deref());
        if let Some(exp) = entry.expires_at {
            obj.insert("expiresAt".to_string(), json!(exp));
        } else {
            obj.remove("expiresAt");
        }
        set_optional_str_field(&mut obj, "clientId", entry.client_id.as_deref());
        set_optional_str_field(&mut obj, "clientSecret", entry.client_secret.as_deref());
        set_optional_str_field(&mut obj, "region", entry.region.as_deref());
        set_optional_str_field(&mut obj, "profileArn", entry.profile_arn.as_deref());
        set_optional_str_field(&mut obj, "accountId", entry.account_id.as_deref());
        set_optional_str_field(&mut obj, "accountEmail", entry.account_email.as_deref());
        set_optional_str_field(&mut obj, "accountInfo", entry.account_info.as_deref());
        obj.insert("updatedAt".to_string(), Value::String(entry.updated_at.clone()));
        obj.insert(
            "autoHarvested".to_string(),
            Value::Bool(entry.auto_harvested),
        );
        obj.insert("loggedOut".to_string(), Value::Bool(false));
        obj.insert("lastRefreshAt".to_string(), json!(now_ms()));
        if !entry.auto_harvested {
            obj.insert(
                "sourcePath".to_string(),
                Value::String("Browser OAuth".to_string()),
            );
        } else if !obj.contains_key("sourcePath") {
            obj.insert("sourcePath".to_string(), Value::String(String::new()));
        }
        root_map.insert(k.clone(), Value::Object(obj));
    }

    for k in &store.logged_out {
        if store.entries.contains_key(k) {
            continue;
        }
        root_map.insert(
            k.clone(),
            json!({
                "provider": k,
                "loggedOut": true,
                "accessToken": "",
                "updatedAt": now_iso(),
            }),
        );
    }

    if let Ok(raw) = serde_json::to_string_pretty(&Value::Object(root_map)) {
        let _ = std::fs::write(path, raw);
    }
}

pub fn save_store_to_disk(store: &CredentialStore) {
    save_store_to_path(store, &cred_file_path());
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
    if entry.source == "antigravity" {
        crate::bridge::clear_antigravity_project_id_cache();
    }
    with_store(|store| {
        store.logged_out.remove(&entry.source);
        store.entries.insert(entry.source.clone(), entry);
        save_store_to_disk(store);
    });
}

pub fn remove_credential(source: &str) -> bool {
    if source == "antigravity" {
        crate::bridge::clear_antigravity_project_id_cache();
    }
    with_store(|store| {
        let had_entry = store.entries.remove(source).is_some();
        let marked = store.logged_out.insert(source.to_string());
        if had_entry || marked {
            save_store_to_disk(store);
        }
        had_entry
    })
}

pub fn clear_logged_out(source: &str) {
    with_store(|store| {
        if store.logged_out.remove(source) {
            save_store_to_disk(store);
        }
    });
}

pub fn get_all_credentials() -> HashMap<String, CredentialEntry> {
    with_store(|store| store.entries.clone())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn store_persists_manual_oauth_fields_and_logged_out_flags() {
        let tmp_path = std::env::temp_dir().join(format!(
            "aetheria-cred-store-test-{}.json",
            crate::paths::gen_id("t")
        ));

        let mut store = CredentialStore::default();
        store.entries.insert(
            "antigravity".to_string(),
            CredentialEntry {
                source: "antigravity".to_string(),
                access_token: "tok-1".to_string(),
                refresh_token: Some("rt-1".to_string()),
                expires_at: Some(123456),
                client_id: Some("cid-1".to_string()),
                client_secret: Some("csec-1".to_string()),
                account_id: Some("proj-1".to_string()),
                account_email: Some("oauth@example.com".to_string()),
                account_info: Some("oauth@example.com".to_string()),
                updated_at: "2026-01-01T00:00:00Z".to_string(),
                auto_harvested: false,
                ..Default::default()
            },
        );
        save_store_to_path(&store, &tmp_path);

        let loaded = load_store_from_path(&tmp_path);
        let entry = loaded.entries.get("antigravity").expect("saved entry");
        assert!(!entry.auto_harvested);
        assert_eq!(entry.client_id.as_deref(), Some("cid-1"));
        assert_eq!(entry.client_secret.as_deref(), Some("csec-1"));
        assert_eq!(entry.account_id.as_deref(), Some("proj-1"));
        assert_eq!(entry.account_email.as_deref(), Some("oauth@example.com"));
        assert!(!loaded.logged_out.contains("antigravity"));

        store.entries.remove("antigravity");
        store.logged_out.insert("antigravity".to_string());
        save_store_to_path(&store, &tmp_path);

        let loaded_after_logout = load_store_from_path(&tmp_path);
        assert!(!loaded_after_logout.entries.contains_key("antigravity"));
        assert!(loaded_after_logout.logged_out.contains("antigravity"));

        let _ = std::fs::remove_file(&tmp_path);
    }
}

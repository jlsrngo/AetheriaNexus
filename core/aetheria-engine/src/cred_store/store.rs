//! Credential store persistence, memory cache, and platform credential APIs.

use super::types::{CredentialEntry, CredentialStore};
use crate::paths::{aetheria_config_dir, aetheria_dot_dir, now_ms};
use base64::Engine as _;
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

pub fn is_expired(entry: &CredentialEntry, buffer_ms: u64) -> bool {
    match entry.expires_at {
        None => false,
        Some(exp) => now_ms() + buffer_ms >= exp,
    }
}

pub fn decode_jwt_payload(jwt: &str) -> Option<Value> {
    let parts: Vec<&str> = jwt.split('.').collect();
    if parts.len() != 3 {
        return None;
    }
    let payload_b64 = parts[1];
    let bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(payload_b64)
        .or_else(|_| base64::engine::general_purpose::URL_SAFE.decode(payload_b64))
        .or_else(|_| base64::engine::general_purpose::STANDARD_NO_PAD.decode(payload_b64))
        .or_else(|_| base64::engine::general_purpose::STANDARD.decode(payload_b64))
        .ok()?;
    serde_json::from_slice(&bytes).ok()
}

pub fn parse_iso_to_ms(iso: &str) -> Option<u64> {
    let s = iso.trim();
    if s.len() < 19 {
        return None;
    }
    let year: i64 = s.get(0..4)?.parse().ok()?;
    let month: u64 = s.get(5..7)?.parse().ok()?;
    let day: u64 = s.get(8..10)?.parse().ok()?;
    let hour: u64 = s.get(11..13)?.parse().ok()?;
    let min: u64 = s.get(14..16)?.parse().ok()?;
    let sec: u64 = s.get(17..19)?.parse().ok()?;

    let mut offset_secs: i64 = 0;
    if let Some(pos) = s[19..].find(|c| c == '+' || c == '-') {
        let tz_str = &s[19 + pos..];
        if tz_str.len() >= 6 {
            let sign = if tz_str.starts_with('+') { 1 } else { -1 };
            if let (Ok(tz_h), Ok(tz_m)) = (tz_str[1..3].parse::<i64>(), tz_str[4..6].parse::<i64>()) {
                offset_secs = sign * (tz_h * 3600 + tz_m * 60);
            }
        }
    }

    let y = if month <= 2 { year - 1 } else { year };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = (y - era * 400) as u64;
    let m_adj = if month > 2 { month - 3 } else { month + 9 };
    let doy = (153 * m_adj + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    let days = era * 146097 + (doe as i64) - 719468;
    if days < 0 {
        return None;
    }
    let local_secs = (days as i64) * 86400 + (hour * 3600 + min * 60 + sec) as i64;
    let utc_secs = local_secs - offset_secs;
    if utc_secs < 0 {
        return None;
    }
    Some((utc_secs as u64) * 1000)
}

#[cfg(windows)]
pub fn read_windows_generic_credential(target: &str) -> Option<String> {
    #[repr(C)]
    struct CREDENTIALW {
        flags: u32,
        cred_type: u32,
        target_name: *mut u16,
        comment: *mut u16,
        last_written: u64,
        credential_blob_size: u32,
        credential_blob: *const u8,
        persist: u32,
        attribute_count: u32,
        attributes: *mut std::ffi::c_void,
        target_alias: *mut u16,
        user_name: *mut u16,
    }

    #[link(name = "advapi32")]
    extern "system" {
        fn CredReadW(
            target_name: *const u16,
            cred_type: u32,
            flags: u32,
            credential: *mut *mut CREDENTIALW,
        ) -> i32;
        fn CredFree(buffer: *mut std::ffi::c_void);
    }

    let mut wide: Vec<u16> = target.encode_utf16().collect();
    wide.push(0);
    let mut pcred: *mut CREDENTIALW = std::ptr::null_mut();
    unsafe {
        let ok = CredReadW(wide.as_ptr(), 1, 0, &mut pcred);
        if ok == 0 || pcred.is_null() {
            return None;
        }
        let cred = &*pcred;
        let result = if !cred.credential_blob.is_null() && cred.credential_blob_size > 0 {
            let slice =
                std::slice::from_raw_parts(cred.credential_blob, cred.credential_blob_size as usize);
            Some(String::from_utf8_lossy(slice).to_string())
        } else {
            None
        };
        CredFree(pcred as *mut std::ffi::c_void);
        result
    }
}

#[cfg(not(windows))]
pub fn read_windows_generic_credential(_target: &str) -> Option<String> {
    None
}

pub fn register_local_cli_to_config(bridge_port: u16) {
    let config_path = aetheria_config_dir().join("aetheria.json");
    let mut cfg: Value = if let Ok(raw) = std::fs::read_to_string(&config_path) {
        serde_json::from_str(&raw).unwrap_or_else(|_| json!({}))
    } else {
        json!({})
    };

    if !cfg.is_object() {
        cfg = json!({});
    }
    if cfg.get("provider").and_then(|v| v.as_object()).is_none() {
        cfg["provider"] = json!({});
    }

    let creds = get_all_credentials();
    let mut models = serde_json::Map::new();

    if creds.contains_key("codex") {
        for (id, name, reasoning) in [
            ("gpt-5.6-terra", "GPT-5.6 Terra (Codex CLI)", true),
            ("gpt-5.4", "GPT-5.4 (Codex CLI)", true),
            ("gpt-5.4-mini", "GPT-5.4 Mini (Codex CLI)", true),
            ("gpt-5.3-codex", "GPT-5.3 Codex (Codex CLI)", true),
            ("gpt-5.2-codex", "GPT-5.2 Codex (Codex CLI)", true),
            ("gpt-5.2", "GPT-5.2 (Codex CLI)", false),
            ("gpt-5.1-codex-max", "GPT-5.1 Codex Max (Codex CLI)", true),
            ("gpt-5.1-codex-mini", "GPT-5.1 Codex Mini (Codex CLI)", false),
        ] {
            models.insert(
                id.to_string(),
                json!({
                    "name": name,
                    "attachment": true,
                    "reasoning": reasoning,
                    "tool_call": true,
                    "limit": { "context": 200000, "output": 32768 }
                }),
            );
        }
    }

    if creds.contains_key("claude") {
        for (id, name, reasoning) in [
            ("claude-3-7-sonnet-20250219", "Claude 3.7 Sonnet (Claude Code CLI)", true),
            ("claude-3-5-sonnet-20241022", "Claude 3.5 Sonnet (Claude Code CLI)", false),
            ("claude-3-5-haiku-20241022", "Claude 3.5 Haiku (Claude Code CLI)", false),
        ] {
            models.insert(
                id.to_string(),
                json!({
                    "name": name,
                    "attachment": true,
                    "reasoning": reasoning,
                    "tool_call": true,
                    "limit": { "context": 200000, "output": 8192 }
                }),
            );
        }
    }

    if creds.contains_key("kiro") {
        for (id, name) in [
            ("claude-3-7-sonnet", "Claude 3.7 Sonnet (Kiro AWS)"),
            ("claude-3-5-sonnet", "Claude 3.5 Sonnet (Kiro AWS)"),
            ("claude-3-5-haiku", "Claude 3.5 Haiku (Kiro AWS)"),
        ] {
            models.insert(
                id.to_string(),
                json!({
                    "name": name,
                    "attachment": true,
                    "reasoning": true,
                    "tool_call": true,
                    "limit": { "context": 200000, "output": 8192 }
                }),
            );
        }
    }

    if creds.contains_key("antigravity") {
        for (id, name) in [
            ("gemini-2.5-pro", "Gemini 2.5 Pro (Antigravity CLI)"),
            ("gemini-2.5-flash", "Gemini 2.5 Flash (Antigravity CLI)"),
            ("gemini-2.0-flash", "Gemini 2.0 Flash (Antigravity CLI)"),
        ] {
            models.insert(
                id.to_string(),
                json!({
                    "name": name,
                    "attachment": true,
                    "reasoning": true,
                    "tool_call": true,
                    "limit": { "context": 1000000, "output": 65536 }
                }),
            );
        }
    }

    if creds.contains_key("opencode") {
        for (id, name) in [
            ("big-pickle", "Big Pickle (OpenCode Zen)"),
            ("minimax-m2.5", "MiniMax M2.5 (OpenCode Zen)"),
            ("deepseek-v3", "DeepSeek V3 (OpenCode Zen)"),
            ("deepseek-r1", "DeepSeek R1 (OpenCode Zen)"),
            ("glm-4", "GLM-4 (OpenCode Zen)"),
            ("qwen-2.5-coder-32b", "Qwen 2.5 Coder 32B (OpenCode Zen)"),
        ] {
            models.insert(
                id.to_string(),
                json!({
                    "name": name,
                    "attachment": true,
                    "reasoning": id.contains("r1"),
                    "tool_call": true,
                    "limit": { "context": 128000, "output": 8192 }
                }),
            );
        }
    }

    if !models.is_empty() {
        if let Some(prov_obj) = cfg.get_mut("provider").and_then(|v| v.as_object_mut()) {
            prov_obj.insert(
                "local-cli".to_string(),
                json!({
                    "name": "Local CLI Auto-Bridge",
                    "api": format!("http://127.0.0.1:{}/v1", bridge_port),
                    "options": {
                        "baseURL": format!("http://127.0.0.1:{}/v1", bridge_port),
                        "apiKey": "local-cli-bridge"
                    },
                    "models": models
                }),
            );
        }

        if let Ok(serialized) = serde_json::to_string_pretty(&cfg) {
            let _ = std::fs::write(&config_path, serialized);
        }
    }
}


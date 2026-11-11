//! Messaging configuration persistence, token masking, and active session resolution.

use crate::paths::aetheria_data_dir;
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

static ACTIVE_SESSION: OnceLock<Mutex<Option<Value>>> = OnceLock::new();

pub fn config_file() -> PathBuf {
    aetheria_data_dir().join("messaging.json")
}

pub fn read_config() -> Value {
    let p = config_file();
    if let Ok(raw) = std::fs::read_to_string(&p) {
        if let Ok(val) = serde_json::from_str::<Value>(&raw) {
            return val;
        }
    }
    json!({
        "telegram": {
            "enabled": false,
            "botToken": "",
            "allowedUserId": "",
            "targetFolder": "",
            "allowedChatIds": []
        },
        "whatsapp": {
            "enabled": false,
            "phoneNumber": "",
            "allowedSenders": []
        }
    })
}

pub fn write_config(cfg: &Value) {
    let p = config_file();
    if let Ok(raw) = serde_json::to_string_pretty(cfg) {
        let _ = std::fs::write(p, raw);
    }
}

pub fn mask_token(tok: &str) -> String {
    if tok.len() <= 8 {
        if tok.is_empty() {
            String::new()
        } else {
            "••••••••".to_string()
        }
    } else {
        format!("{}••••{}", &tok[..4], &tok[tok.len() - 4..])
    }
}

pub(crate) fn set_active_session_state(val: Value) {
    let m = ACTIVE_SESSION.get_or_init(|| Mutex::new(None));
    if let Ok(mut guard) = m.lock() {
        *guard = Some(val);
    }
}

pub(crate) fn get_active_session_state() -> Option<Value> {
    let m = ACTIVE_SESSION.get_or_init(|| Mutex::new(None));
    m.lock().ok().and_then(|g| g.clone())
}

pub fn get_active_session_folder() -> Option<String> {
    get_active_session_state().and_then(|v| {
        v.get("directory")
            .or_else(|| v.get("workspacePath"))
            .and_then(|w| w.as_str())
            .map(|s| s.to_string())
    })
}

pub fn get_active_session_info(target_dir: Option<&str>) -> Option<(String, String)> {
    let norm_target = target_dir.map(|f| f.trim().replace('/', "\\").to_lowercase());

    // 1. Check in-memory active session reported by UI
    let in_mem = get_active_session_state().and_then(|v| {
        let sid = v
            .get("sessionID")
            .or_else(|| v.get("sessionId"))
            .and_then(|s| s.as_str())?;
        let dir = v
            .get("directory")
            .or_else(|| v.get("workspacePath"))
            .and_then(|d| d.as_str())?;
        Some((sid.to_string(), dir.to_string()))
    });

    if let Some((sid, dir)) = in_mem {
        let norm_dir = dir.trim().replace('/', "\\").to_lowercase();
        if let Some(ref target) = norm_target {
            if target.is_empty() || &norm_dir == target {
                return Some((sid, dir));
            }
        } else {
            return Some((sid, dir));
        }
    }

    // 2. Fallback: Lookup the most recently active session for target_dir in sessions-store.json!
    let store = crate::session::session::load_store();
    let mut candidate: Option<(String, String, u64)> = None;

    for (sid, sval) in store.sessions {
        if sid.starts_with("ses_tg_") {
            continue;
        }

        let dir = sval
            .get("directory")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let norm_dir = dir.trim().replace('/', "\\").to_lowercase();

        if let Some(ref target) = norm_target {
            if !target.is_empty() && &norm_dir != target {
                continue;
            }
        }

        let updated = sval
            .pointer("/time/updated")
            .and_then(|v| v.as_u64())
            .or_else(|| sval.pointer("/time/created").and_then(|v| v.as_u64()))
            .unwrap_or(0);

        if candidate.as_ref().map(|c| updated > c.2).unwrap_or(true) {
            candidate = Some((sid, dir, updated));
        }
    }

    candidate.map(|(sid, dir, _)| (sid, dir))
}


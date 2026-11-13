//! Session data model, persistent store & run lifecycle.
use crate::paths::aetheria_data_dir;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SessionStoreData {
    #[serde(default)]
    pub sessions: HashMap<String, Value>,
    #[serde(default)]
    pub messages: HashMap<String, Vec<Value>>,
}

static SESSION_STORE: OnceLock<Mutex<SessionStoreData>> = OnceLock::new();
pub static ACTIVE_RUNS: OnceLock<Mutex<HashMap<String, bool>>> = OnceLock::new();

pub fn store_file_path() -> PathBuf {
    #[cfg(test)]
    {
        static TEST_STORE_DIR: OnceLock<PathBuf> = OnceLock::new();
        let dir = TEST_STORE_DIR.get_or_init(|| {
            let p = std::env::temp_dir()
                .join(format!("aetheria-test-store-{}", std::process::id()));
            let _ = std::fs::create_dir_all(&p);
            p
        });
        return dir.join("sessions-store.json");
    }
    #[cfg(not(test))]
    {
        aetheria_data_dir().join("sessions-store.json")
    }
}

pub fn load_store() -> SessionStoreData {
    let p = store_file_path();
    if let Ok(raw) = std::fs::read_to_string(&p) {
        if let Ok(parsed) = serde_json::from_str::<SessionStoreData>(&raw) {
            if !parsed.sessions.is_empty() || !parsed.messages.is_empty() {
                return parsed;
            }
        }
    }
    #[cfg(test)]
    return SessionStoreData::default();

    #[cfg(not(test))]
    {
        // Auto-migrate from SQLite Aetheria-local.db if available
        let db_path = aetheria_data_dir().join("Aetheria-local.db");
        if db_path.exists() {
            let mut migrate_cmd = std::process::Command::new("bun");
            crate::paths::configure_hidden_std_command(&mut migrate_cmd);
            let _ = migrate_cmd
                .arg("scripts/migrate-sqlite-to-json.cjs")
                .output();
            if let Ok(raw) = std::fs::read_to_string(&p) {
                if let Ok(parsed) = serde_json::from_str::<SessionStoreData>(&raw) {
                    if !parsed.sessions.is_empty() || !parsed.messages.is_empty() {
                        return parsed;
                    }
                }
            }
        }
        SessionStoreData::default()
    }
}

pub fn save_store(store: &SessionStoreData) {
    let p = store_file_path();
    if let Ok(raw) = serde_json::to_string(store) {
        let _ = std::fs::write(p, raw);
    }
}

pub fn with_store<F, R>(f: F) -> R
where
    F: FnOnce(&mut SessionStoreData) -> R,
{
    let m = SESSION_STORE.get_or_init(|| Mutex::new(load_store()));
    let mut guard = m.lock().unwrap_or_else(|e| e.into_inner());
    f(&mut guard)
}

pub fn set_active_run(session_id: &str, running: bool) {
    let m = ACTIVE_RUNS.get_or_init(|| Mutex::new(HashMap::new()));
    let mut guard = m.lock().unwrap_or_else(|e| e.into_inner());
    if running {
        guard.insert(session_id.to_string(), true);
    } else {
        guard.remove(session_id);
    }
}

pub fn is_active_run(session_id: &str) -> bool {
    let m = ACTIVE_RUNS.get_or_init(|| Mutex::new(HashMap::new()));
    let guard = m.lock().unwrap_or_else(|e| e.into_inner());
    guard.get(session_id).copied().unwrap_or(false)
}


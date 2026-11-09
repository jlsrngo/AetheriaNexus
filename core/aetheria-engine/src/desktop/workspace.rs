//! Desktop active workspace tracking and security path checking.

use crate::paths::{contains_path, normalize_workspace_path};
use axum::{response::IntoResponse, Json};
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

static ACTIVE_WORKSPACE_ROOT: OnceLock<Mutex<Option<String>>> = OnceLock::new();

pub fn get_active_workspace_root() -> Option<String> {
    ACTIVE_WORKSPACE_ROOT
        .get_or_init(|| Mutex::new(None))
        .lock()
        .ok()
        .and_then(|g| g.clone())
}

pub fn set_active_workspace_root(dir: &str) {
    let norm = normalize_workspace_path(dir);
    if let Ok(mut guard) = ACTIVE_WORKSPACE_ROOT
        .get_or_init(|| Mutex::new(None))
        .lock()
    {
        crate::session::watcher::seed_baseline_snapshot(&norm);
        *guard = Some(norm);
    }
}

pub fn check_allowed_path(target: &Path) -> Result<PathBuf, String> {
    if let Some(root) = get_active_workspace_root() {
        let root_path = Path::new(&root);
        let resolved = if target.is_relative() {
            root_path.join(target)
        } else {
            target.to_path_buf()
        };
        if !contains_path(root_path, &resolved) {
            return Err(format!(
                "Security: Access denied for path outside active workspace: {}",
                target.display()
            ));
        }
        Ok(resolved)
    } else {
        Ok(target.to_path_buf())
    }
}

pub async fn handle_folder_watch(Json(payload): Json<Value>) -> impl IntoResponse {
    let workspace = payload.get("workspace_dir")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .or_else(|| get_active_workspace_root())
        .unwrap_or_else(|| ".".to_string());
    let detect_all = payload.get("detect_all").and_then(|v| v.as_bool()).unwrap_or(false);
    let res = crate::session::watcher::scan_workspace_directory(&workspace, detect_all);
    Json(res)
}

pub async fn handle_folder_watch_ack(Json(payload): Json<Value>) -> impl IntoResponse {
    let workspace = payload.get("workspace_dir")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .or_else(|| get_active_workspace_root())
        .unwrap_or_else(|| ".".to_string());
    let filenames = payload.get("filenames")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect::<Vec<String>>());
    let res = crate::session::watcher::acknowledge_detected_documents(&workspace, filenames);
    Json(res)
}

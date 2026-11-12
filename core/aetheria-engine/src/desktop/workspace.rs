//! Desktop active workspace tracking and security path checking.

use crate::paths::{contains_path, normalize_workspace_path};
use axum::{response::IntoResponse, Json};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

pub const WORKSPACE_SUBDIRS: &[&str] = &["script", "img", "audio", "ref", "output"];

static ACTIVE_WORKSPACE_ROOT: OnceLock<Mutex<Option<String>>> = OnceLock::new();

/// Ensures standard HTML5/JS motion project subfolders (`script`, `img`, `audio`, `ref`, `output`)
/// exist inside an opened user project folder while never modifying root drives or the IDE source repo.
pub fn ensure_workspace_scaffold(dir: &Path) -> Vec<String> {
    if !dir.is_dir() || dir.parent().is_none() {
        return Vec::new();
    }
    if dir.join("Cargo.toml").exists() && dir.join("src-tauri").exists() {
        return Vec::new();
    }

    let mut created = Vec::new();
    for sub in WORKSPACE_SUBDIRS {
        let target = dir.join(sub);
        if !target.exists() && std::fs::create_dir_all(&target).is_ok() {
            created.push((*sub).to_string());
        }
    }
    created
}

pub fn get_active_workspace_root() -> Option<String> {
    ACTIVE_WORKSPACE_ROOT
        .get_or_init(|| Mutex::new(None))
        .lock()
        .ok()
        .and_then(|g| g.clone())
}

pub fn set_active_workspace_root(dir: &str) {
    let norm = normalize_workspace_path(dir);
    ensure_workspace_scaffold(Path::new(&norm));
    if let Ok(mut guard) = ACTIVE_WORKSPACE_ROOT
        .get_or_init(|| Mutex::new(None))
        .lock()
    {
        crate::session::watcher::seed_baseline_snapshot(&norm);
        *guard = Some(norm);
    }
}

pub async fn handle_init_workspace(Json(payload): Json<Value>) -> impl IntoResponse {
    let raw = payload
        .get("folderPath")
        .or_else(|| payload.get("directory"))
        .or_else(|| payload.get("path"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim();

    if raw.is_empty() {
        return Json(json!({ "ok": false, "error": "folderPath is required" }));
    }

    let norm = normalize_workspace_path(raw);
    let path = Path::new(&norm);
    if !path.is_dir() {
        return Json(json!({ "ok": false, "error": "Workspace folder does not exist" }));
    }

    let created = ensure_workspace_scaffold(path);
    set_active_workspace_root(&norm);
    Json(json!({
        "ok": true,
        "workspace": norm,
        "subdirs": WORKSPACE_SUBDIRS,
        "created": created
    }))
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
        Err("Access Denied: No active project workspace is open".to_string())
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ensure_workspace_scaffold_creates_standard_subdirs_and_skips_engine_root() {
        let tmp = std::env::temp_dir().join(format!(
            "aetheria_ws_scaffold_{}",
            crate::paths::now_ms()
        ));
        let _ = std::fs::create_dir_all(&tmp);

        let created = ensure_workspace_scaffold(&tmp);
        assert_eq!(created.len(), WORKSPACE_SUBDIRS.len());
        for sub in WORKSPACE_SUBDIRS {
            assert!(tmp.join(sub).is_dir(), "Missing scaffold subdir {}", sub);
        }

        // Calling a second time is idempotent
        assert!(ensure_workspace_scaffold(&tmp).is_empty());

        // Engine root guard skips creation
        assert!(ensure_workspace_scaffold(&crate::paths::project_root()).is_empty());

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_check_allowed_path_fails_closed_without_workspace_and_isolates_roots() {
        let lock = ACTIVE_WORKSPACE_ROOT.get_or_init(|| Mutex::new(None));
        let prev = lock.lock().ok().and_then(|g| g.clone());

        if let Ok(mut g) = lock.lock() {
            *g = None;
        }
        assert!(check_allowed_path(Path::new("C:\\Windows\\win.ini")).is_err());

        let tmp = std::env::temp_dir().join(format!(
            "aetheria_check_path_ws_{}",
            crate::paths::now_ms()
        ));
        let _ = std::fs::create_dir_all(&tmp);
        set_active_workspace_root(&tmp.to_string_lossy());

        assert!(check_allowed_path(&tmp.join("inside.txt")).is_ok());
        assert!(check_allowed_path(&tmp.join("..").join("outside.txt")).is_err());

        if let Ok(mut g) = lock.lock() {
            *g = prev;
        }
        let _ = std::fs::remove_dir_all(&tmp);
    }
}

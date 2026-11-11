//! Axum HTTP Route Handlers for Engine Configuration, Workspace Project, Paths & VCS Metadata.

use super::config::read_aetheria_config;
use crate::paths::{aetheria_config_dir, aetheria_data_dir, home_dir, now_ms};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;

pub async fn handle_config_get() -> Response {
    Json(read_aetheria_config()).into_response()
}

pub async fn handle_project_list() -> Response {
    let cwd = std::env::current_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."))
        .to_string_lossy()
        .replace('\\', "/");
    Json(json!([{
        "id": "proj_default",
        "worktree": cwd,
        "time": { "created": now_ms(), "updated": now_ms() }
    }]))
    .into_response()
}

pub async fn handle_project_current() -> Response {
    let cwd = std::env::current_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."))
        .to_string_lossy()
        .replace('\\', "/");
    Json(json!({
        "id": "proj_default",
        "worktree": cwd,
        "time": { "created": now_ms(), "updated": now_ms() }
    }))
    .into_response()
}

pub async fn handle_path_get() -> Response {
    let cwd = std::env::current_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."))
        .to_string_lossy()
        .replace('\\', "/");
    Json(json!({
        "home": home_dir().to_string_lossy().replace('\\', "/"),
        "state": aetheria_data_dir().to_string_lossy().replace('\\', "/"),
        "config": aetheria_config_dir().to_string_lossy().replace('\\', "/"),
        "worktree": cwd,
        "directory": cwd
    }))
    .into_response()
}

pub async fn handle_vcs_get() -> Response {
    Json(json!({ "branch": "main" })).into_response()
}


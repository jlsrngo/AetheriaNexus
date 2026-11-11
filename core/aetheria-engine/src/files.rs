//! Workspace file HTTP API (listing, text/binary reads, writes) and re-exports.

pub use crate::file_changes::{
    capture_baseline_before_write, ensure_workspace_baseline, record_document_change,
    remove_baseline_for_path, remove_document_change, DOCUMENT_CHANGES,
};
pub use crate::file_search::collect_files_recursive;
pub use crate::file_text_extract::{
    extract_diffable_text, extract_diffable_text_from_bytes, is_binary_doc_ext,
};

use crate::file_changes::{
    capture_baseline_before_write as capture_baseline, handle_accept, handle_revert, handle_status,
    normalize_rel_file,
};
use crate::file_search::{handle_find_file, handle_find_text};
use crate::paths::{contains_path, normalize_workspace_path};
use axum::{
    extract::Query,
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use base64::Engine as _;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

pub fn router() -> Router {
    Router::new()
        .route("/file", get(handle_list))
        .route("/api/file", get(handle_list))
        .route(
            "/file/content",
            get(handle_content).post(handle_write_content),
        )
        .route(
            "/api/file/content",
            get(handle_content).post(handle_write_content),
        )
        .route("/file/status", get(handle_status))
        .route("/api/file/status", get(handle_status))
        .route("/file/revert", post(handle_revert))
        .route("/api/file/revert", post(handle_revert))
        .route("/file/accept", post(handle_accept))
        .route("/api/file/accept", post(handle_accept))
        .route("/find", get(handle_find_text))
        .route("/api/find", get(handle_find_text))
        .route("/find/file", get(handle_find_file))
        .route("/api/find/file", get(handle_find_file))
        .route("/find/symbol", get(handle_status))
        .route("/api/find/symbol", get(handle_status))
}

pub(crate) fn resolve_base_dir(q: &HashMap<String, String>, headers: &HeaderMap) -> PathBuf {
    if let Some(dir) = q.get("directory").or_else(|| q.get("workspacePath")) {
        if !dir.trim().is_empty() {
            let norm = normalize_workspace_path(dir);
            crate::desktop::set_active_workspace_root(&norm);
            return PathBuf::from(norm);
        }
    }
    if let Some(hdr) = headers
        .get("x-aetheria-directory")
        .or_else(|| headers.get("x-opencode-directory"))
        .and_then(|v| v.to_str().ok())
    {
        if !hdr.trim().is_empty() {
            let decoded = urlencoding_decode(hdr);
            let norm = normalize_workspace_path(&decoded);
            crate::desktop::set_active_workspace_root(&norm);
            return PathBuf::from(norm);
        }
    }
    if let Some(root) = crate::desktop::get_active_workspace_root() {
        if !root.trim().is_empty() {
            return PathBuf::from(root);
        }
    }
    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

pub fn urlencoding_decode(s: &str) -> String {
    let mut out = Vec::new();
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(hex_str) = std::str::from_utf8(&bytes[i + 1..i + 3]) {
                if let Ok(b) = u8::from_str_radix(hex_str, 16) {
                    out.push(b);
                    i += 3;
                    continue;
                }
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).to_string()
}

fn resolve_target(base_dir: &Path, req_path: &str) -> PathBuf {
    let p = Path::new(req_path);
    if p.is_absolute() {
        p.to_path_buf()
    } else {
        base_dir.join(req_path)
    }
}

fn forbidden_path_resp() -> Response {
    (
        StatusCode::FORBIDDEN,
        Json(json!({ "error": "Access denied: path outside project folder" })),
    )
        .into_response()
}

async fn handle_list(
    Query(q): Query<HashMap<String, String>>,
    headers: HeaderMap,
) -> Response {
    let base_dir = resolve_base_dir(&q, &headers);
    let req_path = q.get("path").map(|s| s.as_str()).unwrap_or("");
    let target = if req_path.is_empty() || req_path == "." || req_path == "/" {
        base_dir.clone()
    } else {
        resolve_target(&base_dir, req_path)
    };

    if !contains_path(&base_dir, &target) {
        return forbidden_path_resp();
    }

    let mut nodes = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&target) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') || name.starts_with("~$") || name == "node_modules" {
                continue;
            }
            let full = entry.path();
            let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
            let rel = full
                .strip_prefix(&base_dir)
                .unwrap_or(&full)
                .to_string_lossy()
                .replace('\\', "/");
            nodes.push(json!({
                "name": name,
                "path": rel,
                "absolute": full.to_string_lossy().replace('\\', "/"),
                "type": if is_dir { "directory" } else { "file" },
                "ignored": name.starts_with('.')
            }));
        }
    }

    nodes.sort_by(|a, b| {
        let ta = a.get("type").and_then(|v| v.as_str()).unwrap_or("file");
        let tb = b.get("type").and_then(|v| v.as_str()).unwrap_or("file");
        if ta != tb {
            if ta == "directory" {
                std::cmp::Ordering::Less
            } else {
                std::cmp::Ordering::Greater
            }
        } else {
            let na = a
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_lowercase();
            let nb = b
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_lowercase();
            na.cmp(&nb)
        }
    });

    Json(Value::Array(nodes)).into_response()
}

async fn handle_content(
    Query(q): Query<HashMap<String, String>>,
    headers: HeaderMap,
) -> Response {
    let base_dir = resolve_base_dir(&q, &headers);
    let Some(req_path) = q.get("path") else {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "path is required" })),
        )
            .into_response();
    };
    let target = resolve_target(&base_dir, req_path);

    if !contains_path(&base_dir, &target) {
        return forbidden_path_resp();
    }

    let Ok(bytes) = std::fs::read(&target) else {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "File not found" })),
        )
            .into_response();
    };

    let ext = target
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let is_binary = matches!(
        ext.as_str(),
        "xlsx"
            | "xls"
            | "docx"
            | "pptx"
            | "pdf"
            | "png"
            | "jpg"
            | "jpeg"
            | "gif"
            | "webp"
            | "bmp"
            | "ico"
            | "wav"
            | "mp3"
            | "ogg"
            | "m4a"
            | "aac"
            | "flac"
            | "mp4"
            | "mov"
            | "webm"
            | "avi"
            | "mkv"
            | "zip"
    ) || bytes.iter().take(512).any(|&b| b == 0);

    if is_binary {
        let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
        let mime = match ext.as_str() {
            "pdf" => "application/pdf",
            "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "png" => "image/png",
            "jpg" | "jpeg" => "image/jpeg",
            "gif" => "image/gif",
            "webp" => "image/webp",
            "bmp" => "image/bmp",
            "ico" => "image/x-icon",
            "wav" => "audio/wav",
            "mp3" => "audio/mpeg",
            "ogg" => "audio/ogg",
            "m4a" => "audio/mp4",
            "aac" => "audio/aac",
            "flac" => "audio/flac",
            "mp4" => "video/mp4",
            "mov" => "video/quicktime",
            "webm" => "video/webm",
            _ => "application/octet-stream",
        };
        let payload = json!({
            "type": "binary",
            "content": b64,
            "encoding": "base64",
            "mimeType": mime
        });
        return Json(json!({
            "data": payload,
            "type": "binary",
            "content": payload["content"],
            "encoding": "base64",
            "mimeType": mime
        }))
        .into_response();
    }

    let text = String::from_utf8_lossy(&bytes).to_string();
    let payload = json!({
        "type": "text",
        "content": text
    });
    Json(json!({
        "data": payload,
        "type": "text",
        "content": text
    }))
    .into_response()
}

async fn handle_write_content(
    Query(q): Query<HashMap<String, String>>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    let base_dir = resolve_base_dir(&q, &headers);
    let req_path = q
        .get("path")
        .map(|s| s.as_str())
        .or_else(|| body.get("path").and_then(|v| v.as_str()));
    let Some(req_path) = req_path else {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "path is required" })),
        )
            .into_response();
    };

    let target = resolve_target(&base_dir, req_path);
    if !contains_path(&base_dir, &target) {
        return forbidden_path_resp();
    }

    let content = body
        .get("content")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    if let Some(parent) = target.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    capture_baseline(&base_dir.to_string_lossy(), req_path);

    if let Err(e) = std::fs::write(&target, content) {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response();
    }

    let rel_file = normalize_rel_file(&base_dir, req_path);
    crate::session::message::emit_event(
        &base_dir.to_string_lossy(),
        "file.edited",
        json!({ "file": rel_file }),
    );

    Json(json!({
        "success": true,
        "data": { "success": true }
    }))
    .into_response()
}

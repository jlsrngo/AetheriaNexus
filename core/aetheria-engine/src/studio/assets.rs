//! Studio asset scanner, media vault indexing, static file CRUD, and isolated asset serving.

pub use super::media_stream::{handle_stream_video, StreamVideoQuery};

use super::media_stream::serve_ranged_file;
use super::motion::{resolve_active_dir_from_request, resolve_film_html_in_dir};
use super::types::{
    format_file_size, DeleteFilePayload, NexusStaticFile, ScanMediaPayload, WriteFilePayload,
};
use crate::files::resolve_base_dir;
use crate::paths::{contains_path, gen_id, project_root};
use axum::{
    extract::{Path as AxumPath, Query},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

fn build_asset_entry(root: &Path, path: &Path, bytes: u64) -> Option<NexusStaticFile> {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();

    let file_type = match ext.as_str() {
        "mp4" | "mov" | "webm" | "mkv" => "video",
        "mp3" | "wav" | "m4a" | "aac" | "ogg" | "flac" => "audio",
        "png" | "jpg" | "jpeg" | "svg" | "webp" | "gif" => "image",
        "json" | "csv" | "tsv" => "data",
        _ => return None,
    };

    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unnamed")
        .to_string();

    let rel_path = path
        .strip_prefix(root)
        .map(|p| p.to_string_lossy().replace('\\', "/"))
        .unwrap_or_else(|_| file_name.clone());

    Some(NexusStaticFile {
        id: gen_id("file"),
        name: file_name,
        file_type: file_type.to_string(),
        size: format_file_size(bytes),
        bytes,
        path: path.to_string_lossy().to_string(),
        relative_path: rel_path,
    })
}

/// GET /api/studio/ws-asset/*relpath — serves assets strictly from active project folder (plus builtin runtime scripts).
pub async fn handle_ws_asset(
    AxumPath(raw_rel): AxumPath<String>,
    Query(q): Query<HashMap<String, String>>,
    headers: HeaderMap,
) -> Response {
    let clean_rel = raw_rel.trim().trim_start_matches('/').replace('\\', "/");
    if clean_rel.is_empty() || clean_rel.contains("..") || clean_rel.contains('\0') {
        return (StatusCode::BAD_REQUEST, "Invalid asset path").into_response();
    }

    if let Some(active_root) = resolve_active_dir_from_request(&q, &headers) {
        let mut search_roots = vec![active_root.clone()];
        if let Some(film_html) = resolve_film_html_in_dir(&active_root) {
            if let Some(film_dir) = film_html.parent() {
                if film_dir != active_root {
                    search_roots.insert(0, film_dir.to_path_buf());
                }
            }
        }
        let pub_dir = active_root.join("public");
        if pub_dir.is_dir() {
            search_roots.push(pub_dir);
        }

        for root in search_roots {
            let candidate = root.join(&clean_rel);
            if contains_path(&root, &candidate) && candidate.is_file() {
                return serve_ranged_file(&headers, &candidate).await;
            }
        }
    }

    // Engine builtin shared helper fallback (runtime library & bundled SFX only)
    let is_builtin_runtime = clean_rel.eq_ignore_ascii_case("script/aetheria-motion.js")
        || clean_rel.eq_ignore_ascii_case("aetheria-motion.js")
        || clean_rel.starts_with("sfx/");

    if is_builtin_runtime {
        let engine_public = project_root().join("apps").join("public");
        let normalized = if clean_rel.eq_ignore_ascii_case("aetheria-motion.js") {
            "script/aetheria-motion.js"
        } else {
            clean_rel.as_str()
        };
        let fallback = engine_public.join(normalized);
        if contains_path(&engine_public, &fallback) && fallback.is_file() {
            return serve_ranged_file(&headers, &fallback).await;
        }
    }

    (StatusCode::NOT_FOUND, "Asset not found in active workspace").into_response()
}

/// GET / POST /api/get-static-files (Non-blocking background scanner for active folder only)
pub async fn handle_get_static_files(
    Query(q): Query<HashMap<String, String>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let active_dir = resolve_active_dir_from_request(&q, &headers);
    let files = tokio::task::spawn_blocking(move || {
        let mut files = Vec::new();
        let Some(workspace) = active_dir else {
            return files;
        };

        let mut scan_roots = vec![workspace.clone()];
        if let Some(html_path) = resolve_film_html_in_dir(&workspace) {
            if let Some(film_dir) = html_path.parent() {
                if film_dir != workspace {
                    scan_roots.push(film_dir.to_path_buf());
                }
            }
        }

        let mut seen_paths = HashSet::new();
        for base in &scan_roots {
            for sub in ["public", "assets", "media", "audio", "img", "output", "export"] {
                let dir = base.join(sub);
                if !dir.is_dir() {
                    continue;
                }
                let mut found = Vec::new();
                scan_directory_files(base, &dir, &mut found, 0, 3);
                for item in found {
                    if seen_paths.insert(item.path.clone()) {
                        files.push(item);
                    }
                }
            }
        }
        files
    })
    .await
    .unwrap_or_default();

    Json(json!({
        "success": true,
        "data": files
    }))
}

/// POST /api/write-static-file
pub async fn handle_write_static_file(
    Query(q): Query<HashMap<String, String>>,
    headers: HeaderMap,
    Json(payload): Json<WriteFilePayload>,
) -> impl IntoResponse {
    let rel = payload
        .file_path
        .or(payload.path)
        .unwrap_or_else(|| "public/asset.bin".to_string());
    let workspace = resolve_base_dir(&q, &headers);

    let res = tokio::task::spawn_blocking(move || -> Result<String, String> {
        let target = workspace.join(&rel);
        if !contains_path(&workspace, &target) {
            return Err("Path is outside active project folder".to_string());
        }
        if let Some(parent) = target.parent() {
            let _ = std::fs::create_dir_all(parent);
        }

        if let Some(src) = payload.source_path {
            std::fs::copy(&src, &target).map_err(|e| e.to_string())?;
        } else if let Some(b64) = payload.base64_data {
            use base64::Engine;
            let bytes = base64::engine::general_purpose::STANDARD
                .decode(b64.trim())
                .map_err(|e| format!("Invalid base64 payload: {}", e))?;
            std::fs::write(&target, &bytes).map_err(|e| e.to_string())?;
        } else {
            let text = payload.contents.or(payload.data).unwrap_or_default();
            std::fs::write(&target, text.as_bytes()).map_err(|e| e.to_string())?;
        }

        Ok(target.to_string_lossy().to_string())
    })
    .await
    .unwrap_or_else(|e| Err(e.to_string()));

    match res {
        Ok(saved_path) => Json(json!({ "success": true, "path": saved_path })),
        Err(e) => Json(json!({ "success": false, "error": e })),
    }
}

/// POST /api/delete-static-file
pub async fn handle_delete_static_file(
    Query(q): Query<HashMap<String, String>>,
    headers: HeaderMap,
    Json(payload): Json<DeleteFilePayload>,
) -> impl IntoResponse {
    let rel = payload.file_path.or(payload.path).unwrap_or_default();
    let workspace = resolve_base_dir(&q, &headers);
    let target = workspace.join(rel);
    if !contains_path(&workspace, &target) {
        return Json(json!({ "success": false, "error": "Path is outside active project folder" }));
    }
    if target.exists() && target.is_file() {
        match std::fs::remove_file(&target) {
            Ok(_) => Json(json!({ "success": true })),
            Err(e) => Json(json!({ "success": false, "error": e.to_string() })),
        }
    } else {
        Json(json!({ "success": false, "error": "File does not exist" }))
    }
}

pub fn scan_directory_files(
    root: &PathBuf,
    current: &PathBuf,
    acc: &mut Vec<NexusStaticFile>,
    depth: usize,
    max_depth: usize,
) {
    if depth > max_depth {
        return;
    }
    if let Ok(entries) = std::fs::read_dir(current) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                scan_directory_files(root, &path, acc, depth + 1, max_depth);
            } else if path.is_file() {
                let bytes = entry.metadata().map(|m| m.len()).unwrap_or(0);
                if let Some(asset) = build_asset_entry(root, &path, bytes) {
                    acc.push(asset);
                }
            }
        }
    }
}

pub async fn handle_scan_media_vault(
    Query(q): Query<HashMap<String, String>>,
    headers: HeaderMap,
    Json(payload): Json<ScanMediaPayload>,
) -> impl IntoResponse {
    let workspace = resolve_base_dir(&q, &headers);
    let (scanned_path, results) = tokio::task::spawn_blocking(move || {
        let target_dir = if let Some(p) = payload.path {
            let candidate = PathBuf::from(&p);
            if candidate.is_absolute() {
                candidate
            } else {
                workspace.join(candidate)
            }
        } else if workspace.join("public").is_dir() {
            workspace.join("public")
        } else {
            workspace.clone()
        };

        if !contains_path(&workspace, &target_dir) {
            return (workspace.to_string_lossy().to_string(), Vec::new());
        }

        let mut results: Vec<NexusStaticFile> = Vec::new();
        if target_dir.exists() && target_dir.is_dir() {
            scan_directory_files(&workspace, &target_dir, &mut results, 0, 4);
        }

        if let Some(types) = payload.file_types {
            results.retain(|f| types.contains(&f.file_type));
        }

        (target_dir.to_string_lossy().to_string(), results)
    })
    .await
    .unwrap_or_else(|_| (String::new(), Vec::new()));

    Json(json!({
        "success": true,
        "scannedPath": scanned_path,
        "totalFiles": results.len(),
        "assets": results
    }))
}

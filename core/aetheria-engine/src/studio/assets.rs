//! Studio asset scanner, media vault indexing, and file management.

use super::types::{format_file_size, DeleteFilePayload, NexusStaticFile, ScanMediaPayload, WriteFilePayload};
use crate::paths::gen_id;
use axum::{response::IntoResponse, Json};
use serde_json::json;
use std::path::PathBuf;

/// GET / POST /api/get-static-files (Non-blocking background scanner)
pub async fn handle_get_static_files() -> impl IntoResponse {
    let files = tokio::task::spawn_blocking(move || {
        let mut files = Vec::new();
        let workspace = crate::desktop::get_active_workspace_root()
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("."));

        let target_dirs = vec![
            workspace.join("public"),
            workspace.join("assets"),
            workspace.join("media"),
            workspace.join("output"),
            workspace.join("export"),
        ];

        for dir in target_dirs {
            if !dir.exists() || !dir.is_dir() {
                continue;
            }
            if let Ok(entries) = std::fs::read_dir(&dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file() {
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
                            _ => continue,
                        };

                        let file_name = path
                            .file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("unnamed")
                            .to_string();

                        let bytes = entry.metadata().map(|m| m.len()).unwrap_or(0);
                        let size_str = format_file_size(bytes);
                        let rel_path = path
                            .strip_prefix(&workspace)
                            .map(|p| p.to_string_lossy().replace('\\', "/"))
                            .unwrap_or_else(|_| file_name.clone());

                        files.push(NexusStaticFile {
                            id: gen_id("file"),
                            name: file_name,
                            file_type: file_type.to_string(),
                            size: size_str,
                            bytes,
                            path: path.to_string_lossy().to_string(),
                            relative_path: rel_path,
                        });
                    }
                }
            }
        }

        if files.is_empty() {
            files = vec![
                NexusStaticFile {
                    id: "stock-audio-1".to_string(),
                    name: "lofi_focus_beat.mp3".to_string(),
                    file_type: "audio".to_string(),
                    size: "3.4 MB".to_string(),
                    bytes: 3_565_158,
                    path: "public/lofi_focus_beat.mp3".to_string(),
                    relative_path: "public/lofi_focus_beat.mp3".to_string(),
                },
                NexusStaticFile {
                    id: "stock-image-1".to_string(),
                    name: "brand_telemetry_hud.png".to_string(),
                    file_type: "image".to_string(),
                    size: "1.2 MB".to_string(),
                    bytes: 1_258_291,
                    path: "public/brand_telemetry_hud.png".to_string(),
                    relative_path: "public/brand_telemetry_hud.png".to_string(),
                },
                NexusStaticFile {
                    id: "stock-data-1".to_string(),
                    name: "hooks_library_2026.json".to_string(),
                    file_type: "data".to_string(),
                    size: "48 KB".to_string(),
                    bytes: 49_152,
                    path: "public/hooks_library_2026.json".to_string(),
                    relative_path: "public/hooks_library_2026.json".to_string(),
                },
            ];
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
    Json(payload): Json<WriteFilePayload>,
) -> impl IntoResponse {
    let rel = payload
        .file_path
        .or(payload.path)
        .unwrap_or_else(|| "public/asset.bin".to_string());

    let res = tokio::task::spawn_blocking(move || -> Result<String, String> {
        let workspace = crate::desktop::get_active_workspace_root()
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("."));

        let target = workspace.join(&rel);
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
    Json(payload): Json<DeleteFilePayload>,
) -> impl IntoResponse {
    let rel = payload.file_path.or(payload.path).unwrap_or_default();
    let workspace = crate::desktop::get_active_workspace_root()
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."));

    let target = workspace.join(rel);
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
                    _ => continue,
                };

                let file_name = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unnamed")
                    .to_string();

                let bytes = entry.metadata().map(|m| m.len()).unwrap_or(0);
                let size_str = format_file_size(bytes);
                let rel_path = path
                    .strip_prefix(root)
                    .map(|p| p.to_string_lossy().replace('\\', "/"))
                    .unwrap_or_else(|_| file_name.clone());

                acc.push(NexusStaticFile {
                    id: gen_id("file"),
                    name: file_name,
                    file_type: file_type.to_string(),
                    size: size_str,
                    bytes,
                    path: path.to_string_lossy().to_string(),
                    relative_path: rel_path,
                });
            }
        }
    }
}

pub async fn handle_scan_media_vault(
    Json(payload): Json<ScanMediaPayload>,
) -> impl IntoResponse {
    let (scanned_path, results) = tokio::task::spawn_blocking(move || {
        let workspace = crate::desktop::get_active_workspace_root()
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("."));

        let target_dir = if let Some(p) = payload.path {
            PathBuf::from(p)
        } else {
            workspace.join("public")
        };

        let mut results: Vec<NexusStaticFile> = Vec::new();
        if target_dir.exists() && target_dir.is_dir() {
            scan_directory_files(&target_dir, &target_dir, &mut results, 0, 4);
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

#[derive(serde::Deserialize)]
pub struct StreamVideoQuery {
    pub path: Option<String>,
    pub file: Option<String>,
}

/// GET /api/studio/stream-video?file=linus-torvalds-preview.mp4
/// High-performance native Rust video streaming with HTTP 206 Partial Content (Byte Ranges)
/// for zero-CPU GPU hardware acceleration in browser.
pub async fn handle_stream_video(
    headers: axum::http::HeaderMap,
    axum::extract::Query(query): axum::extract::Query<StreamVideoQuery>,
) -> axum::response::Response {
    use axum::http::{header, StatusCode};
    use axum::response::IntoResponse;
    use tokio::io::{AsyncReadExt, AsyncSeekExt};

    let workspace = crate::desktop::get_active_workspace_root()
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."));

    let target_path = if let Some(p) = query.path {
        let pb = PathBuf::from(&p);
        if pb.is_absolute() { pb } else { workspace.join(pb) }
    } else if let Some(f) = query.file {
        workspace.join("output").join(f)
    } else {
        return (StatusCode::BAD_REQUEST, "Missing file or path query parameter").into_response();
    };

    if !target_path.exists() || !target_path.is_file() {
        return (StatusCode::NOT_FOUND, "Video file not found").into_response();
    }

    let mut file = match tokio::fs::File::open(&target_path).await {
        Ok(f) => f,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to open video file").into_response(),
    };

    let metadata = match file.metadata().await {
        Ok(m) => m,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to read file metadata").into_response(),
    };

    let file_size = metadata.len();
    let content_type = mime_guess::from_path(&target_path)
        .first_or_octet_stream()
        .to_string();

    let range_header = headers.get(header::RANGE).and_then(|h| h.to_str().ok());

    if let Some(range) = range_header {
        if let Some(spec) = range.strip_prefix("bytes=") {
            let parts: Vec<&str> = spec.split('-').collect();
            let start: u64 = parts[0].parse().unwrap_or(0);
            let end: u64 = if parts.len() > 1 && !parts[1].is_empty() {
                parts[1].parse().unwrap_or(file_size.saturating_sub(1))
            } else {
                file_size.saturating_sub(1)
            };

            let end = end.min(file_size.saturating_sub(1));
            if start <= end {
                let length = end - start + 1;
                if file.seek(std::io::SeekFrom::Start(start)).await.is_ok() {
                    let mut chunk = vec![0u8; length as usize];
                    if file.read_exact(&mut chunk).await.is_ok() {
                        return axum::response::Response::builder()
                            .status(StatusCode::PARTIAL_CONTENT)
                            .header(header::CONTENT_TYPE, content_type)
                            .header(header::ACCEPT_RANGES, "bytes")
                            .header(
                                header::CONTENT_RANGE,
                                format!("bytes {}-{}/{}", start, end, file_size),
                            )
                            .header(header::CONTENT_LENGTH, length.to_string())
                            .body(axum::body::Body::from(chunk))
                            .unwrap_or_else(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Body error").into_response());
                    }
                }
            }
        }
    }

    let mut all_bytes = Vec::with_capacity(file_size.min(16 * 1024 * 1024) as usize);
    if file.read_to_end(&mut all_bytes).await.is_ok() {
        axum::response::Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, content_type)
            .header(header::ACCEPT_RANGES, "bytes")
            .header(header::CONTENT_LENGTH, file_size.to_string())
            .body(axum::body::Body::from(all_bytes))
            .unwrap_or_else(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Body error").into_response())
    } else {
        (StatusCode::INTERNAL_SERVER_ERROR, "Read error").into_response()
    }
}


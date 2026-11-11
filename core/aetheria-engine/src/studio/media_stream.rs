//! Native Rust GPU video streamer with HTTP 206 Partial Content byte-range support.

use axum::{
    extract::Query,
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
};
use serde::Deserialize;
use std::path::PathBuf;
use tokio::io::{AsyncReadExt, AsyncSeekExt};

#[derive(Deserialize)]
pub struct StreamVideoQuery {
    pub path: Option<String>,
    pub file: Option<String>,
}

/// GET /api/studio/stream-video?file=linus-torvalds-preview.mp4
pub async fn handle_stream_video(
    headers: HeaderMap,
    Query(query): Query<StreamVideoQuery>,
) -> Response {
    let workspace = crate::desktop::get_active_workspace_root()
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."));

    let target_path = if let Some(p) = query.path {
        let pb = PathBuf::from(&p);
        if pb.is_absolute() {
            pb
        } else {
            workspace.join(pb)
        }
    } else if let Some(f) = query.file {
        workspace.join("output").join(f)
    } else {
        return (
            StatusCode::BAD_REQUEST,
            "Missing file or path query parameter",
        )
            .into_response();
    };

    if !target_path.exists() || !target_path.is_file() {
        return (StatusCode::NOT_FOUND, "Video file not found").into_response();
    }

    serve_ranged_file(&headers, &target_path).await
}

/// Streams any static or media file with HTTP 206 Partial Content byte-range support.
pub(crate) async fn serve_ranged_file(
    headers: &HeaderMap,
    target_path: &std::path::Path,
) -> Response {
    let mut file = match tokio::fs::File::open(target_path).await {
        Ok(f) => f,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to open video file",
            )
                .into_response()
        }
    };

    let metadata = match file.metadata().await {
        Ok(m) => m,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to read file metadata",
            )
                .into_response()
        }
    };

    let file_size = metadata.len();
    let content_type = mime_guess::from_path(target_path)
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
                        return Response::builder()
                            .status(StatusCode::PARTIAL_CONTENT)
                            .header(header::CONTENT_TYPE, content_type)
                            .header(header::ACCEPT_RANGES, "bytes")
                            .header(
                                header::CONTENT_RANGE,
                                format!("bytes {}-{}/{}", start, end, file_size),
                            )
                            .header(header::CONTENT_LENGTH, length.to_string())
                            .body(axum::body::Body::from(chunk))
                            .unwrap_or_else(|_| {
                                (StatusCode::INTERNAL_SERVER_ERROR, "Body error").into_response()
                            });
                    }
                }
            }
        }
    }

    let mut all_bytes = Vec::with_capacity(file_size.min(16 * 1024 * 1024) as usize);
    if file.read_to_end(&mut all_bytes).await.is_ok() {
        Response::builder()
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


//! Native Rust GPU video streamer with HTTP 206 Partial Content byte-range support.

use axum::{
    extract::Query,
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
};
use serde::Deserialize;
use std::path::{Path, PathBuf};
use tokio::io::{AsyncReadExt, AsyncSeekExt};

#[derive(Deserialize)]
pub struct StreamVideoQuery {
    pub path: Option<String>,
    pub file: Option<String>,
}

pub fn resolve_stream_video_target(
    workspace: Option<&Path>,
    path: Option<&str>,
    file: Option<&str>,
) -> Result<PathBuf, (StatusCode, &'static str)> {
    let ws = workspace.ok_or((
        StatusCode::FORBIDDEN,
        "No active project workspace is open",
    ))?;

    if let Some(p) = path.map(str::trim).filter(|s| !s.is_empty()) {
        let candidate = Path::new(p);
        let joined = if candidate.is_absolute() {
            candidate.to_path_buf()
        } else {
            ws.join(candidate)
        };
        if !crate::paths::contains_path(ws, &joined) {
            return Err((
                StatusCode::FORBIDDEN,
                "Access denied: path escapes active project workspace",
            ));
        }
        return Ok(joined);
    }

    if let Some(f) = file.map(str::trim).filter(|s| !s.is_empty()) {
        let output_dir = ws.join("output");
        let candidate = Path::new(f);
        if candidate.is_absolute() {
            return Err((
                StatusCode::FORBIDDEN,
                "Access denied: file query cannot be an absolute path",
            ));
        }
        let joined = output_dir.join(candidate);
        if !crate::paths::contains_path(&output_dir, &joined) {
            return Err((
                StatusCode::FORBIDDEN,
                "Access denied: file escapes workspace output folder",
            ));
        }
        return Ok(joined);
    }

    Err((StatusCode::BAD_REQUEST, "Missing file or path query parameter"))
}

/// GET /api/studio/stream-video?file=linus-torvalds-preview.mp4
pub async fn handle_stream_video(
    headers: HeaderMap,
    Query(query): Query<StreamVideoQuery>,
) -> Response {
    let active_ws = crate::desktop::get_active_workspace_root()
        .filter(|s| !s.trim().is_empty())
        .map(PathBuf::from);

    let target_path = match resolve_stream_video_target(
        active_ws.as_deref(),
        query.path.as_deref(),
        query.file.as_deref(),
    ) {
        Ok(p) => p,
        Err((status, msg)) => return (status, msg).into_response(),
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

#[cfg(test)]
mod tests {
    use super::resolve_stream_video_target;
    use axum::http::StatusCode;
    use std::path::Path;

    #[test]
    fn test_stream_video_requires_active_workspace() {
        let err = resolve_stream_video_target(None, None, Some("clip.mp4")).unwrap_err();
        assert_eq!(err.0, StatusCode::FORBIDDEN);
    }

    #[test]
    fn test_stream_video_blocks_traversal_and_outside_paths() {
        let ws = std::env::temp_dir().join("aetheria_stream_test_ws");
        let _ = std::fs::create_dir_all(ws.join("output"));

        let err_rel = resolve_stream_video_target(Some(&ws), Some("../../secret.mp4"), None).unwrap_err();
        assert_eq!(err_rel.0, StatusCode::FORBIDDEN);

        #[cfg(windows)]
        let outside_abs = "C:\\Windows\\win.ini";
        #[cfg(not(windows))]
        let outside_abs = "/etc/passwd";
        let err_abs = resolve_stream_video_target(Some(&ws), Some(outside_abs), None).unwrap_err();
        assert_eq!(err_abs.0, StatusCode::FORBIDDEN);

        let err_file = resolve_stream_video_target(Some(&ws), None, Some("../secret.mp4")).unwrap_err();
        assert_eq!(err_file.0, StatusCode::FORBIDDEN);

        let ok_rel = resolve_stream_video_target(Some(&ws), None, Some("demo.mp4")).unwrap();
        assert_eq!(ok_rel, ws.join("output").join("demo.mp4"));

        let inside_abs = ws.join("output").join("demo.mp4");
        let ok_abs = resolve_stream_video_target(
            Some(&ws),
            Some(inside_abs.to_string_lossy().as_ref()),
            None,
        )
        .unwrap();
        assert_eq!(Path::new(&ok_abs), inside_abs.as_path());

        let _ = std::fs::remove_dir_all(&ws);
    }
}


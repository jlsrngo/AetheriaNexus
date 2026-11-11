//! Video Reference Extractor handler for Studio (`/api/studio/video-reference/extract`).

use crate::files::resolve_base_dir;
use crate::paths::contains_path;
use axum::{extract::Query, http::HeaderMap, response::IntoResponse, Json};
use base64::Engine as _;
use serde::Deserialize;
use serde_json::json;
use std::collections::HashMap;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractVideoRefPayload {
    pub file_name: Option<String>,
    pub video_base64: Option<String>,
    pub video_path: Option<String>,
}

/// POST `/api/studio/video-reference/extract`
pub async fn handle_extract_video_reference(
    Query(q): Query<HashMap<String, String>>,
    headers: HeaderMap,
    Json(payload): Json<ExtractVideoRefPayload>,
) -> impl IntoResponse {
    let active_ws = resolve_base_dir(&q, &headers);
    let ref_dir = active_ws.join("ref");
    let _ = std::fs::create_dir_all(&ref_dir);

    let target_video = if let Some(b64_raw) = payload.video_base64.filter(|s| !s.trim().is_empty()) {
        let clean_b64 = b64_raw
            .split(',')
            .next_back()
            .unwrap_or(b64_raw.as_str())
            .trim();
        let safe_name = payload
            .file_name
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| format!("ref_{}.mp4", crate::paths::now_ms()));
        let safe_base_name = std::path::Path::new(&safe_name)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("ref_upload.mp4");
        let out_path = ref_dir.join(safe_base_name);
        if !contains_path(&active_ws, &out_path) {
            return Json(json!({
                "success": false,
                "error": "Upload filename resolved outside active project folder."
            }));
        }
        match base64::engine::general_purpose::STANDARD.decode(clean_b64) {
            Ok(bytes) => {
                if let Err(e) = std::fs::write(&out_path, &bytes) {
                    return Json(json!({
                        "success": false,
                        "error": format!("Failed to save reference video: {}", e)
                    }));
                }
                out_path
            }
            Err(e) => {
                return Json(json!({
                    "success": false,
                    "error": format!("Invalid video base64 payload: {}", e)
                }));
            }
        }
    } else if let Some(vp) = payload.video_path.filter(|s| !s.trim().is_empty()) {
        let p = std::path::Path::new(&vp);
        let resolved = if p.is_absolute() {
            p.to_path_buf()
        } else {
            active_ws.join(p)
        };
        if !contains_path(&active_ws, &resolved) {
            return Json(json!({
                "success": false,
                "error": "Reference videoPath is outside active project folder."
            }));
        }
        resolved
    } else {
        return Json(json!({
            "success": false,
            "error": "Provide either an uploaded video file or videoPath."
        }));
    };

    let extracted_dir = ref_dir.join("extracted");
    let _ = std::fs::create_dir_all(&extracted_dir);

    let res = crate::tool::ref_extractor::execute_ref_extractor(
        &active_ws.to_string_lossy(),
        &json!({
            "videoPath": target_video.to_string_lossy().to_string(),
            "outputDir": extracted_dir.to_string_lossy().to_string()
        }),
    )
    .await;

    let report_md =
        std::fs::read_to_string(extracted_dir.join("ref_report.md")).unwrap_or_default();

    Json(json!({
        "success": res.get("error").is_none(),
        "videoPath": target_video.to_string_lossy().to_string(),
        "reportPath": extracted_dir.join("ref_report.md").to_string_lossy().to_string(),
        "reportMarkdown": report_md,
        "extractorResult": res
    }))
}

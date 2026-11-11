//! Video Reference Extractor handler for Studio (`/api/studio/video-reference/extract`).

use axum::{response::IntoResponse, Json};
use base64::Engine as _;
use serde::Deserialize;
use serde_json::json;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractVideoRefPayload {
    pub file_name: Option<String>,
    pub video_base64: Option<String>,
    pub video_path: Option<String>,
}

/// POST `/api/studio/video-reference/extract`
pub async fn handle_extract_video_reference(
    Json(payload): Json<ExtractVideoRefPayload>,
) -> impl IntoResponse {
    let root = crate::paths::project_root();
    let ref_dir = root.join("workspace").join("ref");
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
        let out_path = ref_dir.join(&safe_name);
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
        if p.is_absolute() {
            p.to_path_buf()
        } else {
            root.join(p)
        }
    } else {
        return Json(json!({
            "success": false,
            "error": "Provide either an uploaded video file or videoPath."
        }));
    };

    let extracted_dir = ref_dir.join("extracted");
    let _ = std::fs::create_dir_all(&extracted_dir);

    let res = crate::tool::ref_extractor::execute_ref_extractor(
        &root.to_string_lossy(),
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


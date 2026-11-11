//! HTTP Route Handler & Target Preview Helper for Session Event Normalizer.

use axum::{
    extract::{Json, Path as AxumPath},
    response::{IntoResponse, Response},
};
use serde::Deserialize;
use serde_json::{json, Value};

use super::event_normalizer::normalize_engine_event;

/// Extracts a clean file basename preview or command snippet from tool arguments.
pub fn extract_target_preview(args: &Value) -> Option<String> {
    if !args.is_object() {
        return None;
    }

    let target = args
        .get("path")
        .or_else(|| args.get("TargetFile"))
        .or_else(|| args.get("filePath"))
        .or_else(|| args.get("targetFile"))
        .or_else(|| args.get("outputPath"))
        .or_else(|| args.get("output_path"))
        .or_else(|| args.get("composition_id"))
        .or_else(|| args.get("pattern"))
        .and_then(|v| v.as_str());

    if let Some(t) = target {
        let basename = t.split(['/', '\\']).last().unwrap_or(t);
        return Some(basename.to_string());
    }

    if let Some(cmd) = args.get("command").and_then(|v| v.as_str()) {
        let truncated: String = cmd.chars().take(40).collect();
        return Some(truncated);
    }

    None
}

#[derive(Deserialize)]
pub struct NormalizeRequest {
    pub event: Value,
    pub session_id: Option<String>,
}

pub async fn handle_normalize_session_event(
    AxumPath(session_id): AxumPath<String>,
    Json(body): Json<NormalizeRequest>,
) -> Response {
    let sid = body.session_id.unwrap_or(session_id);
    let normalized = normalize_engine_event(&body.event, &sid);
    Json(json!({
        "success": true,
        "normalized": normalized
    }))
    .into_response()
}


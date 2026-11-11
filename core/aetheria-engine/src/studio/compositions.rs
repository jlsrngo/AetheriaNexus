//! Studio composition presets storage and HTTP handlers scoped to the active project folder.

pub use super::composition_scanner::scan_active_workspace_compositions;

use super::composition_scanner::friendly_name_for_id;
use super::motion::resolve_active_dir_from_request;
use super::types::{CompositionPreset, UpdatePropsPayload};
use crate::paths::aetheria_dot_dir;
use axum::{extract::Query, http::HeaderMap, response::IntoResponse, Json};
use serde_json::json;
use std::collections::HashMap;
use std::sync::{OnceLock, RwLock};

static COMPOSITIONS: OnceLock<RwLock<Vec<CompositionPreset>>> = OnceLock::new();

pub fn get_compositions_store() -> &'static RwLock<Vec<CompositionPreset>> {
    COMPOSITIONS.get_or_init(|| RwLock::new(Vec::new()))
}

pub fn default_presets() -> Vec<CompositionPreset> {
    Vec::new()
}

/// Registers a rendered composition in memory when no active HTML scan exists yet.
pub fn register_rendered_composition(id: &str, _output_path: Option<&str>) {
    let mut store = get_compositions_store()
        .write()
        .unwrap_or_else(|e| e.into_inner());
    if !store.iter().any(|c| c.id == id) {
        let friendly = friendly_name_for_id(id);
        store.push(CompositionPreset {
            id: id.to_string(),
            name: friendly.clone(),
            folder: "RENDERED".to_string(),
            ratio: "9:16".to_string(),
            duration: 15.0,
            fps: 30,
            width: 1080,
            height: 1920,
            props: json!({
                "hookText": friendly,
                "category": "HTML MOTION",
                "subCategory": "COMPLETED",
                "authorHandle": "@aetheria"
            }),
        });
    }
}

/// GET / POST /api/get-compositions (Strictly scoped to active workspace directory)
pub async fn handle_get_compositions(
    Query(q): Query<HashMap<String, String>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let active_dir = resolve_active_dir_from_request(&q, &headers);
    let mut discovered = scan_active_workspace_compositions(active_dir.as_deref());

    let store = get_compositions_store()
        .read()
        .unwrap_or_else(|e| e.into_inner());
    for item in discovered.iter_mut() {
        if let Some(saved) = store.iter().find(|s| s.id == item.id) {
            item.props = saved.props.clone();
        }
    }

    Json(json!({
        "success": true,
        "data": discovered
    }))
}

/// POST /api/update-default-props
pub async fn handle_update_default_props(
    Json(payload): Json<UpdatePropsPayload>,
) -> impl IntoResponse {
    let mut store = get_compositions_store()
        .write()
        .unwrap_or_else(|e| e.into_inner());
    let mut found = false;
    for item in store.iter_mut() {
        if item.id == payload.composition_id {
            if let (Some(dest), Some(src)) =
                (item.props.as_object_mut(), payload.props.as_object())
            {
                for (k, v) in src {
                    dest.insert(k.clone(), v.clone());
                }
            } else {
                item.props = payload.props.clone();
            }
            found = true;
            break;
        }
    }

    if !found {
        store.push(CompositionPreset {
            id: payload.composition_id.clone(),
            name: payload
                .props
                .get("hookText")
                .and_then(|v| v.as_str())
                .unwrap_or("HTML Motion Draft")
                .to_string(),
            folder: "ACTIVE PROJECT".to_string(),
            ratio: "9:16".to_string(),
            duration: 15.0,
            fps: 30,
            width: 1080,
            height: 1920,
            props: payload.props.clone(),
        });
    }

    Json(json!({
        "success": true,
        "compositionId": payload.composition_id,
        "props": payload.props
    }))
}

/// POST /api/save-default-props
pub async fn handle_save_default_props(
    Json(payload): Json<UpdatePropsPayload>,
) -> impl IntoResponse {
    let mut store = get_compositions_store()
        .write()
        .unwrap_or_else(|e| e.into_inner());
    for item in store.iter_mut() {
        if item.id == payload.composition_id {
            item.props = payload.props.clone();
            break;
        }
    }

    let save_path = aetheria_dot_dir().join("nexus_compositions.json");
    let saved = if let Ok(serialized) = serde_json::to_string_pretty(&*store) {
        std::fs::write(&save_path, serialized).is_ok()
    } else {
        false
    };

    Json(json!({
        "success": saved,
        "savedPath": save_path.to_string_lossy(),
        "compositionId": payload.composition_id
    }))
}

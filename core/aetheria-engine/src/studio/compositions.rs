//! Studio composition presets storage and HTTP manipulation handlers.

pub use super::composition_scanner::scan_and_merge_workspace_compositions;

use super::composition_scanner::friendly_name_for_id;
use super::types::{CompositionPreset, UpdatePropsPayload};
use crate::paths::aetheria_dot_dir;
use axum::{response::IntoResponse, Json};
use serde_json::json;
use std::sync::{OnceLock, RwLock};

static COMPOSITIONS: OnceLock<RwLock<Vec<CompositionPreset>>> = OnceLock::new();

pub fn get_compositions_store() -> &'static RwLock<Vec<CompositionPreset>> {
    COMPOSITIONS.get_or_init(|| {
        let mut initial = Vec::new();
        let file_path = aetheria_dot_dir().join("nexus_compositions.json");
        if file_path.exists() {
            if let Ok(content) = std::fs::read_to_string(&file_path) {
                if let Ok(loaded) = serde_json::from_str::<Vec<CompositionPreset>>(&content) {
                    if !loaded.is_empty() {
                        initial = loaded;
                    }
                }
            }
        }
        scan_and_merge_workspace_compositions(&mut initial);
        RwLock::new(initial)
    })
}

pub fn default_presets() -> Vec<CompositionPreset> {
    Vec::new()
}

/// Call this when render succeeds to guarantee the composition is known immediately
pub fn register_rendered_composition(id: &str, _output_path: Option<&str>) {
    let mut store = get_compositions_store()
        .write()
        .unwrap_or_else(|e| e.into_inner());
    scan_and_merge_workspace_compositions(&mut store);
    if !store.iter().any(|c| c.id == id) {
        let friendly = friendly_name_for_id(id);
        store.push(CompositionPreset {
            id: id.to_string(),
            name: friendly.clone(),
            folder: "AI WORKSPACE".to_string(),
            ratio: "9:16".to_string(),
            duration: 60.0,
            fps: 30,
            width: 1080,
            height: 1920,
            props: json!({
                "hookText": friendly,
                "category": "AI RENDERED",
                "subCategory": "COMPLETED",
                "authorHandle": "@aetheria"
            }),
        });
    }
}

/// GET / POST /api/get-compositions
pub async fn handle_get_compositions() -> impl IntoResponse {
    let mut store = get_compositions_store()
        .write()
        .unwrap_or_else(|e| e.into_inner());
    scan_and_merge_workspace_compositions(&mut store);
    Json(json!({
        "success": true,
        "data": *store
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
        let new_preset = CompositionPreset {
            id: payload.composition_id.clone(),
            name: payload
                .props
                .get("hookText")
                .and_then(|v| v.as_str())
                .unwrap_or("AI Draft Composition")
                .to_string(),
            folder: "AI GENERATED DRAFTS".to_string(),
            ratio: "9:16".to_string(),
            duration: 5.0,
            fps: 30,
            width: 1080,
            height: 1920,
            props: payload.props.clone(),
        };
        store.push(new_preset);
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

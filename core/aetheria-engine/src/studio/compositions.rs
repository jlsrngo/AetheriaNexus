//! Studio composition presets storage and manipulation.

use super::types::{CompositionPreset, UpdatePropsPayload};
use crate::paths::aetheria_dot_dir;
use axum::{response::IntoResponse, Json};
use serde_json::json;
use std::sync::{OnceLock, RwLock};

static COMPOSITIONS: OnceLock<RwLock<Vec<CompositionPreset>>> = OnceLock::new();

pub fn get_compositions_store() -> &'static RwLock<Vec<CompositionPreset>> {
    COMPOSITIONS.get_or_init(|| {
        let file_path = aetheria_dot_dir().join("nexus_compositions.json");
        if file_path.exists() {
            if let Ok(content) = std::fs::read_to_string(&file_path) {
                if let Ok(loaded) = serde_json::from_str::<Vec<CompositionPreset>>(&content) {
                    if !loaded.is_empty() {
                        return RwLock::new(loaded);
                    }
                }
            }
        }
        RwLock::new(default_presets())
    })
}

pub fn default_presets() -> Vec<CompositionPreset> {
    vec![
        CompositionPreset {
            id: "LinusTorvalds".to_string(),
            name: "Linus Torvalds — The Man Behind Linux".to_string(),
            folder: "AI WORKSPACE".to_string(),
            ratio: "9:16".to_string(),
            duration: 62.0,
            fps: 60,
            width: 1080,
            height: 1920,
            props: json!({
                "hookText": "Tahukah Kamu? Mahasiswa Yang Mengubah Dunia Teknologi!",
                "bodyText": "Linus Torvalds, 1991 Finland. Kernel monolitik Linux & Git.",
                "category": "DOCUMENTARY",
                "subCategory": "OPEN SOURCE",
                "authorHandle": "@torvalds"
            }),
        },
        CompositionPreset {
            id: "RustHistory".to_string(),
            name: "Rust History (60s Kinetic)".to_string(),
            folder: "AI WORKSPACE".to_string(),
            ratio: "9:16".to_string(),
            duration: 60.0,
            fps: 60,
            width: 1080,
            height: 1920,
            props: json!({
                "hookText": "The Story of Rust: From Broken Elevator to Global Infra",
                "bodyText": "Graydon Hoare, Mozilla 2006. Memory safety without garbage collection.",
                "category": "TECH HISTORY",
                "subCategory": "SYSTEMS",
                "authorHandle": "@rustlang"
            }),
        },
    ]
}

/// GET / POST /api/get-compositions
pub async fn handle_get_compositions() -> impl IntoResponse {
    let store = get_compositions_store().read().unwrap();
    Json(json!({
        "success": true,
        "data": *store
    }))
}

/// POST /api/update-default-props
pub async fn handle_update_default_props(
    Json(payload): Json<UpdatePropsPayload>,
) -> impl IntoResponse {
    let mut store = get_compositions_store().write().unwrap();
    let mut found = false;
    for item in store.iter_mut() {
        if item.id == payload.composition_id {
            if let (Some(dest), Some(src)) = (item.props.as_object_mut(), payload.props.as_object()) {
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
            name: payload.props.get("hookText")
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
    let mut store = get_compositions_store().write().unwrap();
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

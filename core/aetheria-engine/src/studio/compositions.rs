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
            id: "nexus-vertical".to_string(),
            name: "NexusVertical (9:16)".to_string(),
            folder: "TIKTOK AUTOMATION".to_string(),
            ratio: "9:16".to_string(),
            duration: 5.0,
            fps: 30,
            width: 1080,
            height: 1920,
            props: json!({
                "hookText": "3 Morning Habits of High Performers You Never Knew",
                "bodyText": "1. Drink 500ml of mineral water before checking your phone\n2. 10 minutes of light stretching to boost mental focus\n3. Write down your single most critical priority for today",
                "themeColor": "emerald",
                "category": "PRODUCTIVITY",
                "subCategory": "EXECUTIVE HABITS",
                "authorHandle": "@nexus.creative"
            }),
        },
        CompositionPreset {
            id: "nexus-square".to_string(),
            name: "SquarePost (1:1)".to_string(),
            folder: "TIKTOK AUTOMATION".to_string(),
            ratio: "1:1".to_string(),
            duration: 5.0,
            fps: 30,
            width: 1080,
            height: 1080,
            props: json!({
                "hookText": "The Golden Rule of Visual Hook Retention",
                "bodyText": "1. First 2 seconds determines 80% of video reach\n2. Keep headline under 8 words with bold contrast\n3. Maintain constant micro-motion throughout video",
                "themeColor": "violet",
                "category": "GROWTH",
                "subCategory": "ALGORITHM METRICS",
                "authorHandle": "@nexus.creative"
            }),
        },
        CompositionPreset {
            id: "nexus-landscape".to_string(),
            name: "LandscapeShort (16:9)".to_string(),
            folder: "TIKTOK AUTOMATION".to_string(),
            ratio: "16:9".to_string(),
            duration: 5.0,
            fps: 30,
            width: 1920,
            height: 1080,
            props: json!({
                "hookText": "Zero-Cost Automated Video Architecture",
                "bodyText": "1. Nexus React runtime executes locally on CPU/GPU\n2. Axum background engine binds loopback port 20288\n3. Total cloud rendering and API cost = Rp 0",
                "themeColor": "violet",
                "category": "ENGINEERING",
                "subCategory": "ZERO CLOUD COST",
                "authorHandle": "@nexus.creative"
            }),
        },
        CompositionPreset {
            id: "hook-morning-habits".to_string(),
            name: "3 Morning Habits (High Pacing)".to_string(),
            folder: "VIRAL HOOK TEMPLATES".to_string(),
            ratio: "9:16".to_string(),
            duration: 5.0,
            fps: 30,
            width: 1080,
            height: 1920,
            props: json!({
                "hookText": "3 Morning Habits of High Performers You Never Knew",
                "bodyText": "1. Drink 500ml of mineral water before checking your phone\n2. 10 minutes of light stretching to boost mental focus\n3. Write down your single most critical priority for today",
                "themeColor": "emerald",
                "category": "PRODUCTIVITY"
            }),
        },
        CompositionPreset {
            id: "hook-finance-failure".to_string(),
            name: "Why 99% Fail (Finance)".to_string(),
            folder: "VIRAL HOOK TEMPLATES".to_string(),
            ratio: "9:16".to_string(),
            duration: 15.0,
            fps: 30,
            width: 1080,
            height: 1920,
            props: json!({
                "hookText": "Why 99% of People Fail Financially in Their 20s",
                "bodyText": "1. Confusing high income with building real wealth\n2. Financing depreciating lifestyle assets on credit\n3. Never automating monthly index fund investments",
                "themeColor": "amber",
                "category": "FINANCE"
            }),
        },
        CompositionPreset {
            id: "hook-dopamine-reset".to_string(),
            name: "2-Min Dopamine Reset (Hook)".to_string(),
            folder: "VIRAL HOOK TEMPLATES".to_string(),
            ratio: "9:16".to_string(),
            duration: 30.0,
            fps: 30,
            width: 1080,
            height: 1920,
            props: json!({
                "hookText": "The 2-Minute Neuroscience Hack to Reset Your Dopamine",
                "bodyText": "1. Step into bright natural morning sunlight immediately\n2. Complete a 90-second cold water facial immersion\n3. Avoid short-form video dopamine loops for first 60 mins",
                "themeColor": "cyan",
                "category": "PSYCHOLOGY"
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

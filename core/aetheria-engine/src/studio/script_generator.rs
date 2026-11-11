//! Creative AI Script-to-Composition Orchestrator (`/api/studio/generate-script`).

use super::compositions::get_compositions_store;
use super::types::{CompositionPreset, GenerateScriptPayload};
use crate::paths::{aetheria_dot_dir, now_ms};
use axum::{response::IntoResponse, Json};
use serde_json::json;

pub async fn handle_generate_script(
    Json(payload): Json<GenerateScriptPayload>,
) -> impl IntoResponse {
    let niche = payload
        .niche
        .unwrap_or_else(|| "AUTOMATION".to_string())
        .to_uppercase();
    let duration = payload.duration.unwrap_or(15.0);
    let theme_color = payload.theme_color.unwrap_or_else(|| "emerald".to_string());
    let title = format!("{} (AI Viral Hook)", payload.topic);
    let id = format!("preset-ai-{}", now_ms());

    let hook_text = format!(
        "The Untold Truth About {} That Changes Everything",
        payload.topic
    );
    let body_text = "1. Stop relying on outdated manual workflows\n2. Automate asset rendering locally with zero cloud fees\n3. Leverage high-retention cadence to dominate short-form feeds".to_string();
    let cta_text = "Follow @nexus.creative for the full blueprint".to_string();

    let preset = CompositionPreset {
        id,
        name: title,
        folder: "AI GENERATED DRAFTS".to_string(),
        ratio: "9:16".to_string(),
        duration,
        fps: 30,
        width: 1080,
        height: 1920,
        props: json!({
            "hookText": hook_text,
            "bodyText": body_text,
            "ctaText": cta_text,
            "themeColor": theme_color,
            "category": niche,
            "subCategory": "VIRAL SHORT-FORM",
            "authorHandle": "@nexus.creative"
        }),
    };

    let should_register = payload.auto_register.unwrap_or(true);
    if should_register {
        let mut store = get_compositions_store()
            .write()
            .unwrap_or_else(|e| e.into_inner());
        store.push(preset.clone());
        let file_path = aetheria_dot_dir().join("nexus_compositions.json");
        if let Ok(json_str) = serde_json::to_string_pretty(&*store) {
            let _ = std::fs::write(file_path, json_str);
        }
    }

    Json(json!({
        "success": true,
        "composition": preset
    }))
}


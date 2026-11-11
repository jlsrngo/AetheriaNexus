//! Native Rust 12-Layer NLE Timeline Calculator.

pub use super::script_generator::handle_generate_script;

use super::compositions::get_compositions_store;
use super::types::{ComputeLayersPayload, RustVideoLayerSpec};
use axum::{response::IntoResponse, Json};
use serde_json::{json, Value};

pub fn build_composition_layers_rust(props: &Value, total_frames: u32) -> Vec<RustVideoLayerSpec> {
    let total = total_frames.max(15);
    let show_bg = props
        .get("showBackground")
        .and_then(Value::as_bool)
        .unwrap_or(true);
    let show_txt = props
        .get("showText")
        .and_then(Value::as_bool)
        .unwrap_or(true);
    let vis_map = props.get("layerVisibility").and_then(Value::as_object);
    let start_map = props.get("layerStartFrame").and_then(Value::as_object);
    let dur_map = props.get("layerDuration").and_then(Value::as_object);

    let is_vis = |id: &str, group: bool| -> bool {
        if !group {
            return false;
        }
        vis_map
            .and_then(|m| m.get(id))
            .and_then(Value::as_bool)
            .unwrap_or(true)
    };

    let resolve_timing = |id: &str, default_from: u32| -> (u32, u32) {
        let from_raw = start_map
            .and_then(|m| m.get(id))
            .and_then(Value::as_u64)
            .map(|v| v as u32)
            .unwrap_or(default_from);
        let from = from_raw.min(total.saturating_sub(5));
        let max_dur = total.saturating_sub(from).max(5);
        let dur = dur_map
            .and_then(|m| m.get(id))
            .and_then(Value::as_u64)
            .map(|v| v as u32)
            .unwrap_or(max_dur)
            .clamp(5, max_dur);
        (from, dur)
    };

    let category = props
        .get("category")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim();
    let sub_category = props
        .get("subCategory")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim();
    let hook_text = props
        .get("hookText")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim();
    let body_text = props.get("bodyText").and_then(Value::as_str).unwrap_or("");
    let author_handle = props
        .get("authorHandle")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim();
    let editorial_tag = props
        .get("editorialTag")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim();

    let mut raw: Vec<(String, String, String, u32, u32, bool)> = Vec::new();

    if let Some(custom_arr) = props.get("customLayers").and_then(Value::as_array) {
        for (idx, item) in custom_arr.iter().enumerate() {
            let id = item
                .get("id")
                .and_then(Value::as_str)
                .map(str::to_string)
                .unwrap_or_else(|| format!("custom-layer-{}", idx));
            let label = item
                .get("label")
                .and_then(Value::as_str)
                .map(str::to_string)
                .unwrap_or_else(|| format!("Custom Layer #{}", idx + 1));
            let kind = item
                .get("kind")
                .and_then(Value::as_str)
                .unwrap_or("text")
                .to_string();
            let default_start = item
                .get("from")
                .and_then(Value::as_u64)
                .map(|v| v as u32)
                .unwrap_or_else(|| (12 + (idx as u32) * 10).min(total.saturating_sub(15)));
            let (f, d) = resolve_timing(&id, default_start);
            raw.push((id.clone(), label, kind, f, d, is_vis(&id, show_txt)));
        }
    }

    if !category.is_empty() {
        let (f, d) = resolve_timing("hud-category", 0);
        raw.push((
            "hud-category".to_string(),
            format!("Left Badge: // {}", category),
            "icon".to_string(),
            f,
            d,
            is_vis("hud-category", show_txt),
        ));
    }

    if !sub_category.is_empty() {
        let (f, d) = resolve_timing("hud-subcategory", 4);
        raw.push((
            "hud-subcategory".to_string(),
            format!("Right Label: [ {} ]", sub_category),
            "text".to_string(),
            f,
            d,
            is_vis("hud-subcategory", show_txt),
        ));
    }

    if !hook_text.is_empty() {
        let hook_short: String = hook_text.chars().take(24).collect();
        let (f, d) = resolve_timing("text-hook", 8);
        raw.push((
            "text-hook".to_string(),
            format!("Hook Title: \"{}...\"", hook_short),
            "text".to_string(),
            f,
            d,
            is_vis("text-hook", show_txt),
        ));
    }

    for (idx, line) in body_text
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty())
        .enumerate()
    {
        let id = format!("text-bullet-{}", idx);
        let default_start = (20 + (idx as u32) * 14).min(total.saturating_sub(15));
        let (f, d) = resolve_timing(&id, default_start);
        let short_line: String = line.chars().take(26).collect();
        raw.push((
            id.clone(),
            format!("Point #{}: {}", idx + 1, short_line),
            "text".to_string(),
            f,
            d,
            is_vis(&id, show_txt),
        ));
    }

    if !author_handle.is_empty() {
        let (f, d) = resolve_timing("footer-icon", 32);
        raw.push((
            "footer-icon".to_string(),
            "Avatar Icon: [⚡] Box".to_string(),
            "icon".to_string(),
            f,
            d,
            is_vis("footer-icon", show_txt),
        ));

        let (f, d) = resolve_timing("footer-author", 36);
        raw.push((
            "footer-author".to_string(),
            format!("Author: {}", author_handle),
            "text".to_string(),
            f,
            d,
            is_vis("footer-author", show_txt),
        ));
    }

    if !editorial_tag.is_empty() {
        let (f, d) = resolve_timing("footer-tag", 40);
        raw.push((
            "footer-tag".to_string(),
            format!("Footer Badge: {}", editorial_tag),
            "icon".to_string(),
            f,
            d,
            is_vis("footer-tag", show_txt),
        ));
    }

    let (f, d) = resolve_timing("bg-grid-pattern", 0);
    raw.push((
        "bg-grid-pattern".to_string(),
        "Pattern: Blueprint Grid".to_string(),
        "pattern".to_string(),
        f,
        d,
        is_vis("bg-grid-pattern", show_bg),
    ));

    let (f, d) = resolve_timing("bg-orb-pattern", 0);
    raw.push((
        "bg-orb-pattern".to_string(),
        "Pattern: Ambient Glow Orb".to_string(),
        "pattern".to_string(),
        f,
        d,
        is_vis("bg-orb-pattern", show_bg),
    ));

    let (f, d) = resolve_timing("bg-base", 0);
    raw.push((
        "bg-base".to_string(),
        "Background: Radial Gradient".to_string(),
        "background".to_string(),
        f,
        d,
        is_vis("bg-base", show_bg),
    ));

    let count = raw.len();
    raw.into_iter()
        .enumerate()
        .map(
            |(i, (id, label, kind, from, duration_in_frames, visible))| RustVideoLayerSpec {
                id,
                track_code: format!("V{}", count - i),
                label,
                kind,
                from,
                duration_in_frames,
                visible,
            },
        )
        .collect()
}

pub async fn handle_compute_layers(Json(payload): Json<ComputeLayersPayload>) -> impl IntoResponse {
    let store = get_compositions_store()
        .read()
        .unwrap_or_else(|e| e.into_inner());
    let active = payload
        .composition_id
        .as_ref()
        .and_then(|id| store.iter().find(|c| &c.id == id))
        .or_else(|| store.first());

    let props = payload
        .props
        .or_else(|| active.map(|c| c.props.clone()))
        .unwrap_or_else(|| json!({}));

    let total_frames = payload.total_frames.unwrap_or_else(|| {
        active
            .map(|c| ((c.duration * (c.fps as f64)).round() as u32).max(15))
            .unwrap_or(150)
    });
    drop(store);

    let layers = build_composition_layers_rust(&props, total_frames);
    Json(json!({
        "success": true,
        "totalLayers": layers.len(),
        "totalFrames": total_frames,
        "layers": layers
    }))
}

pub async fn handle_get_active_layers() -> impl IntoResponse {
    let store = get_compositions_store()
        .read()
        .unwrap_or_else(|e| e.into_inner());
    let first = store.first().cloned();
    drop(store);

    if let Some(comp) = first {
        let total_frames = ((comp.duration * (comp.fps as f64)).round() as u32).max(15);
        let layers = build_composition_layers_rust(&comp.props, total_frames);
        Json(json!({
            "success": true,
            "compositionId": comp.id,
            "totalLayers": layers.len(),
            "totalFrames": total_frames,
            "layers": layers
        }))
    } else {
        Json(json!({ "success": false, "layers": [] }))
    }
}

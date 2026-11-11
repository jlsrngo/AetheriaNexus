//! Active-workspace HTML Motion Film scanner for studio composition presets.

use super::motion::resolve_film_html_in_dir;
use super::film_inspector::inspect_workspace_film;
use super::types::CompositionPreset;
use serde_json::json;
use std::path::Path;

pub(crate) fn friendly_name_for_id(id: &str) -> String {
    let clean = id.trim_end_matches("Composition");
    let chars: Vec<char> = clean.chars().collect();
    let mut out = String::new();
    for (i, &c) in chars.iter().enumerate() {
        if i > 0 && c.is_uppercase() {
            let prev = chars[i - 1];
            let next = chars.get(i + 1).copied();
            if prev.is_lowercase()
                || (prev.is_uppercase() && next.map(|n| n.is_lowercase()).unwrap_or(false))
            {
                out.push(' ');
            }
        }
        out.push(c);
    }
    if out.is_empty() {
        id.to_string()
    } else {
        out
    }
}

/// Inspects ONLY the given active workspace directory for an HTML Motion Film (`index.html`).
pub fn scan_active_workspace_compositions(ws_dir: Option<&Path>) -> Vec<CompositionPreset> {
    let Some(dir) = ws_dir else {
        return Vec::new();
    };
    let Some(html_path) = resolve_film_html_in_dir(dir) else {
        return Vec::new();
    };

    let meta = inspect_workspace_film(&html_path);
    if !meta.exists {
        return Vec::new();
    }

    let ratio = if meta.width == 1080 && meta.height == 1920 {
        "9:16"
    } else if meta.width == 1920 && meta.height == 1080 {
        "16:9"
    } else if meta.width == meta.height {
        "1:1"
    } else {
        "9:16"
    };

    let folder_label = dir
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("ACTIVE PROJECT")
        .to_string();

    vec![CompositionPreset {
        id: "HtmlMotionFilm".to_string(),
        name: if meta.title.is_empty() {
            folder_label.clone()
        } else {
            meta.title.clone()
        },
        folder: folder_label,
        ratio: ratio.to_string(),
        duration: meta.duration.max(1.0),
        fps: meta.fps.max(1),
        width: meta.width.max(16),
        height: meta.height.max(16),
        props: json!({
            "hookText": meta.title,
            "category": "HTML MOTION",
            "subCategory": format!("{} SCENES", meta.scenes.len()),
            "authorHandle": "@aetheria",
            "bgPrimary": "#0A0A0C",
            "accentColor": "#10B981"
        }),
    }]
}

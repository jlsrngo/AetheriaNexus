//! Studio composition presets storage and manipulation.

use super::types::{CompositionPreset, UpdatePropsPayload};
use crate::paths::{aetheria_dot_dir, project_root};
use axum::{response::IntoResponse, Json};
use serde_json::json;
use std::collections::HashMap;
use std::path::Path;
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

/// Recursively collect all numeric constant definitions `const FOO = 123` or `export const FOO = 123`
fn collect_workspace_numeric_constants(dir: &Path, map: &mut HashMap<String, u32>) {
    let Ok(entries) = std::fs::read_dir(dir) else { return; };
    for entry in entries.flatten() {
        let p = entry.path();
        if p.is_dir() {
            collect_workspace_numeric_constants(&p, map);
        } else if let Some(ext) = p.extension() {
            if ext == "ts" || ext == "tsx" {
                if let Ok(content) = std::fs::read_to_string(&p) {
                    for line in content.lines() {
                        let trimmed = line.trim();
                        // Match "const NAME = 123" or "export const NAME = 123"
                        if let Some(pos) = trimmed.find("const ") {
                            let after = &trimmed[pos + 6..].trim_start();
                            if let Some(eq_pos) = after.find('=') {
                                let name = after[..eq_pos].trim().trim_end_matches(':').trim();
                                let mut val_str = after[eq_pos + 1..].trim();
                                if let Some(semi) = val_str.find(';') {
                                    val_str = &val_str[..semi].trim();
                                }
                                if let Ok(n) = val_str.parse::<u32>() {
                                    map.insert(name.to_string(), n);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

fn extract_prop_value(tag_slice: &str, prop_name: &str, constants: &HashMap<String, u32>, default_val: u32) -> u32 {
    let key = format!("{}=", prop_name);
    let Some(idx) = tag_slice.find(&key) else { return default_val; };
    let after = &tag_slice[idx + key.len()..].trim_start();
    let val_str = if after.starts_with('{') {
        let end = after.find('}').unwrap_or(after.len());
        after[1..end].trim()
    } else if after.starts_with('"') || after.starts_with('\'') {
        let quote = after.chars().next().unwrap();
        let end = after[1..].find(quote).unwrap_or(after.len() - 1);
        &after[1..end + 1]
    } else {
        let end = after.find(|c: char| c.is_whitespace() || c == '/' || c == '>').unwrap_or(after.len());
        &after[..end]
    };

    if let Ok(num) = val_str.parse::<u32>() {
        num
    } else if let Some(&num) = constants.get(val_str) {
        num
    } else {
        default_val
    }
}

fn friendly_name_for_id(id: &str) -> String {
    let clean = id.trim_end_matches("Composition");
    let chars: Vec<char> = clean.chars().collect();
    let mut out = String::new();
    for (i, &c) in chars.iter().enumerate() {
        if i > 0 && c.is_uppercase() {
            let prev = chars[i - 1];
            let next = chars.get(i + 1).copied();
            if prev.is_lowercase() || (prev.is_uppercase() && next.map(|n| n.is_lowercase()).unwrap_or(false)) {
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

/// Dynamically scan `workspace/src/Root.tsx` and merge discovered Remotion compositions.
pub fn scan_and_merge_workspace_compositions(store: &mut Vec<CompositionPreset>) {
    let root = project_root();
    let root_tsx_candidates = [
        root.join("workspace").join("src").join("Root.tsx"),
        root.join("src").join("Root.tsx"),
    ];

    let root_tsx_path = root_tsx_candidates.iter().find(|p| p.exists());
    let Some(root_path) = root_tsx_path else { return; };
    let Ok(content) = std::fs::read_to_string(root_path) else { return; };

    let mut constants = HashMap::new();
    let ws_src = root.join("workspace").join("src");
    if ws_src.is_dir() {
        collect_workspace_numeric_constants(&ws_src, &mut constants);
    }

    // Find all `<Composition` blocks
    let mut search_from = 0;
    while let Some(comp_idx) = content[search_from..].find("<Composition") {
        let abs_idx = search_from + comp_idx;
        let rest = &content[abs_idx..];
        let end_idx = rest.find("/>").or_else(|| rest.find("</Composition>")).unwrap_or(rest.len());
        let block = &rest[..end_idx];
        search_from = abs_idx + end_idx;

        // Extract id="Foo" or id={'Foo'}
        let Some(id_pos) = block.find("id=") else { continue; };
        let after_id = &block[id_pos + 3..].trim_start();
        let id_val = if after_id.starts_with('"') || after_id.starts_with('\'') {
            let quote = after_id.chars().next().unwrap();
            let end = after_id[1..].find(quote).unwrap_or(after_id.len() - 1);
            after_id[1..end + 1].trim().to_string()
        } else if after_id.starts_with('{') {
            let end = after_id.find('}').unwrap_or(after_id.len());
            after_id[1..end].trim().trim_matches('"').trim_matches('\'').to_string()
        } else {
            continue;
        };

        if id_val.is_empty() {
            continue;
        }

        let fps = extract_prop_value(block, "fps", &constants, 30);
        let width = extract_prop_value(block, "width", &constants, 1080);
        let height = extract_prop_value(block, "height", &constants, 1920);
        let total_frames = extract_prop_value(block, "durationInFrames", &constants, 1800);
        let duration = if fps > 0 {
            (total_frames as f64 / fps as f64).round()
        } else {
            60.0
        };

        let ratio = if width == 1080 && height == 1920 {
            "9:16"
        } else if width == 1920 && height == 1080 {
            "16:9"
        } else if width == height {
            "1:1"
        } else {
            "9:16"
        };

        let existing = store.iter_mut().find(|c| c.id == id_val);
        if let Some(comp) = existing {
            // Keep up to date with Root.tsx
            comp.fps = fps;
            comp.width = width;
            comp.height = height;
            comp.duration = duration;
            comp.ratio = ratio.to_string();
        } else {
            let friendly = friendly_name_for_id(&id_val);
            store.push(CompositionPreset {
                id: id_val.clone(),
                name: friendly.clone(),
                folder: "AI WORKSPACE".to_string(),
                ratio: ratio.to_string(),
                duration,
                fps,
                width,
                height,
                props: json!({
                    "hookText": friendly,
                    "category": "AI CREATED",
                    "subCategory": "AUTONOMOUS",
                    "authorHandle": "@aetheria"
                }),
            });
        }
    }
}

/// Call this when render succeeds to guarantee the composition is known immediately
pub fn register_rendered_composition(id: &str, _output_path: Option<&str>) {
    let mut store = get_compositions_store().write().unwrap();
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
    let mut store = get_compositions_store().write().unwrap();
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

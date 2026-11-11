//! Workspace recursive file traversal, path lookup, and content text search.

use crate::file_changes::is_ignored_change_path;
use crate::file_text_extract::extract_diffable_text;
use crate::files::resolve_base_dir;
use crate::paths::contains_path;
use axum::{
    extract::Query,
    http::HeaderMap,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

pub fn collect_files_recursive(
    dir: &Path,
    base: &Path,
    out: &mut Vec<PathBuf>,
    max_files: usize,
) {
    if out.len() >= max_files {
        return;
    }
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        if out.len() >= max_files {
            break;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') || name == "node_modules" || name == "target" || name == "dist" {
            continue;
        }
        let path = entry.path();
        if !contains_path(base, &path) {
            continue;
        }
        if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            collect_files_recursive(&path, base, out, max_files);
        } else {
            out.push(path);
        }
    }
}

pub(crate) async fn handle_find_file(
    Query(q): Query<HashMap<String, String>>,
    headers: HeaderMap,
) -> Response {
    let base_dir = resolve_base_dir(&q, &headers);
    let query_str = q
        .get("query")
        .map(|s| s.to_lowercase())
        .unwrap_or_default();
    let limit = q
        .get("limit")
        .and_then(|s| s.parse::<usize>().ok())
        .unwrap_or(50);

    let mut all_files = Vec::new();
    collect_files_recursive(&base_dir, &base_dir, &mut all_files, 1500);

    let mut matches = Vec::new();
    for f in all_files {
        let rel = f
            .strip_prefix(&base_dir)
            .unwrap_or(&f)
            .to_string_lossy()
            .replace('\\', "/");
        if query_str.is_empty() || rel.to_lowercase().contains(&query_str) {
            matches.push(Value::String(rel));
            if matches.len() >= limit {
                break;
            }
        }
    }

    Json(Value::Array(matches)).into_response()
}

pub(crate) async fn handle_find_text(
    Query(q): Query<HashMap<String, String>>,
    headers: HeaderMap,
) -> Response {
    let base_dir = resolve_base_dir(&q, &headers);
    let raw_pattern = q.get("pattern").cloned().unwrap_or_default();
    if raw_pattern.trim().is_empty() {
        return Json(json!([])).into_response();
    }
    let case_sensitive = q
        .get("caseSensitive")
        .map(|v| v == "true" || v == "1")
        .unwrap_or(false);
    let pattern_cmp = if case_sensitive {
        raw_pattern.clone()
    } else {
        raw_pattern.to_lowercase()
    };

    let mut all_files = Vec::new();
    collect_files_recursive(&base_dir, &base_dir, &mut all_files, 500);

    let mut results = Vec::new();
    for f in all_files {
        if results.len() >= 150 {
            break;
        }
        let ext = f
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        if matches!(
            ext.as_str(),
            "png" | "jpg" | "jpeg" | "gif" | "webp" | "zip" | "exe" | "dll" | "bak" | "tmp"
        ) {
            continue;
        }
        let txt = extract_diffable_text(&f);
        if txt.is_empty() || txt.starts_with("[Binary File:") {
            continue;
        }
        let rel = f
            .strip_prefix(&base_dir)
            .unwrap_or(&f)
            .to_string_lossy()
            .replace('\\', "/");
        if is_ignored_change_path(&rel) {
            continue;
        }
        for (idx, line) in txt.lines().enumerate() {
            let matched = if case_sensitive {
                line.contains(&pattern_cmp)
            } else {
                line.to_lowercase().contains(&pattern_cmp)
            };
            if matched {
                results.push(json!({
                    "path": { "text": rel },
                    "lines": { "text": line },
                    "line_number": idx + 1,
                    "absolute_offset": 0,
                    "submatches": []
                }));
                if results.len() >= 150 {
                    break;
                }
            }
        }
    }

    Json(Value::Array(results)).into_response()
}


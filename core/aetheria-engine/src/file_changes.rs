//! Workspace document change tracking and baseline review lifecycle (`status`, `revert`, `accept`).

use crate::file_search::collect_files_recursive;
use crate::file_text_extract::{
    extract_diffable_text, extract_diffable_text_from_bytes, is_binary_doc_ext,
};
use crate::files::resolve_base_dir;
use crate::paths::contains_path;
use axum::{
    extract::Query,
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::Path;
use std::sync::{Mutex, OnceLock};

pub static DOCUMENT_CHANGES: OnceLock<Mutex<HashMap<String, (String, String, u64)>>> =
    OnceLock::new();

pub(crate) fn is_ignored_change_path(rel_path: &str) -> bool {
    let norm = rel_path.replace('\\', "/");
    let trimmed = norm.trim_start_matches("./").trim_start_matches('/');
    if trimmed.is_empty()
        || trimmed.starts_with('.')
        || trimmed.starts_with("~$")
        || trimmed.contains("/.")
        || trimmed.contains("/~$")
        || trimmed.ends_with(".__new__")
    {
        return true;
    }
    let fname = Path::new(trimmed)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(trimmed);
    if fname.starts_with('.') || fname.starts_with("~$") || fname.ends_with(".__new__") {
        return true;
    }
    let ext = Path::new(fname)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    matches!(
        ext.as_str(),
        "py" | "ps1" | "sh" | "bat" | "cmd" | "bak" | "tmp"
    )
}

pub fn ensure_workspace_baseline(_base_dir: &Path) {
    // Baseline auto-spawning removed
}

pub fn capture_baseline_before_write(_workspace_dir: &str, _file: &str) {
    // Baseline auto-spawning removed
}

pub fn remove_baseline_for_path(workspace_dir: &str, file: &str) {
    if workspace_dir.trim().is_empty() {
        return;
    }
    let base = Path::new(workspace_dir);
    let rel = normalize_rel_file(base, file);
    remove_document_change(&rel);
}

pub fn record_document_change(workspace_dir: &str, file: &str, before: &str, after: &str) {
    if is_ignored_change_path(file) {
        return;
    }
    capture_baseline_before_write(workspace_dir, file);

    let base = Path::new(workspace_dir);
    let rel = if !workspace_dir.trim().is_empty() {
        normalize_rel_file(base, file)
    } else {
        file.replace('\\', "/")
    };

    if !is_binary_doc_ext(Path::new(&rel)) {
        let store = DOCUMENT_CHANGES.get_or_init(|| Mutex::new(HashMap::new()));
        if let Ok(mut lock) = store.lock() {
            lock.insert(
                rel.clone(),
                (
                    before.to_string(),
                    after.to_string(),
                    crate::paths::now_ms(),
                ),
            );
        }
    }
}

pub(crate) fn normalize_rel_file(base_dir: &Path, raw: &str) -> String {
    let base_norm = base_dir
        .to_string_lossy()
        .replace('\\', "/")
        .trim_end_matches('/')
        .to_string();
    let raw_norm = raw.replace('\\', "/");
    let raw_lower = raw_norm.to_ascii_lowercase();
    let prefix_lower = format!("{}/", base_norm.to_ascii_lowercase());
    let rel = if raw_lower.starts_with(&prefix_lower) {
        &raw_norm[prefix_lower.len()..]
    } else {
        raw_norm.as_str()
    };
    rel.trim_start_matches("./").trim_start_matches('/').to_string()
}

pub fn remove_document_change(file: &str) {
    let store = DOCUMENT_CHANGES.get_or_init(|| Mutex::new(HashMap::new()));
    let norm_target = file.replace('\\', "/");
    let fname_target = Path::new(&norm_target)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(&norm_target)
        .to_ascii_lowercase();
    if let Ok(mut lock) = store.lock() {
        lock.retain(|k, _| {
            let k_norm = k.replace('\\', "/");
            let k_fname = Path::new(&k_norm)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or(&k_norm)
                .to_ascii_lowercase();
            !k_norm.eq_ignore_ascii_case(&norm_target) && k_fname != fname_target
        });
    }
}

fn change_item(
    path: &str,
    name: &str,
    status: &str,
    before: &str,
    after: &str,
    timestamp: u64,
) -> Value {
    json!({
        "path": path,
        "name": name,
        "status": status,
        "before": before,
        "after": after,
        "before_content": before,
        "after_content": after,
        "timestamp": timestamp,
    })
}

fn extract_req_path<'a>(body: &'a Value, q: &'a HashMap<String, String>) -> Option<&'a str> {
    body.get("path")
        .or_else(|| body.get("filePath"))
        .or_else(|| body.get("file"))
        .and_then(|v| v.as_str())
        .or_else(|| q.get("path").map(|s| s.as_str()))
}

pub(crate) async fn handle_status(
    Query(q): Query<HashMap<String, String>>,
    headers: HeaderMap,
) -> Response {
    let base_dir = resolve_base_dir(&q, &headers);
    ensure_workspace_baseline(&base_dir);

    let store = DOCUMENT_CHANGES.get_or_init(|| Mutex::new(HashMap::new()));
    let mut items = Vec::new();
    let baseline_dir = base_dir.join(".aetheria").join("baseline");
    let _ = std::fs::remove_dir_all(baseline_dir.join(".aetheria"));

    // 1. Scan all current files in active workspace against .aetheria/baseline/
    let mut current_files = Vec::new();
    collect_files_recursive(&base_dir, &base_dir, &mut current_files, 1500);
    for current_file in current_files {
        let Ok(rel) = current_file.strip_prefix(&base_dir) else {
            continue;
        };
        let rel_str = rel.to_string_lossy().replace('\\', "/");
        if is_ignored_change_path(&rel_str) {
            continue;
        }
        let bf = baseline_dir.join(&rel_str);
        let new_marker = baseline_dir.join(format!("{}.__new__", rel_str));
        let file_name = rel
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| rel_str.clone());

        let is_legacy_empty_new = if bf.exists() {
            bf.metadata().map(|m| m.len() == 0).unwrap_or(false)
                && current_file.metadata().map(|m| m.len() > 0).unwrap_or(false)
        } else {
            false
        };

        if new_marker.exists() || !bf.exists() || is_legacy_empty_new {
            if !new_marker.exists() {
                if let Some(parent) = new_marker.parent() {
                    let _ = std::fs::create_dir_all(parent);
                }
                let _ = std::fs::write(&new_marker, b"");
            }
            if is_legacy_empty_new {
                let _ = std::fs::remove_file(&bf);
            }
            let after = extract_diffable_text(&current_file);
            if !after.trim().is_empty() {
                items.push(change_item(
                    &rel_str,
                    &file_name,
                    "new",
                    "",
                    &after,
                    crate::paths::now_ms(),
                ));
            }
        } else if let (Ok(before_bytes), Ok(after_bytes)) =
            (std::fs::read(&bf), std::fs::read(&current_file))
        {
            if before_bytes != after_bytes {
                let before = extract_diffable_text_from_bytes(&current_file, &before_bytes);
                let after = extract_diffable_text_from_bytes(&current_file, &after_bytes);
                if before != after {
                    let status = if before.trim().is_empty() {
                        "new"
                    } else {
                        "modified"
                    };
                    items.push(change_item(
                        &rel_str,
                        &file_name,
                        status,
                        &before,
                        &after,
                        crate::paths::now_ms(),
                    ));
                }
            }
        }
    }

    // 2. Supplement with active in-memory edits
    if let Ok(lock) = store.lock() {
        for (file, (before, after, ts)) in lock.iter() {
            if before == after || is_ignored_change_path(file) {
                continue;
            }
            let rel_norm = normalize_rel_file(&base_dir, file);
            if items.iter().any(|it| {
                let p = it.get("path").and_then(|v| v.as_str()).unwrap_or("");
                p.eq_ignore_ascii_case(file) || p.eq_ignore_ascii_case(&rel_norm)
            }) {
                continue;
            }
            let file_name = Path::new(&rel_norm)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| rel_norm.clone());
            let status = if before.trim().is_empty() {
                "new"
            } else {
                "modified"
            };
            items.push(change_item(&rel_norm, &file_name, status, before, after, *ts));
        }
    }

    // 3. Scan for any existing .bak files in the active workspace
    if let Ok(entries) = std::fs::read_dir(&base_dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if let Some(ext) = p.extension() {
                if ext == "bak" {
                    let orig_name = p.file_stem().and_then(|s| s.to_str()).unwrap_or("");
                    let orig_path = base_dir.join(orig_name);
                    if orig_path.exists() {
                        let rel_name = orig_name.to_string();
                        if !items
                            .iter()
                            .any(|it| it.get("path").and_then(|v| v.as_str()) == Some(&rel_name))
                        {
                            let before = extract_diffable_text(&p);
                            let after = extract_diffable_text(&orig_path);
                            if before != after {
                                items.push(change_item(
                                    &rel_name,
                                    &rel_name,
                                    "modified",
                                    &before,
                                    &after,
                                    crate::paths::now_ms(),
                                ));
                            }
                        }
                    }
                }
            }
        }
    }

    Json(json!({ "data": items })).into_response()
}

pub(crate) async fn handle_revert(
    Query(q): Query<HashMap<String, String>>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    let base_dir = resolve_base_dir(&q, &headers);
    let Some(raw_rel) = extract_req_path(&body, &q) else {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "path is required" })),
        )
            .into_response();
    };

    let file_rel = normalize_rel_file(&base_dir, raw_rel);
    let target_file = base_dir.join(&file_rel);
    let baseline_root = base_dir.join(".aetheria").join("baseline");
    let baseline_file = baseline_root.join(&file_rel);
    let new_marker = baseline_root.join(format!("{}.__new__", file_rel));
    let is_valid_baseline = contains_path(&baseline_root, &baseline_file);
    let bak_file = base_dir.join(format!("{}.bak", file_rel));

    // Case 1: Newly created file — reverting deletes the file from the working tree
    let is_empty_baseline = is_valid_baseline
        && baseline_file.exists()
        && baseline_file.metadata().map(|m| m.len() == 0).unwrap_or(false);
    if is_valid_baseline && (new_marker.exists() || is_empty_baseline) {
        if contains_path(&base_dir, &target_file) && target_file.exists() {
            let _ = std::fs::remove_file(&target_file);
        }
        let _ = std::fs::remove_file(&new_marker);
        let _ = std::fs::remove_file(&baseline_file);
        if bak_file.exists() {
            let _ = std::fs::remove_file(&bak_file);
        }
        remove_document_change(&file_rel);
        crate::session::message::emit_event(
            &base_dir.to_string_lossy(),
            "file.edited",
            json!({ "file": file_rel, "reverted": true, "deleted": true }),
        );
        return Json(json!({ "success": true, "path": file_rel, "deleted": true })).into_response();
    }

    // Case 2: Restore exact raw bytes from baseline_file or .bak (100% binary-safe for .xlsx/.docx/.pdf)
    let restored_bytes = if is_valid_baseline && baseline_file.exists() {
        std::fs::read(&baseline_file).ok()
    } else if bak_file.exists() {
        std::fs::read(&bak_file).ok()
    } else {
        let store = DOCUMENT_CHANGES.get_or_init(|| Mutex::new(HashMap::new()));
        let before_from_store = if let Ok(lock) = store.lock() {
            lock.get(&file_rel)
                .or_else(|| lock.get(raw_rel))
                .map(|(b, _, _)| b.as_bytes().to_vec())
        } else {
            None
        };
        before_from_store.or_else(|| {
            if !is_binary_doc_ext(&target_file) {
                body.get("beforeContent")
                    .and_then(|v| v.as_str())
                    .map(|s| s.as_bytes().to_vec())
            } else {
                None
            }
        })
    };

    if let Some(bytes) = restored_bytes {
        if contains_path(&base_dir, &target_file) {
            let _ = std::fs::write(&target_file, &bytes);
            if is_valid_baseline && !baseline_file.exists() {
                if let Some(parent) = baseline_file.parent() {
                    let _ = std::fs::create_dir_all(parent);
                }
                let _ = std::fs::write(&baseline_file, &bytes);
            }
        }
        if bak_file.exists() {
            let _ = std::fs::remove_file(&bak_file);
        }
        remove_document_change(&file_rel);
        crate::session::message::emit_event(
            &base_dir.to_string_lossy(),
            "file.edited",
            json!({ "file": file_rel, "reverted": true }),
        );
    } else {
        remove_document_change(&file_rel);
    }

    Json(json!({ "success": true, "path": file_rel })).into_response()
}

pub(crate) async fn handle_accept(
    Query(q): Query<HashMap<String, String>>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    let base_dir = resolve_base_dir(&q, &headers);
    let Some(raw_rel) = extract_req_path(&body, &q) else {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "path is required" })),
        )
            .into_response();
    };

    let file_rel = normalize_rel_file(&base_dir, raw_rel);
    let target_file = base_dir.join(&file_rel);

    // Only write plain text content for non-binary documents; binary docs (.xlsx, .docx, .pptx, .pdf)
    // already have their real binary bytes written to target_file on disk.
    if !is_binary_doc_ext(&target_file) {
        if let Some(content) = body.get("content").and_then(|v| v.as_str()) {
            if !content.is_empty() && contains_path(&base_dir, &target_file) {
                let _ = std::fs::write(&target_file, content);
            }
        }
    }

    let baseline_root = base_dir.join(".aetheria").join("baseline");
    let baseline_file = baseline_root.join(&file_rel);
    let new_marker = baseline_root.join(format!("{}.__new__", file_rel));
    if contains_path(&baseline_root, &baseline_file) {
        let _ = std::fs::remove_file(&new_marker);
        if target_file.exists() {
            if let Some(parent) = baseline_file.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            let _ = std::fs::copy(&target_file, &baseline_file);
        } else if baseline_file.exists() {
            let _ = std::fs::remove_file(&baseline_file);
        }
    }
    let bak_file = base_dir.join(format!("{}.bak", file_rel));
    if bak_file.exists() {
        let _ = std::fs::remove_file(&bak_file);
    }
    remove_document_change(&file_rel);

    Json(json!({ "success": true, "path": file_rel })).into_response()
}


//! Session CRUD & Message Query Axum HTTP Handlers.

use crate::files::urlencoding_decode;
use crate::paths::{gen_id, normalize_workspace_path, now_ms};
use axum::{
    extract::{Path as AxumPath, Query},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

use super::{
    canvas_extractor, default_model_ref, emit_event, save_store, stats, ui_mapper, with_store,
    ACTIVE_RUNS,
};

fn resolve_dir(q: &HashMap<String, String>, headers: &HeaderMap) -> String {
    if let Some(d) = q.get("directory").or_else(|| q.get("workspacePath")) {
        if !d.trim().is_empty() {
            return normalize_workspace_path(&urlencoding_decode(d));
        }
    }
    if let Some(h) = headers
        .get("x-aetheria-directory")
        .or_else(|| headers.get("x-opencode-directory"))
        .and_then(|v| v.to_str().ok())
    {
        if !h.trim().is_empty() {
            return normalize_workspace_path(&urlencoding_decode(h));
        }
    }
    std::env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .to_string_lossy()
        .to_string()
}

pub(crate) async fn handle_empty_list() -> Response {
    Json(json!([])).into_response()
}

pub(crate) async fn handle_list(
    Query(q): Query<HashMap<String, String>>,
    headers: HeaderMap,
) -> Response {
    let filter_dir = q
        .get("directory")
        .map(|d| normalize_workspace_path(&urlencoding_decode(d)).to_lowercase())
        .or_else(|| {
            headers
                .get("x-aetheria-directory")
                .or_else(|| headers.get("x-opencode-directory"))
                .and_then(|v| v.to_str().ok())
                .filter(|s| !s.trim().is_empty())
                .map(|d| normalize_workspace_path(&urlencoding_decode(d)).to_lowercase())
        });

    let limit = q
        .get("limit")
        .and_then(|s| s.parse::<usize>().ok())
        .unwrap_or(200)
        .clamp(1, 500);

    let list = with_store(|store| {
        let mut items: Vec<Value> = store
            .sessions
            .values()
            .filter(|s| {
                if let Some(ref fd) = filter_dir {
                    let s_dir = s
                        .pointer("/location/directory")
                        .or_else(|| s.get("directory"))
                        .and_then(|v| v.as_str())
                        .map(|d| normalize_workspace_path(d).to_lowercase())
                        .unwrap_or_default();
                    s_dir == *fd
                } else {
                    true
                }
            })
            .map(|s| {
                let mut obj = s.clone();
                let sid = obj.get("id").and_then(|v| v.as_str()).unwrap_or("");
                let (msg_count, short_preview) =
                    stats::compute_session_stats(store.messages.get(sid));
                obj["messageCount"] = json!(msg_count);
                obj["lastMessagePreview"] = Value::String(short_preview);
                obj
            })
            .collect();
        items.sort_by(|a, b| {
            let ta = a
                .pointer("/time/updated")
                .and_then(|v| v.as_u64())
                .unwrap_or(0);
            let tb = b
                .pointer("/time/updated")
                .and_then(|v| v.as_u64())
                .unwrap_or(0);
            tb.cmp(&ta)
        });
        if items.len() > limit {
            items.truncate(limit);
        }
        items
    });

    Json(json!({ "data": list, "cursor": {} })).into_response()
}

pub(crate) async fn handle_create(
    Query(q): Query<HashMap<String, String>>,
    headers: HeaderMap,
    body_bytes: axum::body::Bytes,
) -> Response {
    let body: Value = serde_json::from_slice(&body_bytes).unwrap_or_else(|_| json!({}));
    let dir = body
        .pointer("/location/directory")
        .or_else(|| body.get("directory"))
        .and_then(|v| v.as_str())
        .map(normalize_workspace_path)
        .unwrap_or_else(|| resolve_dir(&q, &headers));

    let target_dir = std::path::Path::new(&dir);
    if target_dir.exists() {
        let _ = std::fs::create_dir_all(target_dir.join("ref"));
        let _ = std::fs::create_dir_all(target_dir.join("src"));
        let _ = std::fs::create_dir_all(target_dir.join("public"));
        let _ = std::fs::create_dir_all(target_dir.join("output"));
    }

    let id = gen_id("ses");
    let now = now_ms();
    let model = body
        .get("model")
        .filter(|v| v.is_object())
        .cloned()
        .unwrap_or_else(default_model_ref);
    let agent = body
        .get("agent")
        .and_then(|v| v.as_str())
        .unwrap_or("default");
    let title = body
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("New Session");
    let permissions = body.get("permissions").cloned();

    let mut session = json!({
        "id": id,
        "projectID": "proj_default",
        "agent": agent,
        "model": model,
        "cost": 0,
        "tokens": {
            "input": 0,
            "output": 0,
            "reasoning": 0,
            "cache": { "read": 0, "write": 0 }
        },
        "time": {
            "created": now,
            "updated": now
        },
        "title": title,
        "directory": dir,
        "location": {
            "directory": dir
        }
    });
    if let Some(perms) = permissions {
        session["permissions"] = perms;
    }

    with_store(|store| {
        store.sessions.insert(id.clone(), session.clone());
        store.messages.entry(id.clone()).or_default();
        save_store(store);
    });

    emit_event(&dir, "session.created", json!({ "session": session }));
    Json(json!({ "data": session })).into_response()
}

pub(crate) async fn handle_active() -> Response {
    let m = ACTIVE_RUNS.get_or_init(|| Mutex::new(HashMap::new()));
    let mut data = serde_json::Map::new();
    if let Ok(guard) = m.lock() {
        for (sid, &running) in guard.iter() {
            if running {
                data.insert(sid.clone(), json!({ "type": "running" }));
            }
        }
    }
    Json(json!({ "data": data })).into_response()
}

pub(crate) async fn handle_get(AxumPath(id): AxumPath<String>) -> Response {
    let found = with_store(|store| store.sessions.get(&id).cloned());
    if let Some(s) = found {
        Json(json!({ "data": s })).into_response()
    } else {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": format!("Session not found: {}", id) })),
        )
            .into_response()
    }
}

pub(crate) async fn handle_patch(AxumPath(id): AxumPath<String>, Json(body): Json<Value>) -> Response {
    let updated = with_store(|store| {
        if let Some(s) = store.sessions.get_mut(&id) {
            if let Some(t) = body.get("title").and_then(|v| v.as_str()) {
                s["title"] = Value::String(t.to_string());
            }
            s["time"]["updated"] = json!(now_ms());
            let cloned = s.clone();
            save_store(store);
            Some(cloned)
        } else {
            None
        }
    });
    if let Some(s) = updated {
        Json(json!({ "data": s })).into_response()
    } else {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Session not found" })),
        )
            .into_response()
    }
}

pub(crate) async fn handle_delete(AxumPath(id): AxumPath<String>) -> Response {
    with_store(|store| {
        store.sessions.remove(&id);
        store.messages.remove(&id);
        save_store(store);
    });
    Json(json!({ "data": { "ok": true } })).into_response()
}

pub(crate) async fn handle_messages(
    AxumPath(id): AxumPath<String>,
    Query(q): Query<HashMap<String, String>>,
) -> Response {
    let mut msgs = with_store(|store| store.messages.get(&id).cloned().unwrap_or_default());
    let order = q.get("order").map(|s| s.as_str()).unwrap_or("desc");
    if order == "desc" {
        msgs.reverse();
    }
    let offset = q
        .get("cursor")
        .and_then(|s| s.parse::<usize>().ok())
        .unwrap_or(0);
    let limit = q
        .get("limit")
        .and_then(|s| s.parse::<usize>().ok())
        .unwrap_or(200)
        .clamp(1, 500);

    let format = q.get("format").map(|s| s.as_str()).unwrap_or("");
    let (slice, total): (Vec<Value>, usize) = if format == "ui" {
        let mapped = ui_mapper::map_messages_for_ui(&msgs);
        let mapped_len = mapped.len();
        let sl = if offset < mapped_len {
            let end = (offset + limit).min(mapped_len);
            mapped[offset..end].to_vec()
        } else {
            Vec::new()
        };
        (sl, mapped_len)
    } else {
        let msgs_len = msgs.len();
        let sl = if offset < msgs_len {
            let end = (offset + limit).min(msgs_len);
            msgs[offset..end].to_vec()
        } else {
            Vec::new()
        };
        (sl, msgs_len)
    };

    let next_cursor = if !slice.is_empty() && offset + slice.len() < total {
        Some((offset + slice.len()).to_string())
    } else {
        None
    };

    Json(json!({
        "data": slice,
        "total": total,
        "cursor": { "next": next_cursor }
    }))
    .into_response()
}

pub(crate) async fn handle_session_canvases(AxumPath(id): AxumPath<String>) -> Response {
    let (latest, recent) = with_store(|store| {
        let msgs = store.messages.get(&id);
        if let Some(m) = msgs {
            canvas_extractor::extract_session_canvases(m)
        } else {
            (None, Vec::new())
        }
    });

    Json(json!({
        "ok": true,
        "latestCanvasText": latest,
        "recentCanvases": recent
    }))
    .into_response()
}


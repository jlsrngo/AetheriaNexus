//! Knowledge graph store — wire-compatible with the TypeScript engine
//! (`packages/engine/engine/src/server/routes/instance/httpapi/handlers/knowledge.ts`).
//!
//! Storage: `{directory}/.aetheria/knowledge.json` = `{ nodes: [], edges: [], nextId }`.
//! Every response is wrapped as `{ data: ... }`. The active folder comes from the
//! `directory` query / `x-aetheria-directory` header; with no folder open the sandbox
//! folder `~/.aetheria/scratch` is used (same as the TS engine) instead of failing 400.

#[path = "knowledge_locations.rs"]
pub mod locations;
#[path = "knowledge_store.rs"]
pub mod store;
#[path = "knowledge_sync.rs"]
mod sync;

pub use store::get_active_knowledge_for_workspace;

use crate::paths::now_iso;
use axum::{
    extract::{Path as AxumPath, Query},
    http::HeaderMap,
    response::{IntoResponse, Response},
    routing::{delete, get, patch, post},
    Json, Router,
};
use serde_json::{json, Value};
use std::collections::HashMap;
use store::{id_of, is_visible, load, not_found, resolve_dir, save};
use sync::{handle_sync, handle_upload};

pub fn router() -> Router {
    Router::new()
        .route("/api/knowledge", get(handle_list).post(handle_create))
        .route("/knowledge", get(handle_list).post(handle_create))
        .route(
            "/api/knowledge/locations",
            get(locations::handle_search_locations),
        )
        .route(
            "/knowledge/locations",
            get(locations::handle_search_locations),
        )
        .route("/api/knowledge/upload", post(handle_upload))
        .route("/knowledge/upload", post(handle_upload))
        .route("/api/knowledge/sync", post(handle_sync))
        .route("/knowledge/sync", post(handle_sync))
        .route(
            "/api/knowledge/edges",
            get(handle_list_edges).post(handle_create_edge),
        )
        .route(
            "/knowledge/edges",
            get(handle_list_edges).post(handle_create_edge),
        )
        .route("/api/knowledge/edges/:id", delete(handle_delete_edge))
        .route("/knowledge/edges/:id", delete(handle_delete_edge))
        .route(
            "/api/knowledge/:id/position",
            patch(handle_update_pos).post(handle_update_pos),
        )
        .route(
            "/knowledge/:id/position",
            patch(handle_update_pos).post(handle_update_pos),
        )
        .route(
            "/api/knowledge/:id/toggle",
            patch(handle_toggle).post(handle_toggle),
        )
        .route(
            "/knowledge/:id/toggle",
            patch(handle_toggle).post(handle_toggle),
        )
        .route(
            "/api/knowledge/:id",
            get(handle_get)
                .patch(handle_update)
                .post(handle_update)
                .delete(handle_delete_node),
        )
        .route(
            "/knowledge/:id",
            get(handle_get)
                .patch(handle_update)
                .post(handle_update)
                .delete(handle_delete_node),
        )
}

async fn handle_list(Query(q): Query<HashMap<String, String>>, headers: HeaderMap) -> Response {
    let store = load(&resolve_dir(&q, &headers));
    let nodes: Vec<Value> = store.nodes.into_iter().filter(is_visible).collect();
    Json(json!({ "data": nodes })).into_response()
}

async fn handle_get(
    AxumPath(id): AxumPath<String>,
    Query(q): Query<HashMap<String, String>>,
    headers: HeaderMap,
) -> Response {
    let store = load(&resolve_dir(&q, &headers));
    match store.nodes.into_iter().find(|n| id_of(n) == id) {
        Some(n) => Json(json!({ "data": n })).into_response(),
        None => not_found("Node not found"),
    }
}

async fn handle_create(
    Query(q): Query<HashMap<String, String>>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    let dir = resolve_dir(&q, &headers);
    let mut store = load(&dir);
    let id = format!("node-{}", store.next_id);
    store.next_id += 1;
    let s = |k: &str, d: &str| body.get(k).and_then(|v| v.as_str()).unwrap_or(d).to_string();
    let node = json!({
        "id": id,
        "title": s("title", "Untitled"),
        "content": s("content", ""),
        "type": s("type", "note"),
        "active": true,
        "positionX": body.get("positionX").and_then(|v| v.as_f64()).unwrap_or(200.0),
        "positionY": body.get("positionY").and_then(|v| v.as_f64()).unwrap_or(200.0),
        "nodeColor": s("nodeColor", "#3B82F6"),
        "icon": s("icon", "file-text"),
        "city": "",
        "urls": "[]",
        "createdAt": now_iso()
    });
    store.nodes.push(node.clone());
    save(&dir, &store);
    Json(json!({ "data": node })).into_response()
}

async fn handle_update(
    AxumPath(id): AxumPath<String>,
    Query(q): Query<HashMap<String, String>>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    let dir = resolve_dir(&q, &headers);
    let mut store = load(&dir);
    let Some(node) = store.nodes.iter_mut().find(|n| id_of(n) == id) else {
        return not_found("Node not found");
    };
    if let Some(t) = body.get("title").and_then(|v| v.as_str()) {
        node["title"] = json!(t);
    }
    let mut content = body
        .get("content")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if content.trim() == "Enter knowledge content here..."
        || content.contains("JavaScript tidak diaktifkan")
    {
        content.clear();
    }
    node["content"] = json!(content);
    let urls = body.get("urls").cloned().unwrap_or_else(|| json!([]));
    node["urls"] = json!(serde_json::to_string(&urls).unwrap_or_else(|_| "[]".into()));
    node["city"] = json!(body.get("city").and_then(|v| v.as_str()).unwrap_or(""));
    let updated = node.clone();
    save(&dir, &store);
    Json(json!({ "data": updated })).into_response()
}

async fn handle_delete_node(
    AxumPath(id): AxumPath<String>,
    Query(q): Query<HashMap<String, String>>,
    headers: HeaderMap,
) -> Response {
    let dir = resolve_dir(&q, &headers);
    let mut store = load(&dir);
    if !store.nodes.iter().any(|n| id_of(n) == id) {
        return not_found("Node not found");
    }
    store.nodes.retain(|n| id_of(n) != id);
    store.edges.retain(|e| {
        e.get("sourceId").and_then(|v| v.as_str()) != Some(&id)
            && e.get("targetId").and_then(|v| v.as_str()) != Some(&id)
    });
    save(&dir, &store);
    Json(json!({ "data": {} })).into_response()
}

async fn handle_update_pos(
    AxumPath(id): AxumPath<String>,
    Query(q): Query<HashMap<String, String>>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    let dir = resolve_dir(&q, &headers);
    let mut store = load(&dir);
    let Some(node) = store.nodes.iter_mut().find(|n| id_of(n) == id) else {
        return not_found("Node not found");
    };
    node["positionX"] = json!(body.get("positionX").and_then(|v| v.as_f64()).unwrap_or(0.0));
    node["positionY"] = json!(body.get("positionY").and_then(|v| v.as_f64()).unwrap_or(0.0));
    let updated = node.clone();
    save(&dir, &store);
    Json(json!({ "data": updated })).into_response()
}

async fn handle_toggle(
    AxumPath(id): AxumPath<String>,
    Query(q): Query<HashMap<String, String>>,
    headers: HeaderMap,
) -> Response {
    let dir = resolve_dir(&q, &headers);
    let mut store = load(&dir);
    let Some(node) = store.nodes.iter_mut().find(|n| id_of(n) == id) else {
        return not_found("Node not found");
    };
    let active = node.get("active").and_then(|v| v.as_bool()).unwrap_or(true);
    node["active"] = json!(!active);
    let updated = node.clone();
    save(&dir, &store);
    Json(json!({ "data": updated })).into_response()
}

async fn handle_list_edges(
    Query(q): Query<HashMap<String, String>>,
    headers: HeaderMap,
) -> Response {
    let store = load(&resolve_dir(&q, &headers));
    let visible: std::collections::HashSet<String> = store
        .nodes
        .iter()
        .filter(|n| is_visible(n))
        .map(|n| id_of(n).to_string())
        .collect();
    let edges: Vec<Value> = store
        .edges
        .into_iter()
        .filter(|e| {
            let s = e.get("sourceId").and_then(|v| v.as_str()).unwrap_or("");
            let t = e.get("targetId").and_then(|v| v.as_str()).unwrap_or("");
            visible.contains(s) && visible.contains(t)
        })
        .collect();
    Json(json!({ "data": edges })).into_response()
}

async fn handle_create_edge(
    Query(q): Query<HashMap<String, String>>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    let dir = resolve_dir(&q, &headers);
    let mut store = load(&dir);
    let id = format!("edge-{}", store.next_id);
    store.next_id += 1;
    let mut edge = json!({
        "id": id,
        "sourceId": body.get("sourceId").and_then(|v| v.as_str()).unwrap_or(""),
        "targetId": body.get("targetId").and_then(|v| v.as_str()).unwrap_or(""),
    });
    if let Some(l) = body.get("label").and_then(|v| v.as_str()) {
        edge["label"] = json!(l);
    }
    store.edges.push(edge.clone());
    save(&dir, &store);
    Json(json!({ "data": edge })).into_response()
}

async fn handle_delete_edge(
    AxumPath(id): AxumPath<String>,
    Query(q): Query<HashMap<String, String>>,
    headers: HeaderMap,
) -> Response {
    let dir = resolve_dir(&q, &headers);
    let mut store = load(&dir);
    if !store.edges.iter().any(|e| id_of(e) == id) {
        return not_found("Edge not found");
    }
    store.edges.retain(|e| id_of(e) != id);
    save(&dir, &store);
    Json(json!({ "data": {} })).into_response()
}

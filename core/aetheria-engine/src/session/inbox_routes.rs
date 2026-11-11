//! Runtime Inbox, Jobs, and Prompt Dispatch Axum HTTP Adapters.

use axum::{
    extract::{Path as AxumPath, Query},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde_json::{json, Value};
use std::collections::HashMap;

use super::{coordinator, handle_prompt, job_registry};

pub(crate) async fn handle_get_inbox(AxumPath(id): AxumPath<String>) -> Response {
    let items = coordinator::list_inbox_items(&id);
    Json(json!({ "ok": true, "data": items })).into_response()
}

pub(crate) async fn handle_post_inbox(
    AxumPath(id): AxumPath<String>,
    Json(body): Json<Value>,
) -> Response {
    let text = body
        .get("text")
        .or_else(|| body.pointer("/prompt/text"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim();
    if text.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Inbox text cannot be empty" })),
        )
            .into_response();
    }
    let delivery_str = body
        .get("delivery")
        .and_then(|v| v.as_str())
        .unwrap_or("steer");
    let delivery = if delivery_str.eq_ignore_ascii_case("queue") {
        coordinator::InboxDelivery::Queue
    } else {
        coordinator::InboxDelivery::Steer
    };
    let item = coordinator::admit_inbox_item(&id, text, delivery);
    Json(json!({ "ok": true, "data": item })).into_response()
}

pub(crate) async fn handle_get_jobs(AxumPath(id): AxumPath<String>) -> Response {
    let jobs = job_registry::list_session_jobs(&id);
    Json(json!({ "ok": true, "data": jobs })).into_response()
}

pub(crate) async fn handle_prompt_route(
    axum_path: AxumPath<String>,
    Query(q): Query<HashMap<String, String>>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    handle_prompt(axum_path, q, headers, body).await
}


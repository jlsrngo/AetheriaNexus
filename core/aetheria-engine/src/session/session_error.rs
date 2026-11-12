//! Canonical Session Error Taxonomy & Event Helper — mirrors `packages/core/src/session/to-session-error.ts`.
//! Maps raw provider or transport error strings into structured UI-safe error categories
//! and emits canonical `session.error` events.

use serde_json::{json, Value};

use super::message::emit_event;
use super::provider_error::classify_provider_failure;

pub fn classify_session_error(status_code: Option<u16>, raw_error: &str) -> Value {
    let lower = raw_error.to_lowercase();

    if lower.contains("interrupted") || lower.contains("aborted") || lower.contains("cancelled") {
        return json!({
            "type": "aborted",
            "category": "aborted",
            "retryable": false,
            "status": status_code,
            "message": raw_error
        });
    }

    if status_code.is_none() && (lower.contains("timed out") || lower.contains("timeout")) {
        return json!({
            "type": "provider.timeout",
            "category": "provider.timeout",
            "retryable": true,
            "status": status_code,
            "message": raw_error
        });
    }

    if status_code.is_none()
        && (lower.contains("connection refused")
            || lower.contains("enotfound")
            || lower.contains("failed to reach ai provider")
            || lower.contains("network"))
    {
        return json!({
            "type": "provider.transport",
            "category": "provider.transport",
            "retryable": true,
            "status": status_code,
            "message": raw_error
        });
    }

    let classified = classify_provider_failure(status_code, raw_error);
    json!({
        "type": classified.category,
        "category": classified.category,
        "classification": classified.classification,
        "retryable": classified.retryable,
        "status": classified.status,
        "message": classified.message
    })
}

pub fn emit_session_error(
    workspace_dir: &str,
    session_id: &str,
    message_id: &str,
    category: &str,
    message: &str,
    retryable: bool,
    status: Option<u16>,
) {
    emit_event(
        workspace_dir,
        "session.error",
        json!({
            "sessionID": session_id,
            "messageID": message_id,
            "category": category,
            "retryable": retryable,
            "status": status,
            "error": {
                "type": category,
                "message": message
            }
        }),
    );
}

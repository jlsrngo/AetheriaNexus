//! Canonical Session Error Taxonomy — mirrors `packages/core/src/session/runner/to-session-error.ts`.
//! Maps raw provider or transport error strings into structured UI-safe error categories.

use serde_json::{json, Value};

pub fn classify_session_error(status_code: Option<u16>, raw_error: &str) -> Value {
    let lower = raw_error.to_lowercase();
    let code = status_code.unwrap_or(0);

    let (error_type, retryable) = if lower.contains("interrupted")
        || lower.contains("aborted")
        || lower.contains("cancelled")
    {
        ("aborted", false)
    } else if code == 401
        || code == 403
        || lower.contains("invalid api key")
        || lower.contains("unauthorized")
    {
        ("provider.auth", false)
    } else if lower.contains("insufficient_quota")
        || lower.contains("credit balance is too low")
        || lower.contains("billing")
    {
        ("provider.quota", false)
    } else if code == 429 || lower.contains("rate limit") || lower.contains("too many requests") {
        ("provider.rate-limit", true)
    } else if lower.contains("content_filter") || lower.contains("safety") {
        ("provider.content-filter", false)
    } else if code == 408 || lower.contains("timed out") || lower.contains("timeout") {
        ("provider.timeout", true)
    } else if lower.contains("connection refused")
        || lower.contains("enotfound")
        || lower.contains("network")
    {
        ("provider.transport", true)
    } else {
        ("provider.internal", true)
    };

    json!({
        "type": error_type,
        "retryable": retryable,
        "status": status_code,
        "message": raw_error
    })
}


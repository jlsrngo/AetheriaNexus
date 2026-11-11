//! Exponential Retry Backoff, Jitter & Network Classification — mirrors `packages/core/src/model-retry.ts`
//! and `packages/core/src/session/runner/retry.ts`.

use crate::paths::now_ms;

/// Maximum retry attempts specifically for request timeouts (`packages/core/src/session/runner/retry.ts`).
pub const MAX_TIMEOUT_RETRIES: usize = 3;

/// Synthetic continuation prompt injected when a model response is truncated by `max_tokens` (`finish_reason == "length"`).
pub const SYNTHETIC_OUTPUT_LIMIT_PROMPT: &str =
    "Your last response hit the output token limit (stop reason: length). \
     Do not apologize, recap, or repeat yourself. Continue exactly from where you left off, \
     and break the remaining work into smaller pieces.";

/// Detects whether a transport error indicates a temporarily unreachable network, DNS outage, or offline interface.
pub fn is_unreachable_network_error(err_text: &str) -> bool {
    let lower = err_text.to_lowercase();
    lower.contains("enotfound")
        || lower.contains("eai_again")
        || lower.contains("enetunreach")
        || lower.contains("ehostunreach")
        || lower.contains("enetdown")
        || lower.contains("dns error")
        || lower.contains("failed to lookup address")
        || lower.contains("connection refused")
        || lower.contains("os error 10061")
        || lower.contains("os error 10051")
        || lower.contains("os error 10065")
}

/// Detects whether an error is a request/gateway timeout (`408`, `504`, `ETIMEDOUT`, `timed out`).
pub fn is_timeout_error(err_text: &str) -> bool {
    let lower = err_text.to_lowercase();
    lower.contains("timed out")
        || lower.contains("timeout")
        || lower.contains("etimedout")
        || lower.contains("deadline has elapsed")
        || lower.contains("http 408")
        || lower.contains("http 504")
}

/// Computes exponential backoff with deterministic pseudo-jitter (mirrors OpenCode `model-retry.ts`).
pub fn compute_retry_backoff_ms(
    attempt: usize,
    is_unreachable: bool,
    retry_after_header: Option<&str>,
) -> u64 {
    if let Some(raw_header) = retry_after_header {
        if let Ok(secs) = raw_header.trim().parse::<u64>() {
            return (secs.saturating_mul(1000)).clamp(1_000, 900_000);
        }
    }

    let shift = attempt.saturating_sub(1).min(5) as u32;
    let exp_ms = 2_000u64.saturating_mul(1u64 << shift);
    let cap_ms = if is_unreachable { 30_000 } else { 10_000 };
    let base_ms = exp_ms.min(cap_ms);

    let jitter_ms = now_ms() % 450;
    base_ms + jitter_ms
}


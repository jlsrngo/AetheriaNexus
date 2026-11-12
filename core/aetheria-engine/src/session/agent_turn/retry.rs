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

/// Parses `Retry-After-Ms` or `Retry-After` headers (mirroring OpenCode `executor.ts` & `model-retry.ts`),
/// clamping waits to at most 15 minutes (900,000 ms).
pub fn parse_retry_after_ms(
    retry_after_ms_header: Option<&str>,
    retry_after_header: Option<&str>,
) -> Option<u64> {
    const RETRY_AFTER_MAX_MS: u64 = 900_000;

    if let Some(raw_ms) = retry_after_ms_header {
        if let Ok(ms) = raw_ms.trim().parse::<f64>() {
            if ms.is_finite() && ms >= 0.0 {
                return Some((ms.ceil() as u64).clamp(1_000, RETRY_AFTER_MAX_MS));
            }
        }
    }

    if let Some(raw_secs) = retry_after_header {
        if let Ok(secs) = raw_secs.trim().parse::<f64>() {
            if secs.is_finite() && secs >= 0.0 {
                return Some(((secs * 1000.0).ceil() as u64).clamp(1_000, RETRY_AFTER_MAX_MS));
            }
        }
    }

    None
}

/// Computes exponential backoff with deterministic pseudo-jitter (mirrors OpenCode `model-retry.ts`).
pub fn compute_retry_backoff_ms(
    attempt: usize,
    is_unreachable: bool,
    retry_after_header: Option<&str>,
) -> u64 {
    if let Some(ms) = parse_retry_after_ms(None, retry_after_header) {
        return ms;
    }

    let shift = attempt.saturating_sub(1).min(5) as u32;
    let exp_ms = 2_000u64.saturating_mul(1u64 << shift);
    let cap_ms = if is_unreachable { 30_000 } else { 10_000 };
    let base_ms = exp_ms.min(cap_ms);

    let jitter_ms = now_ms() % 450;
    base_ms + jitter_ms
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_retry_after_supports_ms_and_fractional_seconds() {
        assert_eq!(parse_retry_after_ms(Some("2500"), None), Some(2_500));
        assert_eq!(parse_retry_after_ms(None, Some("1.5")), Some(1_500));
        assert_eq!(parse_retry_after_ms(None, Some("1200")), Some(900_000));
        assert_eq!(parse_retry_after_ms(Some("invalid"), Some("bad")), None);
    }

    #[test]
    fn compute_backoff_respects_caps_and_retry_after() {
        assert_eq!(compute_retry_after_header_passthrough(), 4_000);
        let d1 = compute_retry_backoff_ms(1, false, None);
        let d3 = compute_retry_backoff_ms(3, false, None);
        let d4 = compute_retry_backoff_ms(4, false, None);
        assert!((2_000..=2_450).contains(&d1));
        assert!((8_000..=8_450).contains(&d3));
        assert!((10_000..=10_450).contains(&d4));
        let u5 = compute_retry_backoff_ms(5, true, None);
        assert!((30_000..=30_450).contains(&u5));
    }

    fn compute_retry_after_header_passthrough() -> u64 {
        compute_retry_backoff_ms(1, false, Some("4"))
    }
}


//! Provider Error Classification — mirrors OpenCode `packages/ai/src/provider-error.ts`
//! and `OVERFLOW_EXCLUSIONS`.
//!
//! Distinguishes true context-window exhaustion (eligible for emergency compaction)
//! from rate-limit / quota / billing throttles (which must trigger backoff or key rotation).

/// Detects whether an error message from an AI provider represents a rate-limit / quota throttle
/// that must NOT be misclassified as a context window overflow (mirrors OpenCode `OVERFLOW_EXCLUSIONS`).
pub fn is_rate_limit_exclusion(error_text: &str) -> bool {
    let lower = error_text.to_lowercase();
    lower.contains("too many tokens, please wait")
        || lower.contains("tokens per minute")
        || lower.contains("tpm limit")
        || lower.contains("rate_limit_exceeded")
        || lower.contains("requests per minute")
}

/// Detects whether an error message from an AI provider represents a context length or token overflow.
/// Mirrors the 40+ provider patterns from OpenCode `packages/ai/src/provider-error.ts`.
pub fn is_context_overflow_error(error_text: &str) -> bool {
    if is_rate_limit_exclusion(error_text) {
        return false;
    }
    let lower = error_text.to_lowercase();
    lower.contains("context_length_exceeded")
        || lower.contains("context length exceeded")
        || lower.contains("maximum context length")
        || lower.contains("prompt is too long")
        || lower.contains("prompt_too_long")
        || lower.contains("input is too long for requested model")
        || lower.contains("exceeds the context window")
        || lower.contains("context window exceeds limit")
        || lower.contains("model_context_window_exceeded")
        || lower.contains("maximum prompt length is")
        || lower.contains("reduce the length of the messages")
        || lower.contains("reduce the length of the prompt")
        || lower.contains("exceeds the limit of")
        || lower.contains("exceeds the available context size")
        || lower.contains("greater than the context length")
        || lower.contains("exceeded model token limit")
        || lower.contains("max_tokens_exceeded")
        || lower.contains("too many tokens")
        || lower.contains("token limit exceeded")
        || lower.contains("tokens exceed")
        || lower.contains("context window")
        || lower.contains("exceeds the context limit")
        || lower.contains("exceeds the maximum context")
        || lower.contains("input tokens exceed the configured limit")
        || lower.contains("request_too_large")
        || lower.contains("request entity too large")
        || lower.contains("payload too large")
        || lower.contains("string too long")
        || lower.contains("error decoding response body")
        || lower.contains("stream read error")
        || (lower.contains("input token count") && lower.contains("exceeds the maximum"))
        || (lower.contains("cannot be longer than") && lower.contains("tokens"))
        || (lower.contains("total tokens") && lower.contains("exceed"))
        || ((lower.contains("400") || lower.contains("413"))
            && (lower.contains("context") || lower.contains("token") || lower.contains("too large")))
}

/// Detects whether an HTTP status and error body indicate a quota exhaustion or rate-limit error.
pub fn is_quota_or_rate_limit_error(status_code: u16, error_text: &str) -> bool {
    let lower = error_text.to_lowercase();
    status_code == 429
        || status_code == 402
        || status_code == 403
        || lower.contains("insufficient_quota")
        || lower.contains("rate limit")
        || lower.contains("rate_limit")
        || lower.contains("quota exceeded")
        || lower.contains("billing")
        || lower.contains("credit balance is too low")
        || lower.contains("resource_exhausted")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_context_overflow_detection() {
        assert!(is_context_overflow_error("Error 400: context_length_exceeded"));
        assert!(is_context_overflow_error("This model's maximum context length is 128000 tokens"));
        assert!(is_context_overflow_error("prompt is too long: 200000 tokens"));
        assert!(is_context_overflow_error("token limit exceeded"));
        assert!(is_context_overflow_error("The input token count (150000) exceeds the maximum number of tokens allowed"));
        assert!(is_context_overflow_error("HTTP 413 Request Entity Too Large"));
        assert!(is_context_overflow_error("Please reduce the length of the messages or completion"));
        // Rate limit exclusion must NOT trigger context compaction
        assert!(!is_context_overflow_error("Too many tokens, please wait 60 seconds before retrying"));
        assert!(!is_context_overflow_error("Rate limit reached for tokens per minute (TPM)"));
        assert!(!is_context_overflow_error("Error 401: Invalid API Key"));
        assert!(!is_context_overflow_error("Network timeout connecting to server"));
    }
}


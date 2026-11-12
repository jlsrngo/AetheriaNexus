//! Provider Error Classification — mirrors OpenCode `packages/ai/src/provider-error.ts`
//! and `OVERFLOW_EXCLUSIONS`.
//!
//! Classifies provider HTTP and stream failures in exact OpenCode priority order:
//! context-overflow -> payload-too-large -> content-policy -> quota -> auth ->
//! rate-limit -> provider-internal -> invalid-request -> unknown.

use serde_json::Value;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProviderErrorKind {
    ContextOverflow,
    PayloadTooLarge,
    ContentPolicy,
    QuotaExceeded,
    Authentication,
    RateLimit,
    ProviderInternal,
    InvalidRequest,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ClassifiedProviderError {
    pub kind: ProviderErrorKind,
    pub category: &'static str,
    pub classification: Option<&'static str>,
    pub retryable: bool,
    pub message: String,
    pub status: Option<u16>,
}

const QUOTA_CODES: &[&str] = &[
    "insufficient_quota",
    "usage_not_included",
    "billing_error",
    "gousagelimiterror",
    "budgetlimiterror",
    "freeusagelimiterror",
    "creditlimitexceeded",
];

const AUTH_CODES: &[&str] = &[
    "authentication_error",
    "permission_error",
    "permission_denied",
    "api_key_invalid",
];

const SERVER_CODES: &[&str] = &[
    "api_error",
    "internal_error",
    "internalserverexception",
    "modelstreamerrorexception",
    "overloaded_error",
    "server_error",
    "server_is_overloaded",
    "slow_down",
    "serviceunavailableexception",
];

const INVALID_REQUEST_CODES: &[&str] = &[
    "model_not_found",
    "invalid_prompt",
    "invalid_request",
    "invalid_request_error",
    "validationexception",
];

const CONTENT_POLICY_CODES: &[&str] = &[
    "content_filter",
    "content_moderation",
    "responsibleaipolicyviolation",
    "content_policy_violation",
    "image_content_policy_violation",
    "refusal",
    "datainspectionfailed",
    "moderation_blocked",
    "safety",
    "prohibited_content",
    "blocklist",
    "image_safety",
    "content_blocked",
];

/// Extracts human-readable error message from common JSON error response layouts.
pub fn extract_provider_error_message(raw_body: &str) -> String {
    let trimmed = raw_body.trim();
    if let Ok(val) = serde_json::from_str::<Value>(trimmed) {
        let candidate = val
            .pointer("/error/message")
            .and_then(|v| v.as_str())
            .or_else(|| val.get("error").and_then(|v| v.as_str()))
            .or_else(|| val.get("message").and_then(|v| v.as_str()))
            .or_else(|| val.get("Message").and_then(|v| v.as_str()))
            .or_else(|| val.get("detail").and_then(|v| v.as_str()))
            .or_else(|| val.pointer("/errors/0/message").and_then(|v| v.as_str()));
        if let Some(msg) = candidate.map(str::trim).filter(|s| !s.is_empty()) {
            return msg.to_string();
        }
    }
    trimmed.to_string()
}

fn collect_codes(raw_body: &str, message: &str) -> Vec<String> {
    let mut codes = Vec::new();
    let mut push_code = |s: &str| {
        let lower = s.trim().to_ascii_lowercase();
        if !lower.is_empty() && !codes.contains(&lower) {
            codes.push(lower);
        }
    };

    for candidate_src in [raw_body, message] {
        if let Ok(val) = serde_json::from_str::<Value>(candidate_src.trim()) {
            for ptr in [
                "/error/code",
                "/error/type",
                "/error/error_type",
                "/error/innererror/code",
                "/error/details/0/reason",
                "/code",
                "/type",
                "/error_type",
                "/errors/0/code",
                "/errors/0/type",
            ] {
                if let Some(s) = val.pointer(ptr).and_then(|v| v.as_str()) {
                    push_code(s);
                }
            }
        }
    }
    codes
}

/// Detects whether an error message from an AI provider represents a rate-limit / quota throttle
/// that must NOT be misclassified as a context window overflow (mirrors OpenCode exclusions).
pub fn is_rate_limit_exclusion(error_text: &str) -> bool {
    let lower = error_text.to_lowercase();
    lower.starts_with("throttling error:")
        || lower.starts_with("service unavailable:")
        || lower.contains("too many tokens, please wait")
        || lower.contains("too many tokens per day, please wait")
        || lower.contains("tokens per minute")
        || lower.contains("tpm limit")
        || lower.contains("rate_limit_exceeded")
        || lower.contains("rate limit")
        || lower.contains("too many requests")
        || lower.contains("requests per minute")
        || lower.contains("max_tokens must be less than")
        || lower.contains("max tokens must be less than")
}

fn has_context_window_overflow_phrase(lower: &str) -> bool {
    lower.contains("context_length_exceeded")
        || lower.contains("context length exceeded")
        || lower.contains("maximum context length")
        || lower.contains("prompt is too long")
        || lower.contains("prompt_too_long")
        || lower.contains("prompt exceeds max length")
        || lower.contains("prompt 超长")
        || lower.contains("input is too long for requested model")
        || lower.contains("input is too long for the requested model")
        || lower.contains("input is too long for selected model")
        || lower.contains("input is too long for the selected model")
        || lower.contains("too large for the model's configured input limit")
        || lower.contains("too large for the models configured input limit")
        || lower.contains("exceeded this model context window limit")
        || lower.contains("exceeds the context window")
        || lower.contains("exceeds the model's maximum context length")
        || lower.contains("exceeds maximum context length")
        || lower.contains("number of input tokens exceeds maximum length")
        || lower.contains("tokens in request more than max tokens allowed")
        || lower.contains("context window exceeds limit")
        || lower.contains("context window exceeded")
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
        || lower.contains("range of input length should be")
        || (lower.contains("input token count") && lower.contains("exceeds the maximum"))
        || (lower.contains("requested input length") && lower.contains("exceeds maximum input length"))
        || (lower.contains("exceeds") && lower.contains("maximum allowed input length"))
        || (lower.contains("is longer than the model") && lower.contains("context length"))
        || (lower.contains("too large for model with") && lower.contains("maximum context length"))
        || (lower.contains("cannot be longer than") && lower.contains("tokens"))
        || (lower.contains("total tokens") && lower.contains("exceed"))
        || ((lower.contains("400") || lower.contains("413"))
            && (lower.contains("(no body)") || lower.contains("context") || lower.contains("token")))
}

/// Detects whether an error message from an AI provider represents a context length or token overflow.
/// Mirrors the patterns from OpenCode `packages/ai/src/provider-error.ts`.
pub fn is_context_overflow_error(error_text: &str) -> bool {
    if is_rate_limit_exclusion(error_text) {
        return false;
    }
    let lower = error_text.to_lowercase();
    has_context_window_overflow_phrase(&lower)
        || lower.contains("request entity too large")
        || lower.contains("payload too large")
        || lower.contains("string too long")
        || lower.contains("error decoding response body")
        || lower.contains("stream read error")
        || ((lower.contains("400") || lower.contains("413")) && lower.contains("too large"))
}

fn is_payload_too_large_text(lower: &str) -> bool {
    lower.contains("request entity too large")
        || lower.contains("payload too large")
        || lower.contains("request too large")
}

fn is_content_policy_text(lower: &str) -> bool {
    lower.contains("violating our usage policy")
        || lower.contains("violates usage policy")
        || lower.contains("blocked by content filtering policy")
        || lower.contains("content_policy")
        || lower.contains("content-policy")
        || lower.contains("content policy")
        || lower.contains("content_filter")
        || lower.contains("content-filter")
        || lower.contains("rejected as a result of our safety system")
        || lower.contains("rejected by the safety system")
        || lower.contains("detected potentially unsafe or sensitive content")
}

fn is_rate_limit_text(lower: &str) -> bool {
    lower.contains("rate increased too quickly")
        || lower.contains("rate_limit")
        || lower.contains("rate-limit")
        || lower.contains("rate limit")
        || lower.contains("too many requests")
        || lower.contains("too_many_requests")
}

fn is_server_error_text(lower: &str) -> bool {
    lower.contains("try again")
        || lower.contains("retry the request")
        || lower.contains("retry this request")
        || lower.contains("retry your request")
        || lower.contains("at capacity")
        || lower.contains("overloaded")
        || lower.contains("temporarily unavailable")
        || lower.contains("service unavailable")
        || lower.contains("service-unavailable")
        || lower.contains("service_unavailable")
        || lower.contains("server error")
        || lower.contains("internal error")
        || lower.contains("server is busy")
        || lower.contains("server busy")
        || lower.contains("provider returned an error")
        || lower.contains("provider returned error")
        || lower.contains("resource_exhausted")
        || lower.contains("resource exhausted")
        || lower.contains("upstream connect")
        || lower.contains("upstream connection")
        || lower.contains("upstream request")
}

/// Detects hard monthly/balance/credit exhaustion where retrying the same key cannot succeed.
/// Mirrors OpenCode `provider-error.ts`: throttling phrases like `rate limit exhausted` or
/// `token_quota_exceeded` remain retryable `RateLimit` bursts instead of false hard quota failover.
pub fn is_hard_quota_exhausted(status_code: u16, error_text: &str) -> bool {
    let lower = error_text.to_lowercase();
    let is_rate_throttle_phrase = lower.contains("token_quota_exceeded")
        || lower.contains("rate limit exhausted")
        || lower.contains("rate_limit_exhausted")
        || lower.contains("rate-limit exhausted");
    if is_rate_throttle_phrase {
        return false;
    }
    status_code == 402
        || lower.contains("insufficient_quota")
        || lower.contains("monthly_request_count")
        || lower.contains("insufficient balance")
        || lower.contains("insufficient_balance")
        || lower.contains("credit balance is too low")
        || (lower.contains("quota exceeded") && !lower.contains("token_quota_exceeded"))
        || lower.contains("quota_exceeded")
        || lower.contains("quota limit reached")
        || lower.contains("budget exceeded")
        || lower.contains("package has expired")
        || lower.contains("plan does not yet include")
        || lower.contains("billing")
}

/// Detects temporary per-second/per-minute burst throttling (HTTP 429 / AWS ThrottlingException)
/// that should be retried with backoff before ever failing over to another provider.
pub fn is_rate_limit_throttle(status_code: u16, error_text: &str) -> bool {
    if is_hard_quota_exhausted(status_code, error_text) {
        return false;
    }
    let lower = error_text.to_lowercase();
    status_code == 429
        || lower.contains("too many requests")
        || lower.contains("throttl")
        || lower.contains("rate limit")
        || lower.contains("rate_limit")
        || lower.contains("resource_exhausted")
        || lower.contains("tokens per minute")
        || lower.contains("tpm limit")
        || lower.contains("requests per minute")
}

/// Detects whether an HTTP status and error body indicate a quota exhaustion or rate-limit error.
pub fn is_quota_or_rate_limit_error(status_code: u16, error_text: &str) -> bool {
    is_hard_quota_exhausted(status_code, error_text)
        || is_rate_limit_throttle(status_code, error_text)
}

/// Ordered 9-category failure classifier mirroring OpenCode `classifyProviderFailure`.
pub fn classify_provider_failure(status: Option<u16>, raw_body: &str) -> ClassifiedProviderError {
    let message = extract_provider_error_message(raw_body);
    let combined = if message.is_empty() || raw_body.trim() == message {
        raw_body.to_string()
    } else {
        format!("{}\n{}", message, raw_body)
    };
    let lower = combined.to_lowercase();
    let msg_lower = message.to_lowercase();
    let codes = collect_codes(raw_body, &message);
    let client_scoped = status.map(|s| (400..500).contains(&s)).unwrap_or(true);

    let has_overflow_code = codes.iter().any(|c| {
        matches!(
            c.as_str(),
            "context_length_exceeded" | "model_context_window_exceeded" | "request_too_large"
        )
    });
    let overflow_text_match = status != Some(429)
        && !codes.iter().any(|c| c == "throttlingexception")
        && !is_rate_limit_exclusion(&combined)
        && has_context_window_overflow_phrase(&lower);

    if client_scoped && (has_overflow_code || overflow_text_match) {
        return ClassifiedProviderError {
            kind: ProviderErrorKind::ContextOverflow,
            category: "provider.invalid-request",
            classification: Some("context-overflow"),
            retryable: false,
            message,
            status,
        };
    }

    if status == Some(413) || is_payload_too_large_text(&lower) {
        return ClassifiedProviderError {
            kind: ProviderErrorKind::PayloadTooLarge,
            category: "provider.invalid-request",
            classification: Some("payload-too-large"),
            retryable: false,
            message,
            status,
        };
    }

    if codes
        .iter()
        .any(|c| CONTENT_POLICY_CODES.contains(&c.as_str()))
        || (client_scoped && is_content_policy_text(&msg_lower))
    {
        return ClassifiedProviderError {
            kind: ProviderErrorKind::ContentPolicy,
            category: "provider.content-filter",
            classification: Some("content-policy"),
            retryable: false,
            message,
            status,
        };
    }

    if status == Some(402)
        || codes.iter().any(|c| QUOTA_CODES.contains(&c.as_str()))
        || (status == Some(429) && is_hard_quota_exhausted(429, &combined))
        || (status.is_none() && is_hard_quota_exhausted(0, &combined))
    {
        return ClassifiedProviderError {
            kind: ProviderErrorKind::QuotaExceeded,
            category: "provider.quota",
            classification: Some("quota"),
            retryable: false,
            message,
            status,
        };
    }

    if matches!(status, Some(401 | 403))
        || codes.iter().any(|c| AUTH_CODES.contains(&c.as_str()))
        || (status == Some(400) && lower.contains("incorrect api key provided"))
        || (status.is_none()
            && (lower.contains("invalid api key")
                || lower.contains("unauthorized")
                || lower.contains("incorrect api key provided")))
    {
        return ClassifiedProviderError {
            kind: ProviderErrorKind::Authentication,
            category: "provider.auth",
            classification: Some("auth"),
            retryable: false,
            message,
            status,
        };
    }

    if status == Some(429)
        || codes
            .iter()
            .any(|c| c.contains("rate_limit") || c == "too_many_requests" || c == "throttlingexception")
        || is_rate_limit_text(&lower)
    {
        return ClassifiedProviderError {
            kind: ProviderErrorKind::RateLimit,
            category: "provider.rate-limit",
            classification: Some("rate-limit"),
            retryable: true,
            message,
            status,
        };
    }

    if matches!(status, Some(408 | 409))
        || matches!(status, Some(s) if s >= 500)
        || (status.map(|s| s < 400).unwrap_or(true)
            && ((!codes.iter().any(|c| INVALID_REQUEST_CODES.contains(&c.as_str()))
                && is_server_error_text(&lower))
                || codes.iter().any(|c| {
                    SERVER_CODES.contains(&c.as_str())
                        || c.contains("exhausted")
                        || c.contains("unavailable")
                })))
    {
        return ClassifiedProviderError {
            kind: ProviderErrorKind::ProviderInternal,
            category: "provider.internal",
            classification: Some("provider-internal"),
            retryable: true,
            message,
            status,
        };
    }

    if codes
        .iter()
        .any(|c| INVALID_REQUEST_CODES.contains(&c.as_str()))
        || matches!(status, Some(s) if (400..500).contains(&s))
    {
        return ClassifiedProviderError {
            kind: ProviderErrorKind::InvalidRequest,
            category: "provider.invalid-request",
            classification: Some("invalid-request"),
            retryable: false,
            message,
            status,
        };
    }

    ClassifiedProviderError {
        kind: ProviderErrorKind::Unknown,
        category: "provider.unknown",
        classification: Some("unknown"),
        retryable: true,
        message,
        status,
    }
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

    #[test]
    fn test_quota_vs_rate_limit_classification() {
        // Hard monthly/billing quota exhaustion
        assert!(is_hard_quota_exhausted(402, ""));
        assert!(is_hard_quota_exhausted(429, "MONTHLY_REQUEST_COUNT exceeded"));
        assert!(is_hard_quota_exhausted(429, "Quota limit reached for plan"));
        assert!(!is_rate_limit_throttle(429, "MONTHLY_REQUEST_COUNT exceeded"));

        // Temporary RPM/RPS burst throttling must be classified as retryable rate limit, not hard quota
        assert!(!is_hard_quota_exhausted(429, "ThrottlingException: Too many requests"));
        assert!(is_rate_limit_throttle(429, "ThrottlingException: Too many requests"));
        assert!(!is_hard_quota_exhausted(429, "Rate limit exhausted for minute window"));
        assert!(is_rate_limit_throttle(429, "Rate limit exhausted for minute window"));
        assert!(!is_hard_quota_exhausted(429, "token_quota_exceeded: wait a moment"));
        assert!(is_rate_limit_throttle(429, "token_quota_exceeded: wait a moment"));
        assert!(is_rate_limit_throttle(200, "Rate limit exceeded, please retry"));

        // Generic HTTP 403 without quota text must NOT trigger quota failover
        assert!(!is_hard_quota_exhausted(403, "Forbidden"));
        assert!(!is_quota_or_rate_limit_error(403, "Forbidden"));
    }

    #[test]
    fn test_ordered_provider_failure_classification_k23_to_k28() {
        let k23 = classify_provider_failure(
            Some(400),
            r#"{"error":{"message":"This model's maximum context length is 128000 tokens"}}"#,
        );
        assert_eq!(k23.kind, ProviderErrorKind::ContextOverflow);

        let k24 = classify_provider_failure(
            Some(429),
            r#"{"error":{"message":"context length exceeded, slow down"}}"#,
        );
        assert_eq!(k24.kind, ProviderErrorKind::RateLimit);
        assert_eq!(k24.category, "provider.rate-limit");

        let k25 = classify_provider_failure(
            Some(400),
            r#"{"error":{"message":"too many tokens, please wait"}}"#,
        );
        assert_eq!(k25.kind, ProviderErrorKind::InvalidRequest);
        assert_eq!(k25.category, "provider.invalid-request");

        let k26 = classify_provider_failure(
            Some(413),
            r#"{"error":{"message":"request entity too large"}}"#,
        );
        assert_eq!(k26.kind, ProviderErrorKind::PayloadTooLarge);
        assert_eq!(k26.category, "provider.invalid-request");

        let k27 = classify_provider_failure(
            Some(400),
            r#"{"error":{"message":"Your request was rejected for violating our usage policy"}}"#,
        );
        assert_eq!(k27.kind, ProviderErrorKind::ContentPolicy);
        assert_eq!(k27.category, "provider.content-filter");

        let k28 = classify_provider_failure(
            Some(400),
            r#"{"error":{"message":"something odd happened"}}"#,
        );
        assert_eq!(k28.kind, ProviderErrorKind::InvalidRequest);
        assert_eq!(k28.category, "provider.invalid-request");

        let k28_ambiguous_no_status = classify_provider_failure(None, "something odd happened");
        assert_eq!(k28_ambiguous_no_status.kind, ProviderErrorKind::Unknown);
        assert!(k28_ambiguous_no_status.retryable);
    }
}

//! Finish Reason Normalization & Length Continuation Policy.
//! Mirrors OpenCode `schema/llm.ts`, `publish-llm-event.ts`, and `session/runner/llm.ts`.

/// Maximum consecutive `length`-terminated assistant steps in one streak before failing
/// with `output-limit` (2 continuations = 3 total attempts: request 1, cont 1, cont 2 -> error).
pub const MAX_LENGTH_CONTINUATION_STREAK: usize = 3;

pub const OUTPUT_LIMIT_EXHAUSTED_MESSAGE: &str =
    "Response still truncated after two output token limit continuations";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FinishReason {
    Stop,
    Length,
    ToolCalls,
    ContentFilter,
    Unknown,
}

impl FinishReason {
    pub fn as_str(&self) -> &'static str {
        match self {
            FinishReason::Stop => "stop",
            FinishReason::Length => "length",
            FinishReason::ToolCalls => "tool-calls",
            FinishReason::ContentFilter => "content-filter",
            FinishReason::Unknown => "unknown",
        }
    }
}

/// Normalizes provider `finish_reason` strings into canonical OpenCode finish reasons.
/// If tool calls were produced on the step (and the response wasn't blocked by content filtering),
/// a raw `"stop"` / empty finish reason promotes to `"tool-calls"`.
pub fn normalize_finish_reason(raw: Option<&str>, has_tool_calls: bool) -> FinishReason {
    let norm = raw
        .map(|s| s.trim().to_ascii_lowercase().replace('_', "-"))
        .unwrap_or_default();

    if matches!(
        norm.as_str(),
        "content-filter" | "safety" | "recitation" | "blocklist" | "prohibited-content"
    ) {
        return FinishReason::ContentFilter;
    }

    if has_tool_calls {
        if norm.is_empty()
            || matches!(
                norm.as_str(),
                "stop" | "end-turn" | "tool-calls" | "tool-call" | "function-call"
            )
        {
            return FinishReason::ToolCalls;
        }
        if matches!(norm.as_str(), "length" | "max-tokens") {
            return FinishReason::Length;
        }
        return FinishReason::ToolCalls;
    }

    match norm.as_str() {
        "" | "stop" | "end-turn" | "eos" => FinishReason::Stop,
        "length" | "max-tokens" => FinishReason::Length,
        "tool-calls" | "tool-call" | "function-call" => FinishReason::ToolCalls,
        _ => FinishReason::Unknown,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_finish_normalization_variants() {
        assert_eq!(normalize_finish_reason(Some("stop"), false), FinishReason::Stop);
        assert_eq!(normalize_finish_reason(Some("stop"), true), FinishReason::ToolCalls);
        assert_eq!(normalize_finish_reason(Some("tool_calls"), false), FinishReason::ToolCalls);
        assert_eq!(normalize_finish_reason(Some("max_tokens"), false), FinishReason::Length);
        assert_eq!(normalize_finish_reason(Some("length"), false), FinishReason::Length);
        assert_eq!(
            normalize_finish_reason(Some("content_filter"), false),
            FinishReason::ContentFilter
        );
        assert_eq!(
            normalize_finish_reason(Some("content-filter"), true),
            FinishReason::ContentFilter
        );
        assert_eq!(
            normalize_finish_reason(Some("weird-reason"), false),
            FinishReason::Unknown
        );
    }
}


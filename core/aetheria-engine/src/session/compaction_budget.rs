//! Token-Budget & Ceiling Calculation for Context Compaction (`W6`).
//! Mirrors OpenCode `packages/core/src/session/compaction.ts` budget math:
//! - Reserve margin (`max(16_000, floor(0.15 * window))` when `window >= 32_000`, else `floor(0.15 * window)`)
//! - Measured prompt anchor + unmeasured tail token estimation
//! - Background precompute lead threshold (`PRECOMPUTE_LEAD = 60_000`)

use serde_json::Value;

use crate::session::compaction::estimate_message_tokens;
use crate::session::usage::RecordedUsage;

pub const RESERVE_MIN: usize = 16_000;
pub const RESERVE_SHARE: f64 = 0.15;
pub const SUMMARY_OUTPUT_FLOOR: usize = 32_000;
pub const PRECOMPUTE_LEAD: usize = 60_000;
pub const UNKNOWN_WINDOW: usize = 200_000;
pub const SHRINK_STEPS: [f64; 4] = [0.85, 0.70, 0.50, 0.35];
pub const TRANSCRIPT_CLIP: usize = 2_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ModelContextLimit {
    pub context: usize,
    pub output: usize,
}

impl Default for ModelContextLimit {
    fn default() -> Self {
        Self {
            context: crate::session::compaction::DEFAULT_CONTEXT_WINDOW,
            output: 16_000,
        }
    }
}

/// Resolves `(context_window, output_limit)` for a configured model.
/// Falls back to `128_000 / 16_000` when the model lacks explicit limits.
pub fn resolve_model_context_limit(
    cfg: &Value,
    provider_id: &str,
    model_id: &str,
) -> ModelContextLimit {
    let model_cfg = cfg
        .pointer(&format!("/provider/{}/models/{}", provider_id, model_id))
        .or_else(|| cfg.pointer(&format!("/providers/{}/models/{}", provider_id, model_id)));

    let context = model_cfg
        .and_then(|m| {
            m.pointer("/limit/context")
                .or_else(|| m.pointer("/limit/input"))
        })
        .and_then(|v| v.as_u64())
        .map(|n| n as usize)
        .filter(|&n| n > 0)
        .unwrap_or(crate::session::compaction::DEFAULT_CONTEXT_WINDOW);

    let output = model_cfg
        .and_then(|m| m.pointer("/limit/output"))
        .and_then(|v| v.as_u64())
        .map(|n| n as usize)
        .filter(|&n| n > 0)
        .unwrap_or(16_000);

    ModelContextLimit { context, output }
}

/// Largest prompt token total allowed before synchronous pre-step compaction triggers.
pub fn calculate_ceiling(context_window: usize) -> usize {
    if context_window == 0 {
        return usize::MAX;
    }
    let min_reserve = if context_window >= 2 * RESERVE_MIN {
        RESERVE_MIN
    } else {
        0
    };
    let share = (context_window as f64 * RESERVE_SHARE).floor() as usize;
    let reserve = share.max(min_reserve);
    context_window.saturating_sub(reserve)
}

/// Extracts total measured tokens (`input + cache.read + cache.write + output + reasoning`)
/// from a persisted or recorded usage block, returning `None` when zero/missing.
pub fn total_tokens_from_usage_json(tokens: &Value) -> Option<usize> {
    let input = tokens.get("input").and_then(|v| v.as_u64()).unwrap_or(0) as usize;
    let output = tokens.get("output").and_then(|v| v.as_u64()).unwrap_or(0) as usize;
    let reasoning = tokens.get("reasoning").and_then(|v| v.as_u64()).unwrap_or(0) as usize;
    let cache_read = tokens
        .pointer("/cache/read")
        .and_then(|v| v.as_u64())
        .unwrap_or(0) as usize;
    let cache_write = tokens
        .pointer("/cache/write")
        .and_then(|v| v.as_u64())
        .unwrap_or(0) as usize;

    let prompt_side = input + cache_read + cache_write;
    if prompt_side == 0 {
        return None;
    }
    Some(prompt_side + output + reasoning)
}

pub fn total_tokens_from_recorded(usage: &RecordedUsage) -> Option<usize> {
    let prompt_side = usage.tokens.input + usage.tokens.cache.read + usage.tokens.cache.write;
    if prompt_side == 0 {
        return None;
    }
    Some(
        prompt_side as usize
            + usage.tokens.output as usize
            + usage.tokens.reasoning as usize,
    )
}

/// Computes `(cycle_start_tokens, current_total_tokens)` for pre-turn inspection of stored
/// session history (skipping any history before the latest compacted checkpoint).
pub fn measure_stored_history_tokens(history: &[Value]) -> (usize, usize) {
    let start_idx = history
        .iter()
        .rposition(|m| m.get("compactedSummary").and_then(|v| v.as_bool()) == Some(true))
        .unwrap_or(0);
    let active_slice = &history[start_idx..];

    let mut cycle_start = 0usize;
    let mut last_measured_idx: Option<usize> = None;
    let mut last_measured_total = 0usize;

    for (idx, msg) in active_slice.iter().enumerate() {
        let is_asst = msg.get("role").and_then(|v| v.as_str()) == Some("assistant")
            || msg.get("type").and_then(|v| v.as_str()) == Some("assistant");
        if !is_asst {
            continue;
        }
        let has_error = msg.get("error").is_some();
        if has_error {
            continue;
        }
        if let Some(tokens) = msg.get("tokens").and_then(total_tokens_from_usage_json) {
            if cycle_start == 0 {
                let inp = msg
                    .pointer("/tokens/input")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0) as usize;
                cycle_start = inp;
            }
            last_measured_idx = Some(idx);
            last_measured_total = tokens;
        }
    }

    let tail_start = last_measured_idx.map(|i| i + 1).unwrap_or(0);
    let tail_est: usize = active_slice[tail_start..]
        .iter()
        .map(estimate_message_tokens)
        .sum();
    (cycle_start, last_measured_total + tail_est)
}

/// Computes total prompt+tail tokens mid-turn after at least one LLM response in the active run.
pub fn measure_in_turn_tokens(
    last_step_usage: Option<&RecordedUsage>,
    chat_messages: &[Value],
) -> usize {
    let measured = last_step_usage
        .and_then(total_tokens_from_recorded)
        .unwrap_or(0);
    if measured == 0 {
        return crate::session::compaction::total_history_tokens(chat_messages);
    }
    let last_asst_idx = chat_messages
        .iter()
        .rposition(|m| m.get("role").and_then(|v| v.as_str()) == Some("assistant"));
    let tail_est: usize = match last_asst_idx {
        Some(idx) => chat_messages[idx + 1..]
            .iter()
            .map(estimate_message_tokens)
            .sum(),
        None => 0,
    };
    measured + tail_est
}

/// Matches OpenCode `PRECOMPUTE_LEAD` rule: fires when below ceiling yet within
/// `min(60_000, floor((ceiling - cycle_start) / 2))` of ceiling.
pub fn should_trigger_background_precompute(
    total_tokens: usize,
    cycle_start: usize,
    ceiling: usize,
) -> bool {
    if ceiling == usize::MAX || total_tokens >= ceiling || total_tokens == 0 {
        return false;
    }
    let half_headroom = ceiling.saturating_sub(cycle_start) / 2;
    let lead = PRECOMPUTE_LEAD.min(half_headroom);
    total_tokens >= ceiling.saturating_sub(lead)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn ceiling_matches_opencode_for_128k_and_25k_windows() {
        assert_eq!(calculate_ceiling(128_000), 108_800);
        assert_eq!(calculate_ceiling(25_000), 21_250);
    }

    #[test]
    fn background_precompute_triggers_at_75k_of_128k_window() {
        let ceiling = calculate_ceiling(128_000);
        assert!(!should_trigger_background_precompute(1_050, 1_000, ceiling));
        assert!(should_trigger_background_precompute(75_050, 1_000, ceiling));
        assert!(!should_trigger_background_precompute(115_100, 1_000, ceiling));
    }

    #[test]
    fn measure_stored_history_reads_persisted_assistant_usage() {
        let hist = vec![
            json!({ "type": "user", "text": "mulai K29" }),
            json!({
                "type": "assistant",
                "role": "assistant",
                "tokens": { "input": 115000, "output": 100, "reasoning": 0, "cache": { "read": 0, "write": 0 } }
            }),
            json!({ "type": "user", "text": "lanjut K29" }),
        ];
        let (cycle_start, total) = measure_stored_history_tokens(&hist);
        assert_eq!(cycle_start, 115_000);
        assert!(total >= 115_100);
        assert!(total >= calculate_ceiling(128_000));
    }
}


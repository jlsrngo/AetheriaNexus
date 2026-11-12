//! Token usage parsing, tiered USD cost calculation, and multi-step turn aggregation.
//! Mirrors OpenCode `packages/core/src/session/usage.ts`.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheUsage {
    pub read: u64,
    pub write: u64,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenUsage {
    pub input: u64,
    pub output: u64,
    pub reasoning: u64,
    pub cache: CacheUsage,
}

#[derive(Debug, Clone, PartialEq)]
pub struct CostTier {
    pub context_size: Option<u64>,
    pub input: f64,
    pub output: f64,
    pub cache_read: f64,
    pub cache_write: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordedUsage {
    pub tokens: TokenUsage,
    pub cost: f64,
}

#[derive(Debug, Default, Clone)]
pub struct TurnUsageAccumulator {
    steps: Vec<RecordedUsage>,
}

impl TurnUsageAccumulator {
    pub fn record_step(&mut self, usage: Option<RecordedUsage>) {
        if let Some(u) = usage {
            self.steps.push(u);
        }
    }

    pub fn totals(&self) -> Option<RecordedUsage> {
        if self.steps.is_empty() {
            return None;
        }
        let mut out = RecordedUsage {
            tokens: TokenUsage::default(),
            cost: 0.0,
        };
        for s in &self.steps {
            out.tokens.input = out.tokens.input.saturating_add(s.tokens.input);
            out.tokens.output = out.tokens.output.saturating_add(s.tokens.output);
            out.tokens.reasoning = out.tokens.reasoning.saturating_add(s.tokens.reasoning);
            out.tokens.cache.read = out.tokens.cache.read.saturating_add(s.tokens.cache.read);
            out.tokens.cache.write = out.tokens.cache.write.saturating_add(s.tokens.cache.write);
            out.cost += s.cost;
        }
        Some(out)
    }
}

fn finite_or_zero(value: f64) -> f64 {
    if value.is_finite() {
        value
    } else {
        0.0
    }
}

fn as_u64(val: Option<&Value>) -> Option<u64> {
    let v = val?;
    if let Some(u) = v.as_u64() {
        return Some(u);
    }
    if let Some(i) = v.as_i64() {
        return Some(i.max(0) as u64);
    }
    if let Some(f) = v.as_f64() {
        if f.is_finite() && f >= 0.0 {
            return Some(f as u64);
        }
    }
    None
}

fn as_f64(val: Option<&Value>) -> Option<f64> {
    let v = val?;
    v.as_f64().filter(|f| f.is_finite() && *f >= 0.0)
}

/// Parses provider-reported `/usage` into canonical `TokenUsage` + optional provider-reported `cost`.
/// Returns `None` when the provider omitted `usage` (never estimates or fabricates numbers).
pub fn parse_provider_usage(raw_usage: Option<&Value>) -> Option<(TokenUsage, Option<f64>)> {
    let obj = raw_usage?.as_object()?;
    if obj.is_empty() {
        return None;
    }

    let openai_cached = as_u64(obj.get("prompt_tokens_details").and_then(|d| d.get("cached_tokens")));
    let explicit_cache_read = as_u64(obj.get("cache_read_input_tokens"))
        .or_else(|| as_u64(obj.get("cacheReadInputTokens")))
        .or_else(|| as_u64(obj.get("cache").and_then(|c| c.get("read"))));
    let cache_read = explicit_cache_read.or(openai_cached).unwrap_or(0);

    let cache_write = as_u64(obj.get("cache_creation_input_tokens"))
        .or_else(|| as_u64(obj.get("cacheWriteInputTokens")))
        .or_else(|| as_u64(obj.get("cache").and_then(|c| c.get("write"))))
        .unwrap_or(0);

    let input = if let Some(v) = as_u64(obj.get("non_cached_input_tokens"))
        .or_else(|| as_u64(obj.get("nonCachedInputTokens")))
        .or_else(|| as_u64(obj.get("input")))
    {
        v
    } else if let Some(prompt_tokens) = as_u64(obj.get("prompt_tokens")) {
        // OpenAI `prompt_tokens` includes `prompt_tokens_details.cached_tokens`.
        prompt_tokens.saturating_sub(openai_cached.unwrap_or(0))
    } else if let Some(input_tokens) = as_u64(obj.get("input_tokens")) {
        input_tokens
    } else {
        0
    };

    let reasoning = as_u64(
        obj.get("completion_tokens_details")
            .and_then(|d| d.get("reasoning_tokens")),
    )
    .or_else(|| as_u64(obj.get("reasoning_tokens")))
    .or_else(|| as_u64(obj.get("reasoningTokens")))
    .or_else(|| as_u64(obj.get("reasoning")))
    .unwrap_or(0);

    let output = if let Some(v) = as_u64(obj.get("visible_output_tokens"))
        .or_else(|| as_u64(obj.get("visibleOutputTokens")))
        .or_else(|| as_u64(obj.get("output")))
    {
        v
    } else if let Some(completion_tokens) = as_u64(obj.get("completion_tokens")) {
        let reasoning_in_completion = as_u64(
            obj.get("completion_tokens_details")
                .and_then(|d| d.get("reasoning_tokens")),
        )
        .unwrap_or(0);
        completion_tokens.saturating_sub(reasoning_in_completion)
    } else if let Some(output_tokens) = as_u64(obj.get("output_tokens")) {
        output_tokens
    } else {
        0
    };

    let reported_cost = as_f64(obj.get("cost"))
        .or_else(|| as_f64(obj.get("cost_usd")))
        .or_else(|| as_f64(obj.get("total_cost")));

    Some((
        TokenUsage {
            input,
            output,
            reasoning,
            cache: CacheUsage {
                read: cache_read,
                write: cache_write,
            },
        },
        reported_cost,
    ))
}

/// Parses model catalog `cost` metadata (either a single object or tiered array).
pub fn parse_cost_tiers(cost_value: Option<&Value>) -> Vec<CostTier> {
    let Some(val) = cost_value else {
        return Vec::new();
    };
    let mut items = Vec::new();
    if let Some(arr) = val.as_array() {
        items.extend(arr.iter());
    } else if val.is_object() {
        items.push(val);
    }

    let mut out = Vec::with_capacity(items.len());
    for item in items {
        let Some(obj) = item.as_object() else {
            continue;
        };
        let context_size = match obj.get("tier").and_then(|t| t.as_object()) {
            Some(tier_obj) => {
                let kind = tier_obj.get("type").and_then(|v| v.as_str()).unwrap_or("");
                if kind == "context" {
                    as_u64(tier_obj.get("size"))
                } else {
                    None
                }
            }
            None => None,
        };
        let input = as_f64(obj.get("input")).unwrap_or(0.0);
        let output = as_f64(obj.get("output")).unwrap_or(0.0);
        let cache_read = obj
            .get("cache")
            .and_then(|c| c.get("read").or_else(|| obj.get("cache_read")))
            .and_then(|v| v.as_f64())
            .filter(|f| f.is_finite() && *f >= 0.0)
            .unwrap_or(0.0);
        let cache_write = obj
            .get("cache")
            .and_then(|c| c.get("write").or_else(|| obj.get("cache_write")))
            .and_then(|v| v.as_f64())
            .filter(|f| f.is_finite() && *f >= 0.0)
            .unwrap_or(0.0);
        out.push(CostTier {
            context_size,
            input,
            output,
            cache_read,
            cache_write,
        });
    }
    out
}

/// Computes tiered USD cost matching OpenCode `SessionUsage.calculateCost`.
pub fn calculate_cost(tiers: &[CostTier], usage: &TokenUsage) -> f64 {
    let context = usage
        .input
        .saturating_add(usage.cache.read)
        .saturating_add(usage.cache.write);

    let matched_tier = tiers
        .iter()
        .filter(|t| matches!(t.context_size, Some(size) if context > size))
        .max_by_key(|t| t.context_size.unwrap_or(0))
        .or_else(|| tiers.iter().find(|t| t.context_size.is_none()));

    let Some(cost) = matched_tier else {
        return 0.0;
    };

    let output_total = (usage.output.saturating_add(usage.reasoning)) as f64;
    ((usage.input as f64) * finite_or_zero(cost.input)
        + output_total * finite_or_zero(cost.output)
        + (usage.cache.read as f64) * finite_or_zero(cost.cache_read)
        + (usage.cache.write as f64) * finite_or_zero(cost.cache_write))
        / 1_000_000.0
}

/// Converts raw provider `/usage` + catalog pricing into canonical `RecordedUsage`.
/// Authoritative zero or reported cost from the provider overrides catalog fallback.
pub fn record_step_usage(raw_usage: Option<&Value>, tiers: &[CostTier]) -> Option<RecordedUsage> {
    let (tokens, reported_cost) = parse_provider_usage(raw_usage)?;
    let cost = match reported_cost {
        Some(c) => finite_or_zero(c),
        None => calculate_cost(tiers, &tokens),
    };
    Some(RecordedUsage { tokens, cost })
}

pub fn tokens_to_json(usage: Option<&RecordedUsage>) -> Value {
    match usage {
        Some(u) => serde_json::to_value(u.tokens).unwrap_or(Value::Null),
        None => Value::Null,
    }
}

pub fn cost_to_json(usage: Option<&RecordedUsage>) -> Value {
    match usage {
        Some(u) => json!(u.cost),
        None => Value::Null,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parity_tiers() -> Vec<CostTier> {
        parse_cost_tiers(Some(&json!([
            { "input": 1, "output": 2, "cache": { "read": 0.1, "write": 0.2 } },
            { "tier": { "type": "context", "size": 200000 }, "input": 2, "output": 4, "cache": { "read": 0.2, "write": 0.4 } }
        ])))
    }

    #[test]
    fn test_standard_usage_and_cost_k08() {
        let raw = json!({ "prompt_tokens": 812, "completion_tokens": 140, "total_tokens": 952 });
        let rec = record_step_usage(Some(&raw), &parity_tiers()).expect("usage present");
        assert_eq!(rec.tokens.input, 812);
        assert_eq!(rec.tokens.output, 140);
        assert_eq!(rec.tokens.reasoning, 0);
        assert_eq!(rec.tokens.cache, CacheUsage { read: 0, write: 0 });
        assert!((rec.cost - 0.001092).abs() < 1e-12);
    }

    #[test]
    fn test_zero_usage_is_authoritative_k09() {
        let raw = json!({ "prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0 });
        let rec = record_step_usage(Some(&raw), &parity_tiers()).expect("zero usage present");
        assert_eq!(rec.tokens.input, 0);
        assert_eq!(rec.tokens.output, 0);
        assert_eq!(rec.cost, 0.0);
    }

    #[test]
    fn test_tiered_pricing_above_200k_k10() {
        let raw = json!({ "prompt_tokens": 210000, "completion_tokens": 1000, "total_tokens": 211000 });
        let rec = record_step_usage(Some(&raw), &parity_tiers()).expect("usage present");
        assert!((rec.cost - 0.424).abs() < 1e-12);
    }

    #[test]
    fn test_multi_step_accumulation_k11() {
        let tiers = parity_tiers();
        let raw = json!({ "prompt_tokens": 812, "completion_tokens": 140, "total_tokens": 952 });
        let mut acc = TurnUsageAccumulator::default();
        for _ in 0..3 {
            acc.record_step(record_step_usage(Some(&raw), &tiers));
        }
        let totals = acc.totals().expect("totals");
        assert_eq!(totals.tokens.input, 2436);
        assert_eq!(totals.tokens.output, 420);
        assert!((totals.cost - 0.003276).abs() < 1e-12);
    }

    #[test]
    fn test_missing_usage_returns_none() {
        assert_eq!(record_step_usage(None, &parity_tiers()), None);
        assert_eq!(record_step_usage(Some(&Value::Null), &parity_tiers()), None);
    }

    #[test]
    fn test_reported_zero_cost_overrides_catalog() {
        let raw = json!({ "prompt_tokens": 1000, "completion_tokens": 500, "cost": 0 });
        let rec = record_step_usage(Some(&raw), &parity_tiers()).expect("usage present");
        assert_eq!(rec.cost, 0.0);
    }
}


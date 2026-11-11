//! High-performance Rust UI Message Mapper & Reasoning Stripper.
//!
//! Offloads:
//! 1. Regex stripping of `<think>...</think>` tags and reasoning extraction.
//! 2. Antigravity-style tool step label formatting (`format_tool_step_label`).
//! 3. Internal dotfile tool invocation suppression (`.aetheria`, `.git`, `aetheria.md`).
//! 4. Thought timing calculation (`thoughtMs`, `thoughtSec`).
//! 5. Consecutive assistant turn merging and reasoning paragraph deduplication.

use serde_json::{json, Value};
use std::collections::HashSet;

pub use super::reasoning_cleaner::{clean_reasoning_tags, is_internal_tool_target};
pub use super::tool_label_formatter::format_tool_step_label;

/// Transforms raw stored session messages into clean, UI-ready messages:
/// - Filters internal compaction/system noise.
/// - Parses and cleans reasoning blocks (`<think>`).
/// - Builds Antigravity step labels for tools.
/// - Calculates thought duration in ms/sec.
/// - Merges consecutive assistant messages.
pub fn map_messages_for_ui(raw_messages: &[Value]) -> Vec<Value> {
    if raw_messages.is_empty() {
        return Vec::new();
    }

    // 1. Filter out compaction, system, and summary messages
    let mut filtered: Vec<&Value> = raw_messages
        .iter()
        .filter(|m| {
            let t = m.get("type").or_else(|| m.get("role")).and_then(|v| v.as_str()).unwrap_or("");
            if matches!(t, "compaction" | "system" | "model-switched" | "plan") {
                return false;
            }
            if m.get("agent").and_then(|v| v.as_str()) == Some("compaction") {
                return false;
            }
            if m.get("mode").and_then(|v| v.as_str()) == Some("compaction") {
                return false;
            }
            if m.get("summary").and_then(|v| v.as_bool()) == Some(true)
                || m.pointer("/info/summary").and_then(|v| v.as_bool()) == Some(true)
            {
                return false;
            }
            true
        })
        .collect();

    // 2. Sort chronologically
    filtered.sort_by_key(|m| {
        m.pointer("/time/created")
            .or_else(|| m.get("time_created"))
            .or_else(|| m.pointer("/time/start"))
            .and_then(|v| v.as_u64())
            .unwrap_or(0)
    });

    let mut individual_messages: Vec<Value> = Vec::with_capacity(filtered.len());

    for (idx, msg) in filtered.iter().enumerate() {
        let raw_type = msg.get("type").or_else(|| msg.get("role")).and_then(|v| v.as_str()).unwrap_or("");
        let role = if raw_type == "user" { "user" } else { "assistant" };

        let mut content = String::new();
        let mut reasoning = String::new();
        let mut execution_steps: Vec<Value> = Vec::new();
        let mut thought_sec: Option<u64> = None;
        let mut thought_ms: Option<u64> = None;
        let mut parts: Vec<Value> = Vec::new();

        // A. Extract text & reasoning from msg.content
        if let Some(s) = msg.get("content").and_then(|v| v.as_str()) {
            content = s.to_string();
        } else if let Some(s) = msg.get("text").and_then(|v| v.as_str()) {
            content = s.to_string();
        } else if let Some(arr) = msg.get("content").and_then(|v| v.as_array()) {
            let mut reasoning_chunks = Vec::new();
            let mut total_reasoning_time = 0u64;

            for p in arr {
                let p_type = p.get("type").and_then(|v| v.as_str()).unwrap_or("");
                if p_type == "reasoning" {
                    if let Some(t) = p.get("text").and_then(|v| v.as_str()) {
                        reasoning_chunks.push(t.to_string());
                    }
                    if let (Some(start), Some(end)) = (
                        p.pointer("/time/start").and_then(|v| v.as_u64()),
                        p.pointer("/time/end").and_then(|v| v.as_u64()),
                    ) {
                        if end > start {
                            total_reasoning_time += end - start;
                        }
                    }
                } else if (p_type == "text" || p_type.is_empty()) && p.get("text").is_some() {
                    if let Some(t) = p.get("text").and_then(|v| v.as_str()) {
                        content.push_str(t);
                    }
                } else if (p_type == "tool" || p_type == "tool-invocation") && !is_internal_tool_target(p) {
                    let tool_name = p
                        .get("name")
                        .or_else(|| p.get("tool"))
                        .or_else(|| p.pointer("/toolInvocation/toolName"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("action");
                    let input = p
                        .pointer("/state/input")
                        .or_else(|| p.get("input"))
                        .or_else(|| p.get("args"))
                        .unwrap_or(&Value::Null);
                    let is_error = p.pointer("/state/status").and_then(|v| v.as_str()) == Some("error")
                        || p.get("error").is_some();
                    let status = if is_error {
                        "failed"
                    } else if p.pointer("/state/status").and_then(|v| v.as_str()) == Some("running") {
                        "running"
                    } else {
                        "completed"
                    };
                    let label = format_tool_step_label(tool_name, input, status == "completed");
                    execution_steps.push(json!({
                        "id": format!("tool-{}-{}", idx, execution_steps.len()),
                        "label": label,
                        "status": status,
                        "iconType": "tool",
                        "toolName": tool_name,
                    }));
                }
            }

            if !reasoning_chunks.is_empty() {
                reasoning = reasoning_chunks.join("\n\n");
            }
            if total_reasoning_time > 0 {
                thought_ms = Some(total_reasoning_time);
                thought_sec = Some((total_reasoning_time / 1000).max(1));
            }
        }

        // B. Calculate thought timing fallback
        if role == "assistant" && thought_sec.is_none() {
            let start = msg.pointer("/time/created")
                .or_else(|| msg.get("time_created"))
                .or_else(|| msg.pointer("/time/start"))
                .and_then(|v| v.as_u64());
            let end = msg.pointer("/time/updated")
                .or_else(|| msg.get("time_updated"))
                .or_else(|| msg.pointer("/time/end"))
                .and_then(|v| v.as_u64());
            if let (Some(s), Some(e)) = (start, end) {
                if e > s {
                    let dur = e - s;
                    thought_ms = Some(dur);
                    thought_sec = Some((dur / 1000).max(1));
                } else {
                    thought_ms = Some(488);
                    thought_sec = Some(1);
                }
            }
        }

        // C. Clean reasoning tags from content
        let (cleaned_content, extracted_thoughts) = clean_reasoning_tags(&content);
        if !extracted_thoughts.is_empty() {
            if !reasoning.is_empty() {
                reasoning.push_str("\n\n");
            }
            reasoning.push_str(&extracted_thoughts.join("\n\n"));
        }
        content = cleaned_content;

        // D. Build parts array
        if role == "assistant" {
            if !reasoning.is_empty() {
                parts.push(json!({
                    "type": "thought",
                    "text": reasoning.trim(),
                    "durationSec": thought_sec,
                    "durationMs": thought_ms,
                }));
            }
            for step in &execution_steps {
                parts.push(json!({
                    "type": "tool",
                    "step": step,
                }));
            }
            if !content.is_empty() {
                parts.push(json!({
                    "type": "text",
                    "text": content.trim(),
                }));
            }
        }

        let mid = msg
            .get("id")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| format!("{}-{}-{}", role, idx, crate::paths::now_ms()));

        let agent_name = msg
            .get("agent")
            .and_then(|v| v.as_str())
            .unwrap_or("default");

        individual_messages.push(json!({
            "id": mid,
            "role": role,
            "agent": agent_name,
            "content": content,
            "reasoning": if reasoning.is_empty() { Value::Null } else { Value::String(reasoning.trim().to_string()) },
            "executionSteps": if execution_steps.is_empty() { Value::Null } else { json!(execution_steps) },
            "thoughtSec": thought_sec,
            "thoughtMs": thought_ms,
            "parts": if parts.is_empty() { Value::Null } else { json!(parts) },
            "createdAt": msg.get("createdAt").or_else(|| msg.pointer("/time/created")),
            "summary": false,
            "isRustMapped": true,
        }));
    }

    // 3. Merge consecutive assistant messages belonging to the same turn
    let mut merged: Vec<Value> = Vec::with_capacity(individual_messages.len());
    for m in individual_messages {
        let is_asst = m.get("role").and_then(|v| v.as_str()) == Some("assistant");
        let last_is_asst = merged
            .last()
            .and_then(|last| last.get("role").and_then(|v| v.as_str()))
            == Some("assistant");

        let m_agent = m.get("agent").and_then(|v| v.as_str()).unwrap_or("default");
        let last_agent = merged
            .last()
            .and_then(|last| last.get("agent").and_then(|v| v.as_str()))
            .unwrap_or("default");

        // ONLY merge if both are assistant AND both belong to default agent (same turn).
        // Specialized subagents (Audio Producer, Motion Engineer, etc.) remain as distinct chat bubbles!
        if is_asst && last_is_asst && m_agent == last_agent && m_agent == "default" {
            let Some(last) = merged.last_mut() else {
                continue;
            };
            let new_content = m.get("content").and_then(|v| v.as_str()).unwrap_or("");
            if !new_content.is_empty() {
                let existing = last.get("content").and_then(|v| v.as_str()).unwrap_or("");
                let combined = if existing.is_empty() {
                    new_content.to_string()
                } else {
                    format!("{}\n\n{}", existing, new_content)
                };
                last["content"] = Value::String(combined);
            }

            // Merge reasoning with paragraph deduplication
            let new_reasoning = m.get("reasoning").and_then(|v| v.as_str()).unwrap_or("");
            if !new_reasoning.is_empty() {
                let existing_reasoning = last
                    .get("reasoning")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                if existing_reasoning.is_empty() {
                    last["reasoning"] = Value::String(new_reasoning.to_string());
                } else {
                    let mut seen = HashSet::new();
                    for para in existing_reasoning.split("\n\n") {
                        seen.insert(para.trim());
                    }
                    let mut combined = existing_reasoning.to_string();
                    for para in new_reasoning.split("\n\n") {
                        let trimmed = para.trim();
                        if !trimmed.is_empty() && !seen.contains(trimmed) {
                            seen.insert(trimmed);
                            combined.push_str("\n\n");
                            combined.push_str(trimmed);
                        }
                    }
                    last["reasoning"] = Value::String(combined);
                }
            }

            // Append parts
            if let Some(new_parts) = m.get("parts").and_then(|v| v.as_array()) {
                if let Some(old_parts) = last.get_mut("parts").and_then(|v| v.as_array_mut()) {
                    old_parts.extend(new_parts.clone());
                } else {
                    last["parts"] = json!(new_parts);
                }
            }

            // Append executionSteps so tool progress stays unified across step continuations
            if let Some(new_steps) = m.get("executionSteps").and_then(|v| v.as_array()) {
                if let Some(old_steps) = last.get_mut("executionSteps").and_then(|v| v.as_array_mut()) {
                    old_steps.extend(new_steps.clone());
                } else {
                    last["executionSteps"] = json!(new_steps);
                }
            }

            last["id"] = m["id"].clone();
        } else {
            merged.push(m);
        }
    }

    merged
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_and_filters_raw_session_messages() {
        let msgs = vec![
            json!({ "id": "m1", "type": "compaction", "text": "internal", "time": { "created": 1 } }),
            json!({ "id": "m2", "role": "user", "text": "Buat laporan", "time": { "created": 2 } }),
            json!({ "id": "m3", "role": "assistant", "text": "Siap.", "time": { "created": 3 } }),
        ];
        let mapped = map_messages_for_ui(&msgs);
        assert_eq!(mapped.len(), 2);
        assert_eq!(mapped[0]["role"], "user");
        assert_eq!(mapped[1]["content"], "Siap.");
    }
}


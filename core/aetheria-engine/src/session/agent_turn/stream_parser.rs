//! Hybrid JSON + SSE Stream Parser & Multimodal Sanitizer — mirrors `packages/core/src/session/runner/step.ts`.
//! Isolated into its own file so response parsing logic is completely independent of HTTP transport.

use serde_json::{json, Value};

/// Sanitizes multimodal image-array messages into plain text when a text-only model rejects image blocks.
pub fn sanitize_multimodal_messages_to_text(messages: &mut [Value]) -> bool {
    let mut changed = false;
    for msg in messages.iter_mut() {
        let Some(arr) = msg.get("content").and_then(|v| v.as_array()).cloned() else {
            continue;
        };
        let mut extracted_texts: Vec<String> = Vec::new();
        for part in &arr {
            if let Some(t) = part.get("text").and_then(|v| v.as_str()) {
                if !t.trim().is_empty() {
                    extracted_texts.push(t.to_string());
                }
            }
        }
        let fallback_text = if extracted_texts.is_empty() {
            "[Image attachment omitted for text-only model]".to_string()
        } else {
            extracted_texts.join("\n\n")
        };
        if let Some(obj) = msg.as_object_mut() {
            obj.insert("content".to_string(), Value::String(fallback_text));
            changed = true;
        }
    }
    changed
}

/// Parses a chat completion response body that may be either:
/// 1. Standard JSON (`{"choices":[{"message":{...},"finish_reason":"..."}]}`)
/// 2. Server-Sent Events stream (`data: {"choices":[{"delta":{...}}]}`)
pub fn parse_completion_body(raw_body: &str) -> Result<(String, Vec<Value>, String), String> {
    let trimmed = raw_body.trim();
    if trimmed.is_empty() {
        return Err("Empty response body from LLM provider".to_string());
    }

    // 1. Try direct JSON object parse first
    if trimmed.starts_with('{') {
        if let Ok(data) = serde_json::from_str::<Value>(trimmed) {
            if let Some(err_msg) = data
                .pointer("/error/message")
                .and_then(|v| v.as_str())
                .or_else(|| data.get("error").and_then(|v| v.as_str()))
            {
                return Err(format!("Provider error in body: {}", err_msg));
            }

            let choice = data.pointer("/choices/0");
            let finish_reason = choice
                .and_then(|c| c.get("finish_reason"))
                .and_then(|v| v.as_str())
                .unwrap_or("stop")
                .to_string();

            let msg = choice.and_then(|c| c.get("message").or_else(|| c.get("delta")));
            let text = msg
                .and_then(|m| m.get("content"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let tool_calls = msg
                .and_then(|m| m.get("tool_calls"))
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();

            return Ok((text, tool_calls, finish_reason));
        }
    }

    // 2. Fallback: Parse SSE (`data: ...`) lines and accumulate deltas
    let mut accumulated_text = String::new();
    let mut finish_reason = String::from("stop");
    let mut tool_calls_map: std::collections::BTreeMap<usize, (String, String, String)> =
        std::collections::BTreeMap::new();
    let mut parsed_any_chunk = false;

    for raw_line in trimmed.lines() {
        let line = raw_line.trim();
        if !line.starts_with("data:") {
            continue;
        }
        let data_str = line["data:".len()..].trim();
        if data_str == "[DONE]" || data_str.is_empty() {
            continue;
        }
        if let Ok(chunk) = serde_json::from_str::<Value>(data_str) {
            parsed_any_chunk = true;
            if let Some(fr) = chunk
                .pointer("/choices/0/finish_reason")
                .and_then(|v| v.as_str())
            {
                if !fr.is_empty() {
                    finish_reason = fr.to_string();
                }
            }
            if let Some(delta) = chunk.pointer("/choices/0/delta") {
                if let Some(c) = delta.get("content").and_then(|v| v.as_str()) {
                    accumulated_text.push_str(c);
                }
                if let Some(tcs) = delta.get("tool_calls").and_then(|v| v.as_array()) {
                    for tc in tcs {
                        let idx = tc.get("index").and_then(|v| v.as_u64()).unwrap_or(0) as usize;
                        let entry = tool_calls_map
                            .entry(idx)
                            .or_insert_with(|| (String::new(), String::new(), String::new()));
                        if let Some(id) = tc.get("id").and_then(|v| v.as_str()) {
                            if !id.is_empty() {
                                entry.0 = id.to_string();
                            }
                        }
                        if let Some(func) = tc.get("function") {
                            if let Some(n) = func.get("name").and_then(|v| v.as_str()) {
                                if !n.is_empty() {
                                    entry.1.push_str(n);
                                }
                            }
                            if let Some(a) = func.get("arguments").and_then(|v| v.as_str()) {
                                entry.2.push_str(a);
                            }
                        }
                    }
                }
            } else if let Some(msg) = chunk.pointer("/choices/0/message") {
                if let Some(c) = msg.get("content").and_then(|v| v.as_str()) {
                    accumulated_text.push_str(c);
                }
            }
        }
    }

    if parsed_any_chunk {
        let mut tool_calls = Vec::new();
        for (idx, (id, name, args)) in tool_calls_map {
            if !name.is_empty() {
                tool_calls.push(json!({
                    "id": if id.is_empty() { format!("call_sse_{}", idx) } else { id },
                    "type": "function",
                    "function": {
                        "name": name,
                        "arguments": args
                    }
                }));
            }
        }
        return Ok((accumulated_text, tool_calls, finish_reason));
    }

    let preview: String = trimmed.chars().take(200).collect();
    Err(format!("Unrecognized LLM response format: {}", preview))
}


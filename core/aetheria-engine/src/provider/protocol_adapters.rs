//! Native Provider Protocol Translators (Anthropic `/v1/messages` with Prompt Caching).
//! Mirrors `packages/ai/src/providers/anthropic.ts`. Re-exports `key_rotation`.

pub use super::key_rotation::{rotate_api_key_on_quota, select_healthy_api_key};

use serde_json::{json, Value};

/// Builds a native Anthropic `/v1/messages` request payload with automatic `ephemeral` prompt caching.
pub fn build_anthropic_cached_request(
    model_id: &str,
    chat_messages: &[Value],
    tools: &[Value],
    temperature: f64,
    max_tokens: u64,
) -> Value {
    let mut system_blocks: Vec<Value> = Vec::new();
    let mut anthropic_msgs: Vec<Value> = Vec::new();

    for m in chat_messages {
        let role = m.get("role").and_then(|v| v.as_str()).unwrap_or("user");
        let content_str = m.get("content").and_then(|v| v.as_str()).unwrap_or("");
        if role == "system" || role == "developer" {
            if !content_str.trim().is_empty() {
                system_blocks.push(json!({
                    "type": "text",
                    "text": content_str,
                    "cache_control": { "type": "ephemeral" }
                }));
            }
            continue;
        }
        anthropic_msgs.push(json!({
            "role": if role == "assistant" { "assistant" } else { "user" },
            "content": [{ "type": "text", "text": if content_str.is_empty() { " " } else { content_str } }]
        }));
    }

    if let Some(last_msg) = anthropic_msgs.last_mut() {
        if let Some(arr) = last_msg.get_mut("content").and_then(|v| v.as_array_mut()) {
            if let Some(last_block) = arr.last_mut() {
                last_block["cache_control"] = json!({ "type": "ephemeral" });
            }
        }
    }

    let mut payload = json!({
        "model": model_id,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "messages": anthropic_msgs
    });
    if !system_blocks.is_empty() {
        payload["system"] = Value::Array(system_blocks);
    }
    if !tools.is_empty() {
        let mapped: Vec<Value> = tools
            .iter()
            .filter_map(|t| {
                let f = t.get("function").unwrap_or(t);
                let name = f.get("name").and_then(|v| v.as_str())?;
                Some(json!({
                    "name": name,
                    "description": f.get("description").and_then(|v| v.as_str()).unwrap_or(""),
                    "input_schema": f.get("parameters").cloned().unwrap_or_else(|| json!({"type": "object", "properties": {}}))
                }))
            })
            .collect();
        if !mapped.is_empty() {
            payload["tools"] = Value::Array(mapped);
        }
    }
    payload
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_multi_key_rotation_on_quota() {
        let pool = "sk-key-alpha, sk-key-beta, sk-key-gamma";
        let first = select_healthy_api_key(pool);
        assert_eq!(first, "sk-key-alpha");

        let rotated = rotate_api_key_on_quota(pool, "sk-key-alpha", 60_000);
        assert_eq!(rotated.as_deref(), Some("sk-key-beta"));
    }

    #[test]
    fn test_anthropic_cached_request_adds_ephemeral_breakpoints() {
        let msgs = vec![
            json!({ "role": "system", "content": "System instructions" }),
            json!({ "role": "user", "content": "Build scene 1" }),
        ];
        let req = build_anthropic_cached_request("claude-sonnet-4-5", &msgs, &[], 0.3, 4096);
        assert_eq!(
            req["system"][0]["cache_control"]["type"],
            json!("ephemeral")
        );
        assert_eq!(
            req["messages"][0]["content"][0]["cache_control"]["type"],
            json!("ephemeral")
        );
    }
}

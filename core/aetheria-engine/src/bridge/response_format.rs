//! OpenAI-compatible JSON completion & SSE chunk payload builders for Local-CLI Bridge.

use axum::{
    body::Body,
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde_json::{json, Value};

use crate::paths::{gen_id, now_ms};

pub(crate) fn extract_content_text(content: Option<&Value>) -> String {
    match content {
        None | Some(Value::Null) => String::new(),
        Some(Value::String(s)) => s.clone(),
        Some(Value::Array(arr)) => arr
            .iter()
            .filter_map(|p| {
                if let Some(s) = p.as_str() {
                    Some(s.to_string())
                } else {
                    p.get("text")
                        .or_else(|| p.get("input_text"))
                        .or_else(|| p.get("content"))
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string())
                }
            })
            .collect::<Vec<_>>()
            .join(""),
        _ => String::new(),
    }
}

pub(crate) fn make_completion_response(
    model: &str,
    text: String,
    tool_calls: Vec<Value>,
) -> Response {
    make_completion_response_with_reasoning(model, text, String::new(), tool_calls)
}

pub(crate) fn make_completion_response_with_reasoning(
    model: &str,
    text: String,
    reasoning: String,
    tool_calls: Vec<Value>,
) -> Response {
    let has_tools = !tool_calls.is_empty();
    let mut message = json!({
        "role": "assistant",
        "content": if text.is_empty() && has_tools { Value::Null } else { Value::String(text) },
    });
    if !reasoning.trim().is_empty() {
        message["reasoning_content"] = Value::String(reasoning);
    }
    if has_tools {
        message["tool_calls"] = Value::Array(tool_calls);
    }
    Json(json!({
        "id": gen_id("chatcmpl"),
        "object": "chat.completion",
        "created": now_ms() / 1000,
        "model": model,
        "choices": [{
            "index": 0,
            "message": message,
            "finish_reason": if has_tools { "tool_calls" } else { "stop" }
        }],
        "usage": {
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0
        }
    }))
    .into_response()
}

pub(crate) fn make_sse_response_from_result(
    model: &str,
    text: String,
    tool_calls: Vec<Value>,
) -> Response {
    make_sse_response_with_reasoning(model, text, String::new(), tool_calls)
}

pub(crate) fn make_sse_response_with_reasoning(
    model: &str,
    text: String,
    reasoning: String,
    tool_calls: Vec<Value>,
) -> Response {
    let chat_id = gen_id("chatcmpl");
    let created = now_ms() / 1000;
    let mut chunks = Vec::new();

    if !reasoning.trim().is_empty() {
        chunks.push(format!(
            "data: {}\n\n",
            json!({
                "id": chat_id,
                "object": "chat.completion.chunk",
                "created": created,
                "model": model,
                "choices": [{
                    "index": 0,
                    "delta": { "role": "assistant", "reasoning_content": reasoning },
                    "finish_reason": Value::Null
                }]
            })
        ));
    }

    if !text.is_empty() {
        chunks.push(format!(
            "data: {}\n\n",
            json!({
                "id": chat_id,
                "object": "chat.completion.chunk",
                "created": created,
                "model": model,
                "choices": [{
                    "index": 0,
                    "delta": { "role": "assistant", "content": text },
                    "finish_reason": Value::Null
                }]
            })
        ));
    }

    for (idx, tc) in tool_calls.iter().enumerate() {
        let id = tc.get("id").and_then(|v| v.as_str()).unwrap_or("call_1");
        let name = tc
            .pointer("/function/name")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let args = tc
            .pointer("/function/arguments")
            .and_then(|v| v.as_str())
            .unwrap_or("{}");
        chunks.push(format!(
            "data: {}\n\n",
            json!({
                "id": chat_id,
                "object": "chat.completion.chunk",
                "created": created,
                "model": model,
                "choices": [{
                    "index": 0,
                    "delta": {
                        "tool_calls": [{
                            "index": idx,
                            "id": id,
                            "type": "function",
                            "function": { "name": name, "arguments": args }
                        }]
                    },
                    "finish_reason": Value::Null
                }]
            })
        ));
    }

    let finish = if !tool_calls.is_empty() {
        "tool_calls"
    } else {
        "stop"
    };
    chunks.push(format!(
        "data: {}\n\n",
        json!({
            "id": chat_id,
            "object": "chat.completion.chunk",
            "created": created,
            "model": model,
            "choices": [{
                "index": 0,
                "delta": {},
                "finish_reason": finish
            }]
        })
    ));
    chunks.push("data: [DONE]\n\n".to_string());

    let payload = chunks.join("");
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "text/event-stream")
        .header(header::CACHE_CONTROL, "no-cache")
        .body(Body::from(payload))
        .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response())
}


//! OpenCode Zen Upstream Adapter for Local-CLI Bridge.

use axum::{
    body::Body,
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde_json::{json, Value};
use std::collections::HashMap;

use super::make_completion_response;
use crate::cred_store::ensure_fresh_credential;
use crate::paths::now_ms;

fn mint_opencode_id(prefix: &str, seed: u64) -> String {
    let hex_part = format!("{:012x}", seed & 0xffff_ffff_ffff);
    const BASE62: &[u8] = b"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    let mut tail = String::with_capacity(14);
    let mut x = seed
        .wrapping_mul(6364136223846793005)
        .wrapping_add(1442695040888963407);
    for _ in 0..14 {
        x = x.wrapping_mul(6364136223846793005).wrapping_add(1);
        let idx = ((x >> 32) as usize) % 62;
        tail.push(BASE62[idx] as char);
    }
    format!("{}_{}{}", prefix, hex_part, tail)
}

pub(crate) async fn handle_opencode_request(
    mut body: Value,
    model: &str,
    is_stream: bool,
) -> Response {
    let token = ensure_fresh_credential("opencode")
        .await
        .map(|c| c.access_token)
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "public".to_string());

    let clean_model = model.strip_prefix("opencode/").unwrap_or(model).to_string();
    body["model"] = Value::String(clean_model);
    // OpenCode Zen gateway rejects non-stream requests on free tier; always stream upstream.
    body["stream"] = Value::Bool(true);
    if let Some(obj) = body.as_object_mut() {
        obj.remove("stream_options");
    }

    let mut existing_tools = body
        .get("tools")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    let had_client_tools = !existing_tools.is_empty();

    for fname in ["bash", "glob", "grep", "read"] {
        let already = existing_tools.iter().any(|t| {
            t.pointer("/function/name")
                .or_else(|| t.get("name"))
                .and_then(|v| v.as_str())
                == Some(fname)
        });
        if !already {
            existing_tools.push(json!({
                "type": "function",
                "function": {
                    "name": fname,
                    "description": "This tool is currently unavailable and must not be used.",
                    "parameters": { "type": "object", "properties": {} }
                }
            }));
        }
    }
    body["tools"] = Value::Array(existing_tools);
    if !had_client_tools && body.get("tool_choice").is_none() {
        body["tool_choice"] = Value::String("none".to_string());
    }

    let now = now_ms();
    let ses_id = mint_opencode_id("ses", now);
    let msg_id = mint_opencode_id("msg", now.wrapping_add(1));

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(240))
        .build()
        .unwrap_or_default();

    let resp = match client
        .post("https://opencode.ai/zen/v1/chat/completions")
        .header("Content-Type", "application/json")
        .header("Accept", "text/event-stream")
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "opencode/1.18.31")
        .header("x-opencode-client", "desktop")
        .header("x-opencode-project", "global")
        .header("x-opencode-session", ses_id)
        .header("x-opencode-request", msg_id)
        .json(&body)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::BAD_GATEWAY,
                Json(json!({ "error": { "message": format!("OpenCode upstream error: {}", e) } })),
            )
                .into_response()
        }
    };

    if !resp.status().is_success() {
        let st = resp.status();
        let txt = resp.text().await.unwrap_or_default();
        return (
            st,
            Json(json!({ "error": { "message": format!("OpenCode error ({}): {}", st, txt) } })),
        )
            .into_response();
    }

    if is_stream {
        let stream = resp.bytes_stream();
        Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "text/event-stream")
            .header(header::CACHE_CONTROL, "no-cache")
            .body(Body::from_stream(stream))
            .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response())
    } else {
        let sse_txt = resp.text().await.unwrap_or_default();
        let mut full_text = String::new();
        let mut tool_order: Vec<usize> = Vec::new();
        let mut tool_map: HashMap<usize, (String, String, String)> = HashMap::new();

        for line in sse_txt.lines() {
            let trimmed = line.trim();
            if !trimmed.starts_with("data:") {
                continue;
            }
            let data_str = trimmed.trim_start_matches("data:").trim();
            if data_str.is_empty() || data_str == "[DONE]" {
                continue;
            }
            if let Ok(chunk) = serde_json::from_str::<Value>(data_str) {
                if let Some(delta) = chunk.pointer("/choices/0/delta") {
                    if let Some(c) = delta.get("content").and_then(|v| v.as_str()) {
                        full_text.push_str(c);
                    }
                    if let Some(tcs) = delta.get("tool_calls").and_then(|v| v.as_array()) {
                        for tc in tcs {
                            let idx = tc.get("index").and_then(|v| v.as_u64()).unwrap_or(0) as usize;
                            let entry = tool_map.entry(idx).or_insert_with(|| {
                                tool_order.push(idx);
                                (String::new(), String::new(), String::new())
                            });
                            if let Some(id) = tc.get("id").and_then(|v| v.as_str()) {
                                if !id.is_empty() {
                                    entry.0 = id.to_string();
                                }
                            }
                            if let Some(name) = tc.pointer("/function/name").and_then(|v| v.as_str())
                            {
                                if !name.is_empty() {
                                    entry.1.push_str(name);
                                }
                            }
                            if let Some(args) =
                                tc.pointer("/function/arguments").and_then(|v| v.as_str())
                            {
                                entry.2.push_str(args);
                            }
                        }
                    }
                }
            }
        }

        let mut tool_calls = Vec::new();
        for idx in tool_order {
            if let Some((id, name, args)) = tool_map.remove(&idx) {
                if !name.is_empty() {
                    let clean_id = if id.is_empty() {
                        format!("call_{}", idx)
                    } else {
                        id
                    };
                    let clean_args = if serde_json::from_str::<Value>(&args).is_ok() {
                        args
                    } else {
                        "{}".to_string()
                    };
                    tool_calls.push(json!({
                        "id": clean_id,
                        "type": "function",
                        "function": {
                            "name": name,
                            "arguments": clean_args
                        }
                    }));
                }
            }
        }

        make_completion_response(model, full_text, tool_calls)
    }
}


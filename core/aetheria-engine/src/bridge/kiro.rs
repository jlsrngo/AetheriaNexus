use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::{json, Value};

use super::kiro_event_stream::parse_kiro_event_stream;
use super::schema::sanitize_bedrock_schema;
use super::{extract_content_text, make_completion_response, make_sse_response_from_result};
use crate::cred_store::{ensure_fresh_credential, refresh_credential_source};
use crate::paths::gen_id;

// ============================================================================
// KIRO (AWS CodeWhisperer Binary EventStream)
// ============================================================================

pub(crate) async fn handle_kiro_request(body: Value, model: &str, is_stream: bool) -> Response {
    let cred = match ensure_fresh_credential("kiro").await {
        Some(c) => c,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({ "error": { "message": "Kiro CLI credentials not found or expired." } })),
            )
                .into_response()
        }
    };

    let kiro_model_id = model.strip_prefix("kiro/").unwrap_or("auto");
    let region = cred.region.as_deref().unwrap_or("us-east-1");
    let profile_arn = cred
        .profile_arn
        .as_deref()
        .filter(|s| !s.is_empty())
        .unwrap_or("arn:aws:codewhisperer:us-east-1:638616132270:profile/AAAACCCCXXXX")
        .to_string();
    let messages = body
        .get("messages")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let mut system_parts = Vec::new();
    let mut raw_turns: Vec<Value> = Vec::new();

    for m in &messages {
        let role = m.get("role").and_then(|v| v.as_str()).unwrap_or("user");
        if role == "system" || role == "developer" {
            let text = extract_content_text(m.get("content"));
            if !text.trim().is_empty() {
                system_parts.push(text);
            }
            continue;
        }
        if role == "tool" {
            let tool_call_id = m
                .get("tool_call_id")
                .or_else(|| m.get("id"))
                .and_then(|v| v.as_str())
                .unwrap_or("call_0");
            let content_str = match m.get("content") {
                Some(Value::String(s)) => s.clone(),
                Some(v) => serde_json::to_string(v).unwrap_or_default(),
                None => String::new(),
            };
            let tr = json!({
                "toolUseId": tool_call_id,
                "status": "success",
                "content": [{ "text": content_str }]
            });
            if let Some(last) = raw_turns.last_mut() {
                if last.get("role").and_then(|v| v.as_str()) == Some("user")
                    && last.get("isToolResultTurn").and_then(|v| v.as_bool()) == Some(true)
                {
                    if let Some(arr) = last.get_mut("toolResults").and_then(|v| v.as_array_mut()) {
                        arr.push(tr);
                        continue;
                    }
                }
            }
            raw_turns.push(json!({
                "role": "user",
                "content": "",
                "toolResults": [tr],
                "isToolResultTurn": true
            }));
            continue;
        }
        if role == "assistant" {
            let text = extract_content_text(m.get("content"));
            let mut tool_uses = Vec::new();
            if let Some(tcs) = m.get("tool_calls").and_then(|v| v.as_array()) {
                for tc in tcs {
                    let id = tc.get("id").and_then(|v| v.as_str()).unwrap_or("call_0");
                    let name = tc
                        .pointer("/function/name")
                        .or_else(|| tc.get("name"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("tool");
                    let args_val = match tc.pointer("/function/arguments") {
                        Some(Value::String(s)) => {
                            serde_json::from_str::<Value>(s).unwrap_or_else(|_| json!({}))
                        }
                        Some(v) if v.is_object() => v.clone(),
                        _ => json!({}),
                    };
                    tool_uses.push(json!({
                        "toolUseId": id,
                        "name": name,
                        "input": args_val
                    }));
                }
            }
            raw_turns.push(json!({
                "role": "assistant",
                "content": if text.is_empty() && !tool_uses.is_empty() { "Calling tools." } else if text.is_empty() { "OK" } else { &text },
                "toolUses": tool_uses
            }));
            continue;
        }
        let text = extract_content_text(m.get("content"));
        raw_turns.push(json!({
            "role": "user",
            "content": text
        }));
    }

    let mut kiro_tools = Vec::new();
    if let Some(tools) = body.get("tools").and_then(|v| v.as_array()) {
        for t in tools {
            let fn_obj = t.get("function").unwrap_or(t);
            if let Some(name) = fn_obj.get("name").and_then(|v| v.as_str()) {
                let desc = fn_obj
                    .get("description")
                    .and_then(|v| v.as_str())
                    .filter(|s| !s.is_empty())
                    .unwrap_or("Tool function");
                let schema = fn_obj
                    .get("parameters")
                    .cloned()
                    .unwrap_or_else(|| json!({ "type": "object", "properties": {} }));
                let clean_schema = sanitize_bedrock_schema(&schema);
                kiro_tools.push(json!({
                    "toolSpecification": {
                        "name": name,
                        "description": desc,
                        "inputSchema": { "json": clean_schema }
                    }
                }));
            }
        }
    }

    let mut history = Vec::new();
    let sys_prefix = if !system_parts.is_empty() {
        format!("{}\n\n", system_parts.join("\n\n"))
    } else {
        String::new()
    };

    let current_turn = raw_turns
        .pop()
        .unwrap_or_else(|| json!({ "role": "user", "content": "Hello" }));

    for (idx, turn) in raw_turns.iter().enumerate() {
        let role = turn.get("role").and_then(|v| v.as_str()).unwrap_or("user");
        if role == "user" {
            let mut text = turn
                .get("content")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            if idx == 0 && !sys_prefix.is_empty() {
                text = format!("{}{}", sys_prefix, text);
            }
            let mut u_msg = json!({
                "content": text,
                "modelId": kiro_model_id,
                "origin": "AI_EDITOR"
            });
            if let Some(trs) = turn.get("toolResults").and_then(|v| v.as_array()) {
                if !trs.is_empty() {
                    u_msg["userInputMessageContext"] = json!({ "toolResults": trs });
                }
            }
            history.push(json!({ "userInputMessage": u_msg }));
        } else {
            let text = turn
                .get("content")
                .and_then(|v| v.as_str())
                .unwrap_or("OK");
            let mut a_msg = json!({ "content": text });
            if let Some(tus) = turn.get("toolUses").and_then(|v| v.as_array()) {
                if !tus.is_empty() {
                    a_msg["toolUses"] = Value::Array(tus.clone());
                }
            }
            history.push(json!({ "assistantResponseMessage": a_msg }));
        }
    }

    let mut cur_content = current_turn
        .get("content")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if history.is_empty() && !sys_prefix.is_empty() {
        cur_content = format!("{}{}", sys_prefix, cur_content);
    }

    let mut cur_ctx = serde_json::Map::new();
    if !kiro_tools.is_empty() {
        cur_ctx.insert("tools".to_string(), Value::Array(kiro_tools));
    }
    if let Some(trs) = current_turn.get("toolResults").and_then(|v| v.as_array()) {
        if !trs.is_empty() {
            cur_ctx.insert("toolResults".to_string(), Value::Array(trs.clone()));
            if cur_content.is_empty() {
                cur_content = String::new();
            }
        }
    }
    if cur_content.is_empty() && !cur_ctx.contains_key("toolResults") {
        cur_content = "Continue.".to_string();
    }

    let mut cur_user_msg = json!({
        "content": cur_content,
        "modelId": kiro_model_id,
        "origin": "AI_EDITOR"
    });
    if !cur_ctx.is_empty() {
        cur_user_msg["userInputMessageContext"] = Value::Object(cur_ctx);
    }

    let payload = json!({
        "conversationState": {
            "chatTriggerType": "MANUAL",
            "conversationId": gen_id("conv"),
            "history": history,
            "currentMessage": {
                "userInputMessage": cur_user_msg
            }
        },
        "profileArn": profile_arn
    });

    let url = format!("https://q.{}.amazonaws.com/generateAssistantResponse", region);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(240))
        .build()
        .unwrap_or_default();

    let mut resp = match client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("Accept", "text/event-stream")
        .header("Authorization", format!("Bearer {}", cred.access_token))
        .header("x-amz-sso-bearer", &cred.access_token)
        .header("x-amzn-kiro-agent-mode", "spec")
        .header("x-amzn-codewhisperer-machine-id", "kiro-desktop")
        .header("x-amzn-codewhisperer-profile-arn", &profile_arn)
        .json(&payload)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::BAD_GATEWAY,
                Json(json!({ "error": { "message": format!("Kiro request error: {}", e) } })),
            )
                .into_response()
        }
    };

    if resp.status() == StatusCode::UNAUTHORIZED || resp.status() == StatusCode::FORBIDDEN {
        if let Some(refreshed) = refresh_credential_source("kiro", &cred).await {
            if let Ok(r2) = client
                .post(&url)
                .header("Content-Type", "application/json")
                .header("Accept", "text/event-stream")
                .header("Authorization", format!("Bearer {}", refreshed.access_token))
                .header("x-amz-sso-bearer", &refreshed.access_token)
                .header("x-amzn-kiro-agent-mode", "spec")
                .header("x-amzn-codewhisperer-machine-id", "kiro-desktop")
                .header("x-amzn-codewhisperer-profile-arn", &profile_arn)
                .json(&payload)
                .send()
                .await
            {
                resp = r2;
            }
        }
    }

    if !resp.status().is_success() {
        let status = resp.status();
        let err_txt = resp.text().await.unwrap_or_default();
        if status == StatusCode::FORBIDDEN || status == StatusCode::UNAUTHORIZED {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({ "error": { "message": "Kiro CLI credentials not found or expired. Please sign in via Settings or Kiro IDE." } })),
            )
                .into_response();
        }
        return (
            status,
            Json(json!({ "error": { "message": format!("Kiro upstream error ({}): {}", status, err_txt) } })),
        )
            .into_response();
    }

    let raw_bytes = match resp.bytes().await {
        Ok(b) => b,
        Err(e) => {
            return (
                StatusCode::BAD_GATEWAY,
                Json(json!({ "error": { "message": format!("Kiro stream read error: {}", e) } })),
            )
                .into_response()
        }
    };

    let (full_text, tool_calls) = parse_kiro_event_stream(&raw_bytes);
    if is_stream {
        make_sse_response_from_result(model, full_text, tool_calls)
    } else {
        make_completion_response(model, full_text, tool_calls)
    }
}

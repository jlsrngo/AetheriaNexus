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

use std::error::Error as StdError;
use std::sync::OnceLock;
use std::time::Duration;
use tokio::sync::{Mutex as AsyncMutex, Semaphore};
use tokio::time::Instant;

static KIRO_HTTP_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
static KIRO_HTTP1_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
static KIRO_CONCURRENCY_SEMAPHORE: OnceLock<Semaphore> = OnceLock::new();
static KIRO_NEXT_SLOT: OnceLock<AsyncMutex<Instant>> = OnceLock::new();

const KIRO_MIN_SPACING_MS: u64 = 1_000;

/// Limits concurrent in-flight Kiro upstream calls to strictly 1 at a time across parent & subagents.
fn kiro_concurrency_guard() -> &'static Semaphore {
    KIRO_CONCURRENCY_SEMAPHORE.get_or_init(|| Semaphore::new(1))
}

fn kiro_next_slot_lock() -> &'static AsyncMutex<Instant> {
    KIRO_NEXT_SLOT.get_or_init(|| AsyncMutex::new(Instant::now()))
}

/// Spaces outgoing Kiro dispatches by at least `KIRO_MIN_SPACING_MS` and respects any active cooldown.
async fn wait_for_kiro_pacing_slot() {
    let wait_until = {
        let mut next = kiro_next_slot_lock().lock().await;
        let now = Instant::now();
        let slot = if *next > now { *next } else { now };
        *next = slot + Duration::from_millis(KIRO_MIN_SPACING_MS);
        slot
    };
    let now = Instant::now();
    if wait_until > now {
        tokio::time::sleep_until(wait_until).await;
    }
}

/// Pushes the shared pacing window forward when AWS Kiro asks callers to cool down.
async fn push_kiro_cooldown(delay_ms: u64) {
    let target = Instant::now() + Duration::from_millis(delay_ms);
    let mut next = kiro_next_slot_lock().lock().await;
    if target > *next {
        *next = target;
    }
}

enum KiroPostResult {
    Success(reqwest::Response),
    HttpError(StatusCode, String),
}

fn kiro_primary_client() -> &'static reqwest::Client {
    KIRO_HTTP_CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(30))
            .timeout(Duration::from_secs(240))
            .tcp_keepalive(Duration::from_secs(30))
            .pool_idle_timeout(Duration::from_secs(30))
            .build()
            .unwrap_or_default()
    })
}

fn kiro_http1_client() -> &'static reqwest::Client {
    KIRO_HTTP1_CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .http1_only()
            .connect_timeout(Duration::from_secs(30))
            .timeout(Duration::from_secs(240))
            .tcp_keepalive(Duration::from_secs(30))
            .pool_max_idle_per_host(0)
            .build()
            .unwrap_or_default()
    })
}

fn format_reqwest_error_chain(err: &reqwest::Error) -> String {
    let mut parts = vec![err.to_string()];
    let mut cur: Option<&(dyn StdError + 'static)> = err.source();
    while let Some(src) = cur {
        let s = src.to_string();
        if !parts.last().map(|p| p == &s).unwrap_or(false) {
            parts.push(s);
        }
        cur = src.source();
    }
    parts.join(" <- ")
}

async fn send_kiro_post_with_retry(
    url: &str,
    access_token: &str,
    profile_arn: &str,
    payload: &Value,
) -> Result<KiroPostResult, String> {
    const MAX_ATTEMPTS: usize = 6;
    let mut last_err = String::new();
    let _permit = kiro_concurrency_guard().acquire().await.ok();

    for attempt in 0..MAX_ATTEMPTS {
        wait_for_kiro_pacing_slot().await;
        let client = if attempt == MAX_ATTEMPTS - 1 {
            kiro_http1_client()
        } else {
            kiro_primary_client()
        };

        match client
            .post(url)
            .header("Content-Type", "application/json")
            .header("Accept", "text/event-stream")
            .header("Authorization", format!("Bearer {}", access_token))
            .header("x-amz-sso-bearer", access_token)
            .header("x-amzn-kiro-agent-mode", "spec")
            .header("x-amzn-codewhisperer-machine-id", "kiro-desktop")
            .header("x-amzn-codewhisperer-profile-arn", profile_arn)
            .json(payload)
            .send()
            .await
        {
            Ok(resp) => {
                if resp.status().is_success() {
                    return Ok(KiroPostResult::Success(resp));
                }
                let status = resp.status();
                let code = status.as_u16();
                let retry_after_ms_hdr = resp
                    .headers()
                    .get("retry-after-ms")
                    .and_then(|v| v.to_str().ok())
                    .map(|s| s.to_string());
                let retry_after_hdr = resp
                    .headers()
                    .get("retry-after")
                    .and_then(|v| v.to_str().ok())
                    .map(|s| s.to_string());
                let err_txt = resp.text().await.unwrap_or_default();

                // Stop immediately if monthly/billing quota genuinely exhausted (do not sleep repeatedly)
                if code == 429
                    && crate::session::provider_error::is_hard_quota_exhausted(code, &err_txt)
                {
                    return Ok(KiroPostResult::HttpError(status, err_txt));
                }

                if (code == 429 || matches!(code, 502 | 503 | 504)) && attempt + 1 < MAX_ATTEMPTS {
                    let parsed_after = crate::session::agent_turn::retry::parse_retry_after_ms(
                        retry_after_ms_hdr.as_deref(),
                        retry_after_hdr.as_deref(),
                    )
                    .map(|ms| ms.min(30_000));
                    let backoff_ms = parsed_after.unwrap_or_else(|| {
                        crate::session::agent_turn::retry::compute_retry_backoff_ms(
                            attempt + 1,
                            false,
                            None,
                        )
                    });
                    push_kiro_cooldown(backoff_ms).await;
                    crate::paths::log_engine(
                        "bridge",
                        &format!(
                            "⚠️ Kiro transient HTTP {}; retrying ({}/{}) after {}ms...",
                            code,
                            attempt + 1,
                            MAX_ATTEMPTS - 1,
                            backoff_ms
                        ),
                    );
                    tokio::time::sleep(Duration::from_millis(backoff_ms)).await;
                    continue;
                }
                return Ok(KiroPostResult::HttpError(status, err_txt));
            }
            Err(e) => {
                last_err = format_reqwest_error_chain(&e);
                crate::paths::log_engine(
                    "bridge",
                    &format!(
                        "⚠️ Kiro request transport error (attempt {}/{}): {}",
                        attempt + 1,
                        MAX_ATTEMPTS,
                        last_err
                    ),
                );
                if attempt + 1 < MAX_ATTEMPTS {
                    let backoff_ms = 800 * (attempt as u64 + 1);
                    tokio::time::sleep(Duration::from_millis(backoff_ms)).await;
                }
            }
        }
    }

    Err(last_err)
}

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

    let mut post_res = match send_kiro_post_with_retry(&url, &cred.access_token, &profile_arn, &payload).await {
        Ok(r) => r,
        Err(err_chain) => {
            return (
                StatusCode::BAD_GATEWAY,
                Json(json!({ "error": { "message": format!("Kiro request error: {}", err_chain) } })),
            )
                .into_response()
        }
    };

    if matches!(
        post_res,
        KiroPostResult::HttpError(StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN, _)
    ) {
        if let Some(refreshed) = refresh_credential_source("kiro", &cred).await {
            if let Ok(r2) = send_kiro_post_with_retry(&url, &refreshed.access_token, &profile_arn, &payload).await {
                post_res = r2;
            }
        }
    }

    let resp = match post_res {
        KiroPostResult::Success(r) => r,
        KiroPostResult::HttpError(status, err_txt) => {
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
    };

    let raw_bytes = match resp.bytes().await {
        Ok(b) => b,
        Err(e) => {
            return (
                StatusCode::BAD_GATEWAY,
                Json(json!({ "error": { "message": format!("Kiro stream read error: {}", format_reqwest_error_chain(&e)) } })),
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn kiro_clients_initialize_cleanly() {
        let _ = kiro_primary_client();
        let _ = kiro_http1_client();
    }
}

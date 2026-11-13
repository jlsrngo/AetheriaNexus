//! Single-Step Resilient HTTP Sender for Parent Agent Turn
//! Handles transient HTTP retries, local bridge auto-heal, emergency compaction heal,
//! quota failover to Kenari, and multimodal vision-to-text fallback.

use crate::bridge::LOCAL_CLI_BRIDGE_PORT;
use crate::session::message::emit_event;
use serde_json::{json, Value};

use super::resilience::{
    compute_retry_backoff_ms, is_unreachable_network_error, sanitize_multimodal_messages_to_text,
};
use super::retry::parse_retry_after_ms;
use super::stream_emit::StreamStepOutput;
use super::stream_sse::{read_step_response, StreamReadError};
use crate::session::coordinator::{subscribe_session_interrupt, wait_session_interrupt};
use crate::session::provider_error::{
    classify_provider_failure, ClassifiedProviderError, ProviderErrorKind,
};

pub(crate) enum StepStreamOutcome {
    Completed(StreamStepOutput),
    Aborted {
        partial_parts: Vec<Value>,
        during_stream: bool,
    },
    Failed(StepHttpError),
}

async fn sleep_interruptible(
    delay_ms: u64,
    interrupt_rx: &tokio::sync::watch::Receiver<bool>,
) -> bool {
    tokio::select! {
        biased;
        _ = wait_session_interrupt(interrupt_rx.clone()) => false,
        _ = tokio::time::sleep(std::time::Duration::from_millis(delay_ms)) => true,
    }
}

async fn send_post_interruptible(
    client: &reqwest::Client,
    base_url: &str,
    api_key: &str,
    body: &Value,
    interrupt_rx: &tokio::sync::watch::Receiver<bool>,
) -> Result<Result<reqwest::Response, reqwest::Error>, ()> {
    tokio::select! {
        biased;
        _ = wait_session_interrupt(interrupt_rx.clone()) => Err(()),
        res = send_raw_post(client, base_url, api_key, body) => Ok(res),
    }
}

#[derive(Debug, Clone)]
pub(crate) struct StepHttpError {
    pub status: Option<u16>,
    pub category: String,
    pub message: String,
    pub retryable: bool,
}

impl StepHttpError {
    fn from_classified(c: ClassifiedProviderError) -> Self {
        Self {
            status: c.status,
            category: c.category.to_string(),
            message: c.message,
            retryable: c.retryable,
        }
    }

    fn transport(category: &'static str, message: String) -> Self {
        Self {
            status: None,
            category: category.to_string(),
            message,
            retryable: true,
        }
    }

    fn aborted() -> Self {
        Self {
            status: None,
            category: "aborted".to_string(),
            message: "Execution interrupted by user.".to_string(),
            retryable: false,
        }
    }

    fn aborted_in_flight() -> Self {
        Self {
            status: None,
            category: "aborted-in-flight".to_string(),
            message: "Execution interrupted by user.".to_string(),
            retryable: false,
        }
    }
}

enum StepSendOutcome {
    Response(reqwest::Response),
    ErrorBody(u16, String),
    Transport(reqwest::Error),
}

pub(crate) struct StepHttpContext<'a> {
    pub client: &'a reqwest::Client,
    pub cfg: &'a Value,
    pub session_id: &'a str,
    pub workspace_dir: &'a str,
    pub is_local_bridge: bool,
    pub step_limit_reached: bool,
    pub current_provider_id: &'a mut String,
    pub current_model_id: &'a mut String,
    pub base_url: &'a mut String,
    pub api_key: &'a mut String,
    pub chat_messages: &'a mut Vec<Value>,
}

fn is_transient_gateway_status(code: u16) -> bool {
    matches!(code, 408 | 502 | 503 | 504)
}

fn parse_should_retry_header(headers: &reqwest::header::HeaderMap) -> Option<bool> {
    let val = headers
        .get("x-should-retry")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.trim().to_ascii_lowercase())?;
    match val.as_str() {
        "false" | "0" | "no" => Some(false),
        "true" | "1" | "yes" => Some(true),
        _ => None,
    }
}

fn retry_delay_from_headers(headers: &reqwest::header::HeaderMap, attempt: usize) -> u64 {
    let retry_after_ms = headers
        .get("retry-after-ms")
        .and_then(|v| v.to_str().ok());
    let retry_after = headers
        .get("retry-after")
        .and_then(|v| v.to_str().ok());
    parse_retry_after_ms(retry_after_ms, retry_after)
        .unwrap_or_else(|| compute_retry_backoff_ms(attempt, false, None))
}

async fn emit_retry_and_sleep(
    workspace_dir: &str,
    session_id: &str,
    attempt: usize,
    delay_ms: u64,
    reason: &str,
    interrupt_rx: &tokio::sync::watch::Receiver<bool>,
) -> bool {
    emit_event(
        workspace_dir,
        "session.retry.scheduled",
        json!({
            "sessionID": session_id,
            "attempt": attempt,
            "delayMs": delay_ms,
            "reason": reason,
        }),
    );
    sleep_interruptible(delay_ms, interrupt_rx).await
}

pub(crate) async fn execute_step_and_stream(
    ctx: &mut StepHttpContext<'_>,
    tools_def: &[Value],
    assistant_msg_id: &str,
) -> StepStreamOutcome {
    let interrupt_rx = subscribe_session_interrupt(ctx.session_id);
    let mut stream_attempt = 0usize;

    loop {
        if *interrupt_rx.borrow() {
            return StepStreamOutcome::Aborted {
                partial_parts: Vec::new(),
                during_stream: false,
            };
        }
        let resp = match execute_step_http_request(ctx, tools_def).await {
            Ok(r) => r,
            Err(e) if e.category == "aborted-in-flight" => {
                return StepStreamOutcome::Aborted {
                    partial_parts: Vec::new(),
                    during_stream: true,
                };
            }
            Err(e) if e.category == "aborted" => {
                return StepStreamOutcome::Aborted {
                    partial_parts: Vec::new(),
                    during_stream: false,
                };
            }
            Err(e) => return StepStreamOutcome::Failed(e),
        };
        match read_step_response(
            resp,
            ctx.workspace_dir,
            ctx.session_id,
            assistant_msg_id,
            interrupt_rx.clone(),
        )
        .await
        {
            Ok(out) => return StepStreamOutcome::Completed(out),
            Err(StreamReadError::AbortedByUser { content_parts }) => {
                return StepStreamOutcome::Aborted {
                    partial_parts: content_parts,
                    during_stream: true,
                };
            }
            Err(StreamReadError::ProviderChunkError(c)) => {
                return StepStreamOutcome::Failed(StepHttpError::from_classified(c));
            }
            Err(StreamReadError::InterruptedMidStream(reason)) => {
                if stream_attempt >= 5 {
                    return StepStreamOutcome::Failed(StepHttpError::transport(
                        "provider.transport",
                        reason,
                    ));
                }
                stream_attempt += 1;
                let delay_ms = compute_retry_backoff_ms(stream_attempt, false, None);
                if !emit_retry_and_sleep(
                    ctx.workspace_dir,
                    ctx.session_id,
                    stream_attempt + 1,
                    delay_ms,
                    &reason,
                    &interrupt_rx,
                )
                .await
                {
                    return StepStreamOutcome::Aborted {
                        partial_parts: Vec::new(),
                        during_stream: false,
                    };
                }
            }
        }
    }
}

pub(crate) async fn execute_step_http_request(
    ctx: &mut StepHttpContext<'_>,
    tools_def: &[Value],
) -> Result<reqwest::Response, StepHttpError> {
    let interrupt_rx = subscribe_session_interrupt(ctx.session_id);
    let mut req_body = build_step_request_body(ctx, tools_def);
    let send_outcome = send_step_with_retries(ctx, &req_body, &interrupt_rx).await?;

    let err_pair = match send_outcome {
        StepSendOutcome::Response(ok_r) if ok_r.status().is_success() => return Ok(ok_r),
        StepSendOutcome::Response(err_r) => {
            let status_code = err_r.status().as_u16();
            (status_code, err_r.text().await.unwrap_or_default())
        }
        StepSendOutcome::ErrorBody(code, err_body) => (code, err_body),
        StepSendOutcome::Transport(e) => {
            let healed = heal_bridge_or_fail(ctx, &req_body, e).await?;
            if healed.status().is_success() {
                return Ok(healed);
            }
            let status_code = healed.status().as_u16();
            (status_code, healed.text().await.unwrap_or_default())
        }
    };

    recover_error_response(ctx, &mut req_body, err_pair.0, &err_pair.1).await
}

fn build_step_request_body(ctx: &StepHttpContext<'_>, tools_def: &[Value]) -> Value {
    let mut outbound_messages = ctx.chat_messages.clone();
    if ctx.step_limit_reached {
        outbound_messages.push(json!({
            "role": "assistant",
            "content": crate::session::coordinator::MAX_STEPS_PROMPT
        }));
    }
    let mut req_body = json!({
        "model": *ctx.current_model_id,
        "messages": outbound_messages,
        "stream": true,
        "stream_options": { "include_usage": true }
    });
    if !tools_def.is_empty() {
        req_body["tools"] = Value::Array(tools_def.to_vec());
        if ctx.step_limit_reached {
            req_body["tool_choice"] = json!("none");
        }
    }
    req_body
}

async fn send_step_with_retries(
    ctx: &mut StepHttpContext<'_>,
    req_body: &Value,
    interrupt_rx: &tokio::sync::watch::Receiver<bool>,
) -> Result<StepSendOutcome, StepHttpError> {
    let mut net_attempt = 0usize;
    let mut timeout_attempt = 0usize;

    loop {
        let active_key =
            crate::provider::protocol_adapters::select_healthy_api_key(ctx.api_key);
        let send_res = send_post_interruptible(
            ctx.client,
            ctx.base_url,
            &active_key,
            req_body,
            interrupt_rx,
        )
        .await
        .map_err(|()| StepHttpError::aborted_in_flight())?;

        match send_res {
            Ok(ok_r) => {
                if ok_r.status().is_success() {
                    return Ok(StepSendOutcome::Response(ok_r));
                }
                if let Some(outcome) =
                    handle_http_error_status(ctx, ok_r, &mut net_attempt, interrupt_rx).await?
                {
                    return Ok(outcome);
                }
            }
            Err(net_e)
                if net_e.is_timeout()
                    && timeout_attempt < crate::session::agent_turn::retry::MAX_TIMEOUT_RETRIES =>
            {
                timeout_attempt += 1;
                let delay_ms = compute_retry_backoff_ms(timeout_attempt, false, None);
                crate::paths::log_engine(
                    "ai",
                    &format!(
                        "⏱️ Upstream request timeout; backing off {}ms (retry #{}/{})...",
                        delay_ms,
                        timeout_attempt,
                        crate::session::agent_turn::retry::MAX_TIMEOUT_RETRIES
                    ),
                );
                if !emit_retry_and_sleep(
                    ctx.workspace_dir,
                    ctx.session_id,
                    timeout_attempt + 1,
                    delay_ms,
                    "Provider request timed out",
                    interrupt_rx,
                )
                .await
                {
                    return Err(StepHttpError::aborted());
                }
            }
            Err(net_e) if net_attempt < 2 && !net_e.is_timeout() => {
                net_attempt += 1;
                let err_s = net_e.to_string();
                if ctx.is_local_bridge
                    || ctx
                        .base_url
                        .contains(&format!(":{}", LOCAL_CLI_BRIDGE_PORT))
                {
                    let new_port = crate::bridge::ensure_bridge_running().await;
                    *ctx.base_url = format!("http://127.0.0.1:{}/v1", new_port);
                }
                let delay_ms = compute_retry_backoff_ms(
                    net_attempt,
                    is_unreachable_network_error(&err_s),
                    None,
                );
                crate::paths::log_engine(
                    "ai",
                    &format!(
                        "🔄 Transient network error ({}); backing off {}ms (retry #{}/2)...",
                        err_s, delay_ms, net_attempt
                    ),
                );
                if !emit_retry_and_sleep(
                    ctx.workspace_dir,
                    ctx.session_id,
                    net_attempt + 1,
                    delay_ms,
                    &err_s,
                    interrupt_rx,
                )
                .await
                {
                    return Err(StepHttpError::aborted());
                }
            }
            Err(net_e) => return Ok(StepSendOutcome::Transport(net_e)),
        }
    }
}

async fn handle_http_error_status(
    ctx: &StepHttpContext<'_>,
    resp: reqwest::Response,
    net_attempt: &mut usize,
    interrupt_rx: &tokio::sync::watch::Receiver<bool>,
) -> Result<Option<StepSendOutcome>, StepHttpError> {
    let code = resp.status().as_u16();
    let should_retry_hdr = parse_should_retry_header(resp.headers());

    if should_retry_hdr == Some(false) {
        let err_body = resp.text().await.unwrap_or_default();
        return Ok(Some(StepSendOutcome::ErrorBody(code, err_body)));
    }

    if should_retry_hdr == Some(true) && *net_attempt < 5 {
        *net_attempt += 1;
        let delay_ms = retry_delay_from_headers(resp.headers(), *net_attempt);
        let _ = resp.text().await.unwrap_or_default();
        if !emit_retry_and_sleep(
            ctx.workspace_dir,
            ctx.session_id,
            *net_attempt + 1,
            delay_ms,
            &format!("HTTP {} (x-should-retry)", code),
            interrupt_rx,
        )
        .await
        {
            return Err(StepHttpError::aborted());
        }
        return Ok(None);
    }

    if code == 429 {
        let headers = resp.headers().clone();
        let err_body = resp.text().await.unwrap_or_default();
        let c429 = classify_provider_failure(Some(code), &err_body);
        if c429.kind == ProviderErrorKind::RateLimit && *net_attempt < 5 {
            *net_attempt += 1;
            let delay_ms = retry_delay_from_headers(&headers, *net_attempt);
            crate::paths::log_engine(
                "ai",
                &format!(
                    "⏳ Upstream HTTP 429 throttle; backing off {}ms (retry #{}/5)...",
                    delay_ms, *net_attempt
                ),
            );
            if !emit_retry_and_sleep(
                ctx.workspace_dir,
                ctx.session_id,
                *net_attempt + 1,
                delay_ms,
                &c429.message,
                interrupt_rx,
            )
            .await
            {
                return Err(StepHttpError::aborted());
            }
            return Ok(None);
        }
        return Ok(Some(StepSendOutcome::ErrorBody(code, err_body)));
    }

    if is_transient_gateway_status(code) && *net_attempt < 5 {
        *net_attempt += 1;
        let delay_ms = retry_delay_from_headers(resp.headers(), *net_attempt);
        crate::paths::log_engine(
            "ai",
            &format!(
                "⏳ Upstream HTTP {} transient error; backing off {}ms (retry #{}/5)...",
                code, delay_ms, *net_attempt
            ),
        );
        if !emit_retry_and_sleep(
            ctx.workspace_dir,
            ctx.session_id,
            *net_attempt + 1,
            delay_ms,
            &format!("HTTP {}", code),
            interrupt_rx,
        )
        .await
        {
            return Err(StepHttpError::aborted());
        }
        return Ok(None);
    }

    Ok(Some(StepSendOutcome::Response(resp)))
}

async fn heal_bridge_or_fail(
    ctx: &mut StepHttpContext<'_>,
    req_body: &Value,
    net_err: reqwest::Error,
) -> Result<reqwest::Response, StepHttpError> {
    crate::paths::log_engine(
        "ai",
        &format!(
            "⚠️ Connection error to AI endpoint {}: {}",
            ctx.base_url, net_err
        ),
    );
    let is_bridge = ctx.is_local_bridge
        || ctx
            .base_url
            .contains(&format!(":{}", LOCAL_CLI_BRIDGE_PORT));
    if !is_bridge {
        return Err(StepHttpError::transport(
            "provider.transport",
            format!("Failed to reach AI provider ({}).", net_err),
        ));
    }

    crate::paths::log_engine("ai", "🔄 Auto-healing Local-CLI Bridge and retrying turn...");
    let new_port = crate::bridge::ensure_bridge_running().await;
    *ctx.base_url = format!("http://127.0.0.1:{}/v1", new_port);
    tokio::time::sleep(std::time::Duration::from_millis(300)).await;
    send_raw_post(ctx.client, ctx.base_url, ctx.api_key, req_body)
        .await
        .map_err(|re| {
            StepHttpError::transport(
                "provider.transport",
                format!("Failed to reach AI provider ({}).", re),
            )
        })
}

async fn post_recovery_request(
    client: &reqwest::Client,
    base_url: &str,
    api_key: &str,
    req_body: &Value,
    err_ctx: &str,
    classify_timeout: bool,
) -> Result<reqwest::Response, StepHttpError> {
    let resp = send_raw_post(client, base_url, api_key, req_body)
        .await
        .map_err(|e| {
            let category = if classify_timeout && e.is_timeout() {
                "provider.timeout"
            } else {
                "provider.transport"
            };
            StepHttpError::transport(category, format!("{}: {}", err_ctx, e))
        })?;
    if !resp.status().is_success() {
        let st = resp.status().as_u16();
        let body = resp.text().await.unwrap_or_default();
        return Err(StepHttpError::from_classified(classify_provider_failure(
            Some(st),
            &body,
        )));
    }
    Ok(resp)
}

async fn recover_error_response(
    ctx: &mut StepHttpContext<'_>,
    req_body: &mut Value,
    status_code: u16,
    err_txt: &str,
) -> Result<reqwest::Response, StepHttpError> {
    let classified = classify_provider_failure(Some(status_code), err_txt);

    if classified.kind == ProviderErrorKind::ContextOverflow && !ctx.chat_messages.is_empty() {
        crate::paths::log_engine(
            "ai",
            "🩹 Context window overflow detected! Triggering compaction recovery...",
        );
        crate::session::compaction_emergency::compact_overflow_with_model(
            ctx.client,
            ctx.base_url,
            ctx.api_key,
            ctx.current_model_id,
            ctx.session_id,
            ctx.workspace_dir,
            ctx.chat_messages,
        )
        .await;
        req_body["messages"] = Value::Array(ctx.chat_messages.clone());
        return post_recovery_request(
            ctx.client,
            ctx.base_url,
            ctx.api_key,
            req_body,
            "Error reaching AI provider during overflow retry",
            true,
        )
        .await;
    }

    if matches!(
        classified.kind,
        ProviderErrorKind::QuotaExceeded | ProviderErrorKind::RateLimit
    ) {
        let hard_quota = classified.kind == ProviderErrorKind::QuotaExceeded;
        let cur_key = crate::provider::protocol_adapters::select_healthy_api_key(ctx.api_key);
        if let Some(next_key) = crate::provider::protocol_adapters::rotate_api_key_on_quota(
            ctx.api_key,
            &cur_key,
            60_000,
        ) {
            return post_recovery_request(
                ctx.client,
                ctx.base_url,
                &next_key,
                req_body,
                "Error during multi-key rotation retry",
                false,
            )
            .await;
        }
        if hard_quota
            && (*ctx.current_provider_id != "kenari"
                || *ctx.current_model_id != "llama-3-3-70b-instruct:free")
        {
            if let Some(resolved_key) = resolve_configured_kenari_key(ctx.cfg) {
                crate::paths::log_engine(
                    "ai",
                    "Provider quota/balance limit reached. Failing over to Kenari free model...",
                );
                emit_event(
                    ctx.workspace_dir,
                    "session.failover",
                    json!({
                        "sessionID": ctx.session_id,
                        "fromProvider": *ctx.current_provider_id,
                        "fromModel": *ctx.current_model_id,
                        "toProvider": "kenari",
                        "toModel": "llama-3-3-70b-instruct:free",
                        "reason": "Quota or balance limit reached"
                    }),
                );
                *ctx.current_provider_id = "kenari".to_string();
                *ctx.current_model_id = "llama-3-3-70b-instruct:free".to_string();
                *ctx.base_url = "https://kenari.id/v1".to_string();
                *ctx.api_key = resolved_key;
                req_body["model"] = json!(*ctx.current_model_id);
                return post_recovery_request(
                    ctx.client,
                    ctx.base_url,
                    ctx.api_key,
                    req_body,
                    "Error reaching AI provider during failover",
                    false,
                )
                .await;
            }
        }
        return Err(StepHttpError::from_classified(classified));
    }

    if err_txt.contains("upstream_rejected") && sanitize_multimodal_messages_to_text(ctx.chat_messages)
    {
        req_body["messages"] = Value::Array(ctx.chat_messages.clone());
        return post_recovery_request(
            ctx.client,
            ctx.base_url,
            ctx.api_key,
            req_body,
            "Error reaching AI provider during retry",
            false,
        )
        .await;
    }

    Err(StepHttpError::from_classified(classified))
}

async fn send_raw_post(
    client: &reqwest::Client,
    base_url: &str,
    api_key: &str,
    body: &Value,
) -> Result<reqwest::Response, reqwest::Error> {
    client
        .post(format!("{}/chat/completions", base_url))
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(body)
        .send()
        .await
}

fn resolve_configured_kenari_key(cfg: &Value) -> Option<String> {
    const POINTERS: [&str; 6] = [
        "/providers/kenari/options/apiKey",
        "/provider/kenari/options/apiKey",
        "/providers/kenari/apiKey",
        "/provider/kenari/apiKey",
        "/providers/kenari/request/body/apiKey",
        "/provider/kenari/request/body/apiKey",
    ];
    for ptr in POINTERS {
        if let Some(key) = cfg
            .pointer(ptr)
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|k| !k.is_empty())
        {
            return Some(key.to_string());
        }
    }
    std::env::var("KENARI_API_KEY")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|k| !k.is_empty())
}

#[cfg(test)]
mod tests {
    use super::{is_transient_gateway_status, resolve_configured_kenari_key};
    use serde_json::json;

    #[test]
    fn test_transient_gateway_status_classification() {
        assert!(is_transient_gateway_status(408));
        assert!(is_transient_gateway_status(502));
        assert!(is_transient_gateway_status(503));
        assert!(is_transient_gateway_status(504));
        assert!(!is_transient_gateway_status(401));
        assert!(!is_transient_gateway_status(429));
    }

    #[test]
    fn test_resolve_configured_kenari_key_prefers_config_and_ignores_missing() {
        let empty = json!({});
        if std::env::var("KENARI_API_KEY").unwrap_or_default().trim().is_empty() {
            assert_eq!(resolve_configured_kenari_key(&empty), None);
        }

        let cfg = json!({
            "providers": { "kenari": { "options": { "apiKey": "  kn-user-test-key  " } } }
        });
        assert_eq!(
            resolve_configured_kenari_key(&cfg).as_deref(),
            Some("kn-user-test-key")
        );
    }
}


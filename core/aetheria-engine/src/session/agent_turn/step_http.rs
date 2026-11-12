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
use crate::session::provider_error::{
    classify_provider_failure, ClassifiedProviderError, ProviderErrorKind,
};

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
    pub current_provider_id: &'a mut String,
    pub current_model_id: &'a mut String,
    pub base_url: &'a mut String,
    pub api_key: &'a mut String,
    pub chat_messages: &'a mut Vec<Value>,
}

fn is_transient_gateway_status(code: u16) -> bool {
    matches!(code, 408 | 502 | 503 | 504)
}

pub(crate) async fn execute_step_http_request(
    ctx: &mut StepHttpContext<'_>,
    tools_def: &[Value],
) -> Result<reqwest::Response, StepHttpError> {
    let mut req_body = json!({
        "model": *ctx.current_model_id,
        "messages": *ctx.chat_messages,
        "stream": false
    });
    if !tools_def.is_empty() {
        req_body["tools"] = Value::Array(tools_def.to_vec());
    }

    let mut net_attempt = 0usize;
    let send_outcome = loop {
        let active_key =
            crate::provider::protocol_adapters::select_healthy_api_key(ctx.api_key);
        let send_res = ctx
            .client
            .post(format!("{}/chat/completions", ctx.base_url))
            .header("Content-Type", "application/json")
            .header("Authorization", format!("Bearer {}", active_key))
            .json(&req_body)
            .send()
            .await;

        match send_res {
            Ok(ok_r) => {
                if ok_r.status().is_success() {
                    break StepSendOutcome::Response(ok_r);
                }
                let code = ok_r.status().as_u16();
                let retry_after_ms_hdr = ok_r
                    .headers()
                    .get("retry-after-ms")
                    .and_then(|v| v.to_str().ok())
                    .map(|s| s.to_string());
                let retry_after_hdr = ok_r
                    .headers()
                    .get("retry-after")
                    .and_then(|v| v.to_str().ok())
                    .map(|s| s.to_string());

                if code == 429 {
                    let err_body = ok_r.text().await.unwrap_or_default();
                    let c429 = classify_provider_failure(Some(code), &err_body);
                    if c429.kind == ProviderErrorKind::RateLimit && net_attempt < 5 {
                        net_attempt += 1;
                        let delay_ms = parse_retry_after_ms(
                            retry_after_ms_hdr.as_deref(),
                            retry_after_hdr.as_deref(),
                        )
                        .unwrap_or_else(|| compute_retry_backoff_ms(net_attempt, false, None));
                        crate::paths::log_engine(
                            "ai",
                            &format!(
                                "⏳ Upstream HTTP 429 throttle; backing off {}ms (retry #{}/5)...",
                                delay_ms, net_attempt
                            ),
                        );
                        emit_event(
                            ctx.workspace_dir,
                            "session.retry.scheduled",
                            json!({
                                "sessionID": ctx.session_id,
                                "attempt": net_attempt + 1,
                                "delayMs": delay_ms,
                                "reason": c429.message,
                            }),
                        );
                        tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;
                        continue;
                    }
                    break StepSendOutcome::ErrorBody(code, err_body);
                }

                if is_transient_gateway_status(code) && net_attempt < 5 {
                    net_attempt += 1;
                    let delay_ms = parse_retry_after_ms(
                        retry_after_ms_hdr.as_deref(),
                        retry_after_hdr.as_deref(),
                    )
                    .unwrap_or_else(|| compute_retry_backoff_ms(net_attempt, false, None));
                    crate::paths::log_engine(
                        "ai",
                        &format!(
                            "⏳ Upstream HTTP {} transient error; backing off {}ms (retry #{}/5)...",
                            code, delay_ms, net_attempt
                        ),
                    );
                    emit_event(
                        ctx.workspace_dir,
                        "session.retry.scheduled",
                        json!({
                            "sessionID": ctx.session_id,
                            "attempt": net_attempt + 1,
                            "delayMs": delay_ms,
                            "reason": format!("HTTP {}", code),
                        }),
                    );
                    tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;
                    continue;
                }
                break StepSendOutcome::Response(ok_r);
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
                let is_unreach = is_unreachable_network_error(&err_s);
                let delay_ms = compute_retry_backoff_ms(net_attempt, is_unreach, None);
                crate::paths::log_engine(
                    "ai",
                    &format!(
                        "🔄 Transient network error ({}); backing off {}ms (retry #{}/2)...",
                        err_s, delay_ms, net_attempt
                    ),
                );
                tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;
            }
            Err(net_e) => break StepSendOutcome::Transport(net_e),
        }
    };

    let (mut r, pre_err): (Option<reqwest::Response>, Option<(u16, String)>) = match send_outcome {
        StepSendOutcome::Response(ok_r) => (Some(ok_r), None),
        StepSendOutcome::ErrorBody(code, err_body) => (None, Some((code, err_body))),
        StepSendOutcome::Transport(e) => {
            crate::paths::log_engine(
                "ai",
                &format!("⚠️ Connection error to AI endpoint {}: {}", ctx.base_url, e),
            );
            if ctx.is_local_bridge
                || ctx
                    .base_url
                    .contains(&format!(":{}", LOCAL_CLI_BRIDGE_PORT))
            {
                crate::paths::log_engine("ai", "🔄 Auto-healing Local-CLI Bridge and retrying turn...");
                let new_port = crate::bridge::ensure_bridge_running().await;
                *ctx.base_url = format!("http://127.0.0.1:{}/v1", new_port);
                tokio::time::sleep(std::time::Duration::from_millis(300)).await;
                let healed = ctx
                    .client
                    .post(format!("{}/chat/completions", ctx.base_url))
                    .header("Content-Type", "application/json")
                    .header("Authorization", format!("Bearer {}", ctx.api_key))
                    .json(&req_body)
                    .send()
                    .await
                    .map_err(|re| {
                        StepHttpError::transport(
                            if re.is_timeout() {
                                "provider.timeout"
                            } else {
                                "provider.transport"
                            },
                            format!("Failed to reach AI provider ({}).", re),
                        )
                    })?;
                (Some(healed), None)
            } else if e.is_timeout() && ctx.chat_messages.len() > 2 {
                crate::paths::log_engine(
                    "ai",
                    "⏱️ AI request timed out! Triggering emergency context compaction and retrying...",
                );
                *ctx.chat_messages =
                    crate::session::compaction::emergency_compact_messages(ctx.chat_messages);
                req_body["messages"] = Value::Array(ctx.chat_messages.clone());
                let retried = ctx
                    .client
                    .post(format!("{}/chat/completions", ctx.base_url))
                    .header("Content-Type", "application/json")
                    .header("Authorization", format!("Bearer {}", ctx.api_key))
                    .json(&req_body)
                    .send()
                    .await
                    .map_err(|re| {
                        StepHttpError::transport(
                            if re.is_timeout() {
                                "provider.timeout"
                            } else {
                                "provider.transport"
                            },
                            format!("Failed to reach AI provider after timeout retry ({}).", re),
                        )
                    })?;
                if !retried.status().is_success() {
                    let st = retried.status().as_u16();
                    let err_body = retried.text().await.unwrap_or_default();
                    return Err(StepHttpError::from_classified(classify_provider_failure(
                        Some(st),
                        &err_body,
                    )));
                }
                (Some(retried), None)
            } else {
                return Err(StepHttpError::transport(
                    if e.is_timeout() {
                        "provider.timeout"
                    } else {
                        "provider.transport"
                    },
                    format!("Failed to reach AI provider ({}).", e),
                ));
            }
        }
    };

    let err_pair = if let Some((code, body)) = pre_err {
        Some((code, body))
    } else if let Some(ref resp_ref) = r {
        if !resp_ref.status().is_success() {
            let status_code = resp_ref.status().as_u16();
            let taken = r.take().ok_or_else(|| {
                StepHttpError::transport("provider.unknown", "Missing response handle".to_string())
            })?;
            let err_txt = taken.text().await.unwrap_or_default();
            Some((status_code, err_txt))
        } else {
            None
        }
    } else {
        None
    };

    if let Some((status_code, err_txt)) = err_pair {
        let classified = classify_provider_failure(Some(status_code), &err_txt);

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

            let retried = send_raw_post(ctx.client, ctx.base_url, ctx.api_key, &req_body)
                .await
                .map_err(|e| {
                    StepHttpError::transport(
                        if e.is_timeout() {
                            "provider.timeout"
                        } else {
                            "provider.transport"
                        },
                        format!("Error reaching AI provider during overflow retry: {}", e),
                    )
                })?;
            if !retried.status().is_success() {
                let st = retried.status().as_u16();
                let final_err = retried.text().await.unwrap_or_default();
                return Err(StepHttpError::from_classified(classify_provider_failure(
                    Some(st),
                    &final_err,
                )));
            }
            r = Some(retried);
        } else if matches!(
            classified.kind,
            ProviderErrorKind::QuotaExceeded | ProviderErrorKind::RateLimit
        ) {
            let hard_quota = classified.kind == ProviderErrorKind::QuotaExceeded;
            let cur_key = crate::provider::protocol_adapters::select_healthy_api_key(ctx.api_key);
            if let Some(next_key) = crate::provider::protocol_adapters::rotate_api_key_on_quota(
                ctx.api_key, &cur_key, 60_000,
            ) {
                let rot_r = send_raw_post(ctx.client, ctx.base_url, &next_key, &req_body)
                    .await
                    .map_err(|e| {
                        StepHttpError::transport(
                            "provider.transport",
                            format!("Error during multi-key rotation retry: {}", e),
                        )
                    })?;
                if !rot_r.status().is_success() {
                    let st = rot_r.status().as_u16();
                    let body = rot_r.text().await.unwrap_or_default();
                    return Err(StepHttpError::from_classified(classify_provider_failure(
                        Some(st),
                        &body,
                    )));
                }
                r = Some(rot_r);
            } else if !hard_quota {
                return Err(StepHttpError::from_classified(classified));
            } else if *ctx.current_provider_id != "kenari"
                || *ctx.current_model_id != "llama-3-3-70b-instruct:free"
            {
                let Some(resolved_key) = resolve_configured_kenari_key(ctx.cfg) else {
                    return Err(StepHttpError::from_classified(classified));
                };

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
                let fo_r = send_raw_post(ctx.client, ctx.base_url, ctx.api_key, &req_body)
                    .await
                    .map_err(|e| {
                        StepHttpError::transport(
                            "provider.transport",
                            format!("Error reaching AI provider during failover: {}", e),
                        )
                    })?;
                if !fo_r.status().is_success() {
                    let st = fo_r.status().as_u16();
                    let final_err = fo_r.text().await.unwrap_or_default();
                    return Err(StepHttpError::from_classified(classify_provider_failure(
                        Some(st),
                        &final_err,
                    )));
                }
                r = Some(fo_r);
            } else {
                return Err(StepHttpError::from_classified(classified));
            }
        } else if err_txt.contains("upstream_rejected")
            && sanitize_multimodal_messages_to_text(ctx.chat_messages)
        {
            req_body["messages"] = Value::Array(ctx.chat_messages.clone());
            let retried = send_raw_post(ctx.client, ctx.base_url, ctx.api_key, &req_body)
                .await
                .map_err(|e| {
                    StepHttpError::transport(
                        "provider.transport",
                        format!("Error reaching AI provider during retry: {}", e),
                    )
                })?;
            if !retried.status().is_success() {
                let st = retried.status().as_u16();
                let final_err = retried.text().await.unwrap_or_default();
                return Err(StepHttpError::from_classified(classify_provider_failure(
                    Some(st),
                    &final_err,
                )));
            }
            r = Some(retried);
        } else {
            return Err(StepHttpError::from_classified(classified));
        }
    }

    r.ok_or_else(|| {
        StepHttpError::transport(
            "provider.unknown",
            "AI response missing after retry".to_string(),
        )
    })
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


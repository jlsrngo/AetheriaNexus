//! Unified LLM Resilience Sender — coordinates `retry`, `stream_parser`, `stale_settlement`,
//! multi-key rotation, and automatic failover to Free Kenari (`glm-5.1`).

pub use super::retry::{
    compute_retry_backoff_ms, is_timeout_error, is_unreachable_network_error, MAX_TIMEOUT_RETRIES,
    SYNTHETIC_OUTPUT_LIMIT_PROMPT,
};
pub use super::stale_settlement::settle_stale_session_state;
pub use super::stream_parser::{parse_completion_body, sanitize_multimodal_messages_to_text};

use serde_json::{json, Value};
use std::time::Duration;

use super::retry::parse_retry_after_ms;
use crate::session::compaction::{
    emergency_compact_messages, is_context_overflow_error,
};
use crate::session::provider_error::{is_hard_quota_exhausted, is_rate_limit_throttle};

/// Output from a resilient single-step chat completion call.
pub struct ResilientCompletionOutput {
    pub assistant_text: String,
    pub tool_calls: Vec<Value>,
    pub finish_reason: String,
}

/// Executes a resilient chat completion request with full OpenCode recovery protections.
#[allow(clippy::too_many_arguments)]
pub async fn send_resilient_chat_completion(
    client: &reqwest::Client,
    base_url: &mut String,
    api_key: &mut String,
    model_id: &mut String,
    chat_messages: &mut Vec<Value>,
    tools: &[Value],
    temperature: f64,
    max_tokens: u64,
) -> Result<ResilientCompletionOutput, String> {
    let max_retries: usize = 6;
    let mut attempt: usize = 0;
    let mut timeout_retries: usize = 0;
    let mut did_emergency_compact = false;
    let mut did_failover = false;

    loop {
        let url = format!("{}/chat/completions", base_url.trim_end_matches('/'));
        let mut payload = json!({
            "model": *model_id,
            "messages": *chat_messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": false
        });

        if !tools.is_empty() {
            payload["tools"] = json!(tools);
            payload["tool_choice"] = json!("auto");
        }

        let mut req = client
            .post(&url)
            .header("Content-Type", "application/json")
            .header("Accept", "application/json");
        let active_key = crate::provider::protocol_adapters::select_healthy_api_key(api_key);
        if !active_key.is_empty() {
            req = req.header("Authorization", format!("Bearer {}", active_key));
        }

        match req.json(&payload).send().await {
            Ok(resp) if resp.status().is_success() => match resp.text().await {
                Ok(raw_body) => match parse_completion_body(&raw_body) {
                    Ok((assistant_text, tool_calls, finish_reason)) => {
                        return Ok(ResilientCompletionOutput {
                            assistant_text,
                            tool_calls,
                            finish_reason,
                        });
                    }
                    Err(parse_err) => {
                        if is_context_overflow_error(&parse_err) && !did_emergency_compact {
                            did_emergency_compact = true;
                            *chat_messages = emergency_compact_messages(chat_messages);
                            continue;
                        }
                        if attempt < max_retries {
                            attempt += 1;
                            let delay = compute_retry_backoff_ms(attempt, false, None);
                            tokio::time::sleep(Duration::from_millis(delay)).await;
                            continue;
                        }
                        return Err(parse_err);
                    }
                },
                Err(read_err) => {
                    let err_str = read_err.to_string();
                    if is_context_overflow_error(&err_str) && !did_emergency_compact {
                        did_emergency_compact = true;
                        *chat_messages = emergency_compact_messages(chat_messages);
                        continue;
                    }
                    if attempt < max_retries {
                        attempt += 1;
                        let delay = compute_retry_backoff_ms(attempt, false, None);
                        tokio::time::sleep(Duration::from_millis(delay)).await;
                        continue;
                    }
                    return Err(format!("Failed reading LLM response body: {}", err_str));
                }
            },
            Ok(resp) => {
                let status_code = resp.status().as_u16();
                let retry_after_ms_hdr = resp
                    .headers()
                    .get("retry-after-ms")
                    .and_then(|v| v.to_str().ok())
                    .map(|s| s.to_string());
                let retry_after = resp
                    .headers()
                    .get("retry-after")
                    .and_then(|v| v.to_str().ok())
                    .map(|s| s.to_string());
                let err_txt = resp.text().await.unwrap_or_default();

                if is_context_overflow_error(&err_txt) && !did_emergency_compact {
                    did_emergency_compact = true;
                    *chat_messages = emergency_compact_messages(chat_messages);
                    continue;
                }

                if (status_code == 400 || status_code == 415 || status_code == 422)
                    && sanitize_multimodal_messages_to_text(chat_messages)
                {
                    continue;
                }

                let is_hard_quota = is_hard_quota_exhausted(status_code, &err_txt);
                let is_throttle = is_rate_limit_throttle(status_code, &err_txt);
                if is_hard_quota || is_throttle {
                    let cur_key =
                        crate::provider::protocol_adapters::select_healthy_api_key(api_key);
                    if crate::provider::protocol_adapters::rotate_api_key_on_quota(
                        api_key, &cur_key, 60_000,
                    )
                    .is_some()
                    {
                        continue;
                    }
                }
                let is_server_err = status_code >= 500 || status_code == 408;

                // Retry transient bursts (429 / throttling) and 5xx on the user's selected model
                // up to OpenCode retry budget BEFORE considering failover.
                if (is_server_err || is_throttle) && attempt < max_retries {
                    attempt += 1;
                    let delay = parse_retry_after_ms(
                        retry_after_ms_hdr.as_deref(),
                        retry_after.as_deref(),
                    )
                    .unwrap_or_else(|| compute_retry_backoff_ms(attempt, false, None));
                    tokio::time::sleep(Duration::from_millis(delay)).await;
                    continue;
                }

                if is_hard_quota && !did_failover {
                    did_failover = true;
                    let port = crate::bridge::ensure_bridge_running().await;
                    *base_url = format!("http://127.0.0.1:{}/v1", port);
                    *api_key = "local-cli-bridge".to_string();
                    *model_id = "glm-5.1".to_string();
                    continue;
                }

                let preview: String = err_txt.chars().take(240).collect();
                if is_throttle {
                    return Err(format!(
                        "Rate limit (RPM/TPM) from provider (HTTP {}): {}",
                        status_code, preview
                    ));
                }
                return Err(format!("HTTP {} from provider: {}", status_code, preview));
            }
            Err(net_err) => {
                let err_str = net_err.to_string();
                let is_unreach = is_unreachable_network_error(&err_str);
                let is_tmo = is_timeout_error(&err_str);

                if base_url.contains("127.0.0.1:4318") || base_url.contains("localhost:4318") {
                    let port = crate::bridge::ensure_bridge_running().await;
                    *base_url = format!("http://127.0.0.1:{}/v1", port);
                }

                if is_tmo {
                    timeout_retries += 1;
                    if timeout_retries > MAX_TIMEOUT_RETRIES && !did_failover {
                        did_failover = true;
                        let port = crate::bridge::ensure_bridge_running().await;
                        *base_url = format!("http://127.0.0.1:{}/v1", port);
                        *api_key = "local-cli-bridge".to_string();
                        *model_id = "glm-5.1".to_string();
                        continue;
                    }
                }

                if attempt < max_retries {
                    attempt += 1;
                    let delay = compute_retry_backoff_ms(attempt, is_unreach, None);
                    tokio::time::sleep(Duration::from_millis(delay)).await;
                    continue;
                }

                if !did_failover {
                    did_failover = true;
                    let port = crate::bridge::ensure_bridge_running().await;
                    *base_url = format!("http://127.0.0.1:{}/v1", port);
                    *api_key = "local-cli-bridge".to_string();
                    *model_id = "glm-5.1".to_string();
                    continue;
                }

                return Err(format!("Network error after {} retries: {}", attempt, err_str));
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_retry_backoff_honors_retry_after() {
        let d = compute_retry_backoff_ms(1, false, Some("7"));
        assert_eq!(d, 7_000);
    }

    #[test]
    fn test_compute_retry_backoff_unreachable_scales_higher() {
        let normal = compute_retry_backoff_ms(5, false, None);
        let unreach = compute_retry_backoff_ms(5, true, None);
        assert!(normal <= 10_450);
        assert!(unreach >= 30_000);
    }

    #[test]
    fn test_parse_completion_body_json_and_sse() {
        let json_body = r#"{
            "choices": [{
                "finish_reason": "stop",
                "message": { "role": "assistant", "content": "Hello from JSON" }
            }]
        }"#;
        let (text, tcs, reason) = parse_completion_body(json_body).expect("valid json");
        assert_eq!(text, "Hello from JSON");
        assert!(tcs.is_empty());
        assert_eq!(reason, "stop");

        let sse_body = "data: {\"choices\":[{\"delta\":{\"content\":\"Part 1 \"}}]}\n\
                        data: {\"choices\":[{\"delta\":{\"content\":\"Part 2\"},\"finish_reason\":\"length\"}]}\n\
                        data: [DONE]\n";
        let (sse_text, _, sse_reason) = parse_completion_body(sse_body).expect("valid sse");
        assert_eq!(sse_text, "Part 1 Part 2");
        assert_eq!(sse_reason, "length");
    }
}

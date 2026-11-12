//! Asynchronous OpenAI-Compatible SSE Stream Reader (`W1` Streaming).
//! Reads `text/event-stream` chunks incrementally with 100ms delta batching,
//! instant cooperative abort via `watch::Receiver<bool>`, mid-stream disconnect
//! detection (`K06`), and non-SSE JSON fallback.

use futures_util::StreamExt;
use serde_json::{json, Value};
use tokio::sync::watch;

use super::stream_emit::{StreamStepEmitter, StreamStepOutput};
use crate::session::coordinator::wait_session_interrupt;
use crate::session::provider_error::{classify_provider_failure, ClassifiedProviderError};

#[derive(Debug)]
pub(crate) enum StreamReadError {
    AbortedByUser { content_parts: Vec<Value> },
    InterruptedMidStream(String),
    ProviderChunkError(ClassifiedProviderError),
}

pub(crate) async fn read_step_response(
    resp: reqwest::Response,
    workspace_dir: &str,
    session_id: &str,
    assistant_msg_id: &str,
    interrupt_rx: watch::Receiver<bool>,
) -> Result<StreamStepOutput, StreamReadError> {
    let content_type = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_ascii_lowercase();

    let mut emitter = StreamStepEmitter::new(workspace_dir, session_id, assistant_msg_id);

    if !content_type.contains("text/event-stream") {
        let bytes = tokio::select! {
            biased;
            _ = wait_session_interrupt(interrupt_rx) => {
                return Err(StreamReadError::AbortedByUser { content_parts: Vec::new() });
            }
            res = resp.bytes() => res.map_err(|e| StreamReadError::InterruptedMidStream(format!("Response read failed: {}", e)))?,
        };
        let raw_text = String::from_utf8_lossy(&bytes);
        if !raw_text.trim_start().starts_with('{') && raw_text.contains("data:") {
            let mut saw_done = false;
            for line in raw_text.lines() {
                process_sse_line(line, &mut emitter, &mut saw_done)?;
            }
            if !saw_done && emitter.raw_finish.is_none() {
                let _ = emitter.close_started_on_abort();
                return Err(StreamReadError::InterruptedMidStream(
                    "SSE body ended without [DONE] or finish_reason".to_string(),
                ));
            }
            return Ok(emitter.finish_all());
        }
        return parse_json_completion_into_emitter(&raw_text, emitter);
    }

    let mut byte_stream = resp.bytes_stream();
    let mut line_buf: Vec<u8> = Vec::with_capacity(4096);
    let mut saw_done = false;

    loop {
        let maybe_deadline = emitter.flush_deadline();
        tokio::select! {
            biased;
            _ = wait_session_interrupt(interrupt_rx.clone()) => {
                let parts = emitter.close_started_on_abort();
                return Err(StreamReadError::AbortedByUser { content_parts: parts });
            }
            _ = async {
                match maybe_deadline {
                    Some(dl) => tokio::time::sleep_until(dl).await,
                    None => std::future::pending::<()>().await,
                }
            } => {
                emitter.flush_timer_tick();
            }
            next_item = byte_stream.next() => {
                match next_item {
                    Some(Ok(chunk)) => {
                        line_buf.extend_from_slice(&chunk);
                        while let Some(pos) = line_buf.iter().position(|&b| b == b'\n') {
                            let raw_line: Vec<u8> = line_buf.drain(..=pos).collect();
                            let line_str = String::from_utf8_lossy(&raw_line);
                            process_sse_line(&line_str, &mut emitter, &mut saw_done)?;
                        }
                    }
                    Some(Err(e)) => {
                        let _ = emitter.close_started_on_abort();
                        return Err(StreamReadError::InterruptedMidStream(format!(
                            "SSE stream transport interrupted: {}",
                            e
                        )));
                    }
                    None => {
                        if !line_buf.is_empty() {
                            let tail = String::from_utf8_lossy(&line_buf);
                            process_sse_line(&tail, &mut emitter, &mut saw_done)?;
                        }
                        break;
                    }
                }
            }
        }
    }

    if !saw_done && emitter.raw_finish.is_none() {
        let _ = emitter.close_started_on_abort();
        return Err(StreamReadError::InterruptedMidStream(
            "SSE stream closed unexpectedly before completion".to_string(),
        ));
    }

    Ok(emitter.finish_all())
}

fn process_sse_line<F: FnMut(&str, &str, Value)>(
    raw_line: &str,
    emitter: &mut StreamStepEmitter<F>,
    saw_done: &mut bool,
) -> Result<(), StreamReadError> {
    let line = raw_line.trim();
    if line.is_empty() || line.starts_with(':') {
        return Ok(());
    }
    let Some(rest) = line.strip_prefix("data:") else {
        return Ok(());
    };
    let payload_str = rest.trim();
    if payload_str.is_empty() {
        return Ok(());
    }
    if payload_str == "[DONE]" {
        *saw_done = true;
        return Ok(());
    }
    let Ok(chunk) = serde_json::from_str::<Value>(payload_str) else {
        return Ok(());
    };

    if chunk.get("error").is_some() && chunk.pointer("/choices").is_none() {
        let status = chunk
            .pointer("/error/status")
            .or_else(|| chunk.get("status"))
            .and_then(|v| v.as_u64())
            .map(|n| n as u16);
        return Err(StreamReadError::ProviderChunkError(
            classify_provider_failure(status, payload_str),
        ));
    }

    if let Some(u) = chunk.get("usage").or_else(|| chunk.pointer("/choices/0/usage")) {
        if u.is_object() {
            emitter.usage = Some(u.clone());
        }
    }

    if let Some(choice) = chunk.pointer("/choices/0") {
        if let Some(fr) = choice.get("finish_reason").and_then(|v| v.as_str()) {
            if !fr.is_empty() {
                emitter.raw_finish = Some(fr.to_string());
            }
        }
        if let Some(delta) = choice.get("delta") {
            if let Some(r_frag) = delta
                .get("reasoning_content")
                .or_else(|| delta.get("reasoning"))
                .or_else(|| delta.get("thought"))
                .and_then(|v| v.as_str())
            {
                emitter.on_reasoning_delta(r_frag);
            }
            if let Some(t_frag) = delta.get("content").and_then(|v| v.as_str()) {
                emitter.on_text_delta(t_frag);
            }
            if let Some(tc_arr) = delta.get("tool_calls").and_then(|v| v.as_array()) {
                for (arr_pos, tc) in tc_arr.iter().enumerate() {
                    let index = tc
                        .get("index")
                        .and_then(|v| v.as_u64())
                        .map(|n| n as usize)
                        .unwrap_or(arr_pos);
                    let id = tc.get("id").and_then(|v| v.as_str());
                    let name = tc.pointer("/function/name").and_then(|v| v.as_str());
                    let args = tc.pointer("/function/arguments").and_then(|v| v.as_str());
                    emitter.on_tool_call_delta(index, id, name, args);
                }
            }
        }
    }

    Ok(())
}

fn parse_json_completion_into_emitter(
    raw_text: &str,
    mut emitter: StreamStepEmitter,
) -> Result<StreamStepOutput, StreamReadError> {
    let data: Value = serde_json::from_str(raw_text).unwrap_or_else(|_| json!({}));
    if data.get("error").is_some() && data.pointer("/choices").is_none() {
        return Err(StreamReadError::ProviderChunkError(
            classify_provider_failure(None, raw_text),
        ));
    }

    emitter.usage = data.get("usage").cloned();
    emitter.raw_finish = data
        .pointer("/choices/0/finish_reason")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let msg = data
        .pointer("/choices/0/message")
        .cloned()
        .unwrap_or_else(|| json!({}));

    let mut msg_text = msg
        .get("content")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let mut msg_reasoning = msg
        .get("reasoning_content")
        .or_else(|| msg.get("reasoning"))
        .or_else(|| msg.get("thought"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();

    if let Some(s_idx) = msg_text.find("<think>") {
        if let Some(e_rel) = msg_text[s_idx + 7..].find("</think>") {
            let e_idx = s_idx + 7 + e_rel;
            let inline_thought = msg_text[s_idx + 7..e_idx].trim();
            if !inline_thought.is_empty() {
                if !msg_reasoning.is_empty() {
                    msg_reasoning.push_str("\n\n");
                }
                msg_reasoning.push_str(inline_thought);
            }
            msg_text = format!("{}{}", &msg_text[..s_idx], &msg_text[e_idx + 8..])
                .trim()
                .to_string();
        }
    }

    if !msg_reasoning.is_empty() {
        emitter.on_reasoning_delta(&msg_reasoning);
    }
    if let Some(tc_arr) = msg.get("tool_calls").and_then(|v| v.as_array()) {
        for (idx, tc) in tc_arr.iter().enumerate() {
            let id = tc.get("id").and_then(|v| v.as_str());
            let name = tc.pointer("/function/name").and_then(|v| v.as_str());
            let args = tc.pointer("/function/arguments").and_then(|v| v.as_str());
            emitter.on_tool_call_delta(idx, id, name, args);
        }
    }
    if !msg_text.is_empty() {
        emitter.on_text_delta(&msg_text);
    }

    Ok(emitter.finish_all())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;
    use std::rc::Rc;

    #[test]
    fn test_process_sse_line_accumulates_text_usage_and_finish() {
        let log: Rc<RefCell<Vec<(String, Value)>>> = Rc::new(RefCell::new(Vec::new()));
        let log_c = log.clone();
        let mut em = StreamStepEmitter::with_emitter("ws", "s1", "m1", move |_, k, p| {
            log_c.borrow_mut().push((k.to_string(), p));
        });
        let mut saw_done = false;

        process_sse_line(
            r#"data: {"choices":[{"index":0,"delta":{"content":"Hello "},"finish_reason":null}]}"#,
            &mut em,
            &mut saw_done,
        )
        .unwrap();
        process_sse_line(
            r#"data: {"choices":[{"index":0,"delta":{"content":"world"},"finish_reason":null}]}"#,
            &mut em,
            &mut saw_done,
        )
        .unwrap();
        process_sse_line(
            r#"data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":2}}"#,
            &mut em,
            &mut saw_done,
        )
        .unwrap();
        process_sse_line("data: [DONE]", &mut em, &mut saw_done).unwrap();

        assert!(saw_done);
        let out = em.finish_all();
        assert_eq!(out.text, "Hello world");
        assert_eq!(out.raw_finish.as_deref(), Some("stop"));
        assert_eq!(out.usage.unwrap()["prompt_tokens"], 10);
    }
}

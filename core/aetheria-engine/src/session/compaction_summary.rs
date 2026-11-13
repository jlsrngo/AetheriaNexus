//! Structured Compaction Summarizer, Shrink Ladder, Transcript Clipper & Background Precompute (`W6`).
//! Keeps synchronous compaction events (`session.compaction.started`, `session.compaction.delta`,
//! `session.compacted`, `session.compaction.failed`) strictly separated from silent background precompute.

use futures_util::StreamExt;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use tokio::sync::watch;

use super::compaction_budget::{SHRINK_STEPS, TRANSCRIPT_CLIP};
use crate::session::coordinator::{subscribe_session_interrupt, wait_session_interrupt};
use crate::session::provider_error::is_context_overflow_error;

const COMPACTION_PROMPT: &str = concat!(
    "You MUST summarize the conversation above so another agent can continue seamlessly.\n",
    "Your response MUST follow this structure:\n",
    "## Objective\n## Requirements\n## Decisions\n## Work State\n## Next Move\n## Relevant Files\n## Important Context"
);

#[derive(Debug, Clone)]
pub struct PrecomputedSummary {
    pub model_id: String,
    pub summary_text: String,
    pub source_msg_count: usize,
}

#[derive(Debug)]
pub enum CompactionOutcome {
    Succeeded,
    Interrupted,
    Failed(String),
}

static PRECOMPUTED_SUMMARIES: OnceLock<Mutex<HashMap<String, PrecomputedSummary>>> =
    OnceLock::new();
static PRECOMPUTE_TASKS: OnceLock<Mutex<HashMap<String, tokio::task::JoinHandle<()>>>> =
    OnceLock::new();

fn precomputed_map() -> &'static Mutex<HashMap<String, PrecomputedSummary>> {
    PRECOMPUTED_SUMMARIES.get_or_init(|| Mutex::new(HashMap::new()))
}

fn precompute_tasks_map() -> &'static Mutex<HashMap<String, tokio::task::JoinHandle<()>>> {
    PRECOMPUTE_TASKS.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Cuts strings longer than `TRANSCRIPT_CLIP` (`2_000` chars) preserving start and end
/// with `[... N characters omitted ...]` (`K33`).
pub fn clip_transcript_piece(value: &str) -> String {
    let char_count = value.chars().count();
    if char_count <= TRANSCRIPT_CLIP {
        return value.to_string();
    }
    let half = TRANSCRIPT_CLIP / 2;
    let omitted = char_count - TRANSCRIPT_CLIP;
    let prefix: String = value.chars().take(half).collect();
    let suffix: String = value.chars().skip(char_count - half).collect();
    format!(
        "{}\n[... {} characters omitted ...]\n{}",
        prefix, omitted, suffix
    )
}

/// Builds a textual conversation replay for the compaction LLM call, clipping oversized
/// messages/tool outputs cleanly and optionally capping total char length for shrink retries.
pub fn build_compaction_transcript(messages: &[Value], max_chars: Option<usize>) -> String {
    let mut blocks: Vec<String> = Vec::new();
    for m in messages {
        let role = m
            .get("role")
            .or_else(|| m.get("type"))
            .and_then(|v| v.as_str())
            .unwrap_or("user");
        if role == "system" {
            continue;
        }
        let mut entry = String::new();
        if let Some(txt) = m.get("content").or_else(|| m.get("text")).and_then(|v| v.as_str()) {
            let trimmed = txt.trim();
            if !trimmed.is_empty() {
                entry.push_str(&format!("{}: {}\n", role, clip_transcript_piece(trimmed)));
            }
        } else if let Some(arr) = m.get("content").and_then(|v| v.as_array()) {
            for p in arr {
                let ptype = p.get("type").and_then(|v| v.as_str()).unwrap_or("");
                if ptype == "text" {
                    if let Some(t) = p.get("text").and_then(|v| v.as_str()) {
                        let trimmed = t.trim();
                        if !trimmed.is_empty() {
                            entry.push_str(&format!("{}: {}\n", role, clip_transcript_piece(trimmed)));
                        }
                    }
                } else if ptype == "tool" {
                    let tname = p.get("name").and_then(|v| v.as_str()).unwrap_or("tool");
                    if let Some(out) = p.pointer("/state/content/0/text").and_then(|v| v.as_str()) {
                        entry.push_str(&format!(
                            "tool({}): {}\n",
                            tname,
                            clip_transcript_piece(out.trim())
                        ));
                    }
                }
            }
        }
        if let Some(tcs) = m.get("tool_calls").and_then(|v| v.as_array()) {
            for tc in tcs {
                let name = tc
                    .pointer("/function/name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("tool");
                let args = tc
                    .pointer("/function/arguments")
                    .and_then(|v| v.as_str())
                    .unwrap_or("{}");
                entry.push_str(&format!(
                    "assistant[tool_call {}]: {}\n",
                    name,
                    clip_transcript_piece(args)
                ));
            }
        }
        if !entry.is_empty() {
            blocks.push(entry);
        }
    }

    let Some(cap) = max_chars else {
        return blocks.concat();
    };

    // Shrink ladder: drop oldest exchanges while keeping the newest block, then trim tail to fit `cap`.
    while blocks.len() > 1 {
        let total: usize = blocks.iter().map(|b| b.len()).sum();
        if total <= cap {
            break;
        }
        blocks.remove(0);
    }

    let mut joined = blocks.concat();
    if joined.len() > cap && cap > 64 {
        let char_total = joined.chars().count();
        let keep = cap.saturating_sub(48);
        if char_total > keep {
            let tail: String = joined.chars().skip(char_total - keep).collect();
            joined = format!("[... earlier context trimmed ...]\n{}", tail);
        }
    }
    joined
}

enum CompactionCallResult {
    Ok(String),
    Overflow(String),
    Interrupted,
    Failed(String),
}

async fn send_compaction_call(
    client: &reqwest::Client,
    base_url: &str,
    api_key: &str,
    model_id: &str,
    transcript: &str,
    interrupt_rx: watch::Receiver<bool>,
) -> CompactionCallResult {
    let req_body = json!({
        "model": model_id,
        "messages": [
            {
                "role": "user",
                "content": format!("{}\n\nConversation:\n{}", COMPACTION_PROMPT, transcript)
            }
        ],
        "stream": true
    });

    let url = format!("{}/chat/completions", base_url.trim_end_matches('/'));
    let send_fut = client
        .post(url)
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&req_body)
        .send();

    let resp = tokio::select! {
        biased;
        _ = wait_session_interrupt(interrupt_rx.clone()) => return CompactionCallResult::Interrupted,
        res = send_fut => match res {
            Ok(r) => r,
            Err(e) => return CompactionCallResult::Failed(format!("Compaction request error: {}", e)),
        }
    };

    if !resp.status().is_success() {
        let code = resp.status().as_u16();
        let body = resp.text().await.unwrap_or_default();
        if code == 400 || is_context_overflow_error(&body) {
            return CompactionCallResult::Overflow(body);
        }
        return CompactionCallResult::Failed(format!("Compaction HTTP {}: {}", code, body));
    }

    let content_type = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_ascii_lowercase();

    if !content_type.contains("text/event-stream") {
        let bytes = tokio::select! {
            biased;
            _ = wait_session_interrupt(interrupt_rx) => return CompactionCallResult::Interrupted,
            b = resp.bytes() => match b {
                Ok(v) => v,
                Err(e) => return CompactionCallResult::Failed(format!("Compaction read error: {}", e)),
            }
        };
        let raw = String::from_utf8_lossy(&bytes);
        if raw.trim_start().starts_with('{') {
            if let Ok(val) = serde_json::from_str::<Value>(&raw) {
                if let Some(txt) = val.pointer("/choices/0/message/content").and_then(|v| v.as_str())
                {
                    return CompactionCallResult::Ok(txt.trim().to_string());
                }
            }
        }
        return CompactionCallResult::Failed("Unexpected compaction response payload".to_string());
    }

    let mut stream = resp.bytes_stream();
    let mut line_buf: Vec<u8> = Vec::with_capacity(2048);
    let mut summary = String::new();
    let mut saw_done = false;

    loop {
        tokio::select! {
            biased;
            _ = wait_session_interrupt(interrupt_rx.clone()) => {
                return CompactionCallResult::Interrupted;
            }
            next = stream.next() => {
                match next {
                    Some(Ok(chunk)) => {
                        line_buf.extend_from_slice(&chunk);
                        while let Some(pos) = line_buf.iter().position(|&b| b == b'\n') {
                            let line: Vec<u8> = line_buf.drain(..=pos).collect();
                            let s = String::from_utf8_lossy(&line);
                            parse_compaction_sse_line(&s, &mut summary, &mut saw_done);
                        }
                    }
                    Some(Err(e)) => {
                        return CompactionCallResult::Failed(format!(
                            "Compaction stream interrupted: {}",
                            e
                        ));
                    }
                    None => {
                        if !line_buf.is_empty() {
                            let tail = String::from_utf8_lossy(&line_buf);
                            parse_compaction_sse_line(&tail, &mut summary, &mut saw_done);
                        }
                        break;
                    }
                }
            }
        }
    }

    if !saw_done && summary.is_empty() {
        return CompactionCallResult::Failed("Compaction stream ended without completion".to_string());
    }
    CompactionCallResult::Ok(summary.trim().to_string())
}

fn parse_compaction_sse_line(raw: &str, acc: &mut String, saw_done: &mut bool) {
    let trimmed = raw.trim();
    let Some(rest) = trimmed.strip_prefix("data:") else {
        return;
    };
    let payload = rest.trim();
    if payload.is_empty() {
        return;
    }
    if payload == "[DONE]" {
        *saw_done = true;
        return;
    }
    if let Ok(chunk) = serde_json::from_str::<Value>(payload) {
        if let Some(frag) = chunk.pointer("/choices/0/delta/content").and_then(|v| v.as_str()) {
            acc.push_str(frag);
        } else if let Some(txt) = chunk
            .pointer("/choices/0/message/content")
            .and_then(|v| v.as_str())
        {
            acc.push_str(txt);
        }
    }
}

/// Applies the compacted summary onto `chat_messages`, preserving `system` (if present) and
/// the most recent user prompt.
pub fn apply_compacted_messages(chat_messages: &mut Vec<Value>, summary_text: &str) {
    let sys_msg = chat_messages
        .first()
        .filter(|m| m.get("role").and_then(|v| v.as_str()) == Some("system"))
        .cloned();
    let latest_user = chat_messages
        .iter()
        .rfind(|m| m.get("role").and_then(|v| v.as_str()) == Some("user"))
        .cloned()
        .unwrap_or_else(|| json!({ "role": "user", "content": "Continue." }));

    let mut out = Vec::with_capacity(3);
    if let Some(sys) = sys_msg {
        out.push(sys);
    }
    out.push(json!({ "role": "assistant", "content": summary_text }));
    out.push(latest_user);
    *chat_messages = out;
}

/// Awaits any in-flight background precompute task for `session_id` before starting the next step.
pub async fn await_pending_precompute(session_id: &str) {
    let handle = {
        let mut guard = precompute_tasks_map()
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        guard.remove(session_id)
    };
    if let Some(h) = handle {
        let _ = h.await;
    }
}

/// Returns a held background summary for `session_id` & `model_id` if already computed.
pub fn take_precomputed_summary(session_id: &str, model_id: &str) -> Option<PrecomputedSummary> {
    let mut guard = precomputed_map().lock().unwrap_or_else(|e| e.into_inner());
    let existing = guard.get(session_id)?;
    if existing.model_id == model_id {
        guard.remove(session_id)
    } else {
        None
    }
}

/// Spawns a silent background compaction precompute (`K32`) that does NOT emit UI/SSE events.
#[allow(clippy::too_many_arguments)]
pub fn spawn_background_precompute(
    client: reqwest::Client,
    base_url: String,
    api_key: String,
    model_id: String,
    session_id: String,
    messages: Vec<Value>,
) {
    {
        let has_ready = precomputed_map()
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .get(&session_id)
            .map(|p| p.model_id == model_id && p.source_msg_count == messages.len())
            .unwrap_or(false);
        let has_task = precompute_tasks_map()
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .contains_key(&session_id);
        if has_ready || has_task {
            return;
        }
    }

    let sid = session_id.clone();
    let handle = tokio::spawn(async move {
        let transcript = build_compaction_transcript(&messages, None);
        if transcript.is_empty() {
            return;
        }
        let rx = subscribe_session_interrupt(&sid);
        if let CompactionCallResult::Ok(summary_text) =
            send_compaction_call(&client, &base_url, &api_key, &model_id, &transcript, rx).await
        {
            if !summary_text.is_empty() {
                precomputed_map()
                    .lock()
                    .unwrap_or_else(|e| e.into_inner())
                    .insert(
                        sid.clone(),
                        PrecomputedSummary {
                            model_id,
                            summary_text,
                            source_msg_count: messages.len(),
                        },
                    );
            }
        }
    });

    precompute_tasks_map()
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .insert(session_id, handle);
}

fn clear_pending_compaction(
    session_id: &str,
    compaction_job_id: &str,
    success: bool,
    err: Option<&str>,
) {
    crate::session::session::with_store(|store| {
        if let Some(sess) = store.sessions.get_mut(session_id) {
            if let Some(obj) = sess.as_object_mut() {
                obj.remove("pendingCompaction");
                crate::session::session::save_store(store);
            }
        }
    });
    if success {
        crate::session::job_registry::settle_job_completed(compaction_job_id, None);
    } else if let Some(msg) = err {
        crate::session::job_registry::settle_job_error(compaction_job_id, msg);
    }
}

/// Runs budget-driven synchronous compaction with shrink ladder `[0.85, 0.70, 0.50, 0.35]` (`K29–K31`, `K33`, `K34`, `K54`).
#[allow(clippy::too_many_arguments)]
pub async fn compact_with_budget_ladder(
    client: &reqwest::Client,
    base_url: &str,
    api_key: &str,
    model_id: &str,
    session_id: &str,
    workspace_dir: &str,
    reason: &str,
    chat_messages: &mut Vec<Value>,
) -> CompactionOutcome {
    await_pending_precompute(session_id).await;

    let compaction_job_id = format!("cmp_{}", session_id);
    crate::session::session::with_store(|store| {
        if let Some(sess) = store.sessions.get_mut(session_id) {
            sess["pendingCompaction"] = json!({
                "reason": reason,
                "workspaceDir": workspace_dir,
                "modelId": model_id,
                "startedAt": crate::paths::now_ms(),
                "messages": chat_messages.clone(),
            });
            crate::session::session::save_store(store);
        }
    });
    crate::session::job_registry::start_job(
        &compaction_job_id,
        session_id,
        None,
        "compaction",
        reason,
        false,
    );

    crate::session::message::emit_event(
        workspace_dir,
        "session.compaction.started",
        json!({ "sessionID": session_id, "reason": reason }),
    );

    let mut summary_text = take_precomputed_summary(session_id, model_id)
        .map(|p| p.summary_text)
        .unwrap_or_default();

    if summary_text.is_empty() {
        let full_transcript = build_compaction_transcript(chat_messages, None);
        let base_chars = full_transcript.len();
        let interrupt_rx = subscribe_session_interrupt(session_id);

        for attempt in 0..=SHRINK_STEPS.len() {
            let cap = if attempt == 0 {
                None
            } else {
                let factor = SHRINK_STEPS[attempt - 1];
                Some(((base_chars as f64) * factor).floor().max(256.0) as usize)
            };
            let transcript = if cap.is_none() {
                full_transcript.clone()
            } else {
                build_compaction_transcript(chat_messages, cap)
            };

            match send_compaction_call(
                client,
                base_url,
                api_key,
                model_id,
                &transcript,
                interrupt_rx.clone(),
            )
            .await
            {
                CompactionCallResult::Ok(txt) => {
                    summary_text = txt;
                    break;
                }
                CompactionCallResult::Overflow(msg) => {
                    if attempt < SHRINK_STEPS.len() {
                        continue;
                    }
                    clear_pending_compaction(session_id, &compaction_job_id, false, Some(&msg));
                    crate::session::message::emit_event(
                        workspace_dir,
                        "session.compaction.failed",
                        json!({
                            "sessionID": session_id,
                            "error": { "type": "context-overflow", "message": msg }
                        }),
                    );
                    return CompactionOutcome::Failed(msg);
                }
                CompactionCallResult::Interrupted => {
                    clear_pending_compaction(
                        session_id,
                        &compaction_job_id,
                        false,
                        Some("Compaction interrupted by user"),
                    );
                    crate::session::message::emit_event(
                        workspace_dir,
                        "session.compaction.failed",
                        json!({
                            "sessionID": session_id,
                            "error": { "type": "compaction.interrupted", "message": "Compaction interrupted by user" }
                        }),
                    );
                    return CompactionOutcome::Interrupted;
                }
                CompactionCallResult::Failed(err) => {
                    clear_pending_compaction(session_id, &compaction_job_id, false, Some(&err));
                    crate::session::message::emit_event(
                        workspace_dir,
                        "session.compaction.failed",
                        json!({
                            "sessionID": session_id,
                            "error": { "type": "compaction.interrupted", "message": err }
                        }),
                    );
                    return CompactionOutcome::Failed(err);
                }
            }
        }
    }

    if !summary_text.is_empty() {
        crate::session::message::emit_event(
            workspace_dir,
            "session.compaction.delta",
            json!({ "sessionID": session_id, "text": summary_text }),
        );
        apply_compacted_messages(chat_messages, &summary_text);
    } else {
        *chat_messages = super::compaction_emergency::emergency_compact_messages(chat_messages);
    }

    // Record a persisted checkpoint marker on store so future turns don't re-compact on stale usage.
    crate::session::session::with_store(|store| {
        if let Some(msgs) = store.messages.get_mut(session_id) {
            msgs.push(json!({
                "type": "assistant",
                "role": "assistant",
                "compactedSummary": true,
                "content": [{ "type": "text", "text": summary_text }],
                "tokens": { "input": 1, "output": 1, "reasoning": 0, "cache": { "read": 0, "write": 0 } }
            }));
            crate::session::session::save_store(store);
        }
    });

    clear_pending_compaction(session_id, &compaction_job_id, true, None);
    crate::session::message::emit_event(
        workspace_dir,
        "session.compacted",
        json!({
            "sessionID": session_id,
            "compactedMessages": chat_messages.len()
        }),
    );
    CompactionOutcome::Succeeded
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clip_transcript_piece_marks_omitted_characters() {
        let big = "A".repeat(2_500);
        let clipped = clip_transcript_piece(&big);
        assert!(clipped.contains("[... 500 characters omitted ...]"));
        assert!(clipped.starts_with(&"A".repeat(1_000)));
        assert!(clipped.ends_with(&"A".repeat(1_000)));
    }

    #[test]
    fn shrink_ladder_strictly_reduces_transcript_length() {
        let msgs = vec![
            json!({ "role": "user", "content": "X".repeat(4_000) }),
            json!({ "role": "assistant", "content": "Y".repeat(4_000) }),
            json!({ "role": "user", "content": "Z".repeat(4_000) }),
        ];
        let full = build_compaction_transcript(&msgs, None);
        let cap = (full.len() as f64 * SHRINK_STEPS[0]).floor() as usize;
        let shrunk = build_compaction_transcript(&msgs, Some(cap));
        assert!(shrunk.len() < full.len());
    }
}

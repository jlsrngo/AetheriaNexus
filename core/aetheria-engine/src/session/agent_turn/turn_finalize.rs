//! Turn Finalization, Synthesis & Persistence Helper
//! Isolated from `runner.rs` so final text synthesis, store saving, job settlement,
//! auto-title generation, usage/finish persistence, and terminal event emission live cleanly here.

use crate::paths::{gen_id, now_ms};
use crate::provider::catalog::resolve_model_cost_tiers;
use crate::provider::read_aetheria_config;
use crate::session::finish_reason::{normalize_finish_reason, FinishReason};
use crate::session::message::emit_event;
use crate::session::session::{save_store, with_store};
use crate::session::session_error::emit_session_error;
use crate::session::usage::{
    cost_to_json, record_step_usage, tokens_to_json, RecordedUsage, TurnUsageAccumulator,
};
use serde_json::{json, Value};

fn maybe_update_session_title(
    store: &mut crate::session::session::SessionStoreData,
    session_id: &str,
    completed_ms: u64,
) {
    if let Some(s) = store.sessions.get_mut(session_id) {
        s["time"]["updated"] = json!(completed_ms);
        let cur_title = s.get("title").and_then(|v| v.as_str()).unwrap_or("");
        if cur_title.is_empty()
            || cur_title.eq_ignore_ascii_case("New Session")
            || cur_title.eq_ignore_ascii_case("Chat")
            || cur_title.starts_with("New session -")
            || cur_title.starts_with("New Session -")
        {
            if let Some(first_msg) = store.messages.get(session_id).and_then(|m| m.first()) {
                let text = first_msg.get("text").and_then(|v| v.as_str()).unwrap_or("");
                let auto_title = crate::session::title::derive_session_title(text);
                if auto_title != "New Session" {
                    s["title"] = json!(&auto_title);
                }
            }
        }
    }
}

#[allow(clippy::too_many_arguments)]
pub(crate) async fn finalize_agent_turn(
    client: &reqwest::Client,
    base_url: &str,
    api_key: &str,
    provider_id: &str,
    model_id: &str,
    session_id: &str,
    workspace_dir: &str,
    assistant_msg_id: &str,
    started_ms: u64,
    reached_max_steps: bool,
    final_text_streamed: bool,
    mut final_text: String,
    mut content_parts: Vec<Value>,
    chat_messages: &mut Vec<Value>,
    usage_acc: &mut TurnUsageAccumulator,
    mut last_step_usage: Option<RecordedUsage>,
    mut last_finish: FinishReason,
) {
    let mut emit_text_events = !final_text_streamed;
    if final_text.trim().is_empty() {
        emit_text_events = true;
        let synthesis_prompt = if reached_max_steps {
            crate::session::coordinator::MAX_STEPS_PROMPT
        } else {
            "All requested Aetheria Studio and code operations have completed execution. Provide a clear, concise final summary and answer to the user."
        };
        chat_messages.push(json!({ "role": "user", "content": synthesis_prompt }));

        let req_body = json!({
            "model": model_id,
            "messages": chat_messages,
            "stream": false
        });
        if let Ok(resp) = client
            .post(format!("{}/chat/completions", base_url))
            .header("Content-Type", "application/json")
            .header("Authorization", format!("Bearer {}", api_key))
            .json(&req_body)
            .send()
            .await
        {
            if resp.status().is_success() {
                if let Ok(data) = resp.json::<Value>().await {
                    let cfg = read_aetheria_config();
                    let tiers = resolve_model_cost_tiers(&cfg, provider_id, model_id);
                    let synth_usage = record_step_usage(data.get("usage"), &tiers);
                    usage_acc.record_step(synth_usage);
                    last_step_usage = synth_usage;
                    let raw_finish = data
                        .pointer("/choices/0/finish_reason")
                        .and_then(|v| v.as_str());
                    last_finish = normalize_finish_reason(raw_finish, false);
                    if let Some(txt) = data
                        .pointer("/choices/0/message/content")
                        .and_then(|v| v.as_str())
                    {
                        final_text = txt.trim().to_string();
                    }
                }
            }
        }
        if final_text.trim().is_empty() {
            final_text = "All requested operations have been completed successfully.".to_string();
        }
    }

    if emit_text_events {
        let txt_part_id = gen_id("txt");
        emit_event(
            workspace_dir,
            "session.next.text.started",
            json!({ "sessionID": session_id, "messageID": assistant_msg_id, "id": txt_part_id }),
        );
        if !final_text.is_empty() {
            emit_event(
                workspace_dir,
                "session.next.text.delta",
                json!({ "sessionID": session_id, "messageID": assistant_msg_id, "id": txt_part_id, "delta": final_text }),
            );
        }
        emit_event(
            workspace_dir,
            "session.next.text.ended",
            json!({ "sessionID": session_id, "messageID": assistant_msg_id, "id": txt_part_id, "text": final_text }),
        );

        content_parts.push(json!({ "type": "text", "id": txt_part_id, "text": final_text }));
    }

    let completed_ms = now_ms();
    let total_elapsed = completed_ms.saturating_sub(started_ms);
    crate::paths::log_engine(
        "chat",
        &format!(
            "🏁 Turn completed for session '{}' in {}ms (model: '{}', finish: '{}')",
            session_id,
            total_elapsed,
            model_id,
            last_finish.as_str()
        ),
    );

    let total_usage = usage_acc.totals();
    let assistant_msg = json!({
        "id": assistant_msg_id,
        "type": "assistant",
        "role": "assistant",
        "agent": "default",
        "model": { "providerID": provider_id, "id": model_id },
        "content": content_parts,
        "finish": last_finish.as_str(),
        "cost": cost_to_json(total_usage.as_ref()),
        "tokens": tokens_to_json(total_usage.as_ref()),
        "time": { "created": started_ms, "completed": completed_ms }
    });

    with_store(|store| {
        maybe_update_session_title(store, session_id, completed_ms);
        store
            .messages
            .entry(session_id.to_string())
            .or_default()
            .push(assistant_msg);
        save_store(store);
    });

    emit_event(
        workspace_dir,
        "session.next.step.ended",
        json!({
            "sessionID": session_id,
            "messageID": assistant_msg_id,
            "finish": last_finish.as_str(),
            "cost": cost_to_json(last_step_usage.as_ref()),
            "tokens": tokens_to_json(last_step_usage.as_ref()),
        }),
    );
    crate::session::job_registry::settle_job_completed(&assistant_msg_id, Some(final_text));
    crate::session::session::set_active_run(session_id, false);
    emit_event(workspace_dir, "session.idle", json!({ "sessionID": session_id }));
    emit_event(
        workspace_dir,
        "session.status",
        json!({ "sessionID": session_id, "status": { "type": "idle" } }),
    );
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn finalize_interrupted_turn(
    provider_id: &str,
    model_id: &str,
    session_id: &str,
    workspace_dir: &str,
    assistant_msg_id: &str,
    started_ms: u64,
    content_parts: Vec<Value>,
    usage_acc: &TurnUsageAccumulator,
    reason: &str,
) {
    let completed_ms = now_ms();
    let total_usage = usage_acc.totals();
    let assistant_msg = json!({
        "id": assistant_msg_id,
        "type": "assistant",
        "role": "assistant",
        "agent": "default",
        "model": { "providerID": provider_id, "id": model_id },
        "content": content_parts,
        "finish": "interrupted",
        "cost": cost_to_json(total_usage.as_ref()),
        "tokens": tokens_to_json(total_usage.as_ref()),
        "time": { "created": started_ms, "completed": completed_ms }
    });

    with_store(|store| {
        maybe_update_session_title(store, session_id, completed_ms);
        store
            .messages
            .entry(session_id.to_string())
            .or_default()
            .push(assistant_msg);
        save_store(store);
    });

    crate::session::job_registry::cancel_job(assistant_msg_id, reason);
    crate::session::coordinator::finish_session_turn(session_id);
    crate::session::session::set_active_run(session_id, false);
    emit_event(
        workspace_dir,
        "session.execution.interrupted",
        json!({
            "sessionID": session_id,
            "messageID": assistant_msg_id,
            "reason": reason,
        }),
    );
    emit_event(workspace_dir, "session.idle", json!({ "sessionID": session_id }));
    emit_event(
        workspace_dir,
        "session.status",
        json!({ "sessionID": session_id, "status": { "type": "idle" } }),
    );
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn finalize_failed_turn(
    provider_id: &str,
    model_id: &str,
    session_id: &str,
    workspace_dir: &str,
    assistant_msg_id: &str,
    started_ms: u64,
    content_parts: Vec<Value>,
    usage_acc: &TurnUsageAccumulator,
    finish: Option<FinishReason>,
    category: &str,
    message: &str,
    retryable: bool,
    status: Option<u16>,
) {
    finalize_failed_turn_with_opts(
        provider_id,
        model_id,
        session_id,
        workspace_dir,
        assistant_msg_id,
        started_ms,
        content_parts,
        usage_acc,
        finish,
        category,
        message,
        retryable,
        status,
        true,
    );
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn finalize_execution_failure(
    provider_id: &str,
    model_id: &str,
    session_id: &str,
    workspace_dir: &str,
    assistant_msg_id: &str,
    started_ms: u64,
    content_parts: Vec<Value>,
    usage_acc: &TurnUsageAccumulator,
    finish: Option<FinishReason>,
    category: &str,
    message: &str,
) {
    finalize_failed_turn_with_opts(
        provider_id,
        model_id,
        session_id,
        workspace_dir,
        assistant_msg_id,
        started_ms,
        content_parts,
        usage_acc,
        finish,
        category,
        message,
        false,
        None,
        false,
    );
}

#[allow(clippy::too_many_arguments)]
fn finalize_failed_turn_with_opts(
    provider_id: &str,
    model_id: &str,
    session_id: &str,
    workspace_dir: &str,
    assistant_msg_id: &str,
    started_ms: u64,
    content_parts: Vec<Value>,
    usage_acc: &TurnUsageAccumulator,
    finish: Option<FinishReason>,
    category: &str,
    message: &str,
    retryable: bool,
    status: Option<u16>,
    emit_step_error: bool,
) {
    if emit_step_error {
        emit_session_error(
            workspace_dir,
            session_id,
            assistant_msg_id,
            category,
            message,
            retryable,
            status,
        );
    }

    let completed_ms = now_ms();
    let total_usage = usage_acc.totals();
    let assistant_msg = json!({
        "id": assistant_msg_id,
        "type": "assistant",
        "role": "assistant",
        "agent": "default",
        "model": { "providerID": provider_id, "id": model_id },
        "content": content_parts,
        "finish": finish.map(|f| f.as_str()),
        "cost": cost_to_json(total_usage.as_ref()),
        "tokens": tokens_to_json(total_usage.as_ref()),
        "error": {
            "type": category,
            "message": message,
            "retryable": retryable,
            "status": status
        },
        "time": { "created": started_ms, "completed": completed_ms }
    });

    with_store(|store| {
        maybe_update_session_title(store, session_id, completed_ms);
        store
            .messages
            .entry(session_id.to_string())
            .or_default()
            .push(assistant_msg);
        save_store(store);
    });

    crate::session::job_registry::settle_job_error(assistant_msg_id, message);
    crate::session::session::set_active_run(session_id, false);
    emit_event(
        workspace_dir,
        "session.execution.failed",
        json!({
            "sessionID": session_id,
            "messageID": assistant_msg_id,
            "error": { "type": category, "message": message }
        }),
    );
    emit_event(
        workspace_dir,
        "session.status",
        json!({ "sessionID": session_id, "status": { "type": "idle" } }),
    );
}

//! Turn Finalization, Synthesis & Persistence Helper
//! Isolated from `runner.rs` so final text synthesis, store saving, job settlement,
//! auto-title generation, and idle event emission live in one focused module.

use crate::paths::{gen_id, now_ms};
use crate::session::message::emit_event;
use crate::session::session::{save_store, with_store};
use serde_json::{json, Value};

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
    mut final_text: String,
    mut content_parts: Vec<Value>,
    chat_messages: &mut Vec<Value>,
) {
    if final_text.trim().is_empty() {
        let synthesis_prompt = if reached_max_steps {
            crate::session::coordinator::MAX_STEPS_PROMPT
        } else {
            "All requested Remotion video studio and code operations have completed execution. Provide a clear, concise final summary and answer to the user."
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
            final_text = "All requested Remotion video studio operations have been completed successfully.".to_string();
        }
    }

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

    let completed_ms = now_ms();
    let total_elapsed = completed_ms.saturating_sub(started_ms);
    crate::paths::log_engine(
        "chat",
        &format!(
            "🏁 Turn completed for session '{}' in {}ms (model: '{}')",
            session_id, total_elapsed, model_id
        ),
    );
    let assistant_msg = json!({
        "id": assistant_msg_id,
        "type": "assistant",
        "role": "assistant",
        "agent": "default",
        "model": { "providerID": provider_id, "id": model_id },
        "content": content_parts,
        "finish": "stop",
        "cost": 0,
        "tokens": { "input": 0, "output": 0, "reasoning": 0, "cache": { "read": 0, "write": 0 } },
        "time": { "created": started_ms, "completed": completed_ms }
    });

    with_store(|store| {
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
            "finish": "stop",
            "cost": 0,
            "tokens": { "input": 0, "output": 0, "reasoning": 0, "cache": { "read": 0, "write": 0 } }
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


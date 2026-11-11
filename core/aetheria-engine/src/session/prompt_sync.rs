//! Synchronous Headless Session Runners for CLI / Messaging Bridges (Telegram, etc.).

use crate::paths::{gen_id, normalize_workspace_path, now_ms};
use serde_json::json;

use super::agent_turn::run_agent_turn;
use super::message::emit_event;
use super::model::default_model_ref;
use super::session::{save_store, with_store};

/// Synchronous runner for headless or CLI bridge execution.
/// Awaits completion and returns the final assistant text.
pub async fn run_session_prompt_sync(
    session_id: &str,
    workspace_dir: &str,
    prompt_text: &str,
    user_tag: Option<&str>,
) -> String {
    let dir = normalize_workspace_path(workspace_dir);
    let model_ref = default_model_ref();
    let provider_id = model_ref
        .get("providerID")
        .and_then(|v| v.as_str())
        .unwrap_or("antigravity")
        .to_string();
    let model_id = model_ref
        .get("id")
        .and_then(|v| v.as_str())
        .unwrap_or("gemini-3.8-flash-low")
        .to_string();

    let user_msg_id = gen_id("msg");
    let created_ms = now_ms();
    let display_prompt = if let Some(tag) = user_tag {
        format!("{}: {}", tag, prompt_text)
    } else {
        prompt_text.to_string()
    };

    let user_msg = json!({
        "id": user_msg_id,
        "type": "user",
        "role": "user",
        "agent": "default",
        "model": {
            "providerID": provider_id,
            "id": model_id
        },
        "text": display_prompt,
        "content": [{ "type": "text", "text": display_prompt }],
        "time": { "created": created_ms }
    });

    let full_prompt = prompt_text.to_string();

    let history = with_store(|store| {
        if !store.sessions.contains_key(session_id) {
            let p_preview: String = if prompt_text.chars().count() > 40 {
                format!("{}...", prompt_text.chars().take(40).collect::<String>())
            } else {
                prompt_text.to_string()
            };
            let title = if let Some(tag) = user_tag {
                format!("{}: {}", tag, p_preview)
            } else {
                p_preview
            };
            store.sessions.insert(
                session_id.to_string(),
                json!({
                    "id": session_id,
                    "title": title,
                    "model": {
                        "providerID": provider_id,
                        "id": model_id
                    },
                    "time": {
                        "created": created_ms,
                        "updated": created_ms
                    }
                }),
            );
        }

        let msgs = store.messages.entry(session_id.to_string()).or_default();
        let hist = msgs.clone();
        msgs.push(user_msg);
        save_store(store);
        hist
    });

    emit_event(
        &dir,
        "session.prompt.started",
        json!({
            "sessionID": session_id,
            "messageID": user_msg_id,
            "prompt": full_prompt
        }),
    );

    run_agent_turn(
        session_id,
        &dir,
        &provider_id,
        &model_id,
        &history,
        &full_prompt,
        None,
    )
    .await;

    with_store(|store| {
        store
            .messages
            .get(session_id)
            .and_then(|msgs| msgs.last())
            .and_then(|last| last.get("content"))
            .and_then(|c| c.as_array())
            .and_then(|arr| {
                arr.iter()
                    .find_map(|p| p.get("text").and_then(|t| t.as_str()))
            })
            .unwrap_or("Done.")
            .to_string()
    })
}

/// Executes a direct prompt without persistent user session history.
pub async fn run_direct_prompt(workspace_dir: &str, prompt_text: &str) -> String {
    let session_id = format!("ses_tg_{}", now_ms());
    run_session_prompt_sync(&session_id, workspace_dir, prompt_text, None).await
}


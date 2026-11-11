//! Session Prompt HTTP Handlers & Synchronous Dispatcher.
//!
//! Exposes Axum HTTP routes for prompt submission, session title updating,
//! and background task dispatch. Re-exports core runner submodules.

pub use super::agent_turn::run_agent_turn;
pub use super::model::{default_model_ref, handle_abort, handle_switch_model};
pub use super::title::{derive_session_title, is_emoji_char};

use crate::files::urlencoding_decode;
use crate::paths::{gen_id, normalize_workspace_path, now_ms};
use crate::session::message::emit_event;
use crate::session::session::{save_store, with_store};
use axum::{
    extract::Path as AxumPath,
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};

static SESSION_LOCKS: OnceLock<Mutex<HashMap<String, Arc<tokio::sync::Mutex<()>>>>> = OnceLock::new();

pub fn get_session_lock(session_id: &str) -> Arc<tokio::sync::Mutex<()>> {
    let map = SESSION_LOCKS.get_or_init(|| Mutex::new(HashMap::new()));
    let mut guard = map.lock().unwrap_or_else(|e| e.into_inner());
    guard
        .entry(session_id.to_string())
        .or_insert_with(|| Arc::new(tokio::sync::Mutex::new(())))
        .clone()
}

/// Axum HTTP handler for `/api/session/:id/prompt`.
/// Records the user prompt into store, derives session title on first turn,
/// and dispatches the autonomous agent turn in the background.
pub async fn handle_prompt(
    AxumPath(session_id): AxumPath<String>,
    q: HashMap<String, String>,
    headers: HeaderMap,
    body: Value,
) -> Response {
    let session_val = with_store(|store| store.sessions.get(&session_id).cloned());
    let Some(session) = session_val else {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Session not found" })),
        )
            .into_response();
    };

    let raw_dir = q
        .get("directory")
        .or_else(|| q.get("workspacePath"))
        .map(|s| s.to_string())
        .or_else(|| {
            headers
                .get("x-aetheria-directory")
                .or_else(|| headers.get("x-opencode-directory"))
                .and_then(|h| h.to_str().ok())
                .map(|s| s.to_string())
        })
        .or_else(|| {
            session
                .pointer("/location/directory")
                .or_else(|| session.get("directory"))
                .and_then(|v| v.as_str())
                .map(|d| d.to_string())
        })
        .unwrap_or_default();
    let norm_dir = normalize_workspace_path(&urlencoding_decode(&raw_dir));
    let workspace_dir = if norm_dir.trim().is_empty() {
        crate::paths::project_root().to_string_lossy().to_string()
    } else {
        norm_dir
    };

    let prompt_text = body
        .get("prompt")
        .and_then(|p| p.get("text").or(Some(p)))
        .and_then(|v| v.as_str())
        .or_else(|| body.get("text").and_then(|v| v.as_str()))
        .unwrap_or("")
        .to_string();

    let files_val = body
        .get("prompt")
        .and_then(|p| p.get("files"))
        .or_else(|| body.get("files"))
        .cloned();

    let model_val = session.get("model").cloned().unwrap_or_else(default_model_ref);
    let provider_id = model_val
        .get("providerID")
        .and_then(|v| v.as_str())
        .unwrap_or("local-cli")
        .to_string();
    let model_id = model_val
        .get("id")
        .and_then(|v| v.as_str())
        .unwrap_or("kiro/auto")
        .to_string();

    let user_msg_id = gen_id("msg");
    let created_ms = now_ms();
    let mut user_msg = json!({
        "id": user_msg_id,
        "type": "user",
        "role": "user",
        "agent": "default",
        "model": {
            "providerID": provider_id,
            "id": model_id
        },
        "text": prompt_text,
        "content": [{ "type": "text", "text": prompt_text }],
        "time": { "created": created_ms }
    });
    if let Some(ref f) = files_val {
        user_msg["files"] = f.clone();
    }

    let mut updated_title: Option<String> = None;
    let _history = with_store(|store| {
        if let Some(sess) = store.sessions.get_mut(&session_id) {
            let current_title = sess.get("title").and_then(|v| v.as_str()).unwrap_or("");
            if current_title.is_empty()
                || current_title.eq_ignore_ascii_case("New Session")
                || current_title.eq_ignore_ascii_case("Chat")
                || current_title.starts_with("New session -")
                || current_title.starts_with("New Session -")
            {
                let auto_title = derive_session_title(&prompt_text);
                if auto_title != "New Session" {
                    sess["title"] = json!(&auto_title);
                    sess["time"]["updated"] = json!(created_ms);
                    updated_title = Some(auto_title);
                }
            }
        }
        let msgs = store.messages.entry(session_id.clone()).or_default();
        let hist = msgs.clone();
        msgs.push(user_msg.clone());
        save_store(store);
        hist
    });

    if let Some(ref title) = updated_title {
        emit_event(
            &workspace_dir,
            "session.updated",
            json!({
                "sessionID": session_id,
                "title": title
            }),
        );
    }

    emit_event(
        &workspace_dir,
        "session.prompt.started",
        json!({
            "sessionID": session_id,
            "messageID": user_msg_id,
            "prompt": prompt_text
        }),
    );

    let sid_c = session_id.clone();
    let ws_c = workspace_dir.clone();
    let pid_c = provider_id.clone();
    let mid_c = model_id.clone();
    let ptxt_c = prompt_text.clone();

    let p_preview: String = if prompt_text.chars().count() > 60 {
        format!("{}...", prompt_text.chars().take(60).collect::<String>())
    } else {
        prompt_text.clone()
    };
    crate::paths::log_engine(
        "chat",
        &format!("📥 User prompt [{}]: \"{}\"", session_id, p_preview),
    );
    crate::paths::log_engine(
        "chat",
        &format!("🎯 Routing request to Model: '{}' (Provider: '{}')", model_id, provider_id),
    );

    let files_c = files_val.clone();
    let wants_steer = body
        .get("delivery")
        .and_then(|v| v.as_str())
        .map(|s| s.eq_ignore_ascii_case("steer"))
        .unwrap_or(false)
        || body.get("steer").and_then(|v| v.as_bool()).unwrap_or(false);

    // If the session is already running a turn and the caller requested a mid-turn steer,
    // admit it into the SessionInbox so the active runner promotes it at the next step boundary!
    if wants_steer && crate::session::session::is_active_run(&session_id) {
        let item = crate::session::coordinator::admit_inbox_item(
            &session_id,
            &prompt_text,
            crate::session::coordinator::InboxDelivery::Steer,
        );
        return Json(json!({
            "data": {
                "id": user_msg_id,
                "inboxID": item.id,
                "sessionID": session_id,
                "prompt": {
                    "text": prompt_text,
                    "files": [],
                    "agents": []
                },
                "delivery": "steer",
                "timeCreated": created_ms
            }
        }))
        .into_response();
    }

    let lock = get_session_lock(&sid_c);
    tokio::spawn(async move {
        let _turn_guard = lock.lock().await;
        // Fetch up-to-date history from store in case another turn just settled before us
        let current_history = with_store(|store| {
            store.messages.get(&sid_c).cloned().unwrap_or_default()
        });
        run_agent_turn(
            &sid_c,
            &ws_c,
            &pid_c,
            &mid_c,
            &current_history,
            &ptxt_c,
            files_c.as_ref(),
        )
        .await;
    });

    Json(json!({
        "data": {
            "id": user_msg_id,
            "sessionID": session_id,
            "prompt": {
                "text": prompt_text,
                "files": [],
                "agents": []
            },
            "delivery": "interrupt",
            "timeCreated": created_ms
        }
    }))
    .into_response()
}

pub use super::prompt_sync::{run_direct_prompt, run_session_prompt_sync};

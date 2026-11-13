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

/// Wakes an idle parent session after background subagent(s) complete and deliver
/// `<subagent-notification>` items into the parent inbox.
pub fn wake_parent_session_after_background(parent_session_id: &str, workspace_dir: &str) {
    let sid = parent_session_id.to_string();
    let ws = workspace_dir.to_string();
    tokio::spawn(async move {
        let lock = get_session_lock(&sid);
        let _turn_guard = lock.lock().await;

        let mut drained = Vec::new();
        while let Some(item) = crate::session::coordinator::pop_next_queued_input(&sid) {
            drained.push(item.text);
        }
        for steer in crate::session::coordinator::drain_pending_steers(&sid) {
            drained.push(steer.text);
        }
        if drained.is_empty() {
            return;
        }

        let consolidated_prompt = drained.join("\n\n");
        let (provider_id, model_id, history, resolved_ws) = with_store(|store| {
            let sess = store.sessions.get(&sid);
            let m = sess
                .and_then(|s| s.get("model"))
                .cloned()
                .unwrap_or_else(default_model_ref);
            let pid = m
                .get("providerID")
                .and_then(|v| v.as_str())
                .unwrap_or("local-cli")
                .to_string();
            let mid = m
                .get("id")
                .and_then(|v| v.as_str())
                .unwrap_or("kiro/auto")
                .to_string();
            let sws = sess
                .and_then(|s| s.pointer("/location/directory").or_else(|| s.get("directory")))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .filter(|s| !s.is_empty())
                .unwrap_or_else(|| ws.clone());
            // Snapshot history BEFORE persisting the synthetic notice so run_agent_turn
            // appends `consolidated_prompt` once during the turn while keeping future turns consistent.
            let hist = store.messages.get(&sid).cloned().unwrap_or_default();
            if crate::session::agent_turn::subagent_store::persist_synthetic_subagent_notice(
                store,
                &sid,
                &consolidated_prompt,
            ) {
                save_store(store);
            }
            (pid, mid, hist, sws)
        });

        run_agent_turn(
            &sid,
            &resolved_ws,
            &provider_id,
            &model_id,
            &history,
            &consolidated_prompt,
            None,
        )
        .await;
    });
}

/// Resumes persisted inbox items after engine restart, popping one queued item at a time so
/// subsequent items continue in strict FIFO turn sequence via `runner.rs`.
pub fn wake_session_inbox_on_startup(session_id: &str) {
    let sid = session_id.to_string();
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(120)).await;
        let lock = get_session_lock(&sid);
        let _turn_guard = lock.lock().await;

        let Some(first_item) = crate::session::coordinator::pop_next_queued_input(&sid) else {
            return;
        };

        let (provider_id, model_id, history, resolved_ws, exists) = with_store(|store| {
            let Some(sess) = store.sessions.get(&sid) else {
                return (
                    "local-cli".to_string(),
                    "kiro/auto".to_string(),
                    Vec::new(),
                    crate::paths::project_root().to_string_lossy().to_string(),
                    false,
                );
            };
            let m = sess
                .get("model")
                .cloned()
                .unwrap_or_else(default_model_ref);
            let pid = m
                .get("providerID")
                .and_then(|v| v.as_str())
                .unwrap_or("local-cli")
                .to_string();
            let mid = m
                .get("id")
                .and_then(|v| v.as_str())
                .unwrap_or("kiro/auto")
                .to_string();
            let sws = sess
                .pointer("/location/directory")
                .or_else(|| sess.get("directory"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .filter(|s| !s.is_empty())
                .unwrap_or_else(|| crate::paths::project_root().to_string_lossy().to_string());
            let hist = store.messages.get(&sid).cloned().unwrap_or_default();
            store.messages.entry(sid.clone()).or_default().push(json!({
                "id": gen_id("msg"),
                "type": "user",
                "text": first_item.text,
                "time": { "created": now_ms() }
            }));
            save_store(store);
            (pid, mid, hist, sws, true)
        });

        if !exists {
            return;
        }

        run_agent_turn(
            &sid,
            &resolved_ws,
            &provider_id,
            &model_id,
            &history,
            &first_item.text,
            None,
        )
        .await;
    });
}

/// Resumes an interrupted compaction after an engine crash/restart (`K54`): emits
/// `session.compaction.failed` (`compaction.interrupted`), re-runs compaction, and resumes the turn.
pub fn wake_session_compaction_on_startup(recovery: crate::session::restart::PendingCompactionRecovery) {
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(150)).await;
        let lock = get_session_lock(&recovery.session_id);
        let _turn_guard = lock.lock().await;

        let (provider_id, model_id, resolved_ws, exists) = with_store(|store| {
            let Some(sess) = store.sessions.get(&recovery.session_id) else {
                return (
                    "local-cli".to_string(),
                    "kiro/auto".to_string(),
                    recovery.workspace_dir.clone(),
                    false,
                );
            };
            let m = sess
                .get("model")
                .cloned()
                .unwrap_or_else(default_model_ref);
            let pid = m
                .get("providerID")
                .and_then(|v| v.as_str())
                .unwrap_or("local-cli")
                .to_string();
            let mid = m
                .get("id")
                .and_then(|v| v.as_str())
                .unwrap_or("kiro/auto")
                .to_string();
            let sws = if !recovery.workspace_dir.is_empty() {
                recovery.workspace_dir.clone()
            } else {
                sess.pointer("/location/directory")
                    .or_else(|| sess.get("directory"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .filter(|s| !s.is_empty())
                    .unwrap_or_else(|| crate::paths::project_root().to_string_lossy().to_string())
            };
            (pid, mid, sws, true)
        });

        if !exists {
            return;
        }

        let cfg = crate::provider::read_aetheria_config();
        let is_local_bridge = provider_id == "antigravity" || provider_id == "local-cli";
        let base_url = if is_local_bridge {
            let port = crate::bridge::ensure_bridge_running().await;
            format!("http://127.0.0.1:{}/v1", port)
        } else {
            cfg.pointer(&format!("/provider/{}/options/baseURL", provider_id))
                .or_else(|| cfg.pointer(&format!("/provider/{}/api/url", provider_id)))
                .or_else(|| cfg.pointer(&format!("/provider/{}/api", provider_id)))
                .or_else(|| cfg.pointer(&format!("/providers/{}/options/baseURL", provider_id)))
                .or_else(|| cfg.pointer(&format!("/providers/{}/api/url", provider_id)))
                .and_then(|v| v.as_str())
                .map(|s| s.trim_end_matches('/').to_string())
                .unwrap_or_else(|| crate::bridge::get_bridge_base_url())
        };
        let api_key = cfg
            .pointer(&format!("/provider/{}/options/apiKey", provider_id))
            .or_else(|| cfg.pointer(&format!("/provider/{}/request/body/apiKey", provider_id)))
            .or_else(|| cfg.pointer(&format!("/providers/{}/options/apiKey", provider_id)))
            .or_else(|| cfg.pointer(&format!("/providers/{}/request/body/apiKey", provider_id)))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| "local-cli-bridge".to_string());

        crate::session::message::emit_event(
            &resolved_ws,
            "session.compaction.failed",
            json!({
                "sessionID": &recovery.session_id,
                "error": {
                    "type": "compaction.interrupted",
                    "message": "Compaction interrupted by engine restart"
                }
            }),
        );

        let client = reqwest::Client::builder()
            .connect_timeout(std::time::Duration::from_secs(15))
            .timeout(std::time::Duration::from_secs(120))
            .build()
            .unwrap_or_default();

        let mut chat_messages = recovery.messages;
        if chat_messages.is_empty() {
            chat_messages = with_store(|store| {
                store
                    .messages
                    .get(&recovery.session_id)
                    .cloned()
                    .unwrap_or_default()
            });
        }

        let outcome = crate::session::compaction_summary::compact_with_budget_ladder(
            &client,
            &base_url,
            &api_key,
            &model_id,
            &recovery.session_id,
            &resolved_ws,
            &recovery.reason,
            &mut chat_messages,
        )
        .await;

        if !matches!(
            outcome,
            crate::session::compaction_summary::CompactionOutcome::Succeeded
        ) {
            return;
        }

        let continuation_prompt = crate::session::restart::CONTINUE_AFTER_SERVER_RESTART.to_string();
        let history = with_store(|store| {
            let h = store
                .messages
                .get(&recovery.session_id)
                .cloned()
                .unwrap_or_default();
            store
                .messages
                .entry(recovery.session_id.clone())
                .or_default()
                .push(json!({
                    "id": gen_id("msg"),
                    "type": "user",
                    "text": continuation_prompt,
                    "time": { "created": now_ms() }
                }));
            save_store(store);
            h
        });

        run_agent_turn(
            &recovery.session_id,
            &resolved_ws,
            &provider_id,
            &model_id,
            &history,
            crate::session::restart::CONTINUE_AFTER_SERVER_RESTART,
            None,
        )
        .await;
    });
}

/// Resumes a session turn that was interrupted mid-execution or mid-tool by an engine shutdown/crash (`K41`, `K55`).
pub fn wake_interrupted_turn_on_startup(recovery: crate::session::restart::InterruptedTurnRecovery) {
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(150)).await;
        let lock = get_session_lock(&recovery.session_id);
        let _turn_guard = lock.lock().await;

        let continuation_prompt = crate::session::restart::CONTINUE_AFTER_SERVER_RESTART.to_string();
        let (provider_id, model_id, history, resolved_ws, exists) = with_store(|store| {
            let Some(sess) = store.sessions.get(&recovery.session_id) else {
                return (
                    "local-cli".to_string(),
                    "kiro/auto".to_string(),
                    Vec::new(),
                    recovery.workspace_dir.clone(),
                    false,
                );
            };
            let m = sess
                .get("model")
                .cloned()
                .unwrap_or_else(default_model_ref);
            let pid = m
                .get("providerID")
                .and_then(|v| v.as_str())
                .unwrap_or("local-cli")
                .to_string();
            let mid = m
                .get("id")
                .and_then(|v| v.as_str())
                .unwrap_or("kiro/auto")
                .to_string();
            let sws = if !recovery.workspace_dir.is_empty() {
                recovery.workspace_dir.clone()
            } else {
                sess.pointer("/location/directory")
                    .or_else(|| sess.get("directory"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .filter(|s| !s.is_empty())
                    .unwrap_or_else(|| crate::paths::project_root().to_string_lossy().to_string())
            };
            let hist = store.messages.get(&recovery.session_id).cloned().unwrap_or_default();
            store
                .messages
                .entry(recovery.session_id.clone())
                .or_default()
                .push(json!({
                    "id": gen_id("msg"),
                    "type": "user",
                    "text": continuation_prompt,
                    "time": { "created": now_ms() }
                }));
            save_store(store);
            (pid, mid, hist, sws, true)
        });

        if !exists {
            return;
        }

        run_agent_turn(
            &recovery.session_id,
            &resolved_ws,
            &provider_id,
            &model_id,
            &history,
            crate::session::restart::CONTINUE_AFTER_SERVER_RESTART,
            None,
        )
        .await;
    });
}

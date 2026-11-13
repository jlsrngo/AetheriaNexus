//! End-to-End Integration Test for Non-Blocking Parallel Subagents (up to 4 concurrent on cloud
//! providers + standby queue on overflow / local-cli), Per-Subagent Wakeup Doorbell, Synthetic
//! History Persistence, and UI Notice Mapping.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use axum::{extract::State, routing::post, Json, Router};
use serde_json::{json, Value};

use super::runner::run_agent_turn;
use crate::session::job_registry::{list_session_jobs, with_job_store, JobStatus};
use crate::session::message::get_event_sender;
use crate::session::session::{is_active_run, with_store};
use crate::session::ui_mapper::map_messages_for_ui;

#[derive(Default)]
struct MockLlmState {
    active_subagents: AtomicUsize,
    max_concurrent_subagents: AtomicUsize,
    subagent_calls: AtomicUsize,
    parent_wake_calls: AtomicUsize,
    prompts_seen: Mutex<Vec<String>>,
}

async fn handle_mock_chat_completions(
    State(state): State<Arc<MockLlmState>>,
    Json(body): Json<Value>,
) -> Json<Value> {
    let messages = body
        .get("messages")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let system_text = messages
        .first()
        .and_then(|m| m.get("content"))
        .and_then(|v| v.as_str())
        .unwrap_or("");

    // Identify child subagents via their specialized system prompt
    let is_explore = system_text.contains("Explore Subagent");
    let is_audio = system_text.contains("Audio Director Subagent");

    if is_explore || is_audio {
        let cur = state.active_subagents.fetch_add(1, Ordering::SeqCst) + 1;
        state
            .max_concurrent_subagents
            .fetch_max(cur, Ordering::SeqCst);
        state.subagent_calls.fetch_add(1, Ordering::SeqCst);

        // Hold request long enough so parallel siblings clearly overlap on the upstream server
        tokio::time::sleep(Duration::from_millis(220)).await;
        state.active_subagents.fetch_sub(1, Ordering::SeqCst);

        let reply = if is_explore {
            "Temuan riset engine selesai."
        } else {
            "Audio scene 1 siap."
        };
        return Json(json!({
            "choices": [{
                "finish_reason": "stop",
                "message": { "role": "assistant", "content": reply }
            }]
        }));
    }

    // Parent session flow
    let last_msg = messages.last().cloned().unwrap_or(Value::Null);
    let last_role = last_msg.get("role").and_then(|v| v.as_str()).unwrap_or("");
    let last_content = last_msg
        .get("content")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let notif_count = messages
        .iter()
        .filter_map(|m| m.get("content").and_then(|v| v.as_str()))
        .map(|s| s.matches("<subagent-notification ").count())
        .sum::<usize>();

    state
        .prompts_seen
        .lock()
        .unwrap()
        .push(format!("role={};notifs={}", last_role, notif_count));

    // Step 1 of Turn 1: after receiving tool outputs (`state: "running"`), go standby immediately
    if last_role == "tool" {
        return Json(json!({
            "choices": [{
                "finish_reason": "stop",
                "message": {
                    "role": "assistant",
                    "content": "Dua subagent berjalan di background dan antrean standby aktif. Laporan akan masuk otomatis."
                }
            }]
        }));
    }

    // Wakeup turns: woken per finished subagent
    if notif_count > 0 || last_content.contains("<subagent-notification ") {
        let wake_num = state.parent_wake_calls.fetch_add(1, Ordering::SeqCst) + 1;
        let msg = if notif_count <= 1 && last_content.contains("remaining_standby=\"1\"") {
            "Laporan explore (selesai): Temuan riset engine selesai.".to_string()
        } else {
            format!(
                "Laporan akhir (#{}): Audio scene 1 siap. Semua subagent selesai.",
                wake_num
            )
        };
        return Json(json!({
            "choices": [{
                "finish_reason": "stop",
                "message": { "role": "assistant", "content": msg }
            }]
        }));
    }

    // Check burst trigger: launch 5 concurrent subagents to verify 4-slot cap + standby overflow
    if last_content.contains("5 subagent burst") {
        let tool_calls: Vec<Value> = (1..=5)
            .map(|idx| {
                json!({
                    "id": format!("call_burst_{idx}"),
                    "type": "function",
                    "function": {
                        "name": "task",
                        "arguments": json!({
                            "description": format!("Burst subagent {idx}"),
                            "prompt": format!("Run burst task {idx}"),
                            "subagent_type": if idx % 2 == 0 { "audio-director" } else { "explore" }
                        }).to_string()
                    }
                })
            })
            .collect();
        return Json(json!({
            "choices": [{
                "finish_reason": "tool_calls",
                "message": {
                    "role": "assistant",
                    "content": "",
                    "tool_calls": tool_calls
                }
            }]
        }));
    }

    // Turn 1 initial step: emit two parallel `task` calls WITHOUT `background` (proves default async)
    Json(json!({
        "choices": [{
            "finish_reason": "tool_calls",
            "message": {
                "role": "assistant",
                "content": "",
                "tool_calls": [
                    {
                        "id": "call_sub_1",
                        "type": "function",
                        "function": {
                            "name": "task",
                            "arguments": "{\"description\":\"Inspect engine files\",\"prompt\":\"Find standby files\",\"subagent_type\":\"explore\"}"
                        }
                    },
                    {
                        "id": "call_sub_2",
                        "type": "function",
                        "function": {
                            "name": "task",
                            "arguments": "{\"description\":\"Generate scene audio\",\"prompt\":\"Synthesize audio\",\"subagent_type\":\"audio-director\"}"
                        }
                    }
                ]
            }
        }]
    }))
}

#[tokio::test]
async fn e2e_parallel_subagents_default_background_standby_wakeup_and_ui_notice() {
    let state = Arc::new(MockLlmState::default());
    let app = Router::new()
        .route("/v1/chat/completions", post(handle_mock_chat_completions))
        .with_state(state.clone());

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind mock server");
    let addr = listener.local_addr().expect("mock addr");
    let mock_base = format!("http://{}/v1", addr);
    let server_handle = tokio::spawn(async move {
        let _ = axum::serve(listener, app).await;
    });

    let parent_sid = crate::paths::gen_id("sess_e2e_sub");
    let workspace_dir = "E:\\JS\\ArunakiNexus\\workspace";

    let mut rx = get_event_sender().subscribe();

    let initial_prompt = "Tolong jalankan 2 subagent paralel sekarang";
    let user_msg = json!({
        "id": crate::paths::gen_id("msg"),
        "type": "user",
        "role": "user",
        "agent": "default",
        "text": initial_prompt,
        "time": { "created": crate::paths::now_ms() }
    });
    with_store(|store| {
        store.sessions.insert(
            parent_sid.clone(),
            json!({
                "id": parent_sid,
                "directory": workspace_dir,
                "model": {
                    "providerID": "mock-e2e",
                    "id": "gpt-5.4",
                    "baseURL": mock_base,
                    "apiKey": "mock-key"
                }
            }),
        );
        store
            .messages
            .insert(parent_sid.clone(), vec![user_msg.clone()]);
    });

    let t0 = Instant::now();
    run_agent_turn(
        &parent_sid,
        workspace_dir,
        "mock-e2e",
        "gpt-5.4",
        &[user_msg],
        initial_prompt,
        None,
    )
    .await;
    let turn1_elapsed = t0.elapsed();

    // Parent Turn 1 MUST return promptly in background/standby without blocking on subagent sleeps
    assert!(
        turn1_elapsed < Duration::from_secs(2),
        "Parent turn blocked instead of returning in standby: {:?}",
        turn1_elapsed
    );

    // Wait for both background subagents + parent wakeup turn(s) to settle
    let deadline = Instant::now() + Duration::from_secs(6);
    loop {
        let jobs = list_session_jobs(&parent_sid);
        let sub_jobs: Vec<_> = jobs.iter().filter(|j| j.kind == "subagent").collect();
        let all_sub_done =
            sub_jobs.len() == 2 && sub_jobs.iter().all(|j| j.status == JobStatus::Completed);
        let wakes_done = state.parent_wake_calls.load(Ordering::SeqCst) >= 1
            && !is_active_run(&parent_sid)
            && crate::session::coordinator::list_inbox_items(&parent_sid).is_empty();
        if all_sub_done && wakes_done {
            // Brief settle for persistence inside finalize_agent_turn
            tokio::time::sleep(Duration::from_millis(80)).await;
            if !is_active_run(&parent_sid) {
                break;
            }
        }
        assert!(
            Instant::now() < deadline,
            "Timed out waiting for subagents & parent wakeup to finish"
        );
        tokio::time::sleep(Duration::from_millis(30)).await;
    }

    // Drain captured SSE events belonging to parent_sid
    let mut events = Vec::new();
    while let Ok(evt) = rx.try_recv() {
        let psid = evt
            .get("parentSessionId")
            .or_else(|| evt.get("sessionID"))
            .and_then(|v| v.as_str())
            .unwrap_or("");
        if psid == parent_sid {
            events.push(evt);
        }
    }

    let started_count = events
        .iter()
        .filter(|e| e.get("type").and_then(|v| v.as_str()) == Some("subagent.started"))
        .count();
    let standby_called = events.iter().any(|e| {
        e.get("type").and_then(|v| v.as_str()) == Some("subagent.tool.called")
            && e.get("tool").and_then(|v| v.as_str()) == Some("standby")
    });
    let completed_count = events
        .iter()
        .filter(|e| e.get("type").and_then(|v| v.as_str()) == Some("subagent.completed"))
        .count();

    assert_eq!(started_count, 2, "Expected 2 subagent.started events");
    assert!(
        !standby_called,
        "Expected 2 same-provider cloud subagents to run in parallel without entering standby"
    );
    assert_eq!(completed_count, 2, "Expected 2 subagent.completed events");

    assert_eq!(
        state.max_concurrent_subagents.load(Ordering::SeqCst),
        2,
        "Expected both cloud subagents to execute concurrently against upstream!"
    );
    assert_eq!(state.subagent_calls.load(Ordering::SeqCst), 2);
    assert!(
        state.parent_wake_calls.load(Ordering::SeqCst) >= 1,
        "Parent was never woken after background subagents completed"
    );

    // Verify stored messages & UI mapper output (synthetic notices mapped cleanly without raw XML)
    let raw_msgs = with_store(|store| store.messages.get(&parent_sid).cloned().unwrap_or_default());
    let mapped = map_messages_for_ui(&raw_msgs);

    let has_standby_reply = mapped.iter().any(|m| {
        m.get("content")
            .and_then(|v| v.as_str())
            .map(|s| s.contains("standby aktif"))
            .unwrap_or(false)
    });
    let synthetic_notices: Vec<_> = mapped
        .iter()
        .filter(|m| m.get("agent").and_then(|v| v.as_str()) == Some("subagent-notice"))
        .collect();
    let has_wake_report = mapped.iter().any(|m| {
        m.get("content")
            .and_then(|v| v.as_str())
            .map(|s| s.contains("Laporan "))
            .unwrap_or(false)
    });
    let leaks_xml = mapped.iter().any(|m| {
        m.get("content")
            .and_then(|v| v.as_str())
            .map(|s| s.contains("<subagent-notification"))
            .unwrap_or(false)
    });

    assert!(has_standby_reply, "Missing initial parent standby response");
    assert!(
        !synthetic_notices.is_empty(),
        "Expected persisted synthetic subagent notice messages in store/UI"
    );
    assert!(has_wake_report, "Expected woken parent report message");
    assert!(!leaks_xml, "UI mapper leaked raw <subagent-notification XML");

    // Cleanup test state from disk-backed singletons
    let jobs = list_session_jobs(&parent_sid);
    let child_ids: Vec<String> = jobs
        .iter()
        .filter_map(|j| j.child_session_id.clone())
        .collect();
    with_store(|store| {
        store.sessions.remove(&parent_sid);
        store.messages.remove(&parent_sid);
        for cid in &child_ids {
            store.sessions.remove(cid);
            store.messages.remove(cid);
        }
    });
    with_job_store(|jstore| {
        jstore.jobs.retain(|_, j| j.session_id != parent_sid);
    });
    server_handle.abort();
}

#[tokio::test]
async fn e2e_five_cloud_subagents_cap_at_four_and_queue_fifth_in_standby() {
    let state = Arc::new(MockLlmState::default());
    let app = Router::new()
        .route("/v1/chat/completions", post(handle_mock_chat_completions))
        .with_state(state.clone());

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind mock server");
    let addr = listener.local_addr().expect("mock addr");
    let mock_base = format!("http://{}/v1", addr);
    let server_handle = tokio::spawn(async move {
        let _ = axum::serve(listener, app).await;
    });

    let parent_sid = crate::paths::gen_id("sess_e2e_burst5");
    let temp_ws = std::env::temp_dir().join(format!("aetheria_burst5_{}", crate::paths::now_ms()));
    let _ = std::fs::create_dir_all(&temp_ws);
    let workspace_dir = temp_ws.to_string_lossy().to_string();

    let mut rx = get_event_sender().subscribe();

    let initial_prompt = "Tolong jalankan 5 subagent burst sekarang";
    let user_msg = json!({
        "id": crate::paths::gen_id("msg"),
        "type": "user",
        "role": "user",
        "agent": "default",
        "text": initial_prompt,
        "time": { "created": crate::paths::now_ms() }
    });
    with_store(|store| {
        store.sessions.insert(
            parent_sid.clone(),
            json!({
                "id": parent_sid,
                "directory": workspace_dir,
                "model": {
                    "providerID": "mock-burst",
                    "id": "gpt-5.4-burst",
                    "baseURL": mock_base,
                    "apiKey": "mock-key"
                }
            }),
        );
        store
            .messages
            .insert(parent_sid.clone(), vec![user_msg.clone()]);
    });

    run_agent_turn(
        &parent_sid,
        &workspace_dir,
        "mock-burst",
        "gpt-5.4-burst",
        &[user_msg],
        initial_prompt,
        None,
    )
    .await;

    let deadline = Instant::now() + Duration::from_secs(8);
    loop {
        let jobs = list_session_jobs(&parent_sid);
        let sub_jobs: Vec<_> = jobs.iter().filter(|j| j.kind == "subagent").collect();
        let all_sub_done =
            sub_jobs.len() == 5 && sub_jobs.iter().all(|j| j.status == JobStatus::Completed);
        let wakes_done = state.parent_wake_calls.load(Ordering::SeqCst) >= 1
            && !is_active_run(&parent_sid)
            && crate::session::coordinator::list_inbox_items(&parent_sid).is_empty();
        if all_sub_done && wakes_done {
            tokio::time::sleep(Duration::from_millis(80)).await;
            if !is_active_run(&parent_sid) {
                break;
            }
        }
        assert!(
            Instant::now() < deadline,
            "Timed out waiting for 5 burst subagents to finish"
        );
        tokio::time::sleep(Duration::from_millis(30)).await;
    }

    let mut events = Vec::new();
    while let Ok(evt) = rx.try_recv() {
        let psid = evt
            .get("parentSessionId")
            .or_else(|| evt.get("sessionID"))
            .and_then(|v| v.as_str())
            .unwrap_or("");
        if psid == parent_sid {
            events.push(evt);
        }
    }

    let started_count = events
        .iter()
        .filter(|e| e.get("type").and_then(|v| v.as_str()) == Some("subagent.started"))
        .count();
    let standby_called = events.iter().any(|e| {
        e.get("type").and_then(|v| v.as_str()) == Some("subagent.tool.called")
            && e.get("tool").and_then(|v| v.as_str()) == Some("standby")
    });
    let standby_completed = events.iter().any(|e| {
        e.get("type").and_then(|v| v.as_str()) == Some("subagent.tool.completed")
            && e.get("tool").and_then(|v| v.as_str()) == Some("standby")
            && e.get("ok").and_then(|v| v.as_bool()) == Some(true)
    });
    let completed_count = events
        .iter()
        .filter(|e| e.get("type").and_then(|v| v.as_str()) == Some("subagent.completed"))
        .count();

    assert_eq!(started_count, 5, "Expected 5 subagent.started events");
    assert!(
        standby_called && standby_completed,
        "Expected 5th overflow subagent to queue in standby and resume cleanly"
    );
    assert_eq!(completed_count, 5, "Expected 5 subagent.completed events");

    let max_conc = state.max_concurrent_subagents.load(Ordering::SeqCst);
    assert!(
        (2..=4).contains(&max_conc),
        "Expected concurrent upstream hits between 2 and 4 slots, got {}",
        max_conc
    );
    assert_eq!(state.subagent_calls.load(Ordering::SeqCst), 5);

    let jobs = list_session_jobs(&parent_sid);
    let child_ids: Vec<String> = jobs
        .iter()
        .filter_map(|j| j.child_session_id.clone())
        .collect();
    with_store(|store| {
        store.sessions.remove(&parent_sid);
        store.messages.remove(&parent_sid);
        for cid in &child_ids {
            store.sessions.remove(cid);
            store.messages.remove(cid);
        }
    });
    with_job_store(|jstore| {
        jstore.jobs.retain(|_, j| j.session_id != parent_sid);
    });
    let _ = std::fs::remove_dir_all(&temp_ws);
    server_handle.abort();
}

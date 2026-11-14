//! Isolated Child-Agent / Subagent Runner — mirrors `packages/core/src/plugin/subagent.ts`
//! and `packages/core/src/session/subagent-completion.ts`.
//! Delegates store setup (`subagent_store`), config (`subagent_provider`), and tool loops (`subagent_tool_batch`).

pub use super::subagent_store::{
    build_subagent_system_prompt, build_subagent_tools, get_session_depth,
    load_or_init_child_session, persist_child_session_state, MAX_SUBAGENT_DEPTH,
};

use serde_json::{json, Value};
use std::time::Duration;

use super::kiro_standby::{acquire_subagent_turn_standby, register_subagent_pending};
use super::resilience::{send_resilient_chat_completion, SYNTHETIC_OUTPUT_LIMIT_PROMPT};
use super::subagent_provider::resolve_subagent_provider_config_for_call;
use super::subagent_tool_batch::execute_subagent_tool_calls;
use crate::paths::now_ms;
use crate::session::doom_loop::DoomLoopDetector;
use crate::session::message::emit_event;

pub fn spawn_subagent_tool_definition() -> Value {
    json!({
        "type": "function",
        "function": {
            "name": "task",
            "description": include_str!("../../tool/prompt/task.txt"),
            "parameters": {
                "type": "object",
                "properties": {
                    "description": { "type": "string", "description": "A short (3-5 words) summary of what this subagent will do" },
                    "prompt": { "type": "string", "description": "Detailed, self-contained instructions for the subagent, including exact file paths and expected output" },
                    "subagent_type": { "type": "string", "enum": ["general", "explore", "motion-designer", "audio-director", "qa-verifier"], "description": "The specialized persona and toolset for this subagent" },
                    "sessionID": { "type": "string", "description": "Optional child sessionID from a previous `task` result to continue/resume that subagent's conversation instead of starting fresh" },
                    "background": { "type": "boolean", "description": "Optional (defaults to true, OpenCode pattern). Runs the subagent asynchronously in the background without blocking the parent turn and delivers a <subagent-notification> into the parent SessionInbox when complete. Pass false only when a synchronous blocking wait is strictly required." }
                },
                "required": ["description", "prompt", "subagent_type"]
            }
        }
    })
}

struct ChildActiveRunGuard(String);

impl Drop for ChildActiveRunGuard {
    fn drop(&mut self) {
        crate::session::session::set_active_run(&self.0, false);
    }
}

enum SubagentExitOutcome {
    Completed,
    Incomplete(String),
    Error(String),
}

pub fn execute_subagent<'a>(
    parent_session_id: &'a str,
    workspace_dir: &'a str,
    arguments: &'a Value,
) -> std::pin::Pin<Box<dyn std::future::Future<Output = Value> + Send + 'a>> {
    Box::pin(async move {
        let description = arguments
            .get("description")
            .and_then(|v| v.as_str())
            .unwrap_or("Subagent Task");
        let prompt = arguments
            .get("prompt")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let subagent_type = arguments
            .get("agent")
            .or_else(|| arguments.get("subagent_type"))
            .or_else(|| arguments.get("type"))
            .and_then(|v| v.as_str())
            .unwrap_or("general");
        let model_override = arguments
            .get("model")
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_string);
        let requested_session_id = arguments
            .get("sessionID")
            .or_else(|| arguments.get("child_session_id"))
            .or_else(|| arguments.get("session_id"))
            .and_then(|v| v.as_str());
        let run_in_background = arguments
            .get("background")
            .and_then(|v| v.as_bool())
            .unwrap_or(true);

        if prompt.trim().is_empty() {
            return json!({ "ok": false, "state": "error", "error": "Subagent `prompt` is required and cannot be empty." });
        }

        let parent_depth = get_session_depth(parent_session_id);
        if parent_depth >= MAX_SUBAGENT_DEPTH {
            let err_msg = format!(
                "Maximum subagent recursion depth limit ({}) reached. Execute the remaining tools directly instead of spawning another subagent.",
                MAX_SUBAGENT_DEPTH
            );
            return json!({
                "ok": false, "state": "error", "subagent_type": subagent_type, "error": err_msg,
                "output": format!("<subagent state=\"error\">\n{}\n</subagent>", err_msg)
            });
        }
        let child_depth = parent_depth + 1;
        if let Some(req_cid) = requested_session_id.map(str::trim).filter(|s| !s.is_empty()) {
            if crate::session::session::is_active_run(req_cid) {
                crate::session::coordinator::admit_inbox_item(
                    req_cid,
                    prompt,
                    crate::session::coordinator::InboxDelivery::Steer,
                );
                return json!({
                    "ok": true,
                    "state": "running",
                    "mode": "background",
                    "sessionID": req_cid,
                    "subagent_type": subagent_type,
                    "description": description,
                    "resumed": true,
                    "output": format!(
                        "<subagent sessionID=\"{}\" type=\"{}\" state=\"running\" mode=\"background\">\nFollow-up instructions queued onto active child session {}.\n</subagent>",
                        req_cid, subagent_type, req_cid
                    )
                });
            }
        }
        let sys_prompt = build_subagent_system_prompt(subagent_type, workspace_dir);
        let (child_session_id, chat_messages, is_resumed) = load_or_init_child_session(
            parent_session_id,
            requested_session_id,
            subagent_type,
            description,
            child_depth,
            &sys_prompt,
            prompt,
        );

        crate::session::coordinator::begin_session_turn(&child_session_id);
        crate::session::job_registry::start_subagent_job(
            &child_session_id,
            parent_session_id,
            Some(&child_session_id),
            subagent_type,
            description,
            run_in_background,
        );
        emit_event(
            workspace_dir,
            "subagent.started",
            json!({
                "parentSessionId": parent_session_id,
                "subagentSessionId": child_session_id,
                "subagentType": subagent_type,
                "description": description,
                "background": run_in_background,
                "resumed": is_resumed,
                "depth": child_depth,
                "timestamp": now_ms()
            }),
        );

        let pending_guard = register_subagent_pending(parent_session_id);
        crate::session::session::set_active_run(&child_session_id, true);

        if run_in_background {
            spawn_background_subagent_task(
                BackgroundSubagentSpec {
                    parent_id: parent_session_id.to_string(),
                    ws: workspace_dir.to_string(),
                    child_id: child_session_id.clone(),
                    sub_type: subagent_type.to_string(),
                    desc: description.to_string(),
                    model_override,
                    is_resumed,
                    child_depth,
                    chat_messages,
                },
                pending_guard,
                false,
            );

            return json!({
                "ok": true, "state": "running", "mode": "background",
                "sessionID": child_session_id, "subagent_type": subagent_type, "description": description,
                "output": format!(
                    "<subagent sessionID=\"{}\" type=\"{}\" state=\"running\" mode=\"background\">\nThe subagent is running in parallel in the background (sessionID: {}). Up to 4 sibling subagents run concurrently per cloud provider/model while excess siblings or local-cli queue cleanly in standby. Briefly tell the user what you launched and END YOUR RESPONSE NOW cleanly (DO NOT sleep, poll, or call another tool until woken by <subagent-notification>) so you stay responsive if the user asks questions while waiting.\n</subagent>",
                    child_session_id, subagent_type, child_session_id
                )
            });
        }

        let _active_guard = ChildActiveRunGuard(child_session_id.clone());
        let out = run_subagent_loop(
            parent_session_id,
            workspace_dir,
            &child_session_id,
            subagent_type,
            description,
            model_override.as_deref(),
            is_resumed,
            child_depth,
            chat_messages,
        )
        .await;
        drop(_active_guard);
        drop(pending_guard);
        out
    })
}

struct BackgroundSubagentSpec {
    parent_id: String,
    ws: String,
    child_id: String,
    sub_type: String,
    desc: String,
    model_override: Option<String>,
    is_resumed: bool,
    child_depth: usize,
    chat_messages: Vec<Value>,
}

fn spawn_background_subagent_task(
    spec: BackgroundSubagentSpec,
    pending_guard: super::kiro_standby::SubagentPendingGuard,
    wait_for_boot_sse: bool,
) {
    tokio::spawn(async move {
        let active_guard = ChildActiveRunGuard(spec.child_id.clone());
        if wait_for_boot_sse {
            crate::session::prompt::wait_for_sse_subscriber_or_delay().await;
            tokio::time::sleep(Duration::from_millis(45)).await;
        }
        let out = run_subagent_loop(
            &spec.parent_id,
            &spec.ws,
            &spec.child_id,
            &spec.sub_type,
            &spec.desc,
            spec.model_override.as_deref(),
            spec.is_resumed,
            spec.child_depth,
            spec.chat_messages,
        )
        .await;
        drop(active_guard);

        let remaining = pending_guard.release_now();
        let state_str = out.get("state").and_then(|v| v.as_str()).unwrap_or("completed");
        let output_xml = out.get("output").and_then(|v| v.as_str()).unwrap_or("");
        let safe_desc = spec.desc.replace('"', "'").replace(['<', '>', '\n', '\r'], " ");
        let standby_note = if remaining > 0 {
            format!(
                "\n<standby-status pending=\"{}\">Subagent finished above. {} sibling subagent(s) remain queued or active in standby. Report this completed subagent's findings concisely to the user now (e.g. 'Laporan {} (selesai)') and END YOUR TURN cleanly WITHOUT calling tools, sleeping, or polling — the next queued subagent will notify you when it finishes.</standby-status>",
                remaining, remaining, spec.sub_type
            )
        } else {
            String::from(
                "\n<standby-status pending=\"0\">All background subagents have finished. Deliver a clear final summary or synthesis to the user.</standby-status>"
            )
        };
        let notification = format!(
            "<subagent-notification sessionID=\"{}\" type=\"{}\" state=\"{}\" remaining_standby=\"{}\" description=\"{}\">\n{}{}\n</subagent-notification>",
            spec.child_id, spec.sub_type, state_str, remaining, safe_desc, output_xml, standby_note
        );
        let parent_active = crate::session::session::is_active_run(&spec.parent_id);
        let delivery = if parent_active {
            crate::session::coordinator::InboxDelivery::Steer
        } else {
            crate::session::coordinator::InboxDelivery::Queue
        };
        crate::session::coordinator::admit_inbox_item(&spec.parent_id, &notification, delivery);

        if get_session_depth(&spec.parent_id) == 0 {
            crate::session::prompt::wake_parent_session_after_background(
                &spec.parent_id,
                &spec.ws,
            );
        }
    });
}

/// Resumes a persisted background subagent job that was interrupted by an engine crash (`K53`).
pub fn wake_interrupted_subagent_on_startup(rec: crate::session::restart::InterruptedSubagentRecovery) {
    let loaded = crate::session::session::with_store(|store| {
        let msgs = store.messages.get(&rec.child_session_id).cloned().unwrap_or_default();
        if msgs.is_empty() {
            return None;
        }
        let child_sess = store.sessions.get(&rec.child_session_id);
        let sub_type = child_sess
            .and_then(|s| s.get("agent"))
            .and_then(|v| v.as_str())
            .unwrap_or("general")
            .to_string();
        let child_depth = child_sess
            .and_then(|s| s.get("subagentDepth"))
            .and_then(|v| v.as_u64())
            .map(|n| n as usize)
            .unwrap_or(1);
        let model_override = child_sess
            .and_then(|s| s.get("model"))
            .and_then(|m| {
                let pid = m.get("providerID").and_then(|v| v.as_str())?;
                let mid = m.get("id").and_then(|v| v.as_str())?;
                Some(format!("{}/{}", pid, mid))
            });
        let parent_sess = store.sessions.get(&rec.parent_session_id);
        let ws = parent_sess
            .and_then(|s| s.pointer("/location/directory").or_else(|| s.get("directory")))
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .map(str::to_string)
            .unwrap_or_else(|| crate::paths::project_root().to_string_lossy().to_string());
        Some((sub_type, child_depth, model_override, ws, msgs))
    });

    let Some((sub_type, child_depth, model_override, ws, chat_messages)) = loaded else {
        crate::session::job_registry::settle_job_error(
            &rec.child_session_id,
            "Interrupted subagent session state missing on startup.",
        );
        return;
    };

    crate::session::coordinator::begin_session_turn(&rec.child_session_id);
    let pending_guard = register_subagent_pending(&rec.parent_session_id);
    crate::session::session::set_active_run(&rec.child_session_id, true);
    spawn_background_subagent_task(
        BackgroundSubagentSpec {
            parent_id: rec.parent_session_id,
            ws,
            child_id: rec.child_session_id,
            sub_type,
            desc: rec.description,
            model_override,
            is_resumed: true,
            child_depth,
            chat_messages,
        },
        pending_guard,
        true,
    );
}

#[allow(clippy::too_many_arguments)]
async fn run_subagent_loop(
    parent_session_id: &str,
    workspace_dir: &str,
    child_session_id: &str,
    subagent_type: &str,
    description: &str,
    model_override: Option<&str>,
    is_resumed: bool,
    child_depth: usize,
    mut chat_messages: Vec<Value>,
) -> Value {
    let child_session_id = child_session_id.to_string();
    let (mut base_url, mut api_key, mut model_id, provider_id) =
        resolve_subagent_provider_config_for_call(parent_session_id, subagent_type, model_override)
            .await;
    crate::session::session::with_store(|store| {
        if let Some(sess) = store.sessions.get_mut(&child_session_id) {
            sess["model"] = json!({ "providerID": &provider_id, "id": &model_id });
            crate::session::session::save_store(store);
        }
    });
    let tools = build_subagent_tools(subagent_type, child_depth);
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(120))
        .build()
        .unwrap_or_default();

    let mut final_text = String::new();
    let mut tools_executed: Vec<String> = Vec::new();
    let mut steps_run: usize = 0;
    let max_steps: usize = 12;
    let mut output_limit_continuations: usize = 0;
    let mut doom_detector = DoomLoopDetector::default();
    let mut exit_outcome = SubagentExitOutcome::Completed;

    // Only Kiro (`local-cli` + `kiro/*`) stays strictly 1-slot; all other backends (Cloud APIs,
    // Antigravity/agy, Codex, Claude, OpenCode) allow up to 4 parallel sibling slots per model lane.
    let standby_lane = if provider_id == "local-cli" && model_id.starts_with("kiro/") {
        "local-cli".to_string()
    } else {
        format!("{}::{}", provider_id, model_id)
    };
    let _subagent_turn_permit = match acquire_subagent_turn_standby(
        parent_session_id,
        &child_session_id,
        workspace_dir,
        subagent_type,
        &standby_lane,
        child_depth,
    )
    .await
    {
        Ok(permit) => permit,
        Err(reason) => {
            exit_outcome = SubagentExitOutcome::Incomplete(reason);
            None
        }
    };

    if matches!(exit_outcome, SubagentExitOutcome::Completed) {
        while steps_run < max_steps {
        if let Some(reason) = crate::session::coordinator::is_session_interrupted(parent_session_id)
            .or_else(|| crate::session::coordinator::is_session_interrupted(&child_session_id))
        {
            exit_outcome = SubagentExitOutcome::Incomplete(format!("Subagent interrupted ({})", reason));
            break;
        }
        for steer in crate::session::coordinator::drain_pending_steers(&child_session_id) {
            chat_messages.push(json!({ "role": "user", "content": steer.text }));
        }
        if crate::session::compaction::should_compact(
            &chat_messages,
            crate::session::compaction::DEFAULT_CONTEXT_WINDOW,
        ) {
            chat_messages = crate::session::compaction::emergency_compact_messages(&chat_messages);
        }

        steps_run += 1;
        let completion = match send_resilient_chat_completion(
            &client, &mut base_url, &mut api_key, &mut model_id, &mut chat_messages, &tools, 0.3, 4096,
        ).await {
            Ok(out) => out,
            Err(err_msg) => {
                exit_outcome = SubagentExitOutcome::Error(err_msg);
                break;
            }
        };

        if !completion.assistant_text.trim().is_empty() {
            if !final_text.is_empty() && output_limit_continuations > 0 {
                final_text.push('\n');
                final_text.push_str(&completion.assistant_text);
            } else {
                final_text = completion.assistant_text.clone();
            }
        }

        if !completion.tool_calls.is_empty() {
            output_limit_continuations = 0;
            chat_messages.push(json!({
                "role": "assistant",
                "content": if completion.assistant_text.is_empty() { Value::Null } else { json!(completion.assistant_text) },
                "tool_calls": completion.tool_calls
            }));

            let subagent_vision_enabled = super::runner::model_supports_vision_from_config(
                None,
                &provider_id,
                &model_id,
            );
            if let Some(doom_reason) = execute_subagent_tool_calls(
                parent_session_id,
                &child_session_id,
                workspace_dir,
                subagent_type,
                steps_run,
                subagent_vision_enabled,
                &completion.tool_calls,
                &mut doom_detector,
                &mut tools_executed,
                &mut chat_messages,
            ).await {
                exit_outcome = SubagentExitOutcome::Incomplete(doom_reason);
                break;
            }

            if steps_run >= max_steps {
                chat_messages.push(json!({ "role": "user", "content": crate::session::coordinator::MAX_STEPS_PROMPT }));
                if let Ok(synth) = send_resilient_chat_completion(
                    &client, &mut base_url, &mut api_key, &mut model_id, &mut chat_messages, &[], 0.2, 2048,
                ).await {
                    if !synth.assistant_text.trim().is_empty() {
                        final_text = synth.assistant_text;
                    }
                }
                exit_outcome = SubagentExitOutcome::Incomplete(format!(
                    "Reached maximum step limit ({}) while still requesting tool calls. You can resume this subagent by passing sessionID=\"{}\".",
                    max_steps, child_session_id
                ));
            }
            continue;
        }

        if (completion.finish_reason == "length" || completion.finish_reason == "max_tokens")
            && output_limit_continuations < 2
            && steps_run < max_steps
        {
            output_limit_continuations += 1;
            chat_messages.push(json!({ "role": "assistant", "content": completion.assistant_text }));
            chat_messages.push(json!({ "role": "user", "content": SYNTHETIC_OUTPUT_LIMIT_PROMPT }));
            continue;
        }

        if !completion.assistant_text.is_empty() {
            chat_messages.push(json!({ "role": "assistant", "content": completion.assistant_text }));
        }
        let late_steers = crate::session::coordinator::drain_pending_steers(&child_session_id);
        if !late_steers.is_empty() {
            for steer in late_steers {
                chat_messages.push(json!({ "role": "user", "content": steer.text }));
            }
            continue;
        }
        exit_outcome = SubagentExitOutcome::Completed;
        break;
        }
    }

    drop(_subagent_turn_permit);

    let (ok_flag, state_str, error_field) = match &exit_outcome {
        SubagentExitOutcome::Completed => {
            crate::session::job_registry::settle_job_completed(&child_session_id, Some(final_text.clone()));
            (true, "completed", None)
        }
        SubagentExitOutcome::Incomplete(reason) => {
            crate::session::job_registry::settle_job_error(&child_session_id, reason);
            (false, "incomplete", Some(reason.clone()))
        }
        SubagentExitOutcome::Error(err) => {
            crate::session::job_registry::settle_job_error(&child_session_id, err);
            (false, "error", Some(err.clone()))
        }
    };

    persist_child_session_state(&child_session_id, &chat_messages, state_str);
    emit_event(
        workspace_dir,
        "subagent.completed",
        json!({
            "parentSessionId": parent_session_id, "subagentSessionId": child_session_id,
            "subagentType": subagent_type, "description": description, "state": state_str,
            "ok": ok_flag, "stepsRun": steps_run, "toolsExecuted": tools_executed,
            "error": error_field, "timestamp": now_ms()
        }),
    );

    let body_summary = if !final_text.trim().is_empty() {
        final_text.clone()
    } else if let Some(ref err_msg) = error_field {
        format!("Subagent [{}] stopped in state '{}' after {} steps (tools called: {:?}). Reason: {}", subagent_type, state_str, steps_run, tools_executed, err_msg)
    } else {
        format!("Subagent [{}] completed {} steps (tools called: {:?}).", subagent_type, steps_run, tools_executed)
    };
    let formatted_envelope = if let Some(ref err_msg) = error_field {
        format!("<subagent sessionID=\"{}\" type=\"{}\" state=\"{}\">\n{}\n\n[Diagnostic: {}]\n</subagent>", child_session_id, subagent_type, state_str, body_summary, err_msg)
    } else {
        format!("<subagent sessionID=\"{}\" type=\"{}\" state=\"{}\">\n{}\n</subagent>", child_session_id, subagent_type, state_str, body_summary)
    };

    let mut result = json!({
        "ok": ok_flag, "state": state_str, "sessionID": child_session_id,
        "subagent_type": subagent_type, "description": description, "resumed": is_resumed,
        "steps_executed": steps_run, "tools_called": tools_executed, "output": formatted_envelope
    });
    if let Some(err_msg) = error_field {
        result["error"] = json!(err_msg);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_subagent_empty_prompt_returns_structured_error() {
        let out = execute_subagent("sess_parent_test", "E:\\JS\\ArunakiNexus\\workspace", &json!({
            "description": "Empty test", "prompt": "   ", "subagent_type": "explore"
        })).await;
        assert_eq!(out["ok"], false);
        assert_eq!(out["state"], "error");
    }

    #[tokio::test]
    async fn test_subagent_recursion_depth_guard_blocks_deep_nesting() {
        crate::session::session::with_store(|store| {
            store.sessions.insert("sess_deep_child".to_string(), json!({ "id": "sess_deep_child", "subagentDepth": MAX_SUBAGENT_DEPTH }));
        });
        let out = execute_subagent("sess_deep_child", "E:\\JS\\ArunakiNexus\\workspace", &json!({
            "description": "Nested spawn", "prompt": "Try spawning another subagent", "subagent_type": "general"
        })).await;
        assert_eq!(out["ok"], false);
        assert_eq!(out["state"], "error");
    }

    #[test]
    fn test_child_session_creation_and_continuation() {
        let unique_child_id = crate::paths::gen_id("sub_test_cont");
        let (child_id, initial_msgs, resumed) = load_or_init_child_session(
            "parent_123", Some(&unique_child_id), "explore", "Find files", 1, "You are Explore.", "Step 1 prompt",
        );
        assert_eq!(child_id, unique_child_id);
        assert!(!resumed);
        assert_eq!(initial_msgs.len(), 2);
        let mut updated = initial_msgs;
        updated.push(json!({ "role": "assistant", "content": "Found 3 files." }));
        persist_child_session_state(&child_id, &updated, "incomplete");
        let (resumed_id, resumed_msgs, is_resumed) = load_or_init_child_session(
            "parent_123", Some(&unique_child_id), "explore", "Continue finding files", 1, "You are Explore.", "Step 2 continuation prompt",
        );
        assert_eq!(resumed_id, unique_child_id);
        assert!(is_resumed);
        assert_eq!(resumed_msgs.len(), 4);
    }
}

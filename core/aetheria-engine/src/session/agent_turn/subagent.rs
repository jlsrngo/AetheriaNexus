//! Isolated Child-Agent / Subagent Runner — mirrors `packages/core/src/plugin/subagent.ts`
//! and `packages/core/src/session/subagent-completion.ts`.
//! Delegates store setup (`subagent_store`), config (`subagent_provider`), and tool loops (`subagent_tool_batch`).

pub use super::subagent_store::{
    build_subagent_system_prompt, build_subagent_tools, get_session_depth,
    load_or_init_child_session, persist_child_session_state, MAX_SUBAGENT_DEPTH,
};

use serde_json::{json, Value};
use std::time::Duration;

use super::resilience::{send_resilient_chat_completion, SYNTHETIC_OUTPUT_LIMIT_PROMPT};
use super::subagent_provider::resolve_subagent_provider_config;
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
                    "background": { "type": "boolean", "description": "Optional. If true, runs the subagent asynchronously in the background without blocking the parent turn and delivers a <subagent-notification> into the parent SessionInbox when complete." }
                },
                "required": ["description", "prompt", "subagent_type"]
            }
        }
    })
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
            .get("subagent_type")
            .or_else(|| arguments.get("type"))
            .and_then(|v| v.as_str())
            .unwrap_or("general");
        let requested_session_id = arguments
            .get("sessionID")
            .or_else(|| arguments.get("child_session_id"))
            .or_else(|| arguments.get("session_id"))
            .and_then(|v| v.as_str());
        let run_in_background = arguments
            .get("background")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        if prompt.trim().is_empty() {
            return json!({ "ok": false, "state": "error", "error": "Subagent `prompt` is required and cannot be empty." });
        }

        let parent_depth = get_session_depth(parent_session_id);
        if parent_depth >= MAX_SUBAGENT_DEPTH {
            let err_msg = format!(
                "Maximum subagent recursion depth ({}) reached. Execute the remaining tools directly instead of spawning another subagent.",
                MAX_SUBAGENT_DEPTH
            );
            return json!({
                "ok": false, "state": "error", "subagent_type": subagent_type, "error": err_msg,
                "output": format!("<subagent state=\"error\">\n{}\n</subagent>", err_msg)
            });
        }
        let child_depth = parent_depth + 1;
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
        crate::session::job_registry::start_job(
            &child_session_id,
            parent_session_id,
            Some(&child_session_id),
            "subagent",
            description,
            run_in_background,
        );

        if run_in_background {
            let parent_id_owned = parent_session_id.to_string();
            let ws_owned = workspace_dir.to_string();
            let child_id_owned = child_session_id.clone();
            let sub_type_owned = subagent_type.to_string();
            let desc_owned = description.to_string();

            tokio::spawn(async move {
                let out = run_subagent_loop(
                    &parent_id_owned,
                    &ws_owned,
                    &child_id_owned,
                    &sub_type_owned,
                    &desc_owned,
                    is_resumed,
                    child_depth,
                    chat_messages,
                )
                .await;

                let state_str = out.get("state").and_then(|v| v.as_str()).unwrap_or("completed");
                let output_xml = out.get("output").and_then(|v| v.as_str()).unwrap_or("");
                let notification = format!(
                    "<subagent-notification sessionID=\"{}\" type=\"{}\" state=\"{}\">\n{}\n</subagent-notification>",
                    child_id_owned, sub_type_owned, state_str, output_xml
                );
                let delivery = if crate::session::session::is_active_run(&parent_id_owned) {
                    crate::session::coordinator::InboxDelivery::Steer
                } else {
                    crate::session::coordinator::InboxDelivery::Queue
                };
                crate::session::coordinator::admit_inbox_item(&parent_id_owned, &notification, delivery);
            });

            return json!({
                "ok": true, "state": "running", "mode": "background",
                "sessionID": child_session_id, "subagent_type": subagent_type, "description": description,
                "output": format!(
                    "<subagent sessionID=\"{}\" type=\"{}\" state=\"running\" mode=\"background\">\nThe subagent is working in the background (sessionID: {}). You will be notified automatically when it finishes. DO NOT sleep or poll.\n</subagent>",
                    child_session_id, subagent_type, child_session_id
                )
            });
        }

        run_subagent_loop(
            parent_session_id,
            workspace_dir,
            &child_session_id,
            subagent_type,
            description,
            is_resumed,
            child_depth,
            chat_messages,
        )
        .await
    })
}

#[allow(clippy::too_many_arguments)]
async fn run_subagent_loop(
    parent_session_id: &str,
    workspace_dir: &str,
    child_session_id: &str,
    subagent_type: &str,
    description: &str,
    is_resumed: bool,
    child_depth: usize,
    mut chat_messages: Vec<Value>,
) -> Value {
    let child_session_id = child_session_id.to_string();
    emit_event(
        workspace_dir,
        "subagent.started",
        json!({
            "parentSessionId": parent_session_id, "subagentSessionId": child_session_id,
            "subagentType": subagent_type, "description": description,
            "resumed": is_resumed, "depth": child_depth, "timestamp": now_ms()
        }),
    );

    let (mut base_url, mut api_key, mut model_id) = resolve_subagent_provider_config().await;
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

            if let Some(doom_reason) = execute_subagent_tool_calls(
                parent_session_id,
                &child_session_id,
                workspace_dir,
                subagent_type,
                steps_run,
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
        exit_outcome = SubagentExitOutcome::Completed;
        break;
    }

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

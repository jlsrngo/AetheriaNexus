//! Parallel Supervised Tool Batch Executor for Agent Turn
//! Handles JSON repair, doom-loop blocking, concurrent supervised `execute_tool_call`,
//! UI telemetry emission, and bounded tool result history updates.

use crate::paths::{gen_id, now_ms};
use crate::session::doom_loop::DoomLoopDetector;
use crate::session::message::emit_event;
use crate::session::tools::execute_tool_call;
use serde_json::{json, Value};

struct PreparedCall {
    call_id: String,
    display_name: String,
    fn_name: String,
    args_str: String,
    args_val: Value,
    syntax_error: Option<String>,
    loop_warning: Option<String>,
    tool_start: u64,
}

/// Returns `true` when execution was aborted/interrupted so `runner` can finalize immediately.
#[allow(clippy::too_many_arguments)]
pub(crate) async fn execute_tool_batch(
    session_id: &str,
    workspace_dir: &str,
    assistant_msg_id: &str,
    tool_calls: Vec<Value>,
    tools_disabled: bool,
    doom_loop_detector: &mut DoomLoopDetector,
    content_parts: &mut Vec<Value>,
    chat_messages: &mut Vec<Value>,
) -> bool {
    let mut prepared_calls = Vec::with_capacity(tool_calls.len());
    for tc in tool_calls {
        let call_id = tc
            .get("id")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| gen_id("call"));
        let raw_fn_name = tc
            .pointer("/function/name")
            .and_then(|v| v.as_str())
            .unwrap_or("tool");
        let fn_name = crate::tool::json_repair::canonicalize_tool_name(raw_fn_name).to_string();
        let display_name = if raw_fn_name.trim().eq_ignore_ascii_case("subagent") {
            "subagent".to_string()
        } else {
            fn_name.clone()
        };
        let args_str = tc
            .pointer("/function/arguments")
            .and_then(|v| v.as_str())
            .unwrap_or("{}")
            .to_string();

        let (args_val, syntax_error) =
            match crate::tool::json_repair::parse_or_repair_tool_args(&args_str) {
                Ok(val) => (val, None),
                Err(err) => (json!({}), Some(err)),
            };

        let tool_start = now_ms();
        crate::paths::log_engine(
            "tool",
            &format!("🔧 Executing tool '{}' with input: {}", display_name, args_str),
        );

        let loop_warning = if tools_disabled {
            None
        } else {
            doom_loop_detector.check_and_record(&fn_name, &args_str)
        };
        prepared_calls.push(PreparedCall {
            call_id,
            display_name,
            fn_name,
            args_str,
            args_val,
            syntax_error,
            loop_warning,
            tool_start,
        });
    }

    let futures_vec = prepared_calls.iter().map(|pc| async move {
        if tools_disabled {
            let msg = "Tools are disabled after the maximum agent steps";
            (json!({ "ok": false, "error": msg, "blocked": true }), true)
        } else if let Some(err_msg) = &pc.syntax_error {
            crate::paths::log_engine(
                "tool",
                &format!(
                    "⚠️ JSON argument syntax error for tool '{}': {}",
                    pc.fn_name, err_msg
                ),
            );
            (json!({ "error": err_msg, "blocked": true }), true)
        } else if let Some(warning) = &pc.loop_warning {
            crate::paths::log_engine(
                "tool",
                &format!(
                    "🛑 Doom-loop blocked: tool '{}' repeated identically with args: {}",
                    pc.fn_name, pc.args_str
                ),
            );
            (json!({ "error": warning, "blocked": true }), true)
        } else {
            let out = execute_tool_call(
                session_id,
                assistant_msg_id,
                &pc.call_id,
                &pc.fn_name,
                &pc.args_val,
                workspace_dir,
            )
            .await;
            let failed = out.get("aborted").and_then(|v| v.as_bool()) == Some(true)
                || out.get("denied").and_then(|v| v.as_bool()) == Some(true)
                || out.get("type").and_then(|v| v.as_str()) == Some("aborted")
                || out.get("ok").and_then(|v| v.as_bool()) == Some(false);
            (out, failed)
        }
    });

    let results = futures_util::future::join_all(futures_vec).await;
    let mut was_interrupted = crate::session::coordinator::is_session_interrupted(session_id).is_some();

    for (pc, (tool_out, is_failed)) in prepared_calls.into_iter().zip(results.into_iter()) {
        let call_id = pc.call_id;
        let display_name = pc.display_name;
        let fn_name = pc.fn_name;
        let args_val = pc.args_val;
        let tool_start = pc.tool_start;
        if tool_out.get("aborted").and_then(|v| v.as_bool()) == Some(true) {
            was_interrupted = true;
        }

        let tool_out_str =
            serde_json::to_string_pretty(&tool_out).unwrap_or_else(|_| "{}".to_string());
        let tool_end = now_ms();
        let tool_failed_event = is_failed;
        let tool_dur = tool_end.saturating_sub(tool_start);

        if is_failed {
            let err_msg = tool_out
                .get("error")
                .and_then(|v| v.as_str())
                .or_else(|| tool_out.get("message").and_then(|v| v.as_str()))
                .unwrap_or("Execution failed or blocked");
            let event_kind = if tool_failed_event {
                "session.next.tool.failed"
            } else {
                "session.next.tool.success"
            };
            crate::paths::log_engine(
                "tool",
                &format!(
                    "⚠️ Tool '{}' failed in {}ms: {}",
                    display_name, tool_dur, err_msg
                ),
            );
            emit_event(
                workspace_dir,
                event_kind,
                json!({
                    "sessionID": session_id,
                    "messageID": assistant_msg_id,
                    "id": call_id,
                    "name": display_name,
                    "content": [{ "type": "text", "text": tool_out_str }],
                    "error": { "message": err_msg }
                }),
            );
        } else {
            crate::paths::log_engine(
                "tool",
                &format!("✅ Tool '{}' completed in {}ms", display_name, tool_dur),
            );
            emit_event(
                workspace_dir,
                "session.next.tool.success",
                json!({
                    "sessionID": session_id,
                    "messageID": assistant_msg_id,
                    "id": call_id,
                    "name": display_name,
                    "content": [{ "type": "text", "text": tool_out_str }],
                    "structured": tool_out
                }),
            );
        }

        content_parts.push(json!({
            "type": "tool",
            "id": call_id,
            "name": display_name,
            "state": {
                "status": if is_failed { "error" } else { "completed" },
                "input": args_val,
                "structured": tool_out,
                "content": [{ "type": "text", "text": tool_out_str }],
                "attachments": []
            },
            "time": { "created": tool_start, "completed": tool_end }
        }));

        let (bounded_tool_out_str, was_truncated) =
            crate::tool::truncator::bound_tool_output(&fn_name, &tool_out_str);
        if was_truncated {
            crate::paths::log_engine(
                "tool",
                &format!(
                    "✂️ Tool '{}' output bounded by harness to prevent context exhaustion",
                    fn_name
                ),
            );
        }

        chat_messages.push(json!({
            "role": "tool",
            "tool_call_id": call_id,
            "name": fn_name,
            "content": bounded_tool_out_str
        }));
    }

    was_interrupted
}


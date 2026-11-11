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
    fn_name: String,
    args_str: String,
    args_val: Value,
    syntax_error: Option<String>,
    loop_warning: Option<String>,
    tool_start: u64,
}

#[allow(clippy::too_many_arguments)]
pub(crate) async fn execute_tool_batch(
    session_id: &str,
    workspace_dir: &str,
    assistant_msg_id: &str,
    tool_calls: Vec<Value>,
    doom_loop_detector: &mut DoomLoopDetector,
    content_parts: &mut Vec<Value>,
    chat_messages: &mut Vec<Value>,
) {
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
        emit_event(
            workspace_dir,
            "session.next.tool.called",
            json!({
                "sessionID": session_id,
                "messageID": assistant_msg_id,
                "id": call_id,
                "name": fn_name,
                "input": args_val
            }),
        );
        crate::paths::log_engine(
            "tool",
            &format!("🔧 Executing tool '{}' with input: {}", fn_name, args_str),
        );

        let loop_warning = doom_loop_detector.check_and_record(&fn_name, &args_str);
        prepared_calls.push(PreparedCall {
            call_id,
            fn_name,
            args_str,
            args_val,
            syntax_error,
            loop_warning,
            tool_start,
        });
    }

    let futures_vec = prepared_calls.iter().map(|pc| async move {
        if let Some(err_msg) = &pc.syntax_error {
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
            (out, false)
        }
    });

    let results = futures_util::future::join_all(futures_vec).await;

    for (pc, (tool_out, is_blocked)) in prepared_calls.into_iter().zip(results.into_iter()) {
        let call_id = pc.call_id;
        let fn_name = pc.fn_name;
        let args_val = pc.args_val;
        let tool_start = pc.tool_start;

        let tool_out_str =
            serde_json::to_string_pretty(&tool_out).unwrap_or_else(|_| "{}".to_string());
        let tool_end = now_ms();
        let tool_dur = tool_end.saturating_sub(tool_start);

        if is_blocked {
            crate::paths::log_engine(
                "tool",
                &format!(
                    "⚠️ Tool '{}' was halted by DoomLoopDetector in {}ms",
                    fn_name, tool_dur
                ),
            );
            emit_event(
                workspace_dir,
                "session.next.tool.failed",
                json!({
                    "sessionID": session_id,
                    "messageID": assistant_msg_id,
                    "id": call_id,
                    "name": fn_name,
                    "content": [{ "type": "text", "text": tool_out_str }],
                    "error": { "message": "Execution halted: repeated identical invocation detected" }
                }),
            );
        } else {
            crate::paths::log_engine(
                "tool",
                &format!("✅ Tool '{}' completed in {}ms", fn_name, tool_dur),
            );
            emit_event(
                workspace_dir,
                "session.next.tool.success",
                json!({
                    "sessionID": session_id,
                    "messageID": assistant_msg_id,
                    "id": call_id,
                    "name": fn_name,
                    "content": [{ "type": "text", "text": tool_out_str }],
                    "structured": tool_out
                }),
            );
        }

        content_parts.push(json!({
            "type": "tool",
            "id": call_id,
            "name": fn_name,
            "state": {
                "status": if is_blocked { "error" } else { "completed" },
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
}


//! Single-Step Subagent Tool Batch Runner
//! Executes tool calls for one subagent step concurrently via `join_all` with JSON repair,
//! doom-loop protection, supervised `execute_tool_call`, UI telemetry events, and output bounding.

use serde_json::{json, Value};

use crate::paths::now_ms;
use crate::session::doom_loop::DoomLoopDetector;
use crate::session::message::emit_event;
use crate::session::tool_label_formatter::format_tool_step_label;
use crate::tool::json_repair::{canonicalize_tool_name, parse_or_repair_tool_args};
use crate::tool::truncator::bound_tool_output;

struct PreparedSubagentCall {
    call_id: String,
    fn_name: String,
    parsed_args: Value,
    syntax_error: Option<String>,
    loop_error: Option<String>,
}

#[allow(clippy::too_many_arguments)]
pub(crate) async fn execute_subagent_tool_calls(
    parent_session_id: &str,
    child_session_id: &str,
    workspace_dir: &str,
    subagent_type: &str,
    steps_run: usize,
    model_supports_vision: bool,
    tool_calls: &[Value],
    doom_detector: &mut DoomLoopDetector,
    tools_executed: &mut Vec<String>,
    chat_messages: &mut Vec<Value>,
) -> Option<String> {
    let mut prepared = Vec::with_capacity(tool_calls.len());

    for (idx, tc) in tool_calls.iter().enumerate() {
        let cid = tc
            .get("id")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| format!("sub_call_{}_{}", steps_run, idx));
        let raw_fn_name = tc
            .pointer("/function/name")
            .or_else(|| tc.get("name"))
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let fn_name = canonicalize_tool_name(raw_fn_name).to_string();
        let raw_args = tc
            .pointer("/function/arguments")
            .or_else(|| tc.get("arguments"))
            .and_then(|v| v.as_str())
            .unwrap_or("{}");

        let (parsed_args, syntax_error) = match parse_or_repair_tool_args(raw_args) {
            Ok(val) => (val, None),
            Err(repair_err) => (json!({}), Some(repair_err)),
        };

        let loop_error = if syntax_error.is_none() {
            let canonical_args =
                serde_json::to_string(&parsed_args).unwrap_or_else(|_| raw_args.to_string());
            doom_detector.check_and_record(&fn_name, &canonical_args)
        } else {
            None
        };

        let label = format_tool_step_label(&fn_name, &parsed_args, false);
        if syntax_error.is_none() && loop_error.is_none() {
            tools_executed.push(fn_name.clone());
            emit_event(
                workspace_dir,
                "subagent.tool.called",
                json!({
                    "parentSessionId": parent_session_id,
                    "subagentSessionId": child_session_id,
                    "subagentType": subagent_type,
                    "callID": cid,
                    "tool": fn_name,
                    "label": label,
                    "step": steps_run,
                    "timestamp": now_ms()
                }),
            );
        }

        prepared.push(PreparedSubagentCall {
            call_id: cid,
            fn_name,
            parsed_args,
            syntax_error,
            loop_error,
        });
    }

    let futures = prepared.iter().map(|pc| async move {
        if let Some(err) = &pc.syntax_error {
            return (json!({ "ok": false, "error": err }), false);
        }
        if let Some(reason) = &pc.loop_error {
            return (json!({ "ok": false, "error": reason }), false);
        }
        let result = crate::tool::execute_tool_call(
            child_session_id,
            &pc.call_id,
            &pc.call_id,
            &pc.fn_name,
            &pc.parsed_args,
            workspace_dir,
        )
        .await;
        (result, true)
    });

    let results = futures_util::future::join_all(futures).await;

    let mut aborted_reason: Option<String> = None;
    let mut collected_vision_images = Vec::new();
    for (pc, (mut tool_result, was_executed)) in prepared.into_iter().zip(results.into_iter()) {
        if let Some(reason) = pc.loop_error {
            if aborted_reason.is_none() {
                aborted_reason = Some(reason);
            }
        }
        super::vision::extract_tool_vision_images(&mut tool_result, &mut collected_vision_images);
        if was_executed {
            let is_err = tool_result.get("error").is_some()
                || tool_result.get("ok").and_then(|v| v.as_bool()) == Some(false);
            let done_label = format_tool_step_label(&pc.fn_name, &pc.parsed_args, !is_err);
            emit_event(
                workspace_dir,
                "subagent.tool.completed",
                json!({
                    "parentSessionId": parent_session_id,
                    "subagentSessionId": child_session_id,
                    "subagentType": subagent_type,
                    "callID": pc.call_id,
                    "tool": pc.fn_name,
                    "label": done_label,
                    "ok": !is_err,
                    "error": tool_result.get("error").and_then(|v| v.as_str()),
                    "step": steps_run,
                    "timestamp": now_ms()
                }),
            );
        }
        let serialized = serde_json::to_string(&tool_result).unwrap_or_else(|_| "{}".to_string());
        let (bounded_content, _) = bound_tool_output(&pc.fn_name, &serialized);
        chat_messages.push(json!({
            "role": "tool",
            "tool_call_id": pc.call_id,
            "name": pc.fn_name,
            "content": bounded_content
        }));
    }

    super::vision::append_tool_vision_message(
        chat_messages,
        model_supports_vision,
        collected_vision_images,
    );

    aborted_reason
}

//! Single-Step Subagent Tool Batch Runner
//! Executes tool calls for one subagent step with JSON repair, doom-loop protection,
//! supervised `execute_tool_call`, and output size bounding.

use serde_json::{json, Value};

use crate::session::doom_loop::DoomLoopDetector;
use crate::session::message::emit_event;
use crate::tool::json_repair::{canonicalize_tool_name, parse_or_repair_tool_args};
use crate::tool::truncator::bound_tool_output;

#[allow(clippy::too_many_arguments)]
pub(crate) async fn execute_subagent_tool_calls(
    parent_session_id: &str,
    child_session_id: &str,
    workspace_dir: &str,
    subagent_type: &str,
    steps_run: usize,
    tool_calls: &[Value],
    doom_detector: &mut DoomLoopDetector,
    tools_executed: &mut Vec<String>,
    chat_messages: &mut Vec<Value>,
) -> Option<String> {
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

        let parsed_args = match parse_or_repair_tool_args(raw_args) {
            Ok(val) => val,
            Err(repair_err) => {
                chat_messages.push(json!({
                    "role": "tool",
                    "tool_call_id": cid,
                    "name": fn_name,
                    "content": json!({ "ok": false, "error": repair_err }).to_string()
                }));
                continue;
            }
        };

        let canonical_args = serde_json::to_string(&parsed_args).unwrap_or_else(|_| raw_args.to_string());
        if let Some(reason) = doom_detector.check_and_record(&fn_name, &canonical_args) {
            chat_messages.push(json!({
                "role": "tool",
                "tool_call_id": cid,
                "name": fn_name,
                "content": json!({ "ok": false, "error": reason }).to_string()
            }));
            return Some(reason);
        }

        tools_executed.push(fn_name.clone());
        emit_event(
            workspace_dir,
            "subagent.tool.called",
            json!({
                "parentSessionId": parent_session_id,
                "subagentSessionId": child_session_id,
                "subagentType": subagent_type,
                "tool": fn_name,
                "step": steps_run
            }),
        );

        let tool_result = crate::tool::execute_tool_call(
            child_session_id,
            &cid,
            &cid,
            &fn_name,
            &parsed_args,
            workspace_dir,
        )
        .await;

        let serialized = serde_json::to_string(&tool_result).unwrap_or_else(|_| "{}".to_string());
        let (bounded_content, _) = bound_tool_output(&fn_name, &serialized);

        chat_messages.push(json!({
            "role": "tool",
            "tool_call_id": cid,
            "name": fn_name,
            "content": bounded_content
        }));
    }

    None
}

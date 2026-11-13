//! Stale Session & Tool State Settlement — mirrors `settleStaleToolCalls` in `packages/core/src/session/runner/llm.ts`.
//! Cleans up any orphaned `running`, `streaming`, or `pending` tool parts from interrupted prior runs.

use serde_json::{json, Value};

use crate::paths::now_ms;
use crate::session::message::emit_event;
use crate::session::session::{save_store, with_store};

pub fn settle_stale_session_state(session_id: &str, workspace_dir: &str) -> usize {
    let mut settled_count = 0usize;
    let mut failed_tools = Vec::new();
    let now = now_ms();
    with_store(|store| {
        if let Some(msgs) = store.messages.get_mut(session_id) {
            for msg in msgs.iter_mut() {
                if let Some(parts) = msg.get_mut("content").and_then(|v| v.as_array_mut()) {
                    for part in parts.iter_mut() {
                        if part.get("type").and_then(|v| v.as_str()) == Some("tool") {
                            let status = part
                                .pointer("/state/status")
                                .and_then(|v| v.as_str())
                                .unwrap_or("");
                            if status == "running" || status == "streaming" || status == "pending" {
                                part["state"]["status"] = json!("interrupted");
                                if part.pointer("/state/content").is_none() {
                                    part["state"]["content"] = json!([{
                                        "type": "text",
                                        "text": "Tool execution was interrupted before completion."
                                    }]);
                                }
                                part["time"]["completed"] = json!(now);
                                                failed_tools.push((
                                    part.get("id").cloned().unwrap_or(Value::Null),
                                    part.get("name").cloned().unwrap_or(Value::String("tool".to_string())),
                                ));
                                settled_count += 1;
                            }
                        }
                    }
                }
            }
            if settled_count > 0 {
                save_store(store);
            }
        }
    });
    if settled_count > 0 && !workspace_dir.is_empty() {
        for (id, name) in failed_tools {
            emit_event(
                workspace_dir,
                "session.next.tool.failed",
                json!({
                    "sessionID": session_id,
                    "id": id,
                    "name": name,
                    "error": { "message": "Tool execution interrupted before completion." }
                }),
            );
        }
        emit_event(
            workspace_dir,
            "session.stale_settled",
            json!({ "sessionID": session_id, "settledTools": settled_count }),
        );
    }
    settled_count
}

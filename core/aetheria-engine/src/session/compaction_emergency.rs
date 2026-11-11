//! Emergency Context Overflow Recovery Compaction.
//!
//! Invoked when a live provider request fails with a 400/413 context-length overflow error.
//! Preserves the root system prompt and the latest active user turn while summarizing prior steps.

use serde_json::{json, Value};

/// Performs aggressive emergency compaction on chat messages during a 400 overflow error.
/// Preserves system instructions (msg 0), retains the LATEST active user prompt (`.rfind`),
/// extracts exact files already written in the current turn, and keeps the most recent tool turns intact.
pub fn emergency_compact_messages(messages: &[Value]) -> Vec<Value> {
    if messages.len() <= 2 {
        return messages.to_vec();
    }

    let mut compacted = Vec::new();
    // 1. Preserve Root System Prompt
    compacted.push(messages[0].clone());

    // 2. Find the LATEST (active) user prompt index — NEVER `.find()` which grabs old turn #1 ("halo")!
    let latest_user_idx = messages
        .iter()
        .rposition(|m| m.get("role").and_then(|v| v.as_str()) == Some("user"));

    // Synthesize earlier turns if any exist before latest_user_idx
    let prior_slice = match latest_user_idx {
        Some(idx) if idx > 1 => &messages[1..idx],
        Some(_) => &[],
        None => &messages[1..messages.len() - 1],
    };

    if !prior_slice.is_empty() {
        let mut prior_files = Vec::new();
        let mut prior_actions = Vec::new();

        for m in prior_slice {
            let role = m.get("role").and_then(|v| v.as_str()).unwrap_or("");
            let content = m.get("content").and_then(|v| v.as_str()).unwrap_or("");

            if role == "tool" {
                let name = m.get("name").and_then(|v| v.as_str()).unwrap_or("tool");
                prior_actions.push(format!("Executed tool '{}'", name));
            } else if role == "user" && !content.is_empty() {
                let line = content.lines().next().unwrap_or("").trim();
                if !line.is_empty() && prior_actions.len() < 8 {
                    prior_actions.push(format!("User requested: {}", line));
                }
            }

            // Catch file references from text content
            for word in content.split_whitespace() {
                let clean = word.trim_matches(|c: char| !c.is_alphanumeric() && c != '.' && c != '_' && c != '-');
                if (clean.ends_with(".xlsx")
                    || clean.ends_with(".csv")
                    || clean.ends_with(".docx")
                    || clean.ends_with(".pdf")
                    || clean.ends_with(".md")
                    || clean.ends_with(".tsx")
                    || clean.ends_with(".ts")
                    || clean.ends_with(".mp4")
                    || clean.ends_with(".json"))
                    && !prior_files.contains(&clean.to_string())
                    && prior_files.len() < 10
                {
                    prior_files.push(clean.to_string());
                }
            }
        }

        let prior_summary_md = format!(
            "[Emergency Context Auto-Heal]\n\
             Earlier conversation turns were aggressively compacted by the harness to recover from provider context overflow.\n\
             ## Active Files: {}\n\
             ## Prior Steps:\n{}\n\
             Please continue the task based on the latest prompt.",
            if prior_files.is_empty() {
                "(none)".to_string()
            } else {
                prior_files.join(", ")
            },
            if prior_actions.is_empty() {
                "- (none)".to_string()
            } else {
                prior_actions
                    .iter()
                    .take(8)
                    .map(|a| format!("- {}", a))
                    .collect::<Vec<_>>()
                    .join("\n")
            }
        );

        compacted.push(json!({
            "role": "system",
            "content": prior_summary_md
        }));
    }

    let mut files_written = Vec::new();
    let mut last_actions = Vec::new();

    let scan_slice = match latest_user_idx {
        Some(idx) => &messages[idx..],
        None => &messages[1..],
    };

    for m in scan_slice {
        let role = m.get("role").and_then(|v| v.as_str()).unwrap_or("");
        if role == "assistant" {
            if let Some(tcs) = m.get("tool_calls").and_then(|v| v.as_array()) {
                for tc in tcs {
                    let tname = tc
                        .pointer("/function/name")
                        .and_then(|v| v.as_str())
                        .unwrap_or("tool");
                    let args_str = tc
                        .pointer("/function/arguments")
                        .and_then(|v| v.as_str())
                        .unwrap_or("{}");
                    if let Ok(args_val) = serde_json::from_str::<Value>(args_str) {
                        if let Some(fp) = args_val
                            .get("filePath")
                            .or_else(|| args_val.get("path"))
                            .or_else(|| args_val.get("outputPath"))
                            .and_then(|v| v.as_str())
                        {
                            let entry = format!("{} ({})", tname, fp);
                            if !files_written.contains(&entry) {
                                files_written.push(entry);
                            }
                        }
                    }
                    let act = format!("Called tool '{}'", tname);
                    if !last_actions.contains(&act) {
                        last_actions.push(act);
                    }
                }
            }
        }
    }

    if let Some(idx) = latest_user_idx {
        let mut u = messages[idx].clone();
        if !files_written.is_empty() || !last_actions.is_empty() {
            let summary_md = format!(
                "[In-Turn Progress Summary — Continue Immediately]\n\
                 Already completed in this turn:\n{}\n\
                 Actions executed: {}\n\
                 IMPORTANT: Do NOT greet the user and do NOT repeat files already written above. \
                 Continue immediately with creating the remaining files and calling 'render_video'.",
                if files_written.is_empty() {
                    "- (none yet)".to_string()
                } else {
                    files_written
                        .iter()
                        .map(|f| format!("- {}", f))
                        .collect::<Vec<_>>()
                        .join("\n")
                },
                if last_actions.is_empty() {
                    "(none)".to_string()
                } else {
                    last_actions.join(", ")
                }
            );
            let current_text = u.get("content").and_then(|v| v.as_str()).unwrap_or("");
            let enriched = format!("{}\n\n{}", current_text, summary_md);
            u["content"] = json!(enriched);
        }
        compacted.push(u);
    } else {
        compacted.push(json!({
            "role": "user",
            "content": "Continue task execution."
        }));
    }

    compacted
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_emergency_compact_messages() {
        let messages = vec![
            json!({ "role": "system", "content": "You are Aetheria." }),
            json!({ "role": "user", "content": "Please read sales.xlsx and report.docx" }),
            json!({ "role": "assistant", "content": "Reading files..." }),
            json!({ "role": "tool", "name": "read", "content": "Large file dump..." }),
            json!({ "role": "user", "content": "Now summarize the final total." }),
        ];

        let healed = emergency_compact_messages(&messages);
        assert_eq!(healed.len(), 3);
        assert_eq!(healed[0]["role"], "system");
        assert_eq!(healed[0]["content"], "You are Aetheria.");
        assert_eq!(healed[1]["role"], "system");
        let healed_summary = healed[1]["content"].as_str().unwrap();
        assert!(healed_summary.contains("sales.xlsx"));
        assert_eq!(healed[2]["role"], "user");
        assert_eq!(healed[2]["content"], "Now summarize the final total.");
    }
}


//! Reasoning Tag Stripper & Internal Dotfile Tool Filter.
//!
//! Cleans closed and unclosed `<think>...</think>` blocks and suppresses
//! internal dotfile tool targets (`.aetheria`, `.git`, `AETHERIA.md`) from the chat UI.

use serde_json::Value;

/// Returns `true` if a tool invocation targets internal files like `.aetheria`, `.git`, or `AETHERIA.md`.
pub fn is_internal_tool_target(val: &Value) -> bool {
    let input = val
        .get("state")
        .and_then(|s| s.get("input"))
        .or_else(|| val.get("input"))
        .or_else(|| val.get("args"))
        .or_else(|| val.pointer("/toolInvocation/args"))
        .unwrap_or(val);

    let target_str = input
        .get("TargetFile")
        .or_else(|| input.get("targetFile"))
        .or_else(|| input.get("path"))
        .or_else(|| input.get("filePath"))
        .or_else(|| input.get("file"))
        .or_else(|| input.get("command"))
        .and_then(|v| v.as_str())
        .unwrap_or("");

    if target_str.is_empty() {
        return false;
    }

    let normalized = target_str.replace('\\', "/");
    let lower = normalized.to_lowercase();
    if lower.contains(".aetheria") || lower.contains(".git") || lower.contains("aetheria.md") {
        return true;
    }

    for segment in normalized.split('/') {
        if !segment.is_empty() && segment != "." && segment != ".." && segment.starts_with('.') {
            return true;
        }
    }

    false
}

/// Cleans paired and unclosed `<think>...</think>` tags from text, returning `(clean_text, extracted_thoughts)`.
pub fn clean_reasoning_tags(text: &str) -> (String, Vec<String>) {
    if text.is_empty() {
        return (String::new(), Vec::new());
    }

    let mut thoughts = Vec::new();
    let mut remaining = text.to_string();

    loop {
        let lower = remaining.to_lowercase();
        if let Some(start_idx) = lower.find("<think>") {
            let after_open = start_idx + 7;
            if let Some(end_offset) = lower[after_open..].find("</think>") {
                let end_idx = after_open + end_offset;
                let thought = remaining[after_open..end_idx].trim().to_string();
                if !thought.is_empty() {
                    thoughts.push(thought);
                }
                let mut next_str = remaining[..start_idx].to_string();
                next_str.push_str(&remaining[end_idx + 8..]);
                remaining = next_str;
                continue;
            }
        }
        break;
    }

    let lower = remaining.to_lowercase();
    if let Some(start_idx) = lower.find("<think>") {
        let after_open = start_idx + 7;
        let thought = remaining[after_open..].trim().to_string();
        if !thought.is_empty() {
            thoughts.push(thought);
        }
        remaining = remaining[..start_idx].to_string();
    }

    let clean = remaining
        .replace("</think>", "")
        .replace("</THINK>", "")
        .replace("<think>", "")
        .replace("<THINK>", "")
        .trim()
        .to_string();

    (clean, thoughts)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn cleans_closed_and_unclosed_thinking_tags() {
        let raw = "Hello! <think>Analyzing script file...</think> Here is the report.";
        let (clean, thoughts) = clean_reasoning_tags(raw);
        assert_eq!(clean, "Hello!  Here is the report.");
        assert_eq!(thoughts.len(), 1);
        assert_eq!(thoughts[0], "Analyzing script file...");

        let unclosed = "Initial step. <think>Processing total metrics";
        let (clean2, thoughts2) = clean_reasoning_tags(unclosed);
        assert_eq!(clean2, "Initial step.");
        assert_eq!(thoughts2.len(), 1);
        assert_eq!(thoughts2[0], "Processing total metrics");
    }

    #[test]
    fn detects_internal_tool_targets() {
        assert!(is_internal_tool_target(&json!({ "path": ".aetheria/tasks.json" })));
        assert!(is_internal_tool_target(&json!({ "filePath": "docs/AETHERIA.md" })));
        assert!(!is_internal_tool_target(&json!({ "filePath": "src/App.tsx" })));
    }
}


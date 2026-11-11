//! Document Edit Tool — mirrors `packages/opencode/src/tool/edit.ts`.
//! Modifies existing files with CRLF/LF normalization and cascading fuzzy replacers
//! (Simple, LineTrimmed, BlockAnchor, WhitespaceNormalized, IndentationFlexible, TrimmedBoundary).

use serde_json::{json, Value};

use super::edit_matchers::{
    block_anchor_matches, indentation_flexible_matches, line_trimmed_matches,
    trimmed_boundary_matches, whitespace_normalized_matches,
};
use super::resolve_isolated_path;
use crate::session::message::emit_event;

pub fn edit_tool_definition() -> Value {
    json!({
        "type": "function",
        "function": {
            "name": "edit",
            "description": include_str!("prompt/edit.txt"),
            "parameters": {
                "type": "object",
                "properties": {
                    "filePath": {
                        "type": "string",
                        "description": "The path to the file to modify (relative to workspace or absolute inside workspace)."
                    },
                    "oldString": {
                        "type": "string",
                        "description": "The text to replace."
                    },
                    "newString": {
                        "type": "string",
                        "description": "The text to replace it with (must be different from oldString)."
                    },
                    "replaceAll": {
                        "type": "boolean",
                        "description": "Replace all occurrences of oldString (default false)."
                    }
                },
                "required": ["filePath", "oldString", "newString"]
            }
        }
    })
}

fn normalize_line_endings(text: &str) -> String {
    text.replace("\r\n", "\n")
}

fn detect_line_ending(text: &str) -> &'static str {
    if text.contains("\r\n") {
        "\r\n"
    } else {
        "\n"
    }
}

fn convert_to_line_ending(text: &str, ending: &str) -> String {
    if ending == "\n" {
        text.to_string()
    } else {
        text.replace("\r\n", "\n").replace('\n', "\r\n")
    }
}

/// Applies OpenCode-style cascading replacers on LF-normalized content.
pub fn replace_content(
    content: &str,
    old_string: &str,
    new_string: &str,
    replace_all: bool,
) -> Result<(String, usize), String> {
    if old_string.is_empty() {
        return Err("oldString cannot be empty when editing an existing file.".to_string());
    }
    if old_string == new_string {
        return Err("No changes to apply: oldString and newString are identical.".to_string());
    }

    let candidate_lists: Vec<Vec<String>> = vec![
        vec![old_string.to_string()],
        line_trimmed_matches(content, old_string),
        block_anchor_matches(content, old_string),
        whitespace_normalized_matches(content, old_string),
        indentation_flexible_matches(content, old_string),
        trimmed_boundary_matches(content, old_string),
    ];

    for candidates in candidate_lists {
        for search in candidates {
            if search.is_empty() {
                continue;
            }
            if let Some(first_idx) = content.find(&search) {
                let count = content.matches(&search).count();
                if replace_all || count == 1 {
                    let updated = if replace_all {
                        content.replace(&search, new_string)
                    } else {
                        let mut res = String::with_capacity(content.len() + new_string.len());
                        res.push_str(&content[..first_idx]);
                        res.push_str(new_string);
                        res.push_str(&content[first_idx + search.len()..]);
                        res
                    };
                    return Ok((updated, if replace_all { count } else { 1 }));
                }
                // Multiple occurrences even when replaceAll is false: replace all to avoid blocking document edits
                let updated = content.replace(&search, new_string);
                return Ok((updated, count));
            }
        }
    }

    Err("Could not find oldString in the file. Read the file first to verify its current contents.".to_string())
}

pub fn execute_edit(session_id: &str, workspace_dir: &str, arguments: &Value) -> Value {
    let fp = arguments
        .get("filePath")
        .or_else(|| arguments.get("path"))
        .or_else(|| arguments.get("file"))
        .or_else(|| arguments.get("targetFile"))
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let target = arguments
        .get("oldString")
        .or_else(|| arguments.get("old_string"))
        .or_else(|| arguments.get("target"))
        .or_else(|| arguments.get("find"))
        .or_else(|| arguments.get("search"))
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let replacement = arguments
        .get("newString")
        .or_else(|| arguments.get("new_string"))
        .or_else(|| arguments.get("replacement"))
        .or_else(|| arguments.get("replace"))
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let replace_all = arguments
        .get("replaceAll")
        .or_else(|| arguments.get("replace_all"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    if target.is_empty() {
        return json!({ "error": "oldString (target) cannot be empty." });
    }

    match resolve_isolated_path(workspace_dir, fp) {
        Ok(p) => match std::fs::read_to_string(&p) {
            Ok(content_old) => {
                let ending = detect_line_ending(&content_old);
                let norm_content = normalize_line_endings(&content_old);
                let norm_old = normalize_line_endings(target);
                let norm_new = normalize_line_endings(replacement);

                match replace_content(&norm_content, &norm_old, &norm_new, replace_all) {
                    Ok((norm_updated, count)) => {
                        let updated = convert_to_line_ending(&norm_updated, ending);
                        if let Err(val_err) = super::write::validate_root_tsx_imports(&p, &updated) {
                            return json!({ "error": val_err });
                        }
                        crate::files::record_document_change(workspace_dir, fp, &content_old, &updated);
                        match std::fs::write(&p, &updated) {
                            Ok(_) => {
                                emit_event(
                                    workspace_dir,
                                    "file.edited",
                                    json!({
                                        "file": fp,
                                        "sessionID": session_id,
                                        "before": content_old,
                                        "after": updated
                                    }),
                                );
                                let mut res = json!({
                                    "ok": true,
                                    "output": "Edit applied successfully.",
                                    "occurrencesReplaced": count
                                });
                                super::film_feedback::attach_post_write_feedback(
                                    &mut res,
                                    workspace_dir,
                                    &p,
                                );
                                res
                            }
                            Err(e) => json!({ "error": format!("Write error: {}", e) }),
                        }
                    }
                    Err(err_msg) => json!({
                        "error": format!("{} (file: '{}')", err_msg, fp)
                    }),
                }
            }
            Err(e) => json!({ "error": format!("Read error on '{}': {}", fp, e) }),
        },
        Err(e) => json!({ "error": e }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_crlf_multiline_edit_succeeds() {
        let crlf_content = "SUMMARY REPORT\r\n1. Revenue: 100\r\n2. Expense: 20\r\nTotal: 80\r\n";
        let ending = detect_line_ending(crlf_content);
        assert_eq!(ending, "\r\n");

        let norm_content = normalize_line_endings(crlf_content);
        let norm_old = normalize_line_endings("2. Expense: 20\nTotal: 80");
        let norm_new = normalize_line_endings("2. Expense: 20\n3. Shipping: 15\nTotal: 65");

        let (updated_lf, count) = replace_content(&norm_content, &norm_old, &norm_new, false).unwrap();
        assert_eq!(count, 1);

        let final_crlf = convert_to_line_ending(&updated_lf, ending);
        assert!(final_crlf.contains("3. Shipping: 15\r\nTotal: 65\r\n"));
    }

    #[test]
    fn test_line_trimmed_and_whitespace_replacers() {
        let content = "Line 1   \n  Line 2:   Value 50  \nLine 3\n";
        let old_str = "Line 1\nLine 2: Value 50\nLine 3";
        let new_str = "Line 1\nLine 2: Value 75\nLine 3";

        let (updated, count) = replace_content(content, old_str, new_str, false).unwrap();
        assert_eq!(count, 1);
        assert!(updated.contains("Line 2: Value 75"));
    }
}

//! Workspace LSP Diagnostics & Symbol Extractor — mirrors `packages/core/src/tool/lsp.ts`.

use serde_json::{json, Value};

use super::resolve_isolated_path;

pub fn lsp_tool_definition() -> Value {
    json!({
        "type": "function",
        "function": {
            "name": "lsp",
            "description": include_str!("prompt/lsp.txt"),
            "parameters": {
                "type": "object",
                "properties": {
                    "filePath": {
                        "type": "string",
                        "description": "Relative path to the file inside the workspace to check for syntax/type diagnostics."
                    },
                    "operation": {
                        "type": "string",
                        "enum": ["diagnostics", "symbols"],
                        "description": "LSP operation to run (default: diagnostics)."
                    }
                },
                "required": ["filePath"]
            }
        }
    })
}

pub fn execute_lsp(workspace_dir: &str, arguments: &Value) -> Value {
    let file_path = arguments
        .get("filePath")
        .or_else(|| arguments.get("path"))
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let target = match resolve_isolated_path(workspace_dir, file_path) {
        Ok(p) => p,
        Err(e) => return json!({ "ok": false, "error": e }),
    };

    if !target.exists() {
        return json!({ "ok": false, "error": format!("File does not exist: {}", file_path) });
    }

    let ext = target
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        "json" => match std::fs::read_to_string(&target)
            .and_then(|s| serde_json::from_str::<Value>(&s).map_err(std::io::Error::other))
        {
            Ok(_) => json!({ "ok": true, "diagnostics": [], "output": "JSON syntax is valid (0 errors)." }),
            Err(e) => json!({ "ok": false, "diagnostics": [e.to_string()], "output": format!("JSON syntax error: {}", e) }),
        },
        "js" | "mjs" | "cjs" => {
            let feedback = super::film_feedback::collect_file_feedback(workspace_dir, &target);
            if let Some(err) = feedback.syntax_error {
                json!({
                    "ok": false,
                    "diagnostics": feedback.diagnostics,
                    "output": err
                })
            } else {
                let mut res = json!({
                    "ok": true,
                    "diagnostics": feedback.diagnostics,
                    "output": if feedback.diagnostics.is_empty() {
                        "JavaScript syntax and film lint passed (0 issues).".to_string()
                    } else {
                        format!(
                            "JavaScript syntax passed with {} advisory diagnostic(s).",
                            feedback.diagnostics.len()
                        )
                    }
                });
                if let Some(obj) = res.as_object_mut() {
                    if let Some(meta) = feedback.film_meta {
                        obj.insert("filmMeta".to_string(), meta);
                    }
                }
                res
            }
        }
        "html" | "htm" => {
            let feedback = super::film_feedback::collect_file_feedback(workspace_dir, &target);
            let mut res = json!({
                "ok": !feedback.has_errors,
                "diagnostics": feedback.diagnostics,
                "output": if feedback.diagnostics.is_empty() {
                    "HTML motion film inspection passed (0 issues).".to_string()
                } else {
                    format!(
                        "HTML film inspection reported {} diagnostic(s).",
                        feedback.diagnostics.len()
                    )
                }
            });
            if let Some(obj) = res.as_object_mut() {
                if let Some(meta) = feedback.film_meta {
                    obj.insert("filmMeta".to_string(), meta);
                }
            }
            res
        }
        _ => {
            let content = std::fs::read_to_string(&target).unwrap_or_default();
            let symbols: Vec<String> = content
                .lines()
                .enumerate()
                .filter_map(|(idx, line)| {
                    let t = line.trim();
                    if t.starts_with("export ")
                        || t.starts_with("function ")
                        || t.starts_with("const ")
                        || t.starts_with("pub fn ")
                        || t.starts_with("fn ")
                    {
                        Some(format!("L{}: {}", idx + 1, t))
                    } else {
                        None
                    }
                })
                .take(60)
                .collect();
            json!({
                "ok": true,
                "diagnostics": [],
                "symbols": symbols,
                "output": format!("Extracted {} top-level symbols from {}", symbols.len(), file_path)
            })
        }
    }
}


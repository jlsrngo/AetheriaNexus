//! Workspace LSP Diagnostics & Symbol Extractor — mirrors `packages/core/src/tool/lsp.ts`.

use serde_json::{json, Value};
use std::process::Command;

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
            let out = Command::new("node").arg("--check").arg(&target).output();
            match out {
                Ok(o) if o.status.success() => {
                    json!({ "ok": true, "diagnostics": [], "output": "JavaScript syntax check passed (0 errors)." })
                }
                Ok(o) => {
                    let stderr = String::from_utf8_lossy(&o.stderr).trim().to_string();
                    json!({ "ok": false, "diagnostics": [stderr], "output": stderr })
                }
                Err(e) => json!({ "ok": false, "error": format!("Failed to invoke node --check: {}", e) }),
            }
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


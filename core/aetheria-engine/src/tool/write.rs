//! Document Write Tool — mirrors `packages/engine/engine/src/tool/write.ts`.
//! Creates or updates a file inside the isolated active project folder.

use serde_json::{json, Value};

use std::path::Path;
use super::resolve_isolated_path;
use crate::session::message::emit_event;

pub fn validate_root_tsx_imports(file_path: &Path, content: &str) -> Result<(), String> {
    if !file_path
        .file_name()
        .map(|n| n == "Root.tsx" || n == "Root.jsx")
        .unwrap_or(false)
    {
        return Ok(());
    }
    let parent = file_path.parent().unwrap_or(file_path);
    for line in content.lines() {
        let trimmed = line.trim();
        if !trimmed.starts_with("import ") && !trimmed.starts_with("export ") {
            continue;
        }
        for quote in ['"', '\''] {
            let marker = format!("from {quote}./");
            if let Some(pos) = trimmed.find(&marker) {
                let start = pos + marker.len() - 2;
                let rest = &trimmed[start..];
                if let Some(end) = rest[2..].find(quote) {
                    let rel_spec = &rest[..end + 2];
                    let clean_rel = rel_spec.trim_start_matches("./");
                    let candidates = [
                        parent.join(format!("{}.tsx", clean_rel)),
                        parent.join(format!("{}.ts", clean_rel)),
                        parent.join(format!("{}.jsx", clean_rel)),
                        parent.join(format!("{}.js", clean_rel)),
                        parent.join(clean_rel).join("index.tsx"),
                        parent.join(clean_rel).join("index.ts"),
                        parent.join(clean_rel),
                    ];
                    let exists = candidates.iter().any(|c| c.exists());
                    if !exists {
                        return Err(format!(
                            "Cannot update Root.tsx: imported file '{}' does not exist on disk yet. Please create and write '{}' first before referencing it in Root.tsx to prevent Vite build failures.",
                            rel_spec, rel_spec
                        ));
                    }
                }
            }
        }
    }
    Ok(())
}

pub fn write_tool_definition() -> Value {
    json!({
        "type": "function",
        "function": {
            "name": "write",
            "description": include_str!("prompt/write.txt"),
            "parameters": {
                "type": "object",
                "properties": {
                    "filePath": { "type": "string", "description": "Relative path to the file inside workspace." },
                    "content": { "type": "string", "description": "Full file content to write." }
                },
                "required": ["filePath", "content"]
            }
        }
    })
}

pub fn execute_write(session_id: &str, workspace_dir: &str, arguments: &Value) -> Value {
    let fp = arguments
        .get("filePath")
        .or_else(|| arguments.get("path"))
        .or_else(|| arguments.get("file"))
        .or_else(|| arguments.get("target"))
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let content = arguments
        .get("content")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    match resolve_isolated_path(workspace_dir, fp) {
        Ok(p) => {
            if let Err(val_err) = validate_root_tsx_imports(&p, content) {
                return json!({ "error": val_err });
            }
            let before_content = std::fs::read_to_string(&p).unwrap_or_default();
            if let Some(parent) = p.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            crate::files::record_document_change(workspace_dir, fp, &before_content, content);
            let write_res = std::fs::write(&p, content);
            match write_res {
                Ok(_) => {
                    emit_event(
                        workspace_dir,
                        "file.edited",
                        json!({
                            "file": fp,
                            "sessionID": session_id,
                            "before": before_content,
                            "after": content
                        }),
                    );
                    let mut res = json!({ "ok": true, "bytesWritten": content.len() });
                    super::film_feedback::attach_post_write_feedback(&mut res, workspace_dir, &p);
                    res
                }
                Err(e) => json!({ "error": format!("Write error: {}", e) }),
            }
        }
        Err(e) => json!({ "error": e }),
    }
}

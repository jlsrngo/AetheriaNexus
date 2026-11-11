//! Baseline Snapshot Inspection & Rollback Tool — mirrors `packages/core/src/worktree/snapshot.ts`.

use serde_json::{json, Value};
use std::path::Path;

use super::resolve_isolated_path;

pub fn snapshot_tool_definition() -> Value {
    json!({
        "type": "function",
        "function": {
            "name": "snapshot",
            "description": "Inspect or roll back workspace file changes using the automatic baseline snapshot system (mirrors OpenCode VCS/Worktree snapshot recovery).",
            "parameters": {
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["status", "restore"],
                        "description": "'status' lists modified files with baseline backups; 'restore' reverts a specific file to its pre-edit snapshot."
                    },
                    "filePath": {
                        "type": "string",
                        "description": "Relative file path to restore when action is 'restore'."
                    }
                },
                "required": ["action"]
            }
        }
    })
}

pub fn execute_snapshot(workspace_dir: &str, arguments: &Value) -> Value {
    let action = arguments
        .get("action")
        .and_then(|v| v.as_str())
        .unwrap_or("status");
    let baseline_root = Path::new(workspace_dir).join(".aetheria").join("baseline");

    if action == "restore" {
        let rel = arguments
            .get("filePath")
            .or_else(|| arguments.get("path"))
            .and_then(|v| v.as_str())
            .unwrap_or("");
        if rel.is_empty() {
            return json!({ "ok": false, "error": "filePath is required for snapshot restore" });
        }
        let target = match resolve_isolated_path(workspace_dir, rel) {
            Ok(p) => p,
            Err(e) => return json!({ "ok": false, "error": e }),
        };
        let clean_rel = rel.trim_start_matches("./").replace('\\', "/");
        let baseline_file = baseline_root.join(&clean_rel);
        let new_marker = baseline_root.join(format!("{}.__new__", clean_rel));
        if new_marker.exists() {
            let _ = std::fs::remove_file(&target);
            let _ = std::fs::remove_file(&new_marker);
            return json!({ "ok": true, "output": format!("Reverted newly created file '{}'", clean_rel) });
        }
        if baseline_file.exists() {
            if let Err(e) = std::fs::copy(&baseline_file, &target) {
                return json!({ "ok": false, "error": format!("Failed to restore snapshot: {}", e) });
            }
            let _ = std::fs::remove_file(&baseline_file);
            return json!({ "ok": true, "output": format!("Restored '{}' from baseline snapshot", clean_rel) });
        }
        return json!({ "ok": false, "error": format!("No baseline snapshot found for '{}'", clean_rel) });
    }

    let mut files = Vec::new();
    if baseline_root.exists() {
        crate::files::collect_files_recursive(&baseline_root, &baseline_root, &mut files, 200);
    }
    let rel_list: Vec<String> = files
        .into_iter()
        .filter_map(|p| {
            p.strip_prefix(&baseline_root)
                .ok()
                .map(|r| r.to_string_lossy().replace('\\', "/"))
        })
        .collect();
    json!({
        "ok": true,
        "snapshots": rel_list,
        "output": format!("{} file snapshot(s) available in .aetheria/baseline", rel_list.len())
    })
}


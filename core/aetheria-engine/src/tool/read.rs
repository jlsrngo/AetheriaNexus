//! Document Read Tool — mirrors `packages/opencode/src/tool/read.ts`.
//! Reads text files or lists directory entries within the isolated active project folder.

use serde_json::{json, Value};
use std::path::{Component, Path, PathBuf};

use super::resolve_isolated_path;

/// Allows read-only access ONLY to built-in IDE skill instructions inside `.aetheria/skills/`
/// so skill paths surfaced in `<skills>` load cleanly without breaching workspace isolation.
fn resolve_builtin_skill_read_path(raw_file: &str) -> Option<PathBuf> {
    let trimmed = raw_file.trim();
    if trimmed.is_empty() {
        return None;
    }
    let req_path = Path::new(trimmed);
    if req_path
        .components()
        .any(|c| matches!(c, Component::ParentDir))
    {
        return None;
    }
    let skills_root = std::fs::canonicalize(crate::paths::project_root().join(".aetheria").join("skills")).ok()?;
    let candidate = std::fs::canonicalize(req_path).ok()?;
    if candidate.is_file() && candidate.starts_with(&skills_root) {
        Some(candidate)
    } else {
        None
    }
}

pub fn read_tool_definition() -> Value {
    json!({
        "type": "function",
        "function": {
            "name": "read",
            "description": include_str!("prompt/read.txt"),
            "parameters": {
                "type": "object",
                "properties": {
                    "filePath": { "type": "string", "description": "Path to the file or directory inside the workspace." },
                    "offset": { "type": "number", "description": "Optional line offset to begin reading from." },
                    "limit": { "type": "number", "description": "Optional maximum number of lines to read." }
                },
                "required": ["filePath"]
            }
        }
    })
}

pub fn execute_read(workspace_dir: &str, arguments: &Value) -> Value {
    let fp = arguments
        .get("filePath")
        .or_else(|| arguments.get("path"))
        .or_else(|| arguments.get("file"))
        .or_else(|| arguments.get("target"))
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let resolved = resolve_isolated_path(workspace_dir, fp)
        .or_else(|iso_err| resolve_builtin_skill_read_path(fp).ok_or(iso_err));

    match resolved {
        Ok(p) => {
            if p.is_dir() {
                match std::fs::read_dir(&p) {
                    Ok(rd) => {
                        let mut entries = Vec::new();
                        for entry in rd.flatten() {
                            let name = entry.file_name().to_string_lossy().to_string();
                            if name.starts_with('.') || name.starts_with("~$") || name == "node_modules" {
                                continue;
                            }
                            let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
                            if is_dir {
                                entries.push(format!("{}/", name));
                            } else {
                                entries.push(name);
                            }
                        }
                        entries.sort();
                        json!({ "content": entries.join("\n"), "isDirectory": true, "entries": entries })
                    }
                    Err(e) => json!({ "error": format!("Directory read error: {}", e) }),
                }
            } else {
                match std::fs::read_to_string(&p) {
                    Ok(content) => {
                        let offset = arguments.get("offset").and_then(|v| v.as_u64()).unwrap_or(0) as usize;
                        let limit = arguments.get("limit").and_then(|v| v.as_u64()).map(|n| n as usize);

                        let lines: Vec<&str> = content.lines().collect();
                        let total_lines = lines.len();

                        if offset > 0 || limit.is_some() || total_lines > crate::tool::truncator::MAX_TOOL_OUTPUT_LINES {
                            let lim = limit.unwrap_or(crate::tool::truncator::MAX_TOOL_OUTPUT_LINES);
                            let start = offset.min(total_lines);
                            let end = (start + lim).min(total_lines);
                            let sliced = lines[start..end].join("\n");
                            json!({
                                "content": sliced,
                                "linesTotal": total_lines,
                                "offset": start,
                                "linesReturned": end - start
                            })
                        } else {
                            json!({ "content": content, "linesTotal": total_lines })
                        }
                    }
                    Err(e) => json!({ "error": format!("Read error: {}", e) }),
                }
            }
        }
        Err(e) => json!({ "error": e }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_read_allows_builtin_skills_and_rejects_arbitrary_external_paths() {
        let external = std::env::temp_dir()
            .join("aetheria_outside_ws_test")
            .join("secret.txt");
        assert!(resolve_builtin_skill_read_path(external.to_string_lossy().as_ref()).is_none());

        let skill_md = crate::paths::project_root()
            .join(".aetheria")
            .join("skills")
            .join("mg-3d-spatial")
            .join("SKILL.md");
        if skill_md.is_file() {
            assert!(
                resolve_builtin_skill_read_path(skill_md.to_string_lossy().as_ref()).is_some()
            );
        }
    }
}

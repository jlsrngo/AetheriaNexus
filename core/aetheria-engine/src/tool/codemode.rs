//! OpenCode Codemode Execution Sandbox — mirrors `packages/codemode/src/tool.ts`.
//! Allows the LLM to execute a self-contained JavaScript automation script inside an
//! isolated workspace sandbox with injected helpers (`workspaceDir`, `readJson`, `writeJson`).

use serde_json::{json, Value};
use std::path::Path;
use std::process::Command;

pub fn codemode_tool_definition() -> Value {
    json!({
        "type": "function",
        "function": {
            "name": "codemode",
            "description": "Execute a self-contained Node.js / JavaScript automation script in an isolated sandbox with pre-injected workspace helpers (`workspaceDir`, `fs`, `path`, `readJson(rel)`, `writeJson(rel, data)`). Use this for batch scene generation, bulk JSON/SVG calculations, or multi-file transformations in a single step.",
            "parameters": {
                "type": "object",
                "properties": {
                    "code": {
                        "type": "string",
                        "description": "JavaScript code to run inside an async IIFE with `workspaceDir`, `fs`, `path`, `readJson`, and `writeJson` pre-bound."
                    },
                    "description": {
                        "type": "string",
                        "description": "Short summary of what this batch script computes or modifies."
                    }
                },
                "required": ["code"]
            }
        }
    })
}

pub async fn execute_codemode(
    session_id: &str,
    workspace_dir: &str,
    arguments: &Value,
) -> Value {
    let user_code = arguments
        .get("code")
        .or_else(|| arguments.get("script"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim();

    if user_code.is_empty() {
        return json!({ "ok": false, "error": "codemode `code` parameter is required" });
    }

    let sandbox_dir = Path::new(workspace_dir).join(".aetheria").join("codemode");
    let _ = std::fs::create_dir_all(&sandbox_dir);
    let script_file = sandbox_dir.join(format!("run_{}.cjs", crate::paths::now_ms()));

    let escaped_ws = workspace_dir.replace('\\', "\\\\").replace('"', "\\\"");
    let harness_code = format!(
        r#"const fs = require("fs");
const path = require("path");
const workspaceDir = "{escaped_ws}";
function resolveSafe(rel) {{
  const target = path.resolve(workspaceDir, rel);
  if (!target.toLowerCase().startsWith(path.resolve(workspaceDir).toLowerCase())) {{
    throw new Error("Path outside workspace: " + rel);
  }}
  return target;
}}
function readJson(rel) {{
  return JSON.parse(fs.readFileSync(resolveSafe(rel), "utf8"));
}}
function writeJson(rel, data) {{
  const p = resolveSafe(rel);
  fs.mkdirSync(path.dirname(p), {{ recursive: true }});
  fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf8");
  return p;
}}
(async () => {{
  const __result = await (async () => {{
{user_code}
  }})();
  if (__result !== undefined) {{
    console.log(typeof __result === "string" ? __result : JSON.stringify(__result, null, 2));
  }}
}})().catch(err => {{
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
}});
"#
    );

    if let Err(e) = std::fs::write(&script_file, &harness_code) {
        return json!({ "ok": false, "error": format!("Failed to write codemode script: {}", e) });
    }

    let script_path_cloned = script_file.clone();
    let ws_cloned = workspace_dir.to_string();
    let sid_cloned = session_id.to_string();

    let exec_res = tokio::task::spawn_blocking(move || {
        #[cfg(windows)]
        use std::os::windows::process::CommandExt;
        #[cfg(windows)]
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let mut cmd = Command::new("node");
        cmd.arg(&script_path_cloned).current_dir(&ws_cloned);
        #[cfg(windows)]
        cmd.creation_flags(CREATE_NO_WINDOW);
        cmd.output()
    })
    .await
    .unwrap_or_else(|e| Err(std::io::Error::other(e.to_string())));

    let _ = std::fs::remove_file(&script_file);

    match exec_res {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            let ok = output.status.success();
            let combined = if !stdout.is_empty() && !stderr.is_empty() {
                format!("{}\n[stderr]\n{}", stdout, stderr)
            } else if !stdout.is_empty() {
                stdout
            } else if !stderr.is_empty() {
                stderr
            } else {
                "(codemode completed with no stdout)".to_string()
            };
            let (bounded, _) = crate::tool::truncator::bound_tool_output("codemode", &combined);
            crate::session::message::emit_event(
                workspace_dir,
                "codemode.executed",
                json!({ "sessionID": sid_cloned, "ok": ok }),
            );
            json!({
                "ok": ok,
                "exitCode": output.status.code().unwrap_or(-1),
                "output": bounded
            })
        }
        Err(e) => json!({ "ok": false, "error": format!("Codemode execution failed: {}", e) }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_codemode_definition_valid() {
        let def = codemode_tool_definition();
        assert_eq!(def["function"]["name"], "codemode");
    }
}


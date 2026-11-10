//! Workspace Shell Execution Tool — runs Remotion/TypeScript checks, media tools, or scratch scripts.
//! Native tools (`read`, `edit`, `write`, `render_video`) remain top priority.

use serde_json::{json, Value};
use std::path::Path;
use std::process::Command;

use super::resolve_isolated_path;
use crate::session::message::emit_event;

pub fn bash_tool_definition() -> Value {
    json!({
        "type": "function",
        "function": {
            "name": "bash",
            "description": include_str!("prompt/bash.txt"),
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "Shell command to execute inside the Remotion video workspace (e.g. TypeScript check or media utility)."
                    },
                    "workdir": {
                        "type": "string",
                        "description": "Relative working directory inside workspace. Defaults to '.aetheria/scratch'."
                    }
                },
                "required": ["command"]
            }
        }
    })
}

pub async fn execute_bash(
    session_id: &str,
    workspace_dir: &str,
    arguments: &Value,
) -> Value {
    let command = arguments
        .get("command")
        .or_else(|| arguments.get("cmd"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim();

    if command.is_empty() {
        return json!({ "error": "Command is required" });
    }

    // Ensure .aetheria/scratch exists
    let scratch_dir = Path::new(workspace_dir).join(".aetheria").join("scratch");
    let _ = std::fs::create_dir_all(&scratch_dir);

    // Determine working directory (strictly inside workspace)
    let workdir = if let Some(wd) = arguments.get("workdir").and_then(|v| v.as_str()) {
        match resolve_isolated_path(workspace_dir, wd) {
            Ok(p) => p,
            Err(e) => return json!({ "error": e }),
        }
    } else {
        scratch_dir.clone()
    };

    let cmd_str = command.to_string();
    let cwd = workdir.clone();
    let session_id_owned = session_id.to_string();
    let workspace_dir_owned = workspace_dir.to_string();

    let res = tokio::task::spawn_blocking(move || {
        #[cfg(windows)]
        use std::os::windows::process::CommandExt;
        #[cfg(windows)]
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let is_powershell_hint = cmd_str.contains("Get-Content")
            || cmd_str.contains("Select-Object")
            || cmd_str.contains("Select-String")
            || cmd_str.contains("Set-Content")
            || cmd_str.contains("Out-File")
            || cmd_str.contains("Test-Path")
            || cmd_str.starts_with("cat ")
            || cmd_str.starts_with("ls ")
            || cmd_str == "ls"
            || cmd_str == "pwd";

        let mut cmd = if cfg!(windows) {
            if is_powershell_hint {
                let mut c = Command::new("powershell.exe");
                c.args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", &cmd_str]);
                c
            } else {
                let mut c = Command::new("cmd.exe");
                c.args(["/C", &cmd_str]);
                c
            }
        } else {
            let mut c = Command::new("/bin/sh");
            c.args(["-c", &cmd_str]);
            c
        };

        #[cfg(windows)]
        cmd.creation_flags(CREATE_NO_WINDOW);

        cmd.current_dir(&cwd);
        cmd.env("PYTHONIOENCODING", "utf-8");
        cmd.env("PYTHONUTF8", "1");

        let initial_output = cmd.output();

        #[cfg(windows)]
        {
            if !is_powershell_hint {
                if let Ok(ref out) = initial_output {
                    let err_str = String::from_utf8_lossy(&out.stderr);
                    let out_str = String::from_utf8_lossy(&out.stdout);
                    if (!out.status.success()) && (err_str.contains("not recognized") || out_str.contains("not recognized")) {
                        let mut ps_cmd = Command::new("powershell.exe");
                        ps_cmd.args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", &cmd_str]);
                        ps_cmd.creation_flags(CREATE_NO_WINDOW);
                        ps_cmd.current_dir(&cwd);
                        ps_cmd.env("PYTHONIOENCODING", "utf-8");
                        ps_cmd.env("PYTHONUTF8", "1");
                        if let Ok(ps_out) = ps_cmd.output() {
                            return Ok(ps_out);
                        }
                    }
                }
            }
        }

        initial_output
    })
    .await
    .unwrap_or_else(|e| Err(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())));

    // Automatically clean up temporary scratch scripts in .aetheria/scratch after execution
    let _ = std::fs::remove_dir_all(&scratch_dir);

    match res {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            let exit_code = output.status.code().unwrap_or(-1);

            let combined_output = if !stdout.is_empty() && !stderr.is_empty() {
                format!("{}\n\n[stderr]\n{}", stdout, stderr)
            } else if !stdout.is_empty() {
                stdout
            } else if !stderr.is_empty() {
                stderr
            } else {
                "(no output)".to_string()
            };

            emit_event(
                &workspace_dir_owned,
                "command.executed",
                json!({
                    "command": command,
                    "exitCode": exit_code,
                    "sessionID": session_id_owned
                }),
            );

            json!({
                "ok": output.status.success(),
                "exitCode": exit_code,
                "output": combined_output
            })
        }
        Err(e) => json!({ "error": format!("Failed to execute command: {}", e) }),
    }
}

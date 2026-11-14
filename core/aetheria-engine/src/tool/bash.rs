//! Workspace Shell Execution Tool — runs Remotion/TypeScript checks, media tools, or scratch scripts.
//! Native tools (`read`, `edit`, `write`, `render_video`) remain top priority.

use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

use super::resolve_isolated_path;
use crate::session::message::emit_event;

static SESSION_CWD_MAP: OnceLock<Mutex<HashMap<String, PathBuf>>> = OnceLock::new();

fn session_cwd_store() -> &'static Mutex<HashMap<String, PathBuf>> {
    SESSION_CWD_MAP.get_or_init(|| Mutex::new(HashMap::new()))
}

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
                        "description": "Shell command to execute inside the active project workspace (e.g. FFmpeg media inspection or validation utility)."
                    },
                    "workdir": {
                        "type": "string",
                        "description": "Relative working directory inside workspace. Defaults to workspace root '.'."
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

    // Determine working directory (strictly inside workspace; persists across session bash calls)
    let workdir = if let Some(wd) = arguments.get("workdir").and_then(|v| v.as_str()) {
        match resolve_isolated_path(workspace_dir, wd) {
            Ok(p) => {
                session_cwd_store()
                    .lock()
                    .unwrap_or_else(|e| e.into_inner())
                    .insert(session_id.to_string(), p.clone());
                p
            }
            Err(e) => return json!({ "error": e }),
        }
    } else {
        session_cwd_store()
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .get(session_id)
            .cloned()
            .filter(|p| p.exists())
            .unwrap_or_else(|| PathBuf::from(workspace_dir))
    };

    let cmd_str = command.to_string();
    let cwd = workdir.clone();
    let session_id_owned = session_id.to_string();
    let workspace_dir_owned = workspace_dir.to_string();
    let interrupt_rx = crate::session::coordinator::subscribe_session_interrupt(session_id);

    let res = run_interruptible_shell(&cmd_str, &cwd, &interrupt_rx).await;

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
        Err(e) if e.kind() == std::io::ErrorKind::Interrupted => json!({
            "ok": false,
            "aborted": true,
            "error": "Command execution aborted by user"
        }),
        Err(e) => json!({ "error": format!("Failed to execute command: {}", e) }),
    }
}

fn kill_child_process_tree(pid: Option<u32>) {
    let Some(pid) = pid else { return; };
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let _ = std::process::Command::new("taskkill")
            .creation_flags(CREATE_NO_WINDOW)
            .args(["/F", "/T", "/PID", &pid.to_string()])
            .output();
    }
    #[cfg(not(windows))]
    {
        let _ = std::process::Command::new("kill")
            .args(["-KILL", &pid.to_string()])
            .output();
    }
}

fn build_augmented_path(
    current_path: Option<&std::ffi::OsStr>,
    extra_dirs: &[PathBuf],
) -> Option<std::ffi::OsString> {
    let mut dirs: Vec<PathBuf> = extra_dirs
        .iter()
        .filter(|d| !d.as_os_str().is_empty())
        .cloned()
        .collect();
    if let Some(existing) = current_path {
        for p in std::env::split_paths(existing) {
            if !dirs.contains(&p) {
                dirs.push(p);
            }
        }
    }
    if dirs.is_empty() {
        return None;
    }
    std::env::join_paths(dirs).ok()
}

async fn run_command_with_interrupt(
    program: &str,
    args: &[&str],
    raw_cmd_line: Option<&str>,
    cwd: &Path,
    interrupt_rx: &tokio::sync::watch::Receiver<bool>,
) -> std::io::Result<std::process::Output> {
    let mut cmd = tokio::process::Command::new(program);
    #[cfg(windows)]
    {
        if let Some(raw) = raw_cmd_line {
            cmd.raw_arg(raw);
        } else {
            cmd.args(args);
        }
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    #[cfg(not(windows))]
    {
        let _ = raw_cmd_line;
        cmd.args(args);
    }
    cmd.current_dir(cwd);
    let mut extra_path_dirs = vec![crate::paths::aetheria_dot_dir().join("bin")];
    if let Some(ff) = crate::paths::locate_ffmpeg_binary() {
        if let Some(parent) = ff.parent() {
            extra_path_dirs.insert(0, parent.to_path_buf());
        }
    }
    if let Some(merged_path) = build_augmented_path(std::env::var_os("PATH").as_deref(), &extra_path_dirs) {
        cmd.env("PATH", merged_path);
    }
    cmd.env("PYTHONIOENCODING", "utf-8");
    cmd.env("PYTHONUTF8", "1");
    cmd.stdin(std::process::Stdio::null());
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());
    cmd.kill_on_drop(true);

    let child = cmd.spawn()?;
    let pid = child.id();

    tokio::select! {
        biased;
        _ = crate::session::coordinator::wait_session_interrupt(interrupt_rx.clone()) => {
            kill_child_process_tree(pid);
            Err(std::io::Error::new(std::io::ErrorKind::Interrupted, "Command aborted by user"))
        }
        res = child.wait_with_output() => res,
    }
}

async fn run_interruptible_shell(
    cmd_str: &str,
    cwd: &Path,
    interrupt_rx: &tokio::sync::watch::Receiver<bool>,
) -> std::io::Result<std::process::Output> {
    if *interrupt_rx.borrow() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::Interrupted,
            "Command aborted by user",
        ));
    }

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

    let initial_output = if cfg!(windows) {
        if is_powershell_hint {
            run_command_with_interrupt(
                "powershell.exe",
                &["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", cmd_str],
                None,
                cwd,
                interrupt_rx,
            )
            .await
        } else {
            let raw = format!("/d /s /c \"{}\"", cmd_str);
            run_command_with_interrupt("cmd.exe", &[], Some(&raw), cwd, interrupt_rx).await
        }
    } else {
        run_command_with_interrupt("/bin/sh", &["-c", cmd_str], None, cwd, interrupt_rx).await
    };

    #[cfg(windows)]
    if !is_powershell_hint {
        if let Ok(ref out) = initial_output {
            let err_str = String::from_utf8_lossy(&out.stderr);
            let out_str = String::from_utf8_lossy(&out.stdout);
            if (!out.status.success())
                && (err_str.contains("not recognized") || out_str.contains("not recognized"))
            {
                if let Ok(ps_out) = run_command_with_interrupt(
                    "powershell.exe",
                    &["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", cmd_str],
                    None,
                    cwd,
                    interrupt_rx,
                )
                .await
                {
                    return Ok(ps_out);
                }
            }
        }
    }

    initial_output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn augmented_path_prepends_ffmpeg_dir_without_duplicates() {
        let bin_dir = PathBuf::from(if cfg!(windows) {
            r"C:\tools\ffmpeg\bin"
        } else {
            "/opt/ffmpeg/bin"
        });
        let sys_dir = PathBuf::from(if cfg!(windows) {
            r"C:\Windows\System32"
        } else {
            "/usr/bin"
        });
        let existing = std::env::join_paths([sys_dir.clone(), bin_dir.clone()]).expect("join paths");
        let merged = build_augmented_path(Some(&existing), &[bin_dir.clone()]).expect("merged path");
        let parts: Vec<PathBuf> = std::env::split_paths(&merged).collect();
        assert_eq!(parts[0], bin_dir);
        assert_eq!(parts[1], sys_dir);
        assert_eq!(parts.iter().filter(|p| **p == bin_dir).count(), 1);
    }

    #[tokio::test]
    async fn execute_bash_runs_in_workspace_root_and_resolves_ffprobe() {
        let tmp = std::env::temp_dir().join(format!("aetheria_bash_ws_{}", crate::paths::now_ms()));
        std::fs::create_dir_all(&tmp).expect("create temp ws");
        std::fs::write(tmp.join("probe_marker.txt"), "ok").expect("write marker");

        let ws_str = tmp.to_string_lossy().to_string();
        let res = execute_bash(
            "test-bash-cwd-session",
            &ws_str,
            &json!({ "command": "python -c \"import os; assert os.path.isfile('probe_marker.txt'); print('MARKER_OK')\"" }),
        )
        .await;
        assert_eq!(res.get("ok").and_then(|v| v.as_bool()), Some(true), "res: {}", res);
        assert!(
            res.get("output")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .contains("MARKER_OK")
        );

        if let Some(ff) = crate::paths::locate_ffmpeg_binary() {
            if let Some(parent) = ff.parent() {
                let ffprobe_name = if cfg!(windows) { "ffprobe.exe" } else { "ffprobe" };
                if parent.join(ffprobe_name).is_file() {
                    let probe_res = execute_bash(
                        "test-bash-ffprobe-session",
                        &ws_str,
                        &json!({ "command": "ffprobe -version" }),
                    )
                    .await;
                    assert_eq!(
                        probe_res.get("ok").and_then(|v| v.as_bool()),
                        Some(true),
                        "ffprobe failed: {}",
                        probe_res
                    );
                }
            }
        }

        let _ = std::fs::remove_dir_all(&tmp);
    }
}

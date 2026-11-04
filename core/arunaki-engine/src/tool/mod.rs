//! Content & Automation Tools module for Nexus.
//! All tool execution is strictly isolated to the active workspace folder.

pub mod bash;
pub mod edit;
pub mod glob;
pub mod grep;
pub mod json_repair;
pub mod question;
pub mod read;
pub mod render;
pub mod step_formatter;
pub mod tasks;
pub mod todo;
pub mod truncator;
pub mod websearch;
pub mod write;

use serde_json::{json, Value};
use std::path::{Path, PathBuf};

use crate::paths::contains_path;

pub fn should_attach_document_tools(_prompt_text: &str, _history: &[Value]) -> bool {
    // In Nexus video & creative automation agent, tools are ALWAYS attached
    // so user requests can autonomously research trends, edit scripts, and render video.
    true
}

pub fn build_tool_definitions() -> Vec<Value> {
    vec![
        render::render_video_tool_definition(),
        read::read_tool_definition(),
        write::write_tool_definition(),
        edit::edit_tool_definition(),
        glob::glob_tool_definition(),
        grep::grep_tool_definition(),
        todo::todo_tool_definition(),
        websearch::websearch_tool_definition(),
        question::question_tool_definition(),
        tasks::tasks_tool_definition(),
        bash::bash_tool_definition(),
    ]
}

pub fn resolve_isolated_path(workspace_dir: &str, raw_file: &str) -> Result<PathBuf, String> {
    let base = Path::new(workspace_dir);
    let candidate = Path::new(raw_file);
    let resolved = if candidate.is_absolute() {
        candidate.to_path_buf()
    } else {
        base.join(raw_file)
    };
    if !contains_path(base, &resolved) {
        return Err(format!(
            "Project Folder Isolation Error: '{}' is outside the active project folder '{}'",
            raw_file, workspace_dir
        ));
    }
    Ok(resolved)
}

pub async fn execute_tool_call(
    session_id: &str,
    assistant_msg_id: &str,
    call_id: &str,
    name: &str,
    arguments: &Value,
    workspace_dir: &str,
) -> Value {
    match name {
        "render_video" | "remotion_render" | "export_video" | "render_nexus_video" => {
            render::execute_render_video(session_id, workspace_dir, arguments)
        }
        "read" | "read_file" => read::execute_read(workspace_dir, arguments),
        "write" | "write_file" | "create_file" => {
            write::execute_write(session_id, workspace_dir, arguments)
        }
        "edit" | "edit_file" | "apply_patch" => {
            edit::execute_edit(session_id, workspace_dir, arguments)
        }
        "glob" | "list_files" | "list_directory" => glob::execute_glob(workspace_dir, arguments),
        "grep" | "search" | "search_files" => grep::execute_grep(workspace_dir, arguments),
        "todowrite" | "todo" => todo::execute_todowrite(session_id, workspace_dir, arguments),
        "websearch" => websearch::execute_websearch(arguments).await,
        "question" => {
            question::execute_question(
                session_id,
                assistant_msg_id,
                call_id,
                workspace_dir,
                arguments,
            )
            .await
        }
        "manage_operational_tasks" | "manage_tasks" | "update_task_status" | "complete_subtask" => {
            tasks::execute_manage_tasks(session_id, workspace_dir, arguments)
        }
        "bash" | "shell" | "terminal" => {
            bash::execute_bash(session_id, workspace_dir, arguments).await
        }
        _ => json!({ "error": format!("Unknown tool: {}", name) }),
    }
}

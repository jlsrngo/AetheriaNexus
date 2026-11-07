//! Content & Automation Tools module for Nexus.
//! All tool execution is strictly isolated to the active workspace folder.

pub mod bash;
pub mod edit;
pub mod glob;
pub mod grep;
pub mod json_repair;
pub mod question;
pub mod read;
pub mod ref_extractor;
pub mod render;
pub mod sfx;
pub mod skill_manager;
pub mod step_formatter;
pub mod tasks;
pub mod todo;
pub mod truncator;
pub mod voicebox;
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
    let mut tools = vec![
        render::render_video_tool_definition(),
        voicebox::voicebox_tool_definition(),
        sfx::sfx_tool_definition(),
        ref_extractor::ref_extractor_tool_definition(),
        websearch::fetch_web_image_tool_definition(),
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
    ];
    tools.extend(skill_manager::skill_tool_definitions());
    tools
}

pub fn resolve_isolated_path(workspace_dir: &str, raw_file: &str) -> Result<PathBuf, String> {
    let ws_buf = if workspace_dir.trim().is_empty() {
        crate::paths::project_root()
    } else {
        PathBuf::from(workspace_dir)
    };
    let base = ws_buf.as_path();
    let candidate = Path::new(raw_file);
    let resolved = if candidate.is_absolute() {
        candidate.to_path_buf()
    } else {
        base.join(raw_file)
    };
    if !contains_path(base, &resolved) {
        return Err(format!(
            "Project Folder Isolation Error: '{}' is outside the active project folder '{}'",
            raw_file, base.display()
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
            render::execute_render_video_with_progress(
                session_id,
                assistant_msg_id,
                call_id,
                workspace_dir,
                arguments,
            )
        }
        "voicebox_speak" | "voicebox" | "generate_speech" | "tts" => {
            voicebox::execute_voicebox(workspace_dir, arguments).await
        }
        "generate_smart_sfx" | "smart_sfx" | "sfx_cues" | "sfx" => {
            sfx::execute_smart_sfx(workspace_dir, arguments).await
        }
        "extract_video_reference" | "extract_reference" | "ref_extract" => {
            ref_extractor::execute_ref_extractor(workspace_dir, arguments).await
        }
        "plugin_install" | "install_agent_skill" | "install_skill" | "install_plugin" => {
            skill_manager::execute_install_plugin(workspace_dir, arguments).await
        }
        "plugin_list" | "list_agent_skills" | "list_skills" | "list_plugins" => {
            skill_manager::execute_list_plugins(workspace_dir)
        }
        "plugin_toggle" | "toggle_plugin" => {
            skill_manager::execute_toggle_plugin(workspace_dir, arguments)
        }
        "plugin_update" | "update_plugin" => {
            skill_manager::execute_update_plugin(workspace_dir, arguments).await
        }
        "plugin_uninstall" | "remove_plugin" | "uninstall_plugin" => {
            skill_manager::execute_uninstall_plugin(workspace_dir, arguments).await
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
        "fetch_web_image" | "download_image" | "search_image" => {
            websearch::execute_fetch_web_image(workspace_dir, arguments).await
        }
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

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
pub mod storyboard;
pub mod tasks;
pub mod todo;
pub mod truncator;
pub mod voicebox;
pub mod websearch;
pub mod write;

use serde_json::{json, Value};
use std::path::{Path, PathBuf};

use crate::paths::contains_path;

pub fn is_greeting_prompt(prompt_text: &str) -> bool {
    let clean: String = prompt_text
        .chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace())
        .collect();
    let lower = clean.trim().to_lowercase();
    if lower.is_empty() {
        return true;
    }
    matches!(
        lower.as_str(),
        "halo"
            | "hello"
            | "hi"
            | "hey"
            | "hai"
            | "pagi"
            | "siang"
            | "sore"
            | "malam"
            | "tes"
            | "test"
            | "ping"
            | "halo nexus"
            | "hai nexus"
            | "hey nexus"
            | "assalamualaikum"
            | "assalamu alaikum"
            | "selamat pagi"
            | "selamat siang"
            | "selamat sore"
            | "selamat malam"
    ) || (lower.len() <= 6
        && (lower.starts_with("hi")
            || lower.starts_with("halo")
            || lower.starts_with("hey")
            || lower.starts_with("hai")))
}

pub fn should_attach_document_tools(prompt_text: &str, _history: &[Value]) -> bool {
    // Never attach tools for casual greetings, pings, or empty inputs.
    // This strictly prevents the LLM from hallucinating studio tasks, voiceover synthesis, or web image downloads.
    if is_greeting_prompt(prompt_text) {
        return false;
    }
    true
}

pub fn build_tool_definitions() -> Vec<Value> {
    let mut tools = vec![
        storyboard::produce_video_tool_definition(),
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
        register_style_tool_definition(),
        crate::session::agent_turn::subagent::spawn_subagent_tool_definition(),
    ];
    tools.extend(skill_manager::skill_tool_definitions());
    tools
}

pub fn register_style_tool_definition() -> Value {
    json!({
        "type": "function",
        "function": {
            "name": "register_motion_style",
            "description": "Registers a new motion graphics style / skill from an uploaded markdown brief file. Automatically generates style.md, tokens.json, REMOTION_BRIEF.md, and makes it available as a slash command (e.g. /editorial-kinetic).",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "The style name or slug, e.g. 'editorial-kinetic' or 'cyber-neon'"
                    },
                    "file_path": {
                        "type": "string",
                        "description": "Path to the markdown brief / instruction file (e.g. 'instruksi_remotion_agent_kinetic_motion_graphics_v2.md')"
                    },
                    "description": {
                        "type": "string",
                        "description": "Optional short summary or style description"
                    }
                },
                "required": ["name", "file_path"]
            }
        }
    })
}

pub fn resolve_isolated_path(workspace_dir: &str, raw_file: &str) -> Result<PathBuf, String> {
    let ws_buf = if workspace_dir.trim().is_empty() {
        crate::paths::project_root()
    } else {
        PathBuf::from(workspace_dir)
    };
    let base = ws_buf.as_path();
    let mut clean_raw = raw_file.trim();

    // Deduplicate redundant "workspace/" or "workspace\" prefix when base already ends in "workspace"
    let base_is_workspace = base
        .file_name()
        .and_then(|n| n.to_str())
        .map(|n| n.eq_ignore_ascii_case("workspace"))
        .unwrap_or(false);

    if base_is_workspace {
        while clean_raw.starts_with("workspace/") || clean_raw.starts_with("workspace\\") {
            clean_raw = &clean_raw["workspace/".len()..];
        }
        while clean_raw.starts_with("./workspace/") || clean_raw.starts_with(".\\workspace\\") {
            clean_raw = &clean_raw["./workspace/".len()..];
        }
    }

    let candidate = Path::new(clean_raw);
    let resolved = if candidate.is_absolute() {
        candidate.to_path_buf()
    } else {
        base.join(clean_raw)
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
        "produce_video" | "storyboard_video" | "build_storyboard_video" => {
            storyboard::execute_produce_video(
                session_id,
                assistant_msg_id,
                call_id,
                workspace_dir,
                arguments,
            )
            .await
        }
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
        "task" | "Task" | "spawn_subagent" | "delegate_task" | "delegate_subagent" | "run_subagent" => {
            Box::pin(crate::session::agent_turn::subagent::execute_subagent(session_id, workspace_dir, arguments)).await
        }
        "register_motion_style" | "register_style" | "add_style" | "add_skill" => {
            let name = arguments.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let file_path = arguments.get("file_path").and_then(|v| v.as_str());
            let desc = arguments.get("description").and_then(|v| v.as_str());
            let content = arguments.get("content").and_then(|v| v.as_str());
            match crate::studio::styles::register_style_internal(name, file_path, content, desc) {
                Ok(style) => json!({
                    "success": true,
                    "style": style,
                    "command": style.command,
                    "message": format!("Style '{}' successfully registered! Available as {}", style.name, style.command)
                }),
                Err(e) => json!({ "error": e }),
            }
        }
        _ => json!({ "error": format!("Unknown tool: {}", name) }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolve_isolated_path_deduplicates_workspace_prefix() {
        let ws = "E:\\JS\\ArunakiNexus\\workspace";

        // When raw_file has "workspace/" prefix
        let p1 = resolve_isolated_path(ws, "workspace/src/Root.tsx").unwrap();
        assert_eq!(p1, PathBuf::from("E:\\JS\\ArunakiNexus\\workspace\\src\\Root.tsx"));

        // When raw_file has "workspace\" prefix
        let p2 = resolve_isolated_path(ws, "workspace\\src\\Root.tsx").unwrap();
        assert_eq!(p2, PathBuf::from("E:\\JS\\ArunakiNexus\\workspace\\src\\Root.tsx"));

        // When raw_file is already clean "src/Root.tsx"
        let p3 = resolve_isolated_path(ws, "src/Root.tsx").unwrap();
        assert_eq!(p3, PathBuf::from("E:\\JS\\ArunakiNexus\\workspace\\src\\Root.tsx"));

        // When raw_file has "./workspace/src/Root.tsx"
        let p4 = resolve_isolated_path(ws, "./workspace/src/Root.tsx").unwrap();
        assert_eq!(p4, PathBuf::from("E:\\JS\\ArunakiNexus\\workspace\\src\\Root.tsx"));
    }
}

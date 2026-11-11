//! Content & Automation Tools module & Supervised Tool Dispatcher for Nexus.
//! All tool execution is strictly isolated to the active workspace folder.

pub mod apply_patch;
pub mod bash;
pub mod catalog;
pub mod codemode;
pub mod edit;
pub mod edit_matchers;
pub mod fetch_web_image;
pub mod film_feedback;
pub mod glob;
pub mod grep;
pub mod json_repair;
pub mod json_syntax_helpers;
pub mod lsp;
pub mod path_guard;
pub mod question;
pub mod read;
pub mod ref_extractor;
pub mod render;
pub mod render_command;
pub mod sfx;
pub mod skill_inspector;
pub mod skill_manager;
pub mod skill_registry;
pub mod skill_source;
pub mod snapshot;
pub mod step_formatter;
pub mod storyboard;
pub mod storyboard_planner;
pub mod tasks;
pub mod tasks_store;
pub mod todo;
pub mod tool_alias;
pub mod tool_input_repair;
pub mod truncator;
pub mod voicebox;
pub mod webfetch;
pub mod websearch;
pub mod write;

pub use catalog::{
    build_tool_definitions, is_greeting_prompt, register_style_tool_definition,
    should_attach_document_tools,
};
pub use path_guard::resolve_isolated_path;

use serde_json::{json, Value};

/// Supervised tool execution harness — mirrors OpenCode's `SessionStep.attempt` fiber supervision:
/// 1. Checks cooperative session interruption before launching.
/// 2. Catches any internal Rust panic (`catch_unwind`) so a defective tool never crashes the engine.
/// 3. Enforces per-tool timeout supervision so a hung tool never stalls the turn indefinitely.
pub async fn execute_tool_call(
    session_id: &str,
    assistant_msg_id: &str,
    call_id: &str,
    name: &str,
    arguments: &Value,
    workspace_dir: &str,
) -> Value {
    if let Some(reason) = crate::session::coordinator::is_session_interrupted(session_id) {
        return json!({
            "ok": false,
            "error": format!("Tool execution interrupted ({})", reason),
            "type": "aborted"
        });
    }

    let canonical = json_repair::canonicalize_tool_name(name);
    let timeout_secs = match canonical {
        "render_video" | "produce_video" | "task" | "question" => 600,
        _ => 180,
    };

    let fut = execute_tool_call_inner(
        session_id,
        assistant_msg_id,
        call_id,
        canonical,
        arguments,
        workspace_dir,
    );

    let unwind_safe_fut =
        futures_util::FutureExt::catch_unwind(std::panic::AssertUnwindSafe(fut));

    match tokio::time::timeout(std::time::Duration::from_secs(timeout_secs), unwind_safe_fut).await
    {
        Ok(Ok(val)) => val,
        Ok(Err(panic_payload)) => {
            let panic_msg = if let Some(s) = panic_payload.downcast_ref::<&str>() {
                (*s).to_string()
            } else if let Some(s) = panic_payload.downcast_ref::<String>() {
                s.clone()
            } else {
                "unknown panic payload".to_string()
            };
            crate::paths::log_engine(
                "tool",
                &format!(
                    "🛑 Caught internal panic in tool '{}': {}",
                    canonical, panic_msg
                ),
            );
            json!({
                "ok": false,
                "error": format!("Tool '{}' encountered an internal error and was safely recovered: {}", canonical, panic_msg),
                "type": "tool.defect"
            })
        }
        Err(_) => {
            crate::paths::log_engine(
                "tool",
                &format!(
                    "⏱️ Tool '{}' timed out after {}s; returning structured error to agent",
                    canonical, timeout_secs
                ),
            );
            json!({
                "ok": false,
                "error": format!("Tool '{}' timed out after {} seconds. Try a lighter operation or smaller batch.", canonical, timeout_secs),
                "type": "tool.timeout"
            })
        }
    }
}

async fn execute_tool_call_inner(
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
            .await
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
        "edit" | "edit_file" => edit::execute_edit(session_id, workspace_dir, arguments),
        "apply_patch" | "patch" => {
            apply_patch::execute_apply_patch(session_id, workspace_dir, arguments)
        }
        "webfetch" | "fetch_url" => webfetch::execute_webfetch(arguments).await,
        "lsp" | "diagnostics" => lsp::execute_lsp(workspace_dir, arguments),
        "snapshot" | "rollback" => snapshot::execute_snapshot(workspace_dir, arguments),
        "codemode" | "run_script" => {
            codemode::execute_codemode(session_id, workspace_dir, arguments).await
        }
        "glob" | "list_files" | "list_directory" => glob::execute_glob(workspace_dir, arguments),
        "grep" | "search" | "search_files" => grep::execute_grep(workspace_dir, arguments),
        "todowrite" | "todo" => todo::execute_todowrite(session_id, workspace_dir, arguments),
        "websearch" => websearch::execute_websearch(arguments).await,
        "fetch_web_image" | "download_image" | "search_image" => {
            fetch_web_image::execute_fetch_web_image(workspace_dir, arguments).await
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
        "bash" | "shell" | "terminal" => bash::execute_bash(session_id, workspace_dir, arguments).await,
        "task" | "Task" | "spawn_subagent" | "delegate_task" | "delegate_subagent" | "run_subagent" => {
            let fut: std::pin::Pin<Box<dyn std::future::Future<Output = Value> + Send + '_>> =
                Box::pin(crate::session::agent_turn::subagent::execute_subagent(
                    session_id,
                    workspace_dir,
                    arguments,
                ));
            fut.await
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

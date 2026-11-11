//! Tool Alias Canonicalization — maps common LLM tool name aliases/casings to canonical engine names.

/// Normalizes tool call names when models emit common aliases or casing variants
/// (mirrors OpenCode `packages/core/src/plugin/tool-input-repair.ts`).
pub fn canonicalize_tool_name(raw_name: &str) -> &str {
    let trimmed = raw_name.trim();
    match trimmed {
        "bash" | "shell" | "terminal" | "sh" | "cmd" | "powershell" | "run_command"
        | "execute_command" | "exec" => "bash",
        "read" | "read_file" | "view_file" | "cat" => "read",
        "write" | "write_file" | "create_file" | "save_file" => "write",
        "edit" | "edit_file" | "replace_in_file" | "str_replace" => "edit",
        "apply_patch" | "patch" => "apply_patch",
        "webfetch" | "fetch_url" => "webfetch",
        "lsp" | "diagnostics" => "lsp",
        "snapshot" | "rollback" => "snapshot",
        "codemode" | "run_script" => "codemode",
        "glob" | "list_files" | "list_directory" | "find_files" | "ls" => "glob",
        "grep" | "search" | "search_files" | "ripgrep" | "rg" => "grep",
        "todowrite" | "todo" | "todo_write" | "update_todo" => "todowrite",
        "task" | "Task" | "spawn_subagent" | "delegate_task" | "delegate_subagent"
        | "run_subagent" | "subagent" => "task",
        "produce_video" | "storyboard_video" | "build_storyboard_video" => "produce_video",
        "render_video" | "remotion_render" | "export_video" | "render_nexus_video" => "render_video",
        "voicebox_speak" | "voicebox" | "generate_speech" | "tts" => "voicebox_speak",
        "generate_smart_sfx" | "smart_sfx" | "sfx_cues" | "sfx" => "generate_smart_sfx",
        "extract_video_reference" | "extract_reference" | "ref_extract" => "extract_video_reference",
        "fetch_web_image" | "download_image" | "search_image" => "fetch_web_image",
        "manage_operational_tasks" | "manage_tasks" | "update_task_status" | "complete_subtask" => {
            "manage_operational_tasks"
        }
        other => other,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_canonicalize_tool_name() {
        assert_eq!(canonicalize_tool_name("shell"), "bash");
        assert_eq!(canonicalize_tool_name("run_command"), "bash");
        assert_eq!(canonicalize_tool_name("read_file"), "read");
        assert_eq!(canonicalize_tool_name("spawn_subagent"), "task");
        assert_eq!(canonicalize_tool_name("Task"), "task");
    }
}


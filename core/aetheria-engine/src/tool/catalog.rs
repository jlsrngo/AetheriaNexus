//! Tool Schema Catalog & Prompt Tool-Attachment Gate.
//!
//! Decides whether document/studio tools should be exposed on a turn
//! and assembles the OpenAI-compatible tool definitions list for the LLM.

use serde_json::{json, Value};

use super::{
    apply_patch, bash, codemode, edit, fetch_web_image, glob, grep, lsp, preview_film, question,
    read, ref_extractor, render, sfx, skill_manager, snapshot, storyboard, tasks, todo, voicebox,
    webfetch, websearch, write,
};

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
        preview_film::capture_film_preview_tool_definition(),
        voicebox::voicebox_tool_definition(),
        sfx::sfx_tool_definition(),
        ref_extractor::ref_extractor_tool_definition(),
        fetch_web_image::fetch_web_image_tool_definition(),
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
        apply_patch::apply_patch_tool_definition(),
        webfetch::webfetch_tool_definition(),
        lsp::lsp_tool_definition(),
        snapshot::snapshot_tool_definition(),
        codemode::codemode_tool_definition(),
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
                        "description": "Path to the markdown brief / instruction file (e.g. 'kinetic_motion_brief.md')"
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

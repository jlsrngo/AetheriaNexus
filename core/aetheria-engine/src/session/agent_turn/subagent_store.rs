//! Subagent Child Session Store, Persona Prompt Builder & Recursion Guard
//! Mirrors `packages/core/src/plugin/subagent.ts` session/persona setup.

use serde_json::{json, Value};

use crate::paths::{gen_id, now_ms};
use crate::session::session::{save_store, with_store};

/// Maximum recursion depth for subagents (`parent = 0`, `child = 1`, `grandchild = 2`).
pub const MAX_SUBAGENT_DEPTH: usize = 2;

/// Builds the specialized system prompt for each subagent persona.
pub fn build_subagent_system_prompt(subagent_type: &str, workspace_dir: &str) -> String {
    let persona_rules = match subagent_type {
        "explore" => {
            "You are the **Explore Subagent** (Read-Only Fast Discovery).\n\
             - Your job is to rapidly inspect files, search patterns, or gather facts in the workspace.\n\
             - Use `glob`, `grep`, `read`, or `websearch` to locate exact answers.\n\
             - Do NOT modify files. Return a concise, factual summary with exact file paths."
        }
        "motion-designer" => {
            "You are the **Motion Designer Subagent** (Visual & Scene Specialist).\n\
             - Your job is to write clean, high-craft HTML5 Canvas (`script/scene*.js`) or Remotion (`src/*.tsx`) animation code.\n\
             - Read any referenced style brief (`style.md`, `tokens.json`) first.\n\
             - Ensure every scene has rich visual hierarchy, smooth easing, and zero syntax errors.\n\
             - Write files directly using `write` or `edit`, then report the exact files created/updated."
        }
        "audio-director" => {
            "You are the **Audio Director Subagent** (Voiceover & SFX Specialist).\n\
             - Your job is to synthesize natural voiceovers (`voicebox_speak`) and procedural sound effects (`generate_smart_sfx`).\n\
             - Ensure audio output paths match the project script (`audio/vo_scene1.wav`, `audio/sfx_*.wav`).\n\
             - Report all generated audio files and their durations."
        }
        "qa-verifier" => {
            "You are the **QA Verifier Subagent** (Verification & Audit Specialist).\n\
             - Your job is to inspect generated code, check file existence, verify JSON/JS/TSX syntax, and fix any missing imports or broken references.\n\
             - Report verification status clearly."
        }
        _ => {
            "You are the **General Autonomous Subagent**.\n\
             - Execute the delegated subtask thoroughly using available tools.\n\
             - Be direct, concise, and return a clear summary of actions taken and files produced."
        }
    };

    format!(
        "{}\n\n\
         Active Project Workspace: `{}`\n\
         IMPORTANT RULES:\n\
         1. Focus strictly on the delegated subtask.\n\
         2. Do NOT ask the user questions; make reasonable engineering decisions autonomously.\n\
         3. When finished, output a concise final report summarizing what was done and which files were touched.",
        persona_rules, workspace_dir
    )
}

/// Filters the tool definitions available to a specific subagent persona.
pub fn build_subagent_tools(subagent_type: &str, current_depth: usize) -> Vec<Value> {
    let mut all_tools = crate::tool::build_tool_definitions();
    all_tools.retain(|t| {
        let name = t
            .pointer("/function/name")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        if name == "question" {
            return false;
        }
        if name == "task" && current_depth >= MAX_SUBAGENT_DEPTH {
            return false;
        }
        match subagent_type {
            "explore" => matches!(name, "read" | "glob" | "grep" | "websearch" | "webfetch"),
            "audio-director" => matches!(
                name,
                "voicebox_speak" | "generate_smart_sfx" | "read" | "write" | "glob"
            ),
            "motion-designer" => matches!(
                name,
                "read"
                    | "write"
                    | "edit"
                    | "apply_patch"
                    | "glob"
                    | "grep"
                    | "fetch_web_image"
                    | "websearch"
                    | "bash"
                    | "codemode"
            ),
            _ => true,
        }
    });
    all_tools
}

/// Reads the subagent recursion depth of a session from `SESSION_STORE` (`0` for root sessions).
pub fn get_session_depth(session_id: &str) -> usize {
    with_store(|store| {
        store
            .sessions
            .get(session_id)
            .and_then(|s| s.get("subagentDepth"))
            .and_then(|v| v.as_u64())
            .unwrap_or(0) as usize
    })
}

/// Loads an existing child session for continuation or creates a new isolated child session in `SESSION_STORE`.
pub fn load_or_init_child_session(
    parent_session_id: &str,
    requested_child_id: Option<&str>,
    subagent_type: &str,
    description: &str,
    child_depth: usize,
    sys_prompt: &str,
    user_prompt: &str,
) -> (String, Vec<Value>, bool) {
    let now = now_ms();
    with_store(|store| {
        if let Some(existing_id) = requested_child_id.filter(|s| !s.trim().is_empty()) {
            if let Some(existing_msgs) = store.messages.get_mut(existing_id) {
                if !existing_msgs.is_empty() {
                    existing_msgs.push(json!({
                        "role": "user",
                        "content": user_prompt
                    }));
                    let cloned = existing_msgs.clone();
                    if let Some(sess) = store.sessions.get_mut(existing_id) {
                        sess["updatedAt"] = json!(now);
                        sess["state"] = json!("running");
                    }
                    save_store(store);
                    return (existing_id.to_string(), cloned, true);
                }
            }
        }

        let new_id = requested_child_id
            .filter(|s| !s.trim().is_empty())
            .map(|s| s.to_string())
            .unwrap_or_else(|| gen_id("sub"));

        let session_meta = json!({
            "id": new_id,
            "parentID": parent_session_id,
            "title": format!("[Subagent: {}] {}", subagent_type, description),
            "agent": subagent_type,
            "subagentDepth": child_depth,
            "state": "running",
            "createdAt": now,
            "updatedAt": now
        });
        store.sessions.insert(new_id.clone(), session_meta);

        let initial_msgs = vec![
            json!({ "role": "system", "content": sys_prompt }),
            json!({ "role": "user", "content": user_prompt }),
        ];
        store.messages.insert(new_id.clone(), initial_msgs.clone());
        save_store(store);

        (new_id, initial_msgs, false)
    })
}

/// Saves the child session's updated messages and completion state in `SESSION_STORE`.
pub fn persist_child_session_state(
    child_session_id: &str,
    chat_messages: &[Value],
    state_str: &str,
) {
    let now = now_ms();
    with_store(|store| {
        store
            .messages
            .insert(child_session_id.to_string(), chat_messages.to_vec());
        if let Some(sess) = store.sessions.get_mut(child_session_id) {
            sess["state"] = json!(state_str);
            sess["updatedAt"] = json!(now);
        }
        save_store(store);
    });
}


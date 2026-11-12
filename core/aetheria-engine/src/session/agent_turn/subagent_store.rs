//! Subagent Child Session Store, Persona Prompt Builder & Recursion Guard
//! Mirrors `packages/core/src/plugin/subagent.ts` session/persona setup.

use serde_json::{json, Value};

use crate::paths::{gen_id, now_ms};
use crate::session::session::{save_store, with_store, SessionStoreData};

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
             - You support ANY visual pipeline chosen by the active `/skill` or task brief — including 2D HTML5 Canvas/SVG (`window.AM` via `/script/aetheria-motion.js`) AND 3D WebGL / Three.js (`/script/three.min.js`, built-in offline in the engine) — driven deterministically by `window.renderAt(t)`.\n\
             - NEVER lock onto, assume, or default to any unrequested style or template (such as `01-flat-vector`, generic header badges, or headline plaques). If the delegated task did not specify an active skill or concrete visual style, return immediately asking the coordinator to confirm the style/skill with the user.\n\
             - Keep scripts strictly modular under `script/` (`script/scene1.js` .. `script/sceneN.js` and optional helper modules) with entry at `index.html`; NEVER create React/Remotion folders (`src/`, `public/`, `Root.tsx`).\n\
             - Read the active skill (`<skills>` -> `SKILL.md`, `tokens.json`, `examples/`) FIRST and strictly follow its aesthetic, resolution, HUD choices, and subtitle options.\n\
             - If using `THREE.WebGLRenderer`, ALWAYS pass `preserveDrawingBuffer: true` so headless MP4 exports capture every WebGL frame.\n\
             - `AM.drawTopHeader`, `AM.drawHeadlinePlaque`, and dark pill `AM.drawSubtitles` are OPTIONAL — omit or customize them according to the active skill's `SKILL.md` and `tokens.json`.\n\
             - Never use `requestAnimationFrame`, `Math.random()`, `Date.now()`, or `setTimeout`/`setInterval`; drive all motion from `t` and read `audio/*.words.json` timings.\n\
             - Write files directly using `write` or `edit`, then report the exact files created/updated."
        }
        "audio-director" => {
            "You are the **Audio Director Subagent** (Voiceover & SFX Specialist).\n\
             - Your job is to synthesize natural voiceovers (`voicebox_speak`) and procedural sound effects (`generate_smart_sfx`).\n\
             - Ensure audio output paths match the project script (`audio/scene1.wav`, `audio/sfx_*.wav`).\n\
             - Report all generated audio files and their durations."
        }
        "qa-verifier" => {
            "You are the **QA Verifier Subagent** (Verification & Audit Specialist).\n\
             - Your job is to inspect generated motion films (`index.html`, `script/scene*.js`, `audio/*.words.json`), check file existence, verify JSON/JS/HTML syntax, and fix any missing asset paths or broken script references.\n\
             - Report verification status clearly."
        }
        _ => {
            "You are the **General Autonomous Subagent**.\n\
             - Execute the delegated subtask thoroughly using available tools.\n\
             - Be direct, concise, and return a clear summary of actions taken and files produced."
        }
    };

    let skills_section = if matches!(
        subagent_type.trim().to_ascii_lowercase().as_str(),
        "motion-designer" | "qa-verifier"
    ) {
        let discovered = super::context::discover_workspace_skills(workspace_dir);
        if discovered.is_empty() {
            String::new()
        } else {
            format!("\n\n{}", discovered)
        }
    } else {
        String::new()
    };

    format!(
        "{}{}\n\n\
         Active Project Workspace: `{}`\n\
         IMPORTANT RULES:\n\
         1. Focus strictly on the delegated subtask.\n\
         2. Do NOT ask the user questions; make reasonable engineering decisions autonomously.\n\
         3. When finished, output a concise final report summarizing what was done and which files were touched.",
        persona_rules, skills_section, workspace_dir
    )
}

#[cfg(test)]
mod prompt_tests {
    use super::*;

    #[test]
    fn motion_designer_prompt_supports_threejs_and_injects_workspace_skills() {
        let dir = std::env::temp_dir().join(format!("aetheria_subagent_skills_{}", std::process::id()));
        let skill_dir = dir.join(".aetheria").join("skills").join("custom-3d-skill");
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&skill_dir).unwrap();
        std::fs::write(
            skill_dir.join("SKILL.md"),
            "---\nname: custom-3d-skill\ndescription: Custom 3D motion skill\n---\n",
        )
        .unwrap();

        let prompt = build_subagent_system_prompt("motion-designer", &dir.to_string_lossy());
        assert!(prompt.contains("/script/three.min.js"));
        assert!(prompt.contains("preserveDrawingBuffer: true"));
        assert!(prompt.contains("custom-3d-skill"));
        assert!(prompt.contains("OPTIONAL"));

        let _ = std::fs::remove_dir_all(&dir);
    }
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

fn extract_xml_attr(tag_header: &str, attr_name: &str) -> Option<String> {
    let needle = format!("{}=\"", attr_name);
    let start = tag_header.find(&needle)? + needle.len();
    let rest = &tag_header[start..];
    let end = rest.find('"')?;
    Some(rest[..end].to_string())
}

/// Parses one or more `<subagent-notification ...>` blocks from a consolidated wakeup payload.
pub fn parse_subagent_notifications(text: &str) -> Vec<Value> {
    let mut out = Vec::new();
    let mut cursor = text;
    while let Some(pos) = cursor.find("<subagent-notification ") {
        let after = &cursor[pos..];
        let header_end = after.find('>').unwrap_or(after.len());
        let header = &after[..header_end];
        let child_id = extract_xml_attr(header, "sessionID").unwrap_or_default();
        let subagent_type = extract_xml_attr(header, "type").unwrap_or_else(|| "general".to_string());
        let state = extract_xml_attr(header, "state").unwrap_or_else(|| "completed".to_string());
        let description = extract_xml_attr(header, "description").unwrap_or_default();
        let remaining = extract_xml_attr(header, "remaining_standby")
            .and_then(|s| s.parse::<usize>().ok())
            .unwrap_or(0);
        out.push(json!({
            "childSessionId": child_id,
            "subagentType": subagent_type,
            "state": state,
            "description": description,
            "remainingStandby": remaining,
        }));
        cursor = &after[header_end.min(after.len())..];
    }
    out
}

/// Persists a `synthetic` subagent completion notification into `store.messages` so future
/// turns retain child results and the UI can render crisp notice rows without raw XML.
pub fn persist_synthetic_subagent_notice(
    store: &mut SessionStoreData,
    parent_session_id: &str,
    text: &str,
) -> bool {
    let notices = parse_subagent_notifications(text);
    if notices.is_empty() {
        return false;
    }
    let created_ms = now_ms();
    let msg = json!({
        "id": gen_id("syn"),
        "type": "synthetic",
        "role": "user",
        "agent": "subagent-notice",
        "text": text,
        "metadata": {
            "source": "subagent",
            "notices": notices,
        },
        "time": { "created": created_ms },
    });
    store
        .messages
        .entry(parent_session_id.to_string())
        .or_default()
        .push(msg);
    true
}

/// Persists a synthetic notification directly via global `SESSION_STORE` (e.g. mid-turn steers).
pub fn persist_synthetic_subagent_notice_in_store(parent_session_id: &str, text: &str) {
    with_store(|store| {
        if persist_synthetic_subagent_notice(store, parent_session_id, text) {
            save_store(store);
        }
    });
}


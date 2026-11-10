//! Specialized Subagent Runner — executes focused subtasks in isolated contexts.
//! Prevents monolithic agent context bloat when producing multi-scene videos (e.g. batch audio TTS, batch asset fetching, scene coding).

use serde_json::{json, Value};

use crate::paths::{gen_id, now_ms};
use crate::provider::read_aetheria_config;
use crate::session::message::emit_event;
use crate::session::session::{save_store, with_store};
use crate::session::tools::execute_tool_call;

/// Tool definition for the Main Agent to spawn/delegate tasks to a subagent
pub fn spawn_subagent_tool_definition() -> Value {
    json!({
        "type": "function",
        "function": {
            "name": "spawn_subagent",
            "description": "Spawn a specialized subagent to perform heavy or batch tasks in an isolated context (e.g. batch voiceover synthesis, image asset downloading, or Remotion scene coding). Prevents context token bloat in the main agent and keeps production modular.",
            "parameters": {
                "type": "object",
                "properties": {
                    "role": {
                        "type": "string",
                        "enum": ["audio", "assets", "motion", "research"],
                        "description": "Specialized role of the subagent: 'audio' (voiceover synthesis & SFX), 'assets' (images & web asset downloads), 'motion' (writing Remotion scene components), or 'research' (code/reference inspection)."
                    },
                    "task": {
                        "type": "string",
                        "description": "Clear, actionable task description explaining what the subagent must execute and what summary to return."
                    },
                    "context": {
                        "type": "string",
                        "description": "Detailed context needed by the subagent (e.g. per-scene scripts, scene timestamps, character names, or design tokens)."
                    }
                },
                "required": ["role", "task"]
            }
        }
    })
}

fn build_subagent_system_prompt(role: &str, workspace_dir: &str) -> String {
    match role {
        "audio" => format!(
            "You are the Audio Production Subagent for Aetheria Video Studio.\n\
             Workspace folder: {}\n\
             Your sole responsibility is to synthesize voiceover audio tracks and SFX for video scenes using the `voicebox_speak` and `generate_smart_sfx` tools.\n\
             CRITICAL AUDIO RULES:\n\
             1. Always call `voicebox_speak` for each scene with pristine visual `text` and localized phonetic spelling in `spokenText` for foreign names, ships, acronyms, or numbers.\n\
             2. Inspect generated `*.words.json` files to verify scene durations.\n\
             3. DO NOT write React TSX components or download images.\n\
             4. When all scene audios are synthesized, reply with a concise final summary listing each scene's audio file path and exact duration in seconds.",
            workspace_dir
        ),
        "assets" => format!(
            "You are the Visual Asset Subagent for Aetheria Video Studio.\n\
             Workspace folder: {}\n\
             Your sole responsibility is to search, fetch, and download images and graphic assets into `workspace/public/` using `fetch_web_image` and `websearch` tools.\n\
             CRITICAL ASSET RULES:\n\
             1. Fetch high-quality relevant images matching the scene descriptions.\n\
             2. Ensure assets are saved with clean filenames in `workspace/public/`.\n\
             3. DO NOT write React TSX components or synthesize audio.\n\
             4. When all assets are downloaded, reply with a concise final summary listing each downloaded file path.",
            workspace_dir
        ),
        "motion" => format!(
            "You are the Remotion Motion Graphics Subagent for Aetheria Video Studio.\n\
             Workspace folder: {}\n\
             Your sole responsibility is to write clean, modular React Remotion scene components inside `workspace/src/scenes/` using `write` and `edit` tools.\n\
             CRITICAL MOTION & ZERO-BLACKSCREEN RULES:\n\
             1. Defensive Animation Props: Strictly forbidden to allow duration props to be undefined. All motion components MUST implement safe fallbacks: `const duration = propDuration ?? useVideoConfig()?.durationInFrames ?? 300;`. Ensure `inputRange` passed to Remotion's `interpolate()` always contains valid finite numbers, NEVER undefined/NaN.\n\
             2. Asset Verification Guard: Strictly forbidden to write image/video tags targeting files that do not exist in `workspace/public/` or `apps/public/`. Prefer standard `<img>` tags with fallback styling. Never nest `staticFile()` calls.\n\
             3. No Blinding Flash at Frame 0: Camera cut or white flash transitions MUST NOT occlude frame 0 (`if (frame <= 0) return null;`) so that the initial paused/poster state never renders as a blank canvas.\n\
             4. Write modular scene files (Scene1.tsx .. SceneN.tsx) under 250 lines each.\n\
             5. Drive all motion from `useCurrentFrame()` with `spring()` or clamped `interpolate()`. Inside `<Sequence>`, frame starts at 0.\n\
             6. Use Inter for text and monospace for numbers/timestamps.\n\
             7. NEVER overwrite or break `Root.tsx` with uncreated relative imports.\n\
             8. When finished, reply with a concise final summary of all written scene files.",
            workspace_dir
        ),
        _ => format!(
            "You are a Research & Analysis Subagent for Aetheria Video Studio.\n\
             Workspace folder: {}\n\
             Your responsibility is to inspect files, search codebase, and analyze references using `read`, `glob`, `grep`, and `websearch` tools.\n\
             When finished, reply with a concise final summary of your findings.",
            workspace_dir
        ),
    }
}

fn build_subagent_tools(role: &str) -> Vec<Value> {
    match role {
        "audio" => vec![
            crate::tool::voicebox::voicebox_tool_definition(),
            crate::tool::sfx::sfx_tool_definition(),
            crate::tool::read::read_tool_definition(),
            crate::tool::glob::glob_tool_definition(),
            crate::tool::write::write_tool_definition(),
        ],
        "assets" => vec![
            crate::tool::websearch::fetch_web_image_tool_definition(),
            crate::tool::websearch::websearch_tool_definition(),
            crate::tool::read::read_tool_definition(),
            crate::tool::glob::glob_tool_definition(),
        ],
        "motion" => vec![
            crate::tool::write::write_tool_definition(),
            crate::tool::edit::edit_tool_definition(),
            crate::tool::read::read_tool_definition(),
            crate::tool::glob::glob_tool_definition(),
            crate::tool::grep::grep_tool_definition(),
        ],
        _ => vec![
            crate::tool::read::read_tool_definition(),
            crate::tool::glob::glob_tool_definition(),
            crate::tool::grep::grep_tool_definition(),
            crate::tool::websearch::websearch_tool_definition(),
        ],
    }
}

/// Executes a subagent turn loop (up to 12 steps) with isolated context
pub async fn execute_subagent(
    session_id: &str,
    workspace_dir: &str,
    arguments: &Value,
) -> Value {
    let role = arguments
        .get("role")
        .and_then(|v| v.as_str())
        .unwrap_or("general")
        .to_lowercase();
    let task = arguments
        .get("task")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let context = arguments
        .get("context")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    if task.trim().is_empty() {
        return json!({ "error": "Task parameter is required for subagent." });
    }

    let role_display = match role.as_str() {
        "audio" => "Audio Producer",
        "assets" => "Asset Curator",
        "motion" => "Motion Engineer",
        _ => "Research Assistant",
    };

    crate::paths::log_engine(
        "subagent",
        &format!("🚀 Spawning subagent [{}] for task: {}", role_display, task),
    );

    let sys_prompt = build_subagent_system_prompt(&role, workspace_dir);
    let tools = build_subagent_tools(&role);

    let user_prompt = if !context.trim().is_empty() {
        format!("TASK:\n{}\n\nCONTEXT:\n{}", task.trim(), context.trim())
    } else {
        task.trim().to_string()
    };

    let mut messages = vec![
        json!({ "role": "system", "content": sys_prompt }),
        json!({ "role": "user", "content": user_prompt }),
    ];

    let cfg = read_aetheria_config();
    let provider_id = cfg
        .pointer("/provider/active")
        .and_then(|v| v.as_str())
        .unwrap_or("antigravity");
    let model_id = cfg
        .pointer(&format!("/provider/{}/model", provider_id))
        .or_else(|| cfg.pointer("/model/active"))
        .and_then(|v| v.as_str())
        .unwrap_or("default");

    let is_local_bridge = provider_id == "antigravity" || provider_id == "local-cli";
    let base_url = if is_local_bridge {
        let active_port = crate::bridge::ensure_bridge_running().await;
        format!("http://127.0.0.1:{}/v1", active_port)
    } else {
        cfg.pointer(&format!("/provider/{}/options/baseURL", provider_id))
            .or_else(|| cfg.pointer(&format!("/provider/{}/api/url", provider_id)))
            .and_then(|v| v.as_str())
            .map(|s| s.trim_end_matches('/').to_string())
            .unwrap_or_else(|| crate::bridge::get_bridge_base_url())
    };

    let api_key = cfg
        .pointer(&format!("/provider/{}/options/apiKey", provider_id))
        .and_then(|v| v.as_str())
        .unwrap_or("local-cli-bridge");

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .unwrap();

    let mut final_summary = String::new();
    let mut steps_executed = 0;

    for step in 0..12 {
        steps_executed = step + 1;
        emit_event(
            workspace_dir,
            "session.next.step.started",
            json!({
                "sessionID": session_id,
                "step": step + 1,
                "label": format!("🤖 [{}] Working on subtask (step {})...", role_display, step + 1)
            }),
        );

        let req_body = json!({
            "model": model_id,
            "messages": messages,
            "stream": false,
            "tools": tools
        });

        let resp = match client
            .post(format!("{}/chat/completions", base_url))
            .header("Content-Type", "application/json")
            .header("Authorization", format!("Bearer {}", api_key))
            .json(&req_body)
            .send()
            .await
        {
            Ok(r) => r,
            Err(e) => {
                crate::paths::log_engine("subagent", &format!("Network error in subagent: {}", e));
                break;
            }
        };

        let raw_json: Value = match resp.json().await {
            Ok(j) => j,
            Err(e) => {
                crate::paths::log_engine("subagent", &format!("JSON parse error in subagent: {}", e));
                break;
            }
        };

        let choice = raw_json
            .pointer("/choices/0/message")
            .cloned()
            .unwrap_or(Value::Null);

        if choice.is_null() {
            break;
        }

        messages.push(choice.clone());

        if let Some(txt) = choice.get("content").and_then(|v| v.as_str()) {
            if !txt.trim().is_empty() {
                final_summary = txt.to_string();
            }
        }

        let tool_calls = choice
            .get("tool_calls")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();

        if tool_calls.is_empty() {
            // Subagent finished all tool work and replied with final summary
            break;
        }

        // Execute subagent tool calls
        for tc in tool_calls {
            let tc_id = tc.get("id").and_then(|v| v.as_str()).unwrap_or("call_sub");
            let fn_name = tc.pointer("/function/name").and_then(|v| v.as_str()).unwrap_or("");
            let fn_args_str = tc.pointer("/function/arguments").and_then(|v| v.as_str()).unwrap_or("{}");
            let fn_args: Value = serde_json::from_str(fn_args_str).unwrap_or(json!({}));

            crate::paths::log_engine(
                "subagent",
                &format!("🔧 [{}] Executing tool: {}", role_display, fn_name),
            );

            let tool_output = execute_tool_call(
                session_id,
                &gen_id("sub_msg"),
                tc_id,
                workspace_dir,
                &fn_args,
                fn_name,
            )
            .await;

            let tool_res_str = match &tool_output {
                Value::String(s) => s.clone(),
                other => other.to_string(),
            };

            messages.push(json!({
                "role": "tool",
                "tool_call_id": tc_id,
                "content": tool_res_str
            }));
        }
    }

    let summary_text = if !final_summary.is_empty() {
        final_summary
    } else {
        format!("Subagent [{}] successfully executed tasks.", role_display)
    };

    // Record subagent message as an independent assistant turn in chat history
    let subagent_msg = json!({
        "id": gen_id("submsg"),
        "type": "assistant",
        "role": "assistant",
        "agent": role_display,
        "content": [{
            "type": "text",
            "id": gen_id("txt"),
            "text": summary_text
        }],
        "finish": "stop",
        "time": {
            "created": now_ms(),
            "completed": now_ms()
        }
    });

    with_store(|store| {
        store.messages.entry(session_id.to_string()).or_default().push(subagent_msg.clone());
        save_store(store);
    });

    emit_event(
        workspace_dir,
        "session.message.created",
        json!({
            "sessionID": session_id,
            "message": subagent_msg
        }),
    );

    emit_event(
        workspace_dir,
        "session.next.step.started",
        json!({
            "sessionID": session_id,
            "label": format!("✅ [{}] Subtask completed", role_display)
        }),
    );

    json!({
        "ok": true,
        "role": role,
        "role_display": role_display,
        "steps_executed": steps_executed,
        "summary": summary_text
    })
}

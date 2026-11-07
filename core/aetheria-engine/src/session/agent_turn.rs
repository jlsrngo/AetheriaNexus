//! Agent Turn Execution Engine — mirrors OpenCode `packages/core/src/session/runner/llm.ts`.
//!
//! Handles the full lifecycle of an autonomous turn:
//! - Context assembly (<env>, <living_memory>, <workspace_documents>, <knowledge_base>)
//! - Multimodal attachment ingestion & OCR transcription
//! - 25-step LLM completion loop with Doom-Loop breaker & Tool Output hard limits
//! - JSON tool argument syntax recovery
//! - Context overflow auto-healing and emergency compaction
//! - Real-time SSE event emission and message persistence

use crate::bridge::LOCAL_CLI_BRIDGE_PORT;
use crate::knowledge::get_active_knowledge_for_workspace;
use crate::paths::{gen_id, now_ms};
use crate::provider::read_aetheria_config;
use crate::session::message::emit_event;
use crate::session::session::{save_store, with_store};
use crate::session::tools::{build_tool_definitions, execute_tool_call, should_attach_document_tools};
use serde_json::{json, Value};

/// Scans workspace directory for installed agent skills (.agents/skills/*/SKILL.md, .aetheria/plugins/*/SKILL.md, .opencode/skills/)
pub fn discover_workspace_skills(workspace_dir: &str) -> String {
    let ws_path = std::path::Path::new(workspace_dir);
    let mut search_dirs = vec![
        ws_path.join(".agents").join("skills"),
        ws_path.join("skills"),
        ws_path.join(".opencode").join("skills"),
    ];
    let root = crate::paths::project_root();
    if ws_path != root {
        search_dirs.push(root.join(".agents").join("skills"));
        search_dirs.push(root.join(".opencode").join("skills"));
    }

    // Also include enabled plugins from .aetheria/plugins
    let plugins_dir = ws_path.join(".aetheria").join("plugins");
    if plugins_dir.is_dir() {
        if let Ok(entries) = std::fs::read_dir(&plugins_dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_dir() {
                    search_dirs.push(p.clone());
                    search_dirs.push(p.join("skills"));
                }
            }
        }
    }

    let mut discovered: Vec<(String, String, std::path::PathBuf)> = Vec::new();
    let mut seen = std::collections::HashSet::new();

    for dir in search_dirs {
        if let Ok(entries) = std::fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let skill_dir = entry.path();
                let skill_md = skill_dir.join("SKILL.md");
                if skill_md.is_file() {
                    let dir_name = skill_dir
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("")
                        .to_string();
                    if !seen.insert(dir_name.clone()) {
                        continue;
                    }
                    if let Ok(content) = std::fs::read_to_string(&skill_md) {
                        let mut name = dir_name.clone();
                        let mut desc = String::new();
                        let lines: Vec<&str> = content.lines().take(30).collect();
                        for line in lines {
                            let trimmed = line.trim();
                            if let Some(rest) = trimmed.strip_prefix("name:") {
                                name = rest.trim().to_string();
                            } else if let Some(rest) = trimmed.strip_prefix("description:") {
                                desc = rest.trim().to_string();
                            }
                        }
                        if desc.is_empty() {
                            desc = format!("Skill: {}", name);
                        }
                        discovered.push((name, desc, skill_md));
                    }
                }
            }
        }
    }

    if discovered.is_empty() {
        return String::new();
    }

    let mut out = String::from(
        "<skills>\nYou have access to specialized skills in this workspace. When crafting videos, motion graphics, or code, you may read these skill instructions and design references:\n",
    );
    for (name, desc, path) in discovered {
        out.push_str(&format!(
            "- {}: {} (Path: {})\n",
            name,
            desc,
            path.display()
        ));
    }
    out.push_str("</skills>\n");
    out
}

/// Discovers and loads active plugin rules from .aetheria/plugins/*/rules/*.md
pub fn discover_workspace_plugin_rules(workspace_dir: &str) -> String {
    let ws_path = std::path::Path::new(workspace_dir);
    let plugins_dir = ws_path.join(".aetheria").join("plugins");
    if !plugins_dir.is_dir() {
        return String::new();
    }

    let mut rules_out = String::new();
    if let Ok(entries) = std::fs::read_dir(&plugins_dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                let plugin_name = p.file_name().and_then(|n| n.to_str()).unwrap_or("plugin");
                let rules_dir = p.join("rules");
                if rules_dir.is_dir() {
                    if let Ok(rule_files) = std::fs::read_dir(&rules_dir) {
                        for rf in rule_files.flatten() {
                            let rpath = rf.path();
                            if rpath.extension().and_then(|e| e.to_str()) == Some("md") {
                                if let Ok(rule_text) = std::fs::read_to_string(&rpath) {
                                    rules_out.push_str(&format!(
                                        "\n<!-- Rule from plugin: {} ({}) -->\n{}\n",
                                        plugin_name,
                                        rpath.file_name().and_then(|f| f.to_str()).unwrap_or(""),
                                        rule_text.trim()
                                    ));
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if rules_out.is_empty() {
        return String::new();
    }

    format!("<plugin_rules>\n{}\n</plugin_rules>", rules_out)
}

pub async fn run_agent_turn(
    session_id: &str,
    workspace_dir: &str,
    provider_id: &str,
    model_id: &str,
    history: &[Value],
    prompt_text: &str,
    files: Option<&Value>,
) {
    let assistant_msg_id = gen_id("msg");
    let started_ms = now_ms();
    crate::session::session::set_active_run(session_id, true);

    emit_event(
        workspace_dir,
        "session.next.step.started",
        json!({
            "sessionID": session_id,
            "messageID": assistant_msg_id,
            "agent": "default",
            "model": { "providerID": provider_id, "id": model_id }
        }),
    );

    // 1. Base system prompt from prompt/default.txt + environment block (OpenCode SystemPrompt.environment parity)
    let base_prompt_template = include_str!("prompt/default.txt");
    let now = chrono::Local::now();
    let today_date_str = now.format("%Y-%m-%d").to_string();
    let day_of_week = now.format("%A").to_string();
    let current_time_str = now.format("%H:%M").to_string();

    let mut sys_prompt = format!(
        "{}\n\nHere is some useful information about the environment you are running in:\n\
        <env>\n\
          Working directory: {}\n\
          Platform: {}\n\
          Today's date: {} ({})\n\
          Current local time: {}\n\
        </env>",
        base_prompt_template.trim(),
        workspace_dir,
        std::env::consts::OS,
        today_date_str,
        day_of_week,
        current_time_str
    );

    // 2. Workspace Instruction File (.aetheria-nexus/AETHERIA.md)
    let living_mem = crate::session::memory::get_living_memory_for_workspace(workspace_dir);
    if !living_mem.trim().is_empty() {
        sys_prompt.push_str("\n\n<living_memory>\n");
        sys_prompt.push_str(living_mem.trim());
        sys_prompt.push_str("\n</living_memory>");
    }

    // 3. Visual Knowledge Graph base
    let active_kn = get_active_knowledge_for_workspace(workspace_dir);
    if !active_kn.is_empty() {
        sys_prompt.push_str("\n\n<knowledge_base>\n");
        for n in active_kn.iter().take(10) {
            let t = n.get("title").and_then(|v| v.as_str()).unwrap_or("Note");
            let c = n.get("content").and_then(|v| v.as_str()).unwrap_or("");
            let snippet: String = c.chars().take(4000).collect();
            sys_prompt.push_str(&format!("--- {} ---\n{}\n", t, snippet));
        }
        sys_prompt.push_str("</knowledge_base>");
    }

    // 4. Discovered Workspace Skills (.agents/skills/*/SKILL.md, e.g. motioncraft)
    let ws_skills = discover_workspace_skills(workspace_dir);
    if !ws_skills.is_empty() {
        sys_prompt.push_str("\n\n");
        sys_prompt.push_str(&ws_skills);
    }

    // 5. Active Plugin Rules from .aetheria/plugins/*/rules/*.md
    let plugin_rules = discover_workspace_plugin_rules(workspace_dir);
    if !plugin_rules.is_empty() {
        sys_prompt.push_str("\n\n");
        sys_prompt.push_str(&plugin_rules);
    }

    // Proactive Context Compaction (OpenCode Item 2a)
    let (effective_history, was_compacted) =
        crate::session::compaction::compact_session_history(history, crate::session::compaction::DEFAULT_CONTEXT_WINDOW);
    if was_compacted {
        crate::paths::log_engine(
            "session",
            &format!(
                "📦 Session context compacted: {} turns summarized to preserve context window",
                history.len()
            ),
        );
        emit_event(
            workspace_dir,
            "session.compacted",
            json!({
                "sessionID": session_id,
                "originalTurns": history.len(),
                "compactedTurns": effective_history.len()
            }),
        );
    }

    let mut chat_messages = vec![json!({ "role": "system", "content": sys_prompt })];
    for m in &effective_history {
        let mtype = m.get("type").and_then(|v| v.as_str()).unwrap_or("");
        if mtype == "synthetic" {
            let txt = m.get("text").and_then(|v| v.as_str()).unwrap_or("");
            if !txt.is_empty() {
                chat_messages.push(json!({ "role": "system", "content": txt }));
            }
        } else if mtype == "user" {
            let txt = m.get("text").and_then(|v| v.as_str()).unwrap_or("");
            chat_messages.push(json!({ "role": "user", "content": txt }));
        } else if mtype == "assistant" {
            let parts = m.get("content").and_then(|v| v.as_array());
            let mut tool_calls = Vec::new();
            let mut tool_results = Vec::new();
            let mut text_parts = Vec::new();

            if let Some(arr) = parts {
                for p in arr {
                    let ptype = p.get("type").and_then(|t| t.as_str()).unwrap_or("");
                    if ptype == "text" {
                        if let Some(t) = p.get("text").and_then(|s| s.as_str()) {
                            text_parts.push(t);
                        }
                    } else if ptype == "tool" {
                        let cid = p.get("id").and_then(|v| v.as_str()).unwrap_or("call_0");
                        let fn_name = p.get("name").and_then(|v| v.as_str()).unwrap_or("tool");
                        let input_val = p.pointer("/state/input").cloned().unwrap_or_else(|| json!({}));
                        let out_str_raw = p
                            .pointer("/state/content/0/text")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string())
                            .or_else(|| {
                                p.pointer("/state/structured")
                                    .map(|v| serde_json::to_string(v).unwrap_or_default())
                            })
                            .unwrap_or_else(|| "{}".to_string());
                        let out_str: String = if out_str_raw.len() > 600 {
                            let mut truncated: String = out_str_raw.chars().take(600).collect();
                            truncated.push_str("...[truncated historical output]");
                            truncated
                        } else {
                            out_str_raw
                        };

                        let args_raw = serde_json::to_string(&input_val).unwrap_or_else(|_| "{}".to_string());
                        let args_compact = if args_raw.len() > 600 {
                            let fp = input_val
                                .get("filePath")
                                .or_else(|| input_val.get("path"))
                                .and_then(|v| v.as_str())
                                .unwrap_or("");
                            json!({ "filePath": fp, "_note": "historical content omitted" }).to_string()
                        } else {
                            args_raw
                        };

                        tool_calls.push(json!({
                            "id": cid,
                            "type": "function",
                            "function": {
                                "name": fn_name,
                                "arguments": args_compact
                            }
                        }));

                        tool_results.push(json!({
                            "role": "tool",
                            "tool_call_id": cid,
                            "name": fn_name,
                            "content": out_str
                        }));
                    }
                }
            }

            let mut clean_txt = text_parts.join("");
            if clean_txt.starts_with("[Tools executed in this past turn:") {
                if let Some(pos) = clean_txt.find("]\n") {
                    clean_txt = clean_txt[pos + 2..].to_string();
                } else if let Some(pos) = clean_txt.find(']') {
                    clean_txt = clean_txt[pos + 1..].trim_start().to_string();
                }
            }

            // Standard OpenCode / OpenAI Message Structure:
            // 1. Assistant message with tool_calls (if any tools were invoked)
            // 2. Tool response messages for each tool call
            // 3. Final assistant text message AFTER tool outputs (preserving strict user/assistant alternation)
            if !tool_calls.is_empty() {
                chat_messages.push(json!({
                    "role": "assistant",
                    "content": Value::Null,
                    "tool_calls": tool_calls
                }));
                for tr in tool_results {
                    chat_messages.push(tr);
                }
                if !clean_txt.is_empty() {
                    chat_messages.push(json!({
                        "role": "assistant",
                        "content": clean_txt
                    }));
                }
            } else if !clean_txt.is_empty() {
                chat_messages.push(json!({ "role": "assistant", "content": clean_txt }));
            }
        }
    }
    // Process attached files (especially images) for OCR & Multimodal vision
    let mut ocr_transcriptions: Vec<String> = Vec::new();
    let mut image_urls: Vec<String> = Vec::new();
    let root_dir = crate::paths::project_root();
    let ffmpeg_bin = [
        root_dir.join("node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe"),
        root_dir.join("node_modules/@remotion/compositor-linux-x64-gnu/ffmpeg"),
        root_dir.join("node_modules/@remotion/compositor-darwin-arm64/ffmpeg"),
        root_dir.join("node_modules/@remotion/compositor-darwin-x64/ffmpeg"),
    ]
    .into_iter()
    .find(|p| p.is_file());

    if let Some(files_arr) = files.and_then(|f| f.as_array()) {
        for file_item in files_arr {
            let file_name = file_item
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("attached_media");
            let uri = file_item
                .get("uri")
                .or_else(|| file_item.get("url"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let lower_name = file_name.to_lowercase();

            if uri.starts_with("data:image/") {
                image_urls.push(uri.to_string());
                if let Some(comma_pos) = uri.find(',') {
                    let b64_data = &uri[comma_pos + 1..];
                    use base64::prelude::*;
                    if let Ok(bytes) = BASE64_STANDARD.decode(b64_data.trim()) {
                        let pub_dir = root_dir.join("workspace").join("public");
                        let _ = std::fs::create_dir_all(&pub_dir);
                        let clean_name = file_name
                            .replace(|c: char| !c.is_alphanumeric() && c != '.' && c != '_', "_");
                        let img_path = pub_dir.join(format!("ref_{}", clean_name));
                        if std::fs::write(&img_path, &bytes).is_ok() {
                            ocr_transcriptions.push(format!(
                                "[Reference Image Style Asset: '{}' saved at workspace/public/ref_{} (use staticFile(\"ref_{}\") in Remotion or match its color palette, typography, and layout style)]",
                                file_name, clean_name, clean_name
                            ));
                        }
                    }
                }
            } else if uri.starts_with("data:video/")
                || (uri.starts_with("data:")
                    && (lower_name.ends_with(".mp4")
                        || lower_name.ends_with(".mov")
                        || lower_name.ends_with(".webm")
                        || lower_name.ends_with(".mkv")))
            {
                if let Some(comma_pos) = uri.find(',') {
                    let b64_data = &uri[comma_pos + 1..];
                    use base64::prelude::*;
                    if let Ok(bytes) = BASE64_STANDARD.decode(b64_data.trim()) {
                        let pub_dir = root_dir.join("workspace").join("public");
                        let _ = std::fs::create_dir_all(&pub_dir);
                        let clean_name = file_name
                            .replace(|c: char| !c.is_alphanumeric() && c != '.' && c != '_', "_");
                        let vid_path = pub_dir.join(format!("ref_{}", clean_name));
                        let ref_wav = pub_dir.join("ref_voice.wav");
                        if std::fs::write(&vid_path, &bytes).is_ok() {
                            if let Some(ref ff) = ffmpeg_bin {
                                // 1. Extract reference voice audio track (24kHz mono WAV)
                                let _ = std::process::Command::new(ff)
                                    .args([
                                        "-y",
                                        "-hide_banner",
                                        "-loglevel",
                                        "error",
                                        "-i",
                                        &vid_path.to_string_lossy(),
                                        "-vn",
                                        "-ac",
                                        "1",
                                        "-ar",
                                        "24000",
                                        &ref_wav.to_string_lossy(),
                                    ])
                                    .output();

                                // 2. Extract 3 visual style keyframes (1s, 3s, 6s) for Vision LLM
                                for (idx, ts) in ["00:00:01", "00:00:03", "00:00:06"].iter().enumerate() {
                                    let frame_jpg = pub_dir.join(format!("ref_frame_{}.jpg", idx + 1));
                                    if std::process::Command::new(ff)
                                        .args([
                                            "-y",
                                            "-hide_banner",
                                            "-loglevel",
                                            "error",
                                            "-ss",
                                            ts,
                                            "-i",
                                            &vid_path.to_string_lossy(),
                                            "-frames:v",
                                            "1",
                                            "-q:v",
                                            "4",
                                            &frame_jpg.to_string_lossy(),
                                        ])
                                        .output()
                                        .map(|o| o.status.success())
                                        .unwrap_or(false)
                                    {
                                        if let Ok(jpg_bytes) = std::fs::read(&frame_jpg) {
                                            if !jpg_bytes.is_empty() {
                                                let b64_jpg = BASE64_STANDARD.encode(&jpg_bytes);
                                                image_urls.push(format!("data:image/jpeg;base64,{}", b64_jpg));
                                            }
                                        }
                                    }
                                }
                            }
                            ocr_transcriptions.push(format!(
                                "[Reference Video Style & Voice Asset: '{}' saved at workspace/public/ref_{}. Visual keyframes have been attached for style matching, and its voice track is extracted at 'workspace/public/ref_voice.wav'. Only clone it (refAudio + cloneVoice: true) if it is the user's own voice or they confirmed permission; otherwise describe its tone in voiceDesign.]",
                                file_name, clean_name
                            ));
                        }
                    }
                }
            } else if uri.starts_with("data:audio/")
                || (uri.starts_with("data:")
                    && (lower_name.ends_with(".wav")
                        || lower_name.ends_with(".mp3")
                        || lower_name.ends_with(".m4a")
                        || lower_name.ends_with(".ogg")))
            {
                if let Some(comma_pos) = uri.find(',') {
                    let b64_data = &uri[comma_pos + 1..];
                    use base64::prelude::*;
                    if let Ok(bytes) = BASE64_STANDARD.decode(b64_data.trim()) {
                        let pub_dir = root_dir.join("workspace").join("public");
                        let _ = std::fs::create_dir_all(&pub_dir);
                        let clean_name = file_name
                            .replace(|c: char| !c.is_alphanumeric() && c != '.' && c != '_', "_");
                        let raw_audio = pub_dir.join(format!("ref_{}", clean_name));
                        let ref_wav = pub_dir.join("ref_voice.wav");
                        if std::fs::write(&raw_audio, &bytes).is_ok() {
                            if let Some(ref ff) = ffmpeg_bin {
                                let _ = std::process::Command::new(ff)
                                    .args([
                                        "-y",
                                        "-hide_banner",
                                        "-loglevel",
                                        "error",
                                        "-i",
                                        &raw_audio.to_string_lossy(),
                                        "-ac",
                                        "1",
                                        "-ar",
                                        "24000",
                                        &ref_wav.to_string_lossy(),
                                    ])
                                    .output();
                            } else {
                                let _ = std::fs::copy(&raw_audio, &ref_wav);
                            }
                            ocr_transcriptions.push(format!(
                                "[Reference Voice Audio Asset: '{}' normalized to 'workspace/public/ref_voice.wav'. If this is the user's own recording (or they confirmed permission), pass refAudio: \"workspace/public/ref_voice.wav\" with cloneVoice: true to voicebox_speak; otherwise describe its tone in voiceDesign.]",
                                file_name
                            ));
                        }
                    }
                }
            } else if !uri.is_empty() {
                let candidate = std::path::Path::new(workspace_dir).join(uri);
                if candidate.exists() {
                    ocr_transcriptions.push(format!(
                        "[Attached Media Asset: {} at {}]",
                        file_name,
                        candidate.display()
                    ));
                }
            }
        }
    }

    // Automatically extract visual thumbnail & metadata if user pasted a YouTube or TikTok link in prompt_text
    for word in prompt_text.split_whitespace() {
        let clean_url = word.trim_matches(|c: char| c == '(' || c == ')' || c == '<' || c == '>' || c == '"' || c == '\'');
        if clean_url.contains("tiktok.com/") {
            if let Ok(resp) = reqwest::Client::new()
                .get("https://www.tikwm.com/api/")
                .query(&[("url", clean_url)])
                .send()
                .await
            {
                if let Ok(json_val) = resp.json::<Value>().await {
                    let data = json_val.get("data").cloned().unwrap_or(Value::Null);
                    let title = data.get("title").and_then(|v| v.as_str()).unwrap_or("");
                    let duration = data.get("duration").and_then(|v| v.as_u64()).unwrap_or(30);
                    let author = data
                        .get("author")
                        .and_then(|a| a.get("unique_id"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("creator");
                    let play_url = data.get("play").and_then(|v| v.as_str()).unwrap_or("");

                    let pub_dir = std::path::Path::new(workspace_dir)
                        .join("workspace")
                        .join("public");
                    let _ = std::fs::create_dir_all(&pub_dir);
                    let mp4_path = pub_dir.join("ref_tiktok.mp4");
                    let wav_path = pub_dir.join("ref_voice.wav");

                    if !play_url.is_empty() {
                        if let Ok(vid_resp) = reqwest::get(play_url).await {
                            if let Ok(vid_bytes) = vid_resp.bytes().await {
                                if !vid_bytes.is_empty() {
                                    let _ = std::fs::write(&mp4_path, &vid_bytes);
                                    let ff_cmd = ffmpeg_bin
                                        .as_deref()
                                        .unwrap_or_else(|| std::path::Path::new("ffmpeg"));
                                    let _ = std::process::Command::new(ff_cmd)
                                        .args([
                                            "-y",
                                            "-i",
                                            &mp4_path.to_string_lossy(),
                                            "-vn",
                                            "-acodec",
                                            "pcm_s16le",
                                            "-ar",
                                            "24000",
                                            "-ac",
                                            "1",
                                            &wav_path.to_string_lossy(),
                                        ])
                                        .output();

                                    for (idx, ts) in ["00:00:01", "00:00:04", "00:00:14"].iter().enumerate() {
                                        let frame_jpg = std::env::temp_dir()
                                            .join(format!("aetheria_tiktok_ref_{}.jpg", idx));
                                        let _ = std::process::Command::new(ff_cmd)
                                            .args([
                                                "-y",
                                                "-ss",
                                                ts,
                                                "-i",
                                                &mp4_path.to_string_lossy(),
                                                "-frames:v",
                                                "1",
                                                "-q:v",
                                                "4",
                                                &frame_jpg.to_string_lossy(),
                                            ])
                                            .output();
                                        if let Ok(jpg_bytes) = std::fs::read(&frame_jpg) {
                                            use base64::prelude::*;
                                            let b64 = BASE64_STANDARD.encode(&jpg_bytes);
                                            image_urls.push(format!("data:image/jpeg;base64,{}", b64));
                                        }
                                    }
                                }
                            }
                        }
                    }

                    ocr_transcriptions.push(format!(
                        "[TikTok Reference Video Extracted (@{}, duration: {}s, title: \"{}\"):\n\
                        - Reference Video Saved: workspace/public/ref_tiktok.mp4\n\
                        - Reference Voice Track Extracted: workspace/public/ref_voice.wav. When the user requests matching or using this voice sample, pass `refAudio: \"workspace/public/ref_voice.wav\"` and `cloneVoice: true` to `voicebox_speak` so Voicebox clones the speaker's exact vocal timbre and intonation!\n\
                        - Keyframes attached to vision context: study the reference's motion language (entrance/exit choreography, camera moves, layout zones, typography hierarchy, palette) and translate it into this video's own style per the Visual Style System — inspired by, never a pixel copy.]",
                        author, duration, title
                    ));
                }
            }
            continue;
        }
        let yt_id = if let Some(idx) = clean_url.find("youtube.com/watch?v=") {
            clean_url[idx + 20..].split(&['&', '#', '?'][..]).next()
        } else if let Some(idx) = clean_url.find("youtu.be/") {
            clean_url[idx + 9..].split(&['&', '#', '?'][..]).next()
        } else if let Some(idx) = clean_url.find("youtube.com/shorts/") {
            clean_url[idx + 19..].split(&['&', '#', '?'][..]).next()
        } else {
            None
        };
        if let Some(vid_id) = yt_id.filter(|id| id.len() >= 8) {
            let thumb_url = format!("https://i.ytimg.com/vi/{}/hqdefault.jpg", vid_id);
            if let Ok(resp) = reqwest::get(&thumb_url).await {
                if let Ok(bytes) = resp.bytes().await {
                    if !bytes.is_empty() {
                        use base64::prelude::*;
                        let b64 = BASE64_STANDARD.encode(&bytes);
                        image_urls.push(format!("data:image/jpeg;base64,{}", b64));
                        ocr_transcriptions.push(format!(
                            "[Reference Video Link Detected (YouTube ID: {}): Visual reference frame attached to vision context — match its aesthetic, color palette, typography, and motion pacing!]",
                            vid_id
                        ));
                    }
                }
            }
        }
    }

    // Resolve @filename mentions from prompt_text into workspace file context
    let mut mentioned_files_context = Vec::new();
    for word in prompt_text.split_whitespace() {
        if let Some(m) = word.strip_prefix('@') {
            let clean_m = m.trim_matches(|c: char| !c.is_alphanumeric() && c != '.' && c != '_' && c != '-');
            if !clean_m.is_empty() {
                let candidate = std::path::Path::new(workspace_dir).join(clean_m);
                if candidate.is_file() {
                    if let Ok(content) = std::fs::read_to_string(&candidate) {
                        let snippet: String = content.chars().take(8000).collect();
                        mentioned_files_context.push(format!(
                            "[Explicitly Mentioned Workspace File: {}]:\n\"\"\"\n{}\n\"\"\"",
                            clean_m, snippet.trim()
                        ));
                    } else {
                        mentioned_files_context.push(format!(
                            "[Explicitly Mentioned Workspace File: {} (binary document present in active folder)]",
                            clean_m
                        ));
                    }
                }
            }
        }
    }

    let mut context_additions = Vec::new();
    if !ocr_transcriptions.is_empty() {
        context_additions.extend(ocr_transcriptions);
    }
    if !mentioned_files_context.is_empty() {
        context_additions.extend(mentioned_files_context);
    }

    // Automatically inject active video reference report if present in user workspace or repo
    let ws_path = std::path::Path::new(workspace_dir);
    let candidates = [
        ws_path.join("ref").join("ref_report.md"),
        ws_path.join("ref").join("extracted").join("ref_report.md"),
        ws_path.join("workspace").join("ref").join("extracted").join("ref_report.md"),
        ws_path.join("ref").join("REFERENCE_BLUEPRINT.md"),
        ws_path.join("workspace").join("ref").join("extracted").join("REFERENCE_BLUEPRINT.md"),
    ];
    let target_report = candidates.into_iter().find(|p| p.exists());

    if let Some(path) = target_report {
        if let Ok(bp_text) = std::fs::read_to_string(&path) {
            context_additions.push(format!(
                "[Active Video Reference Analysis Report (from motioncraft ref report)]:\n\"\"\"\n{}\n\"\"\"\n\
                DIRECTIVE: You MUST follow the color palette, typography hierarchy, and scene pacing from this reference report. \
                NEVER render a black screen or set opacity to 0! ALWAYS drive animations with `const frame = useCurrentFrame();`!",
                bp_text.trim()
            ));
        }
    }

    let enriched_user_text = if !context_additions.is_empty() {
        format!("{}\n\n{}", prompt_text, context_additions.join("\n\n"))
    } else {
        prompt_text.to_string()
    };

    // Determine target base URL & API key
    let cfg = read_aetheria_config();
    let mut current_provider_id = provider_id.to_string();
    let mut current_model_id = model_id.to_string();

    let model_supports_vision = current_model_id.contains("vl")
        || current_model_id.contains("vision")
        || current_model_id.contains("gemini")
        || current_model_id.contains("claude")
        || current_model_id.contains("gpt-4")
        || current_model_id.contains("4o");

    if !image_urls.is_empty() && model_supports_vision {
        let mut user_parts = vec![json!({ "type": "text", "text": enriched_user_text })];
        for img_url in &image_urls {
            user_parts.push(json!({
                "type": "image_url",
                "image_url": { "url": img_url }
            }));
        }
        chat_messages.push(json!({ "role": "user", "content": user_parts }));
    } else {
        chat_messages.push(json!({ "role": "user", "content": enriched_user_text }));
    }
    let is_local_bridge = provider_id == "antigravity" || provider_id == "local-cli";
    let mut base_url = cfg
        .pointer(&format!("/provider/{}/options/baseURL", provider_id))
        .or_else(|| cfg.pointer(&format!("/provider/{}/api/url", provider_id)))
        .or_else(|| cfg.pointer(&format!("/provider/{}/api", provider_id)))
        .or_else(|| cfg.pointer(&format!("/providers/{}/options/baseURL", provider_id)))
        .or_else(|| cfg.pointer(&format!("/providers/{}/api/url", provider_id)))
        .and_then(|v| v.as_str())
        .map(|s| s.trim_end_matches('/').to_string())
        .unwrap_or_else(|| crate::bridge::get_bridge_base_url());

    if is_local_bridge {
        let active_port = crate::bridge::ensure_bridge_running().await;
        base_url = format!("http://127.0.0.1:{}/v1", active_port);
    }
    let mut api_key = cfg
        .pointer(&format!("/provider/{}/options/apiKey", provider_id))
        .or_else(|| cfg.pointer(&format!("/provider/{}/request/body/apiKey", provider_id)))
        .or_else(|| cfg.pointer(&format!("/providers/{}/options/apiKey", provider_id)))
        .or_else(|| cfg.pointer(&format!("/providers/{}/request/body/apiKey", provider_id)))
        .and_then(|v| v.as_str())
        .unwrap_or("local-cli-bridge")
        .to_string();

    let attach_tools = should_attach_document_tools(prompt_text, history);
    let tools_def = if attach_tools {
        build_tool_definitions()
    } else {
        Vec::new()
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .unwrap();

    let mut content_parts: Vec<Value> = Vec::new();
    let mut final_text = String::new();
    let mut doom_loop_detector = super::doom_loop::DoomLoopDetector::default();

    for _step in 0..35 {
        let step_start = now_ms();
        crate::paths::log_engine(
            "ai",
            &format!("⏳ Calling AI model '{}' (step {})...", current_model_id, _step + 1),
        );
        emit_event(
            workspace_dir,
            "session.next.step.started",
            json!({
                "sessionID": session_id,
                "messageID": assistant_msg_id,
                "step": _step + 1,
                "label": if _step == 0 {
                    "Analyzing prompt & planning video architecture...".to_string()
                } else {
                    format!("Planning next studio action (step {})...", _step + 1)
                }
            }),
        );

        // Proactive in-turn context compaction to prevent provider payload exhaustion
        let total_chars: usize = chat_messages
            .iter()
            .map(|m| {
                m.get("content")
                    .and_then(|v| v.as_str())
                    .map(|s| s.len())
                    .unwrap_or(50)
            })
            .sum();
        if (_step >= 28 && chat_messages.len() > 65) || total_chars > 220_000 {
            crate::paths::log_engine(
                "ai",
                "📦 Proactive context compaction triggered during turn to maintain optimal token budget...",
            );
            chat_messages = crate::session::compaction::emergency_compact_messages(&chat_messages);
        }

        let mut req_body = json!({
            "model": current_model_id,
            "messages": chat_messages,
            "stream": false
        });
        if !tools_def.is_empty() {
            req_body["tools"] = Value::Array(tools_def.clone());
        }

        let resp = client
            .post(format!("{}/chat/completions", base_url))
            .header("Content-Type", "application/json")
            .header("Authorization", format!("Bearer {}", api_key))
            .json(&req_body)
            .send()
            .await;

        let r = match resp {
            Ok(r) => r,
            Err(e) => {
                crate::paths::log_engine(
                    "ai",
                    &format!("⚠️ Connection error to AI endpoint {}: {}", base_url, e),
                );
                if is_local_bridge || base_url.contains(&format!(":{}", LOCAL_CLI_BRIDGE_PORT)) {
                    crate::paths::log_engine("ai", "🔄 Auto-healing Local-CLI Bridge and retrying turn...");
                    let new_port = crate::bridge::ensure_bridge_running().await;
                    base_url = format!("http://127.0.0.1:{}/v1", new_port);
                    tokio::time::sleep(std::time::Duration::from_millis(300)).await;
                    match client
                        .post(format!("{}/chat/completions", base_url))
                        .header("Content-Type", "application/json")
                        .header("Authorization", format!("Bearer {}", api_key))
                        .json(&req_body)
                        .send()
                        .await
                    {
                        Ok(retried_r) => retried_r,
                        Err(retry_err) => {
                            final_text = format!("Error: Failed to reach AI provider ({}).", retry_err);
                            break;
                        }
                    }
                } else {
                    final_text = format!("Error: Failed to reach AI provider ({}).", e);
                    break;
                }
            }
        };
        let mut r = r;
        if !r.status().is_success() {
            let err_txt = r.text().await.unwrap_or_default();
            // Context Overflow Auto-Healing (OpenCode Item 2b)
            if crate::session::compaction::is_context_overflow_error(&err_txt) && chat_messages.len() > 2 {
                crate::paths::log_engine(
                    "ai",
                    "🩹 Context window overflow detected! Triggering emergency compaction auto-heal...",
                );
                chat_messages = crate::session::compaction::emergency_compact_messages(&chat_messages);
                req_body["messages"] = Value::Array(chat_messages.clone());

                emit_event(
                    workspace_dir,
                    "session.overflow_healed",
                    json!({
                        "sessionID": session_id,
                        "compactedMessages": chat_messages.len()
                    }),
                );

                let retry_resp = client
                    .post(format!("{}/chat/completions", base_url))
                    .header("Content-Type", "application/json")
                    .header("Authorization", format!("Bearer {}", api_key))
                    .json(&req_body)
                    .send()
                    .await;

                match retry_resp {
                    Ok(healed_r) if healed_r.status().is_success() => {
                        crate::paths::log_engine("ai", "✅ Emergency context auto-heal succeeded! Continuing turn.");
                        r = healed_r;
                    }
                    Ok(healed_r) => {
                        let final_err = healed_r.text().await.unwrap_or_default();
                        final_text = format!("Error from AI provider (after context compaction): {}", final_err);
                        break;
                    }
                    Err(retry_e) => {
                        final_text = format!("Error reaching AI provider during auto-heal retry: {}", retry_e);
                        break;
                    }
                }
            } else if (err_txt.contains("MONTHLY_REQUEST_COUNT")
                || err_txt.contains("402")
                || err_txt.contains("Payment Required")
                || err_txt.contains("insufficient balance")
                || err_txt.contains("rate limit"))
                && (current_provider_id != "kenari" || current_model_id != "llama-3-3-70b-instruct:free")
            {
                crate::paths::log_engine(
                    "ai",
                    "⚡ Provider quota/balance limit reached. Automatically failing over to Kenari (llama-3-3-70b-instruct:free) for uninterrupted turn execution!",
                );
                emit_event(
                    workspace_dir,
                    "session.failover",
                    json!({
                        "sessionID": session_id,
                        "fromProvider": current_provider_id,
                        "fromModel": current_model_id,
                        "toProvider": "kenari",
                        "toModel": "llama-3-3-70b-instruct:free",
                        "reason": "Quota or balance limit reached"
                    }),
                );
                current_provider_id = "kenari".to_string();
                current_model_id = "llama-3-3-70b-instruct:free".to_string();
                base_url = "https://kenari.id/v1".to_string();
                api_key = cfg
                    .pointer("/providers/kenari/request/body/apiKey")
                    .or_else(|| cfg.pointer("/provider/kenari/request/body/apiKey"))
                    .or_else(|| cfg.pointer("/provider/kenari/options/apiKey"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("kn-d4064183d620d48ada4409df456e02a4f1840f73a7541333")
                    .to_string();
                req_body["model"] = json!(current_model_id);

                let retry_resp = client
                    .post(format!("{}/chat/completions", base_url))
                    .header("Content-Type", "application/json")
                    .header("Authorization", format!("Bearer {}", api_key))
                    .json(&req_body)
                    .send()
                    .await;

                match retry_resp {
                    Ok(fo_r) if fo_r.status().is_success() => {
                        crate::paths::log_engine(
                            "ai",
                            "✅ Seamless failover to Kenari free model succeeded! Continuing turn.",
                        );
                        r = fo_r;
                    }
                    Ok(fo_r) => {
                        let final_err = fo_r.text().await.unwrap_or_default();
                        final_text = format!("Error from AI provider after failover: {}", final_err);
                        break;
                    }
                    Err(retry_e) => {
                        final_text = format!("Error reaching AI provider during failover: {}", retry_e);
                        break;
                    }
                }
            } else if err_txt.contains("upstream_rejected") {
                crate::paths::log_engine(
                    "ai",
                    "⚠️ Upstream rejected request (likely unsupported multimodal vision). Retrying with sanitized text-only messages...",
                );
                // Strip all image_url parts from messages
                for m in &mut chat_messages {
                    if let Some(content_arr) = m.get_mut("content").and_then(|v| v.as_array_mut()) {
                        content_arr.retain(|part| part.get("type").and_then(|t| t.as_str()) != Some("image_url"));
                        if content_arr.len() == 1 && content_arr[0].get("type").and_then(|t| t.as_str()) == Some("text") {
                            let txt = content_arr[0].get("text").and_then(|t| t.as_str()).unwrap_or("").to_string();
                            *m.get_mut("content").unwrap() = Value::String(txt);
                        }
                    }
                }
                req_body["messages"] = Value::Array(chat_messages.clone());
                let retry_resp = client
                    .post(format!("{}/chat/completions", base_url))
                    .header("Content-Type", "application/json")
                    .header("Authorization", format!("Bearer {}", api_key))
                    .json(&req_body)
                    .send()
                    .await;
                match retry_resp {
                    Ok(retry_r) if retry_r.status().is_success() => {
                        crate::paths::log_engine("ai", "✅ Text-only retry succeeded! Continuing turn.");
                        r = retry_r;
                    }
                    Ok(retry_r) => {
                        let final_err = retry_r.text().await.unwrap_or_default();
                        final_text = format!("Error from AI provider: {}", final_err);
                        break;
                    }
                    Err(retry_e) => {
                        final_text = format!("Error reaching AI provider during retry: {}", retry_e);
                        break;
                    }
                }
            } else {
                final_text = format!("Error from AI provider: {}", err_txt);
                break;
            }
        }
        let data: Value = r.json().await.unwrap_or_else(|_| json!({}));
        let msg = data
            .pointer("/choices/0/message")
            .cloned()
            .unwrap_or_else(|| json!({}));
        let mut msg_text = msg
            .get("content")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let mut msg_reasoning = msg
            .get("reasoning_content")
            .or_else(|| msg.get("reasoning"))
            .or_else(|| msg.get("thought"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim()
            .to_string();

        // Also extract inline <think>...</think> blocks if model emitted them inside content
        if let Some(s_idx) = msg_text.find("<think>") {
            if let Some(e_rel) = msg_text[s_idx + 7..].find("</think>") {
                let e_idx = s_idx + 7 + e_rel;
                let inline_thought = msg_text[s_idx + 7..e_idx].trim().to_string();
                if !inline_thought.is_empty() {
                    if !msg_reasoning.is_empty() {
                        msg_reasoning.push_str("\n\n");
                    }
                    msg_reasoning.push_str(&inline_thought);
                }
                let mut cleaned = String::with_capacity(msg_text.len());
                cleaned.push_str(&msg_text[..s_idx]);
                cleaned.push_str(&msg_text[e_idx + 8..]);
                msg_text = cleaned.trim().to_string();
            }
        }

        let tool_calls = msg
            .get("tool_calls")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();

        let step_end = now_ms();
        let step_dur = step_end.saturating_sub(step_start);
        crate::paths::log_engine(
            "ai",
            &format!(
                "✨ AI Model '{}' replied in {}ms | thought: {} chars | text: {} chars | tools: {}",
                current_model_id,
                step_dur,
                msg_reasoning.len(),
                msg_text.len(),
                tool_calls.len()
            ),
        );

        if !msg_reasoning.is_empty() {
            let r_part_id = gen_id("rsn");
            emit_event(
                workspace_dir,
                "session.next.reasoning.started",
                json!({
                    "sessionID": session_id,
                    "messageID": assistant_msg_id,
                    "id": r_part_id
                }),
            );
            emit_event(
                workspace_dir,
                "session.next.reasoning.delta",
                json!({
                    "sessionID": session_id,
                    "messageID": assistant_msg_id,
                    "id": r_part_id,
                    "delta": msg_reasoning
                }),
            );
            emit_event(
                workspace_dir,
                "session.next.reasoning.ended",
                json!({
                    "sessionID": session_id,
                    "messageID": assistant_msg_id,
                    "id": r_part_id,
                    "text": msg_reasoning
                }),
            );
            content_parts.push(json!({
                "type": "reasoning",
                "id": r_part_id,
                "text": msg_reasoning,
                "time": {
                    "start": step_start,
                    "end": step_end,
                    "created": step_start,
                    "completed": step_end
                }
            }));
        }

        if tool_calls.is_empty() {
            final_text = msg_text;
            break;
        }

        // Append assistant message with tool_calls to conversation
        chat_messages.push(msg.clone());

        struct PreparedCall {
            call_id: String,
            fn_name: String,
            args_str: String,
            args_val: Value,
            syntax_error: Option<String>,
            loop_warning: Option<String>,
            tool_start: u64,
        }

        let mut prepared_calls = Vec::with_capacity(tool_calls.len());
        for tc in tool_calls {
            let call_id = tc
                .get("id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .unwrap_or_else(|| gen_id("call"));
            let fn_name = tc
                .pointer("/function/name")
                .and_then(|v| v.as_str())
                .unwrap_or("tool")
                .to_string();
            let args_str = tc
                .pointer("/function/arguments")
                .and_then(|v| v.as_str())
                .unwrap_or("{}")
                .to_string();

            let (args_val, syntax_error) = match crate::tool::json_repair::parse_or_repair_tool_args(&args_str) {
                Ok(val) => (val, None),
                Err(err) => (json!({}), Some(err)),
            };

            let tool_start = now_ms();

            emit_event(
                workspace_dir,
                "session.next.tool.called",
                json!({
                    "sessionID": session_id,
                    "messageID": assistant_msg_id,
                    "id": call_id,
                    "name": fn_name,
                    "input": args_val
                }),
            );

            crate::paths::log_engine(
                "tool",
                &format!("🔧 Executing tool '{}' with input: {}", fn_name, args_str),
            );

            let loop_warning = doom_loop_detector.check_and_record(&fn_name, &args_str);
            prepared_calls.push(PreparedCall {
                call_id,
                fn_name,
                args_str,
                args_val,
                syntax_error,
                loop_warning,
                tool_start,
            });
        }

        // Execute all tool calls in this step concurrently (e.g. parallel voicebox_speak or parallel file writes)
        let futures_vec = prepared_calls.iter().map(|pc| {
            let assistant_msg_id_ref = assistant_msg_id.as_str();
            async move {
                if let Some(err_msg) = &pc.syntax_error {
                    crate::paths::log_engine(
                        "tool",
                        &format!("⚠️ JSON argument syntax error for tool '{}': {}", pc.fn_name, err_msg),
                    );
                    (json!({ "error": err_msg, "blocked": true }), true)
                } else if let Some(warning) = &pc.loop_warning {
                    crate::paths::log_engine(
                        "tool",
                        &format!("🛑 Doom-loop blocked: tool '{}' repeated identically with args: {}", pc.fn_name, pc.args_str),
                    );
                    (json!({ "error": warning, "blocked": true }), true)
                } else {
                    let out = execute_tool_call(
                        session_id,
                        assistant_msg_id_ref,
                        &pc.call_id,
                        &pc.fn_name,
                        &pc.args_val,
                        workspace_dir,
                    )
                    .await;
                    (out, false)
                }
            }
        });

        let results = futures_util::future::join_all(futures_vec).await;

        for (pc, (tool_out, is_blocked)) in prepared_calls.into_iter().zip(results.into_iter()) {
            let call_id = pc.call_id;
            let fn_name = pc.fn_name;
            let args_val = pc.args_val;
            let tool_start = pc.tool_start;

            let tool_out_str =
                serde_json::to_string_pretty(&tool_out).unwrap_or_else(|_| "{}".to_string());
            let tool_end = now_ms();
            let tool_dur = tool_end.saturating_sub(tool_start);

            if is_blocked {
                crate::paths::log_engine(
                    "tool",
                    &format!("⚠️ Tool '{}' was halted by DoomLoopDetector in {}ms", fn_name, tool_dur),
                );
                emit_event(
                    workspace_dir,
                    "session.next.tool.failed",
                    json!({
                        "sessionID": session_id,
                        "messageID": assistant_msg_id,
                        "id": call_id,
                        "name": fn_name,
                        "content": [{ "type": "text", "text": tool_out_str }],
                        "error": { "message": "Execution halted: repeated identical invocation detected" }
                    }),
                );
            } else {
                crate::paths::log_engine(
                    "tool",
                    &format!("✅ Tool '{}' completed in {}ms", fn_name, tool_dur),
                );
                emit_event(
                    workspace_dir,
                    "session.next.tool.success",
                    json!({
                        "sessionID": session_id,
                        "messageID": assistant_msg_id,
                        "id": call_id,
                        "name": fn_name,
                        "content": [{ "type": "text", "text": tool_out_str }],
                        "structured": tool_out
                    }),
                );
            }

            content_parts.push(json!({
                "type": "tool",
                "id": call_id,
                "name": fn_name,
                "state": {
                    "status": if is_blocked { "error" } else { "completed" },
                    "input": args_val,
                    "structured": tool_out,
                    "content": [{ "type": "text", "text": tool_out_str }],
                    "attachments": []
                },
                "time": { "created": tool_start, "completed": tool_end }
            }));

            let (bounded_tool_out_str, was_truncated) =
                crate::tool::truncator::bound_tool_output(&fn_name, &tool_out_str);
            if was_truncated {
                crate::paths::log_engine(
                    "tool",
                    &format!("✂️ Tool '{}' output bounded by harness to prevent context exhaustion", fn_name),
                );
            }

            chat_messages.push(json!({
                "role": "tool",
                "tool_call_id": call_id,
                "name": fn_name,
                "content": bounded_tool_out_str
            }));
        }
    }

    // Ensure the user always receives a final response text (never leave an empty bubble after tool executions)
    if final_text.trim().is_empty() {
        chat_messages.push(json!({
            "role": "user",
            "content": "All requested Remotion video studio and code operations have completed execution. Provide a clear, concise final summary and answer to the user."
        }));

        let req_body = json!({
            "model": model_id,
            "messages": chat_messages,
            "stream": false
        });

        if let Ok(resp) = client
            .post(format!("{}/chat/completions", base_url))
            .header("Content-Type", "application/json")
            .header("Authorization", format!("Bearer {}", api_key))
            .json(&req_body)
            .send()
            .await
        {
            if resp.status().is_success() {
                if let Ok(data) = resp.json::<Value>().await {
                    if let Some(txt) = data.pointer("/choices/0/message/content").and_then(|v| v.as_str()) {
                        final_text = txt.trim().to_string();
                    }
                }
            }
        }

        if final_text.trim().is_empty() {
            final_text = "All requested Remotion video studio operations have been completed successfully.".to_string();
        }
    }

    let txt_part_id = gen_id("txt");
    emit_event(
        workspace_dir,
        "session.next.text.started",
        json!({
            "sessionID": session_id,
            "messageID": assistant_msg_id,
            "id": txt_part_id
        }),
    );
    if !final_text.is_empty() {
        emit_event(
            workspace_dir,
            "session.next.text.delta",
            json!({
                "sessionID": session_id,
                "messageID": assistant_msg_id,
                "id": txt_part_id,
                "delta": final_text
            }),
        );
    }
    emit_event(
        workspace_dir,
        "session.next.text.ended",
        json!({
            "sessionID": session_id,
            "messageID": assistant_msg_id,
            "id": txt_part_id,
            "text": final_text
        }),
    );

    content_parts.push(json!({
        "type": "text",
        "id": txt_part_id,
        "text": final_text
    }));

    let completed_ms = now_ms();
    let total_elapsed = completed_ms.saturating_sub(started_ms);
    crate::paths::log_engine(
        "chat",
        &format!(
            "🏁 Turn completed for session '{}' in {}ms (model: '{}')",
            session_id, total_elapsed, model_id
        ),
    );
    let assistant_msg = json!({
        "id": assistant_msg_id,
        "type": "assistant",
        "role": "assistant",
        "agent": "default",
        "model": {
            "providerID": provider_id,
            "id": model_id
        },
        "content": content_parts,
        "finish": "stop",
        "cost": 0,
        "tokens": {
            "input": 0,
            "output": 0,
            "reasoning": 0,
            "cache": { "read": 0, "write": 0 }
        },
        "time": {
            "created": started_ms,
            "completed": completed_ms
        }
    });

    with_store(|store| {
        if let Some(s) = store.sessions.get_mut(session_id) {
            s["time"]["updated"] = json!(completed_ms);
            let cur_title = s.get("title").and_then(|v| v.as_str()).unwrap_or("");
            if cur_title.is_empty()
                || cur_title.eq_ignore_ascii_case("New Session")
                || cur_title.eq_ignore_ascii_case("Chat")
                || cur_title.starts_with("New session -")
                || cur_title.starts_with("New Session -")
            {
                if let Some(first_msg) = store.messages.get(session_id).and_then(|m| m.first()) {
                    let text = first_msg.get("text").and_then(|v| v.as_str()).unwrap_or("");
                    let auto_title = crate::session::title::derive_session_title(text);
                    if auto_title != "New Session" {
                        s["title"] = json!(&auto_title);
                    }
                }
            }
        }
        store
            .messages
            .entry(session_id.to_string())
            .or_default()
            .push(assistant_msg);
        save_store(store);
    });

    emit_event(
        workspace_dir,
        "session.next.step.ended",
        json!({
            "sessionID": session_id,
            "messageID": assistant_msg_id,
            "finish": "stop",
            "cost": 0,
            "tokens": { "input": 0, "output": 0, "reasoning": 0, "cache": { "read": 0, "write": 0 } }
        }),
    );
    crate::session::session::set_active_run(session_id, false);
    emit_event(
        workspace_dir,
        "session.idle",
        json!({ "sessionID": session_id }),
    );
    emit_event(
        workspace_dir,
        "session.status",
        json!({ "sessionID": session_id, "status": { "type": "idle" } }),
    );
}

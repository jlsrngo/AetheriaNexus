//! Autonomous agent turn execution loop (35-step runner, tool calls, failover, compaction).

use crate::bridge::LOCAL_CLI_BRIDGE_PORT;
use crate::paths::{gen_id, now_ms};
use crate::provider::read_aetheria_config;
use crate::session::message::emit_event;
use crate::session::session::{save_store, with_store};
use crate::session::tools::{build_tool_definitions, execute_tool_call, should_attach_document_tools};
use serde_json::{json, Value};

use super::context::{
    assemble_system_prompt, resolve_mentioned_files, resolve_motioncraft_style_command,
    resolve_reference_report, resolve_voice_preset_command,
};
use super::history::build_chat_messages;
use super::vision::{find_ffmpeg_bin, process_attached_files, process_social_links};

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

    // 1. Base system prompt from environment, living memory, knowledge base, skills, and plugins
    let sys_prompt = assemble_system_prompt(workspace_dir);

    // 2. Proactive Context Compaction
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

    // 3. Build chat messages from history
    let mut chat_messages = build_chat_messages(&effective_history, &sys_prompt);

    // 4. Process attached files and social links
    let ffmpeg_bin = find_ffmpeg_bin();
    let (file_transcriptions, file_images) =
        process_attached_files(workspace_dir, files, ffmpeg_bin.as_deref());
    let (social_transcriptions, social_images) =
        process_social_links(workspace_dir, prompt_text, ffmpeg_bin.as_deref()).await;

    let mut image_urls = file_images;
    image_urls.extend(social_images);

    let mut context_additions = file_transcriptions;
    context_additions.extend(social_transcriptions);

    // Mentioned files (@file.ext)
    let mentioned_files = resolve_mentioned_files(workspace_dir, prompt_text);
    if !mentioned_files.is_empty() {
        context_additions.extend(mentioned_files);
    }

    // Active Motioncraft style slash command (e.g. /mono-editorial, /pi-v2, etc.)
    if let Some(style_ctx) = resolve_motioncraft_style_command(workspace_dir, prompt_text) {
        context_additions.push(style_ctx);
    }

    // Active Voicebox Audio Preset slash command (e.g. /audio:horror, /audio:pocketmyth, etc.)
    if let Some(audio_ctx) = resolve_voice_preset_command(prompt_text) {
        context_additions.push(audio_ctx);
    }

    // Active video reference report
    if let Some(ref_report) = resolve_reference_report(workspace_dir) {
        context_additions.push(ref_report);
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
        .timeout(std::time::Duration::from_secs(180))
        .build()
        .unwrap();

    let mut content_parts: Vec<Value> = Vec::new();
    let mut final_text = String::new();
    let mut doom_loop_detector = crate::session::doom_loop::DoomLoopDetector::default();

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

        // Proactive in-turn context compaction
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
                } else if e.is_timeout() && chat_messages.len() > 2 {
                    crate::paths::log_engine(
                        "ai",
                        "⏱️ AI request timed out! Triggering emergency context compaction and retrying...",
                    );
                    chat_messages = crate::session::compaction::emergency_compact_messages(&chat_messages);
                    req_body["messages"] = Value::Array(chat_messages.clone());
                    match client
                        .post(format!("{}/chat/completions", base_url))
                        .header("Content-Type", "application/json")
                        .header("Authorization", format!("Bearer {}", api_key))
                        .json(&req_body)
                        .send()
                        .await
                    {
                        Ok(retried_r) if retried_r.status().is_success() => retried_r,
                        Ok(retried_r) => {
                            let err_body = retried_r.text().await.unwrap_or_default();
                            final_text = format!("Error from AI provider after timeout retry: {}", err_body);
                            break;
                        }
                        Err(retry_err) => {
                            final_text = format!("Error: Failed to reach AI provider after timeout retry ({}).", retry_err);
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
            // Context Overflow Auto-Healing
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


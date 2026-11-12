//! Autonomous Agent Turn Execution Loop (Orchestrator).
//! Delegates HTTP recovery (`step_http`), XML recovery (`xml_tool_parser`),
//! parallel tool execution (`tool_batch`), and persistence/synthesis (`turn_finalize`).

use crate::paths::{gen_id, now_ms};
use crate::provider::catalog::resolve_model_cost_tiers;
use crate::provider::read_aetheria_config;
use crate::session::compaction_budget::{
    calculate_ceiling, measure_in_turn_tokens, measure_stored_history_tokens,
    resolve_model_context_limit, should_trigger_background_precompute, total_tokens_from_recorded,
};
use crate::session::compaction_summary::{
    await_pending_precompute, compact_with_budget_ladder, spawn_background_precompute,
    CompactionOutcome,
};
use crate::session::finish_reason::{
    normalize_finish_reason, FinishReason, MAX_LENGTH_CONTINUATION_STREAK,
    OUTPUT_LIMIT_EXHAUSTED_MESSAGE,
};
use crate::session::message::emit_event;
use crate::session::session_error::emit_session_error;
use crate::session::tools::{
    build_tool_definitions, is_greeting_prompt, should_attach_document_tools,
};
use crate::session::usage::{
    cost_to_json, record_step_usage, tokens_to_json, RecordedUsage, TurnUsageAccumulator,
};
use serde_json::{json, Value};

use super::context::{
    assemble_system_prompt, resolve_mentioned_files, resolve_motioncraft_style_command,
    resolve_reference_report, resolve_voice_preset_command,
};
use super::history::build_chat_messages;
use super::step_http::{execute_step_and_stream, StepHttpContext, StepStreamOutcome};
use super::tool_batch::execute_tool_batch;
use super::turn_finalize::{
    finalize_agent_turn, finalize_execution_failure, finalize_failed_turn, finalize_interrupted_turn,
};
use super::vision::{find_ffmpeg_bin, process_attached_files, process_social_links};
use super::xml_tool_parser::extract_xml_tool_calls;

struct ActiveRunGuard<'a>(&'a str);
impl<'a> Drop for ActiveRunGuard<'a> {
    fn drop(&mut self) {
        crate::session::session::set_active_run(self.0, false);
    }
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
    let _run_guard = ActiveRunGuard(session_id);

    crate::session::coordinator::begin_session_turn(session_id);
    crate::session::job_registry::start_job(
        &assistant_msg_id,
        session_id,
        None,
        "turn",
        "Agent Turn",
        false,
    );
    super::resilience::settle_stale_session_state(session_id, workspace_dir);

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

    let sys_prompt = assemble_system_prompt(workspace_dir);
    let (effective_history, was_compacted) = crate::session::compaction::compact_session_history(
        history,
        crate::session::compaction::DEFAULT_CONTEXT_WINDOW,
    );
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

    let mut chat_messages = build_chat_messages(&effective_history, &sys_prompt);
    let ffmpeg_bin = find_ffmpeg_bin();
    let (file_transcriptions, mut image_urls) =
        process_attached_files(workspace_dir, files, ffmpeg_bin.as_deref());
    let (social_transcriptions, social_images) =
        process_social_links(workspace_dir, prompt_text, ffmpeg_bin.as_deref()).await;
    image_urls.extend(social_images);

    let mut context_additions = file_transcriptions;
    context_additions.extend(social_transcriptions);

    let lower_prompt = prompt_text.trim().to_lowercase();
    let is_greeting = is_greeting_prompt(prompt_text);
    if !is_greeting {
        let mentioned_files = resolve_mentioned_files(workspace_dir, prompt_text);
        context_additions.extend(mentioned_files);
        if let Some(style_ctx) = resolve_motioncraft_style_command(workspace_dir, prompt_text) {
            context_additions.push(style_ctx);
        }
        if let Some(audio_ctx) = resolve_voice_preset_command(prompt_text) {
            context_additions.push(audio_ctx);
        }
        if lower_prompt.contains("/ref")
            || lower_prompt.contains("reference")
            || lower_prompt.contains("referensi")
            || lower_prompt.contains("tirukan referensi")
            || lower_prompt.contains("sesuai referensi")
            || lower_prompt.contains("pakai referensi")
        {
            if let Some(ref_report) = resolve_reference_report(workspace_dir) {
                context_additions.push(ref_report);
            }
        }
    }

    let enriched_user_text = if context_additions.is_empty() {
        prompt_text.to_string()
    } else {
        format!("{}\n\n{}", prompt_text, context_additions.join("\n\n"))
    };

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
            user_parts.push(json!({ "type": "image_url", "image_url": { "url": img_url } }));
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

    crate::session::session::with_store(|store| {
        if let Some(sm) = store.sessions.get(session_id).and_then(|s| s.get("model")) {
            if let Some(u) = sm
                .get("baseURL")
                .and_then(|v| v.as_str())
                .map(str::trim)
                .filter(|s| !s.is_empty())
            {
                base_url = u.trim_end_matches('/').to_string();
            }
            if let Some(k) = sm
                .get("apiKey")
                .and_then(|v| v.as_str())
                .map(str::trim)
                .filter(|s| !s.is_empty())
            {
                api_key = k.to_string();
            }
        }
    });

    let tools_def = if should_attach_document_tools(prompt_text, history) {
        build_tool_definitions()
    } else {
        Vec::new()
    };
    let request_timeout_ms = cfg
        .pointer(&format!("/provider/{}/options/timeout", current_provider_id))
        .or_else(|| cfg.pointer(&format!("/providers/{}/options/timeout", current_provider_id)))
        .or_else(|| cfg.pointer(&format!("/providers/{}/settings/timeout", current_provider_id)))
        .and_then(|v| v.as_u64())
        .filter(|&ms| ms >= 50)
        .unwrap_or(180_000);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(request_timeout_ms))
        .build()
        .unwrap_or_default();

    let mut content_parts: Vec<Value> = Vec::new();
    let mut final_text = String::new();
    let mut final_text_streamed = false;
    let mut doom_loop_detector = crate::session::doom_loop::DoomLoopDetector::default();
    let mut length_continuation_count = 0usize;
    let mut unknown_finish_retries = 0usize;
    let mut reached_max_steps = false;
    let mut usage_acc = TurnUsageAccumulator::default();
    let mut last_step_usage: Option<RecordedUsage> = None;
    let mut last_finish = FinishReason::Stop;

    let mut _step = 0usize;
    let model_limit = resolve_model_context_limit(&cfg, &current_provider_id, &current_model_id);
    let ceiling = calculate_ceiling(model_limit.context);
    let compaction_auto = cfg
        .pointer("/compaction/auto")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);
    let background_compaction_enabled = cfg
        .pointer("/experimental/background_compaction")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    await_pending_precompute(session_id).await;
    let (mut cycle_start_tokens, hist_total_tokens) = measure_stored_history_tokens(history);
    if compaction_auto && ceiling != usize::MAX && hist_total_tokens >= ceiling {
        match compact_with_budget_ladder(
            &client,
            &base_url,
            &api_key,
            &current_model_id,
            session_id,
            workspace_dir,
            "auto",
            &mut chat_messages,
        )
        .await
        {
            CompactionOutcome::Succeeded => {
                cycle_start_tokens = 0;
            }
            CompactionOutcome::Interrupted => {
                finalize_interrupted_turn(
                    &current_provider_id,
                    &current_model_id,
                    session_id,
                    workspace_dir,
                    &assistant_msg_id,
                    started_ms,
                    content_parts,
                    &usage_acc,
                    "user",
                );
                return;
            }
            CompactionOutcome::Failed(err) => {
                finalize_failed_turn(
                    &current_provider_id,
                    &current_model_id,
                    session_id,
                    workspace_dir,
                    &assistant_msg_id,
                    started_ms,
                    content_parts,
                    &usage_acc,
                    None,
                    "compaction",
                    &err,
                    false,
                    None,
                );
                return;
            }
        }
    }

    let mut overflow_compacted_this_step = false;
    while _step < 35 {
        if let Some(reason) = crate::session::coordinator::is_session_interrupted(session_id) {
            crate::paths::log_engine(
                "ai",
                &format!(
                    "🛑 Session '{}' turn interrupted ({}) at step {}",
                    session_id,
                    reason,
                    _step + 1
                ),
            );
            finalize_interrupted_turn(
                &current_provider_id,
                &current_model_id,
                session_id,
                workspace_dir,
                &assistant_msg_id,
                started_ms,
                content_parts,
                &usage_acc,
                &reason,
            );
            return;
        }

        for steer in crate::session::coordinator::drain_pending_steers(session_id) {
            super::subagent_store::persist_synthetic_subagent_notice_in_store(
                session_id,
                &steer.text,
            );
            chat_messages.push(json!({
                "role": "user",
                "content": if steer.text.contains("<subagent-notification ") {
                    steer.text
                } else {
                    format!("[Mid-Turn User Steer]: {}", steer.text)
                }
            }));
        }

        emit_event(
            workspace_dir,
            "session.next.step.started",
            json!({
                "sessionID": session_id,
                "messageID": assistant_msg_id,
                "step": _step + 1,
                "label": if is_greeting {
                    "Replying...".to_string()
                } else if _step == 0 {
                    "Analyzing prompt & planning video architecture...".to_string()
                } else {
                    format!("Planning next studio action (step {})...", _step + 1)
                }
            }),
        );

        let total_chars: usize = chat_messages
            .iter()
            .map(|m| {
                m.get("content")
                    .and_then(|v| v.as_str())
                    .map(|s| s.len())
                    .unwrap_or(50)
            })
            .sum();
        if _step > 0
            && compaction_auto
            && ceiling != usize::MAX
            && measure_in_turn_tokens(last_step_usage.as_ref(), &chat_messages) >= ceiling
        {
            match compact_with_budget_ladder(
                &client,
                &base_url,
                &api_key,
                &current_model_id,
                session_id,
                workspace_dir,
                "auto",
                &mut chat_messages,
            )
            .await
            {
                CompactionOutcome::Succeeded => {
                    last_step_usage = None;
                    cycle_start_tokens = 0;
                }
                CompactionOutcome::Interrupted => {
                    finalize_interrupted_turn(
                        &current_provider_id,
                        &current_model_id,
                        session_id,
                        workspace_dir,
                        &assistant_msg_id,
                        started_ms,
                        content_parts,
                        &usage_acc,
                        "user",
                    );
                    return;
                }
                CompactionOutcome::Failed(err) => {
                    finalize_failed_turn(
                        &current_provider_id,
                        &current_model_id,
                        session_id,
                        workspace_dir,
                        &assistant_msg_id,
                        started_ms,
                        content_parts,
                        &usage_acc,
                        None,
                        "compaction",
                        &err,
                        false,
                        None,
                    );
                    return;
                }
            }
        } else if (_step >= 28 && chat_messages.len() > 65)
            || total_chars > 220_000
            || crate::session::compaction::should_compact(
                &chat_messages,
                model_limit.context,
            )
        {
            chat_messages = crate::session::compaction::emergency_compact_messages(&chat_messages);
        }

        let mut http_ctx = StepHttpContext {
            client: &client,
            cfg: &cfg,
            session_id,
            workspace_dir,
            is_local_bridge,
            current_provider_id: &mut current_provider_id,
            current_model_id: &mut current_model_id,
            base_url: &mut base_url,
            api_key: &mut api_key,
            chat_messages: &mut chat_messages,
        };
        let stream_out = match execute_step_and_stream(&mut http_ctx, &tools_def, &assistant_msg_id).await {
            StepStreamOutcome::Completed(out) => out,
            StepStreamOutcome::Aborted(partial_parts) => {
                content_parts.extend(partial_parts);
                finalize_interrupted_turn(
                    &current_provider_id,
                    &current_model_id,
                    session_id,
                    workspace_dir,
                    &assistant_msg_id,
                    started_ms,
                    content_parts,
                    &usage_acc,
                    "user",
                );
                return;
            }
            StepStreamOutcome::Failed(step_err) => {
                if !overflow_compacted_this_step
                    && compaction_auto
                    && step_err.category == "context-overflow"
                {
                    overflow_compacted_this_step = true;
                    match compact_with_budget_ladder(
                        &client,
                        &base_url,
                        &api_key,
                        &current_model_id,
                        session_id,
                        workspace_dir,
                        "auto",
                        &mut chat_messages,
                    )
                    .await
                    {
                        CompactionOutcome::Succeeded => {
                            last_step_usage = None;
                            cycle_start_tokens = 0;
                            continue;
                        }
                        CompactionOutcome::Interrupted => {
                            finalize_interrupted_turn(
                                &current_provider_id,
                                &current_model_id,
                                session_id,
                                workspace_dir,
                                &assistant_msg_id,
                                started_ms,
                                content_parts,
                                &usage_acc,
                                "user",
                            );
                            return;
                        }
                        CompactionOutcome::Failed(_) => {}
                    }
                }
                finalize_failed_turn(
                    &current_provider_id,
                    &current_model_id,
                    session_id,
                    workspace_dir,
                    &assistant_msg_id,
                    started_ms,
                    content_parts,
                    &usage_acc,
                    None,
                    &step_err.category,
                    &step_err.message,
                    step_err.retryable,
                    step_err.status,
                );
                return;
            }
        };

        let mut msg = stream_out.assistant_msg;
        let mut msg_text = stream_out.text;
        let mut msg_reasoning = stream_out.reasoning;
        let mut step_parts = stream_out.content_parts;

        if msg_reasoning.is_empty() {
            if let Some(s_idx) = msg_text.find("<think>") {
                if let Some(e_rel) = msg_text[s_idx + 7..].find("</think>") {
                    let e_idx = s_idx + 7 + e_rel;
                    let inline_thought = msg_text[s_idx + 7..e_idx].trim();
                    if !inline_thought.is_empty() {
                        msg_reasoning.push_str(inline_thought);
                        let r_part_id = gen_id("rsn");
                        emit_event(
                            workspace_dir,
                            "session.next.reasoning.ended",
                            json!({ "sessionID": session_id, "messageID": assistant_msg_id, "id": r_part_id, "text": msg_reasoning }),
                        );
                        step_parts.insert(
                            0,
                            json!({
                                "type": "reasoning",
                                "id": r_part_id,
                                "text": msg_reasoning,
                            }),
                        );
                    }
                    msg_text = format!("{}{}", &msg_text[..s_idx], &msg_text[e_idx + 8..])
                        .trim()
                        .to_string();
                    msg["content"] = Value::String(msg_text.clone());
                }
            }
        }

        let mut tool_calls = stream_out.tool_calls;
        if tool_calls.is_empty() && msg_text.contains("<invoke ") {
            tool_calls = extract_xml_tool_calls(&mut msg_text);
            msg["content"] = Value::String(msg_text.clone());
            if !tool_calls.is_empty() {
                msg["tool_calls"] = Value::Array(tool_calls.clone());
            }
        }

        let step_finish = normalize_finish_reason(stream_out.raw_finish.as_deref(), !tool_calls.is_empty());

        if step_finish == FinishReason::ContentFilter {
            content_parts.extend(step_parts);
            finalize_failed_turn(
                &current_provider_id,
                &current_model_id,
                session_id,
                workspace_dir,
                &assistant_msg_id,
                started_ms,
                content_parts,
                &usage_acc,
                Some(FinishReason::ContentFilter),
                "provider.content-filter",
                "Provider blocked the response due to content policy.",
                false,
                None,
            );
            return;
        }

        if step_finish == FinishReason::Unknown {
            content_parts.extend(step_parts);
            if unknown_finish_retries < 3 {
                unknown_finish_retries += 1;
                emit_session_error(
                    workspace_dir,
                    session_id,
                    &assistant_msg_id,
                    "provider.invalid-output",
                    "The provider response ended with an unknown finish reason.",
                    true,
                    None,
                );
                emit_event(
                    workspace_dir,
                    "session.retry.scheduled",
                    json!({
                        "sessionID": session_id,
                        "attempt": unknown_finish_retries + 1,
                        "delayMs": 100,
                        "reason": "unknown finish reason"
                    }),
                );
                tokio::time::sleep(std::time::Duration::from_millis(100)).await;
                continue;
            }
            finalize_failed_turn(
                &current_provider_id,
                &current_model_id,
                session_id,
                workspace_dir,
                &assistant_msg_id,
                started_ms,
                content_parts,
                &usage_acc,
                Some(FinishReason::Unknown),
                "provider.invalid-output",
                "The provider response ended with an unknown finish reason.",
                false,
                None,
            );
            return;
        }
        unknown_finish_retries = 0;

        let cost_tiers = resolve_model_cost_tiers(&cfg, &current_provider_id, &current_model_id);
        let step_usage = record_step_usage(stream_out.usage.as_ref(), &cost_tiers);
        usage_acc.record_step(step_usage);
        last_step_usage = step_usage;
        last_finish = step_finish;
        overflow_compacted_this_step = false;

        if background_compaction_enabled && compaction_auto {
            if let Some(total_step_tokens) =
                step_usage.as_ref().and_then(total_tokens_from_recorded)
            {
                if should_trigger_background_precompute(total_step_tokens, cycle_start_tokens, ceiling)
                {
                    let mut bg_msgs = chat_messages.clone();
                    bg_msgs.push(msg.clone());
                    spawn_background_precompute(
                        client.clone(),
                        base_url.clone(),
                        api_key.clone(),
                        current_model_id.clone(),
                        session_id.to_string(),
                        bg_msgs,
                    );
                }
            }
        }

        let had_streamed_text = step_parts
            .iter()
            .any(|p| p.get("type").and_then(|v| v.as_str()) == Some("text"));
        content_parts.extend(step_parts);

        if tool_calls.is_empty() {
            if step_finish == FinishReason::Length {
                length_continuation_count += 1;
                let exhausted = length_continuation_count >= MAX_LENGTH_CONTINUATION_STREAK;
                emit_event(
                    workspace_dir,
                    "session.next.step.ended",
                    json!({
                        "sessionID": session_id,
                        "messageID": assistant_msg_id,
                        "finish": step_finish.as_str(),
                        "continuing": !exhausted,
                        "cost": cost_to_json(step_usage.as_ref()),
                        "tokens": tokens_to_json(step_usage.as_ref()),
                    }),
                );
                if exhausted {
                    finalize_execution_failure(
                        &current_provider_id,
                        &current_model_id,
                        session_id,
                        workspace_dir,
                        &assistant_msg_id,
                        started_ms,
                        content_parts,
                        &usage_acc,
                        Some(FinishReason::Length),
                        "output-limit",
                        OUTPUT_LIMIT_EXHAUSTED_MESSAGE,
                    );
                    return;
                }
                chat_messages.push(msg.clone());
                chat_messages.push(json!({
                    "role": "user",
                    "content": super::resilience::SYNTHETIC_OUTPUT_LIMIT_PROMPT
                }));
                _step += 1;
                continue;
            }

            length_continuation_count = 0;
            let pending_steers = crate::session::coordinator::drain_pending_steers(session_id);
            if !pending_steers.is_empty() {
                emit_event(
                    workspace_dir,
                    "session.next.step.ended",
                    json!({
                        "sessionID": session_id,
                        "messageID": assistant_msg_id,
                        "finish": step_finish.as_str(),
                        "continuing": true,
                        "cost": cost_to_json(step_usage.as_ref()),
                        "tokens": tokens_to_json(step_usage.as_ref()),
                    }),
                );
                chat_messages.push(msg.clone());
                let combined = pending_steers
                    .into_iter()
                    .map(|s| s.text)
                    .collect::<Vec<_>>()
                    .join("\n\n");
                super::subagent_store::persist_synthetic_subagent_notice_in_store(
                    session_id,
                    &combined,
                );
                chat_messages.push(json!({ "role": "user", "content": combined }));
                _step += 1;
                continue;
            }
            if let Some(next_queued) =
                crate::session::coordinator::pop_next_queued_input(session_id)
            {
                emit_event(
                    workspace_dir,
                    "session.next.step.ended",
                    json!({
                        "sessionID": session_id,
                        "messageID": assistant_msg_id,
                        "finish": step_finish.as_str(),
                        "continuing": true,
                        "cost": cost_to_json(step_usage.as_ref()),
                        "tokens": tokens_to_json(step_usage.as_ref()),
                    }),
                );
                chat_messages.push(msg.clone());
                chat_messages.push(json!({ "role": "user", "content": next_queued.text }));
                _step += 1;
                continue;
            }
            final_text = msg_text;
            final_text_streamed = had_streamed_text;
            last_step_usage = step_usage;
            last_finish = step_finish;
            break;
        }

        length_continuation_count = 0;
        chat_messages.push(msg.clone());
        execute_tool_batch(
            session_id,
            workspace_dir,
            &assistant_msg_id,
            tool_calls,
            &mut doom_loop_detector,
            &mut content_parts,
            &mut chat_messages,
        )
        .await;

        emit_event(
            workspace_dir,
            "session.next.step.ended",
            json!({
                "sessionID": session_id,
                "messageID": assistant_msg_id,
                "finish": step_finish.as_str(),
                "cost": cost_to_json(step_usage.as_ref()),
                "tokens": tokens_to_json(step_usage.as_ref()),
            }),
        );

        if _step == 34 {
            reached_max_steps = true;
        }
        _step += 1;
    }

    finalize_agent_turn(
        &client,
        &base_url,
        &api_key,
        &current_provider_id,
        &current_model_id,
        session_id,
        workspace_dir,
        &assistant_msg_id,
        started_ms,
        reached_max_steps,
        final_text_streamed,
        final_text,
        content_parts,
        &mut chat_messages,
        &mut usage_acc,
        last_step_usage,
        last_finish,
    )
    .await;
}

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

struct TurnConnection {
    is_local_bridge: bool,
    base_url: String,
    api_key: String,
    client: reqwest::Client,
}

struct TurnTarget<'a> {
    session_id: &'a str,
    workspace_dir: &'a str,
    assistant_msg_id: &'a str,
    started_ms: u64,
}

struct TurnEndpoint<'a> {
    client: &'a reqwest::Client,
    base_url: &'a str,
    api_key: &'a str,
    provider_id: &'a str,
    model_id: &'a str,
}

#[derive(Clone, Copy)]
struct CompactionPolicy {
    auto_enabled: bool,
    background_enabled: bool,
    ceiling: usize,
    context_limit: usize,
}

enum NoToolCallAction {
    Continue,
    Break {
        final_text: String,
        final_text_streamed: bool,
    },
    AlreadyFinalized,
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

    let cfg = read_aetheria_config();
    let (mut chat_messages, is_greeting) = prepare_initial_chat_messages(
        session_id,
        workspace_dir,
        history,
        prompt_text,
        files,
        provider_id,
        model_id,
        &cfg,
    )
    .await;

    let mut current_provider_id = provider_id.to_string();
    let mut current_model_id = model_id.to_string();
    let TurnConnection {
        is_local_bridge,
        mut base_url,
        mut api_key,
        client,
    } = resolve_provider_connection(session_id, provider_id, &current_provider_id, &cfg).await;

    let tools_def = if should_attach_document_tools(prompt_text, history) {
        build_tool_definitions()
    } else {
        Vec::new()
    };

    let target = TurnTarget {
        session_id,
        workspace_dir,
        assistant_msg_id: &assistant_msg_id,
        started_ms,
    };

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

    let model_limit = resolve_model_context_limit(&cfg, &current_provider_id, &current_model_id);
    let policy = CompactionPolicy {
        auto_enabled: cfg
            .pointer("/compaction/auto")
            .and_then(|v| v.as_bool())
            .unwrap_or(true),
        background_enabled: cfg
            .pointer("/experimental/background_compaction")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        ceiling: calculate_ceiling(model_limit.context),
        context_limit: model_limit.context,
    };

    await_pending_precompute(session_id).await;
    let (mut cycle_start_tokens, hist_total_tokens) = measure_stored_history_tokens(history);
    if policy.auto_enabled && policy.ceiling != usize::MAX && hist_total_tokens >= policy.ceiling {
        let ep = TurnEndpoint {
            client: &client,
            base_url: &base_url,
            api_key: &api_key,
            provider_id: &current_provider_id,
            model_id: &current_model_id,
        };
        if !run_auto_compaction_or_finalize(
            &target,
            &ep,
            &mut content_parts,
            &usage_acc,
            &mut chat_messages,
        )
        .await
        {
            return;
        }
        cycle_start_tokens = 0;
    }

    let (configured_steps, max_loop_steps) =
        mark_active_turn_and_resolve_steps(session_id, workspace_dir, started_ms, &cfg);
    let mut step = 0usize;
    let mut overflow_compacted_this_step = false;

    while step < max_loop_steps {
        let step_limit_reached = configured_steps.map(|limit| step + 1 >= limit).unwrap_or(false);
        if let Some(reason) = crate::session::coordinator::is_session_interrupted(session_id) {
            crate::paths::log_engine(
                "ai",
                &format!(
                    "🛑 Session '{}' turn interrupted ({}) at step {}",
                    session_id,
                    reason,
                    step + 1
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

        inject_pending_steers(
            session_id,
            workspace_dir,
            &current_provider_id,
            &current_model_id,
            &cfg,
            &mut chat_messages,
        );
        emit_step_started_event(&target, step, is_greeting);

        {
            let ep = TurnEndpoint {
                client: &client,
                base_url: &base_url,
                api_key: &api_key,
                provider_id: &current_provider_id,
                model_id: &current_model_id,
            };
            if !maybe_compact_in_turn(
                step,
                policy,
                &target,
                &ep,
                &mut content_parts,
                &usage_acc,
                &mut chat_messages,
                &mut last_step_usage,
                &mut cycle_start_tokens,
            )
            .await
            {
                return;
            }
        }

        let mut http_ctx = StepHttpContext {
            client: &client,
            cfg: &cfg,
            session_id,
            workspace_dir,
            is_local_bridge,
            step_limit_reached,
            current_provider_id: &mut current_provider_id,
            current_model_id: &mut current_model_id,
            base_url: &mut base_url,
            api_key: &mut api_key,
            chat_messages: &mut chat_messages,
        };
        let stream_out =
            match execute_step_and_stream(&mut http_ctx, &tools_def, &assistant_msg_id).await {
                StepStreamOutcome::Completed(out) => out,
                StepStreamOutcome::Aborted {
                    partial_parts,
                    during_stream,
                } => {
                    content_parts.extend(partial_parts);
                    if during_stream {
                        emit_session_error(
                            workspace_dir,
                            session_id,
                            &assistant_msg_id,
                            "aborted",
                            "Execution aborted by user.",
                            false,
                            None,
                        );
                    }
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
                        && policy.auto_enabled
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

        let (msg, msg_text, mut step_parts, tool_calls) = extract_inline_think_and_xml(
            &target,
            stream_out.assistant_msg,
            stream_out.text,
            stream_out.reasoning,
            stream_out.content_parts,
            stream_out.tool_calls,
        );
        let step_finish =
            normalize_finish_reason(stream_out.raw_finish.as_deref(), !tool_calls.is_empty());

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
                emit_unknown_finish_retry(&target, unknown_finish_retries).await;
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

        {
            let ep = TurnEndpoint {
                client: &client,
                base_url: &base_url,
                api_key: &api_key,
                provider_id: &current_provider_id,
                model_id: &current_model_id,
            };
            maybe_spawn_background_precompute(
                policy,
                step_usage.as_ref(),
                cycle_start_tokens,
                &target,
                &ep,
                &chat_messages,
                &msg,
            );
        }

        let had_streamed_text = step_parts
            .iter()
            .any(|p| p.get("type").and_then(|v| v.as_str()) == Some("text"));
        content_parts.append(&mut step_parts);

        if tool_calls.is_empty() {
            match handle_no_tool_calls(
                &target,
                &current_provider_id,
                &current_model_id,
                &cfg,
                step_finish,
                step_usage.as_ref(),
                msg_text,
                had_streamed_text,
                &msg,
                &mut length_continuation_count,
                &mut content_parts,
                &mut chat_messages,
                &usage_acc,
            ) {
                NoToolCallAction::Continue => {
                    step += 1;
                    continue;
                }
                NoToolCallAction::Break {
                    final_text: text,
                    final_text_streamed: streamed,
                } => {
                    final_text = text;
                    final_text_streamed = streamed;
                    break;
                }
                NoToolCallAction::AlreadyFinalized => return,
            }
        }

        length_continuation_count = 0;
        super::turn_finalize::persist_tool_checkpoint(
            session_id,
            &assistant_msg_id,
            &current_provider_id,
            &current_model_id,
            started_ms,
            &tool_calls,
        );
        chat_messages.push(msg);
        let step_vision_enabled =
            model_supports_vision_from_config(Some(&cfg), &current_provider_id, &current_model_id);
        let was_interrupted = execute_tool_batch(
            session_id,
            workspace_dir,
            &assistant_msg_id,
            tool_calls,
            step_limit_reached,
            step_vision_enabled,
            &mut doom_loop_detector,
            &mut content_parts,
            &mut chat_messages,
        )
        .await;

        if was_interrupted {
            emit_session_error(
                workspace_dir,
                session_id,
                &assistant_msg_id,
                "aborted",
                "Tool execution aborted by user.",
                false,
                None,
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
                "user",
            );
            return;
        }

        super::turn_finalize::settle_completed_tool_checkpoint(
            session_id,
            &assistant_msg_id,
            &current_provider_id,
            &current_model_id,
            started_ms,
            &content_parts,
        );

        emit_step_ended_event(&target, step_finish, None, step_usage.as_ref());

        if step_limit_reached {
            reached_max_steps = true;
            final_text = "Maximum agent steps reached; tool execution disabled.".to_string();
            final_text_streamed = true;
            break;
        }

        if step + 1 == max_loop_steps {
            reached_max_steps = true;
        }
        step += 1;
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

async fn prepare_initial_chat_messages(
    session_id: &str,
    workspace_dir: &str,
    history: &[Value],
    prompt_text: &str,
    files: Option<&Value>,
    provider_id: &str,
    model_id: &str,
    cfg: &Value,
) -> (Vec<Value>, bool) {
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
    let (social_transcriptions, social_images) =
        process_social_links(workspace_dir, prompt_text, ffmpeg_bin.as_deref()).await;

    let mut extra_context = social_transcriptions;
    let lower_prompt = prompt_text.trim().to_lowercase();
    let is_greeting = is_greeting_prompt(prompt_text);
    if !is_greeting {
        extra_context.extend(resolve_mentioned_files(workspace_dir, prompt_text));
        if let Some(style_ctx) = resolve_motioncraft_style_command(workspace_dir, prompt_text) {
            extra_context.push(style_ctx);
        }
        if let Some(audio_ctx) = resolve_voice_preset_command(prompt_text) {
            extra_context.push(audio_ctx);
        }
        if lower_prompt.contains("/ref")
            || lower_prompt.contains("reference")
            || lower_prompt.contains("referensi")
            || lower_prompt.contains("tirukan referensi")
            || lower_prompt.contains("sesuai referensi")
            || lower_prompt.contains("pakai referensi")
        {
            if let Some(ref_report) = resolve_reference_report(workspace_dir) {
                extra_context.push(ref_report);
            }
        }
    }

    let user_msg = build_user_message_with_attachments(
        workspace_dir,
        provider_id,
        model_id,
        cfg,
        prompt_text,
        files,
        ffmpeg_bin.as_deref(),
        extra_context,
        social_images,
    );
    chat_messages.push(user_msg);

    (chat_messages, is_greeting)
}

fn build_user_message_with_attachments(
    workspace_dir: &str,
    provider_id: &str,
    model_id: &str,
    cfg: &Value,
    prompt_text: &str,
    files: Option<&Value>,
    ffmpeg_bin: Option<&std::path::Path>,
    extra_context: Vec<String>,
    extra_image_urls: Vec<String>,
) -> Value {
    let (file_transcriptions, mut image_urls) =
        process_attached_files(workspace_dir, files, ffmpeg_bin);
    image_urls.extend(extra_image_urls);
    let mut context_additions = file_transcriptions;
    context_additions.extend(extra_context);

    let model_supports_vision = model_supports_vision_from_config(Some(cfg), provider_id, model_id);

    if !image_urls.is_empty() && !model_supports_vision {
        context_additions.push(format!(
            "[SYSTEM NOTICE: Active model '{model_id}' is text-only and CANNOT inspect image pixels directly. Do NOT call `read` on binary image files in ref/ (they are not UTF-8 text). Tell the user clearly that '{model_id}' does not support image/vision analysis, and ask them to switch to a vision-capable model (e.g. Gemini, Claude, GPT-4o/5, GLM-4.6V, Kimi, Qwen-VL) or describe the desired visual style in text.]"
        ));
    }

    let enriched_user_text = if context_additions.is_empty() {
        prompt_text.to_string()
    } else {
        format!("{}\n\n{}", prompt_text, context_additions.join("\n\n"))
    };

    if !image_urls.is_empty() && model_supports_vision {
        let mut user_parts = vec![json!({ "type": "text", "text": enriched_user_text })];
        for img_url in &image_urls {
            user_parts.push(json!({ "type": "image_url", "image_url": { "url": img_url } }));
        }
        json!({ "role": "user", "content": user_parts })
    } else {
        json!({ "role": "user", "content": enriched_user_text })
    }
}

fn find_model_config<'a>(cfg: &'a Value, provider_id: &str, model_id: &str) -> Option<&'a Value> {
    if !provider_id.is_empty() {
        if let Some(m) = cfg
            .pointer("/provider")
            .and_then(|p| p.get(provider_id))
            .and_then(|p| p.get("models"))
            .and_then(|ms| ms.get(model_id))
        {
            return Some(m);
        }
    }
    cfg.pointer("/provider")
        .and_then(|p| p.as_object())
        .and_then(|providers| {
            providers.values().find_map(|p| {
                p.get("models")
                    .and_then(|ms| ms.get(model_id))
            })
        })
}

pub(crate) fn model_supports_vision_from_config(
    cfg: Option<&Value>,
    provider_id: &str,
    model_id: &str,
) -> bool {
    if let Some(model_cfg) = cfg.and_then(|c| find_model_config(c, provider_id, model_id)) {
        if let Some(v) = model_cfg
            .get("vision")
            .or_else(|| model_cfg.pointer("/capabilities/vision"))
            .or_else(|| model_cfg.pointer("/capabilities/image"))
            .and_then(|v| v.as_bool())
        {
            return v;
        }
        if let Some(inputs) = model_cfg
            .pointer("/modalities/input")
            .or_else(|| model_cfg.get("input"))
            .and_then(|v| v.as_array())
        {
            return inputs
                .iter()
                .filter_map(|v| v.as_str())
                .any(|m| m.eq_ignore_ascii_case("image"));
        }
    }

    let lower = model_id.trim().to_ascii_lowercase();
    let has_openai_reasoning_vision = ["o1", "o3", "o4"].iter().any(|prefix| {
        lower == *prefix
            || lower.starts_with(&format!("{prefix}-"))
            || lower.contains(&format!("/{prefix}-"))
            || lower.ends_with(&format!("/{prefix}"))
    });

    lower.contains("vl")
        || lower.contains("vision")
        || lower.contains("gemini")
        || lower.contains("claude")
        || lower.contains("gpt-4")
        || lower.contains("gpt-5")
        || lower.contains("4o")
        || lower.contains("glm-4v")
        || lower.contains("glm-4.5v")
        || lower.contains("glm-4.6v")
        || lower.contains("glm-5v")
        || lower.contains("kimi")
        || lower.contains("pixtral")
        || lower.contains("llava")
        || lower.contains("qvq")
        || lower.contains("minicpm-v")
        || has_openai_reasoning_vision
}

async fn resolve_provider_connection(
    session_id: &str,
    provider_id: &str,
    current_provider_id: &str,
    cfg: &Value,
) -> TurnConnection {
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

    TurnConnection {
        is_local_bridge,
        base_url,
        api_key,
        client,
    }
}

fn mark_active_turn_and_resolve_steps(
    session_id: &str,
    workspace_dir: &str,
    started_ms: u64,
    cfg: &Value,
) -> (Option<usize>, usize) {
    let session_agent_id = crate::session::session::with_store(|s| {
        if let Some(sess) = s.sessions.get_mut(session_id) {
            sess["activeTurn"] = json!({
                "workspaceDir": workspace_dir,
                "startedAt": started_ms,
            });
            crate::session::session::save_store(s);
        }
        s.sessions
            .get(session_id)
            .and_then(|sess| sess.get("agent"))
            .and_then(|v| v.as_str())
            .map(str::to_string)
    });
    let configured_steps = session_agent_id.as_deref().and_then(|agent_id| {
        cfg.pointer(&format!("/agent/{}/steps", agent_id))
            .or_else(|| cfg.pointer(&format!("/agent/{}/maxSteps", agent_id)))
            .or_else(|| cfg.pointer(&format!("/agent/{}/max_steps", agent_id)))
            .and_then(|v| v.as_u64())
            .map(|n| n.max(1) as usize)
    });
    let max_loop_steps = configured_steps.unwrap_or(51);
    (configured_steps, max_loop_steps)
}

async fn run_auto_compaction_or_finalize(
    target: &TurnTarget<'_>,
    ep: &TurnEndpoint<'_>,
    content_parts: &mut Vec<Value>,
    usage_acc: &TurnUsageAccumulator,
    chat_messages: &mut Vec<Value>,
) -> bool {
    match compact_with_budget_ladder(
        ep.client,
        ep.base_url,
        ep.api_key,
        ep.model_id,
        target.session_id,
        target.workspace_dir,
        "auto",
        chat_messages,
    )
    .await
    {
        CompactionOutcome::Succeeded => true,
        CompactionOutcome::Interrupted => {
            finalize_interrupted_turn(
                ep.provider_id,
                ep.model_id,
                target.session_id,
                target.workspace_dir,
                target.assistant_msg_id,
                target.started_ms,
                std::mem::take(content_parts),
                usage_acc,
                "user",
            );
            false
        }
        CompactionOutcome::Failed(err) => {
            finalize_failed_turn(
                ep.provider_id,
                ep.model_id,
                target.session_id,
                target.workspace_dir,
                target.assistant_msg_id,
                target.started_ms,
                std::mem::take(content_parts),
                usage_acc,
                None,
                "compaction",
                &err,
                false,
                None,
            );
            false
        }
    }
}

async fn maybe_compact_in_turn(
    step: usize,
    policy: CompactionPolicy,
    target: &TurnTarget<'_>,
    ep: &TurnEndpoint<'_>,
    content_parts: &mut Vec<Value>,
    usage_acc: &TurnUsageAccumulator,
    chat_messages: &mut Vec<Value>,
    last_usage_slot: &mut Option<RecordedUsage>,
    cycle_start_tokens: &mut usize,
) -> bool {
    let total_chars: usize = chat_messages
        .iter()
        .map(|m| {
            m.get("content")
                .and_then(|v| v.as_str())
                .map(|s| s.len())
                .unwrap_or(50)
        })
        .sum();
    if step > 0
        && policy.auto_enabled
        && policy.ceiling != usize::MAX
        && measure_in_turn_tokens(last_usage_slot.as_ref(), chat_messages) >= policy.ceiling
    {
        if !run_auto_compaction_or_finalize(target, ep, content_parts, usage_acc, chat_messages)
            .await
        {
            return false;
        }
        *last_usage_slot = None;
        *cycle_start_tokens = 0;
    } else if (step >= 28 && chat_messages.len() > 65)
        || total_chars > 220_000
        || crate::session::compaction::should_compact(chat_messages, policy.context_limit)
    {
        *chat_messages = crate::session::compaction::emergency_compact_messages(chat_messages);
    }
    true
}

fn push_steer_items_to_chat(
    session_id: &str,
    workspace_dir: &str,
    provider_id: &str,
    model_id: &str,
    cfg: &Value,
    steers: Vec<crate::session::coordinator::InboxItem>,
    chat_messages: &mut Vec<Value>,
) {
    let ffmpeg_bin = find_ffmpeg_bin();
    for steer in steers {
        super::subagent_store::persist_synthetic_subagent_notice_in_store(session_id, &steer.text);
        if steer.text.contains("<subagent-notification ") && steer.files.is_none() {
            chat_messages.push(json!({
                "role": "user",
                "content": steer.text
            }));
            continue;
        }
        let formatted_text = if steer.text.contains("<subagent-notification ") {
            steer.text
        } else {
            format!("[Mid-Turn User Steer]: {}", steer.text)
        };
        let files_val = steer.files.map(Value::Array);
        let msg = build_user_message_with_attachments(
            workspace_dir,
            provider_id,
            model_id,
            cfg,
            &formatted_text,
            files_val.as_ref(),
            ffmpeg_bin.as_deref(),
            Vec::new(),
            Vec::new(),
        );
        chat_messages.push(msg);
    }
}

fn inject_pending_steers(
    session_id: &str,
    workspace_dir: &str,
    provider_id: &str,
    model_id: &str,
    cfg: &Value,
    chat_messages: &mut Vec<Value>,
) {
    let steers = crate::session::coordinator::drain_pending_steers(session_id);
    if !steers.is_empty() {
        push_steer_items_to_chat(
            session_id,
            workspace_dir,
            provider_id,
            model_id,
            cfg,
            steers,
            chat_messages,
        );
    }
}

fn emit_step_started_event(
    target: &TurnTarget<'_>,
    step: usize,
    is_greeting: bool,
) {
    emit_event(
        target.workspace_dir,
        "session.next.step.started",
        json!({
            "sessionID": target.session_id,
            "messageID": target.assistant_msg_id,
            "step": step + 1,
            "label": if is_greeting {
                "Replying...".to_string()
            } else if step == 0 {
                "Analyzing prompt & planning video architecture...".to_string()
            } else {
                format!("Planning next studio action (step {})...", step + 1)
            }
        }),
    );
}

fn emit_step_ended_event(
    target: &TurnTarget<'_>,
    finish: FinishReason,
    continuing: Option<bool>,
    step_usage: Option<&RecordedUsage>,
) {
    let mut payload = json!({
        "sessionID": target.session_id,
        "messageID": target.assistant_msg_id,
        "finish": finish.as_str(),
        "cost": cost_to_json(step_usage),
        "tokens": tokens_to_json(step_usage),
    });
    if let Some(cont) = continuing {
        payload["continuing"] = json!(cont);
    }
    emit_event(target.workspace_dir, "session.next.step.ended", payload);
}

fn extract_inline_think_and_xml(
    target: &TurnTarget<'_>,
    mut msg: Value,
    mut msg_text: String,
    mut msg_reasoning: String,
    mut step_parts: Vec<Value>,
    mut tool_calls: Vec<Value>,
) -> (Value, String, Vec<Value>, Vec<Value>) {
    if msg_reasoning.is_empty() {
        if let Some(s_idx) = msg_text.find("<think>") {
            if let Some(e_rel) = msg_text[s_idx + 7..].find("</think>") {
                let e_idx = s_idx + 7 + e_rel;
                let inline_thought = msg_text[s_idx + 7..e_idx].trim();
                if !inline_thought.is_empty() {
                    msg_reasoning.push_str(inline_thought);
                    let r_part_id = gen_id("rsn");
                    emit_event(
                        target.workspace_dir,
                        "session.next.reasoning.ended",
                        json!({
                            "sessionID": target.session_id,
                            "messageID": target.assistant_msg_id,
                            "id": r_part_id,
                            "text": msg_reasoning,
                        }),
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

    if tool_calls.is_empty() && msg_text.contains("<invoke ") {
        tool_calls = extract_xml_tool_calls(&mut msg_text);
        msg["content"] = Value::String(msg_text.clone());
        if !tool_calls.is_empty() {
            msg["tool_calls"] = Value::Array(tool_calls.clone());
        }
    }

    (msg, msg_text, step_parts, tool_calls)
}

async fn emit_unknown_finish_retry(
    target: &TurnTarget<'_>,
    unknown_finish_retries: usize,
) {
    emit_session_error(
        target.workspace_dir,
        target.session_id,
        target.assistant_msg_id,
        "provider.invalid-output",
        "The provider response ended with an unknown finish reason.",
        true,
        None,
    );
    emit_event(
        target.workspace_dir,
        "session.retry.scheduled",
        json!({
            "sessionID": target.session_id,
            "attempt": unknown_finish_retries + 1,
            "delayMs": 100,
            "reason": "unknown finish reason"
        }),
    );
    tokio::time::sleep(std::time::Duration::from_millis(100)).await;
}

fn maybe_spawn_background_precompute(
    policy: CompactionPolicy,
    step_usage: Option<&RecordedUsage>,
    cycle_start_tokens: usize,
    target: &TurnTarget<'_>,
    ep: &TurnEndpoint<'_>,
    chat_messages: &[Value],
    msg: &Value,
) {
    if !(policy.background_enabled && policy.auto_enabled) {
        return;
    }
    if let Some(total_step_tokens) = step_usage.and_then(total_tokens_from_recorded) {
        if should_trigger_background_precompute(total_step_tokens, cycle_start_tokens, policy.ceiling)
        {
            let mut bg_msgs = chat_messages.to_vec();
            bg_msgs.push(msg.clone());
            spawn_background_precompute(
                ep.client.clone(),
                ep.base_url.to_string(),
                ep.api_key.to_string(),
                ep.model_id.to_string(),
                target.session_id.to_string(),
                bg_msgs,
            );
        }
    }
}

fn handle_no_tool_calls(
    target: &TurnTarget<'_>,
    provider_id: &str,
    model_id: &str,
    cfg: &Value,
    step_finish: FinishReason,
    step_usage: Option<&RecordedUsage>,
    msg_text: String,
    had_streamed_text: bool,
    msg: &Value,
    length_continuation_count: &mut usize,
    content_parts: &mut Vec<Value>,
    chat_messages: &mut Vec<Value>,
    usage_acc: &TurnUsageAccumulator,
) -> NoToolCallAction {
    if step_finish == FinishReason::Length {
        *length_continuation_count += 1;
        let exhausted = *length_continuation_count >= MAX_LENGTH_CONTINUATION_STREAK;
        emit_step_ended_event(target, step_finish, Some(!exhausted), step_usage);
        if exhausted {
            finalize_execution_failure(
                provider_id,
                model_id,
                target.session_id,
                target.workspace_dir,
                target.assistant_msg_id,
                target.started_ms,
                std::mem::take(content_parts),
                usage_acc,
                Some(FinishReason::Length),
                "output-limit",
                OUTPUT_LIMIT_EXHAUSTED_MESSAGE,
            );
            return NoToolCallAction::AlreadyFinalized;
        }
        chat_messages.push(msg.clone());
        chat_messages.push(json!({
            "role": "user",
            "content": super::resilience::SYNTHETIC_OUTPUT_LIMIT_PROMPT
        }));
        return NoToolCallAction::Continue;
    }

    *length_continuation_count = 0;
    let pending_steers = crate::session::coordinator::drain_pending_steers(target.session_id);
    if !pending_steers.is_empty() {
        emit_step_ended_event(target, step_finish, Some(true), step_usage);
        chat_messages.push(msg.clone());
        push_steer_items_to_chat(
            target.session_id,
            target.workspace_dir,
            provider_id,
            model_id,
            cfg,
            pending_steers,
            chat_messages,
        );
        return NoToolCallAction::Continue;
    }

    if let Some(next_queued) = crate::session::coordinator::pop_next_queued_input(target.session_id)
    {
        emit_step_ended_event(target, step_finish, Some(true), step_usage);
        chat_messages.push(msg.clone());
        let files_val = next_queued.files.map(Value::Array);
        let ffmpeg_bin = find_ffmpeg_bin();
        let next_msg = build_user_message_with_attachments(
            target.workspace_dir,
            provider_id,
            model_id,
            cfg,
            &next_queued.text,
            files_val.as_ref(),
            ffmpeg_bin.as_deref(),
            Vec::new(),
            Vec::new(),
        );
        chat_messages.push(next_msg);
        return NoToolCallAction::Continue;
    }

    NoToolCallAction::Break {
        final_text: msg_text,
        final_text_streamed: had_streamed_text,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recognizes_vision_and_text_only_models_accurately() {
        assert!(!model_supports_vision_from_config(
            None,
            "kenari-cloud",
            "glm-4-7-flash:free"
        ));
        assert!(!model_supports_vision_from_config(
            None,
            "kenari-cloud",
            "llama-3-3-70b-instruct:free"
        ));
        assert!(model_supports_vision_from_config(
            None,
            "google",
            "gemini-2.5-flash"
        ));
        assert!(model_supports_vision_from_config(
            None,
            "zai",
            "GLM-4.6V"
        ));
        assert!(model_supports_vision_from_config(
            None,
            "openai",
            "gpt-5"
        ));
        assert!(model_supports_vision_from_config(
            None,
            "moonshot",
            "kimi-k2.5"
        ));
    }

    #[test]
    fn config_modalities_and_vision_flag_override_heuristics() {
        let cfg = json!({
            "provider": {
                "custom": {
                    "models": {
                        "custom-multimodal": {
                            "modalities": { "input": ["text", "image"] }
                        },
                        "gemini-text-override": {
                            "vision": false
                        }
                    }
                }
            }
        });
        assert!(model_supports_vision_from_config(
            Some(&cfg),
            "custom",
            "custom-multimodal"
        ));
        assert!(!model_supports_vision_from_config(
            Some(&cfg),
            "custom",
            "gemini-text-override"
        ));
    }
}

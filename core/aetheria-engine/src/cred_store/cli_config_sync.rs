//! Registers harvested Local CLI credentials and model lists into `aetheria.json` under `local-cli`.

use super::store::get_all_credentials;
use crate::paths::aetheria_config_dir;
use serde_json::{json, Value};

pub fn register_local_cli_to_config(bridge_port: u16) {
    let config_path = aetheria_config_dir().join("aetheria.json");
    let mut cfg: Value = if let Ok(raw) = std::fs::read_to_string(&config_path) {
        serde_json::from_str(&raw).unwrap_or_else(|_| json!({}))
    } else {
        json!({})
    };

    if !cfg.is_object() {
        cfg = json!({});
    }
    if cfg.get("provider").and_then(|v| v.as_object()).is_none() {
        cfg["provider"] = json!({});
    }

    let creds = get_all_credentials();
    let mut models = serde_json::Map::new();

    if creds.contains_key("codex") {
        for (id, name, reasoning) in [
            ("gpt-5.6-terra", "GPT-5.6 Terra (Codex CLI)", true),
            ("gpt-5.4", "GPT-5.4 (Codex CLI)", true),
            ("gpt-5.4-mini", "GPT-5.4 Mini (Codex CLI)", true),
            ("gpt-5.3-codex", "GPT-5.3 Codex (Codex CLI)", true),
            ("gpt-5.2-codex", "GPT-5.2 Codex (Codex CLI)", true),
            ("gpt-5.2", "GPT-5.2 (Codex CLI)", false),
            ("gpt-5.1-codex-max", "GPT-5.1 Codex Max (Codex CLI)", true),
            ("gpt-5.1-codex-mini", "GPT-5.1 Codex Mini (Codex CLI)", false),
        ] {
            models.insert(
                id.to_string(),
                json!({
                    "name": name,
                    "attachment": true,
                    "reasoning": reasoning,
                    "tool_call": true,
                    "limit": { "context": 200000, "output": 32768 }
                }),
            );
        }
    }

    if creds.contains_key("claude") {
        for (id, name, reasoning) in [
            ("claude-3-7-sonnet-20250219", "Claude 3.7 Sonnet (Claude Code CLI)", true),
            ("claude-3-5-sonnet-20241022", "Claude 3.5 Sonnet (Claude Code CLI)", false),
            ("claude-3-5-haiku-20241022", "Claude 3.5 Haiku (Claude Code CLI)", false),
        ] {
            models.insert(
                id.to_string(),
                json!({
                    "name": name,
                    "attachment": true,
                    "reasoning": reasoning,
                    "tool_call": true,
                    "limit": { "context": 200000, "output": 8192 }
                }),
            );
        }
    }

    if creds.contains_key("kiro") {
        for (id, name) in [
            ("claude-3-7-sonnet", "Claude 3.7 Sonnet (Kiro AWS)"),
            ("claude-3-5-sonnet", "Claude 3.5 Sonnet (Kiro AWS)"),
            ("claude-3-5-haiku", "Claude 3.5 Haiku (Kiro AWS)"),
        ] {
            models.insert(
                id.to_string(),
                json!({
                    "name": name,
                    "attachment": true,
                    "reasoning": true,
                    "tool_call": true,
                    "limit": { "context": 200000, "output": 8192 }
                }),
            );
        }
    }

    if creds.contains_key("antigravity") {
        for (id, name) in [
            ("gemini-2.5-pro", "Gemini 2.5 Pro (Antigravity CLI)"),
            ("gemini-2.5-flash", "Gemini 2.5 Flash (Antigravity CLI)"),
            ("gemini-2.0-flash", "Gemini 2.0 Flash (Antigravity CLI)"),
        ] {
            models.insert(
                id.to_string(),
                json!({
                    "name": name,
                    "attachment": true,
                    "reasoning": true,
                    "tool_call": true,
                    "limit": { "context": 1000000, "output": 65536 }
                }),
            );
        }
    }

    if creds.contains_key("opencode") {
        for (id, name) in [
            ("big-pickle", "Big Pickle (OpenCode Zen)"),
            ("minimax-m2.5", "MiniMax M2.5 (OpenCode Zen)"),
            ("deepseek-v3", "DeepSeek V3 (OpenCode Zen)"),
            ("deepseek-r1", "DeepSeek R1 (OpenCode Zen)"),
            ("glm-4", "GLM-4 (OpenCode Zen)"),
            ("qwen-2.5-coder-32b", "Qwen 2.5 Coder 32B (OpenCode Zen)"),
        ] {
            models.insert(
                id.to_string(),
                json!({
                    "name": name,
                    "attachment": true,
                    "reasoning": id.contains("r1"),
                    "tool_call": true,
                    "limit": { "context": 128000, "output": 8192 }
                }),
            );
        }
    }

    if !models.is_empty() {
        if let Some(prov_obj) = cfg.get_mut("provider").and_then(|v| v.as_object_mut()) {
            prov_obj.insert(
                "local-cli".to_string(),
                json!({
                    "name": "Local CLI Auto-Bridge",
                    "api": format!("http://127.0.0.1:{}/v1", bridge_port),
                    "options": {
                        "baseURL": format!("http://127.0.0.1:{}/v1", bridge_port),
                        "apiKey": "local-cli-bridge"
                    },
                    "models": models
                }),
            );
        }

        if let Ok(serialized) = serde_json::to_string_pretty(&cfg) {
            let _ = std::fs::write(&config_path, serialized);
        }
    }
}


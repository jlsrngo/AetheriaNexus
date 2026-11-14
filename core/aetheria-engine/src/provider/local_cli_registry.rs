//! Static Model Lists, Harvested Summary & Registry Metadata for Local CLI Providers.

use super::local_cli::default_models_for_target;
use crate::cred_store::get_all_credentials;
use crate::paths::now_ms;
use serde_json::{json, Value};

pub fn default_models_for_target_impl(target: &str) -> Vec<&'static str> {
    match target {
        "claude" => vec![
            "claude-sonnet-4-6",
            "claude-opus-4-6",
            "claude-haiku-4-5",
        ],
        "codex" => vec![
            "gpt-5.6-terra",
            "gpt-5.4",
            "gpt-5.4-mini",
            "gpt-5.3-codex",
            "gpt-5.2-codex",
            "gpt-5.2",
            "gpt-5.1-codex-max",
            "gpt-5.1-codex-mini",
        ],
        "kiro" => vec![
            "kiro/auto",
            "kiro/claude-opus-4.6",
            "kiro/claude-sonnet-4.6",
            "kiro/claude-sonnet-4.5",
            "kiro/claude-haiku-4.5",
            "kiro/deepseek-3.2",
            "kiro/minimax-m2.5",
            "kiro/glm-5",
            "kiro/qwen3-coder-next",
        ],
        "antigravity" => vec![
            "gemini-3.8-pro-high",
            "gemini-3.8-pro-low",
            "gemini-3.8-flash-high",
            "gemini-3.8-flash-medium",
            "gemini-3.8-flash-low",
            "gemini-3.8-flash-minimal",
            "claude-sonnet-4-6-agy",
            "claude-opus-4-6-thinking",
            "gpt-oss-120b-medium",
        ],
        "opencode" => vec![
            "opencode/big-pickle",
            "opencode/mimo-v2-pro-free",
            "opencode/mimo-v2-omni-free",
            "opencode/nemotron-3-super-free",
            "opencode/minimax-m2.5-free",
            "opencode/gpt-5-nano",
        ],
        "9router" => vec![
            "claude-sonnet-4-6",
            "gpt-5.4",
            "gemini-3.8-pro-high",
        ],
        _ => vec![],
    }
}

pub fn build_discovered_list() -> Vec<Value> {
    let creds = get_all_credentials();
    let mut out = Vec::new();
    let specs = [
        (
            "antigravity",
            "Google Antigravity (agy)",
            "oauth",
            "Windows CredMan (gemini:antigravity)",
            "gemini-3.8-flash-high",
        ),
        (
            "claude",
            "Claude Code",
            "oauth",
            "~/.claude/.credentials.json",
            "claude-sonnet-4-6",
        ),
        (
            "codex",
            "OpenAI Codex / ChatGPT",
            "oauth",
            "~/.codex/auth.json",
            "gpt-5.4",
        ),
        (
            "kiro",
            "Kiro (AWS)",
            "oauth",
            "~/.aws/sso/cache",
            "kiro/auto",
        ),
        (
            "opencode",
            "OpenCode Zen",
            "api_key",
            "~/.local/share/opencode/auth.json",
            "opencode/big-pickle",
        ),
    ];

    for (prov, disp, ctype, src_path, def_mod) in specs {
        let entry = creds.get(prov);
        let has_token = entry.map(|e| !e.access_token.is_empty()).unwrap_or(false);
        let effective_src_path = if prov == "antigravity"
            && entry
                .map(|e| !e.auto_harvested && !e.access_token.is_empty())
                .unwrap_or(false)
        {
            "Browser OAuth (~/.aetheria/local-cli-credentials.json)"
        } else {
            src_path
        };
        let expired = entry
            .and_then(|e| e.expires_at)
            .map(|exp| now_ms() >= exp)
            .unwrap_or(false);
        out.push(json!({
            "provider": prov,
            "displayName": disp,
            "type": ctype,
            "sourcePath": effective_src_path,
            "hasToken": has_token,
            "hasRefreshToken": entry.and_then(|e| e.refresh_token.as_ref()).is_some(),
            "isExpired": expired,
            "expiresAt": entry.and_then(|e| e.expires_at),
            "accountEmail": entry
                .and_then(|e| e.account_email.clone())
                .or_else(|| entry.and_then(|e| e.account_info.clone()).filter(|s| s.contains('@'))),
            "region": entry.and_then(|e| e.region.clone()),
            "defaultModel": def_mod,
            "models": default_models_for_target(prov)
        }));
    }
    out
}

pub fn build_cli_provider_registry() -> Vec<Value> {
    vec![
        json!({
            "id": "claude",
            "name": "Claude",
            "vendor": "Anthropic",
            "docsUrl": "https://claude.ai",
            "loginCommand": "claude auth login",
            "credentialPath": "~/.claude/.credentials.json",
            "quota": "claude",
            "models": [
                "claude-3-7-sonnet",
                "claude-3-5-sonnet",
                "claude-3-5-haiku",
                "claude-3-opus"
            ],
            "requiresCli": false,
            "loginMode": "terminal",
            "supportsAutoConfigure": true,
            "supportsBrowserLogin": true,
            "entitlement": {
                "notice": "Requires a Claude Max or Pro subscription",
                "noticeId": "Perlu langganan Claude Max atau Pro",
                "url": "https://claude.ai"
            }
        }),
        json!({
            "id": "codex",
            "name": "Codex",
            "vendor": "OpenAI",
            "docsUrl": "https://chatgpt.com",
            "loginCommand": "codex login",
            "credentialPath": "~/.codex/auth.json",
            "quota": "codex",
            "models": [
                "gpt-5.6-terra",
                "gpt-5.6-luna",
                "gpt-5.5",
                "gpt-6-luna",
                "gpt-reserve"
            ],
            "requiresCli": false,
            "loginMode": "terminal",
            "supportsAutoConfigure": false,
            "supportsBrowserLogin": true,
            "entitlement": {
                "notice": "Works on a free ChatGPT account, but only some models answer. A free login is refused by every other Codex model with \"not supported when using Codex with a ChatGPT account\".",
                "noticeId": "Gratis berfungsi, tapi hanya sebagian model",
                "url": "https://chatgpt.com/codex"
            }
        }),
        json!({
            "id": "opencode",
            "name": "OpenCode",
            "vendor": "opencode",
            "docsUrl": "https://opencode.ai",
            "installUrl": "https://opencode.ai",
            "loginCommand": "opencode auth login",
            "credentialPath": "~/.local/share/opencode/auth.json",
            "quota": "none",
            "models": [
                "groq/openai/gpt-oss-120b",
                "groq/qwen/qwen3.8-27b",
                "groq/openai/gpt-oss-20b",
                "opencode/big-pickle",
                "9router/ComboMaut",
                "opencode/nemotron-3.5-lightning-free"
            ],
            "requiresCli": true,
            "loginMode": "terminal",
            "supportsAutoConfigure": false,
            "supportsBrowserLogin": false,
            "note": {
                "text": "Native requests route through OpenCode Zen and can take up to a minute on a cold model. Slow, not stuck.",
                "textId": "Permintaan native lewat OpenCode Zen bisa sampai semenit saat model baru dipakai. Lambat, bukan macet."
            }
        }),
        json!({
            "id": "antigravity",
            "name": "Google Antigravity CLI",
            "vendor": "Google DeepMind",
            "docsUrl": "https://antigravity.google.com",
            "installUrl": "https://antigravity.google.com",
            "installSizeMb": 181,
            "loginCommand": "agy",
            "credentialPath": "~/.gemini/oauth_creds.json",
            "credentialTarget": "gemini:antigravity",
            "quota": "antigravity",
            "models": [
                "gemini-3.8-flash-medium",
                "gemini-3.8-flash-low",
                "gemini-3.8-flash-high",
                "gemini-2.5-pro",
                "gemini-2.5-flash",
                "claude-sonnet-4-6"
            ],
            "requiresCli": false,
            "loginMode": "terminal",
            "supportsAutoConfigure": false,
            "supportsBrowserLogin": true
        }),
        json!({
            "id": "kiro",
            "name": "Kiro",
            "vendor": "AWS",
            "docsUrl": "https://kiro.dev",
            "quota": "kiro",
            "models": [
                "kiro/auto",
                "kiro/claude-opus-4.6",
                "kiro/claude-sonnet-4.6",
                "kiro/claude-sonnet-4.5",
                "kiro/claude-haiku-4.5",
                "kiro/deepseek-3.2",
                "kiro/minimax-m2.5",
                "kiro/glm-5",
                "kiro/qwen3-coder-next"
            ],
            "requiresCli": false,
            "loginMode": "browser",
            "supportsAutoConfigure": false,
            "supportsBrowserLogin": true
        }),
        json!({
            "id": "nineRouter",
            "name": "9Router",
            "vendor": "9Router",
            "docsUrl": "https://9router.com",
            "quota": "none",
            "models": [
                "9router/ComboMaut",
                "oc/big-pickle",
                "oc/claude-sonnet-4.5",
                "kr/claude-sonnet-4.5",
                "vx/gemini-2.5-pro",
                "deepseek-r1",
                "cx/gpt-5.6-terra"
            ],
            "requiresCli": true,
            "loginMode": "terminal",
            "supportsAutoConfigure": false,
            "supportsBrowserLogin": false
        })
    ]
}


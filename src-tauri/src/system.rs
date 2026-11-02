//! ArunakiNexus System & CLI Discovery Module (Pure Rust)
//!
//! Provides binary discovery for local AI CLIs (agy, claude, codex, opencode, kiro, ollama),
//! checks local credentials, extracts account emails, and manages login/logout terminals.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CliItemStatus {
    pub id: String,
    pub name: String,
    pub vendor: String,
    pub installed: bool,
    pub path: Option<String>,
    pub logged_in: bool,
    pub credential_path: Option<String>,
    pub account_email: Option<String>,
    pub default_model: String,
    pub available_models: Vec<String>,
    pub docs_url: String,
    pub login_command: String,
    pub entitlement: Option<String>,
    pub note: Option<String>,
}

fn get_user_home() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        std::env::var_os("USERPROFILE").map(PathBuf::from)
    }
    #[cfg(not(windows))]
    {
        std::env::var_os("HOME").map(PathBuf::from)
    }
}

fn find_binary(name: &str) -> Option<String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let mut cmd = std::process::Command::new("where.exe");
        cmd.arg(name);
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        if let Ok(output) = cmd.output() {
            if output.status.success() {
                let first_line = String::from_utf8_lossy(&output.stdout)
                    .lines()
                    .next()
                    .unwrap_or("")
                    .trim()
                    .to_string();
                if !first_line.is_empty() {
                    return Some(first_line);
                }
            }
        }
    }
    None
}

/// Helper to try reading email or account info from a JSON credential file
fn extract_email_from_json(path: &PathBuf) -> Option<String> {
    if !path.exists() {
        return None;
    }
    if let Ok(content) = std::fs::read_to_string(path) {
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&content) {
            // Check common email fields
            if let Some(email) = v.get("email").and_then(|x| x.as_str()) {
                return Some(email.to_string());
            }
            if let Some(account) = v.get("account").and_then(|x| x.as_str()) {
                return Some(account.to_string());
            }
            if let Some(account_info) = v.get("account_info").and_then(|x| x.as_str()) {
                if account_info.contains('@') {
                    return Some(account_info.to_string());
                }
            }
            if let Some(sub) = v.get("sub").and_then(|x| x.as_str()) {
                if sub.contains('@') {
                    return Some(sub.to_string());
                }
            }
        }
    }
    None
}

/// Detects local AI CLIs and authentication files
#[tauri::command]
pub fn detect_local_clis() -> HashMap<String, CliItemStatus> {
    let mut results = HashMap::new();
    let home = get_user_home().unwrap_or_else(|| PathBuf::from("."));

    // 1. Google Antigravity CLI (agy)
    let agy_path = find_binary("agy");
    let agy_cred = home.join(".gemini").join("oauth_creds.json");
    let agy_logged_in = agy_cred.exists();
    let agy_email = if agy_logged_in {
        extract_email_from_json(&agy_cred).or_else(|| Some("juliosiringoringo6@gmail.com".to_string()))
    } else {
        None
    };
    results.insert(
        "antigravity".to_string(),
        CliItemStatus {
            id: "antigravity".to_string(),
            name: "Google Antigravity CLI (AGY)".to_string(),
            vendor: "Google DeepMind".to_string(),
            installed: agy_path.is_some() || agy_logged_in,
            path: agy_path.or_else(|| {
                let local_path = home.join("AppData\\Local\\agy\\bin\\agy.exe");
                if local_path.exists() {
                    Some(local_path.to_string_lossy().to_string())
                } else {
                    None
                }
            }),
            logged_in: agy_logged_in,
            credential_path: if agy_logged_in {
                Some(agy_cred.to_string_lossy().to_string())
            } else {
                None
            },
            account_email: agy_email,
            default_model: "gemini-3.8-flash-high".to_string(),
            available_models: vec![
                "gemini-3.8-flash-high".to_string(),
                "claude-opus-4.6-thinking".to_string(),
                "claude-sonnet-4.6-agy".to_string(),
                "claude-sonnet-5.5".to_string(),
                "gemini-2.5-flash".to_string(),
                "gemini-2.5-pro".to_string(),
                "gemini-3-flash".to_string(),
                "gemini-3.1-pro".to_string(),
            ],
            docs_url: "https://antigravity.google.com".to_string(),
            login_command: "agy login".to_string(),
            entitlement: None,
            note: None,
        },
    );

    // 2. Claude Code CLI (claude)
    let claude_path = find_binary("claude");
    let claude_cred = home.join(".claude").join(".credentials.json");
    let claude_logged_in = claude_cred.exists();
    let claude_email = if claude_logged_in {
        extract_email_from_json(&claude_cred)
    } else {
        None
    };
    results.insert(
        "claude".to_string(),
        CliItemStatus {
            id: "claude".to_string(),
            name: "Claude Code CLI".to_string(),
            vendor: "Anthropic".to_string(),
            installed: claude_path.is_some() || claude_logged_in,
            path: claude_path.or_else(|| {
                let npm_path = home.join("AppData\\Roaming\\npm\\claude.cmd");
                if npm_path.exists() {
                    Some(npm_path.to_string_lossy().to_string())
                } else {
                    None
                }
            }),
            logged_in: claude_logged_in,
            credential_path: if claude_logged_in {
                Some(claude_cred.to_string_lossy().to_string())
            } else {
                None
            },
            account_email: claude_email,
            default_model: "claude-3-7-sonnet".to_string(),
            available_models: vec![
                "claude-3-7-sonnet".to_string(),
                "claude-3-5-sonnet".to_string(),
                "claude-3-5-haiku".to_string(),
            ],
            docs_url: "https://claude.ai".to_string(),
            login_command: "claude auth login".to_string(),
            entitlement: Some("Requires a Claude Max or Pro subscription".to_string()),
            note: None,
        },
    );

    // 3. OpenAI Codex CLI (codex)
    let codex_path = find_binary("codex");
    let codex_cred = home.join(".codex").join("auth.json");
    let codex_logged_in = codex_cred.exists();
    let codex_email = if codex_logged_in {
        extract_email_from_json(&codex_cred)
    } else {
        None
    };
    results.insert(
        "codex".to_string(),
        CliItemStatus {
            id: "codex".to_string(),
            name: "OpenAI Codex CLI".to_string(),
            vendor: "OpenAI".to_string(),
            installed: codex_path.is_some() || codex_logged_in,
            path: codex_path,
            logged_in: codex_logged_in,
            credential_path: if codex_logged_in {
                Some(codex_cred.to_string_lossy().to_string())
            } else {
                None
            },
            account_email: codex_email,
            default_model: "gpt-5.6-luna".to_string(),
            available_models: vec![
                "gpt-5.6-luna".to_string(),
                "gpt-5.5".to_string(),
                "gpt-4o".to_string(),
                "gpt-4o-mini".to_string(),
                "o3-mini".to_string(),
            ],
            docs_url: "https://chatgpt.com/codex".to_string(),
            login_command: "codex login".to_string(),
            entitlement: Some("Works on ChatGPT account with Codex access".to_string()),
            note: None,
        },
    );

    // 4. OpenCode CLI (opencode)
    let opencode_path = find_binary("opencode");
    let opencode_cred = home.join(".local").join("share").join("opencode").join("auth.json");
    let opencode_logged_in = opencode_cred.exists();
    let opencode_email = if opencode_logged_in {
        extract_email_from_json(&opencode_cred)
    } else {
        None
    };
    results.insert(
        "opencode".to_string(),
        CliItemStatus {
            id: "opencode".to_string(),
            name: "OpenCode CLI".to_string(),
            vendor: "opencode".to_string(),
            installed: opencode_path.is_some() || opencode_logged_in,
            path: opencode_path,
            logged_in: opencode_logged_in,
            credential_path: if opencode_logged_in {
                Some(opencode_cred.to_string_lossy().to_string())
            } else {
                None
            },
            account_email: opencode_email,
            default_model: "groq/openai/gpt-oss-120b".to_string(),
            available_models: vec![
                "big-pickle".to_string(),
                "groq/openai/gpt-oss-120b".to_string(),
                "groq/qwen/qwen3.8-27b".to_string(),
            ],
            docs_url: "https://opencode.ai".to_string(),
            login_command: "opencode auth login".to_string(),
            entitlement: None,
            note: Some("Native requests route through OpenCode Zen.".to_string()),
        },
    );

    // 5. Kiro CLI (kiro)
    let kiro_path = find_binary("kiro");
    let kiro_cred = home.join(".kiro").join("credentials.json");
    let kiro_logged_in = kiro_cred.exists();
    results.insert(
        "kiro".to_string(),
        CliItemStatus {
            id: "kiro".to_string(),
            name: "Kiro".to_string(),
            vendor: "AWS".to_string(),
            installed: kiro_path.is_some() || kiro_logged_in,
            path: kiro_path,
            logged_in: kiro_logged_in,
            credential_path: if kiro_logged_in {
                Some(kiro_cred.to_string_lossy().to_string())
            } else {
                None
            },
            account_email: if kiro_logged_in {
                Some("juliosiringoringo6@gmail.com".to_string())
            } else {
                None
            },
            default_model: "kiro/auto".to_string(),
            available_models: vec![
                "kiro/auto".to_string(),
                "claude-sonnet-4.5".to_string(),
                "kiro/deepseek-3.2".to_string(),
            ],
            docs_url: "https://kiro.dev".to_string(),
            login_command: "kiro login".to_string(),
            entitlement: None,
            note: None,
        },
    );

    // 6. Ollama Local Host
    let ollama_path = find_binary("ollama");
    results.insert(
        "ollama".to_string(),
        CliItemStatus {
            id: "ollama".to_string(),
            name: "Ollama (Local Host)".to_string(),
            vendor: "Ollama".to_string(),
            installed: ollama_path.is_some(),
            path: ollama_path,
            logged_in: false,
            credential_path: None,
            account_email: None,
            default_model: "llama3.2".to_string(),
            available_models: vec![
                "llama3.2".to_string(),
                "qwen2.5:7b".to_string(),
                "deepseek-r1:8b".to_string(),
                "mistral".to_string(),
            ],
            docs_url: "https://ollama.ai".to_string(),
            login_command: "ollama serve".to_string(),
            entitlement: None,
            note: Some("Runs fully offline on localhost:11434".to_string()),
        },
    );

    results
}

/// Spawns a native interactive terminal window to log into the CLI
#[tauri::command]
pub async fn tauri_cli_login(target: String) -> Result<serde_json::Value, String> {
    let cmd_str = match target.as_str() {
        "antigravity" | "antigravity-cli" => "agy login",
        "claude" => "claude auth login",
        "codex" => "codex login",
        "opencode" => "opencode auth login",
        "kiro" => "kiro login",
        "ollama" => "ollama serve",
        _ => "cmd",
    };

    #[cfg(windows)]
    {
        let _ = std::process::Command::new("cmd")
            .args(["/c", "start", "cmd", "/k", cmd_str])
            .spawn();
    }

    Ok(serde_json::json!({
        "success": true,
        "message": format!("Launched '{}' in terminal window.", cmd_str)
    }))
}

/// Signs out from a CLI by removing or archiving its credential token file
#[tauri::command]
pub async fn tauri_cli_logout(target: String) -> Result<serde_json::Value, String> {
    let home = get_user_home().unwrap_or_else(|| PathBuf::from("."));
    let cred_path = match target.as_str() {
        "antigravity" => home.join(".gemini").join("oauth_creds.json"),
        "claude" => home.join(".claude").join(".credentials.json"),
        "codex" => home.join(".codex").join("auth.json"),
        "opencode" => home.join(".local").join("share").join("opencode").join("auth.json"),
        "kiro" => home.join(".kiro").join("credentials.json"),
        _ => PathBuf::new(),
    };

    if cred_path.exists() {
        let _ = std::fs::remove_file(cred_path);
    }

    Ok(serde_json::json!({
        "success": true,
        "message": format!("Signed out from {}.", target)
    }))
}

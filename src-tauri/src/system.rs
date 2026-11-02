//! ArunakiNexus System & CLI Discovery Module (Pure Rust)
//!
//! Provides binary discovery for local AI CLIs (agy, claude, codex, opencode, ollama),
//! checks local credentials, and allows multi-provider routing for video scripting.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CliItemStatus {
    pub id: String,
    pub name: String,
    pub installed: bool,
    pub path: Option<String>,
    pub logged_in: bool,
    pub credential_path: Option<String>,
    pub default_model: String,
    pub available_models: Vec<String>,
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

/// Detects local AI CLIs and authentication files
#[tauri::command]
pub fn detect_local_clis() -> HashMap<String, CliItemStatus> {
    let mut results = HashMap::new();
    let home = get_user_home().unwrap_or_else(|| PathBuf::from("."));

    // 1. Google Antigravity CLI (agy)
    let agy_path = find_binary("agy");
    let agy_cred = home.join(".gemini").join("oauth_creds.json");
    let agy_logged_in = agy_cred.exists();
    results.insert(
        "antigravity".to_string(),
        CliItemStatus {
            id: "antigravity".to_string(),
            name: "Google Antigravity CLI (agy)".to_string(),
            installed: agy_path.is_some(),
            path: agy_path,
            logged_in: agy_logged_in,
            credential_path: if agy_logged_in {
                Some(agy_cred.to_string_lossy().to_string())
            } else {
                None
            },
            default_model: "gemini-2.5-flash".to_string(),
            available_models: vec![
                "gemini-2.5-flash".to_string(),
                "gemini-2.5-pro".to_string(),
                "gemini-3.8-flash-high".to_string(),
                "claude-sonnet-4-6".to_string(),
            ],
        },
    );

    // 2. Claude Code CLI (claude)
    let claude_path = find_binary("claude");
    let claude_cred = home.join(".claude").join(".credentials.json");
    let claude_logged_in = claude_cred.exists();
    results.insert(
        "claude".to_string(),
        CliItemStatus {
            id: "claude".to_string(),
            name: "Claude Code CLI".to_string(),
            installed: claude_path.is_some(),
            path: claude_path,
            logged_in: claude_logged_in,
            credential_path: if claude_logged_in {
                Some(claude_cred.to_string_lossy().to_string())
            } else {
                None
            },
            default_model: "claude-3-5-sonnet".to_string(),
            available_models: vec![
                "claude-3-7-sonnet".to_string(),
                "claude-3-5-sonnet".to_string(),
                "claude-3-5-haiku".to_string(),
            ],
        },
    );

    // 3. OpenAI Codex CLI (codex)
    let codex_path = find_binary("codex");
    let codex_cred = home.join(".codex").join("auth.json");
    let codex_logged_in = codex_cred.exists();
    results.insert(
        "codex".to_string(),
        CliItemStatus {
            id: "codex".to_string(),
            name: "OpenAI Codex CLI".to_string(),
            installed: codex_path.is_some(),
            path: codex_path,
            logged_in: codex_logged_in,
            credential_path: if codex_logged_in {
                Some(codex_cred.to_string_lossy().to_string())
            } else {
                None
            },
            default_model: "gpt-4o".to_string(),
            available_models: vec![
                "gpt-4o".to_string(),
                "gpt-4o-mini".to_string(),
                "o3-mini".to_string(),
            ],
        },
    );

    // 4. OpenCode CLI
    let opencode_path = find_binary("opencode");
    let opencode_cred = home.join(".local").join("share").join("opencode").join("auth.json");
    let opencode_logged_in = opencode_cred.exists();
    results.insert(
        "opencode".to_string(),
        CliItemStatus {
            id: "opencode".to_string(),
            name: "OpenCode CLI".to_string(),
            installed: opencode_path.is_some(),
            path: opencode_path,
            logged_in: opencode_logged_in,
            credential_path: if opencode_logged_in {
                Some(opencode_cred.to_string_lossy().to_string())
            } else {
                None
            },
            default_model: "groq/openai/gpt-oss-120b".to_string(),
            available_models: vec![
                "groq/openai/gpt-oss-120b".to_string(),
                "groq/qwen/qwen3.8-27b".to_string(),
            ],
        },
    );

    // 5. Ollama Local Host
    let ollama_path = find_binary("ollama");
    results.insert(
        "ollama".to_string(),
        CliItemStatus {
            id: "ollama".to_string(),
            name: "Ollama (Local Host)".to_string(),
            installed: ollama_path.is_some(),
            path: ollama_path,
            logged_in: false, // will check reachable via port 11434
            credential_path: None,
            default_model: "llama3.2".to_string(),
            available_models: vec![
                "llama3.2".to_string(),
                "qwen2.5:7b".to_string(),
                "deepseek-r1:8b".to_string(),
                "mistral".to_string(),
            ],
        },
    );

    results
}

fn find_binary(bin: &str) -> Option<String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let mut cmd = std::process::Command::new("where.exe");
        cmd.arg(bin);
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

    #[cfg(not(windows))]
    {
        let mut cmd = std::process::Command::new("which");
        cmd.arg(bin);
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

//! Antigravity request cloaking, prompt hygiene, numeric session IDs, and anti-spam pacing.

use crate::paths::now_ms;
use axum::http::StatusCode;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;
use tokio::sync::{OwnedSemaphorePermit, Semaphore};

const AG_TOOL_SUFFIX: &str = "_ide";
const DEFAULT_MAX_CONCURRENT: usize = 2;
const DEFAULT_MIN_GAP_MS: u64 = if cfg!(test) { 0 } else { 350 };
const DEFAULT_429_COOLDOWN_MS: u64 = 15_000;
const TOS_403_COOLDOWN_MS: u64 = 60_000;

/// Native Antigravity IDE tool names recognized upstream without the `_ide` suffix.
const AG_DEFAULT_TOOLS: &[&str] = &[
    "browser_subagent",
    "command_status",
    "find_by_name",
    "generate_image",
    "grep_search",
    "list_dir",
    "list_resources",
    "mcp_sequential-thinking_sequentialthinking",
    "multi_replace_file_content",
    "notify_user",
    "read_resource",
    "read_terminal",
    "read_url_content",
    "replace_file_content",
    "run_command",
    "search_web",
    "send_command_input",
    "task_boundary",
    "view_content_chunk",
    "view_file",
    "write_to_file",
];

#[derive(Clone, Debug)]
struct CooldownEntry {
    until_ms: u64,
    reason: String,
}

static AGY_SEM: OnceLock<Arc<Semaphore>> = OnceLock::new();
static AGY_LAST_REQ_MS: OnceLock<Mutex<u64>> = OnceLock::new();
static AGY_COOLDOWNS: OnceLock<Mutex<HashMap<String, CooldownEntry>>> = OnceLock::new();

pub(crate) fn is_ag_default_tool(name: &str) -> bool {
    AG_DEFAULT_TOOLS.contains(&name)
}

/// Sanitizes a function name to match Gemini's `[a-zA-Z_][a-zA-Z0-9_.:\-]{0,63}` rule.
pub(crate) fn sanitize_function_name(name: &str, max_len: usize) -> String {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return "_unknown".to_string();
    }
    let mut out = String::with_capacity(trimmed.len() + 1);
    for ch in trimmed.chars() {
        if ch.is_ascii_alphanumeric() || matches!(ch, '_' | '.' | ':' | '-') {
            out.push(ch);
        } else {
            out.push('_');
        }
    }
    if !out
        .chars()
        .next()
        .is_some_and(|c| c.is_ascii_alphabetic() || c == '_')
    {
        out.insert(0, '_');
    }
    if out.len() > max_len {
        out.truncate(max_len);
    }
    out
}

/// Derives a stable Antigravity-style negative 63-bit numeric `sessionId` string (`"-<int64>"`).
pub(crate) fn to_numeric_session_id(seed: &str) -> String {
    let trimmed = seed.trim();
    if trimmed.is_empty() {
        return "-1".to_string();
    }
    let mut hasher = Sha256::new();
    hasher.update(trimmed.as_bytes());
    let digest = hasher.finalize();
    let mut bytes = [0u8; 8];
    bytes.copy_from_slice(&digest[..8]);
    let val = u64::from_be_bytes(bytes) & 0x7fff_ffff_ffff_ffff;
    format!("-{}", val.max(1))
}

fn replace_case_insensitive_opencode(text: &str) -> String {
    let lower = text.to_ascii_lowercase();
    let needle = "opencode";
    if !lower.contains(needle) {
        return text.to_string();
    }
    let mut out = String::with_capacity(text.len() + 16);
    let bytes = lower.as_bytes();
    let needle_bytes = needle.as_bytes();
    let mut i = 0;
    while i < text.len() {
        if i + needle_bytes.len() <= bytes.len()
            && &bytes[i..i + needle_bytes.len()] == needle_bytes
        {
            let orig = &text[i..i + needle_bytes.len()];
            let rep = if orig == "OpenCode" {
                "Antigravity"
            } else if orig == "OPENCODE" {
                "ANTIGRAVITY"
            } else {
                "antigravity"
            };
            out.push_str(rep);
            i += needle_bytes.len();
        } else if let Some(ch) = text[i..].chars().next() {
            out.push(ch);
            i += ch.len_utf8();
        } else {
            break;
        }
    }
    out
}

/// Strips competing-client headers/branding from system instructions that trigger upstream anti-abuse 429s.
pub(crate) fn sanitize_antigravity_system_prompt(input: &str) -> String {
    let mut kept_lines = Vec::new();
    for line in input.lines() {
        if line
            .trim_start()
            .to_ascii_lowercase()
            .starts_with("x-anthropic-billing-header:")
        {
            continue;
        }
        kept_lines.push(line);
    }
    let cleaned = kept_lines
        .join("\n")
        .replace(
            "You are a Claude agent, built on Anthropic's Claude Agent SDK.",
            "",
        );
    replace_case_insensitive_opencode(&cleaned)
        .trim()
        .to_string()
}

pub(crate) struct CloakedToolSet {
    pub(crate) declarations: Vec<Value>,
    pub(crate) orig_to_cloaked: HashMap<String, String>,
    pub(crate) cloaked_to_orig: HashMap<String, String>,
}

/// Cloaks non-native client tool names with `_ide` and appends unavailable native AG decoy tools.
pub(crate) fn build_cloaked_tools(client_decls: Vec<Value>) -> CloakedToolSet {
    let mut orig_to_cloaked = HashMap::new();
    let mut cloaked_to_orig = HashMap::new();
    if client_decls.is_empty() {
        return CloakedToolSet {
            declarations: Vec::new(),
            orig_to_cloaked,
            cloaked_to_orig,
        };
    }

    let mut declarations = Vec::with_capacity(client_decls.len() + AG_DEFAULT_TOOLS.len());
    let mut seen_names = HashSet::new();

    for mut decl in client_decls {
        let Some(orig_name) = decl
            .get("name")
            .and_then(|v| v.as_str())
            .map(str::to_string)
        else {
            continue;
        };

        let target_name = if is_ag_default_tool(&orig_name) {
            orig_name.clone()
        } else {
            let max_base = 64 - AG_TOOL_SUFFIX.len();
            let base = sanitize_function_name(&orig_name, max_base);
            let mut candidate = format!("{}{}", base, AG_TOOL_SUFFIX);
            let mut n = 2usize;
            while seen_names.contains(&candidate) {
                let tag = format!("_{}{}", n, AG_TOOL_SUFFIX);
                let trimmed = sanitize_function_name(&orig_name, 64usize.saturating_sub(tag.len()));
                candidate = format!("{}{}", trimmed, tag);
                n += 1;
            }
            candidate
        };

        if !seen_names.insert(target_name.clone()) {
            continue;
        }
        orig_to_cloaked.insert(orig_name.clone(), target_name.clone());
        cloaked_to_orig.insert(target_name.clone(), orig_name);
        if let Some(obj) = decl.as_object_mut() {
            obj.insert("name".to_string(), Value::String(target_name));
        }
        declarations.push(decl);
    }

    for decoy_name in AG_DEFAULT_TOOLS {
        if seen_names.insert((*decoy_name).to_string()) {
            declarations.push(json!({
                "name": decoy_name,
                "description": "This tool is currently unavailable.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {},
                    "required": []
                }
            }));
        }
    }

    CloakedToolSet {
        declarations,
        orig_to_cloaked,
        cloaked_to_orig,
    }
}

pub(crate) fn cloak_history_tool_name(
    orig_name: &str,
    orig_to_cloaked: &HashMap<String, String>,
) -> String {
    if let Some(mapped) = orig_to_cloaked.get(orig_name) {
        return mapped.clone();
    }
    if is_ag_default_tool(orig_name) {
        return orig_name.to_string();
    }
    let max_base = 64 - AG_TOOL_SUFFIX.len();
    format!("{}{}", sanitize_function_name(orig_name, max_base), AG_TOOL_SUFFIX)
}

pub(crate) fn uncloak_tool_name(
    upstream_name: &str,
    cloaked_to_orig: &HashMap<String, String>,
) -> String {
    if let Some(orig) = cloaked_to_orig.get(upstream_name) {
        return orig.clone();
    }
    if !is_ag_default_tool(upstream_name) {
        if let Some(stripped) = upstream_name.strip_suffix(AG_TOOL_SUFFIX) {
            if !stripped.is_empty() {
                return stripped.to_string();
            }
        }
    }
    upstream_name.to_string()
}

fn max_concurrent_requests() -> usize {
    std::env::var("AETHERIA_ANTIGRAVITY_MAX_CONCURRENT")
        .ok()
        .and_then(|v| v.trim().parse::<usize>().ok())
        .map(|v| v.clamp(1, 4))
        .unwrap_or(DEFAULT_MAX_CONCURRENT)
}

fn min_gap_ms() -> u64 {
    std::env::var("AETHERIA_ANTIGRAVITY_MIN_GAP_MS")
        .ok()
        .and_then(|v| v.trim().parse::<u64>().ok())
        .map(|v| v.min(10_000))
        .unwrap_or(DEFAULT_MIN_GAP_MS)
}

fn concurrency_semaphore() -> Arc<Semaphore> {
    AGY_SEM
        .get_or_init(|| Arc::new(Semaphore::new(max_concurrent_requests())))
        .clone()
}

pub(crate) fn clear_antigravity_cooldowns() {
    let map = AGY_COOLDOWNS.get_or_init(|| Mutex::new(HashMap::new()));
    if let Ok(mut guard) = map.lock() {
        guard.clear();
    }
}

pub(crate) fn clear_antigravity_cooldown(account_key: &str) {
    let map = AGY_COOLDOWNS.get_or_init(|| Mutex::new(HashMap::new()));
    if let Ok(mut guard) = map.lock() {
        guard.remove(account_key);
    }
}

fn check_active_cooldown(account_key: &str) -> Option<(StatusCode, String)> {
    let map = AGY_COOLDOWNS.get_or_init(|| Mutex::new(HashMap::new()));
    let mut guard = map.lock().ok()?;
    let now = now_ms();
    if let Some(entry) = guard.get(account_key).cloned() {
        if now < entry.until_ms {
            let secs = (entry.until_ms - now).div_ceil(1000);
            return Some((
                StatusCode::TOO_MANY_REQUESTS,
                format!("{} (retry after ~{}s)", entry.reason, secs),
            ));
        }
        guard.remove(account_key);
    }
    None
}

fn extract_retry_delay_ms(body: &str) -> Option<u64> {
    let val: Value = serde_json::from_str(body).ok()?;
    let details = val.pointer("/error/details")?.as_array()?;
    for d in details {
        if let Some(delay_str) = d.get("retryDelay").and_then(|v| v.as_str()) {
            let trimmed = delay_str.trim().trim_end_matches('s');
            if let Ok(secs) = trimmed.parse::<f64>() {
                if secs > 0.0 {
                    let ms = (secs * 1000.0).round() as u64;
                    return Some(ms.clamp(5_000, 60_000));
                }
            }
        }
    }
    None
}

/// Records upstream 429/403 signals so queued turns back off instead of spamming Google.
pub(crate) fn record_upstream_outcome(account_key: &str, status: StatusCode, body: &str) {
    if status.is_success() {
        clear_antigravity_cooldown(account_key);
        return;
    }

    let (duration_ms, reason) = if status == StatusCode::TOO_MANY_REQUESTS {
        let delay = extract_retry_delay_ms(body).unwrap_or(DEFAULT_429_COOLDOWN_MS);
        (
            delay,
            "Antigravity rate limit cooldown active to avoid spam triggers".to_string(),
        )
    } else if status == StatusCode::FORBIDDEN && body.to_ascii_uppercase().contains("TOS_VIOLATION")
    {
        (
            TOS_403_COOLDOWN_MS,
            "Antigravity account blocked by Google (TOS_VIOLATION); switch account or submit appeal"
                .to_string(),
        )
    } else {
        return;
    };

    let map = AGY_COOLDOWNS.get_or_init(|| Mutex::new(HashMap::new()));
    if let Ok(mut guard) = map.lock() {
        guard.insert(
            account_key.to_string(),
            CooldownEntry {
                until_ms: now_ms() + duration_ms,
                reason,
            },
        );
    }
}

/// Limits parallel Antigravity calls and paces starts so subagent bursts do not look like spam.
pub(crate) async fn acquire_antigravity_turn_slot(
    account_key: &str,
) -> Result<OwnedSemaphorePermit, (StatusCode, String)> {
    if let Some(err) = check_active_cooldown(account_key) {
        return Err(err);
    }

    let permit = concurrency_semaphore()
        .acquire_owned()
        .await
        .map_err(|e| {
            (
                StatusCode::SERVICE_UNAVAILABLE,
                format!("Antigravity concurrency limiter unavailable: {}", e),
            )
        })?;

    if let Some(err) = check_active_cooldown(account_key) {
        return Err(err);
    }

    let gap = min_gap_ms();
    if gap > 0 {
        let wait_ms = {
            let lock = AGY_LAST_REQ_MS.get_or_init(|| Mutex::new(0));
            let mut last = lock.lock().unwrap_or_else(|e| e.into_inner());
            let now = now_ms();
            let next_allowed = last.saturating_add(gap);
            if now < next_allowed {
                let delta = next_allowed - now;
                *last = next_allowed;
                delta
            } else {
                *last = now;
                0
            }
        };
        if wait_ms > 0 {
            tokio::time::sleep(Duration::from_millis(wait_ms)).await;
        }
    }

    Ok(permit)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cloaks_client_tools_with_ide_suffix_and_preserves_native_tools() {
        let client_decls = vec![
            json!({
                "name": "read_file",
                "description": "Reads a file",
                "parameters": { "type": "object", "properties": {} }
            }),
            json!({
                "name": "run_command",
                "description": "Runs shell",
                "parameters": { "type": "object", "properties": {} }
            }),
        ];
        let cloaked = build_cloaked_tools(client_decls);
        assert_eq!(
            cloaked.orig_to_cloaked.get("read_file").map(String::as_str),
            Some("read_file_ide")
        );
        assert_eq!(
            cloaked.orig_to_cloaked.get("run_command").map(String::as_str),
            Some("run_command")
        );
        assert_eq!(
            uncloak_tool_name("read_file_ide", &cloaked.cloaked_to_orig),
            "read_file"
        );
        assert_eq!(
            uncloak_tool_name("run_command", &cloaked.cloaked_to_orig),
            "run_command"
        );
        assert_eq!(cloaked.declarations.len(), AG_DEFAULT_TOOLS.len() + 1);
        assert!(cloaked
            .declarations
            .iter()
            .any(|d| d["name"] == "browser_subagent"
                && d["description"] == "This tool is currently unavailable."));
    }

    #[test]
    fn sanitize_system_prompt_strips_billing_header_and_opencode_branding() {
        let raw = "x-anthropic-billing-header: foo=bar\nYou are a Claude agent, built on Anthropic's Claude Agent SDK.\nPowered by OpenCode and opencode.";
        let cleaned = sanitize_antigravity_system_prompt(raw);
        assert!(!cleaned.to_ascii_lowercase().contains("x-anthropic-billing-header"));
        assert!(!cleaned.contains("Claude Agent SDK"));
        assert_eq!(cleaned, "Powered by Antigravity and antigravity.");
    }

    #[test]
    fn numeric_session_id_is_negative_integer_string() {
        let sid = to_numeric_session_id("aicode-consumers:user@example.com");
        assert!(sid.starts_with('-'));
        assert!(sid[1..].chars().all(|c| c.is_ascii_digit()));
        assert_eq!(
            sid,
            to_numeric_session_id("aicode-consumers:user@example.com")
        );
    }

    #[test]
    fn records_and_clears_tos_and_429_cooldowns() {
        let acct = "cooldown-unit-test@example.com";
        clear_antigravity_cooldown(acct);
        assert!(check_active_cooldown(acct).is_none());

        record_upstream_outcome(
            acct,
            StatusCode::FORBIDDEN,
            r#"{"error":{"details":[{"reason":"TOS_VIOLATION"}]}}"#,
        );
        let err = check_active_cooldown(acct).expect("403 TOS should activate cooldown");
        assert_eq!(err.0, StatusCode::TOO_MANY_REQUESTS);
        assert!(err.1.contains("TOS_VIOLATION"));

        record_upstream_outcome(acct, StatusCode::OK, "");
        assert!(check_active_cooldown(acct).is_none());

        record_upstream_outcome(
            acct,
            StatusCode::TOO_MANY_REQUESTS,
            r#"{"error":{"details":[{"retryDelay":"7s"}]}}"#,
        );
        assert!(check_active_cooldown(acct).is_some());
        clear_antigravity_cooldown(acct);
    }
}

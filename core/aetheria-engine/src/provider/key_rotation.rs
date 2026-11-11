//! Multi-Key API Pool Rotation & Per-Key Quota Cooldown Registry.
//! Isolated into its own single-purpose file so API key pool management is independent of protocol translation.

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

use crate::paths::now_ms;

static KEY_COOLDOWNS: OnceLock<Mutex<HashMap<String, u64>>> = OnceLock::new();

fn cooldown_map() -> &'static Mutex<HashMap<String, u64>> {
    KEY_COOLDOWNS.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Splits a comma/semicolon-separated API key string and selects the first key not on cooldown.
pub fn select_healthy_api_key(raw_keys: &str) -> String {
    let candidates: Vec<&str> = raw_keys
        .split([',', ';'])
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .collect();
    if candidates.len() <= 1 {
        return raw_keys.trim().to_string();
    }
    let now = now_ms();
    let mut map = cooldown_map().lock().unwrap_or_else(|e| e.into_inner());
    map.retain(|_, &mut expires_at| expires_at > now);

    for key in &candidates {
        if !map.contains_key(*key) {
            return (*key).to_string();
        }
    }
    candidates[0].to_string()
}

/// Marks a specific API key as rate-limited/exhausted for `cooldown_ms` and returns the next healthy key if multiple exist.
pub fn rotate_api_key_on_quota(
    raw_keys: &str,
    failed_key: &str,
    cooldown_ms: u64,
) -> Option<String> {
    let candidates: Vec<&str> = raw_keys
        .split([',', ';'])
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .collect();
    if candidates.len() <= 1 {
        return None;
    }
    {
        let mut map = cooldown_map().lock().unwrap_or_else(|e| e.into_inner());
        map.insert(failed_key.trim().to_string(), now_ms() + cooldown_ms);
    }
    let next = select_healthy_api_key(raw_keys);
    if next != failed_key.trim() {
        Some(next)
    } else {
        None
    }
}


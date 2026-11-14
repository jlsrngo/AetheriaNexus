//! Credential token refresh logic for OAuth providers (Codex, Claude, Kiro, Antigravity).

use super::harvest::{harvest_all, harvest_antigravity, harvest_kiro};
use super::oauth::{
    url_encode, ANTIGRAVITY_OAUTH_CLIENT_ID, ANTIGRAVITY_OAUTH_CLIENT_SECRET, ANTIGRAVITY_TOKEN_URL,
};
use super::store::{decode_jwt_payload, get_credential, is_expired, set_credential};
use super::types::CredentialEntry;
use crate::paths::{now_iso, now_ms};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::future::Future;
use std::sync::{Arc, Mutex as StdMutex, OnceLock};
use tokio::sync::Mutex as AsyncMutex;

static REFRESH_SOURCE_LOCKS: OnceLock<StdMutex<HashMap<String, Arc<AsyncMutex<()>>>>> =
    OnceLock::new();

fn refresh_lock_for_source(source: &str) -> Arc<AsyncMutex<()>> {
    let map = REFRESH_SOURCE_LOCKS.get_or_init(|| StdMutex::new(HashMap::new()));
    let mut guard = map.lock().unwrap_or_else(|e| e.into_inner());
    guard
        .entry(source.to_string())
        .or_insert_with(|| Arc::new(AsyncMutex::new(())))
        .clone()
}

pub async fn ensure_fresh_credential(source: &str) -> Option<CredentialEntry> {
    ensure_fresh_with(
        source,
        || get_credential(source),
        || {
            let _ = harvest_all();
        },
        |s, entry| async move { refresh_credential_source(&s, &entry).await },
    )
    .await
}

/// Deduplicates concurrent OAuth refreshes per provider source (`single-flight`) so parallel
/// subagents never race or invalidate shared refresh tokens.
async fn ensure_fresh_with<Get, Harv, Ref, Fut>(
    source: &str,
    get_cached: Get,
    harvest_fn: Harv,
    refresh_fn: Ref,
) -> Option<CredentialEntry>
where
    Get: Fn() -> Option<CredentialEntry>,
    Harv: Fn(),
    Ref: Fn(String, CredentialEntry) -> Fut,
    Fut: Future<Output = Option<CredentialEntry>>,
{
    let mut entry = get_cached();
    if entry.is_none() {
        harvest_fn();
        entry = get_cached();
    }
    let initial = entry?;

    if source == "opencode" {
        return Some(initial);
    }

    if !is_expired(&initial, 5 * 60 * 1000) {
        return Some(initial);
    }

    let source_lock = refresh_lock_for_source(source);
    let _single_flight = source_lock.lock().await;

    // Re-check after acquiring the per-source lock: a sibling subagent may have refreshed already.
    let current = get_cached().unwrap_or_else(|| initial.clone());
    if !is_expired(&current, 5 * 60 * 1000) {
        return Some(current);
    }

    if let Some(refreshed) = refresh_fn(source.to_string(), current.clone()).await {
        return Some(refreshed);
    }

    harvest_fn();
    if let Some(reharvested) = get_cached() {
        if !is_expired(&reharvested, 0) {
            return Some(reharvested);
        }
    }
    if !is_expired(&current, 0) {
        Some(current)
    } else {
        None
    }
}

async fn refresh_antigravity_oauth_token(
    client: &reqwest::Client,
    entry: &CredentialEntry,
    token_url: &str,
) -> Option<CredentialEntry> {
    let rt = entry.refresh_token.as_deref().filter(|s| !s.is_empty())?;
    let cid = entry
        .client_id
        .as_deref()
        .filter(|s| !s.is_empty())
        .unwrap_or(ANTIGRAVITY_OAUTH_CLIENT_ID);
    let csec = entry
        .client_secret
        .as_deref()
        .filter(|s| !s.is_empty())
        .unwrap_or(ANTIGRAVITY_OAUTH_CLIENT_SECRET);

    let form_body = format!(
        "grant_type=refresh_token&refresh_token={}&client_id={}&client_secret={}",
        url_encode(rt),
        url_encode(cid),
        url_encode(csec),
    );
    let resp = client
        .post(token_url)
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(form_body)
        .send()
        .await
        .ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let data: Value = resp.json().await.ok()?;
    let new_at = data
        .get("access_token")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())?
        .to_string();
    let new_rt = data
        .get("refresh_token")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .or_else(|| entry.refresh_token.clone());
    let expires_in = data
        .get("expires_in")
        .and_then(|v| v.as_u64())
        .unwrap_or(3600);

    Some(CredentialEntry {
        source: "antigravity".to_string(),
        access_token: new_at,
        refresh_token: new_rt,
        expires_at: Some(now_ms() + expires_in * 1000),
        client_id: Some(cid.to_string()),
        client_secret: Some(csec.to_string()),
        region: entry.region.clone(),
        profile_arn: entry.profile_arn.clone(),
        account_id: entry.account_id.clone(),
        account_email: entry.account_email.clone(),
        account_info: entry.account_info.clone(),
        updated_at: now_iso(),
        auto_harvested: entry.auto_harvested,
    })
}

pub async fn refresh_credential_source(
    source: &str,
    entry: &CredentialEntry,
) -> Option<CredentialEntry> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .ok()?;

    match source {
        "antigravity" => {
            let token_url = std::env::var("AETHERIA_ANTIGRAVITY_TOKEN_URL")
                .unwrap_or_else(|_| ANTIGRAVITY_TOKEN_URL.to_string());
            if let Some(updated) = refresh_antigravity_oauth_token(&client, entry, &token_url).await {
                set_credential(updated.clone());
                return Some(updated);
            }
            if !entry.auto_harvested {
                return None;
            }
            if let Some(fresh) = harvest_antigravity() {
                if !is_expired(&fresh, 60_000) {
                    set_credential(fresh.clone());
                    return Some(fresh);
                }
            }
            let _ = tokio::task::spawn_blocking(|| {
                #[cfg(windows)]
                use std::os::windows::process::CommandExt;
                #[cfg(windows)]
                const CREATE_NO_WINDOW: u32 = 0x08000000;

                let mut cmd = std::process::Command::new("agy");
                cmd.arg("models");
                #[cfg(windows)]
                cmd.creation_flags(CREATE_NO_WINDOW);
                cmd.output()
            })
            .await;
            if let Some(fresh) = harvest_antigravity() {
                set_credential(fresh.clone());
                return Some(fresh);
            }
            None
        }
        "kiro" => {
            let mut cur = entry.clone();
            if cur.refresh_token.is_none() || cur.client_id.is_none() || cur.client_secret.is_none()
            {
                if let Some(h) = harvest_kiro() {
                    cur = h;
                }
            }
            let cid_opt = cur.client_id.as_ref();
            let csec_opt = cur.client_secret.as_ref();
            let rt_opt = cur.refresh_token.as_ref();
            let region = cur.region.as_deref().unwrap_or("us-east-1");
            let url = format!("https://oidc.{}.amazonaws.com/token", region);

            if let (Some(cid), Some(csec), Some(rt)) = (cid_opt, csec_opt, rt_opt) {
                if let Ok(resp) = client
                    .post(&url)
                    .json(&json!({
                        "clientId": cid,
                        "clientSecret": csec,
                        "grantType": "refresh_token",
                        "refreshToken": rt,
                    }))
                    .send()
                    .await
                {
                    if resp.status().is_success() {
                        if let Ok(data) = resp.json::<Value>().await {
                            if let Some(new_at) = data.get("accessToken").and_then(|v| v.as_str()) {
                                let new_rt = data
                                    .get("refreshToken")
                                    .and_then(|v| v.as_str())
                                    .map(|s| s.to_string())
                                    .or_else(|| cur.refresh_token.clone());
                                let expires_in = data
                                    .get("expiresIn")
                                    .and_then(|v| v.as_u64())
                                    .unwrap_or(3600);

                                let updated = CredentialEntry {
                                    source: "kiro".to_string(),
                                    access_token: new_at.to_string(),
                                    refresh_token: new_rt,
                                    expires_at: Some(now_ms() + expires_in * 1000),
                                    client_id: Some(cid.clone()),
                                    client_secret: Some(csec.clone()),
                                    region: Some(region.to_string()),
                                    profile_arn: cur.profile_arn.clone(),
                                    account_id: cur.account_id.clone(),
                                    account_email: cur.account_email.clone(),
                                    account_info: cur.account_info.clone(),
                                    updated_at: now_iso(),
                                    auto_harvested: cur.auto_harvested,
                                };
                                set_credential(updated.clone());
                                return Some(updated);
                            }
                        }
                    }
                }
            }

            if let Some(h) = harvest_kiro() {
                if !is_expired(&h, 0) {
                    set_credential(h.clone());
                    return Some(h);
                }
            }

            None
        }
        "codex" => {
            let rt = entry.refresh_token.as_ref()?;
            let resp = client
                .post("https://auth.openai.com/oauth/token")
                .json(&json!({
                    "grant_type": "refresh_token",
                    "refresh_token": rt,
                    "client_id": "app_EMoamEEZ73f0CkXaXp7hrann",
                }))
                .send()
                .await
                .ok()?;
            if !resp.status().is_success() {
                return None;
            }
            let data: Value = resp.json().await.ok()?;
            let new_at = data
                .get("access_token")
                .and_then(|v| v.as_str())?
                .to_string();
            let new_rt = data
                .get("refresh_token")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .or_else(|| entry.refresh_token.clone());
            let expires_at = decode_jwt_payload(&new_at)
                .and_then(|p| p.get("exp").and_then(|v| v.as_u64()))
                .map(|exp| exp * 1000)
                .or_else(|| {
                    data.get("expires_in")
                        .and_then(|v| v.as_u64())
                        .map(|s| now_ms() + s * 1000)
                });
            let updated = CredentialEntry {
                source: "codex".to_string(),
                access_token: new_at,
                refresh_token: new_rt,
                expires_at,
                client_id: None,
                client_secret: None,
                region: None,
                profile_arn: entry.profile_arn.clone(),
                account_id: entry.account_id.clone(),
                account_email: entry.account_email.clone(),
                account_info: entry.account_info.clone(),
                updated_at: now_iso(),
                auto_harvested: entry.auto_harvested,
            };
            set_credential(updated.clone());
            Some(updated)
        }
        "claude" => {
            let rt = entry.refresh_token.as_ref()?;
            let resp = client
                .post("https://console.anthropic.com/v1/oauth/token")
                .json(&json!({
                    "grant_type": "refresh_token",
                    "refresh_token": rt,
                    "client_id": "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
                }))
                .send()
                .await
                .ok()?;
            if !resp.status().is_success() {
                return None;
            }
            let data: Value = resp.json().await.ok()?;
            let new_at = data
                .get("access_token")
                .and_then(|v| v.as_str())?
                .to_string();
            let new_rt = data
                .get("refresh_token")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .or_else(|| entry.refresh_token.clone());
            let expires_in = data
                .get("expires_in")
                .and_then(|v| v.as_u64())
                .unwrap_or(3600);
            let updated = CredentialEntry {
                source: "claude".to_string(),
                access_token: new_at,
                refresh_token: new_rt,
                expires_at: Some(now_ms() + expires_in * 1000),
                client_id: None,
                client_secret: None,
                region: None,
                profile_arn: entry.profile_arn.clone(),
                account_id: entry.account_id.clone(),
                account_email: entry.account_email.clone(),
                account_info: entry.account_info.clone(),
                updated_at: now_iso(),
                auto_harvested: entry.auto_harvested,
            };
            set_credential(updated.clone());
            Some(updated)
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::time::Duration;

    #[tokio::test]
    async fn single_flight_deduplicates_concurrent_oauth_refreshes() {
        let state = Arc::new(StdMutex::new(Some(CredentialEntry {
            source: "single-flight-test".to_string(),
            access_token: "stale-token".to_string(),
            expires_at: Some(now_ms().saturating_sub(10_000)),
            ..Default::default()
        })));
        let refresh_calls = Arc::new(AtomicUsize::new(0));

        let spawn_caller = || {
            let state_get = Arc::clone(&state);
            let state_ref = Arc::clone(&state);
            let refresh_calls = Arc::clone(&refresh_calls);
            async move {
                ensure_fresh_with(
                    "single-flight-test",
                    move || state_get.lock().unwrap().clone(),
                    || {},
                    move |src, mut cur| {
                        let state_inner = Arc::clone(&state_ref);
                        let refresh_calls = Arc::clone(&refresh_calls);
                        async move {
                            refresh_calls.fetch_add(1, Ordering::SeqCst);
                            tokio::time::sleep(Duration::from_millis(60)).await;
                            cur.source = src;
                            cur.access_token = "fresh-token".to_string();
                            cur.expires_at = Some(now_ms() + 3_600_000);
                            *state_inner.lock().unwrap() = Some(cur.clone());
                            Some(cur)
                        }
                    },
                )
                .await
            }
        };

        let (r1, r2, r3, r4) = tokio::join!(
            spawn_caller(),
            spawn_caller(),
            spawn_caller(),
            spawn_caller()
        );

        assert_eq!(refresh_calls.load(Ordering::SeqCst), 1);
        for res in [r1, r2, r3, r4] {
            let entry = res.expect("fresh token should be returned");
            assert_eq!(entry.access_token, "fresh-token");
        }
    }
}


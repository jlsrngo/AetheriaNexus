//! Credential token refresh logic for OAuth providers (Codex, Claude, Kiro, Antigravity).

use super::harvest::{harvest_all, harvest_antigravity, harvest_kiro};
use super::store::{decode_jwt_payload, get_credential, is_expired, set_credential};
use super::types::CredentialEntry;
use crate::paths::{now_iso, now_ms};
use serde_json::{json, Value};

pub async fn ensure_fresh_credential(source: &str) -> Option<CredentialEntry> {
    let mut entry = get_credential(source);
    if entry.is_none() {
        harvest_all();
        entry = get_credential(source);
    }
    let entry = entry?;

    if source == "opencode" {
        return Some(entry);
    }

    if !is_expired(&entry, 5 * 60 * 1000) {
        return Some(entry);
    }

    if let Some(refreshed) = refresh_credential_source(source, &entry).await {
        return Some(refreshed);
    }

    harvest_all();
    let reharvested = get_credential(source)?;
    if !is_expired(&reharvested, 0) {
        return Some(reharvested);
    }
    if !is_expired(&entry, 0) {
        Some(entry)
    } else {
        None
    }
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


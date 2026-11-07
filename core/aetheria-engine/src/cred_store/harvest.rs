//! Automated harvesting of credentials from local developer CLIs (Codex, Claude, OpenCode, Kiro, Antigravity).

use super::store::{decode_jwt_payload, parse_iso_to_ms, read_windows_generic_credential, save_store_to_disk, with_store};
use super::types::CredentialEntry;
use crate::paths::{home_dir, now_iso};
use serde_json::Value;
use std::collections::HashMap;

pub fn harvest_codex() -> Option<CredentialEntry> {
    let auth_path = home_dir().join(".codex").join("auth.json");
    let raw = std::fs::read_to_string(auth_path).ok()?;
    let data: Value = serde_json::from_str(&raw).ok()?;
    let access_token = data
        .pointer("/tokens/access_token")
        .and_then(|v| v.as_str())?
        .to_string();
    let refresh_token = data
        .pointer("/tokens/refresh_token")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let expires_at = decode_jwt_payload(&access_token)
        .and_then(|p| p.get("exp").and_then(|v| v.as_u64()))
        .map(|exp| exp * 1000);

    Some(CredentialEntry {
        source: "codex".to_string(),
        access_token,
        refresh_token,
        expires_at,
        client_id: None,
        client_secret: None,
        region: None,
        account_info: None,
        updated_at: now_iso(),
        auto_harvested: true,
        ..Default::default()
    })
}

pub fn harvest_claude() -> Option<CredentialEntry> {
    let cred_path = home_dir().join(".claude").join(".credentials.json");
    let raw = std::fs::read_to_string(cred_path).ok()?;
    let data: Value = serde_json::from_str(&raw).ok()?;
    let oauth = data.get("claudeAiOauth")?;
    let access_token = oauth.get("accessToken").and_then(|v| v.as_str())?.to_string();
    let refresh_token = oauth
        .get("refreshToken")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let expires_at = oauth.get("expiresAt").and_then(|v| v.as_u64());
    let sub_type = oauth
        .get("subscriptionType")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");

    Some(CredentialEntry {
        source: "claude".to_string(),
        access_token,
        refresh_token,
        expires_at,
        client_id: None,
        client_secret: None,
        region: None,
        account_info: Some(format!("subscription: {}", sub_type)),
        updated_at: now_iso(),
        auto_harvested: true,
        ..Default::default()
    })
}

pub fn harvest_opencode() -> Option<CredentialEntry> {
    let auth_path = home_dir()
        .join(".local")
        .join("share")
        .join("opencode")
        .join("auth.json");
    let raw = std::fs::read_to_string(auth_path).ok()?;
    let data: Value = serde_json::from_str(&raw).ok()?;
    if let Some(oc) = data.get("opencode") {
        let token = oc
            .get("access")
            .or_else(|| oc.get("key"))
            .or_else(|| oc.get("token"))
            .and_then(|v| v.as_str())?;
        let expires_at = oc
            .get("expires")
            .and_then(|v| v.as_u64())
            .filter(|&e| e > 0);
        return Some(CredentialEntry {
            source: "opencode".to_string(),
            access_token: token.to_string(),
            refresh_token: oc
                .get("refresh")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            expires_at,
            client_id: None,
            client_secret: None,
            region: None,
            account_info: Some("provider: opencode".to_string()),
            updated_at: now_iso(),
            auto_harvested: true,
            ..Default::default()
        });
    }
    None
}

pub fn harvest_kiro() -> Option<CredentialEntry> {
    let sso_dir = home_dir().join(".aws").join("sso").join("cache");
    let entries = std::fs::read_dir(&sso_dir).ok()?;
    let mut best_entry: Option<CredentialEntry> = None;
    let mut best_exp: u64 = 0;
    let mut client_id: Option<String> = None;
    let mut client_secret: Option<String> = None;
    let mut region: Option<String> = None;

    for item in entries.flatten() {
        let path = item.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        if let Ok(raw) = std::fs::read_to_string(&path) {
            if let Ok(data) = serde_json::from_str::<Value>(&raw) {
                if let (Some(cid), Some(csec)) = (
                    data.get("clientId").and_then(|v| v.as_str()),
                    data.get("clientSecret").and_then(|v| v.as_str()),
                ) {
                    if data.get("accessToken").is_none() {
                        client_id = Some(cid.to_string());
                        client_secret = Some(csec.to_string());
                        if let Some(r) = data.get("region").and_then(|v| v.as_str()) {
                            region = Some(r.to_string());
                        }
                    }
                }
                if let Some(at) = data.get("accessToken").and_then(|v| v.as_str()) {
                    let exp = data
                        .get("expiresAt")
                        .and_then(|v| v.as_str())
                        .and_then(parse_iso_to_ms)
                        .unwrap_or(0);
                    if exp >= best_exp {
                        best_exp = exp;
                        best_entry = Some(CredentialEntry {
                            source: "kiro".to_string(),
                            access_token: at.to_string(),
                            refresh_token: data
                                .get("refreshToken")
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string()),
                            expires_at: if exp > 0 { Some(exp) } else { None },
                            client_id: data
                                .get("clientId")
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string()),
                            client_secret: data
                                .get("clientSecret")
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string()),
                            region: data
                                .get("region")
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string()),
                            account_info: None,
                            updated_at: now_iso(),
                            auto_harvested: true,
                            ..Default::default()
                        });
                    }
                }
            }
        }
    }

    if let Some(mut entry) = best_entry {
        if entry.client_id.is_none() {
            entry.client_id = client_id;
        }
        if entry.client_secret.is_none() {
            entry.client_secret = client_secret;
        }
        if entry.region.is_none() {
            entry.region = Some(region.unwrap_or_else(|| "us-east-1".to_string()));
        }
        return Some(entry);
    }
    None
}

pub fn harvest_antigravity() -> Option<CredentialEntry> {
    let raw = read_windows_generic_credential("gemini:antigravity")?;
    let trimmed = raw.trim_matches(char::from(0)).trim();
    let idx = trimmed.find('{')?;
    let data: Value = serde_json::from_str(&trimmed[idx..]).ok()?;
    let token_obj = data.get("token")?;
    let access_token = token_obj
        .get("access_token")
        .and_then(|v| v.as_str())?
        .to_string();
    let refresh_token = token_obj
        .get("refresh_token")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let expires_at = token_obj
        .get("expiry")
        .and_then(|v| v.as_str())
        .and_then(parse_iso_to_ms);

    let mut account_email = data
        .get("id_token_email")
        .or_else(|| data.get("email"))
        .or_else(|| data.get("user"))
        .or_else(|| data.get("account"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .or_else(|| {
            token_obj
                .get("id_token")
                .and_then(|v| v.as_str())
                .and_then(decode_jwt_payload)
                .and_then(|p| p.get("email").and_then(|v| v.as_str()).map(|s| s.to_string()))
        });

    if account_email.is_none() {
        for word in trimmed.split(|c: char| c == '"' || c == ' ' || c == ',' || c == '\n') {
            if word.contains('@') && word.contains('.') && !word.contains('/') && !word.contains('\\') && word.len() >= 5 {
                account_email = Some(word.to_string());
                break;
            }
        }
    }

    let account_info = account_email
        .as_ref()
        .cloned()
        .or_else(|| Some("Google Cloud Code (agy)".to_string()));

    Some(CredentialEntry {
        source: "antigravity".to_string(),
        access_token,
        refresh_token,
        expires_at,
        client_id: None,
        client_secret: None,
        region: None,
        account_email,
        account_info,
        updated_at: now_iso(),
        auto_harvested: true,
        ..Default::default()
    })
}

pub fn harvest_all() -> HashMap<String, bool> {
    let mut results = HashMap::new();
    let harvesters: [(&str, fn() -> Option<CredentialEntry>); 5] = [
        ("codex", harvest_codex),
        ("claude", harvest_claude),
        ("opencode", harvest_opencode),
        ("kiro", harvest_kiro),
        ("antigravity", harvest_antigravity),
    ];

    with_store(|store| {
        let mut changed = false;
        for (name, func) in harvesters {
            if let Some(harvested) = func() {
                let should_update = match store.entries.get(name) {
                    None => true,
                    Some(existing) => {
                        if !existing.auto_harvested && existing.account_email.is_some() && existing.expires_at.unwrap_or(0) >= harvested.expires_at.unwrap_or(0) {
                            false
                        } else {
                            let h_exp = harvested.expires_at.unwrap_or(0);
                            let e_exp = existing.expires_at.unwrap_or(0);
                            h_exp > e_exp
                                || harvested.access_token != existing.access_token
                                || (existing.account_email.is_none() && harvested.account_email.is_some())
                                || harvested.account_email != existing.account_email
                                || harvested.account_info != existing.account_info
                        }
                    }
                };
                if should_update {
                    store.entries.insert(name.to_string(), harvested);
                    changed = true;
                }
                results.insert(name.to_string(), true);
            } else {
                results.insert(name.to_string(), store.entries.contains_key(name));
            }
        }
        if changed {
            save_store_to_disk(store);
        }
    });

    results
}


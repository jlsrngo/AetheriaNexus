//! OAuth browser login and device authorization flows.

use super::store::{decode_jwt_payload, register_local_cli_to_config, set_credential};
use super::types::{CredentialEntry, OauthResult};
use crate::paths::{gen_id, now_iso, now_ms};
use base64::Engine as _;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

static OAUTH_RESULTS: OnceLock<Mutex<HashMap<String, OauthResult>>> = OnceLock::new();

pub fn update_oauth_result(res: OauthResult) {
    let m = OAUTH_RESULTS.get_or_init(|| Mutex::new(HashMap::new()));
    if let Ok(mut guard) = m.lock() {
        guard.insert(res.request_id.clone(), res);
    }
}

pub fn get_oauth_status(request_id: &str) -> Option<OauthResult> {
    let m = OAUTH_RESULTS.get_or_init(|| Mutex::new(HashMap::new()));
    m.lock().ok()?.get(request_id).cloned()
}

pub fn open_browser_url(url: &str) {
    #[cfg(windows)]
    {
        let _ = std::process::Command::new("rundll32.exe")
            .args(["url.dll,FileProtocolHandler", url])
            .spawn();
    }
    #[cfg(not(windows))]
    {
        let _ = std::process::Command::new("xdg-open").arg(url).spawn();
    }
}

pub fn generate_pkce_pair() -> (String, String) {
    let seed = format!(
        "{}-{}-{}-pkce-aetheria-rust",
        now_ms(),
        std::process::id(),
        gen_id("pkce")
    );
    let mut hasher1 = Sha256::new();
    hasher1.update(seed.as_bytes());
    let hash1 = hasher1.finalize();
    let mut hasher2 = Sha256::new();
    hasher2.update(&hash1);
    hasher2.update(b"aetheria-verifier");
    let hash2 = hasher2.finalize();
    let mut combined = Vec::with_capacity(64);
    combined.extend_from_slice(&hash1);
    combined.extend_from_slice(&hash2);
    let verifier = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(&combined[..48]);

    let mut ch_hasher = Sha256::new();
    ch_hasher.update(verifier.as_bytes());
    let challenge = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(ch_hasher.finalize());
    (verifier, challenge)
}

pub fn url_encode(s: &str) -> String {
    let mut out = String::new();
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char);
            }
            _ => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}

pub async fn start_oauth_session(target: &str, open_browser: bool) -> Result<Value, String> {
    let request_id = gen_id("oauth");
    let target_str = target.to_string();

    if target == "kiro" {
        let region = "us-east-1";
        let oidc_base = format!("https://oidc.{}.amazonaws.com", region);
        let start_url = "https://view.awsapps.com/start";
        let scopes = vec![
            "codewhisperer:completions",
            "codewhisperer:analysis",
            "codewhisperer:conversations",
            "codewhisperer:transformations",
            "codewhisperer:taskassist",
        ];

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .build()
            .map_err(|e| e.to_string())?;

        let reg_resp = client
            .post(format!("{}/client/register", oidc_base))
            .json(&json!({
                "clientName": "Kiro IDE",
                "clientType": "public",
                "scopes": scopes,
                "grantTypes": ["urn:ietf:params:oauth:grant-type:device_code", "refresh_token"]
            }))
            .send()
            .await
            .map_err(|e| format!("Kiro client registration failed: {}", e))?;

        if !reg_resp.status().is_success() {
            return Err(format!("Kiro register returned HTTP {}", reg_resp.status()));
        }
        let reg_json: Value = reg_resp.json().await.map_err(|e| e.to_string())?;
        let client_id = reg_json
            .get("clientId")
            .and_then(|v| v.as_str())
            .ok_or("Missing clientId")?
            .to_string();
        let client_secret = reg_json
            .get("clientSecret")
            .and_then(|v| v.as_str())
            .ok_or("Missing clientSecret")?
            .to_string();

        let dev_resp = client
            .post(format!("{}/device_authorization", oidc_base))
            .json(&json!({
                "clientId": client_id,
                "clientSecret": client_secret,
                "startUrl": start_url
            }))
            .send()
            .await
            .map_err(|e| format!("Kiro device authorization failed: {}", e))?;

        if !dev_resp.status().is_success() {
            return Err(format!(
                "Kiro device_authorization returned HTTP {}",
                dev_resp.status()
            ));
        }
        let dev_json: Value = dev_resp.json().await.map_err(|e| e.to_string())?;
        let device_code = dev_json
            .get("deviceCode")
            .and_then(|v| v.as_str())
            .ok_or("Missing deviceCode")?
            .to_string();
        let auth_url = dev_json
            .get("verificationUriComplete")
            .or_else(|| dev_json.get("verificationUri"))
            .and_then(|v| v.as_str())
            .ok_or("Missing verificationUri")?
            .to_string();
        let interval_secs = dev_json
            .get("interval")
            .and_then(|v| v.as_u64())
            .unwrap_or(5)
            .max(2);

        update_oauth_result(OauthResult {
            request_id: request_id.clone(),
            target: target_str.clone(),
            status: "pending".to_string(),
            message: "Waiting for AWS Builder ID confirmation in browser...".to_string(),
            auth_url: Some(auth_url.clone()),
            updated_at: now_ms(),
        });

        if open_browser {
            open_browser_url(&auth_url);
        }

        let req_id_clone = request_id.clone();
        tokio::spawn(async move {
            let deadline = now_ms() + 5 * 60 * 1000;
            while now_ms() < deadline {
                tokio::time::sleep(std::time::Duration::from_secs(interval_secs)).await;
                let poll = client
                    .post(format!("{}/token", oidc_base))
                    .json(&json!({
                        "clientId": client_id,
                        "clientSecret": client_secret,
                        "grantType": "urn:ietf:params:oauth:grant-type:device_code",
                        "deviceCode": device_code
                    }))
                    .send()
                    .await;
                if let Ok(resp) = poll {
                    if resp.status().is_success() {
                        if let Ok(tok_data) = resp.json::<Value>().await {
                            if let Some(at) = tok_data.get("accessToken").and_then(|v| v.as_str()) {
                                let rt = tok_data
                                    .get("refreshToken")
                                    .and_then(|v| v.as_str())
                                    .map(|s| s.to_string());
                                let exp_in = tok_data
                                    .get("expiresIn")
                                    .and_then(|v| v.as_u64())
                                    .unwrap_or(3600);
                                set_credential(CredentialEntry {
                                    source: "kiro".to_string(),
                                    access_token: at.to_string(),
                                    refresh_token: rt,
                                    expires_at: Some(now_ms() + exp_in * 1000),
                                    client_id: Some(client_id.clone()),
                                    client_secret: Some(client_secret.clone()),
                                    region: Some(region.to_string()),
                                    account_info: Some("AWS Builder ID".to_string()),
                                    updated_at: now_iso(),
                                    auto_harvested: false,
                                    ..Default::default()
                                });
                                register_local_cli_to_config(crate::bridge::LOCAL_CLI_BRIDGE_PORT);
                                update_oauth_result(OauthResult {
                                    request_id: req_id_clone,
                                    target: "kiro".to_string(),
                                    status: "success".to_string(),
                                    message: "Signed in to Kiro (AWS) via browser OAuth!".to_string(),
                                    auth_url: None,
                                    updated_at: now_ms(),
                                });
                                return;
                            }
                        }
                    }
                }
            }
            update_oauth_result(OauthResult {
                request_id: req_id_clone,
                target: "kiro".to_string(),
                status: "error".to_string(),
                message: "Kiro OAuth timed out.".to_string(),
                auth_url: None,
                updated_at: now_ms(),
            });
        });

        return Ok(json!({
            "requestId": request_id,
            "target": target_str,
            "authUrl": auth_url
        }));
    }

    if target == "codex" || target == "claude" {
        let (verifier, challenge) = generate_pkce_pair();
        let state = gen_id("st");
        let bind_addr = if target == "codex" {
            "127.0.0.1:1455"
        } else {
            "127.0.0.1:0"
        };
        let listener = match tokio::net::TcpListener::bind(bind_addr).await {
            Ok(l) => l,
            Err(_) => tokio::net::TcpListener::bind("127.0.0.1:0")
                .await
                .map_err(|e| format!("Failed to bind local OAuth callback port: {}", e))?,
        };
        let port = listener.local_addr().map_err(|e| e.to_string())?.port();
        let callback_path = if target == "codex" {
            "/auth/callback"
        } else {
            "/callback"
        };
        let redirect_uri = format!("http://localhost:{}{}", port, callback_path);

        let (auth_endpoint, token_endpoint, client_id, scopes) = if target == "codex" {
            (
                "https://auth.openai.com/oauth/authorize",
                "https://auth.openai.com/oauth/token",
                "app_EMoamEEZ73f0CkXaXp7hrann",
                "openid profile email offline_access api.connectors.read api.connectors.invoke",
            )
        } else {
            (
                "https://claude.ai/oauth/authorize",
                "https://console.anthropic.com/v1/oauth/token",
                "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
                "org:create_api_key user:profile user:inference",
            )
        };

        let mut auth_url = format!(
            "{}?response_type=code&client_id={}&redirect_uri={}&scope={}&state={}&code_challenge={}&code_challenge_method=S256",
            auth_endpoint,
            url_encode(client_id),
            url_encode(&redirect_uri),
            url_encode(scopes),
            url_encode(&state),
            url_encode(&challenge)
        );
        if target == "codex" {
            auth_url.push_str("&id_token_add_organizations=true&codex_cli_simplified_flow=true");
        } else {
            auth_url.push_str("&code=true");
        }

        update_oauth_result(OauthResult {
            request_id: request_id.clone(),
            target: target_str.clone(),
            status: "pending".to_string(),
            message: "Waiting for browser OAuth login...".to_string(),
            auth_url: Some(auth_url.clone()),
            updated_at: now_ms(),
        });

        if open_browser {
            open_browser_url(&auth_url);
        }

        let req_id_clone = request_id.clone();
        let target_clone = target_str.clone();
        let client_id_str = client_id.to_string();
        let token_ep_str = token_endpoint.to_string();
        let redirect_clone = redirect_uri.clone();

        tokio::spawn(async move {
            let accept_res = tokio::time::timeout(
                std::time::Duration::from_secs(300),
                listener.accept(),
            )
            .await;

            if let Ok(Ok((mut stream, _))) = accept_res {
                let mut buf = vec![0u8; 4096];
                let n = stream.read(&mut buf).await.unwrap_or(0);
                let req_str = String::from_utf8_lossy(&buf[..n]);
                let first_line = req_str.lines().next().unwrap_or("");
                let path_part = first_line.split_whitespace().nth(1).unwrap_or("");
                let mut code_opt = None;
                if let Some((_, query)) = path_part.split_once('?') {
                    for pair in query.split('&') {
                        if let Some((k, v)) = pair.split_once('=') {
                            if k == "code" {
                                code_opt = Some(v.to_string());
                            }
                        }
                    }
                }

                let html = "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\n\r\n<!DOCTYPE html><html><body style=\"background:#0c0c0e;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0\"><div style=\"text-align:center;padding:32px;border:1px solid #27272a;border-radius:16px\"><h2>Signed in to Aetheria</h2><p style=\"color:#a1a1aa\">You can close this tab and return to Aetheria.</p><script>setTimeout(()=>window.close(),1200)</script></div></body></html>";
                let _ = stream.write_all(html.as_bytes()).await;
                let _ = stream.shutdown().await;

                if let Some(code) = code_opt {
                    let http = reqwest::Client::new();
                    let tok_res = if target_clone == "claude" {
                        http.post(&token_ep_str)
                            .json(&json!({
                                "grant_type": "authorization_code",
                                "client_id": client_id_str,
                                "code": code,
                                "redirect_uri": redirect_clone,
                                "code_verifier": verifier,
                                "state": state
                            }))
                            .send()
                            .await
                    } else {
                        let form_body = format!(
                            "grant_type=authorization_code&client_id={}&code={}&redirect_uri={}&code_verifier={}",
                            url_encode(&client_id_str),
                            url_encode(&code),
                            url_encode(&redirect_clone),
                            url_encode(&verifier)
                        );
                        http.post(&token_ep_str)
                            .header("Content-Type", "application/x-www-form-urlencoded")
                            .body(form_body)
                            .send()
                            .await
                    };

                    if let Ok(resp) = tok_res {
                        if resp.status().is_success() {
                            if let Ok(tok_json) = resp.json::<Value>().await {
                                if let Some(at) =
                                    tok_json.get("access_token").and_then(|v| v.as_str())
                                {
                                    let rt = tok_json
                                        .get("refresh_token")
                                        .and_then(|v| v.as_str())
                                        .map(|s| s.to_string());
                                    let exp_in = tok_json
                                        .get("expires_in")
                                        .and_then(|v| v.as_u64())
                                        .unwrap_or(3600);
                                    let email = decode_jwt_payload(at).and_then(|p| {
                                        p.get("email")
                                            .or_else(|| {
                                                p.pointer("/https:~1~1api.openai.com~1profile/email")
                                            })
                                            .and_then(|v| v.as_str())
                                            .map(|s| s.to_string())
                                    });
                                    set_credential(CredentialEntry {
                                        source: target_clone.clone(),
                                        access_token: at.to_string(),
                                        refresh_token: rt,
                                        expires_at: Some(now_ms() + exp_in * 1000),
                                        account_email: email,
                                        updated_at: now_iso(),
                                        auto_harvested: false,
                                        ..Default::default()
                                    });
                                    register_local_cli_to_config(crate::bridge::LOCAL_CLI_BRIDGE_PORT);
                                    update_oauth_result(OauthResult {
                                        request_id: req_id_clone,
                                        target: target_clone,
                                        status: "success".to_string(),
                                        message: "Browser OAuth sign-in succeeded!".to_string(),
                                        auth_url: None,
                                        updated_at: now_ms(),
                                    });
                                    return;
                                }
                            }
                        }
                    }
                }
            }

            update_oauth_result(OauthResult {
                request_id: req_id_clone,
                target: target_clone,
                status: "error".to_string(),
                message: "OAuth callback failed or timed out.".to_string(),
                auth_url: None,
                updated_at: now_ms(),
            });
        });

        return Ok(json!({
            "requestId": request_id,
            "target": target_str,
            "authUrl": auth_url
        }));
    }

    Err(format!("Unsupported OAuth target: {}", target))
}


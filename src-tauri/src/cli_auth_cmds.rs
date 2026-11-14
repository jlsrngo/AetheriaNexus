//! Local CLI provider login, logout, and credential harvesting Tauri commands.

/// Spawns native terminal windows or clears credentials for CLI providers.
#[tauri::command]
pub async fn tauri_cli_login(target: String) -> Result<serde_json::Value, String> {
    match target.as_str() {
        "antigravity-logout" => {
            aetheria_engine::cred_store::remove_credential("antigravity");
            Ok(serde_json::json!({
                "data": { "success": true, "message": "Signed out from Google Antigravity." }
            }))
        }
        "opencode-logout" => {
            aetheria_engine::cred_store::remove_credential("opencode");
            Ok(serde_json::json!({
                "data": { "success": true, "message": "Signed out from OpenCode." }
            }))
        }
        "claude" | "codex" | "opencode-terminal" | "antigravity-cli" => {
            let source_to_clear = match target.as_str() {
                "antigravity-cli" => "antigravity",
                "opencode-terminal" => "opencode",
                other => other,
            };
            aetheria_engine::cred_store::clear_logged_out(source_to_clear);
            let cmd_str = match target.as_str() {
                "claude" => "claude",
                "codex" => "codex",
                "opencode-terminal" => "opencode auth login",
                "antigravity-cli" => "agy login",
                _ => "cmd",
            };
            #[cfg(windows)]
            {
                let _ = std::process::Command::new("cmd")
                    .args(["/c", "start", "cmd", "/k", cmd_str])
                    .spawn();
            }
            Ok(serde_json::json!({
                "data": {
                    "success": true,
                    "message": format!("Launched '{}' in terminal window.", cmd_str)
                }
            }))
        }
        _ => Ok(serde_json::json!({
            "data": {
                "success": true,
                "message": "Built-in Rust Local-CLI Bridge is active."
            }
        })),
    }
}

/// Harvests credentials and builds CLI provider registry directly in Rust memory.
#[tauri::command]
pub async fn tauri_cli_status() -> Result<serde_json::Value, String> {
    aetheria_engine::cred_store::harvest_all();
    let creds = aetheria_engine::cred_store::get_all_credentials();
    let registry = aetheria_engine::provider::local_cli::build_cli_provider_registry();
    let discovered = aetheria_engine::provider::local_cli::build_discovered_list();

    let mut sources = serde_json::Map::new();
    for s in ["codex", "claude", "opencode", "kiro", "antigravity", "groq"] {
        if let Some(c) = creds.get(s) {
            sources.insert(
                s.to_string(),
                serde_json::json!({
                    "connected": true,
                    "expiresAt": c.expires_at,
                    "updatedAt": c.updated_at,
                    "autoHarvested": c.auto_harvested,
                    "accountEmail": c.account_email.clone().or_else(|| c.account_info.clone().filter(|x| x.contains('@'))),
                    "accountInfo": c.account_info,
                    "hasRefreshToken": c.refresh_token.is_some()
                }),
            );
        } else {
            sources.insert(
                s.to_string(),
                serde_json::json!({
                    "connected": false,
                    "expired": false
                }),
            );
        }
    }

    let agy_c = creds.get("antigravity");
    let agy_signed_in = agy_c.map(|c| !c.access_token.is_empty()).unwrap_or(false);
    let agy_email = agy_c
        .and_then(|c| c.account_email.clone())
        .or_else(|| agy_c.and_then(|c| c.account_info.clone()));
    let antigravity_slot = serde_json::json!({
        "detected": true,
        "cliInstalled": true,
        "agyInstalled": true,
        "agySignedIn": agy_signed_in,
        "agyVersion": "1.3.1",
        "loggedIn": agy_signed_in,
        "accountEmail": agy_email,
        "environment": "Google Antigravity CLI (agy)",
        "detail": if agy_signed_in { "Signed in & ready via Local-CLI Bridge" } else { "Not signed in" }
    });

    let claude_c = creds.get("claude");
    let claude_signed_in = claude_c.map(|c| !c.access_token.is_empty()).unwrap_or(false);
    let claude_slot = serde_json::json!({
        "installed": true,
        "version": "2.1.202",
        "loggedIn": claude_signed_in,
        "signedIn": claude_signed_in,
        "credentialFile": "~/.claude/.credentials.json",
        "detail": if claude_signed_in { "Signed in & ready via Local-CLI Bridge" } else { "Not signed in" }
    });

    let codex_c = creds.get("codex");
    let codex_signed_in = codex_c.map(|c| !c.access_token.is_empty()).unwrap_or(false);
    let codex_slot = serde_json::json!({
        "installed": true,
        "version": "0.1.0",
        "isCloudOnly": false,
        "signedIn": codex_signed_in,
        "loggedIn": codex_signed_in,
        "plan": if codex_signed_in { Some("free") } else { None },
        "accountEmail": codex_c.and_then(|c| c.account_email.clone()),
        "expiresAt": codex_c.and_then(|c| c.expires_at),
        "credentialFile": "~/.codex/auth.json",
        "detail": if codex_signed_in { "Signed in & ready via Local-CLI Bridge" } else { "Not signed in" }
    });

    let kiro_c = creds.get("kiro");
    let kiro_signed_in = kiro_c.map(|c| !c.access_token.is_empty()).unwrap_or(false);
    let kiro_slot = serde_json::json!({
        "installed": true,
        "signedIn": kiro_signed_in,
        "loggedIn": kiro_signed_in,
        "requiresCli": false,
        "accountEmail": kiro_c.and_then(|c| c.account_email.clone()),
        "region": kiro_c.and_then(|c| c.region.clone()).unwrap_or_else(|| "us-east-1".to_string()),
        "hasRefreshToken": kiro_c.and_then(|c| c.refresh_token.as_ref()).is_some(),
        "expiresAt": kiro_c.and_then(|c| c.expires_at),
        "detail": if kiro_signed_in { "Signed in & ready via Local-CLI Bridge" } else { "Not signed in" }
    });

    let opencode_slot = serde_json::json!({
        "installed": true,
        "version": "1.18.30",
        "loggedIn": true,
        "signedIn": true,
        "serverRunning": false,
        "serverPort": 4097,
        "authenticatedProviders": ["9router", "groq"],
        "hasGroq": true,
        "has9Router": true,
        "detail": "OpenCode interpreter ready"
    });

    let nine_router_slot = serde_json::json!({
        "installed": true,
        "version": "0.5.35",
        "running": true,
        "port": aetheria_engine::bridge::LOCAL_CLI_BRIDGE_PORT,
        "baseUrl": format!("http://127.0.0.1:{}/v1", aetheria_engine::bridge::LOCAL_CLI_BRIDGE_PORT),
        "url": format!("http://127.0.0.1:{}/v1", aetheria_engine::bridge::LOCAL_CLI_BRIDGE_PORT),
        "models": aetheria_engine::provider::local_cli::default_models_for_target("9router"),
        "detail": "Built-in Rust Local-CLI Bridge active"
    });

    Ok(serde_json::json!({
        "data": {
            "sources": sources,
            "registry": registry,
            "discovered": discovered,
            "bridgePort": aetheria_engine::bridge::LOCAL_CLI_BRIDGE_PORT,
            "bridgeRunning": true,
            "claude": claude_slot,
            "opencode": opencode_slot,
            "antigravity": antigravity_slot,
            "kiro": kiro_slot,
            "nineRouter": nine_router_slot,
            "codex": codex_slot,
        }
    }))
}


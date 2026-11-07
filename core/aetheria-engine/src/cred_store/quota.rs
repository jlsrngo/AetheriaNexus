//! Provider quota checking and live usage queries across AI developer tools.

use super::harvest::harvest_all;
use super::refresh::ensure_fresh_credential;
use super::store::{decode_jwt_payload, get_all_credentials, is_expired};
use crate::paths::now_iso;
use serde_json::{json, Value};

pub async fn fetch_all_quotas() -> Value {
    let creds = get_all_credentials();
    let mut out = serde_json::Map::new();

    for source in ["codex", "claude", "opencode", "kiro", "antigravity"] {
        if let Some(entry) = creds.get(source) {
            let plan = match source {
                "codex" => decode_jwt_payload(&entry.access_token)
                    .and_then(|p| {
                        p.pointer("/https:~1~1api.openai.com~1auth/chatgpt_plan_type")
                            .and_then(|v| v.as_str())
                            .map(|s| format!("ChatGPT {}", s))
                    })
                    .unwrap_or_else(|| "ChatGPT Plus/Pro".to_string()),
                "claude" => entry
                    .account_info
                    .as_deref()
                    .map(|s| s.replace("subscription: ", "Claude "))
                    .unwrap_or_else(|| "Claude Max/Pro".to_string()),
                "opencode" => "OpenCode Zen (Free)".to_string(),
                "kiro" => format!(
                    "AWS CodeWhisperer ({})",
                    entry.region.as_deref().unwrap_or("us-east-1")
                ),
                "antigravity" => "Google Cloud Code (agy)".to_string(),
                _ => source.to_string(),
            };
            out.insert(
                source.to_string(),
                json!({
                    "source": source,
                    "plan": plan,
                    "windows": [],
                    "extraInfo": entry.account_info,
                    "fetchedAt": now_iso(),
                }),
            );
        }
    }

    Value::Object(out)
}

pub async fn fetch_live_quotas_list() -> Vec<Value> {
    harvest_all();
    let creds = get_all_credentials();
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .unwrap_or_default();

    let mut out = Vec::new();
    for prov in ["antigravity", "claude", "codex", "kiro", "opencode"] {
        let entry = if let Some(fresh) = ensure_fresh_credential(prov).await {
            fresh
        } else if let Some(e) = creds.get(prov).cloned() {
            e
        } else {
            out.push(json!({
                "provider": prov,
                "ok": false,
                "reason": "Not signed in",
                "buckets": []
            }));
            continue;
        };

        let entry = &entry;
        if is_expired(entry, 0) && prov != "opencode" {
            out.push(json!({
                "provider": prov,
                "ok": false,
                "reason": "Token expired",
                "buckets": []
            }));
            continue;
        }

        match prov {
            "antigravity" => {
                let mut buckets = Vec::new();
                if let Ok(resp) = client
                    .post("https://daily-cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary")
                    .header("Authorization", format!("Bearer {}", entry.access_token))
                    .header("Content-Type", "application/json")
                    .json(&json!({}))
                    .send()
                    .await
                {
                    if resp.status().is_success() {
                        if let Ok(data) = resp.json::<Value>().await {
                            if let Some(arr) = data
                                .get("quotas")
                                .or_else(|| data.get("buckets"))
                                .and_then(|v| v.as_array())
                            {
                                for (idx, b) in arr.iter().enumerate() {
                                    let label = b
                                        .get("category")
                                        .or_else(|| b.get("model"))
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("Quota");
                                    let rem = b
                                        .get("remainingFraction")
                                        .and_then(|v| v.as_f64())
                                        .map(|f| (f * 100.0).round() as i64)
                                        .unwrap_or(100);
                                    buckets.push(json!({
                                        "id": format!("agy-{}", idx),
                                        "label": label,
                                        "remaining": rem,
                                        "resetAt": b.get("resetTime").and_then(|v| v.as_str()),
                                        "exhausted": rem <= 0
                                    }));
                                }
                            }
                        }
                    }
                }
                if buckets.is_empty() {
                    buckets.push(json!({
                        "id": "agy-gemini",
                        "label": "Gemini Models",
                        "remaining": 100,
                        "exhausted": false
                    }));
                    buckets.push(json!({
                        "id": "agy-claude",
                        "label": "Claude Models (Antigravity)",
                        "remaining": 100,
                        "exhausted": false
                    }));
                }
                out.push(json!({
                    "provider": "antigravity",
                    "ok": true,
                    "buckets": buckets
                }));
            }
            "claude" => {
                let mut buckets = Vec::new();
                if let Ok(resp) = client
                    .get("https://api.anthropic.com/api/oauth/usage")
                    .header("Authorization", format!("Bearer {}", entry.access_token))
                    .header("anthropic-beta", "oauth-2025-04-20")
                    .send()
                    .await
                {
                    if resp.status().is_success() {
                        if let Ok(data) = resp.json::<Value>().await {
                            for (key, label) in [
                                ("five_hour", "5h Window"),
                                ("seven_day", "7d Window"),
                                ("seven_day_sonnet", "7d Sonnet"),
                            ] {
                                if let Some(w) = data.get(key) {
                                    if let Some(util) =
                                        w.get("utilization").and_then(|v| v.as_f64())
                                    {
                                        let rem = (100.0 - util).round().clamp(0.0, 100.0) as i64;
                                        buckets.push(json!({
                                            "id": key,
                                            "label": label,
                                            "remaining": rem,
                                            "resetAt": w.get("resets_at").and_then(|v| v.as_str()),
                                            "exhausted": rem <= 0
                                        }));
                                    }
                                }
                            }
                        }
                    }
                }
                if buckets.is_empty() {
                    buckets.push(json!({
                        "id": "claude-active",
                        "label": entry.account_info.as_deref().unwrap_or("Claude Pro/Max"),
                        "remaining": 100,
                        "exhausted": false
                    }));
                }
                out.push(json!({
                    "provider": "claude",
                    "ok": true,
                    "buckets": buckets
                }));
            }
            "codex" => {
                let mut buckets = Vec::new();
                if let Ok(resp) = client
                    .get("https://chatgpt.com/backend-api/wham/usage")
                    .header("Authorization", format!("Bearer {}", entry.access_token))
                    .send()
                    .await
                {
                    if resp.status().is_success() {
                        if let Ok(data) = resp.json::<Value>().await {
                            if let Some(pw) = data.pointer("/rate_limit/primary_window") {
                                if let Some(used) =
                                    pw.get("used_percent").and_then(|v| v.as_f64())
                                {
                                    let rem = (100.0 - used).round().clamp(0.0, 100.0) as i64;
                                    buckets.push(json!({
                                        "id": "primary",
                                        "label": "5h Window",
                                        "remaining": rem,
                                        "exhausted": rem <= 0
                                    }));
                                }
                            }
                            if let Some(sw) = data.pointer("/rate_limit/secondary_window") {
                                if let Some(used) =
                                    sw.get("used_percent").and_then(|v| v.as_f64())
                                {
                                    let rem = (100.0 - used).round().clamp(0.0, 100.0) as i64;
                                    buckets.push(json!({
                                        "id": "secondary",
                                        "label": "Weekly",
                                        "remaining": rem,
                                        "exhausted": rem <= 0
                                    }));
                                }
                            }
                        }
                    }
                }
                if buckets.is_empty() {
                    buckets.push(json!({
                        "id": "codex-active",
                        "label": "ChatGPT Plus/Pro",
                        "remaining": 100,
                        "exhausted": false
                    }));
                }
                out.push(json!({
                    "provider": "codex",
                    "ok": true,
                    "buckets": buckets
                }));
            }
            "kiro" => {
                let region = entry.region.as_deref().unwrap_or("us-east-1");
                let mut buckets = Vec::new();
                let mut body_map = serde_json::Map::new();
                body_map.insert("origin".to_string(), Value::String("AI_EDITOR".to_string()));
                body_map.insert(
                    "resourceType".to_string(),
                    Value::String("AGENTIC_REQUEST".to_string()),
                );
                if let Some(ref parn) = entry.profile_arn {
                    body_map.insert("profileArn".to_string(), Value::String(parn.clone()));
                }
                if let Ok(resp) = client
                    .post(format!(
                        "https://codewhisperer.{}.amazonaws.com/getUsageLimits",
                        region
                    ))
                    .header("Authorization", format!("Bearer {}", entry.access_token))
                    .header("Content-Type", "application/x-amz-json-1.0")
                    .header(
                        "x-amz-target",
                        "AmazonCodeWhispererService.GetUsageLimits",
                    )
                    .json(&Value::Object(body_map))
                    .send()
                    .await
                {
                    if resp.status().is_success() {
                        if let Ok(data) = resp.json::<Value>().await {
                            if let Some(list) =
                                data.get("usageBreakdownList").and_then(|v| v.as_array())
                            {
                                for (idx, item) in list.iter().enumerate() {
                                    let limit = item
                                        .get("usageLimitWithPrecision")
                                        .or_else(|| item.get("usageLimit"))
                                        .and_then(|v| v.as_f64())
                                        .unwrap_or(0.0);
                                    let cur = item
                                        .get("currentUsageWithPrecision")
                                        .or_else(|| item.get("currentUsage"))
                                        .and_then(|v| v.as_f64())
                                        .unwrap_or(0.0);
                                    if limit > 0.0 {
                                        let rem = (((limit - cur) / limit) * 100.0)
                                            .round()
                                            .clamp(0.0, 100.0)
                                            as i64;
                                        let label = item
                                            .get("displayName")
                                            .or_else(|| item.get("resourceType"))
                                            .and_then(|v| v.as_str())
                                            .unwrap_or("Credits");
                                        buckets.push(json!({
                                            "id": format!("kiro-{}", idx),
                                            "label": format!("{} ({}/{})", label, (limit - cur).round() as i64, limit.round() as i64),
                                            "remaining": rem,
                                            "exhausted": rem <= 0
                                        }));
                                    }
                                }
                            }
                        }
                    }
                }
                if buckets.is_empty() {
                    buckets.push(json!({
                        "id": "kiro-active",
                        "label": format!("AWS CodeWhisperer ({})", region),
                        "remaining": 100,
                        "exhausted": false
                    }));
                }
                out.push(json!({
                    "provider": "kiro",
                    "ok": true,
                    "buckets": buckets
                }));
            }
            "opencode" => {
                out.push(json!({
                    "provider": "opencode",
                    "ok": true,
                    "buckets": [{
                        "id": "opencode-zen",
                        "label": "OpenCode Zen Free",
                        "remaining": 100,
                        "exhausted": false
                    }]
                }));
            }
            _ => {}
        }
    }
    out
}


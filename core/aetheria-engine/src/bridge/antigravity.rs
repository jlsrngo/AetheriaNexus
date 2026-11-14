use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::{json, Value};
use std::collections::HashMap;

use super::antigravity_auth::{
    build_antigravity_ide_request_id, get_antigravity_project_id, lookup_signature,
    map_antigravity_model, remember_signature, ANTIGRAVITY_DAILY_STREAM_URL,
    ANTIGRAVITY_IDE_USER_AGENT,
};
use super::antigravity_safety::{
    acquire_antigravity_turn_slot, build_cloaked_tools, cloak_history_tool_name,
    record_upstream_outcome, sanitize_antigravity_system_prompt, to_numeric_session_id,
    uncloak_tool_name,
};
use super::schema::sanitize_gemini_schema;
use super::{
    extract_content_text, make_completion_response_with_reasoning,
    make_sse_response_with_reasoning,
};
use crate::cred_store::{ensure_fresh_credential, refresh_credential_source, CredentialEntry};
use crate::paths::gen_id;

pub(crate) async fn handle_antigravity_request(body: Value, model: &str, is_stream: bool) -> Response {
    let cred = match ensure_fresh_credential("antigravity").await {
        Some(c) => c,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({ "error": { "message": "Antigravity credentials not found." } })),
            )
                .into_response()
        }
    };
    let url = std::env::var("AETHERIA_ANTIGRAVITY_STREAM_URL")
        .unwrap_or_else(|_| ANTIGRAVITY_DAILY_STREAM_URL.to_string());
    handle_antigravity_with_cred(cred, body, model, is_stream, &url).await
}

fn parse_data_image_url(url: &str) -> Option<(String, String)> {
    let trimmed = url.trim();
    let rest = trimmed.strip_prefix("data:")?;
    let (meta, b64) = rest.split_once(";base64,")?;
    let mime = meta.trim();
    let clean_b64: String = b64.chars().filter(|c| !c.is_whitespace()).collect();
    if mime.is_empty() || clean_b64.is_empty() {
        return None;
    }
    Some((mime.to_string(), clean_b64))
}

fn build_gemini_user_parts(content: Option<&Value>) -> Vec<Value> {
    let mut parts = Vec::new();
    match content {
        Some(Value::String(s)) => {
            if !s.is_empty() {
                parts.push(json!({ "text": s }));
            }
        }
        Some(Value::Array(arr)) => {
            for item in arr {
                if let Some(s) = item.as_str() {
                    if !s.is_empty() {
                        parts.push(json!({ "text": s }));
                    }
                    continue;
                }
                let item_type = item.get("type").and_then(|v| v.as_str()).unwrap_or("");
                if item_type == "image_url" || item.get("image_url").is_some() {
                    let raw_url = item
                        .pointer("/image_url/url")
                        .or_else(|| item.get("image_url"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    if let Some((mime, b64)) = parse_data_image_url(raw_url) {
                        parts.push(json!({
                            "inlineData": {
                                "mimeType": mime,
                                "data": b64
                            }
                        }));
                    }
                    continue;
                }
                if let Some(txt) = item
                    .get("text")
                    .or_else(|| item.get("input_text"))
                    .or_else(|| item.get("content"))
                    .and_then(|v| v.as_str())
                {
                    if !txt.is_empty() {
                        parts.push(json!({ "text": txt }));
                    }
                }
            }
        }
        _ => {
            let txt = extract_content_text(content);
            if !txt.is_empty() {
                parts.push(json!({ "text": txt }));
            }
        }
    }
    if parts.is_empty() {
        parts.push(json!({ "text": " " }));
    }
    parts
}

async fn handle_antigravity_with_cred(
    mut cred: CredentialEntry,
    body: Value,
    model: &str,
    is_stream: bool,
    url: &str,
) -> Response {
    let (upstream_model, thinking_level) = map_antigravity_model(model);
    let mut raw_decls = Vec::new();
    if let Some(tools) = body.get("tools").and_then(|v| v.as_array()) {
        for t in tools {
            let fn_obj = t.get("function").unwrap_or(t);
            if let Some(name) = fn_obj.get("name").and_then(|v| v.as_str()) {
                let desc = fn_obj
                    .get("description")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let params = fn_obj
                    .get("parameters")
                    .map(sanitize_gemini_schema)
                    .unwrap_or_else(|| json!({ "type": "object", "properties": {} }));
                raw_decls.push(json!({
                    "name": name,
                    "description": desc,
                    "parameters": params
                }));
            }
        }
    }
    let cloaked = build_cloaked_tools(raw_decls);

    let messages = body
        .get("messages")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let mut system_parts = Vec::new();
    let mut contents: Vec<Value> = Vec::new();
    let mut tool_id_to_name = HashMap::new();

    for m in &messages {
        if m.get("role").and_then(|v| v.as_str()) == Some("assistant") {
            if let Some(tcs) = m.get("tool_calls").and_then(|v| v.as_array()) {
                for tc in tcs {
                    if let (Some(id), Some(name)) = (
                        tc.get("id").and_then(|v| v.as_str()),
                        tc.pointer("/function/name")
                            .or_else(|| tc.get("name"))
                            .and_then(|v| v.as_str()),
                    ) {
                        tool_id_to_name.insert(id.to_string(), name.to_string());
                    }
                }
            }
        }
    }

    for m in &messages {
        let role = m.get("role").and_then(|v| v.as_str()).unwrap_or("user");
        if role == "system" || role == "developer" {
            let txt = extract_content_text(m.get("content"));
            if !txt.trim().is_empty() {
                system_parts.push(txt);
            }
            continue;
        }
        if role == "tool" {
            let call_id = m
                .get("tool_call_id")
                .or_else(|| m.get("id"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let fn_name = m
                .get("name")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .or_else(|| tool_id_to_name.get(call_id).cloned())
                .unwrap_or_else(|| "tool".to_string());
            let resp_obj = match m.get("content") {
                Some(Value::String(s)) => serde_json::from_str::<Value>(s)
                    .ok()
                    .filter(|v| v.is_object())
                    .unwrap_or_else(|| json!({ "output": s })),
                Some(v) if v.is_object() => v.clone(),
                Some(v) => json!({ "output": v }),
                None => json!({ "output": "" }),
            };
            let cloaked_fn_name = cloak_history_tool_name(&fn_name, &cloaked.orig_to_cloaked);
            let part = json!({
                "functionResponse": {
                    "name": cloaked_fn_name,
                    "id": call_id,
                    "response": resp_obj
                }
            });
            if let Some(last) = contents.last_mut() {
                if last.get("role").and_then(|v| v.as_str()) == Some("user") {
                    if let Some(parts) = last.get_mut("parts").and_then(|v| v.as_array_mut()) {
                        if parts.iter().all(|p| p.get("functionResponse").is_some()) {
                            parts.push(part);
                            continue;
                        }
                    }
                }
            }
            contents.push(json!({ "role": "user", "parts": [part] }));
            continue;
        }
        if role == "assistant" {
            let mut parts = Vec::new();
            let txt = extract_content_text(m.get("content"));
            if !txt.is_empty() {
                parts.push(json!({ "text": txt }));
            }
            if let Some(tcs) = m.get("tool_calls").and_then(|v| v.as_array()) {
                for tc in tcs {
                    let id = tc.get("id").and_then(|v| v.as_str()).unwrap_or("");
                    let name = tc
                        .pointer("/function/name")
                        .or_else(|| tc.get("name"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("tool");
                    let args_val = match tc.pointer("/function/arguments") {
                        Some(Value::String(s)) => {
                            serde_json::from_str::<Value>(s).unwrap_or_else(|_| json!({}))
                        }
                        Some(v) if v.is_object() => v.clone(),
                        _ => json!({}),
                    };
                    let cloaked_name = cloak_history_tool_name(name, &cloaked.orig_to_cloaked);
                    let sig = lookup_signature(id)
                        .or_else(|| lookup_signature(&format!("fn:{}", name)))
                        .or_else(|| lookup_signature(&format!("fn:{}", cloaked_name)))
                        .unwrap_or_else(|| "skip_thought_signature_validator".to_string());
                    parts.push(json!({
                        "functionCall": {
                            "id": id,
                            "name": cloaked_name,
                            "args": args_val
                        },
                        "thoughtSignature": sig
                    }));
                }
            }
            if !parts.is_empty() {
                contents.push(json!({ "role": "model", "parts": parts }));
            }
            continue;
        }

        let user_parts = build_gemini_user_parts(m.get("content"));
        // Merge consecutive "user" turns (e.g. functionResponse followed by visual inspection frames)
        // so upstream Gemini payloads strictly alternate between "user" and "model".
        if let Some(last) = contents.last_mut() {
            if last.get("role").and_then(|v| v.as_str()) == Some("user") {
                if let Some(existing_parts) = last.get_mut("parts").and_then(|v| v.as_array_mut()) {
                    existing_parts.extend(user_parts);
                    continue;
                }
            }
        }
        contents.push(json!({
            "role": "user",
            "parts": user_parts
        }));
    }

    if contents.is_empty() {
        contents.push(json!({ "role": "user", "parts": [{ "text": "Hello" }] }));
    }

    let mut gen_cfg = json!({
        "maxOutputTokens": body.get("max_tokens").and_then(|v| v.as_u64()).unwrap_or(8192),
        "temperature": body.get("temperature").and_then(|v| v.as_f64()).unwrap_or(1.0)
    });
    if let Some(lvl) = thinking_level {
        if upstream_model.starts_with("gemini-3") {
            gen_cfg["thinkingConfig"] = json!({
                "includeThoughts": true,
                "thinkingLevel": lvl
            });
        }
    }

    let project_id = match cred
        .account_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty() && *s != "rising-fact-p41fc")
    {
        Some(pid) => pid.to_string(),
        None => get_antigravity_project_id(&cred.access_token).await,
    };
    let account_key = cred
        .account_email
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or(project_id.as_str())
        .to_string();

    let mut inner_req = json!({
        "contents": contents,
        "generationConfig": gen_cfg,
        "sessionId": to_numeric_session_id(&format!("{}:{}", project_id, account_key))
    });
    if !system_parts.is_empty() {
        let clean_system = sanitize_antigravity_system_prompt(&system_parts.join("\n\n"));
        if !clean_system.is_empty() {
            inner_req["systemInstruction"] = json!({
                "role": "user",
                "parts": [{ "text": clean_system }]
            });
        }
    }
    if !cloaked.declarations.is_empty() {
        inner_req["tools"] = json!([{ "functionDeclarations": cloaked.declarations }]);
        inner_req["toolConfig"] = json!({
            "functionCallingConfig": {
                "mode": "VALIDATED"
            }
        });
    }

    let agy_payload = json!({
        "project": project_id,
        "model": upstream_model,
        "request": inner_req,
        "userAgent": "antigravity",
        "requestId": build_antigravity_ide_request_id(&project_id, &upstream_model, contents.len())
    });

    let _turn_permit = match acquire_antigravity_turn_slot(&account_key).await {
        Ok(p) => p,
        Err((st, msg)) => {
            return (st, Json(json!({ "error": { "message": msg } }))).into_response();
        }
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(240))
        .build()
        .unwrap_or_default();

    let mut resp = match client
        .post(url)
        .header("Authorization", format!("Bearer {}", cred.access_token))
        .header("Content-Type", "application/json")
        .header("Accept", "text/event-stream")
        .header("User-Agent", ANTIGRAVITY_IDE_USER_AGENT)
        .json(&agy_payload)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::BAD_GATEWAY,
                Json(json!({ "error": { "message": format!("Antigravity request error: {}", e) } })),
            )
                .into_response()
        }
    };

    // Only retry 401 token expiry; retrying 403 TOS_VIOLATION/forbidden causes anti-abuse bursts.
    if resp.status() == StatusCode::UNAUTHORIZED {
        if let Some(refreshed) = refresh_credential_source("antigravity", &cred).await {
            cred = refreshed;
            if let Ok(r2) = client
                .post(url)
                .header("Authorization", format!("Bearer {}", cred.access_token))
                .header("Content-Type", "application/json")
                .header("Accept", "text/event-stream")
                .header("User-Agent", ANTIGRAVITY_IDE_USER_AGENT)
                .json(&agy_payload)
                .send()
                .await
            {
                resp = r2;
            }
        }
    }

    if !resp.status().is_success() {
        let st = resp.status();
        let txt = resp.text().await.unwrap_or_default();
        record_upstream_outcome(&account_key, st, &txt);
        return (
            st,
            Json(json!({ "error": { "message": format!("Antigravity error ({}): {}", st, txt) } })),
        )
            .into_response();
    }
    record_upstream_outcome(&account_key, StatusCode::OK, "");

    let sse_text = resp.text().await.unwrap_or_default();
    let mut full_text = String::new();
    let mut thought_text = String::new();
    let mut tool_calls = Vec::new();
    let mut last_sig = String::new();

    for line in sse_text.lines() {
        let trimmed = line.trim();
        if !trimmed.starts_with("data:") {
            continue;
        }
        let json_str = trimmed.trim_start_matches("data:").trim();
        if json_str.is_empty() || json_str == "[DONE]" {
            continue;
        }
        if let Ok(evt) = serde_json::from_str::<Value>(json_str) {
            let root = evt.get("response").unwrap_or(&evt);
            if let Some(parts) = root
                .pointer("/candidates/0/content/parts")
                .and_then(|v| v.as_array())
            {
                for part in parts {
                    if let Some(sig) = part.get("thoughtSignature").and_then(|v| v.as_str()) {
                        last_sig = sig.to_string();
                    }
                    let is_thought = part
                        .get("thought")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false);
                    if is_thought {
                        if let Some(t) = part.get("text").and_then(|v| v.as_str()) {
                            thought_text.push_str(t);
                        }
                    } else if let Some(t) = part.get("text").and_then(|v| v.as_str()) {
                        full_text.push_str(t);
                    }
                    if let Some(fc) = part.get("functionCall") {
                        let raw_name = fc.get("name").and_then(|v| v.as_str()).unwrap_or("tool");
                        let name = uncloak_tool_name(raw_name, &cloaked.cloaked_to_orig);
                        let call_id = fc
                            .get("id")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string())
                            .unwrap_or_else(|| gen_id("call"));
                        let sig = part
                            .get("thoughtSignature")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string())
                            .unwrap_or_else(|| last_sig.clone());
                        if !sig.is_empty() {
                            remember_signature(&call_id, &sig);
                            remember_signature(&format!("fn:{}", name), &sig);
                        }
                        let args_str = serde_json::to_string(
                            fc.get("args").unwrap_or(&json!({})),
                        )
                        .unwrap_or_else(|_| "{}".to_string());
                        tool_calls.push(json!({
                            "id": call_id,
                            "type": "function",
                            "function": {
                                "name": name,
                                "arguments": args_str
                            }
                        }));
                    }
                }
            }
        }
    }

    if is_stream {
        make_sse_response_with_reasoning(model, full_text, thought_text, tool_calls)
    } else {
        make_completion_response_with_reasoning(model, full_text, thought_text, tool_calls)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::to_bytes, routing::post, Router};
    use std::sync::{
        atomic::{AtomicUsize, Ordering},
        Arc, Mutex as StdMutex,
    };

    #[tokio::test]
    async fn bridge_cloaks_tools_sanitizes_prompt_and_uncloaks_response() {
        let captured = Arc::new(StdMutex::new(Vec::<Value>::new()));
        let captured_srv = Arc::clone(&captured);

        let app = Router::new().route(
            "/v1internal:streamGenerateContent",
            post(move |Json(payload): Json<Value>| {
                let cap = Arc::clone(&captured_srv);
                async move {
                    if let Ok(mut guard) = cap.lock() {
                        guard.push(payload);
                    }
                    let sse = concat!(
                        "data: {\"response\":{\"candidates\":[{\"content\":{\"parts\":[{\"functionCall\":{\"id\":\"call_1\",\"name\":\"Bash_ide\",\"args\":{\"command\":\"echo hi\"}}}]}}]}}\n\n",
                        "data: [DONE]\n\n"
                    );
                    (StatusCode::OK, sse)
                }
            }),
        );

        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind mock listener");
        let addr = listener.local_addr().expect("mock addr");
        let server = tokio::spawn(async move {
            let _ = axum::serve(listener, app).await;
        });

        let cred = CredentialEntry {
            source: "antigravity".to_string(),
            access_token: "test-token".to_string(),
            account_id: Some("mock-proj-123".to_string()),
            account_email: Some("test-cloaking@example.com".to_string()),
            ..Default::default()
        };
        let body = json!({
            "messages": [
                {
                    "role": "system",
                    "content": "x-anthropic-billing-header: abc\nYou are OpenCode assistant."
                },
                { "role": "user", "content": "Run echo" }
            ],
            "tools": [
                {
                    "type": "function",
                    "function": {
                        "name": "Bash",
                        "description": "Run shell command",
                        "parameters": { "type": "object", "properties": {} }
                    }
                }
            ]
        });

        let url = format!("http://{}/v1internal:streamGenerateContent?alt=sse", addr);
        let resp = handle_antigravity_with_cred(cred, body, "gemini-2.5-flash", false, &url).await;
        assert_eq!(resp.status(), StatusCode::OK);

        let resp_bytes = to_bytes(resp.into_body(), usize::MAX)
            .await
            .expect("response body");
        let resp_json: Value = serde_json::from_slice(&resp_bytes).expect("json body");
        assert_eq!(
            resp_json.pointer("/choices/0/message/tool_calls/0/function/name"),
            Some(&json!("Bash"))
        );

        let sent = captured.lock().expect("lock captured").pop().expect("captured payload");
        assert!(sent.get("requestType").is_none());
        let sys_text = sent
            .pointer("/request/systemInstruction/parts/0/text")
            .and_then(|v| v.as_str())
            .expect("systemInstruction text");
        assert!(!sys_text.contains("x-anthropic-billing-header"));
        assert!(!sys_text.contains("OpenCode"));
        assert!(sys_text.contains("Antigravity"));

        let session_id = sent
            .pointer("/request/sessionId")
            .and_then(|v| v.as_str())
            .expect("sessionId");
        assert!(session_id.starts_with('-'));
        assert!(session_id[1..].chars().all(|c| c.is_ascii_digit()));

        assert_eq!(
            sent.pointer("/request/toolConfig/functionCallingConfig/mode"),
            Some(&json!("VALIDATED"))
        );
        let decls = sent
            .pointer("/request/tools/0/functionDeclarations")
            .and_then(|v| v.as_array())
            .expect("functionDeclarations");
        assert!(decls.iter().any(|d| d.get("name") == Some(&json!("Bash_ide"))));
        assert!(decls.iter().any(|d| d.get("name") == Some(&json!("view_file"))));

        server.abort();
    }

    #[tokio::test]
    async fn forbidden_tos_does_not_retry_and_triggers_cooldown() {
        let hits = Arc::new(AtomicUsize::new(0));
        let hits_srv = Arc::clone(&hits);

        let app = Router::new().route(
            "/v1internal:streamGenerateContent",
            post(move || {
                let h = Arc::clone(&hits_srv);
                async move {
                    h.fetch_add(1, Ordering::SeqCst);
                    (
                        StatusCode::FORBIDDEN,
                        r#"{"error":{"code":403,"status":"PERMISSION_DENIED","details":[{"reason":"TOS_VIOLATION"}]}}"#,
                    )
                }
            }),
        );

        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind mock listener");
        let addr = listener.local_addr().expect("mock addr");
        let server = tokio::spawn(async move {
            let _ = axum::serve(listener, app).await;
        });

        let cred = CredentialEntry {
            source: "antigravity".to_string(),
            access_token: "test-token".to_string(),
            account_id: Some("mock-proj-403".to_string()),
            account_email: Some("test-tos403@example.com".to_string()),
            ..Default::default()
        };
        let body = json!({
            "messages": [{ "role": "user", "content": "hi" }]
        });
        let url = format!("http://{}/v1internal:streamGenerateContent?alt=sse", addr);

        let r1 = handle_antigravity_with_cred(cred.clone(), body.clone(), "gemini-2.5-flash", false, &url).await;
        assert_eq!(r1.status(), StatusCode::FORBIDDEN);
        assert_eq!(hits.load(Ordering::SeqCst), 1);

        // Second request during active TOS_VIOLATION cooldown is rejected locally without hitting upstream.
        let r2 = handle_antigravity_with_cred(cred, body, "gemini-2.5-flash", false, &url).await;
        assert_eq!(r2.status(), StatusCode::TOO_MANY_REQUESTS);
        assert_eq!(hits.load(Ordering::SeqCst), 1);

        server.abort();
    }

    #[tokio::test]
    async fn forwards_user_image_url_as_inline_data() {
        let captured: Arc<StdMutex<Vec<Value>>> = Arc::new(StdMutex::new(Vec::new()));
        let captured_srv = Arc::clone(&captured);

        let app = Router::new().route(
            "/v1internal:streamGenerateContent",
            post(move |Json(payload): Json<Value>| {
                let cap = Arc::clone(&captured_srv);
                async move {
                    cap.lock().expect("lock captured").push(payload);
                    (
                        StatusCode::OK,
                        "data: {\"response\":{\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"I see the image.\"}]},\"finishReason\":\"STOP\"}]}}\n\n",
                    )
                }
            }),
        );

        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind mock listener");
        let addr = listener.local_addr().expect("mock addr");
        let server = tokio::spawn(async move {
            let _ = axum::serve(listener, app).await;
        });

        let cred = CredentialEntry {
            source: "antigravity".to_string(),
            access_token: "test-token".to_string(),
            account_id: Some("mock-proj-img".to_string()),
            account_email: Some("test-vision@example.com".to_string()),
            ..Default::default()
        };
        let b64_png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
        let body = json!({
            "messages": [{
                "role": "user",
                "content": [
                    { "type": "text", "text": "Match this style" },
                    { "type": "image_url", "image_url": { "url": format!("data:image/png;base64,{}", b64_png) } }
                ]
            }]
        });
        let url = format!("http://{}/v1internal:streamGenerateContent?alt=sse", addr);

        let resp = handle_antigravity_with_cred(cred, body, "gemini-3.8-flash-high", false, &url).await;
        assert_eq!(resp.status(), StatusCode::OK);

        let sent = captured.lock().expect("lock captured").pop().expect("captured payload");
        let parts = sent
            .pointer("/request/contents/0/parts")
            .and_then(|v| v.as_array())
            .expect("user parts");
        assert_eq!(parts.len(), 2);
        assert_eq!(parts[0], json!({ "text": "Match this style" }));
        assert_eq!(
            parts[1],
            json!({
                "inlineData": {
                    "mimeType": "image/png",
                    "data": b64_png
                }
            })
        );

        server.abort();
    }
}

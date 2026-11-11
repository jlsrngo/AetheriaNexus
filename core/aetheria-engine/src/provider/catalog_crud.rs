//! UI Provider Configuration Mutation Routes (Upsert, Connect, State Update, Delete).

use super::catalog::build_ui_providers_list;
use super::config::{read_aetheria_config, write_aetheria_config};
use crate::paths::now_ms;
use axum::{
    extract::Path as AxumPath,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::{json, Value};

pub fn slugify_id(name: &str) -> String {
    let s: String = name
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect();
    let trimmed = s.trim_matches('-').to_string();
    if trimmed.is_empty() {
        format!("provider-{}", now_ms())
    } else {
        trimmed
    }
}

pub async fn handle_ui_providers_upsert(Json(body): Json<Value>) -> Response {
    let name = body
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("Custom Provider");
    let pid = body
        .get("id")
        .or_else(|| body.get("providerId"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| slugify_id(name));
    upsert_ui_provider(&pid, &body)
}

pub async fn handle_ui_providers_update(
    AxumPath(pid): AxumPath<String>,
    Json(body): Json<Value>,
) -> Response {
    upsert_ui_provider(&pid, &body)
}

pub fn upsert_ui_provider(pid: &str, body: &Value) -> Response {
    let mut cfg = read_aetheria_config();
    if cfg.get("provider").and_then(|v| v.as_object()).is_none() {
        cfg["provider"] = json!({});
    }
    let name = body.get("name").and_then(|v| v.as_str()).unwrap_or(pid);
    let ptype = body.get("type").and_then(|v| v.as_str()).unwrap_or("openai");
    let base_url = body
        .get("baseUrl")
        .or_else(|| body.get("baseURL"))
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let api_key = body.get("apiKey").and_then(|v| v.as_str()).unwrap_or("");
    let model = body
        .get("model")
        .and_then(|v| v.as_str())
        .unwrap_or("gpt-4o");

    let mut models_obj = cfg
        .pointer(&format!("/provider/{}/models", pid))
        .and_then(|v| v.as_object())
        .cloned()
        .unwrap_or_default();

    if !model.is_empty() {
        models_obj.insert(
            model.to_string(),
            json!({
                "name": model,
                "attachment": true,
                "reasoning": true,
                "tool_call": true,
                "limit": { "context": 128000, "output": 16384 }
            }),
        );
    }

    cfg["provider"][pid] = json!({
        "name": name,
        "type": ptype,
        "npm": "@ai-sdk/openai-compatible",
        "api": base_url,
        "defaultModel": model,
        "active": true,
        "priority": 1,
        "options": {
            "baseURL": base_url,
            "apiKey": api_key
        },
        "models": models_obj
    });
    if !model.is_empty() {
        cfg["model"] = Value::String(format!("{}/{}", pid, model));
    }
    write_aetheria_config(&cfg);

    let item = json!({
        "id": pid,
        "name": name,
        "type": ptype,
        "baseUrl": base_url,
        "apiKey": api_key,
        "model": model,
        "active": true,
        "priority": 1
    });
    Json(json!({ "data": item })).into_response()
}

pub async fn handle_ui_providers_state(
    AxumPath(pid): AxumPath<String>,
    Json(body): Json<Value>,
) -> Response {
    let mut cfg = read_aetheria_config();
    if let Some(pobj) = cfg
        .pointer_mut(&format!("/provider/{}", pid))
        .and_then(|v| v.as_object_mut())
    {
        if let Some(act) = body.get("active").and_then(|v| v.as_bool()) {
            pobj.insert("active".to_string(), Value::Bool(act));
        }
        if let Some(prio) = body.get("priority").and_then(|v| v.as_u64()) {
            pobj.insert("priority".to_string(), json!(prio));
        }
        if let Some(m) = body.get("model").and_then(|v| v.as_str()) {
            if !m.is_empty() {
                pobj.insert("defaultModel".to_string(), Value::String(m.to_string()));
                if let Some(models_map) = pobj.get_mut("models").and_then(|v| v.as_object_mut()) {
                    models_map.entry(m.to_string()).or_insert_with(|| {
                        json!({
                            "name": m,
                            "attachment": true,
                            "reasoning": true,
                            "tool_call": true,
                            "limit": { "context": 200000, "output": 32768 }
                        })
                    });
                }
            }
        }
    }
    if let Some(m) = body.get("model").and_then(|v| v.as_str()) {
        if !m.is_empty() {
            cfg["model"] = Value::String(format!("{}/{}", pid, m));
        }
    }
    write_aetheria_config(&cfg);
    let updated = build_ui_providers_list()
        .into_iter()
        .find(|p| p.get("id").and_then(|v| v.as_str()) == Some(&pid))
        .unwrap_or_else(|| json!({ "id": pid, "active": true }));
    Json(json!({ "data": updated })).into_response()
}

pub async fn handle_providers_connect(Json(body): Json<Value>) -> Response {
    let Some(pid) = body.get("providerId").and_then(|v| v.as_str()) else {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "providerId is required" })),
        )
            .into_response();
    };
    let mut cfg = read_aetheria_config();
    if cfg.get("provider").and_then(|v| v.as_object()).is_none() {
        cfg["provider"] = json!({});
    }
    let name = body.get("name").and_then(|v| v.as_str()).unwrap_or(pid);
    let base_url = body.get("baseURL").and_then(|v| v.as_str()).unwrap_or("");
    let api_key = body.get("apiKey").and_then(|v| v.as_str()).unwrap_or("");

    let mut models_obj = cfg
        .pointer(&format!("/provider/{}/models", pid))
        .and_then(|v| v.as_object())
        .cloned()
        .unwrap_or_default();

    if let Some(m_arr) = body.get("models").and_then(|v| v.as_array()) {
        for m in m_arr {
            if let Some(mid) = m.get("id").and_then(|v| v.as_str()) {
                models_obj.insert(
                    mid.to_string(),
                    json!({
                        "name": m.get("name").and_then(|v| v.as_str()).unwrap_or(mid),
                        "attachment": true,
                        "reasoning": true,
                        "tool_call": true,
                        "limit": { "context": 128000, "output": 16384 }
                    }),
                );
            }
        }
    }

    cfg["provider"][pid] = json!({
        "name": name,
        "npm": "@ai-sdk/openai-compatible",
        "api": base_url,
        "options": {
            "baseURL": base_url,
            "apiKey": api_key
        },
        "models": models_obj
    });

    if body
        .get("setAsDefault")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
    {
        if let Some(first_mod) = models_obj.keys().next() {
            cfg["model"] = Value::String(format!("{}/{}", pid, first_mod));
        }
    }

    write_aetheria_config(&cfg);
    Json(json!({ "ok": true, "providerId": pid })).into_response()
}

pub async fn handle_providers_delete(AxumPath(pid): AxumPath<String>) -> Response {
    let mut cfg = read_aetheria_config();
    if let Some(map) = cfg.get_mut("provider").and_then(|v| v.as_object_mut()) {
        map.remove(&pid);
    }
    if let Some(map) = cfg.get_mut("providers").and_then(|v| v.as_object_mut()) {
        map.remove(&pid);
    }
    write_aetheria_config(&cfg);
    Json(json!({ "ok": true, "data": { "ok": true } })).into_response()
}


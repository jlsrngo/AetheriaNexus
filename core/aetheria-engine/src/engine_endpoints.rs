use crate::desktop;
use crate::paths::{gen_id, now_ms};
use crate::session::get_event_sender;
use crate::ENGINE_VERSION;
use axum::{
    body::Body,
    extract::Request,
    http::{header, Method, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use futures_util::StreamExt;
use serde_json::json;
use std::time::Duration;
use tokio_stream::wrappers::BroadcastStream;

pub async fn handle_health() -> impl IntoResponse {
    Json(json!({
        "healthy": true,
        "version": ENGINE_VERSION,
        "runtime": "rust"
    }))
}

pub async fn handle_sse_events() -> Response {
    let rx = get_event_sender().subscribe();
    let initial = futures_util::stream::once(async move {
        let init_evt = json!({
            "directory": "global",
            "payload": {
                "id": gen_id("evt"),
                "type": "server.connected",
                "time": now_ms(),
                "properties": {}
            }
        });
        Ok::<_, std::convert::Infallible>(format!("data: {}\n\n", init_evt))
    });

    let bstream = BroadcastStream::new(rx).filter_map(|res| async move {
        match res {
            Ok(val) => Some(Ok::<_, std::convert::Infallible>(format!(
                "data: {}\n\n",
                val
            ))),
            Err(_) => None,
        }
    });

    let combined = initial.chain(bstream);
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "text/event-stream")
        .header(header::CACHE_CONTROL, "no-cache")
        .header(header::CONNECTION, "keep-alive")
        .body(Body::from_stream(combined))
        .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response())
}

pub async fn handle_fallback(req: Request) -> Response {
    // 1. Try serving static Vite frontend assets (apps/dist)
    let uri_path = req.uri().path().to_string();
    if req.method() == Method::GET {
        if let Some(static_resp) = desktop::try_serve_static_asset(&uri_path) {
            return static_resp;
        }
    }

    // 2. Optional TypeScript upstream fallback if explicitly configured
    if let Ok(upstream) = std::env::var("AETHERIA_TS_UPSTREAM") {
        let upstream = upstream.trim_end_matches('/');
        if !upstream.is_empty() {
            let method = req.method().clone();
            let pq = req
                .uri()
                .path_and_query()
                .map(|x| x.as_str())
                .unwrap_or("/");
            let target_url = format!("{}{}", upstream, pq);
            let client = reqwest::Client::builder()
                .timeout(Duration::from_secs(60))
                .build()
                .unwrap_or_default();
            if let Ok(body_bytes) =
                axum::body::to_bytes(req.into_body(), 16 * 1024 * 1024).await
            {
                let req_method = reqwest::Method::from_bytes(method.as_str().as_bytes())
                    .unwrap_or(reqwest::Method::GET);
                if let Ok(r) = client
                    .request(req_method, &target_url)
                    .body(body_bytes.to_vec())
                    .send()
                    .await
                {
                    let status =
                        StatusCode::from_u16(r.status().as_u16()).unwrap_or(StatusCode::OK);
                    let bytes = r.bytes().await.unwrap_or_default();
                    return (status, bytes).into_response();
                }
            }
        }
    }

    (
        StatusCode::NOT_FOUND,
        Json(json!({ "error": "Endpoint not found" })),
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use crate::handle_local_request;

    #[tokio::test]
    async fn local_dispatch_reaches_router_without_socket() {
        let (status, _, body) = handle_local_request("GET", "/api/health", vec![], None).await;
        assert_eq!(status, 200);
        assert!(String::from_utf8_lossy(&body).contains("\"healthy\":true"));
    }

    #[tokio::test]
    async fn local_dispatch_still_blocks_web_origins() {
        let (status, _, _) = handle_local_request(
            "GET",
            "/api/health",
            vec![("origin".to_string(), "https://evil.com".to_string())],
            None,
        )
        .await;
        assert_eq!(status, 403);
    }

    #[tokio::test]
    async fn test_nexus_studio_heavy_engine_smoke() {
        // 1. GPU Telemetry
        let (status, _, body) =
            handle_local_request("GET", "/api/studio/gpu-telemetry", vec![], None).await;
        assert_eq!(status, 200);
        let resp: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(resp["success"], true);
        assert!(resp["encoder"].is_string());

        // 2. Subtitle Generator
        let (status, _, body) = handle_local_request(
            "POST",
            "/api/studio/generate-subtitles",
            vec![("content-type".to_string(), "application/json".to_string())],
            Some(
                r#"{"text":"The secret to viral TikTok video retention"}"#
                    .as_bytes()
                    .to_vec(),
            ),
        )
        .await;
        assert_eq!(status, 200);
        let resp: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(resp["success"], true);
        assert!(resp["cues"].as_array().unwrap().len() > 0);

        // 3. AI Script Orchestrator
        let (status, _, body) = handle_local_request(
            "POST",
            "/api/studio/generate-script",
            vec![("content-type".to_string(), "application/json".to_string())],
            Some(
                r#"{"topic":"Deep Focus Blueprint","autoRegister":false}"#
                    .as_bytes()
                    .to_vec(),
            ),
        )
        .await;
        assert_eq!(status, 200);
        let resp: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(resp["success"], true);
        assert!(resp["composition"]["id"].is_string());

        // 4. Voice Presets Studio (/add preset backend E2E: list, save custom tuning, restore)
        let (status, _, body) =
            handle_local_request("GET", "/api/studio/voice-presets", vec![], None).await;
        assert_eq!(status, 200);
        let resp: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(resp["success"], true);
        assert_eq!(resp["presets"]["aetheria"]["id"].as_str(), Some("aetheria"));
        assert_eq!(
            resp["presets"]["aetheria_en"]["id"].as_str(),
            Some("aetheria_en")
        );

        // 5. Voice Preset Test Synthesis Endpoint (Zero-LLM preview)
        let (status, _, body) = handle_local_request(
            "POST",
            "/api/studio/voice-presets/test",
            vec![("content-type".to_string(), "application/json".to_string())],
            Some(
                r#"{"text":"Halo ini tes cepat suara Aetheria.","voice":"id-ID-ArdiNeural","lang":"id","rate":"+10%","pitch":"+14Hz"}"#
                    .as_bytes()
                    .to_vec(),
            ),
        )
        .await;
        assert_eq!(status, 200);
        let test_resp: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(test_resp["success"], true);
        assert!(test_resp["audioDataUrl"]
            .as_str()
            .unwrap_or("")
            .starts_with("data:audio/wav;base64,"));
    }
}


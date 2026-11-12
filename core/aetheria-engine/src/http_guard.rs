use axum::{
    body::Body,
    extract::Request,
    http::{header, Method, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};

/// Browsers always send `Origin` on cross-site requests; the native webview (same-origin),
/// CLI tools and other local processes do not. Only Aetheria's own UI and local dev servers
/// are cross-site origins worth trusting, so everything else is refused.
pub fn is_allowed_origin(origin: &str) -> bool {
    origin.starts_with("tauri://")
        || origin == "http://tauri.localhost"
        || origin == "https://tauri.localhost"
        || origin == "http://localhost"
        || origin == "https://localhost"
        || origin.starts_with("http://localhost:")
        || origin.starts_with("https://localhost:")
        || origin == "http://127.0.0.1"
        || origin.starts_with("http://127.0.0.1:")
}

pub async fn cors_and_auth_middleware(req: Request, next: Next) -> Response {
    // Any page the user opens in a browser can reach loopback:4096; only let Aetheria's
    // own origins through so a random website cannot drive the local API.
    if let Some(origin) = req
        .headers()
        .get(header::ORIGIN)
        .and_then(|v| v.to_str().ok())
    {
        if !is_allowed_origin(origin) {
            return Response::builder()
                .status(StatusCode::FORBIDDEN)
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(
                    r#"{"error":"Forbidden: cross-site browser access to the local engine is blocked"}"#,
                ))
                .unwrap_or_else(|_| StatusCode::FORBIDDEN.into_response());
        }
    }

    if req.method() == Method::OPTIONS {
        return Response::builder()
            .status(StatusCode::NO_CONTENT)
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .header(
                header::ACCESS_CONTROL_ALLOW_METHODS,
                "GET, POST, PUT, PATCH, DELETE, OPTIONS",
            )
            .header(
                header::ACCESS_CONTROL_ALLOW_HEADERS,
                "Content-Type, Authorization, x-aetheria-directory, x-opencode-directory, x-aetheria-workspace",
            )
            .body(Body::empty())
            .unwrap_or_else(|_| StatusCode::NO_CONTENT.into_response());
    }

    let expected = crate::server_auth::credentials();

    let provided = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    let mut authorized = crate::server_auth::verify_basic_auth_header(provided, expected);
    if !authorized {
        if let Some(query) = req.uri().query() {
            for pair in query.split('&') {
                if let Some((k, v)) = pair.split_once('=') {
                    if (k == "auth_token" || k == "token")
                        && crate::server_auth::verify_query_token(v, expected)
                    {
                        authorized = true;
                        break;
                    }
                }
            }
        }
    }

    if !authorized {
        return Response::builder()
            .status(StatusCode::UNAUTHORIZED)
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(r#"{"error":"Unauthorized"}"#))
            .unwrap_or_else(|_| StatusCode::UNAUTHORIZED.into_response());
    }

    let mut resp = next.run(req).await;
    let headers = resp.headers_mut();
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_ORIGIN,
        header::HeaderValue::from_static("*"),
    );
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_METHODS,
        header::HeaderValue::from_static("GET, POST, PUT, PATCH, DELETE, OPTIONS"),
    );
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_HEADERS,
        header::HeaderValue::from_static(
            "Content-Type, Authorization, x-aetheria-directory, x-opencode-directory, x-aetheria-workspace",
        ),
    );
    resp
}

#[cfg(test)]
mod tests {
    use super::is_allowed_origin;

    #[test]
    fn allows_own_ui_and_local_dev_origins() {
        for origin in [
            "tauri://localhost",
            "http://tauri.localhost",
            "https://tauri.localhost",
            "http://localhost",
            "http://localhost:5173",
            "http://127.0.0.1:4173",
        ] {
            assert!(is_allowed_origin(origin), "{origin} should be allowed");
        }
    }

    #[test]
    fn blocks_arbitrary_web_origins() {
        for origin in [
            "https://evil.com",
            "null",
            "http://localhost.evil.com",
            "http://127.0.0.1.evil.com",
            "https://tauri.localhost.evil.com",
        ] {
            assert!(!is_allowed_origin(origin), "{origin} should be blocked");
        }
    }

    #[tokio::test]
    async fn rejects_unauthenticated_requests_with_401_by_default() {
        use axum::{routing::get, Router};
        use tower::ServiceExt;

        let app = Router::new()
            .route("/api/health", get(|| async { "ok" }))
            .layer(axum::middleware::from_fn(super::cors_and_auth_middleware));

        let unauth_req = axum::http::Request::builder()
            .uri("/api/health")
            .body(axum::body::Body::empty())
            .unwrap();
        let unauth_res = app.clone().oneshot(unauth_req).await.unwrap();
        assert_eq!(unauth_res.status(), axum::http::StatusCode::UNAUTHORIZED);

        let auth_req = axum::http::Request::builder()
            .uri("/api/health")
            .header(
                axum::http::header::AUTHORIZATION,
                crate::server_auth::server_auth_header(),
            )
            .body(axum::body::Body::empty())
            .unwrap();
        let auth_res = app.oneshot(auth_req).await.unwrap();
        assert_eq!(auth_res.status(), axum::http::StatusCode::OK);
    }
}


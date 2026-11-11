use axum::{
    body::Body,
    extract::Request,
    http::{header, Method, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use base64::Engine as _;

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

    // Check Basic Auth only when Aetheria_SERVER_PASSWORD / AETHERIA_SERVER_PASSWORD is set
    if let Ok(expected_pass) = std::env::var("Aetheria_SERVER_PASSWORD")
        .or_else(|_| std::env::var("AETHERIA_SERVER_PASSWORD"))
    {
        if !expected_pass.is_empty() {
            let expected_user = std::env::var("Aetheria_SERVER_USERNAME")
                .or_else(|_| std::env::var("AETHERIA_SERVER_USERNAME"))
                .unwrap_or_else(|_| "aetheria".to_string());
            let expected_b64 = base64::engine::general_purpose::STANDARD
                .encode(format!("{}:{}", expected_user, expected_pass));
            let expected_hdr = format!("Basic {}", expected_b64);

            let provided = req
                .headers()
                .get(header::AUTHORIZATION)
                .and_then(|v| v.to_str().ok())
                .unwrap_or("");

            let mut authorized = provided == expected_hdr;
            if !authorized {
                if let Some(query) = req.uri().query() {
                    for pair in query.split('&') {
                        if let Some((k, v)) = pair.split_once('=') {
                            if k == "auth_token" || k == "token" {
                                if let Ok(decoded) = base64::engine::general_purpose::STANDARD
                                    .decode(v)
                                    .or_else(|_| base64::engine::general_purpose::URL_SAFE.decode(v))
                                    .or_else(|_| {
                                        base64::engine::general_purpose::STANDARD_NO_PAD.decode(v)
                                    })
                                {
                                    if let Ok(s) = String::from_utf8(decoded) {
                                        if s == format!("{}:{}", expected_user, expected_pass) {
                                            authorized = true;
                                            break;
                                        }
                                    }
                                }
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
        }
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
}


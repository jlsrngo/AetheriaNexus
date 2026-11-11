//! Aetheria Motion Engine HTTP Handlers & Film Path Resolver.

pub use super::motion_linter::{
    inspect_workspace_film, lint_html_film, FilmLintIssue, FilmLintReport, FilmMeta, FilmSceneSpec,
};

use axum::{
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::path::PathBuf;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LintPayload {
    pub html: Option<String>,
}

/// Resolves the active `workspace/index.html` path.
pub fn resolve_workspace_html_path() -> PathBuf {
    let root = crate::paths::project_root();
    let ws_html = root.join("workspace").join("index.html");
    if ws_html.exists() {
        return ws_html;
    }
    if let Some(active) = crate::desktop::get_active_workspace_root() {
        let p = PathBuf::from(&active);
        let candidate = if p.ends_with("workspace") {
            p.join("index.html")
        } else {
            p.join("workspace").join("index.html")
        };
        if candidate.exists() {
            return candidate;
        }
    }
    ws_html
}

/// GET/POST /api/studio/film-meta
pub async fn handle_film_meta() -> impl IntoResponse {
    let path = resolve_workspace_html_path();
    Json(inspect_workspace_film(&path))
}

/// POST /api/studio/film-lint
pub async fn handle_film_lint(payload: Option<Json<LintPayload>>) -> impl IntoResponse {
    let html = payload.and_then(|p| p.0.html).unwrap_or_else(|| {
        let path = resolve_workspace_html_path();
        std::fs::read_to_string(path).unwrap_or_default()
    });
    Json(lint_html_film(&html))
}

/// GET /api/studio/film-html
pub async fn handle_film_html() -> Response {
    let path = resolve_workspace_html_path();
    if !path.exists() {
        return (
            StatusCode::NOT_FOUND,
            Json::<Value>(json!({ "error": "workspace/index.html not found" })),
        )
            .into_response();
    }
    let mut html = std::fs::read_to_string(&path).unwrap_or_default();
    if !html.contains("aetheria-motion.js") {
        let tag = "<script src=\"/aetheria-motion.js\"></script>\n";
        if let Some(head_idx) = html.find("</head>") {
            html.insert_str(head_idx, tag);
        } else {
            html = format!("{}{}", tag, html);
        }
    }
    ([(header::CONTENT_TYPE, "text/html; charset=utf-8")], html).into_response()
}

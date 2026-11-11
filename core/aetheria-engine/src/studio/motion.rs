//! Aetheria Motion Engine HTTP Handlers & Isolated Active-Folder Film Resolver.

pub use super::film_inspector::{
    collect_ordered_script_files, inspect_workspace_film, FilmMeta, FilmSceneSpec,
};
pub use super::motion_linter::{lint_html_film, FilmLintIssue, FilmLintReport};

use axum::{
    extract::Query,
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LintPayload {
    pub html: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FilmScriptAsset {
    pub name: String,
    pub relative_path: String,
    pub code: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FilmBundleResponse {
    pub exists: bool,
    pub active_dir: Option<String>,
    pub film_root: Option<String>,
    pub meta: FilmMeta,
    pub raw_html: String,
    pub scripts: Vec<FilmScriptAsset>,
}

/// Resolves the explicitly active project directory without falling back to the engine source repo.
pub fn resolve_active_dir_from_request(
    q: &HashMap<String, String>,
    headers: &HeaderMap,
) -> Option<PathBuf> {
    if let Some(dir) = q.get("directory").or_else(|| q.get("workspacePath")) {
        if !dir.trim().is_empty() {
            let norm = crate::paths::normalize_workspace_path(dir);
            crate::desktop::set_active_workspace_root(&norm);
            return Some(PathBuf::from(norm));
        }
    }
    if let Some(hdr) = headers
        .get("x-aetheria-directory")
        .or_else(|| headers.get("x-opencode-directory"))
        .and_then(|v| v.to_str().ok())
    {
        if !hdr.trim().is_empty() {
            let decoded = crate::files::urlencoding_decode(hdr);
            let norm = crate::paths::normalize_workspace_path(&decoded);
            crate::desktop::set_active_workspace_root(&norm);
            return Some(PathBuf::from(norm));
        }
    }
    crate::desktop::get_active_workspace_root()
        .filter(|s| !s.trim().is_empty())
        .map(PathBuf::from)
}

/// Finds `index.html` inside the given opened project root (`<dir>/index.html` or `<dir>/workspace/index.html`).
pub fn resolve_film_html_in_dir(ws_root: &Path) -> Option<PathBuf> {
    let direct = ws_root.join("index.html");
    if direct.is_file() {
        return Some(direct);
    }
    let sub = ws_root.join("workspace").join("index.html");
    if sub.is_file() {
        return Some(sub);
    }
    None
}

/// Shared resolver for headless export / CLI / inspection endpoints.
pub fn resolve_active_html_film_path(explicit_dir: Option<&str>) -> Option<PathBuf> {
    let base = match explicit_dir.map(str::trim).filter(|s| !s.is_empty()) {
        Some(dir) => PathBuf::from(crate::paths::normalize_workspace_path(dir)),
        None => crate::desktop::get_active_workspace_root()
            .filter(|s| !s.trim().is_empty())
            .map(PathBuf::from)?,
    };
    resolve_film_html_in_dir(&base)
}

fn load_engine_motion_runtime() -> Option<String> {
    let path = crate::paths::project_root()
        .join("apps")
        .join("public")
        .join("script")
        .join("aetheria-motion.js");
    std::fs::read_to_string(path).ok()
}

/// GET/POST /api/studio/film-meta
pub async fn handle_film_meta(
    Query(q): Query<HashMap<String, String>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let html_path = resolve_active_dir_from_request(&q, &headers)
        .and_then(|dir| resolve_film_html_in_dir(&dir));

    match html_path {
        Some(path) => Json(inspect_workspace_film(&path)),
        None => Json(inspect_workspace_film(Path::new(""))),
    }
}

/// GET/POST /api/studio/film-bundle
pub async fn handle_film_bundle(
    Query(q): Query<HashMap<String, String>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let active_dir = resolve_active_dir_from_request(&q, &headers);
    let html_path = active_dir.as_deref().and_then(resolve_film_html_in_dir);

    let Some(path) = html_path else {
        return Json(FilmBundleResponse {
            exists: false,
            active_dir: active_dir.map(|p| p.to_string_lossy().to_string()),
            film_root: None,
            meta: inspect_workspace_film(Path::new("")),
            raw_html: String::new(),
            scripts: Vec::new(),
        });
    };

    let meta = inspect_workspace_film(&path);
    let raw_html = std::fs::read_to_string(&path).unwrap_or_default();
    let ordered = collect_ordered_script_files(&path);

    let has_motion_lib = ordered
        .iter()
        .any(|(name, _, _)| name.eq_ignore_ascii_case("aetheria-motion.js"));

    let mut scripts: Vec<FilmScriptAsset> = Vec::with_capacity(ordered.len() + 1);
    if !has_motion_lib {
        if let Some(builtin_am) = load_engine_motion_runtime() {
            scripts.push(FilmScriptAsset {
                name: "aetheria-motion.js".to_string(),
                relative_path: "script/aetheria-motion.js".to_string(),
                code: builtin_am,
            });
        }
    }

    for (name, relative_path, code) in ordered {
        scripts.push(FilmScriptAsset {
            name,
            relative_path,
            code,
        });
    }

    let film_root = path.parent().map(|p| p.to_string_lossy().to_string());
    Json(FilmBundleResponse {
        exists: true,
        active_dir: active_dir.map(|p| p.to_string_lossy().to_string()),
        film_root,
        meta,
        raw_html,
        scripts,
    })
}

/// POST /api/studio/film-lint
pub async fn handle_film_lint(
    Query(q): Query<HashMap<String, String>>,
    headers: HeaderMap,
    payload: Option<Json<LintPayload>>,
) -> impl IntoResponse {
    let explicit_html = payload.and_then(|p| p.0.html);
    let source = match explicit_html {
        Some(h) => h,
        None => {
            if let Some(path) = resolve_active_dir_from_request(&q, &headers)
                .and_then(|dir| resolve_film_html_in_dir(&dir))
            {
                let mut combined = std::fs::read_to_string(&path).unwrap_or_default();
                for (_, _, code) in collect_ordered_script_files(&path) {
                    combined.push('\n');
                    combined.push_str(&code);
                }
                combined
            } else {
                String::new()
            }
        }
    };
    Json(lint_html_film(&source))
}

/// GET /api/studio/film-html
pub async fn handle_film_html(
    Query(q): Query<HashMap<String, String>>,
    headers: HeaderMap,
) -> Response {
    let Some(path) = resolve_active_dir_from_request(&q, &headers)
        .and_then(|dir| resolve_film_html_in_dir(&dir))
    else {
        return (
            StatusCode::NOT_FOUND,
            Json::<Value>(json!({ "error": "No index.html found in active project folder" })),
        )
            .into_response();
    };

    let mut html = std::fs::read_to_string(&path).unwrap_or_default();
    if !html.contains("aetheria-motion.js") {
        let tag = "<script src=\"/api/studio/ws-asset/script/aetheria-motion.js\"></script>\n";
        if let Some(head_idx) = html.find("</head>") {
            html.insert_str(head_idx, tag);
        } else {
            html = format!("{}{}", tag, html);
        }
    }
    ([(header::CONTENT_TYPE, "text/html; charset=utf-8")], html).into_response()
}

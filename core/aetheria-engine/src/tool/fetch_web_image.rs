//! Web Image Fetch Tool — searches Wikipedia / Wikimedia Commons or direct URLs
//! and downloads editorial photos or fallback illustrations into the project's `img/` subfolder.

use serde_json::{json, Value};
use std::path::PathBuf;

use super::path_guard::resolve_isolated_path;
use super::websearch::encode_query;

pub fn fetch_web_image_tool_definition() -> Value {
    json!({
        "type": "function",
        "function": {
            "name": "fetch_web_image",
            "description": "Searches the internet (Wikipedia, Wikimedia Commons, or direct URL) and downloads a real photo, historical image, portrait, or illustration directly into `img/<filename>` inside the active project folder so you can render it inside `index.html` or `script/scene*.js` using `/img/<filename>`.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query for the image/photo on the internet (e.g. 'Rami Malek portrait', 'Teletype Model 33 terminal', 'Ken Thompson Dennis Ritchie Unix', 'Ubuntu Linux logo')."
                    },
                    "outputPath": {
                        "type": "string",
                        "description": "Destination path inside the active project's img/ subfolder (e.g. 'img/img_hacker.jpg' or 'img_terminal.jpg')."
                    },
                    "url": {
                        "type": "string",
                        "description": "Optional direct image URL (https://...) if known."
                    }
                },
                "required": ["query", "outputPath"]
            }
        }
    })
}

/// Normalizes an LLM-provided image output path so assets land cleanly inside `img/`
/// without leaking legacy `workspace/` or `public/` prefixes.
fn normalize_image_rel_path(raw_out: &str) -> String {
    let mut s = raw_out.trim().replace('\\', "/");
    while let Some(rest) = s.strip_prefix("./").or_else(|| s.strip_prefix('/')) {
        s = rest.to_string();
    }
    if let Some(rest) = s.strip_prefix("workspace/") {
        s = rest.to_string();
    }
    if let Some(rest) = s.strip_prefix("public/") {
        s = if rest.starts_with("img/") {
            rest.to_string()
        } else {
            format!("img/{}", rest)
        };
    }
    if s.is_empty() {
        return "img/web_image.jpg".to_string();
    }
    if !s.contains('/') {
        return format!("img/{}", s);
    }
    s
}

pub async fn execute_fetch_web_image(workspace_dir: &str, arguments: &Value) -> Value {
    let query = arguments
        .get("query")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim();
    let raw_out = arguments
        .get("outputPath")
        .or_else(|| arguments.get("output_path"))
        .or_else(|| arguments.get("filename"))
        .and_then(|v| v.as_str())
        .unwrap_or("img/web_image.jpg")
        .trim();
    let direct_url = arguments
        .get("url")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim();

    if query.is_empty() && direct_url.is_empty() {
        return json!({ "error": "fetch_web_image requires 'query' or 'url'." });
    }

    let clean_rel = normalize_image_rel_path(raw_out);
    let target_out: PathBuf = if std::path::Path::new(raw_out).is_absolute() {
        match resolve_isolated_path(workspace_dir, raw_out) {
            Ok(p) => p,
            Err(e) => return json!({ "error": e }),
        }
    } else {
        match resolve_isolated_path(workspace_dir, &clean_rel) {
            Ok(p) => p,
            Err(e) => return json!({ "error": e }),
        }
    };
    if let Some(parent) = target_out.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let asset_name = target_out
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "web_image.jpg".to_string());
    let asset_rel = if clean_rel.starts_with("img/") {
        clean_rel.clone()
    } else {
        format!("img/{}", asset_name)
    };

    let client = reqwest::Client::builder()
        .user_agent("AetheriaNexus/1.0 (https://github.com/jlsrngo/AetheriaNexus; studio@aetheria.ai)")
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .unwrap_or_default();

    let mut candidate_urls: Vec<String> = Vec::new();
    if !direct_url.is_empty() {
        candidate_urls.push(direct_url.to_string());
    }

    if !query.is_empty() {
        // 1. Wikipedia PageImages Search
        let wp_api = format!(
            "https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch={}&gsrlimit=5&prop=pageimages&piprop=thumbnail|original&pithumbsize=900&format=json",
            encode_query(query)
        );
        if let Ok(resp) = client.get(&wp_api).send().await {
            if let Ok(data) = resp.json::<Value>().await {
                if let Some(pages) = data.pointer("/query/pages").and_then(|v| v.as_object()) {
                    for (_id, page) in pages {
                        if let Some(thumb) = page.pointer("/thumbnail/source").and_then(|v| v.as_str()) {
                            candidate_urls.push(thumb.to_string());
                        }
                        if let Some(orig) = page.pointer("/original/source").and_then(|v| v.as_str()) {
                            if !orig.ends_with(".svg") && !orig.ends_with(".tif") && !orig.ends_with(".pdf") {
                                candidate_urls.push(orig.to_string());
                            }
                        }
                    }
                }
            }
        }

        // 2. Wikimedia Commons Bitmap Search
        if candidate_urls.is_empty() {
            let commons_api = format!(
                "https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch={}&gsrlimit=5&prop=imageinfo&iiprop=url&iiurlwidth=900&format=json",
                encode_query(&format!("filetype:bitmap {}", query))
            );
            if let Ok(resp) = client.get(&commons_api).send().await {
                if let Ok(data) = resp.json::<Value>().await {
                    if let Some(pages) = data.pointer("/query/pages").and_then(|v| v.as_object()) {
                        for (_id, page) in pages {
                            if let Some(arr) = page.get("imageinfo").and_then(|v| v.as_array()) {
                                for info in arr {
                                    if let Some(u) = info
                                        .get("thumburl")
                                        .or_else(|| info.get("url"))
                                        .and_then(|v| v.as_str())
                                    {
                                        candidate_urls.push(u.to_string());
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    for img_url in &candidate_urls {
        if let Ok(resp) = client.get(img_url).send().await {
            if resp.status().is_success() {
                if let Ok(bytes) = resp.bytes().await {
                    if bytes.len() > 1024 {
                        if std::fs::write(&target_out, &bytes).is_ok() {
                            return json!({
                                "success": true,
                                "query": query,
                                "sourceUrl": img_url,
                                "outputPath": target_out.to_string_lossy().to_string(),
                                "assetPath": asset_rel,
                                "assetUrl": format!("/{}", asset_rel),
                                "bytes": bytes.len(),
                                "message": format!("Downloaded internet image to {} (use '/{}' in index.html / script/scene*.js)", asset_rel, asset_rel)
                            });
                        }
                    }
                }
            }
        }
    }

    // Fallback: high-resolution editorial SVG card if no external bitmap matched
    let safe_label: String = query.chars().take(36).collect();
    let fallback_svg = format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"800\" height=\"800\" viewBox=\"0 0 800 800\">\
        <rect width=\"800\" height=\"800\" rx=\"32\" fill=\"#061B56\"/>\
        <rect x=\"40\" y=\"40\" width=\"720\" height=\"720\" rx=\"20\" fill=\"none\" stroke=\"#FFFFFF\" stroke-width=\"4\" stroke-opacity=\"0.85\"/>\
        <circle cx=\"90\" cy=\"85\" r=\"10\" fill=\"none\" stroke=\"#FFFFFF\" stroke-width=\"3\"/>\
        <circle cx=\"125\" cy=\"85\" r=\"10\" fill=\"none\" stroke=\"#FFFFFF\" stroke-width=\"3\"/>\
        <circle cx=\"160\" cy=\"85\" r=\"10\" fill=\"none\" stroke=\"#FFFFFF\" stroke-width=\"3\"/>\
        <line x1=\"40\" y1=\"125\" x2=\"760\" y2=\"125\" stroke=\"#FFFFFF\" stroke-width=\"3\" stroke-opacity=\"0.7\"/>\
        <text x=\"400\" y=\"420\" text-anchor=\"middle\" fill=\"#FFFFFF\" font-family=\"Georgia, serif\" font-size=\"44\" font-weight=\"bold\">{}</text>\
        </svg>",
        safe_label.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;")
    );
    let _ = std::fs::write(&target_out, fallback_svg.as_bytes());
    json!({
        "success": true,
        "fallback": true,
        "query": query,
        "outputPath": target_out.to_string_lossy().to_string(),
        "assetPath": asset_rel,
        "assetUrl": format!("/{}", asset_rel),
        "message": format!("Generated fallback illustration {} at {} (use '/{}' in index.html / script/scene*.js)", asset_name, asset_rel, asset_rel)
    })
}


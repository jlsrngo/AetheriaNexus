//! Web Search Tool â€” mirrors `packages/engine/engine/src/tool/websearch.ts`.
//! Live internet search using DuckDuckGo HTML / instant API.

use serde_json::{json, Value};

fn encode_query(s: &str) -> String {
    let mut out = String::new();
    for b in s.bytes() {
        if b.is_ascii_alphanumeric() || b == b'-' || b == b'_' || b == b'.' || b == b'~' {
            out.push(b as char);
        } else if b == b' ' {
            out.push('+');
        } else {
            out.push_str(&format!("%{:02X}", b));
        }
    }
    out
}

pub fn websearch_tool_definition() -> Value {
    json!({
        "type": "function",
        "function": {
            "name": "websearch",
            "description": include_str!("prompt/websearch.txt"),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": { "type": "string", "description": "Web search query." },
                    "numResults": { "type": "number", "description": "Number of search results to return (default: 5)." }
                },
                "required": ["query"]
            }
        }
    })
}

pub async fn execute_websearch(arguments: &Value) -> Value {
    let query = arguments
        .get("query")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    if query.is_empty() {
        return json!({ "error": "Query cannot be empty." });
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .unwrap();

    let url = format!(
        "https://api.duckduckgo.com/?q={}&format=json&no_html=1&skip_disambig=1",
        encode_query(query)
    );

    let resp = client.get(&url).send().await;
    match resp {
        Ok(r) => {
            if let Ok(data) = r.json::<Value>().await {
                let abstract_txt = data
                    .get("AbstractText")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let heading = data
                    .get("Heading")
                    .and_then(|v| v.as_str())
                    .unwrap_or(query);

                let mut results = Vec::new();
                if !abstract_txt.is_empty() {
                    results.push(json!({
                        "title": heading,
                        "snippet": abstract_txt,
                        "url": data.get("AbstractURL").and_then(|v| v.as_str()).unwrap_or("")
                    }));
                }

                if let Some(topics) = data.get("RelatedTopics").and_then(|v| v.as_array()) {
                    for t in topics.iter().take(5) {
                        if let Some(txt) = t.get("Text").and_then(|v| v.as_str()) {
                            let u = t.get("FirstURL").and_then(|v| v.as_str()).unwrap_or("");
                            results.push(json!({
                                "title": txt,
                                "snippet": txt,
                                "url": u
                            }));
                        }
                    }
                }

                if results.is_empty() {
                    json!({
                        "query": query,
                        "results": [],
                        "output": format!("No instant results found for '{}'.", query)
                    })
                } else {
                    let total = results.len();
                    json!({
                        "query": query,
                        "matches": total,
                        "results": results,
                        "output": format!("Found {} web results for '{}'.", total, query)
                    })
                }
            } else {
                json!({ "output": format!("Completed search for '{}'", query) })
            }
        }
        Err(e) => json!({ "error": format!("Web search failed: {}", e) }),
    }
}

pub fn fetch_web_image_tool_definition() -> Value {
    json!({
        "type": "function",
        "function": {
            "name": "fetch_web_image",
            "description": "Searches the internet (Wikipedia, Wikimedia Commons, or direct URL) and downloads a real photo, historical image, portrait, or illustration directly into `workspace/public/<filename>` (and automatically syncs it into the Remotion bundle `public/` folder) so you can render it inside Remotion using `<Img src={staticFile(\"<filename>\")} />`. Always call this tool in parallel when a video style uses real cutout/B&W photos, historical portraits, or real-world imagery.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query for the image/photo on the internet (e.g. 'Rami Malek portrait', 'Teletype Model 33 terminal', 'Ken Thompson Dennis Ritchie Unix', 'Ubuntu Linux logo')."
                    },
                    "outputPath": {
                        "type": "string",
                        "description": "Destination path inside workspace/public (e.g. 'workspace/public/img_hacker.jpg' or 'img_terminal.jpg')."
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

fn sync_image_to_bundle(root: &std::path::Path, target_out: &std::path::Path) {
    if !target_out.is_file() {
        return;
    }
    let Some(file_name) = target_out.file_name() else {
        return;
    };
    let ws_pub = root.join("workspace").join("public");
    let _ = std::fs::create_dir_all(&ws_pub);
    let ws_dest = ws_pub.join(file_name);
    if ws_dest != target_out {
        let _ = std::fs::copy(target_out, &ws_dest);
    }

    let bundle_pub = crate::paths::render_cache_dir().join("public");
    let _ = std::fs::create_dir_all(&bundle_pub);
    let bundle_dest = bundle_pub.join(file_name);
    if bundle_dest != target_out {
        let _ = std::fs::copy(target_out, &bundle_dest);
    }
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
        .unwrap_or("workspace/public/web_image.jpg")
        .trim();
    let direct_url = arguments
        .get("url")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim();

    if query.is_empty() && direct_url.is_empty() {
        return json!({ "error": "fetch_web_image requires 'query' or 'url'." });
    }

    let root = crate::paths::project_root();
    let ws = if workspace_dir.trim().is_empty() {
        root.clone()
    } else {
        std::path::PathBuf::from(workspace_dir)
    };

    let clean_rel = if raw_out.starts_with("workspace/public/") || raw_out.starts_with("workspace\\public\\") {
        raw_out.to_string()
    } else if raw_out.starts_with("public/") || raw_out.starts_with("public\\") {
        format!("workspace/{}", raw_out)
    } else if !raw_out.contains('/') && !raw_out.contains('\\') {
        format!("workspace/public/{}", raw_out)
    } else {
        raw_out.to_string()
    };

    let target_out = if std::path::Path::new(&clean_rel).is_absolute() {
        std::path::PathBuf::from(&clean_rel)
    } else {
        ws.join(&clean_rel)
    };
    if let Some(parent) = target_out.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let static_name = target_out
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "web_image.jpg".to_string());

    let client = reqwest::Client::builder()
        .user_agent("AetheriaNexus/1.0 (https://github.com/jlsrngo/AetheriaNexus; studio@aetheria.ai)")
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .unwrap();

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
                                    if let Some(u) = info.get("thumburl").or_else(|| info.get("url")).and_then(|v| v.as_str()) {
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
                            sync_image_to_bundle(&root, &target_out);
                            return json!({
                                "success": true,
                                "query": query,
                                "sourceUrl": img_url,
                                "outputPath": target_out.to_string_lossy().to_string(),
                                "staticFile": static_name,
                                "bytes": bytes.len(),
                                "message": format!("Downloaded internet image to workspace/public/{} (use staticFile(\"{}\") in <Img />)", static_name, static_name)
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
    sync_image_to_bundle(&root, &target_out);
    json!({
        "success": true,
        "fallback": true,
        "query": query,
        "outputPath": target_out.to_string_lossy().to_string(),
        "staticFile": static_name,
        "message": format!("Generated fallback illustration at workspace/public/{} (use staticFile(\"{}\") in <Img />)", static_name, static_name)
    })
}

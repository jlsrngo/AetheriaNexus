//! Web Page Fetch & HTML-to-Text/Markdown Extractor — mirrors `packages/core/src/tool/webfetch.ts`.

use serde_json::{json, Value};

pub fn webfetch_tool_definition() -> Value {
    json!({
        "type": "function",
        "function": {
            "name": "webfetch",
            "description": include_str!("prompt/webfetch.txt"),
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "The HTTP/HTTPS URL to fetch."
                    },
                    "format": {
                        "type": "string",
                        "enum": ["markdown", "text", "html"],
                        "description": "Desired output format (default: markdown)."
                    }
                },
                "required": ["url"]
            }
        }
    })
}

pub async fn execute_webfetch(arguments: &Value) -> Value {
    let url = arguments
        .get("url")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim();
    let format = arguments
        .get("format")
        .and_then(|v| v.as_str())
        .unwrap_or("markdown");

    if !url.starts_with("http://") && !url.starts_with("https://") {
        return json!({ "ok": false, "error": "URL must start with http:// or https://" });
    }

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AetheriaNexus/1.0")
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .unwrap_or_default();

    match client.get(url).send().await {
        Ok(resp) => {
            let status = resp.status().as_u16();
            let raw_body = resp.text().await.unwrap_or_default();
            let cleaned = if format == "html" {
                raw_body
            } else {
                strip_html_to_readable_text(&raw_body)
            };
            let (bounded, _) = crate::tool::truncator::bound_tool_output("webfetch", &cleaned);
            json!({
                "ok": (200..300).contains(&status),
                "status": status,
                "url": url,
                "output": bounded
            })
        }
        Err(e) => json!({ "ok": false, "error": format!("webfetch failed: {}", e) }),
    }
}

fn strip_html_to_readable_text(html: &str) -> String {
    let mut out = String::with_capacity(html.len() / 2);
    let mut in_tag = false;
    for ch in html.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => {
                in_tag = false;
                out.push(' ');
            }
            _ if !in_tag => out.push(ch),
            _ => {}
        }
    }
    out.split_whitespace().collect::<Vec<_>>().join(" ")
}


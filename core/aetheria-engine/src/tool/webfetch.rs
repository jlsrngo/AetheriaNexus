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
            let media = extract_html_media_urls(&raw_body);
            let cleaned = if format == "html" {
                raw_body
            } else {
                let text = strip_html_to_readable_text(&raw_body);
                if media.is_empty() {
                    text
                } else {
                    format!("[Extracted Media URLs: {}]\n\n{}", media.join(", "), text)
                }
            };
            let (bounded, _) = crate::tool::truncator::bound_tool_output("webfetch", &cleaned);
            json!({
                "ok": (200..300).contains(&status),
                "status": status,
                "url": url,
                "media": media,
                "output": bounded
            })
        }
        Err(e) => json!({ "ok": false, "error": format!("webfetch failed: {}", e) }),
    }
}

fn read_tag_attr<'a>(tag: &'a str, attr: &str) -> Option<&'a str> {
    for quote in ['"', '\''] {
        let pat = format!("{}={}", attr, quote);
        if let Some(idx) = tag.find(&pat) {
            let rest = &tag[idx + pat.len()..];
            if let Some(end) = rest.find(quote) {
                return Some(&rest[..end]);
            }
        }
    }
    None
}

fn push_unique_media_url(urls: &mut Vec<String>, raw: &str, max_urls: usize) {
    let cleaned = raw.replace("&amp;", "&").trim().to_string();
    if (cleaned.starts_with("https://") || cleaned.starts_with("http://"))
        && !urls.contains(&cleaned)
        && urls.len() < max_urls
    {
        urls.push(cleaned);
    }
}

pub(crate) fn extract_html_media_urls(html: &str) -> Vec<String> {
    const MAX_MEDIA_URLS: usize = 5;
    let mut urls = Vec::new();

    let mut pos = 0;
    while let Some(rel) = html[pos..].find('<') {
        let start = pos + rel;
        let Some(end_rel) = html[start..].find('>') else {
            break;
        };
        let tag = &html[start..=start + end_rel];
        let lower = tag.to_ascii_lowercase();
        if lower.starts_with("<meta") {
            let prop = read_tag_attr(&lower, "property")
                .or_else(|| read_tag_attr(&lower, "name"))
                .unwrap_or("");
            if matches!(
                prop,
                "og:image" | "twitter:image" | "twitter:image:src" | "og:video" | "og:video:url"
            ) {
                if let Some(content) = read_tag_attr(tag, "content") {
                    push_unique_media_url(&mut urls, content, MAX_MEDIA_URLS);
                }
            }
        } else if lower.starts_with("<img") {
            if let Some(src) = read_tag_attr(tag, "src") {
                push_unique_media_url(&mut urls, src, MAX_MEDIA_URLS);
            }
        }
        if urls.len() >= MAX_MEDIA_URLS {
            break;
        }
        pos = start + end_rel + 1;
    }

    urls
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_og_image_and_img_src_up_to_five_urls() {
        let html = r#"
            <html><head>
                <meta content="https://i.pinimg.com/736x/76/ed/af/76edaf00529634c5287f884a8b4ef38d.jpg" property="og:image"/>
                <meta property="og:video" content="https://v1.pinimg.com/videos/mc/720p/sample.mp4"/>
            </head><body>
                <img src="https://example.com/1.png"/>
                <img src="https://example.com/2.png"/>
                <img src="https://example.com/3.png"/>
                <img src="https://example.com/4.png"/>
            </body></html>
        "#;
        let media = extract_html_media_urls(html);
        assert_eq!(media.len(), 5);
        assert_eq!(
            media[0],
            "https://i.pinimg.com/736x/76/ed/af/76edaf00529634c5287f884a8b4ef38d.jpg"
        );
        assert_eq!(media[1], "https://v1.pinimg.com/videos/mc/720p/sample.mp4");
    }
}


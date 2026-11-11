//! Built-in offline runtime libraries embedded inside `aetheria-engine` (`three.min.js` & `aetheria-motion.js`).
//! Keeps standalone desktop & headless CDP exports independent of internet CDN access.

/// Embedded Three.js r128 minified UMD bundle (`window.THREE`).
pub const THREE_MIN_JS: &str = include_str!("../../assets/script/three.min.js");

/// Embedded Aetheria Motion runtime (`window.AM`) fallback when disk `apps/public` is absent.
pub const AETHERIA_MOTION_JS: &str = include_str!("../../../../apps/public/script/aetheria-motion.js");

/// Returns true when the requested relative path refers to the bundled Three.js runtime.
pub fn is_builtin_three_path(rel: &str) -> bool {
    let trimmed = rel.trim().trim_start_matches('/').replace('\\', "/");
    trimmed.eq_ignore_ascii_case("script/three.min.js")
        || trimmed.eq_ignore_ascii_case("three.min.js")
}

/// Returns true when the requested relative path refers to the built-in `aetheria-motion.js` runtime.
pub fn is_builtin_motion_path(rel: &str) -> bool {
    let trimmed = rel.trim().trim_start_matches('/').replace('\\', "/");
    trimmed.eq_ignore_ascii_case("script/aetheria-motion.js")
        || trimmed.eq_ignore_ascii_case("aetheria-motion.js")
}

/// Resolves `aetheria-motion.js` from repo `apps/public/script/` when present, falling back to embedded bytes.
pub fn resolve_motion_runtime_code(project_root: &std::path::Path) -> String {
    let disk_path = project_root
        .join("apps")
        .join("public")
        .join("script")
        .join("aetheria-motion.js");
    std::fs::read_to_string(disk_path).unwrap_or_else(|_| AETHERIA_MOTION_JS.to_string())
}

/// Returns true for third-party / engine runtime bundles that should never be linted as user scene scripts.
pub fn is_vendor_script_name(name: &str) -> bool {
    let base = name.trim();
    base.eq_ignore_ascii_case("aetheria-motion.js")
        || base.eq_ignore_ascii_case("three.min.js")
        || base.eq_ignore_ascii_case("three.js")
}

/// Detects whether a film project references Three.js (`THREE.` / `new THREE` / `three.min.js`).
pub fn uses_three_runtime(html: &str, scripts: &[(String, String, String)]) -> bool {
    let html_lower = html.to_ascii_lowercase();
    if html_lower.contains("three.min.js")
        || html_lower.contains("/three.js")
        || html.contains("THREE.")
        || html.contains("new THREE")
    {
        return true;
    }

    scripts.iter().any(|(name, _, code)| {
        name.eq_ignore_ascii_case("three.min.js")
            || name.eq_ignore_ascii_case("three.js")
            || code.contains("THREE.")
            || code.contains("new THREE")
    })
}

/// Rewrites (or removes when `replacement_src` is `None`) external CDN `<script src="https://...three(.min)?.js"></script>` tags.
pub fn rewrite_three_cdn_tags(html: &str, replacement_src: Option<&str>) -> String {
    let lower = html.to_ascii_lowercase();
    let mut out = String::with_capacity(html.len());
    let mut cursor = 0;

    while let Some(rel_start) = lower[cursor..].find("<script") {
        let tag_start = cursor + rel_start;
        out.push_str(&html[cursor..tag_start]);

        let Some(rel_end) = lower[tag_start..].find('>') else {
            out.push_str(&html[tag_start..]);
            return out;
        };
        let open_end = tag_start + rel_end + 1;
        let open_tag = &html[tag_start..open_end];
        let open_lower = &lower[tag_start..open_end];

        if let Some((src_start, src_end, src_val)) = extract_src_attr(open_tag, open_lower) {
            if is_external_three_url(src_val) {
                if let Some(local_src) = replacement_src {
                    out.push_str(&open_tag[..src_start]);
                    out.push_str(local_src);
                    out.push_str(&open_tag[src_end..]);
                    cursor = open_end;
                    continue;
                } else if let Some(close_rel) = lower[open_end..].find("</script>") {
                    cursor = open_end + close_rel + "</script>".len();
                    continue;
                }
            }
        }

        out.push_str(open_tag);
        cursor = open_end;
    }

    out.push_str(&html[cursor..]);
    out
}

fn extract_src_attr<'a>(open_tag: &'a str, open_lower: &str) -> Option<(usize, usize, &'a str)> {
    let mut pos = 0;
    while let Some(idx) = open_lower[pos..].find("src") {
        let attr_idx = pos + idx;
        let prev_ok = attr_idx == 0
            || open_lower.as_bytes()[attr_idx - 1].is_ascii_whitespace();
        let after_src = &open_lower[attr_idx + 3..];
        let after_trimmed = after_src.trim_start();
        if prev_ok && after_trimmed.starts_with('=') {
            let ws_len = after_src.len() - after_trimmed.len();
            let val_part = &after_src[ws_len + 1..];
            let val_trimmed = val_part.trim_start();
            let eq_ws_len = val_part.len() - val_trimmed.len();
            let quote_idx = attr_idx + 3 + ws_len + 1 + eq_ws_len;
            let quote = open_tag.as_bytes().get(quote_idx).copied()?;
            if quote == b'"' || quote == b'\'' {
                let inner_start = quote_idx + 1;
                if let Some(rel_close) = open_tag[inner_start..].find(quote as char) {
                    let inner_end = inner_start + rel_close;
                    return Some((inner_start, inner_end, &open_tag[inner_start..inner_end]));
                }
            }
        }
        pos = attr_idx + 3;
    }
    None
}

fn is_external_three_url(src: &str) -> bool {
    let s = src.trim().to_ascii_lowercase();
    let is_remote = s.starts_with("https://") || s.starts_with("http://") || s.starts_with("//");
    if !is_remote {
        return false;
    }
    let clean = s.split(&['?', '#'][..]).next().unwrap_or("");
    clean.ends_with("/three.min.js") || clean.ends_with("/three.js")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn embedded_three_min_js_is_valid_umd_bundle() {
        assert!(THREE_MIN_JS.len() > 400_000);
        assert!(THREE_MIN_JS.contains("WebGLRenderer"));
    }

    #[test]
    fn rewrites_cdn_three_urls_to_local_engine_url_only() {
        let html = r#"<head>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="/script/aetheria-motion.js"></script>
  <script src="/script/scene1.js"></script>
</head>"#;

        let rewritten = rewrite_three_cdn_tags(html, Some("/script/three.min.js"));
        assert!(rewritten.contains(r#"<script src="/script/three.min.js"></script>"#));
        assert!(!rewritten.contains("cdnjs.cloudflare.com"));
        assert!(rewritten.contains(r#"<script src="/script/scene1.js"></script>"#));

        let stripped = rewrite_three_cdn_tags(html, None);
        assert!(!stripped.contains("cdnjs.cloudflare.com"));
        assert!(stripped.contains(r#"<script src="/script/aetheria-motion.js"></script>"#));
    }
}

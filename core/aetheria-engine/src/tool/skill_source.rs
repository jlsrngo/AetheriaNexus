//! OpenCode Plugin & Skill Source URI Parser.
//! Parses shorthands like `github:owner/repo`, `git+https://...#path:packages/...`,
//! `owner/repo#branch::path:...`, and local paths.

/// Parsed source representation supporting OpenCode syntax:
/// - `github:owner/repo`
/// - `git+https://github.com/owner/repo.git#path:packages/plugins/name`
/// - `owner/repo#branch`
pub struct ParsedGitSource {
    pub clone_url: String,
    pub branch_or_tag: Option<String>,
    pub sub_path: Option<String>,
    pub default_id: String,
}

pub fn parse_opencode_source(raw: &str) -> Result<ParsedGitSource, String> {
    let mut s = raw.trim();
    if s.is_empty() {
        return Err("Source cannot be empty".to_string());
    }

    // Strip "git+" prefix if present (e.g. git+https://...)
    if let Some(rest) = s.strip_prefix("git+") {
        s = rest;
    }

    // Check for "github:" prefix
    if let Some(rest) = s.strip_prefix("github:") {
        let clean = rest.trim_start_matches('/');
        let (repo, frag) = split_fragment(clean);
        let (branch, sub_path) = parse_fragment(frag);
        let id = derive_id_from_path(sub_path.as_deref().unwrap_or(repo));
        return Ok(ParsedGitSource {
            clone_url: format!("https://github.com/{}.git", repo),
            branch_or_tag: branch,
            sub_path,
            default_id: id,
        });
    }

    // Direct HTTP(S) or Git SSH URL
    if s.starts_with("http://") || s.starts_with("https://") || s.starts_with("git@") {
        let (base, frag) = split_fragment(s);
        let (branch, sub_path) = parse_fragment(frag);
        let clean_base = if base.ends_with(".git") {
            base.to_string()
        } else {
            format!("{}.git", base.trim_end_matches('/'))
        };
        let id = derive_id_from_path(sub_path.as_deref().unwrap_or(base));
        return Ok(ParsedGitSource {
            clone_url: clean_base,
            branch_or_tag: branch,
            sub_path,
            default_id: id,
        });
    }

    // Shorthand "owner/repo"
    if s.contains('/') && !s.contains(' ') {
        let (repo, frag) = split_fragment(s);
        let (branch, sub_path) = parse_fragment(frag);
        let id = derive_id_from_path(sub_path.as_deref().unwrap_or(repo));
        return Ok(ParsedGitSource {
            clone_url: format!("https://github.com/{}.git", repo),
            branch_or_tag: branch,
            sub_path,
            default_id: id,
        });
    }

    // Local path
    Ok(ParsedGitSource {
        clone_url: s.to_string(),
        branch_or_tag: None,
        sub_path: None,
        default_id: derive_id_from_path(s),
    })
}

fn split_fragment(s: &str) -> (&str, Option<&str>) {
    if let Some(idx) = s.find('#') {
        (&s[..idx], Some(&s[idx + 1..]))
    } else {
        (s, None)
    }
}

fn parse_fragment(frag_opt: Option<&str>) -> (Option<String>, Option<String>) {
    let Some(frag) = frag_opt else {
        return (None, None);
    };

    // Supports:
    // "#main" (branch)
    // "#path:packages/plugins/foo" (subpath)
    // "#main::path:packages/foo" (branch + subpath)
    let mut branch = None;
    let mut sub_path = None;

    if frag.contains("::path:") {
        let parts: Vec<&str> = frag.split("::path:").collect();
        branch = Some(parts[0].to_string());
        sub_path = Some(parts[1].trim_matches('/').to_string());
    } else if let Some(p) = frag.strip_prefix("path:") {
        sub_path = Some(p.trim_matches('/').to_string());
    } else {
        branch = Some(frag.to_string());
    }

    (branch, sub_path)
}

fn derive_id_from_path(p: &str) -> String {
    let clean = p.trim_end_matches('/').trim_end_matches(".git");
    clean
        .split('/')
        .last()
        .unwrap_or("plugin")
        .to_lowercase()
        .replace([' ', '_', '.'], "-")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_opencode_shorthand() {
        let parsed = parse_opencode_source("github:remotion-dev/remotion-plugin").unwrap();
        assert_eq!(parsed.clone_url, "https://github.com/remotion-dev/remotion-plugin.git");
        assert_eq!(parsed.default_id, "remotion-plugin");

        let parsed_sub =
            parse_opencode_source("git+https://github.com/acme/mono.git#path:packages/plugins/motion")
                .unwrap();
        assert_eq!(parsed_sub.clone_url, "https://github.com/acme/mono.git");
        assert_eq!(parsed_sub.sub_path.as_deref(), Some("packages/plugins/motion"));
        assert_eq!(parsed_sub.default_id, "motion");
    }
}


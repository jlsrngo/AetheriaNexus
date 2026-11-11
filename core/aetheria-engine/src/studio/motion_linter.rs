//! HTML Motion Film determinism linter (`window.renderAt`, clock purity, CJK safety).

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilmLintIssue {
    pub severity: String,
    pub code: String,
    pub message: String,
    pub line: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilmLintReport {
    pub valid: bool,
    pub has_render_at: bool,
    pub has_ready_flag: bool,
    pub has_film_meta: bool,
    pub issues: Vec<FilmLintIssue>,
}

fn contains_cjk(line: &str) -> bool {
    line.chars().any(|c| {
        matches!(
            c as u32,
            0x4E00..=0x9FFF | 0x3400..=0x4DBF | 0xF900..=0xFAFF | 0x3000..=0x303F
        )
    })
}

/// Lints an HTML motion film for deterministic playback and rendering compliance.
pub fn lint_html_film(html: &str) -> FilmLintReport {
    let has_render_at = html.contains("window.renderAt") || html.contains("function renderAt");
    let has_ready_flag = html.contains("window.__ready") || html.contains("__ready = true");
    let has_film_meta = html.contains("window.AETHERIA_FILM")
        || html.contains("window.__filmMeta")
        || html.contains("window.DEMO");

    let mut issues = Vec::new();

    if !has_render_at {
        issues.push(FilmLintIssue {
            severity: "error".to_string(),
            code: "MISSING_RENDER_AT".to_string(),
            message:
                "HTML film must expose window.renderAt(t) for deterministic frame scrubbing."
                    .to_string(),
            line: None,
        });
    }

    if !has_ready_flag {
        issues.push(FilmLintIssue {
            severity: "warning".to_string(),
            code: "MISSING_READY_FLAG".to_string(),
            message: "HTML film should set window.__ready = true after initial renderAt(0)."
                .to_string(),
            line: None,
        });
    }

    for (idx, raw_line) in html.lines().enumerate() {
        let line_no = idx + 1;
        let trimmed = raw_line.trim();
        if trimmed.starts_with("//") || trimmed.starts_with("/*") || trimmed.starts_with('*') {
            continue;
        }

        if trimmed.contains("Math.random(") {
            issues.push(FilmLintIssue {
                severity: "warning".to_string(),
                code: "NONDETERMINISTIC_MATH_RANDOM".to_string(),
                message: "Avoid Math.random(); use AM.rand(seed) or AM.rng(seed) so scrubbing is deterministic."
                    .to_string(),
                line: Some(line_no),
            });
        }

        if trimmed.contains("Date.now(") || trimmed.contains("performance.now(") {
            if !trimmed.contains("raf")
                && !trimmed.contains("startWall")
                && !trimmed.contains("lastWall")
            {
                issues.push(FilmLintIssue {
                    severity: "warning".to_string(),
                    code: "WALL_CLOCK_DEPENDENCY".to_string(),
                    message:
                        "Animations inside renderAt(t) must depend only on `t`, not wall-clock time."
                            .to_string(),
                    line: Some(line_no),
                });
            }
        }

        if trimmed.contains("setInterval(") {
            issues.push(FilmLintIssue {
                severity: "warning".to_string(),
                code: "NONDETERMINISTIC_INTERVAL".to_string(),
                message: "Avoid setInterval(); drive all state from window.renderAt(t)."
                    .to_string(),
                line: Some(line_no),
            });
        }

        if contains_cjk(trimmed) {
            issues.push(FilmLintIssue {
                severity: "warning".to_string(),
                code: "CJK_CHARACTERS_DETECTED".to_string(),
                message: "Mandarin/CJK characters detected; keep all copy and comments in Bahasa Indonesia or English."
                    .to_string(),
                line: Some(line_no),
            });
        }
    }

    let valid = !issues.iter().any(|i| i.severity == "error");

    FilmLintReport {
        valid,
        has_render_at,
        has_ready_flag,
        has_film_meta,
        issues,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lint_valid_deterministic_html() {
        let html = r#"
        <!DOCTYPE html>
        <html>
        <script>
          window.AETHERIA_FILM = { title: "Test", width: 1080, height: 1920, fps: 30, duration: 10 };
          window.renderAt = function(t) { const x = AM.rand(1) * t; };
          window.renderAt(0);
          window.__ready = true;
        </script>
        </html>
        "#;
        let report = lint_html_film(html);
        assert!(report.valid);
        assert!(report.has_render_at);
        assert!(report.has_ready_flag);
        assert!(report.issues.is_empty());
    }

    #[test]
    fn test_lint_flags_missing_render_at_and_math_random_and_cjk() {
        let html = r#"
        <script>
          const r = Math.random();
          const title = "动画风格";
        </script>
        "#;
        let report = lint_html_film(html);
        assert!(!report.valid);
        assert!(!report.has_render_at);
        assert!(report.issues.iter().any(|i| i.code == "MISSING_RENDER_AT"));
        assert!(report
            .issues
            .iter()
            .any(|i| i.code == "NONDETERMINISTIC_MATH_RANDOM"));
        assert!(report
            .issues
            .iter()
            .any(|i| i.code == "CJK_CHARACTERS_DETECTED"));
    }
}

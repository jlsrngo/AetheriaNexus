//! HTML Motion Film specification types, determinism linter, and HTML metadata inspector.

use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilmSceneSpec {
    pub id: String,
    pub title: String,
    pub start: f64,
    pub duration: f64,
    pub start_frame: u32,
    pub duration_frames: u32,
    pub audio: Option<String>,
    pub words: Option<String>,
}

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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilmMeta {
    pub exists: bool,
    pub engine: String,
    pub html_path: String,
    pub title: String,
    pub width: u32,
    pub height: u32,
    pub fps: u32,
    pub duration: f64,
    pub total_frames: u32,
    pub scenes: Vec<FilmSceneSpec>,
    pub lint: FilmLintReport,
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
    let has_film_meta = html.contains("window.AETHERIA_FILM") || html.contains("window.DEMO");

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

fn extract_number_field(source: &str, key: &str) -> Option<f64> {
    let pattern = format!("{}:", key);
    let idx = source.find(&pattern)?;
    let rest = &source[idx + pattern.len()..];
    let mut num_str = String::new();
    for ch in rest.trim_start().chars() {
        if ch.is_ascii_digit() || ch == '.' {
            num_str.push(ch);
        } else if !num_str.is_empty() {
            break;
        } else if ch != ' ' && ch != '\t' {
            break;
        }
    }
    num_str.parse::<f64>().ok()
}

fn extract_string_field(source: &str, key: &str) -> Option<String> {
    let pattern = format!("{}:", key);
    let idx = source.find(&pattern)?;
    let rest = source[idx + pattern.len()..].trim_start();
    let quote = rest.chars().next()?;
    if quote != '"' && quote != '\'' {
        return None;
    }
    let body = &rest[1..];
    let end = body.find(quote)?;
    Some(body[..end].to_string())
}

/// Parses `workspace/index.html` and extracts `FilmMeta`.
pub fn inspect_workspace_film(html_path: &Path) -> FilmMeta {
    if !html_path.exists() {
        return FilmMeta {
            exists: false,
            engine: "remotion-tsx".to_string(),
            html_path: html_path.to_string_lossy().to_string(),
            title: "Sejarah Lahirnya Listrik".to_string(),
            width: 1080,
            height: 1920,
            fps: 30,
            duration: 120.53,
            total_frames: 3616,
            scenes: Vec::new(),
            lint: FilmLintReport {
                valid: false,
                has_render_at: false,
                has_ready_flag: false,
                has_film_meta: false,
                issues: Vec::new(),
            },
        };
    }

    let html = std::fs::read_to_string(html_path).unwrap_or_default();
    let mut combined_source = html.clone();
    if let Some(ws_dir) = html_path.parent() {
        let script_dir = ws_dir.join("script");
        if let Ok(entries) = std::fs::read_dir(&script_dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.extension().and_then(|e| e.to_str()) == Some("js") {
                    if let Ok(js) = std::fs::read_to_string(&p) {
                        combined_source.push('\n');
                        combined_source.push_str(&js);
                    }
                }
            }
        }
    }
    let lint = lint_html_film(&combined_source);

    let width = extract_number_field(&html, "width")
        .map(|v| v as u32)
        .unwrap_or(1080);
    let height = extract_number_field(&html, "height")
        .map(|v| v as u32)
        .unwrap_or(1920);
    let fps = extract_number_field(&html, "fps")
        .map(|v| v as u32)
        .unwrap_or(30)
        .max(1);
    let duration = extract_number_field(&html, "duration").unwrap_or(120.53);
    let title = extract_string_field(&html, "title")
        .unwrap_or_else(|| "Sejarah Lahirnya Listrik".to_string());
    let total_frames = ((duration * fps as f64).round() as u32).max(1);
    let scenes = default_electricity_scenes(fps);

    FilmMeta {
        exists: true,
        engine: "aetheria-html".to_string(),
        html_path: html_path.to_string_lossy().to_string(),
        title,
        width,
        height,
        fps,
        duration,
        total_frames,
        scenes,
        lint,
    }
}

fn default_electricity_scenes(fps: u32) -> Vec<FilmSceneSpec> {
    let raw = [
        (
            "scene1_hook",
            "Scene 1 · Hook (Kota Gelap -> Terang)",
            0u32,
            427u32,
            Some("/audio/scene1_hook.wav"),
            Some("/audio/scene1_hook.words.json"),
        ),
        (
            "scene2_rahasia_alam",
            "Scene 2 · Rahasia Alam & Batu Amber Thales",
            427u32,
            654u32,
            Some("/audio/scene2_rahasia_alam.wav"),
            Some("/audio/scene2_rahasia_alam.words.json"),
        ),
        (
            "scene3_langit_laboratorium",
            "Scene 3 · Badai Petir Benjamin Franklin (1752)",
            1081u32,
            803u32,
            Some("/audio/scene3_langit_laboratorium.wav"),
            Some("/audio/scene3_langit_laboratorium.words.json"),
        ),
        (
            "scene4_volta_baterai",
            "Scene 4 · Baterai Alessandro Volta (1800)",
            1884u32,
            554u32,
            Some("/audio/scene4_volta_baterai.wav"),
            Some("/audio/scene4_volta_baterai.words.json"),
        ),
        (
            "scene5_faraday_generator",
            "Scene 5 · Induksi & Generator Michael Faraday (1831)",
            2438u32,
            470u32,
            Some("/audio/scene5_faraday_generator.wav"),
            Some("/audio/scene5_faraday_generator.words.json"),
        ),
        (
            "scene6_twist_penutup",
            "Scene 6 · Twist & Kota Modern Bercahaya",
            2908u32,
            708u32,
            Some("/audio/scene6_twist_penutup.wav"),
            Some("/audio/scene6_twist_penutup.words.json"),
        ),
    ];

    let f = fps.max(1) as f64;
    raw.into_iter()
        .map(|(id, title, start_frame, duration_frames, audio, words)| FilmSceneSpec {
            id: id.to_string(),
            title: title.to_string(),
            start: start_frame as f64 / f,
            duration: duration_frames as f64 / f,
            start_frame,
            duration_frames,
            audio: audio.map(str::to_string),
            words: words.map(str::to_string),
        })
        .collect()
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


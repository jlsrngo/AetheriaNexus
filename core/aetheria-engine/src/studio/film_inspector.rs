//! HTML Motion Film metadata inspector, script loader, and scene timeline parser.

use super::motion_linter::{lint_html_film, FilmLintReport};
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

fn collect_ordered_scripts(html_path: &Path) -> Vec<(String, String, String)> {
    let mut entries_list: Vec<(u32, String, std::path::PathBuf)> = Vec::new();
    let Some(ws_dir) = html_path.parent() else {
        return Vec::new();
    };
    let script_dir = ws_dir.join("script");
    let Ok(entries) = std::fs::read_dir(&script_dir) else {
        return Vec::new();
    };
    for entry in entries.flatten() {
        let p = entry.path();
        if p.is_file() && p.extension().and_then(|e| e.to_str()) == Some("js") {
            let name = p
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();
            let order_key = if name.eq_ignore_ascii_case("aetheria-motion.js") {
                0
            } else {
                let digits: String = name.chars().filter(|c| c.is_ascii_digit()).collect();
                digits.parse::<u32>().unwrap_or(999).saturating_add(1)
            };
            entries_list.push((order_key, name, p));
        }
    }
    entries_list.sort_by(|a, b| a.0.cmp(&b.0).then_with(|| a.1.cmp(&b.1)));

    entries_list
        .into_iter()
        .filter_map(|(_, name, p)| {
            std::fs::read_to_string(&p).ok().map(|code| {
                let rel = format!("script/{}", name);
                (name, rel, code)
            })
        })
        .collect()
}

fn find_scenes_array_slice(source: &str) -> Option<&str> {
    for marker in ["scenes:", "SCENES =", "window.SCENES ="] {
        if let Some(pos) = source.find(marker) {
            let after = &source[pos + marker.len()..];
            if let Some(open_bracket) = after.find('[') {
                let slice = &after[open_bracket + 1..];
                let mut depth = 1i32;
                let mut in_quote: Option<char> = None;
                let mut escaped = false;
                for (byte_idx, ch) in slice.char_indices() {
                    if escaped {
                        escaped = false;
                        continue;
                    }
                    if let Some(q) = in_quote {
                        if ch == '\\' {
                            escaped = true;
                        } else if ch == q {
                            in_quote = None;
                        }
                        continue;
                    }
                    match ch {
                        '"' | '\'' | '`' => in_quote = Some(ch),
                        '[' => depth += 1,
                        ']' => {
                            depth -= 1;
                            if depth == 0 {
                                return Some(&slice[..byte_idx]);
                            }
                        }
                        _ => {}
                    }
                }
            }
        }
    }
    None
}

fn extract_object_blocks(array_body: &str) -> Vec<&str> {
    let mut blocks = Vec::new();
    let mut depth = 0i32;
    let mut start_idx: Option<usize> = None;
    let mut in_quote: Option<char> = None;
    let mut escaped = false;

    for (idx, ch) in array_body.char_indices() {
        if escaped {
            escaped = false;
            continue;
        }
        if let Some(q) = in_quote {
            if ch == '\\' {
                escaped = true;
            } else if ch == q {
                in_quote = None;
            }
            continue;
        }
        match ch {
            '"' | '\'' | '`' => in_quote = Some(ch),
            '{' => {
                if depth == 0 {
                    start_idx = Some(idx);
                }
                depth += 1;
            }
            '}' => {
                depth -= 1;
                if depth == 0 {
                    if let Some(s) = start_idx.take() {
                        blocks.push(&array_body[s..=idx]);
                    }
                }
            }
            _ => {}
        }
    }
    blocks
}

pub fn parse_scenes_from_sources(
    combined_source: &str,
    fps: u32,
    fallback_duration: f64,
    fallback_title: &str,
    scene_script_names: &[String],
) -> Vec<FilmSceneSpec> {
    let f = fps.max(1) as f64;

    if let Some(array_body) = find_scenes_array_slice(combined_source) {
        let blocks = extract_object_blocks(array_body);
        if !blocks.is_empty() {
            let mut cursor_sec = 0.0f64;
            let mut parsed = Vec::with_capacity(blocks.len());
            for (idx, block) in blocks.iter().enumerate() {
                let id = extract_string_field(block, "id")
                    .unwrap_or_else(|| format!("scene{}", idx + 1));
                let title = extract_string_field(block, "title")
                    .or_else(|| extract_string_field(block, "label"))
                    .or_else(|| extract_string_field(block, "name"))
                    .unwrap_or_else(|| id.clone());

                let start_sec = extract_number_field(block, "start")
                    .or_else(|| extract_number_field(block, "startSec"))
                    .or_else(|| extract_number_field(block, "startFrame").map(|fr| fr / f))
                    .unwrap_or(cursor_sec);

                let dur_sec = extract_number_field(block, "duration")
                    .or_else(|| extract_number_field(block, "durationSec"))
                    .or_else(|| extract_number_field(block, "dur"))
                    .or_else(|| extract_number_field(block, "durationFrames").map(|fr| fr / f))
                    .unwrap_or_else(|| {
                        let count = blocks.len().max(1) as f64;
                        (fallback_duration / count).max(1.0)
                    });

                let start_frame = extract_number_field(block, "startFrame")
                    .map(|v| v.round() as u32)
                    .unwrap_or_else(|| (start_sec * f).round() as u32);
                let duration_frames = extract_number_field(block, "durationFrames")
                    .map(|v| (v.round() as u32).max(1))
                    .unwrap_or_else(|| ((dur_sec * f).round() as u32).max(1));

                cursor_sec = start_sec + dur_sec;

                parsed.push(FilmSceneSpec {
                    id,
                    title,
                    start: start_sec,
                    duration: dur_sec,
                    start_frame,
                    duration_frames,
                    audio: extract_string_field(block, "audio"),
                    words: extract_string_field(block, "words"),
                });
            }
            return parsed;
        }
    }

    let scene_files: Vec<&String> = scene_script_names
        .iter()
        .filter(|name| !name.eq_ignore_ascii_case("aetheria-motion.js"))
        .collect();

    if !scene_files.is_empty() && fallback_duration > 0.0 {
        let count = scene_files.len() as f64;
        let per_dur = fallback_duration / count;
        let mut cursor_sec = 0.0;
        return scene_files
            .iter()
            .enumerate()
            .map(|(idx, name)| {
                let stem = name.strip_suffix(".js").unwrap_or(name.as_str());
                let start_sec = cursor_sec;
                cursor_sec += per_dur;
                let start_frame = (start_sec * f).round() as u32;
                let duration_frames = ((per_dur * f).round() as u32).max(1);
                FilmSceneSpec {
                    id: stem.to_string(),
                    title: format!("Scene {} · {}", idx + 1, stem),
                    start: start_sec,
                    duration: per_dur,
                    start_frame,
                    duration_frames,
                    audio: None,
                    words: None,
                }
            })
            .collect();
    }

    let total_frames = ((fallback_duration * f).round() as u32).max(1);
    vec![FilmSceneSpec {
        id: "scene_1".to_string(),
        title: if fallback_title.trim().is_empty() {
            "Scene 1".to_string()
        } else {
            fallback_title.to_string()
        },
        start: 0.0,
        duration: fallback_duration.max(1.0),
        start_frame: 0,
        duration_frames: total_frames,
        audio: None,
        words: None,
    }]
}

/// Parses an active HTML film (`index.html` + `script/*.js`) and extracts `FilmMeta`.
pub fn inspect_workspace_film(html_path: &Path) -> FilmMeta {
    if !html_path.exists() {
        return FilmMeta {
            exists: false,
            engine: "aetheria-html".to_string(),
            html_path: html_path.to_string_lossy().to_string(),
            title: String::new(),
            width: 1080,
            height: 1920,
            fps: 30,
            duration: 0.0,
            total_frames: 0,
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
    let scripts = collect_ordered_scripts(html_path);
    let mut combined_source = html;
    let mut script_names = Vec::with_capacity(scripts.len());
    for (name, _, code) in &scripts {
        script_names.push(name.clone());
        combined_source.push('\n');
        combined_source.push_str(code);
    }
    let lint = lint_html_film(&combined_source);

    let default_title = html_path
        .parent()
        .and_then(|p| p.file_name())
        .and_then(|n| n.to_str())
        .filter(|n| !n.eq_ignore_ascii_case("workspace"))
        .map(str::to_string)
        .unwrap_or_else(|| "HTML Motion Film".to_string());

    let width = extract_number_field(&combined_source, "width")
        .map(|v| (v.round() as u32).max(16))
        .unwrap_or(1080);
    let height = extract_number_field(&combined_source, "height")
        .map(|v| (v.round() as u32).max(16))
        .unwrap_or(1920);
    let fps = extract_number_field(&combined_source, "fps")
        .map(|v| (v.round() as u32).max(1))
        .unwrap_or(30);

    let title = extract_string_field(&combined_source, "title").unwrap_or(default_title);
    let mut duration = extract_number_field(&combined_source, "duration").unwrap_or(0.0);

    let preliminary_dur = if duration > 0.0 { duration } else { 15.0 };
    let scenes = parse_scenes_from_sources(
        &combined_source,
        fps,
        preliminary_dur,
        &title,
        &script_names,
    );

    if duration <= 0.0 {
        let summed: f64 = scenes.iter().map(|s| s.duration.max(0.0)).sum();
        duration = if summed > 0.0 { summed } else { 15.0 };
    }

    let total_frames = ((duration * fps as f64).round() as u32).max(1);

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

pub fn collect_ordered_script_files(html_path: &Path) -> Vec<(String, String, String)> {
    collect_ordered_scripts(html_path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_missing_html_returns_empty_meta_without_demo_fallback() {
        let missing = std::env::temp_dir()
            .join("aetheria_missing_dir_12345")
            .join("index.html");
        let meta = inspect_workspace_film(&missing);
        assert!(!meta.exists);
        assert!(meta.title.is_empty());
        assert!(meta.scenes.is_empty());
        assert_eq!(meta.total_frames, 0);
    }

    #[test]
    fn test_parse_scenes_dynamically_from_html_film() {
        let dir = std::env::temp_dir().join(format!("aetheria_film_test_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let script_dir = dir.join("script");
        std::fs::create_dir_all(&script_dir).unwrap();

        let html = r#"<!DOCTYPE html><html><head></head><body><canvas id="c"></canvas>
        <script>
        window.AETHERIA_FILM = {
          title: "Kopi Nusantara",
          width: 1080,
          height: 1920,
          fps: 30,
          duration: 12,
          scenes: [
            { id: "intro", title: "Pembukaan Kebun", start: 0, duration: 5, audio: "/audio/intro.wav" },
            { id: "body", title: "Sangrai Biji", start: 5, duration: 7, words: "/audio/body.words.json" }
          ]
        };
        window.renderAt = function(t) {};
        window.__ready = true;
        </script></body></html>"#;
        std::fs::write(dir.join("index.html"), html).unwrap();

        let meta = inspect_workspace_film(&dir.join("index.html"));
        assert!(meta.exists);
        assert_eq!(meta.title, "Kopi Nusantara");
        assert_eq!(meta.fps, 30);
        assert_eq!(meta.total_frames, 360);
        assert_eq!(meta.scenes.len(), 2);
        assert_eq!(meta.scenes[0].id, "intro");
        assert_eq!(meta.scenes[0].title, "Pembukaan Kebun");
        assert_eq!(meta.scenes[0].duration_frames, 150);
        assert_eq!(meta.scenes[1].start_frame, 150);
        assert_eq!(meta.scenes[1].duration_frames, 210);

        let _ = std::fs::remove_dir_all(&dir);
    }
}


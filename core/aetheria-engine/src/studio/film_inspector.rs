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

fn is_ident_char(b: u8) -> bool {
    b.is_ascii_alphanumeric() || b == b'_' || b == b'$' || b == b'-'
}

fn find_property_value_start(source: &str, key: &str) -> Option<usize> {
    let bytes = source.as_bytes();
    let key_bytes = key.as_bytes();
    let mut search_from = 0usize;

    while let Some(rel) = source[search_from..].find(key) {
        let idx = search_from + rel;
        let after_key = idx + key_bytes.len();
        search_from = after_key;

        // Check quoted key (`"key":` / `'key':`) or bare JS identifier (`key:`)
        let (is_boundary_ok, mut cursor) = if idx > 0
            && (bytes[idx - 1] == b'"' || bytes[idx - 1] == b'\'')
            && after_key < bytes.len()
            && bytes[after_key] == bytes[idx - 1]
        {
            let before_quote = idx - 1;
            let ok = before_quote == 0 || !is_ident_char(bytes[before_quote - 1]);
            (ok, after_key + 1)
        } else {
            let ok = idx == 0 || !is_ident_char(bytes[idx - 1]);
            (ok, after_key)
        };

        if !is_boundary_ok {
            continue;
        }

        while cursor < bytes.len() && (bytes[cursor] == b' ' || bytes[cursor] == b'\t') {
            cursor += 1;
        }
        if cursor < bytes.len() && bytes[cursor] == b':' {
            return Some(cursor + 1);
        }
    }

    None
}

fn extract_number_field(source: &str, key: &str) -> Option<f64> {
    let start = find_property_value_start(source, key)?;
    let rest = &source[start..];
    let mut num_str = String::new();
    for ch in rest.trim_start().chars() {
        if ch.is_ascii_digit() || ch == '.' {
            num_str.push(ch);
        } else {
            break;
        }
    }
    num_str.parse::<f64>().ok()
}

fn extract_string_field(source: &str, key: &str) -> Option<String> {
    let start = find_property_value_start(source, key)?;
    let rest = source[start..].trim_start();
    let quote = rest.chars().next()?;
    if quote != '"' && quote != '\'' {
        return None;
    }
    let body = &rest[1..];
    let end = body.find(quote)?;
    Some(body[..end].to_string())
}

fn strip_style_blocks(html: &str) -> String {
    let lower = html.to_ascii_lowercase();
    let mut out = String::with_capacity(html.len());
    let mut cursor = 0usize;

    while let Some(rel_start) = lower[cursor..].find("<style") {
        let start = cursor + rel_start;
        out.push_str(&html[cursor..start]);
        if let Some(rel_end) = lower[start..].find("</style>") {
            cursor = start + rel_end + "</style>".len();
        } else {
            cursor = html.len();
            break;
        }
    }
    if cursor < html.len() {
        out.push_str(&html[cursor..]);
    }
    out
}

fn extract_balanced_delimited(source: &str, open_pos: usize, open_ch: char, close_ch: char) -> Option<usize> {
    let slice = &source[open_pos + open_ch.len_utf8()..];
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
            c if c == open_ch => depth += 1,
            c if c == close_ch => {
                depth -= 1;
                if depth == 0 {
                    return Some(open_pos + open_ch.len_utf8() + byte_idx);
                }
            }
            _ => {}
        }
    }
    None
}

fn skip_ws_and_comments(bytes: &[u8], mut i: usize) -> usize {
    while i < bytes.len() {
        let b = bytes[i];
        if b.is_ascii_whitespace() {
            i += 1;
        } else if b == b'/' && i + 1 < bytes.len() && bytes[i + 1] == b'/' {
            i += 2;
            while i < bytes.len() && bytes[i] != b'\n' {
                i += 1;
            }
        } else if b == b'/' && i + 1 < bytes.len() && bytes[i + 1] == b'*' {
            i += 2;
            while i + 1 < bytes.len() && !(bytes[i] == b'*' && bytes[i + 1] == b'/') {
                i += 1;
            }
            i = (i + 2).min(bytes.len());
        } else {
            break;
        }
    }
    i
}

fn extract_meta_object_slice(source: &str) -> Option<&str> {
    let bytes = source.as_bytes();
    for marker in [
        "window.__filmMeta",
        "window.AETHERIA_FILM",
        "window.DEMO",
        "__filmMeta",
        "AETHERIA_FILM",
    ] {
        let mut search_from = 0usize;
        while let Some(rel) = source[search_from..].find(marker) {
            let idx = search_from + rel;
            let after_marker = idx + marker.len();
            search_from = after_marker;

            if idx > 0 && is_ident_char(bytes[idx - 1]) {
                continue;
            }
            if after_marker < bytes.len() && is_ident_char(bytes[after_marker]) {
                continue;
            }

            let eq_pos = skip_ws_and_comments(bytes, after_marker);
            if eq_pos >= bytes.len() || bytes[eq_pos] != b'=' {
                continue;
            }
            if eq_pos + 1 < bytes.len() && bytes[eq_pos + 1] == b'=' {
                continue;
            }

            let brace_pos = skip_ws_and_comments(bytes, eq_pos + 1);
            if brace_pos < bytes.len() && bytes[brace_pos] == b'{' {
                if let Some(close_pos) = extract_balanced_delimited(source, brace_pos, '{', '}') {
                    return Some(&source[brace_pos..=close_pos]);
                }
            }
        }
    }
    None
}

fn extract_canvas_attr_u32(source: &str, attr: &str) -> Option<u32> {
    let lower = source.to_ascii_lowercase();
    let canvas_start = lower.find("<canvas")?;
    let canvas_end = lower[canvas_start..].find('>')? + canvas_start;
    let tag = &source[canvas_start..=canvas_end];
    let tag_lower = tag.to_ascii_lowercase();
    let needle = format!("{}=", attr.to_ascii_lowercase());
    let mut search_from = 0usize;
    while let Some(rel) = tag_lower[search_from..].find(&needle) {
        let idx = search_from + rel;
        search_from = idx + needle.len();
        if idx > 0 && !tag_lower.as_bytes()[idx - 1].is_ascii_whitespace() {
            continue;
        }
        let rest = tag[idx + needle.len()..].trim_start();
        let unquoted = rest
            .strip_prefix('"')
            .and_then(|s| s.split('"').next())
            .or_else(|| rest.strip_prefix('\'').and_then(|s| s.split('\'').next()))?;
        if let Ok(v) = unquoted.trim().parse::<u32>() {
            if v >= 16 {
                return Some(v);
            }
        }
    }
    None
}

fn extract_html_script_order(html_lower: &str, script_name: &str) -> Option<usize> {
    let name_lower = script_name.to_ascii_lowercase();
    let rel_needle = format!("script/{}", name_lower);
    if let Some(pos) = html_lower.find(&rel_needle) {
        return Some(pos);
    }
    html_lower
        .find(&format!("\"{}\"", name_lower))
        .or_else(|| html_lower.find(&format!("'{}'", name_lower)))
}

fn collect_ordered_scripts(html_path: &Path) -> Vec<(String, String, String)> {
    let mut entries_list: Vec<((u8, usize), String, std::path::PathBuf)> = Vec::new();
    let Some(ws_dir) = html_path.parent() else {
        return Vec::new();
    };
    let html_lower = std::fs::read_to_string(html_path)
        .unwrap_or_default()
        .to_ascii_lowercase();
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
            let lower = name.to_ascii_lowercase();
            let order_key = if lower == "three.min.js" || lower == "three.js" {
                (0u8, 0usize)
            } else if lower == "aetheria-motion.js" {
                (1, 0)
            } else if let Some(html_pos) = extract_html_script_order(&html_lower, &name) {
                (2, html_pos)
            } else {
                let digits: String = name.chars().filter(|c| c.is_ascii_digit()).collect();
                if digits.is_empty() && !lower.starts_with("scene") {
                    (3, 0)
                } else {
                    (4, digits.parse::<usize>().unwrap_or(999))
                }
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

fn find_scenes_array_bounds(source: &str) -> Option<(usize, usize)> {
    let bytes = source.as_bytes();
    let mut candidates: Vec<(usize, usize)> = Vec::new();

    for (marker, is_assign) in [
        ("window.SCENES", true),
        ("SCENES", true),
        ("\"scenes\"", false),
        ("'scenes'", false),
        ("scenes", false),
    ] {
        let mut search_from = 0usize;
        while let Some(rel) = source[search_from..].find(marker) {
            let idx = search_from + rel;
            let after_marker = idx + marker.len();
            search_from = after_marker;

            if idx > 0 && is_ident_char(bytes[idx - 1]) {
                continue;
            }
            if after_marker < bytes.len() && is_ident_char(bytes[after_marker]) {
                continue;
            }

            let op_pos = skip_ws_and_comments(bytes, after_marker);
            if op_pos >= bytes.len() {
                continue;
            }
            if is_assign {
                if bytes[op_pos] != b'='
                    || (op_pos + 1 < bytes.len() && bytes[op_pos + 1] == b'=')
                {
                    continue;
                }
            } else if bytes[op_pos] != b':' {
                continue;
            }

            let bracket_pos = skip_ws_and_comments(bytes, op_pos + 1);
            if bracket_pos < bytes.len() && bytes[bracket_pos] == b'[' {
                if let Some(close_pos) = extract_balanced_delimited(source, bracket_pos, '[', ']') {
                    candidates.push((bracket_pos + 1, close_pos));
                }
            }
        }
    }

    candidates
        .iter()
        .copied()
        .find(|&(s, e)| !extract_object_blocks(&source[s..e]).is_empty())
        .or_else(|| candidates.first().copied())
}

fn find_scenes_array_slice(source: &str) -> Option<&str> {
    let (start, end) = find_scenes_array_bounds(source)?;
    Some(&source[start..end])
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
                    .or_else(|| extract_string_field(block, "headline"))
                    .or_else(|| extract_string_field(block, "header"))
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
                    words: extract_string_field(block, "words")
                        .or_else(|| extract_string_field(block, "wordsPath")),
                });
            }
            return parsed;
        }
    }

    let scene_files: Vec<&String> = scene_script_names
        .iter()
        .filter(|name| !super::builtin_runtime::is_vendor_script_name(name))
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
        if !super::builtin_runtime::is_vendor_script_name(name) {
            combined_source.push('\n');
            combined_source.push_str(code);
        }
    }
    let lint = lint_html_film(&combined_source);

    let default_title = html_path
        .parent()
        .and_then(|p| p.file_name())
        .and_then(|n| n.to_str())
        .filter(|n| !n.eq_ignore_ascii_case("workspace"))
        .map(str::to_string)
        .unwrap_or_else(|| "HTML Motion Film".to_string());

    let script_source = strip_style_blocks(&combined_source);
    let meta_obj_top = extract_meta_object_slice(&script_source).map(|obj| {
        if let Some((s, e)) = find_scenes_array_bounds(obj) {
            format!("{}\n{}", &obj[..s], &obj[e..])
        } else {
            obj.to_string()
        }
    });

    let top_source = if let Some((s, e)) = find_scenes_array_bounds(&script_source) {
        format!("{}\n{}", &script_source[..s], &script_source[e..])
    } else {
        script_source.clone()
    };
    let primary_meta = meta_obj_top.as_deref().unwrap_or(&top_source);

    let width = extract_number_field(primary_meta, "width")
        .or_else(|| extract_number_field(&top_source, "width"))
        .map(|v| (v.round() as u32).max(16))
        .or_else(|| extract_canvas_attr_u32(&script_source, "width"))
        .unwrap_or(1080);
    let height = extract_number_field(primary_meta, "height")
        .or_else(|| extract_number_field(&top_source, "height"))
        .map(|v| (v.round() as u32).max(16))
        .or_else(|| extract_canvas_attr_u32(&script_source, "height"))
        .unwrap_or(1920);
    let fps = extract_number_field(primary_meta, "fps")
        .or_else(|| extract_number_field(&top_source, "fps"))
        .map(|v| (v.round() as u32).max(1))
        .unwrap_or(30);

    let title = extract_string_field(primary_meta, "title")
        .or_else(|| extract_string_field(&top_source, "title"))
        .unwrap_or(default_title);
    let mut duration = extract_number_field(primary_meta, "duration")
        .or_else(|| extract_number_field(&top_source, "duration"))
        .unwrap_or(0.0);

    let preliminary_dur = if duration > 0.0 { duration } else { 15.0 };
    let scenes = parse_scenes_from_sources(
        &script_source,
        fps,
        preliminary_dur,
        &title,
        &script_names,
    );

    if duration <= 0.0 {
        let summed: f64 = scenes.iter().map(|s| s.duration.max(0.0)).sum();
        if summed > 0.0 {
            duration = summed;
        } else if let Some(frames) = extract_number_field(primary_meta, "durationInFrames") {
            duration = if frames > 0.0 {
                frames / fps as f64
            } else {
                15.0
            };
        } else {
            duration = 15.0;
        }
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

    #[test]
    fn test_inspect_multi_scene_scoping_ignores_first_scene_duration() {
        let dir = std::env::temp_dir().join(format!("aetheria_multi_scene_test_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();

        let html = r#"<!DOCTYPE html><html><body><canvas id="film" width="1080" height="1920"></canvas>
        <script>
        var SCENES = [
          { id: "scene1_hook", duration: 20.135, audio: "/audio/scene1.wav" },
          { id: "scene2_tree", duration: 18.575, audio: "/audio/scene2.wav" },
          { id: "scene3_santa", duration: 19.015, audio: "/audio/scene3.wav" },
          { id: "scene4_party", duration: 19.215, audio: "/audio/scene4.wav" },
          { id: "scene5_closing", duration: 20.835, audio: "/audio/scene5.wav" }
        ];
        var TOTAL_DUR = SCENES.reduce(function(a, s) { return a + s.duration; }, 0);
        window.__filmMeta = {
          title: "Christmas 3D",
          width: 1080,
          height: 1920,
          fps: 30,
          duration: TOTAL_DUR,
          scenes: SCENES
        };
        window.renderAt = function(t) {};
        </script></body></html>"#;
        std::fs::write(dir.join("index.html"), html).unwrap();

        let meta = inspect_workspace_film(&dir.join("index.html"));
        assert!(meta.exists);
        assert_eq!(meta.title, "Christmas 3D");
        assert_eq!(meta.scenes.len(), 5);
        assert!((meta.duration - 97.775).abs() < 0.01);
        assert_eq!(meta.total_frames, 2933);

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_css_dimensions_and_scenes_ref_do_not_override_film_meta() {
        let dir = std::env::temp_dir().join(format!("aetheria_css_scenes_test_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let script_dir = dir.join("script");
        std::fs::create_dir_all(&script_dir).unwrap();
        std::fs::write(script_dir.join("scene1.js"), "function r1(){}").unwrap();
        std::fs::write(script_dir.join("scene2.js"), "function r2(){}").unwrap();

        let html = r#"<!DOCTYPE html><html><head><style>
          html, body { min-height: 100vh; }
          #loadBar { width: 320px; height: 6px; }
          #stage { width: 1080px; height: 1920px; }
        </style></head><body><canvas id="film" width="1080" height="1920"></canvas>
        <script>
        (function () {
          var SCENES = [
            { id: "scene1_hook", audio: "/audio/scene1.wav", wordsPath: "/audio/scene1.words.json", duration: 20.135, headline: "Selamat Datang" },
            { id: "scene2_tree", audio: "/audio/scene2.wav", wordsPath: "/audio/scene2.words.json", duration: 18.575, headline: "Pohon Ajaib" }
          ];
          var TOTAL_DUR = SCENES.reduce(function(a, s) { return a + s.duration; }, 0);
          window.__filmMeta = {
            title: "Christmas 3D",
            width: 1080, height: 1920, fps: 30,
            duration: TOTAL_DUR,
            durationInFrames: Math.round(TOTAL_DUR * 30),
            scenes: SCENES
          };
          function loadWords(s) { s._words = data.words || []; }
          window.renderAt = function(t) {};
        })();
        </script></body></html>"#;
        std::fs::write(dir.join("index.html"), html).unwrap();

        let meta = inspect_workspace_film(&dir.join("index.html"));
        assert!(meta.exists);
        assert_eq!(meta.width, 1080);
        assert_eq!(meta.height, 1920);
        assert_eq!(meta.fps, 30);
        assert_eq!(meta.scenes.len(), 2);
        assert_eq!(meta.scenes[0].id, "scene1_hook");
        assert_eq!(meta.scenes[0].title, "Selamat Datang");
        assert_eq!(meta.scenes[0].audio.as_deref(), Some("/audio/scene1.wav"));
        assert_eq!(meta.scenes[0].words.as_deref(), Some("/audio/scene1.words.json"));
        assert_eq!(meta.scenes[1].audio.as_deref(), Some("/audio/scene2.wav"));
        assert!((meta.duration - 38.71).abs() < 0.01);
        assert_eq!(meta.total_frames, 1161);

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_collect_ordered_scripts_respects_html_kit_before_scenes_and_skips_vendor_lint() {
        let dir = std::env::temp_dir().join(format!("aetheria_kit_order_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let script_dir = dir.join("script");
        std::fs::create_dir_all(&script_dir).unwrap();

        std::fs::write(
            script_dir.join("three.min.js"),
            "var THREE={WebGLRenderer:function(){requestAnimationFrame(function(){});Math.random();}};",
        )
        .unwrap();
        std::fs::write(script_dir.join("clay-kit3d.js"), "window.ClayKit={};").unwrap();
        std::fs::write(script_dir.join("scene1.js"), "window.S1=function(){};").unwrap();

        let html = r#"<!DOCTYPE html><html><head>
        <script src="/script/three.min.js"></script>
        <script src="/script/clay-kit3d.js"></script>
        <script src="/script/scene1.js"></script>
        </head><body><canvas id="c" width="1080" height="1920"></canvas>
        <script>
        window.__filmMeta = { title: "3D", width: 1080, height: 1920, fps: 30, duration: 5 };
        window.renderAt = function(t) {};
        window.__ready = true;
        </script></body></html>"#;
        let html_path = dir.join("index.html");
        std::fs::write(&html_path, html).unwrap();

        let ordered = collect_ordered_script_files(&html_path);
        let names: Vec<&str> = ordered.iter().map(|(n, _, _)| n.as_str()).collect();
        assert_eq!(names, vec!["three.min.js", "clay-kit3d.js", "scene1.js"]);

        let meta = inspect_workspace_film(&html_path);
        assert!(meta.lint.valid, "vendor three.min.js must not fail project lint: {:?}", meta.lint.issues);

        let _ = std::fs::remove_dir_all(&dir);
    }
}


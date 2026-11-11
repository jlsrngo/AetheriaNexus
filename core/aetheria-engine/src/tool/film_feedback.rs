//! Automatic HTML/JS Motion Film & Workspace File Verification Feedback.
//! Gives the LLM immediate, actionable engine diagnostics inside `write`, `edit`,
//! `apply_patch`, and `lsp` results without failing progressive edits on disk.

use crate::paths::{configure_hidden_std_command, contains_path};
use crate::studio::film_inspector::{inspect_workspace_film, FilmMeta};
use crate::studio::motion_linter::lint_html_film;
use serde_json::{json, Value};
use std::path::Path;
use std::process::Command;

#[derive(Debug, Default)]
pub struct FileFeedback {
    pub syntax_error: Option<String>,
    pub has_errors: bool,
    pub diagnostics: Vec<String>,
    pub film_meta: Option<Value>,
}

fn check_js_syntax(target: &Path) -> Option<String> {
    let mut cmd = Command::new("node");
    configure_hidden_std_command(&mut cmd);
    let out = cmd.arg("--check").arg(target).output().ok()?;
    if out.status.success() {
        return None;
    }
    let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
    Some(if stderr.is_empty() {
        "JavaScript syntax check failed.".to_string()
    } else {
        stderr
    })
}

fn find_short_hex_mix_warnings(content: &str) -> Vec<String> {
    let mut out = Vec::new();
    for (idx, line) in content.lines().enumerate() {
        let trimmed = line.trim();
        if trimmed.starts_with("//") || trimmed.starts_with("/*") || trimmed.starts_with('*') {
            continue;
        }
        if !line.contains("mixHex(") {
            continue;
        }
        let bytes = line.as_bytes();
        let mut i = 0;
        while i + 3 < bytes.len() {
            if bytes[i] == b'#'
                && bytes[i + 1].is_ascii_hexdigit()
                && bytes[i + 2].is_ascii_hexdigit()
                && bytes[i + 3].is_ascii_hexdigit()
            {
                if !bytes.get(i + 4).is_some_and(|b| b.is_ascii_hexdigit()) {
                    let snippet = &line[i..=i + 3];
                    out.push(format!(
                        "WARNING (SHORT_HEX_COLOR at L{}): '{}' passed near mixHex(); use 6-digit hex (e.g. '#000000') so color interpolation never yields NaN.",
                        idx + 1,
                        snippet
                    ));
                    break;
                }
            }
            i += 1;
        }
    }
    out
}

fn count_audio_files_on_disk(film_dir: &Path, ws_root: &Path) -> usize {
    let mut count = 0usize;
    for dir in [
        film_dir.join("audio"),
        film_dir.join("public").join("audio"),
        ws_root.join("audio"),
    ] {
        let Ok(entries) = std::fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_file() {
                let ext = p
                    .extension()
                    .and_then(|e| e.to_str())
                    .map(|e| e.to_ascii_lowercase())
                    .unwrap_or_default();
                if matches!(ext.as_str(), "wav" | "mp3" | "m4a" | "ogg" | "aac" | "flac") {
                    count += 1;
                }
            }
        }
        if count > 0 {
            break;
        }
    }
    count
}

fn workspace_asset_exists(film_dir: &Path, ws_root: &Path, raw_rel: &str) -> bool {
    let clean = raw_rel.trim().trim_start_matches('/').replace('\\', "/");
    if clean.is_empty() || clean.contains("..") {
        return false;
    }
    for root in [film_dir, &film_dir.join("public"), ws_root] {
        let candidate = root.join(&clean);
        if contains_path(root, &candidate) && candidate.is_file() {
            return true;
        }
    }
    false
}

fn extract_local_script_srcs(html: &str) -> Vec<String> {
    let mut refs = Vec::new();
    let lower = html.to_ascii_lowercase();
    let mut cursor = 0usize;
    while let Some(rel) = lower[cursor..].find("<script") {
        let start = cursor + rel;
        let Some(tag_end_rel) = lower[start..].find('>') else {
            break;
        };
        let tag = &html[start..=start + tag_end_rel];
        cursor = start + tag_end_rel + 1;

        let tag_lower = tag.to_ascii_lowercase();
        let Some(src_pos) = tag_lower.find("src=") else {
            continue;
        };
        let rest = tag[src_pos + 4..].trim_start();
        let val = rest
            .strip_prefix('"')
            .and_then(|s| s.split('"').next())
            .or_else(|| rest.strip_prefix('\'').and_then(|s| s.split('\'').next()));
        if let Some(raw) = val {
            let clean = raw.trim().trim_start_matches("./").trim_start_matches('/');
            if clean.starts_with("script/") && clean.ends_with(".js") {
                refs.push(clean.to_string());
            }
        }
    }
    refs
}

fn summarize_film_meta(meta: &FilmMeta) -> Value {
    let audio_tracks_resolved = meta.scenes.iter().filter(|s| s.audio.is_some()).count();
    json!({
        "title": meta.title,
        "width": meta.width,
        "height": meta.height,
        "fps": meta.fps,
        "duration": (meta.duration * 100.0).round() / 100.0,
        "totalFrames": meta.total_frames,
        "scenesCount": meta.scenes.len(),
        "audioTracksResolved": audio_tracks_resolved
    })
}

fn check_webgl_diagnostics(content: &str, file_name: &str, feedback: &mut FileFeedback) {
    if crate::studio::builtin_runtime::is_vendor_script_name(file_name) {
        return;
    }
    if content.contains("WebGLRenderer(") && !content.contains("preserveDrawingBuffer") {
        feedback.has_errors = true;
        feedback.diagnostics.push(
            "ERROR (WEBGL_MISSING_PRESERVE_DRAWING_BUFFER): new THREE.WebGLRenderer(...) must include preserveDrawingBuffer: true so headless MP4 capture does not produce blank frames."
                .to_string(),
        );
    }
}

/// Inspects a newly written or edited project file and returns actionable engine diagnostics.
pub fn collect_file_feedback(workspace_dir: &str, target: &Path) -> FileFeedback {
    let mut feedback = FileFeedback::default();
    if !target.is_file() {
        return feedback;
    }

    let ext = target
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default();
    let file_name = target
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or_default();

    let content = match std::fs::read_to_string(target) {
        Ok(s) => s,
        Err(_) => return feedback,
    };

    match ext.as_str() {
        "json" => {
            if let Err(e) = serde_json::from_str::<Value>(&content) {
                feedback.has_errors = true;
                let msg = format!("ERROR (JSON_SYNTAX): {}", e);
                feedback.syntax_error = Some(msg.clone());
                feedback.diagnostics.push(msg);
            }
        }
        "js" | "mjs" | "cjs" => {
            if let Some(err) = check_js_syntax(target) {
                feedback.has_errors = true;
                let msg = format!("ERROR (JS_SYNTAX): {}", err);
                feedback.syntax_error = Some(msg.clone());
                feedback.diagnostics.push(msg);
            }
            let lint = lint_html_film(&content);
            for issue in lint.issues {
                if issue.code == "MISSING_RENDER_AT" || issue.code == "MISSING_READY_FLAG" {
                    continue;
                }
                let loc = issue
                    .line
                    .map(|l| format!(" at L{}", l))
                    .unwrap_or_default();
                feedback.diagnostics.push(format!(
                    "{} ({}{}): {}",
                    issue.severity.to_ascii_uppercase(),
                    issue.code,
                    loc,
                    issue.message
                ));
            }
            feedback
                .diagnostics
                .extend(find_short_hex_mix_warnings(&content));
            check_webgl_diagnostics(&content, file_name, &mut feedback);
        }
        "html" | "htm" => {
            check_webgl_diagnostics(&content, file_name, &mut feedback);
            let meta = inspect_workspace_film(target);
            feedback.film_meta = Some(summarize_film_meta(&meta));
            let ws_root = Path::new(workspace_dir);
            let film_dir = target.parent().unwrap_or(ws_root);

            for issue in &meta.lint.issues {
                if issue.severity == "error" {
                    feedback.has_errors = true;
                }
                let loc = issue
                    .line
                    .map(|l| format!(" at L{}", l))
                    .unwrap_or_default();
                feedback.diagnostics.push(format!(
                    "{} ({}{}): {}",
                    issue.severity.to_ascii_uppercase(),
                    issue.code,
                    loc,
                    issue.message
                ));
            }

            if !meta.lint.has_film_meta {
                feedback.diagnostics.push(
                    "WARNING (MISSING_FILM_META): Declare window.__filmMeta = { title, width, height, fps, duration, scenes: SCENES } so Studio canvas dimensions and timeline parse reliably."
                        .to_string(),
                );
            }

            if meta.width < 320 || meta.height < 320 {
                feedback.has_errors = true;
                feedback.diagnostics.push(format!(
                    "ERROR (SUSPICIOUS_DIMENSIONS): Engine parsed film dimensions as {}x{}. Ensure window.__filmMeta specifies explicit integer width and height (e.g. 1080x1920).",
                    meta.width, meta.height
                ));
            }

            let audio_files_on_disk = count_audio_files_on_disk(film_dir, ws_root);
            let scenes_with_audio = meta.scenes.iter().filter(|s| s.audio.is_some()).count();
            if audio_files_on_disk > 0 && scenes_with_audio == 0 {
                feedback.has_errors = true;
                feedback.diagnostics.push(format!(
                    "ERROR (UNLINKED_SCENE_AUDIO): Found {} audio file(s) in audio/, but parsed 0 audio links on film scenes. Put scene entries with audio: '/audio/<file>.wav' inside a literal SCENES = [...] array.",
                    audio_files_on_disk
                ));
            }

            for scene in &meta.scenes {
                if let Some(ref audio_rel) = scene.audio {
                    if !workspace_asset_exists(film_dir, ws_root, audio_rel) {
                        feedback.diagnostics.push(format!(
                            "WARNING (MISSING_AUDIO_FILE): Scene '{}' references audio '{}', which does not exist on disk.",
                            scene.id, audio_rel
                        ));
                    }
                }
                if let Some(ref words_rel) = scene.words {
                    if !workspace_asset_exists(film_dir, ws_root, words_rel) {
                        feedback.diagnostics.push(format!(
                            "WARNING (MISSING_WORDS_FILE): Scene '{}' references words '{}', which does not exist on disk.",
                            scene.id, words_rel
                        ));
                    }
                }
            }

            for script_rel in extract_local_script_srcs(&content) {
                if script_rel.eq_ignore_ascii_case("script/aetheria-motion.js")
                    || crate::studio::builtin_runtime::is_builtin_three_path(&script_rel)
                {
                    continue;
                }
                if !workspace_asset_exists(film_dir, ws_root, &script_rel) {
                    feedback.diagnostics.push(format!(
                        "WARNING (MISSING_SCRIPT_FILE): Referenced script '{}' does not exist on disk yet.",
                        script_rel
                    ));
                }
            }

            if (content.contains("id=\"loading\"") || content.contains("id='loading'"))
                && !meta.lint.has_ready_flag
            {
                feedback.diagnostics.push(
                    "WARNING (LOADER_WITHOUT_READY_FLAG): Found #loading element without `window.__ready = true`. Set `window.__ready = true` cleanly after initial renderAt(0) for reliable headless MP4 export."
                        .to_string(),
                );
            }
        }
        _ => {}
    }

    feedback
}

/// Attaches structured diagnostics and inspected film metadata to a write/edit/patch tool result.
pub fn attach_post_write_feedback(result: &mut Value, workspace_dir: &str, target: &Path) {
    let feedback = collect_file_feedback(workspace_dir, target);
    if let Some(obj) = result.as_object_mut() {
        if let Some(meta) = feedback.film_meta {
            obj.insert("filmMeta".to_string(), meta);
        }
        if !feedback.diagnostics.is_empty() {
            obj.insert("diagnostics".to_string(), json!(feedback.diagnostics));
            if feedback.has_errors {
                obj.insert(
                    "actionRequired".to_string(),
                    json!("Fix the reported ERROR diagnostics with edit before finishing."),
                );
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_js_feedback_catches_short_hex_and_math_random() {
        let dir = std::env::temp_dir().join(format!("aetheria_fb_js_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let scene_path = dir.join("scene2.js");
        std::fs::write(
            &scene_path,
            "function draw(AM) {\n  const c = AM.mixHex('#ff0000', '#000', 0.4);\n  const r = Math.random();\n  return c + r;\n}\n",
        )
        .unwrap();

        let fb = collect_file_feedback(&dir.to_string_lossy(), &scene_path);
        assert!(fb
            .diagnostics
            .iter()
            .any(|d| d.contains("SHORT_HEX_COLOR") && d.contains("L2")));
        assert!(fb
            .diagnostics
            .iter()
            .any(|d| d.contains("NONDETERMINISTIC_MATH_RANDOM") && d.contains("L3")));

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_html_feedback_flags_unlinked_audio_when_audio_files_exist() {
        let dir = std::env::temp_dir().join(format!("aetheria_fb_html_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join("audio")).unwrap();
        std::fs::create_dir_all(dir.join("script")).unwrap();
        std::fs::write(dir.join("audio").join("scene1.wav"), b"RIFF0000WAVE").unwrap();
        std::fs::write(dir.join("script").join("scene1.js"), "function r1(){}").unwrap();

        let html = r#"<!DOCTYPE html><html><head><style>body{min-height:100vh}</style></head>
        <body><div id="loading"></div><canvas id="film" width="1080" height="1920"></canvas>
        <script>
        window.__filmMeta = { title: "Demo", width: 1080, height: 1920, fps: 30, duration: 20 };
        window.renderAt = function(t) {};
        </script></body></html>"#;
        let html_path = dir.join("index.html");
        std::fs::write(&html_path, html).unwrap();

        let fb = collect_file_feedback(&dir.to_string_lossy(), &html_path);
        assert!(fb.has_errors);
        assert!(fb
            .diagnostics
            .iter()
            .any(|d| d.contains("UNLINKED_SCENE_AUDIO")));
        assert!(fb
            .diagnostics
            .iter()
            .any(|d| d.contains("LOADER_WITHOUT_READY_FLAG")));
        let meta = fb.film_meta.unwrap();
        assert_eq!(meta["width"], 1080);
        assert_eq!(meta["height"], 1920);
        assert_eq!(meta["audioTracksResolved"], 0);

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_webgl_renderer_requires_preserve_drawing_buffer_and_builtin_three_no_warning() {
        let dir = std::env::temp_dir().join(format!("aetheria_fb_webgl_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join("script")).unwrap();

        let bad_kit = dir.join("script").join("clay-kit.js");
        std::fs::write(
            &bad_kit,
            "function initStage(c){ return new THREE.WebGLRenderer({ canvas: c, antialias: true }); }\n",
        )
        .unwrap();
        let fb_bad = collect_file_feedback(&dir.to_string_lossy(), &bad_kit);
        assert!(fb_bad.has_errors);
        assert!(fb_bad
            .diagnostics
            .iter()
            .any(|d| d.contains("WEBGL_MISSING_PRESERVE_DRAWING_BUFFER")));

        let html = r#"<!DOCTYPE html><html><head><style>body{margin:0}</style>
        <script src="/script/three.min.js"></script>
        <script src="/script/aetheria-motion.js"></script>
        <script src="/script/clay-kit.js"></script></head>
        <body><canvas id="c" width="1080" height="1920"></canvas>
        <script>
        window.__filmMeta = { title: "Clay", width: 1080, height: 1920, fps: 30, duration: 8 };
        window.renderAt = function(t) {};
        window.__ready = true;
        </script></body></html>"#;
        let html_path = dir.join("index.html");
        std::fs::write(&html_path, html).unwrap();

        let fb_html = collect_file_feedback(&dir.to_string_lossy(), &html_path);
        assert!(
            !fb_html
                .diagnostics
                .iter()
                .any(|d| d.contains("MISSING_SCRIPT_FILE") && d.contains("three.min.js")),
            "builtin /script/three.min.js should never report MISSING_SCRIPT_FILE: {:?}",
            fb_html.diagnostics
        );

        let _ = std::fs::remove_dir_all(&dir);
    }
}

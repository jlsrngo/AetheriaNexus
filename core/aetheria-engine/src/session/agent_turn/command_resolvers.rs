//! Prompt Directive Resolvers:
//! - Active video reference report injection (`ref_report.md`)
//! - Explicit `@filename` workspace file mentions
//! - Motion style / skill slash commands (`/<style>`)
//! - Audio / voice preset slash commands (`/audio:<style>`, `/voice:<style>`)

use std::path::Path;

/// Injects active video reference report if present in workspace.
pub fn resolve_reference_report(workspace_dir: &str) -> Option<String> {
    let ws_path = Path::new(workspace_dir);
    let candidates = [
        ws_path.join("ref").join("ref_report.md"),
        ws_path.join("ref").join("extracted").join("ref_report.md"),
        ws_path.join("workspace").join("ref").join("extracted").join("ref_report.md"),
    ];

    let target_report = candidates.into_iter().find(|p| p.exists())?;
    let bp_text = std::fs::read_to_string(&target_report).ok()?;
    Some(format!(
        "[Active Video Reference Blueprint (Requested by user)]:\n\"\"\"\n{}\n\"\"\"\n\
        GUIDELINES WHEN PRODUCING FROM REFERENCE:\n\
        1. VISUAL FIDELITY: Maintain stylistic harmony (color palette, typography hierarchy, visual layouts).\n\
        2. 3-TRACK SUBAGENT DELEGATION: Delegate voiceover/SFX synthesis to `task(subagent_type: \"audio-director\")` (with `spokenText` for foreign names/acronyms) and delegate modular scene scripts (`script/scene1.js`..`script/sceneN.js` + `index.html`) to `task(subagent_type: \"motion-designer\")` instead of executing all steps inline in the main coordinator turn.\n\
        3. SEQUENTIAL AUDIO & SFX: Voiceover narration must be sequential (`audio: \"audio/sceneK.wav\"`), with optional per-scene sound effects linked via `sfx: \"audio/sfx_K.wav\"` in `SCENES`.\n\
        4. DETERMINISTIC HTML ENGINE: Drive all motion via `window.renderAt(t)` and `window.AM`, then verify with `capture_film_preview`.",
        bp_text.trim()
    ))
}

/// Resolves `@filename` mentions in prompt into file context.
pub fn resolve_mentioned_files(workspace_dir: &str, prompt_text: &str) -> Vec<String> {
    let mut out = Vec::new();
    for word in prompt_text.split_whitespace() {
        if let Some(m) = word.strip_prefix('@') {
            let clean_m = m.trim_matches(|c: char| !c.is_alphanumeric() && c != '.' && c != '_' && c != '-');
            if !clean_m.is_empty() {
                let candidate = Path::new(workspace_dir).join(clean_m);
                if candidate.is_file() {
                    if let Ok(content) = std::fs::read_to_string(&candidate) {
                        let snippet: String = content.chars().take(8000).collect();
                        out.push(format!(
                            "[Explicitly Mentioned Workspace File: {}]:\n\"\"\"\n{}\n\"\"\"",
                            clean_m, snippet.trim()
                        ));
                    } else {
                        out.push(format!(
                            "[Explicitly Mentioned Workspace File: {} (binary document present in active folder)]",
                            clean_m
                        ));
                    }
                }
            }
        }
    }
    out
}

pub fn resolve_motioncraft_style_command(workspace_dir: &str, prompt_text: &str) -> Option<String> {
    resolve_dynamic_style_or_skill_command(workspace_dir, prompt_text)
}

/// Seeds non-scene kit scripts (e.g. `examples/script/clay-kit.js`) into `workspace/script/`
/// via `resolve_isolated_path` when missing, so `motion-designer` uses the real 3D kit
/// instead of rewriting a miniature 2D stub.
fn seed_skill_kit_scripts(workspace_dir: &str, skill_dir: &Path) -> Vec<String> {
    if workspace_dir.trim().is_empty() {
        return Vec::new();
    }
    let src_dir = skill_dir.join("examples").join("script");
    if !src_dir.is_dir() {
        return Vec::new();
    }
    let mut seeded = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&src_dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if !p.is_file() {
                continue;
            }
            let Some(fname) = p.file_name().and_then(|n| n.to_str()) else {
                continue;
            };
            let lower = fname.to_ascii_lowercase();
            if !lower.ends_with(".js") || lower.starts_with("scene") {
                continue;
            }
            let rel = format!("script/{fname}");
            if let Ok(dest) = crate::tool::path_guard::resolve_isolated_path(workspace_dir, &rel) {
                if !dest.exists() {
                    if let Some(parent) = dest.parent() {
                        let _ = std::fs::create_dir_all(parent);
                    }
                    if std::fs::copy(&p, &dest).is_ok() {
                        seeded.push(rel);
                    }
                } else {
                    seeded.push(rel);
                }
            }
        }
    }
    seeded.sort();
    seeded
}

/// Dynamically detects and resolves style or design skill slash commands from `.aetheria/skills/*`.
pub fn resolve_dynamic_style_or_skill_command(workspace_dir: &str, prompt_text: &str) -> Option<String> {
    let root = crate::paths::project_root();

    let mut slash_tags: Vec<String> = Vec::new();
    for token in prompt_text.split_whitespace() {
        let t = token.trim();
        if let Some(rest) = t.strip_prefix('/') {
            let tag = rest
                .trim_start_matches("style:")
                .trim_start_matches("style=")
                .trim_start_matches("skill:")
                .trim_start_matches("skill=")
                .trim_matches(|c: char| !c.is_alphanumeric() && c != '-' && c != '_')
                .to_lowercase();
            if !tag.is_empty() {
                slash_tags.push(tag);
            }
        }
    }

    if slash_tags.is_empty() {
        return None;
    }

    let aetheria_skills_dir = root.join(".aetheria").join("skills");

    for tag in &slash_tags {
        if aetheria_skills_dir.is_dir() {
            if let Ok(entries) = std::fs::read_dir(&aetheria_skills_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        let name = path
                            .file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("")
                            .to_lowercase();
                        let is_match = name == *tag || (tag.len() >= 3 && name.contains(tag));

                        if is_match {
                            let skill_md = std::fs::read_to_string(path.join("SKILL.md"))
                                .or_else(|_| std::fs::read_to_string(path.join("style.md")))
                                .or_else(|_| std::fs::read_to_string(path.join("README.md")))
                                .unwrap_or_default();
                            let tokens_json = std::fs::read_to_string(path.join("tokens.json"))
                                .unwrap_or_default();
                            let brief_content = std::fs::read_to_string(path.join("REMOTION_BRIEF.md"))
                                .or_else(|_| std::fs::read_to_string(path.join("brief.md")))
                                .unwrap_or_default();
                            let brief_section = if !brief_content.is_empty() {
                                format!("\n\nEXACT MOTION SKILL SPECIFICATIONS:\n{brief_content}\n")
                            } else {
                                String::new()
                            };
                            let examples_section = collect_skill_examples(&path);
                            let seeded_kits = seed_skill_kit_scripts(workspace_dir, &path);
                            let seeded_note = if seeded_kits.is_empty() {
                                String::new()
                            } else {
                                format!(
                                    "\nSEEDED KIT FILES ALREADY IN WORKSPACE (DO NOT OVERWRITE OR SHRINK THESE): {}\n",
                                    seeded_kits.join(", ")
                                )
                            };

                            return Some(format!(
                                "[Active Motion Skill Triggered: /{name}]:\n\"\"\"\n\
                                SKILL DIRECTIVES (from {path_display}/SKILL.md):\n{skill_md}\n\n\
                                DESIGN TOKENS (from {path_display}/tokens.json):\n{tokens_json}\n\
                                {brief_section}\
                                {examples_section}\
                                {seeded_note}\
                                \"\"\"\n\
                                MANDATORY RULES FOR THIS GENERATION:\n\
                                1. Coordinate via the 3-Track Subagent Pipeline: delegate voiceover/SFX synthesis to `task(subagent_type: \"audio-director\")` and delegate modular per-scene scripts (`script/scene1.js`..`script/sceneN.js`) + `index.html` to `task(subagent_type: \"motion-designer\")`.\n\
                                2. Pass the active skill path (`{path_display}`) and its `examples/` kit instructions directly in your prompt to `motion-designer`. The active skill's rendering architecture (e.g., 3D Three.js + `ClayKit` dual-canvas `#stage-webgl` with `preserveDrawingBuffer: true` + `#stage-hud`, smooth outlines, Neobrutalism subtitles) is NON-NEGOTIABLE — adapt storyboard mood/props *inside* the skill's architecture rather than falling back to plain 2D Canvas.\n\
                                3. If `script/*-kit.js` (e.g. `script/clay-kit.js`) is already seeded in the workspace, DO NOT overwrite it — load it in `index.html` alongside `/script/three.min.js` and `/script/aetheria-motion.js`, preserve `examples/index.html`'s dual-canvas + `AM.drawSubtitles(..., {{ style: \"neobrutalism\", ... }})` structure, and build real 3D meshes in `scene3D` inside `script/scene1.js`..`sceneN.js`.\n\
                                4. Strictly apply these exact colors, fonts, camera movement rules, scale law (`u(refPx)`), and motion curves (`AM.spring`, `AM.anticipation`, `AM.stagger`).\n\
                                5. Follow the Do's and Don'ts from the skill guidelines and exact brief specifications.",
                                path_display = path.display()
                            ));
                        }
                    }
                }
            }
        }
    }

    None
}

/// Dynamically detects audio preset commands (`/audio:<style>`, `/preset:<style>`, `/voice:<style>`)
/// and loads the corresponding voice styling directives.
pub fn resolve_voice_preset_command(prompt_text: &str) -> Option<String> {
    let mut requested_style = None;
    for token in prompt_text.split_whitespace() {
        let t = token.trim();
        if let Some(rest) = t.strip_prefix('/') {
            let lower = rest.to_lowercase();
            if let Some(s) = lower.strip_prefix("audio:").or_else(|| lower.strip_prefix("audio="))
                .or_else(|| lower.strip_prefix("voice:")).or_else(|| lower.strip_prefix("voice="))
                .or_else(|| lower.strip_prefix("preset:")).or_else(|| lower.strip_prefix("preset=")) {
                let clean = s.trim_matches(|c: char| !c.is_alphanumeric() && c != '-' && c != '_');
                if !clean.is_empty() {
                    requested_style = Some(clean.to_string());
                    break;
                }
            }
        }
    }

    let style_key = requested_style?;
    let root = crate::paths::project_root();
    let presets_path = root.join("core").join("voicebox").join("presets").join("presets.json");
    if !presets_path.is_file() {
        return None;
    }

    let content = std::fs::read_to_string(&presets_path).ok()?;
    let json_val: serde_json::Value = serde_json::from_str(&content).ok()?;
    let styles_obj = json_val.get("presets")?.get("aetheria")?.get("styles")?;

    let effective_key = match style_key.as_str() {
        "pocketmyth" | "pm" => "default",
        "kriminal" | "conspiracy" => "crime_conspiracy",
        other => other,
    };

    if let Some(style_data) = styles_obj.get(effective_key) {
        let label = style_data.get("label").and_then(|v| v.as_str()).unwrap_or(effective_key);
        let instruction = style_data.get("controlInstruction").and_then(|v| v.as_str()).unwrap_or("");
        let cfg = style_data.get("cfgValue").and_then(|v| v.as_f64()).unwrap_or(1.48);

        return Some(format!(
            "[Active Voicebox Audio Preset Directive: /audio:{effective_key}]:\n\"\"\"\n\
            NARRATOR VOICE STYLE: {label}\n\
            CONTROL INSTRUCTION: \"{instruction}\"\n\
            CFG VALUE: {cfg:.2}\n\
            \"\"\"\n\
            MANDATORY RULES FOR AUDIO GENERATION:\n\
            1. When calling `voicebox_speak`, pass:\n\
               - voice: \"aetheria\"\n\
               - style: \"{effective_key}\"\n\
            2. When producing video scenes, deliver narration with this exact tone ({label})."
        ));
    }

    None
}

fn collect_skill_examples(skill_dir: &Path) -> String {
    let examples_dir = skill_dir.join("examples");
    if !examples_dir.is_dir() {
        return String::new();
    }

    let mut files: Vec<std::path::PathBuf> = Vec::new();
    let mut stack = vec![examples_dir.clone()];
    while let Some(dir) = stack.pop() {
        if let Ok(entries) = std::fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_dir() {
                    stack.push(p);
                } else if p.is_file() {
                    files.push(p);
                }
            }
        }
    }
    files.sort();

    let mut out = String::new();
    let mut total_chars = 0usize;
    const MAX_TOTAL_CHARS: usize = 35_000;

    for file in files.into_iter().take(6) {
        let Ok(content) = std::fs::read_to_string(&file) else {
            continue;
        };
        let rel = file
            .strip_prefix(skill_dir)
            .unwrap_or(&file)
            .to_string_lossy()
            .replace('\\', "/");
        if total_chars + content.len() > MAX_TOTAL_CHARS {
            out.push_str(&format!(
                "\nREFERENCE EXAMPLE FILE ({rel} at {}): [omitted due to size — read directly with `read` tool if needed]\n",
                file.display()
            ));
            continue;
        }
        total_chars += content.len();
        out.push_str(&format!(
            "\nREFERENCE EXAMPLE ({rel} — copy/adapt into workspace):\n```\n{content}\n```\n"
        ));
    }

    if out.is_empty() {
        String::new()
    } else {
        format!("\nREFERENCE EXAMPLE KIT (from {}/examples):\n{out}", skill_dir.display())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slash_skill_command_injects_examples_kit_for_soft_clay_story() {
        let resolved = resolve_dynamic_style_or_skill_command("", "/mg-soft-clay-story /audio:mystery")
            .expect("mg-soft-clay-story should resolve");
        assert!(resolved.contains("SKILL DIRECTIVES"));
        assert!(resolved.contains("DESIGN TOKENS"));
        assert!(resolved.contains("REFERENCE EXAMPLE (examples/script/clay-kit.js"));
        assert!(resolved.contains("ClayKit"));
    }
}


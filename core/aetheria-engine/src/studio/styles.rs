//! Isolated Motion Skill Manager for Aetheria Nexus.
//! All motion skills are strictly stored and discovered in `.aetheria/skills/`.
//! External skills outside `.aetheria/skills/` are completely ignored.

use axum::{response::IntoResponse, Json};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashSet;

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct AddSkillPayload {
    pub name: String,
    #[serde(alias = "filePath")]
    pub file_path: Option<String>,
    #[serde(alias = "markdown")]
    pub content: Option<String>,
    pub description: Option<String>,
}

pub type AddStylePayload = AddSkillPayload;

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RegisteredSkill {
    pub id: String,
    pub name: String,
    pub command: String,
    pub description: String,
    pub path: String,
    pub has_brief: bool,
    pub preview_fonts: Vec<String>,
}

pub type RegisteredStyle = RegisteredSkill;

/// Normalizes name into a clean kebab-case command slug (e.g. "Editorial Kinetic v2" -> "editorial-kinetic-v2")
pub fn slugify_skill_name(name: &str) -> String {
    let clean = name.trim().to_lowercase();
    let mut slug = String::new();
    let mut prev_dash = false;
    for ch in clean.chars() {
        if ch.is_alphanumeric() {
            slug.push(ch);
            prev_dash = false;
        } else if (ch == '-' || ch == '_' || ch == ' ') && !prev_dash && !slug.is_empty() {
            slug.push('-');
            prev_dash = true;
        }
    }
    slug.trim_end_matches('-').to_string()
}

pub fn slugify_style_name(name: &str) -> String {
    slugify_skill_name(name)
}

/// Core function to register a skill directly into `.aetheria/skills/<slug>/`.
pub fn register_skill_internal(
    raw_name: &str,
    file_path: Option<&str>,
    content_override: Option<&str>,
    custom_desc: Option<&str>,
) -> Result<RegisteredSkill, String> {
    let slug = slugify_skill_name(raw_name);
    if slug.is_empty() {
        return Err("Skill name cannot be empty".to_string());
    }

    // 1. Resolve markdown content
    let raw_md = if let Some(content) = content_override {
        if !content.trim().is_empty() {
            content.to_string()
        } else if let Some(fp) = file_path {
            std::fs::read_to_string(fp).map_err(|e| format!("Failed to read file '{}': {}", fp, e))?
        } else {
            return Err("Either file_path or content must be provided".to_string());
        }
    } else if let Some(fp) = file_path {
        std::fs::read_to_string(fp).map_err(|e| format!("Failed to read file '{}': {}", fp, e))?
    } else {
        return Err("No file content or path provided".to_string());
    };

    if raw_md.trim().is_empty() {
        return Err("Skill brief content is empty".to_string());
    }

    // 2. Parse basic metadata from the markdown
    let mut title = String::new();
    let mut description = custom_desc.unwrap_or("").trim().to_string();
    let mut preview_fonts = Vec::new();

    for line in raw_md.lines() {
        let trimmed = line.trim();
        if title.is_empty() && trimmed.starts_with("# ") {
            title = trimmed.trim_start_matches("# ").trim().to_string();
        } else if description.is_empty()
            && !trimmed.is_empty()
            && !trimmed.starts_with('#')
            && !trimmed.starts_with("```")
            && !trimmed.starts_with("---")
        {
            description = trimmed.to_string();
        }

        if trimmed.contains("Inter") && !preview_fonts.contains(&"Inter".to_string()) {
            preview_fonts.push("Inter".to_string());
        }
        if trimmed.contains("JetBrains Mono")
            && !preview_fonts.contains(&"JetBrains Mono".to_string())
        {
            preview_fonts.push("JetBrains Mono".to_string());
        }
    }

    if title.is_empty() {
        title = slug.replace('-', " ");
    }
    if description.is_empty() {
        description = format!("Custom motion skill for {}", title);
    }
    if preview_fonts.is_empty() {
        preview_fonts.push("Inter".to_string());
    }

    // 3. Isolated destination: .aetheria/skills/<slug>/
    let root = crate::paths::project_root();
    let skill_dir = root.join(".aetheria").join("skills").join(&slug);
    let _ = std::fs::create_dir_all(&skill_dir);

    // 4. Save REMOTION_BRIEF.md verbatim
    let _ = std::fs::write(skill_dir.join("REMOTION_BRIEF.md"), &raw_md);

    // 5. Generate companion style.md / SKILL.md
    let skill_md = format!(
        "# {slug}\n\n\
        {title}\n\n\
        {description}\n\n\
        **Fonts:** {fonts}. **Scale Law:** `u(refPx) = refPx * (1080 / 410)`.\n\n\
        ## Do\n\
        - Follow all specifications in REMOTION_BRIEF.md verbatim.\n\
        - Use frame-based easing functions (easeOutExpo / easeOutBack).\n\
        - Keep camera locked off except whip-zoom on hook.\n\n\
        ## Don't\n\
        - Do not use CSS transitions or setTimeout.\n\
        - Do not place more than 2 lines of text per sub-beat.\n",
        slug = slug,
        title = title,
        description = description,
        fonts = preview_fonts.join(", ")
    );

    let _ = std::fs::write(skill_dir.join("SKILL.md"), &skill_md);
    let _ = std::fs::write(skill_dir.join("style.md"), &skill_md);

    // 6. Generate companion tokens.json
    let tokens_json = json!({
        "name": slug,
        "title": title,
        "command": format!("/{}", slug),
        "description": description,
        "fonts": preview_fonts,
        "brief": "REMOTION_BRIEF.md",
        "scaleLaw": "u(refPx) = refPx * 2.6341",
        "colors": {
            "cream": "#F4F1EA",
            "black": "#0A0A0A"
        }
    });
    let tokens_str = serde_json::to_string_pretty(&tokens_json).unwrap_or_default();
    let _ = std::fs::write(skill_dir.join("tokens.json"), &tokens_str);

    Ok(RegisteredSkill {
        id: slug.clone(),
        name: title,
        command: format!("/{}", slug),
        description,
        path: format!(".aetheria/skills/{}", slug),
        has_brief: true,
        preview_fonts,
    })
}

pub fn register_style_internal(
    raw_name: &str,
    file_path: Option<&str>,
    content_override: Option<&str>,
    custom_desc: Option<&str>,
) -> Result<RegisteredStyle, String> {
    register_skill_internal(raw_name, file_path, content_override, custom_desc)
}

/// POST /api/skills/add (also alias /api/styles/add)
pub async fn handle_add_style(Json(payload): Json<AddSkillPayload>) -> impl IntoResponse {
    match register_skill_internal(
        &payload.name,
        payload.file_path.as_deref(),
        payload.content.as_deref(),
        payload.description.as_deref(),
    ) {
        Ok(skill) => Json(json!({
            "success": true,
            "skill": skill.clone(),
            "style": skill.clone(),
            "message": format!("Skill '{}' successfully registered to .aetheria/skills/! Available as '{}'", skill.name, skill.command)
        })),
        Err(err) => Json(json!({
            "success": false,
            "error": err
        })),
    }
}

/// GET /api/skills (also alias /api/styles)
/// Exclusively scans .aetheria/skills/ — does NOT read any external skills!
pub async fn handle_list_styles() -> impl IntoResponse {
    let skills = list_all_skills_internal();
    Json(json!({
        "success": true,
        "skills": skills.clone(),
        "styles": skills
    }))
}

/// Scans ONLY `.aetheria/skills/`. Completely isolated from other skills.
pub fn list_all_skills_internal() -> Vec<RegisteredSkill> {
    let root = crate::paths::project_root();
    let mut skills = Vec::new();
    let mut seen_ids = HashSet::new();

    let target_dir = root.join(".aetheria").join("skills");
    if !target_dir.is_dir() {
        return skills;
    }

    if let Ok(entries) = std::fs::read_dir(target_dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                let id = p
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_lowercase();
                if id.is_empty() || seen_ids.contains(&id) {
                    continue;
                }

                let skill_md = std::fs::read_to_string(p.join("SKILL.md"))
                    .or_else(|_| std::fs::read_to_string(p.join("style.md")))
                    .or_else(|_| std::fs::read_to_string(p.join("README.md")))
                    .unwrap_or_default();

                let has_brief = p.join("REMOTION_BRIEF.md").exists();

                let mut title = id.replace('-', " ");
                let mut desc = String::new();
                let mut fonts = Vec::new();

                for line in skill_md.lines() {
                    let t = line.trim();
                    if desc.is_empty()
                        && !t.is_empty()
                        && !t.starts_with('#')
                        && !t.starts_with("```")
                    {
                        desc = t.to_string();
                    }
                    if t.starts_with("# ") && title == id.replace('-', " ") {
                        title = t.trim_start_matches("# ").trim().to_string();
                    }
                }

                if desc.is_empty() {
                    desc = format!("Motion skill for /{}", id);
                }

                if skill_md.contains("Inter") {
                    fonts.push("Inter".to_string());
                }
                if skill_md.contains("JetBrains Mono") {
                    fonts.push("JetBrains Mono".to_string());
                }

                seen_ids.insert(id.clone());
                skills.push(RegisteredSkill {
                    id: id.clone(),
                    name: title,
                    command: format!("/{}", id),
                    description: desc,
                    path: p.display().to_string(),
                    has_brief,
                    preview_fonts: fonts,
                });
            }
        }
    }

    skills
}

pub fn list_all_styles_internal() -> Vec<RegisteredStyle> {
    list_all_skills_internal()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_slugify() {
        assert_eq!(slugify_skill_name("My Custom Motion Skill"), "my-custom-motion-skill");
        assert_eq!(slugify_skill_name("/cyber-neon-v2"), "cyber-neon-v2");
    }

    #[test]
    fn test_register_arbitrary_skill_dynamically() {
        let root = crate::paths::project_root();
        let test_name = "test-custom-skill";
        let dummy_markdown = "# Test Custom Skill\n\nA dynamic user motion skill with custom rules.\n\n**Fonts:** Inter.\n";

        let registered = register_skill_internal(
            test_name,
            None,
            Some(dummy_markdown),
            Some("A dynamic test motion skill"),
        ).expect("Registration of arbitrary skill must succeed");

        assert_eq!(registered.id, test_name);
        assert_eq!(registered.command, format!("/{}", test_name));
        assert!(registered.has_brief);

        let skill_dir = root.join(".aetheria").join("skills").join(test_name);
        assert!(skill_dir.join("REMOTION_BRIEF.md").exists());
        assert!(skill_dir.join("SKILL.md").exists());
        assert!(skill_dir.join("tokens.json").exists());

        // Test listing exclusively in .aetheria/skills/
        let all = list_all_skills_internal();
        let found = all.iter().find(|s| s.id == test_name);
        assert!(found.is_some(), "Arbitrary registered skill must appear in .aetheria/skills listing");

        // Verify isolation: every listed item MUST reside inside .aetheria/skills
        assert!(all.iter().all(|s| s.path.contains(".aetheria")));

        // Clean up temporary test folder
        let _ = std::fs::remove_dir_all(&skill_dir);
    }
}

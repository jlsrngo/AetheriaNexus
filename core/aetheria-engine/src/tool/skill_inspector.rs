//! Plugin Manifest Inspector, Motion-Graphics Domain Guard & Workspace Skill Linker.

use serde_json::Value;
use std::path::Path;

use super::skill_registry::{InstalledPluginRecord, PluginRuleEntry, PluginSkillEntry};

/// Discovers manifest, skills, and rules from an installed directory (including subpath)
pub(crate) fn inspect_plugin_directory(
    root_dir: &Path,
    sub_path_opt: Option<&str>,
    default_id: &str,
    source: &str,
) -> InstalledPluginRecord {
    let effective_dir = if let Some(sub) = sub_path_opt {
        root_dir.join(sub)
    } else {
        root_dir.to_path_buf()
    };

    let manifest_path = effective_dir.join("plugin.json");
    let mut name = default_id.to_string();
    let mut description = format!("Aetheria plugin: {}", default_id);
    let mut version = "1.0.0".to_string();

    if let Ok(manifest_raw) = std::fs::read_to_string(&manifest_path) {
        if let Ok(val) = serde_json::from_str::<Value>(&manifest_raw) {
            if let Some(n) = val.get("name").and_then(|v| v.as_str()) {
                name = n.to_string();
            }
            if let Some(d) = val.get("description").and_then(|v| v.as_str()) {
                description = d.to_string();
            }
            if let Some(v) = val.get("version").and_then(|v| v.as_str()) {
                version = v.to_string();
            }
        }
    }

    let mut discovered_skills: Vec<PluginSkillEntry> = Vec::new();
    let mut discovered_rules: Vec<PluginRuleEntry> = Vec::new();

    // 1. Root SKILL.md
    let root_skill = effective_dir.join("SKILL.md");
    if root_skill.is_file() {
        let skill_desc =
            extract_description_from_skill_md(&root_skill).unwrap_or_else(|| description.clone());
        discovered_skills.push(PluginSkillEntry {
            name: default_id.to_string(),
            path: root_skill.display().to_string(),
            description: skill_desc,
        });
    }

    // 2. Sub-skills in `skills/`
    let subskills_dir = effective_dir.join("skills");
    if subskills_dir.is_dir() {
        if let Ok(entries) = std::fs::read_dir(&subskills_dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_dir() {
                    let sub_md = p.join("SKILL.md");
                    if sub_md.is_file() {
                        let sub_name = p
                            .file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("skill")
                            .to_string();
                        let sub_desc = extract_description_from_skill_md(&sub_md)
                            .unwrap_or_else(|| format!("Skill: {}", sub_name));
                        discovered_skills.push(PluginSkillEntry {
                            name: sub_name,
                            path: sub_md.display().to_string(),
                            description: sub_desc,
                        });
                    }
                }
            }
        }
    }

    // 3. Rules in `rules/` or `rules.md`
    let root_rules = effective_dir.join("rules.md");
    if root_rules.is_file() {
        discovered_rules.push(PluginRuleEntry {
            name: format!("{}-rules", default_id),
            path: root_rules.display().to_string(),
        });
    }

    let rules_dir = effective_dir.join("rules");
    if rules_dir.is_dir() {
        if let Ok(entries) = std::fs::read_dir(&rules_dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_file() && p.extension().and_then(|e| e.to_str()) == Some("md") {
                    let rule_name = p
                        .file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or("rule")
                        .to_string();
                    discovered_rules.push(PluginRuleEntry {
                        name: rule_name,
                        path: p.display().to_string(),
                    });
                }
            }
        }
    }

    InstalledPluginRecord {
        id: default_id.to_string(),
        name,
        version,
        description,
        source: source.to_string(),
        enabled: true,
        installed_at: crate::paths::now_ms(),
        commit_hash: None,
        sub_path: sub_path_opt.map(str::to_string),
        path: effective_dir.display().to_string(),
        skills: discovered_skills,
        rules: discovered_rules,
    }
}

fn extract_description_from_skill_md(path: &Path) -> Option<String> {
    if let Ok(content) = std::fs::read_to_string(path) {
        for line in content.lines().take(35) {
            let trimmed = line.trim();
            if let Some(desc) = trimmed.strip_prefix("description:") {
                return Some(desc.trim().trim_matches('"').trim_matches('\'').to_string());
            }
        }
    }
    None
}

/// Validates whether an installed plugin belongs to the motion graphics, animation, video,
/// audio/sfx, or visual creative storytelling domain. If unrelated (e.g. backend SQL, kubernetes, crypto),
/// the engine strictly rejects the plugin unless bypassValidation=true is explicitly provided.
pub fn validate_motion_graphics_domain(
    plugin_dir: &Path,
    rec: &InstalledPluginRecord,
) -> Result<(), String> {
    let domain_keywords = [
        "motion", "animation", "anim", "video", "remotion", "graphic", "visual", "storyboard",
        "typography", "kinetic", "audio", "sfx", "sound", "music", "voice", "voiceover", "speech",
        "tts", "render", "timeline", "keyframe", "fps", "cadence", "3d", "webgl", "three", "canvas",
        "glsl", "effect", "color", "palette", "design", "aesthetic", "brand", "caption", "subtitle",
        "cut", "editing", "camera", "b-roll", "stock", "clip", "tiktok", "reel", "short", "youtube",
        "intro", "outro", "lower-third", "hud", "overlay", "transition", "spring", "scene", "composition",
    ];

    let mut corpus = String::new();
    corpus.push_str(&rec.id.to_lowercase());
    corpus.push(' ');
    corpus.push_str(&rec.name.to_lowercase());
    corpus.push(' ');
    corpus.push_str(&rec.description.to_lowercase());
    corpus.push(' ');

    for s in &rec.skills {
        corpus.push_str(&s.name.to_lowercase());
        corpus.push(' ');
        corpus.push_str(&s.description.to_lowercase());
        corpus.push(' ');
    }

    for r in &rec.rules {
        corpus.push_str(&r.name.to_lowercase());
        corpus.push(' ');
    }

    for mf in ["plugin.json", "package.json"] {
        let p = plugin_dir.join(mf);
        if let Ok(c) = std::fs::read_to_string(&p) {
            corpus.push_str(&c.to_lowercase());
        }
    }

    let mut has_creative_assets = false;
    if let Ok(entries) = std::fs::read_dir(plugin_dir) {
        for e in entries.flatten() {
            if let Some(ext) = e.path().extension().and_then(|s| s.to_str()) {
                let lext = ext.to_lowercase();
                if ["mp4", "mov", "wav", "mp3", "svg", "glsl", "gltf", "hdr"]
                    .contains(&lext.as_str())
                {
                    has_creative_assets = true;
                    break;
                }
            }
        }
    }

    let mut match_count = 0;
    for kw in &domain_keywords {
        if corpus.contains(kw) {
            match_count += 1;
        }
    }

    if match_count == 0 && !has_creative_assets {
        return Err(format!(
            "Policy Rejection: Plugin '{}' does not belong to the Motion Graphics or Creative Video domain. Aetheria Nexus strictly accepts only plugins related to motion graphics, video animation, audio/sfx design, or visual storytelling. (Matched domain keywords: 0). To override this policy, pass `force: true`.",
            rec.name
        ));
    }

    Ok(())
}

/// Links discovered plugin skills into `.agents/skills/` so legacy skill lookups discover them
pub(crate) fn link_plugin_skills_to_workspace(ws: &Path, plugin_rec: &InstalledPluginRecord) {
    let ws_skills = ws.join(".agents").join("skills");
    let _ = std::fs::create_dir_all(&ws_skills);

    for s in &plugin_rec.skills {
        let skill_source_path = Path::new(&s.path);
        if let Some(parent_dir) = skill_source_path.parent() {
            let dest_dir = ws_skills.join(&s.name);
            if !dest_dir.exists() {
                let _ = copy_dir_all(parent_dir, &dest_dir);
            }
        }
    }
}

pub(crate) fn copy_dir_all(src: &Path, dst: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        if ty.is_dir() {
            copy_dir_all(&entry.path(), &dst.join(entry.file_name()))?;
        } else {
            std::fs::copy(entry.path(), dst.join(entry.file_name()))?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rejects_unrelated_plugins() {
        let dummy_dir = std::env::temp_dir().join("dummy_unrelated_plugin");
        let _ = std::fs::create_dir_all(&dummy_dir);

        let rec = InstalledPluginRecord {
            id: "pg-migrations".to_string(),
            name: "Postgres Migrations".to_string(),
            version: "1.0.0".to_string(),
            description: "A database migration runner for SQL databases".to_string(),
            source: "github:db/pg-migrations".to_string(),
            enabled: true,
            installed_at: 0,
            commit_hash: None,
            sub_path: None,
            path: dummy_dir.display().to_string(),
            skills: vec![],
            rules: vec![],
        };

        let result = validate_motion_graphics_domain(&dummy_dir, &rec);
        assert!(result.is_err(), "Expected unrelated plugin to be rejected!");
        let err_msg = result.unwrap_err();
        assert!(err_msg.contains("Policy Rejection"), "Error must cite policy rejection");

        let _ = std::fs::remove_dir_all(&dummy_dir);
    }

    #[test]
    fn test_accepts_motion_graphics_plugins() {
        let dummy_dir = std::env::temp_dir().join("dummy_motion_plugin");
        let _ = std::fs::create_dir_all(&dummy_dir);

        let rec = InstalledPluginRecord {
            id: "kinetic-titles".to_string(),
            name: "Kinetic Titles Plugin".to_string(),
            version: "1.0.0".to_string(),
            description: "High-retention kinetic typography and video animation presets for Remotion".to_string(),
            source: "github:creative/kinetic-titles".to_string(),
            enabled: true,
            installed_at: 0,
            commit_hash: None,
            sub_path: None,
            path: dummy_dir.display().to_string(),
            skills: vec![],
            rules: vec![],
        };

        let result = validate_motion_graphics_domain(&dummy_dir, &rec);
        assert!(result.is_ok(), "Expected motion graphics plugin to pass validation!");

        let _ = std::fs::remove_dir_all(&dummy_dir);
    }
}


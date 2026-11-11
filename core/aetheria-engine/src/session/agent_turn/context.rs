//! Context assembly for agent turns:
//! - Workspace skills discovery (`.agents/skills`, `.opencode/skills`, `.aetheria/plugins`)
//! - Plugin rules discovery (`.aetheria/plugins/*/rules/*.md`)
//! - Base system prompt (`<env>`, `<living_memory>`, `<knowledge_base>`)
//!
//! Prompt directive & command resolvers live in [`super::command_resolvers`] (re-exported here).

pub use super::command_resolvers::{
    resolve_dynamic_style_or_skill_command, resolve_mentioned_files,
    resolve_motioncraft_style_command, resolve_reference_report, resolve_voice_preset_command,
};

use crate::knowledge::get_active_knowledge_for_workspace;
use std::path::{Path, PathBuf};

/// Scans workspace directory for installed agent skills (`.agents/skills/*/SKILL.md`, `.aetheria/plugins/*/SKILL.md`, `.opencode/skills/`).
pub fn discover_workspace_skills(workspace_dir: &str) -> String {
    let ws_path = Path::new(workspace_dir);
    let mut search_dirs = vec![
        ws_path.join(".aetheria").join("skills"),
        ws_path.join(".agents").join("skills"),
        ws_path.join("skills"),
        ws_path.join(".opencode").join("skills"),
    ];
    let root = crate::paths::project_root();
    if ws_path != root {
        search_dirs.push(root.join(".aetheria").join("skills"));
        search_dirs.push(root.join(".agents").join("skills"));
        search_dirs.push(root.join(".opencode").join("skills"));
    }

    let plugins_dir = ws_path.join(".aetheria").join("plugins");
    if plugins_dir.is_dir() {
        if let Ok(entries) = std::fs::read_dir(&plugins_dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_dir() {
                    search_dirs.push(p.clone());
                    search_dirs.push(p.join("skills"));
                }
            }
        }
    }

    let mut discovered: Vec<(String, String, PathBuf)> = Vec::new();
    let mut seen = std::collections::HashSet::new();

    for dir in search_dirs {
        if let Ok(entries) = std::fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let skill_dir = entry.path();
                let skill_md = skill_dir.join("SKILL.md");
                if skill_md.is_file() {
                    let dir_name = skill_dir
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("")
                        .to_string();
                    if !seen.insert(dir_name.clone()) {
                        continue;
                    }
                    if let Ok(content) = std::fs::read_to_string(&skill_md) {
                        let mut name = dir_name.clone();
                        let mut desc = String::new();
                        let lines: Vec<&str> = content.lines().take(30).collect();
                        for line in lines {
                            let trimmed = line.trim();
                            if let Some(rest) = trimmed.strip_prefix("name:") {
                                name = rest.trim().to_string();
                            } else if let Some(rest) = trimmed.strip_prefix("description:") {
                                desc = rest.trim().to_string();
                            }
                        }
                        if desc.is_empty() {
                            desc = format!("Skill: {}", name);
                        }
                        discovered.push((name, desc, skill_md));
                    }
                }
            }
        }
    }

    if discovered.is_empty() {
        return String::new();
    }

    let mut out = String::from(
        "<skills>\nYou have access to specialized skills in this workspace. When crafting videos, motion graphics, or code, you may read these skill instructions and design references:\n",
    );
    for (name, desc, path) in discovered {
        out.push_str(&format!(
            "- {}: {} (Path: {})\n",
            name,
            desc,
            path.display()
        ));
    }
    out.push_str("</skills>\n");
    out
}

/// Discovers and loads active plugin rules from `.aetheria/plugins/*/rules/*.md`.
pub fn discover_workspace_plugin_rules(workspace_dir: &str) -> String {
    let ws_path = Path::new(workspace_dir);
    let plugins_dir = ws_path.join(".aetheria").join("plugins");
    if !plugins_dir.is_dir() {
        return String::new();
    }

    let mut rules_out = String::new();
    if let Ok(entries) = std::fs::read_dir(&plugins_dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                let plugin_name = p.file_name().and_then(|n| n.to_str()).unwrap_or("plugin");
                let rules_dir = p.join("rules");
                if rules_dir.is_dir() {
                    if let Ok(rule_files) = std::fs::read_dir(&rules_dir) {
                        for rf in rule_files.flatten() {
                            let rpath = rf.path();
                            if rpath.extension().and_then(|e| e.to_str()) == Some("md") {
                                if let Ok(rule_text) = std::fs::read_to_string(&rpath) {
                                    rules_out.push_str(&format!(
                                        "\n<!-- Rule from plugin: {} ({}) -->\n{}\n",
                                        plugin_name,
                                        rpath.file_name().and_then(|f| f.to_str()).unwrap_or(""),
                                        rule_text.trim()
                                    ));
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if rules_out.is_empty() {
        return String::new();
    }

    format!("<plugin_rules>\n{}\n</plugin_rules>", rules_out)
}

/// Assembles complete system prompt with environment block, living memory, knowledge base, skills, and plugin rules.
pub fn assemble_system_prompt(workspace_dir: &str) -> String {
    let base_prompt_template = include_str!("../prompt/default.txt");
    let now = chrono::Local::now();
    let today_date_str = now.format("%Y-%m-%d").to_string();
    let day_of_week = now.format("%A").to_string();
    let current_time_str = now.format("%H:%M").to_string();

    let mut sys_prompt = format!(
        "{}\n\nHere is some useful information about the environment you are running in:\n\
        <env>\n\
          Working directory: {}\n\
          Platform: {}\n\
          Today's date: {} ({})\n\
          Current local time: {}\n\
        </env>",
        base_prompt_template.trim(),
        workspace_dir,
        std::env::consts::OS,
        today_date_str,
        day_of_week,
        current_time_str
    );

    let living_mem = crate::session::memory::get_living_memory_for_workspace(workspace_dir);
    if !living_mem.trim().is_empty() {
        sys_prompt.push_str("\n\n<living_memory>\n");
        sys_prompt.push_str(living_mem.trim());
        sys_prompt.push_str("\n</living_memory>");
    }

    let active_kn = get_active_knowledge_for_workspace(workspace_dir);
    if !active_kn.is_empty() {
        sys_prompt.push_str("\n\n<knowledge_base>\n");
        for n in active_kn.iter().take(10) {
            let t = n.get("title").and_then(|v| v.as_str()).unwrap_or("Note");
            let c = n.get("content").and_then(|v| v.as_str()).unwrap_or("");
            let snippet: String = c.chars().take(4000).collect();
            sys_prompt.push_str(&format!("--- {} ---\n{}\n", t, snippet));
        }
        sys_prompt.push_str("</knowledge_base>");
    }

    let ws_skills = discover_workspace_skills(workspace_dir);
    if !ws_skills.is_empty() {
        sys_prompt.push_str("\n\n");
        sys_prompt.push_str(&ws_skills);
    }

    let plugin_rules = discover_workspace_plugin_rules(workspace_dir);
    if !plugin_rules.is_empty() {
        sys_prompt.push_str("\n\n");
        sys_prompt.push_str(&plugin_rules);
    }

    sys_prompt
}

#[cfg(test)]
mod tests {
    use super::assemble_system_prompt;

    #[test]
    fn system_prompt_uses_registered_subagent_types() {
        let prompt = include_str!("../prompt/default.txt");
        assert!(prompt.contains("subagent_type: \"audio-director\""));
        assert!(prompt.contains("subagent_type: \"motion-designer\""));
        assert!(prompt.contains("subagent_type: \"qa-verifier\""));
        assert!(!prompt.contains("spawn_subagent(role:"));

        let tmp = std::env::temp_dir().join("aetheria_ctx_prompt_test");
        let _ = std::fs::create_dir_all(&tmp);
        let assembled = assemble_system_prompt(&tmp.to_string_lossy());
        assert!(assembled.contains("Working directory:"));
        let _ = std::fs::remove_dir_all(&tmp);
    }
}

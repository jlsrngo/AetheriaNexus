//! Context assembly for agent turns:
//! - Workspace skills discovery (.agents/skills, .opencode/skills, .aetheria/plugins)
//! - Plugin rules discovery (.aetheria/plugins/*/rules/*.md)
//! - Base system prompt (<env>, <living_memory>, <knowledge_base>)
//! - Active video reference report injection (ref_report.md)
//! - Explicit file mentions (@filename)

use crate::knowledge::get_active_knowledge_for_workspace;
use std::path::{Path, PathBuf};

/// Scans workspace directory for installed agent skills (.agents/skills/*/SKILL.md, .aetheria/plugins/*/SKILL.md, .opencode/skills/)
pub fn discover_workspace_skills(workspace_dir: &str) -> String {
    let ws_path = Path::new(workspace_dir);
    let mut search_dirs = vec![
        ws_path.join(".agents").join("skills"),
        ws_path.join("skills"),
        ws_path.join(".opencode").join("skills"),
    ];
    let root = crate::paths::project_root();
    if ws_path != root {
        search_dirs.push(root.join(".agents").join("skills"));
        search_dirs.push(root.join(".opencode").join("skills"));
    }

    // Also include enabled plugins from .aetheria/plugins
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

/// Discovers and loads active plugin rules from .aetheria/plugins/*/rules/*.md
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

/// Assembles complete system prompt with environment block, living memory, knowledge base, skills, and plugin rules
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

/// Injects active video reference report if present in workspace
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
        "[Active Video Reference Analysis Report (from motioncraft ref report)]:\n\"\"\"\n{}\n\"\"\"\n\
        DIRECTIVES:\n\
        1. VISUAL FIDELITY: Follow the color palette, typography hierarchy, and visual scene composition (mockups, cards, badges) from this reference report. Do not leave the composition as bare plain text on an empty background.\n\
        2. SEQUENTIAL AUDIO: Voiceover narration must be strictly sequential (Scene N starts when Scene N-1 ends). Never overlap speech audio tracks.\n\
        3. SYNTHESIZE AUDIO: Call `voicebox_speak` for each scene to generate matching voiceover for the current script.\n\
        4. RELATIVE SEQUENCE FRAMES: Inside `<Sequence>`, `useCurrentFrame()` already starts at 0. Pass `const frame = useCurrentFrame();` directly without subtracting `startFrame`.",
        bp_text.trim()
    ))
}

/// Resolves @filename mentions in prompt into file context
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


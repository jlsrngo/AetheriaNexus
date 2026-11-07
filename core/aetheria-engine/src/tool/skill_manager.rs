//! OpenCode-Aligned Coding Agent Plugin & Skill Harness for Aetheria Engine.
//! Supports installing plugins & skills from GitHub repositories (e.g. `github:owner/repo`,
//! `owner/repo`, `git+https://...#path:packages/...`), local paths, and npm/git bundles.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use tokio::process::Command;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PluginSkillEntry {
    pub name: String,
    pub path: String,
    pub description: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PluginRuleEntry {
    pub name: String,
    pub path: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct InstalledPluginRecord {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub source: String,
    pub enabled: bool,
    pub installed_at: u64,
    pub commit_hash: Option<String>,
    pub sub_path: Option<String>,
    pub path: String,
    pub skills: Vec<PluginSkillEntry>,
    pub rules: Vec<PluginRuleEntry>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct PluginRegistry {
    pub version: u32,
    pub plugins: Vec<InstalledPluginRecord>,
}

fn get_registry_path(ws: &Path) -> PathBuf {
    ws.join(".aetheria").join("plugins.json")
}

pub fn load_plugin_registry(ws: &Path) -> PluginRegistry {
    let reg_file = get_registry_path(ws);
    if let Ok(data) = std::fs::read_to_string(&reg_file) {
        if let Ok(reg) = serde_json::from_str::<PluginRegistry>(&data) {
            return reg;
        }
    }
    PluginRegistry {
        version: 1,
        plugins: Vec::new(),
    }
}

pub fn save_plugin_registry(ws: &Path, reg: &PluginRegistry) {
    let reg_file = get_registry_path(ws);
    if let Some(parent) = reg_file.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(json_str) = serde_json::to_string_pretty(reg) {
        let _ = std::fs::write(&reg_file, json_str);
    }
}

/// Parsed source representation supporting OpenCode syntax:
/// - `github:owner/repo`
/// - `git+https://github.com/owner/repo.git#path:packages/plugins/name`
/// - `owner/repo#branch`
pub struct ParsedGitSource {
    pub clone_url: String,
    pub branch_or_tag: Option<String>,
    pub sub_path: Option<String>,
    pub default_id: String,
}

pub fn parse_opencode_source(raw: &str) -> Result<ParsedGitSource, String> {
    let mut s = raw.trim();
    if s.is_empty() {
        return Err("Source cannot be empty".to_string());
    }

    // Strip "git+" prefix if present (e.g. git+https://...)
    if let Some(rest) = s.strip_prefix("git+") {
        s = rest;
    }

    // Check for "github:" prefix
    if let Some(rest) = s.strip_prefix("github:") {
        let clean = rest.trim_start_matches('/');
        let (repo, frag) = split_fragment(clean);
        let (branch, sub_path) = parse_fragment(frag);
        let id = derive_id_from_path(sub_path.as_deref().unwrap_or(repo));
        return Ok(ParsedGitSource {
            clone_url: format!("https://github.com/{}.git", repo),
            branch_or_tag: branch,
            sub_path,
            default_id: id,
        });
    }

    // Direct HTTP(S) or Git SSH URL
    if s.starts_with("http://") || s.starts_with("https://") || s.starts_with("git@") {
        let (base, frag) = split_fragment(s);
        let (branch, sub_path) = parse_fragment(frag);
        let clean_base = if base.ends_with(".git") {
            base.to_string()
        } else {
            format!("{}.git", base.trim_end_matches('/'))
        };
        let id = derive_id_from_path(sub_path.as_deref().unwrap_or(base));
        return Ok(ParsedGitSource {
            clone_url: clean_base,
            branch_or_tag: branch,
            sub_path,
            default_id: id,
        });
    }

    // Shorthand "owner/repo"
    if s.contains('/') && !s.contains(' ') {
        let (repo, frag) = split_fragment(s);
        let (branch, sub_path) = parse_fragment(frag);
        let id = derive_id_from_path(sub_path.as_deref().unwrap_or(repo));
        return Ok(ParsedGitSource {
            clone_url: format!("https://github.com/{}.git", repo),
            branch_or_tag: branch,
            sub_path,
            default_id: id,
        });
    }

    // Local path
    Ok(ParsedGitSource {
        clone_url: s.to_string(),
        branch_or_tag: None,
        sub_path: None,
        default_id: derive_id_from_path(s),
    })
}

fn split_fragment(s: &str) -> (&str, Option<&str>) {
    if let Some(idx) = s.find('#') {
        (&s[..idx], Some(&s[idx + 1..]))
    } else {
        (s, None)
    }
}

fn parse_fragment(frag_opt: Option<&str>) -> (Option<String>, Option<String>) {
    let Some(frag) = frag_opt else {
        return (None, None);
    };

    // Supports:
    // "#main" (branch)
    // "#path:packages/plugins/foo" (subpath)
    // "#main::path:packages/foo" (branch + subpath)
    let mut branch = None;
    let mut sub_path = None;

    if frag.contains("::path:") {
        let parts: Vec<&str> = frag.split("::path:").collect();
        branch = Some(parts[0].to_string());
        sub_path = Some(parts[1].trim_matches('/').to_string());
    } else if let Some(p) = frag.strip_prefix("path:") {
        sub_path = Some(p.trim_matches('/').to_string());
    } else {
        branch = Some(frag.to_string());
    }

    (branch, sub_path)
}

fn derive_id_from_path(p: &str) -> String {
    let clean = p.trim_end_matches('/').trim_end_matches(".git");
    clean
        .split('/')
        .last()
        .unwrap_or("plugin")
        .to_lowercase()
        .replace([' ', '_', '.'], "-")
}

/// Discovers manifest, skills, and rules from an installed directory (including subpath)
fn inspect_plugin_directory(
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
        let skill_desc = extract_description_from_skill_md(&root_skill).unwrap_or_else(|| description.clone());
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
                        let sub_name = p.file_name().and_then(|n| n.to_str()).unwrap_or("skill").to_string();
                        let sub_desc = extract_description_from_skill_md(&sub_md).unwrap_or_else(|| format!("Skill: {}", sub_name));
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
                    let rule_name = p.file_stem().and_then(|s| s.to_str()).unwrap_or("rule").to_string();
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

/// Links discovered plugin skills into `.agents/skills/` so legacy skill lookups discover them
fn link_plugin_skills_to_workspace(ws: &Path, plugin_rec: &InstalledPluginRecord) {
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

fn copy_dir_all(src: &Path, dst: &Path) -> std::io::Result<()> {
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

pub fn skill_tool_definitions() -> Vec<Value> {
    vec![
        json!({
            "type": "function",
            "function": {
                "name": "plugin_install",
                "description": "Installs an agent plugin or skill bundle directly from a GitHub repository following OpenCode harness syntax (e.g. 'github:owner/repo', 'owner/repo', 'git+https://...#path:packages/...'), Git URL, or local path. Automatically clones, discovers skills, registers agent rules, and activates it in `.aetheria/plugins/`.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "source": {
                            "type": "string",
                            "description": "GitHub repository ('github:owner/repo', 'owner/repo', 'https://github.com/...#path:...'), Git URL, or local path."
                        },
                        "name": {
                            "type": "string",
                            "description": "Optional custom plugin ID/folder name."
                        },
                        "enabled": {
                            "type": "boolean",
                            "description": "Whether the plugin should be immediately active (default: true)."
                        }
                    },
                    "required": ["source"]
                }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "plugin_list",
                "description": "Lists all installed plugins and skills in the Aetheria harness with their active status, descriptions, skills count, and rules count.",
                "parameters": {
                    "type": "object",
                    "properties": {}
                }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "plugin_toggle",
                "description": "Enables or disables an installed plugin.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "id": {
                            "type": "string",
                            "description": "ID of the installed plugin."
                        },
                        "enabled": {
                            "type": "boolean",
                            "description": "Target enabled state."
                        }
                    },
                    "required": ["id", "enabled"]
                }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "plugin_update",
                "description": "Updates an installed plugin from GitHub by pulling latest commits.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "id": {
                            "type": "string",
                            "description": "ID of the plugin to update."
                        }
                    },
                    "required": ["id"]
                }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "plugin_uninstall",
                "description": "Uninstalls and removes a plugin from the Aetheria harness.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "id": {
                            "type": "string",
                            "description": "ID of the plugin to uninstall."
                        }
                    },
                    "required": ["id"]
                }
            }
        }),
    ]
}

pub async fn execute_install_plugin(workspace_dir: &str, arguments: &Value) -> Value {
    let source_raw = match arguments.get("source").and_then(|v| v.as_str()) {
        Some(s) if !s.trim().is_empty() => s.trim(),
        _ => return json!({ "error": "plugin_install requires a valid 'source' parameter." }),
    };

    let parsed = match parse_opencode_source(source_raw) {
        Ok(p) => p,
        Err(e) => return json!({ "error": format!("Invalid plugin source: {}", e) }),
    };

    let root = crate::paths::project_root();
    let ws = if workspace_dir.trim().is_empty() {
        root.clone()
    } else {
        PathBuf::from(workspace_dir)
    };

    let plugin_id = arguments
        .get("name")
        .or_else(|| arguments.get("id"))
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_lowercase().replace([' ', '_', '.'], "-"))
        .unwrap_or(parsed.default_id);

    let plugins_dir = ws.join(".aetheria").join("plugins");
    let _ = std::fs::create_dir_all(&plugins_dir);

    let target_dir = plugins_dir.join(&plugin_id);
    if target_dir.exists() {
        return json!({
            "success": false,
            "message": format!("Plugin '{}' is already installed at '{}'. Use plugin_toggle to activate/deactivate or uninstall it first.", plugin_id, target_dir.display()),
            "pluginId": plugin_id
        });
    }

    let is_git = parsed.clone_url.starts_with("http://")
        || parsed.clone_url.starts_with("https://")
        || parsed.clone_url.starts_with("git@");

    if is_git {
        // Clone from GitHub
        let mut git_cmd = Command::new("git");
        git_cmd.arg("clone").arg("--depth").arg("1");

        if let Some(ref branch) = parsed.branch_or_tag {
            git_cmd.arg("--branch").arg(branch);
        }

        git_cmd.arg(&parsed.clone_url).arg(&target_dir);

        match git_cmd.output().await {
            Ok(output) if output.status.success() => {
                // Get commit hash
                let mut rev_cmd = Command::new("git");
                rev_cmd.arg("-C").arg(&target_dir).arg("rev-parse").arg("HEAD");
                let commit_hash = rev_cmd.output().await.ok().and_then(|o| {
                    if o.status.success() {
                        Some(String::from_utf8_lossy(&o.stdout).trim().to_string())
                    } else {
                        None
                    }
                });

                let mut rec = inspect_plugin_directory(
                    &target_dir,
                    parsed.sub_path.as_deref(),
                    &plugin_id,
                    source_raw,
                );
                rec.commit_hash = commit_hash;
                rec.enabled = arguments.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true);

                // Link skills to workspace
                link_plugin_skills_to_workspace(&ws, &rec);

                // Save to registry
                let mut reg = load_plugin_registry(&ws);
                reg.plugins.retain(|p| p.id != plugin_id);
                reg.plugins.push(rec.clone());
                save_plugin_registry(&ws, &reg);

                json!({
                    "success": true,
                    "message": format!("Successfully installed plugin '{}' from GitHub ({} skills, {} rules).", plugin_id, rec.skills.len(), rec.rules.len()),
                    "plugin": rec
                })
            }
            Ok(output) => {
                let err = String::from_utf8_lossy(&output.stderr).to_string();
                json!({ "error": format!("Git clone failed: {}", err) })
            }
            Err(err) => json!({ "error": format!("Failed to run git: {}", err) }),
        }
    } else {
        // Local directory install
        let local_path = Path::new(&parsed.clone_url);
        if !local_path.exists() {
            return json!({ "error": format!("Local directory not found: {}", parsed.clone_url) });
        }

        if let Err(err) = copy_dir_all(local_path, &target_dir) {
            return json!({ "error": format!("Failed to copy plugin files: {}", err) });
        }

        let mut rec = inspect_plugin_directory(
            &target_dir,
            parsed.sub_path.as_deref(),
            &plugin_id,
            source_raw,
        );
        rec.enabled = arguments.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true);
        link_plugin_skills_to_workspace(&ws, &rec);

        let mut reg = load_plugin_registry(&ws);
        reg.plugins.retain(|p| p.id != plugin_id);
        reg.plugins.push(rec.clone());
        save_plugin_registry(&ws, &reg);

        json!({
            "success": true,
            "message": format!("Successfully installed local plugin '{}' ({} skills, {} rules).", plugin_id, rec.skills.len(), rec.rules.len()),
            "plugin": rec
        })
    }
}

pub fn execute_list_plugins(workspace_dir: &str) -> Value {
    let root = crate::paths::project_root();
    let ws = if workspace_dir.trim().is_empty() {
        root.clone()
    } else {
        PathBuf::from(workspace_dir)
    };

    let reg = load_plugin_registry(&ws);
    json!({
        "success": true,
        "totalPlugins": reg.plugins.len(),
        "plugins": reg.plugins
    })
}

pub fn execute_toggle_plugin(workspace_dir: &str, arguments: &Value) -> Value {
    let id = match arguments.get("id").and_then(|v| v.as_str()) {
        Some(s) if !s.trim().is_empty() => s.trim(),
        _ => return json!({ "error": "plugin_toggle requires 'id'." }),
    };
    let enabled = arguments.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true);

    let root = crate::paths::project_root();
    let ws = if workspace_dir.trim().is_empty() {
        root.clone()
    } else {
        PathBuf::from(workspace_dir)
    };

    let mut reg = load_plugin_registry(&ws);
    let mut found = false;
    for p in &mut reg.plugins {
        if p.id == id {
            p.enabled = enabled;
            found = true;
            break;
        }
    }

    if !found {
        return json!({ "error": format!("Plugin '{}' not found.", id) });
    }

    save_plugin_registry(&ws, &reg);
    json!({
        "success": true,
        "message": format!("Plugin '{}' is now {}.", id, if enabled { "enabled" } else { "disabled" }),
        "id": id,
        "enabled": enabled
    })
}

pub async fn execute_update_plugin(workspace_dir: &str, arguments: &Value) -> Value {
    let id = match arguments.get("id").and_then(|v| v.as_str()) {
        Some(s) if !s.trim().is_empty() => s.trim(),
        _ => return json!({ "error": "plugin_update requires 'id'." }),
    };

    let root = crate::paths::project_root();
    let ws = if workspace_dir.trim().is_empty() {
        root.clone()
    } else {
        PathBuf::from(workspace_dir)
    };

    let plugin_dir = ws.join(".aetheria").join("plugins").join(id);
    if !plugin_dir.exists() {
        return json!({ "error": format!("Plugin directory '{}' does not exist.", plugin_dir.display()) });
    }

    let mut pull_cmd = Command::new("git");
    pull_cmd.arg("-C").arg(&plugin_dir).arg("pull");

    match pull_cmd.output().await {
        Ok(out) if out.status.success() => {
            let mut rev_cmd = Command::new("git");
            rev_cmd.arg("-C").arg(&plugin_dir).arg("rev-parse").arg("HEAD");
            let commit_hash = rev_cmd.output().await.ok().and_then(|o| {
                if o.status.success() {
                    Some(String::from_utf8_lossy(&o.stdout).trim().to_string())
                } else {
                    None
                }
            });

            let mut reg = load_plugin_registry(&ws);
            for p in &mut reg.plugins {
                if p.id == id {
                    p.commit_hash = commit_hash.clone();
                    break;
                }
            }
            save_plugin_registry(&ws, &reg);

            json!({
                "success": true,
                "message": format!("Plugin '{}' updated to commit {:?}", id, commit_hash)
            })
        }
        Ok(out) => {
            let err = String::from_utf8_lossy(&out.stderr).to_string();
            json!({ "error": format!("Git pull failed: {}", err) })
        }
        Err(err) => json!({ "error": format!("Failed to run git pull: {}", err) }),
    }
}

pub async fn execute_uninstall_plugin(workspace_dir: &str, arguments: &Value) -> Value {
    let id = match arguments.get("id").and_then(|v| v.as_str()) {
        Some(s) if !s.trim().is_empty() => s.trim(),
        _ => return json!({ "error": "plugin_uninstall requires 'id'." }),
    };

    let root = crate::paths::project_root();
    let ws = if workspace_dir.trim().is_empty() {
        root.clone()
    } else {
        PathBuf::from(workspace_dir)
    };

    let plugin_dir = ws.join(".aetheria").join("plugins").join(id);
    if plugin_dir.exists() {
        let _ = std::fs::remove_dir_all(&plugin_dir);
    }

    let mut reg = load_plugin_registry(&ws);
    reg.plugins.retain(|p| p.id != id);
    save_plugin_registry(&ws, &reg);

    json!({
        "success": true,
        "message": format!("Plugin '{}' has been uninstalled.", id)
    })
}
